/**
 * LocalStorage persistence and migration logic.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { STORAGE_KEY, DEFAULT_CONFIG, EXTERNAL_STORAGE_KEY, APP_SETTINGS_KEY } = Watchtower.constants;
    const state = Watchtower.state;
    const { normalizeTrackedConfig, normalizeExternalConfig, serializeExternalConfig } = Watchtower.validation;

    function saveInstances() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trackedConfig));
    }

    function loadInstances() {
        const saved = localStorage.getItem(STORAGE_KEY);
        let parsed = null;
        if (saved) {
            try {
                parsed = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved instances:', e);
            }
        }

        if (Array.isArray(parsed)) {
            state.trackedConfig = normalizeTrackedConfig(parsed);
            migrateLegacyServiceSettings();
        } else {
            state.trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
        // Persist the normalized form so older formats are migrated once.
        saveInstances();
        Watchtower.sidebar.renderSidebarList();
    }

    /** Moves per-org service filters from the old 'sf_status_settings' key onto each org group. */
    function migrateLegacyServiceSettings() {
        try {
            const oldSettings = localStorage.getItem('sf_status_settings');
            if (!oldSettings) return;
            const shownByOrg = JSON.parse(oldSettings).shownServicesByOrg;
            if (shownByOrg && typeof shownByOrg === 'object') {
                state.trackedConfig.forEach(g => {
                    if (g.shownServices.length === 0 && Array.isArray(shownByOrg[g.prod])) {
                        g.shownServices = shownByOrg[g.prod].filter(s => typeof s === 'string');
                    }
                });
            }
            localStorage.removeItem('sf_status_settings');
        } catch (e) { /* Settings migration skipped */ }
    }

    function loadExternalInstances() {
        const saved = localStorage.getItem(EXTERNAL_STORAGE_KEY);
        let parsed = [];
        if (saved) {
            try {
                parsed = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse external instances:', e);
            }
        }
        state.trackedExternalConfig = normalizeExternalConfig(parsed);
        // Rewrites entries saved by older versions (which stored full definitions) in the slim format.
        saveExternalInstances();
        Watchtower.sidebar.renderExternalList();
    }

    function saveExternalInstances() {
        localStorage.setItem(EXTERNAL_STORAGE_KEY, JSON.stringify(serializeExternalConfig(state.trackedExternalConfig)));
    }

    function loadAppSettings() {
        const saved = localStorage.getItem(APP_SETTINGS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    state.appSettings = { appTitle: 'Watchtower', refreshIntervalMinutes: 2, dashboardView: 'cards', ...parsed };
                }
            } catch (e) {
                console.error('Failed to parse app settings:', e);
            }
        }
        Watchtower.config.applyAppTitle();
        const { els } = Watchtower.dom;
        if (els.appTitleInput) els.appTitleInput.value = state.appSettings.appTitle || 'Watchtower';
        if (els.refreshIntervalInput) els.refreshIntervalInput.value = state.appSettings.refreshIntervalMinutes ?? 2;
    }

    function saveAppSettings() {
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(state.appSettings));
    }

    global.Watchtower.storage = {
        loadInstances,
        saveInstances,
        loadExternalInstances,
        saveExternalInstances,
        loadAppSettings,
        saveAppSettings
    };
})(globalThis);
