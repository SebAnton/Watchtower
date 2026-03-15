/**
 * App configuration: export/import, title, refresh interval.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { SUPPORTED_EXTERNAL_SERVICES } = Watchtower.constants;
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
            trackedExternalConfig: state.trackedExternalConfig,
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
                    if (parsed.trackedConfig && Array.isArray(parsed.trackedConfig)) {
                        parsed.trackedConfig.forEach(g => { if (!g.shownServices) g.shownServices = []; });
                        state.trackedConfig = parsed.trackedConfig;
                        Watchtower.storage.saveInstances();
                    } else {
                        throw new Error('Missing or invalid trackedConfig array');
                    }
                    if (parsed.trackedExternalConfig && Array.isArray(parsed.trackedExternalConfig)) {
                        state.trackedExternalConfig = parsed.trackedExternalConfig
                            .filter(s => SUPPORTED_EXTERNAL_SERVICES.some(def => def.id === s.id))
                            .map(s => {
                                const def = SUPPORTED_EXTERNAL_SERVICES.find(d => d.id === s.id);
                                const merged = { ...def, ...s };
                                if (s.type === 'azure' && !Array.isArray(merged.shownRegions)) merged.shownRegions = [];
                                return merged;
                            });
                        Watchtower.storage.saveExternalInstances();
                    }
                    if (parsed.appSettings && typeof parsed.appSettings === 'object') {
                        state.appSettings = { appTitle: 'Watchtower', refreshIntervalMinutes: 2, ...parsed.appSettings };
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
                    alert('Configuration imported successfully!');
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
