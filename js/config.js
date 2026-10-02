/**
 * App configuration: export/import, title, refresh interval.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { normalizeTrackedConfig, normalizeExternalConfig, serializeExternalConfig } = Watchtower.validation;
    const state = Watchtower.state;
    const { els } = Watchtower.dom;

    function applyAppTitle() {
        const title = (state.appSettings.appTitle || 'Watchtower').trim() || 'Watchtower';
        if (els.appTitle) els.appTitle.textContent = title;
    }

    function startAutoRefresh() {
        if (state.autoRefreshIntervalId) clearInterval(state.autoRefreshIntervalId);
        const mins = Math.max(1, Math.min(120, parseInt(state.appSettings.refreshIntervalMinutes, 10) || 2));
        state.appSettings.refreshIntervalMinutes = mins;
        state.autoRefreshIntervalId = setInterval(() => Watchtower.app.fetchAllStatuses({ silent: true }), mins * 60 * 1000);
    }

    function exportConfig() {
        const backup = {
            trackedConfig: state.trackedConfig,
            trackedExternalConfig: serializeExternalConfig(state.trackedExternalConfig),
            appSettings: state.appSettings
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
        const titleDate = new Date().toISOString().split('T')[0];
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `sf_status_config_${titleDate}.json`);
        dlAnchorElem.click();
    }

    function importConfig(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed && typeof parsed === 'object') {
                    if (!Array.isArray(parsed.trackedConfig)) {
                        throw new Error('Missing or invalid trackedConfig array');
                    }
                    const importedOrgs = normalizeTrackedConfig(parsed.trackedConfig);
                    const objectEntries = parsed.trackedConfig.filter(g => typeof g !== 'string').length;
                    const skipped = objectEntries > 0 ? objectEntries - importedOrgs.length : 0;
                    state.trackedConfig = importedOrgs;
                    Watchtower.storage.saveInstances();
                    if (Array.isArray(parsed.trackedExternalConfig)) {
                        state.trackedExternalConfig = normalizeExternalConfig(parsed.trackedExternalConfig);
                        Watchtower.storage.saveExternalInstances();
                    }
                    if (parsed.appSettings && typeof parsed.appSettings === 'object') {
                        state.appSettings = { appTitle: 'Watchtower', refreshIntervalMinutes: 2, dashboardView: 'cards', ...parsed.appSettings };
                        Watchtower.storage.saveAppSettings();
                        applyAppTitle();
                        startAutoRefresh();
                        if (els.appTitleInput) els.appTitleInput.value = state.appSettings.appTitle || 'Watchtower';
                        if (els.refreshIntervalInput) els.refreshIntervalInput.value = state.appSettings.refreshIntervalMinutes ?? 2;
                    }

                    els.inputError.classList.add('hidden');
                    Watchtower.sidebar.renderSidebarList();
                    Watchtower.sidebar.renderExternalList();
                    Watchtower.app.fetchAllStatuses();
                    alert(skipped > 0
                        ? `Configuration imported. ${skipped} invalid organization entr${skipped === 1 ? 'y was' : 'ies were'} skipped.`
                        : 'Configuration imported successfully!');
                }
            } catch (err) {
                console.error('Import failed:', err);
                alert('Failed to parse the configuration file. Please ensure it is a valid export.');
            } finally {
                els.fileImport.value = '';
            }
        };
        reader.readAsText(file);
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.config = {
        applyAppTitle,
        startAutoRefresh,
        exportConfig,
        importConfig
    };
})(typeof window !== 'undefined' ? window : this);
