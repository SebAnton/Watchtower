/**
 * LocalStorage persistence and migration logic.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { STORAGE_KEY, DEFAULT_CONFIG, EXTERNAL_STORAGE_KEY, APP_SETTINGS_KEY } = Watchtower.constants;
    const state = Watchtower.state;

    function saveInstances() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trackedConfig));
    }

    function loadInstances() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (typeof parsed[0] === 'string') {
                        const prods = parsed.filter(i => !i.startsWith('CS') && !i.startsWith('TEST'));
                        const sandboxes = parsed.filter(i => i.startsWith('CS') || i.startsWith('TEST')).map(sb => ({ id: sb, name: sb }));

                        if (prods.length === 0) {
                            state.trackedConfig = [{ id: Watchtower.utils.generateOrgId(), prod: 'LEGACY_PROD', prodName: 'LEGACY_PROD', sandboxes }];
                        } else {
                            state.trackedConfig = prods.map((p, idx) => ({
                                id: Watchtower.utils.generateOrgId(),
                                prod: p,
                                prodName: p,
                                sandboxes: idx === 0 ? sandboxes : []
                            }));
                        }
                        saveInstances();
                    } else if (typeof parsed[0] === 'object' && parsed[0].prod && (!parsed[0].prodName || (parsed[0].sandboxes.length > 0 && typeof parsed[0].sandboxes[0] === 'string'))) {
                        state.trackedConfig = parsed.map(g => ({
                            id: g.id || Watchtower.utils.generateOrgId(),
                            prod: g.prod,
                            prodName: g.prodName || g.prod,
                            sandboxes: (g.sandboxes || []).map(sb => typeof sb === 'string' ? { id: sb, name: sb } : sb)
                        }));
                        saveInstances();
                    } else {
                        state.trackedConfig = parsed;
                    }
                } else {
                    state.trackedConfig = parsed;
                }

                let migrated = false;
                try {
                    const oldSettings = localStorage.getItem('sf_status_settings');
                    if (oldSettings) {
                        const settingsParsed = JSON.parse(oldSettings);
                        const shownByOrg = settingsParsed.shownServicesByOrg || settingsParsed.hiddenServicesByOrg ? {} : null;
                        if (settingsParsed.shownServicesByOrg) {
                            Object.assign(shownByOrg, settingsParsed.shownServicesByOrg);
                        }
                        if (shownByOrg) {
                            state.trackedConfig.forEach(g => {
                                if (!g.shownServices) g.shownServices = shownByOrg[g.prod] || [];
                            });
                            migrated = true;
                        }
                        localStorage.removeItem('sf_status_settings');
                    }
                } catch (e) { /* Settings migration skipped */ }

                state.trackedConfig.forEach(g => {
                    if (!g.shownServices) g.shownServices = [];
                });

                if (migrated) saveInstances();
            } catch (e) {
                console.error('Failed to parse saved instances:', e);
                state.trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            }
        } else {
            state.trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveInstances();
        }
        Watchtower.sidebar.renderSidebarList();
    }

    function loadExternalInstances() {
        const saved = localStorage.getItem(EXTERNAL_STORAGE_KEY);
        if (saved) {
            try {
                state.trackedExternalConfig = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse external instances:', e);
                state.trackedExternalConfig = [];
            }
        } else {
            state.trackedExternalConfig = [];
        }
        Watchtower.sidebar.renderExternalList();
    }

    function saveExternalInstances() {
        localStorage.setItem(EXTERNAL_STORAGE_KEY, JSON.stringify(state.trackedExternalConfig));
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
})(typeof window !== 'undefined' ? window : this);
