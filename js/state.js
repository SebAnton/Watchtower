/**
 * Application state - mutable data shared across modules.
 */
(function (global) {
    'use strict';

    const { DEFAULT_CONFIG } = global.Watchtower.constants;

    let trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    let trackedExternalConfig = [];
    let appSettings = { appTitle: 'Watchtower', refreshIntervalMinutes: 2, dashboardView: 'cards' };
    let fetchCache = {};
    let autoRefreshIntervalId = null;

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.state = {
        get trackedConfig() { return trackedConfig; },
        set trackedConfig(v) { trackedConfig = v; },
        get trackedExternalConfig() { return trackedExternalConfig; },
        set trackedExternalConfig(v) { trackedExternalConfig = v; },
        get appSettings() { return appSettings; },
        set appSettings(v) { appSettings = v; },
        get fetchCache() { return fetchCache; },
        set fetchCache(v) { fetchCache = v; },
        get autoRefreshIntervalId() { return autoRefreshIntervalId; },
        set autoRefreshIntervalId(v) { autoRefreshIntervalId = v; }
    };
})(typeof window !== 'undefined' ? window : this);
