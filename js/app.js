/**
 * Main application orchestration and data fetching.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { escapeHtml } = Watchtower.utils;
    const state = Watchtower.state;
    const { els } = Watchtower.dom;
    const { getCacheDigest } = Watchtower.status;
    const { fetchInstanceData, fetchExternalInstanceData } = Watchtower.api;

    // Each call gets an id; results from a call that has since been superseded are dropped,
    // so a slow older fetch can't overwrite data from a newer one (e.g. after adding a sandbox).
    let latestRequestId = 0;
    // True while loading skeletons are on screen, so a silent refresh that supersedes
    // a full load still renders even when the data itself hasn't changed.
    let skeletonShown = false;

    async function fetchAllStatuses(options = {}) {
        const requestId = ++latestRequestId;

        if (state.trackedConfig.length === 0 && state.trackedExternalConfig.length === 0) {
            els.statusGrid.innerHTML = '';
            els.statusGrid.classList.remove('dashboard-grid');
            els.statusGrid.innerHTML = `<div class="empty-state">
                <img src="assets/brand/logo.webp" alt="Watchtower">
                <h3>No Services Tracked</h3>
                <p>Add a Salesforce Production org, or an external service from the sidebar configuration to begin tracking status.</p>
            </div>`;
            Watchtower.dashboard.updateTimestamp();
            return;
        }

        const isBackgroundRefresh = options.silent === true && Object.keys(state.fetchCache).length > 0;

        if (!isBackgroundRefresh) {
            els.statusGrid.innerHTML = '';
            els.statusGrid.classList.remove('dashboard-grid');
            skeletonShown = true;
        }

        const uniqueInstances = new Set();
        state.trackedConfig.forEach(group => {
            uniqueInstances.add(group.prod);
            group.sandboxes.forEach(sb => uniqueInstances.add(sb.id));
        });

        if (!isBackgroundRefresh) {
            const view = state.appSettings.dashboardView || 'cards';
            if (view === 'table') {
                const rowCount = state.trackedConfig.reduce((n, g) => n + 1 + g.sandboxes.length, 0) + state.trackedExternalConfig.length;
                const skeletonRows = Array(Math.max(3, rowCount)).fill(0).map(() =>
                    '<tr class="skeleton"><td><div class="skeleton-text short"></div></td><td><div class="skeleton-text short"></div></td><td><div class="skeleton-text short"></div></td><td><div class="skeleton-text short"></div></td><td><div class="skeleton-text short"></div></td></tr>'
                ).join('');
                els.statusGrid.innerHTML = `
                    <div class="dashboard-table-wrapper glass-panel skeleton">
                        <table class="dashboard-table">
                            <thead><tr><th>Instance</th><th>Type</th><th>Status</th><th>Incidents</th><th>Release</th></tr></thead>
                            <tbody>${skeletonRows}</tbody>
                        </table>
                    </div>
                `;
                els.statusGrid.classList.add('dashboard-table-view');
            } else {
                state.trackedConfig.forEach(group => {
                    const skeletonHtml = `
                        <div class="org-group">
                            <div class="org-group-header">
                                <h2>${escapeHtml(group.prodName)}</h2>
                                <span class="org-group-badge">Loading...</span>
                            </div>
                            <div class="dashboard-grid">
                                <div class="status-card glass-panel skeleton"><div class="card-header"><div class="skeleton-text short"></div><div class="skeleton-circle"></div></div><div class="skeleton-text long"></div></div>
                                ${group.sandboxes.map(() => '<div class="status-card glass-panel skeleton"><div class="card-header"><div class="skeleton-text short"></div><div class="skeleton-circle"></div></div><div class="skeleton-text long"></div></div>').join('')}
                            </div>
                        </div>
                    `;
                    els.statusGrid.innerHTML += skeletonHtml;
                });
                if (state.trackedExternalConfig.length > 0) {
                    const extSkeletonHtml = `
                        <div class="org-group">
                            <div class="org-group-header">
                                <h2>External Services</h2>
                                <span class="org-group-badge">Loading...</span>
                            </div>
                            <div class="dashboard-grid">
                                ${state.trackedExternalConfig.map(() => '<div class="status-card glass-panel skeleton"><div class="card-header"><div class="skeleton-text short"></div><div class="skeleton-circle"></div></div><div class="skeleton-text long"></div></div>').join('')}
                            </div>
                        </div>
                    `;
                    els.statusGrid.innerHTML += extSkeletonHtml;
                }
            }
        }

        const fetchPromises = Array.from(uniqueInstances).map(instance => fetchInstanceData(instance));
        const fetchExternalPromises = state.trackedExternalConfig.map(svc => fetchExternalInstanceData(svc));

        try {
            const results = await Promise.all([...fetchPromises, ...fetchExternalPromises]);
            if (requestId !== latestRequestId) return;
            const newCache = {};
            results.forEach(res => { newCache[res.instance] = res; });
            const newDigest = getCacheDigest(newCache);

            if (isBackgroundRefresh && !skeletonShown && newDigest === getCacheDigest(state.fetchCache)) {
                state.fetchCache = newCache;
                Watchtower.dashboard.showRefreshSuccess();
                return;
            }

            state.fetchCache = newCache;
            skeletonShown = false;
            Watchtower.sidebar.populateOrgFilters();
            Watchtower.sidebar.populateExternalFilters();
            Watchtower.dashboard.renderDashboardDOM();
            Watchtower.dashboard.showRefreshSuccess();
        } catch (err) {
            console.error('Error fetching data:', err);
            if (skeletonShown && requestId === latestRequestId) {
                skeletonShown = false;
                Watchtower.dashboard.renderDashboardDOM();
            }
        }
    }

    function init() {
        Watchtower.storage.loadInstances();
        Watchtower.storage.loadExternalInstances();
        Watchtower.storage.loadAppSettings();
        Watchtower.sidebar.populateExternalSelect();
        Watchtower.events.setupEventListeners();
        fetchAllStatuses();
        Watchtower.config.startAutoRefresh();
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.app = {
        init,
        fetchAllStatuses
    };

    document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : this);
