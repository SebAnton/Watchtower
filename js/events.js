/**
 * Event listeners and user action handlers.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { escapeHtml } = Watchtower.utils;
    const { SUPPORTED_EXTERNAL_SERVICES } = Watchtower.constants;
    const state = Watchtower.state;
    const { els } = Watchtower.dom;

    function showError(msg) {
        els.inputError.textContent = msg;
        els.inputError.classList.remove('hidden');
    }

    function hideError() {
        els.inputError.classList.add('hidden');
    }

    function handleAddProdInstance(e) {
        e.preventDefault();
        const val = els.newInput.value.trim().toUpperCase();
        const aliasVal = els.newAlias.value.trim();

        if (!val) return;
        const finalAlias = aliasVal ? aliasVal : val;
        if (state.trackedConfig.some(g => g.prod === val && g.prodName === finalAlias)) {
            showError('Production Org with this instance and alias already tracked.');
            return;
        }
        if (!/^[A-Z0-9]{2,15}$/.test(val)) {
            showError('Invalid instance format. Use e.g., NA211');
            return;
        }

        hideError();
        state.trackedConfig.push({
            id: Watchtower.utils.generateOrgId(),
            prod: val,
            prodName: finalAlias,
            sandboxes: [],
            shownServices: []
        });
        Watchtower.storage.saveInstances();
        els.newInput.value = '';
        els.newAlias.value = '';
        Watchtower.sidebar.renderSidebarList();
        Watchtower.app.fetchAllStatuses();
    }

    function handleAddSandbox(orgId, instanceInput, aliasInput) {
        const val = instanceInput.value.trim().toUpperCase();
        if (!val) return;

        const group = state.trackedConfig.find(g => g.id === orgId);
        if (!group) return;

        const aliasVal = aliasInput ? aliasInput.value.trim() : '';
        const finalName = aliasVal || val;

        if (group.sandboxes.some(s => s.id === val && s.name === finalName)) {
            alert('Sandbox instance already tracked with this alias under this Organization.');
            return;
        }
        if (!/^[A-Z0-9]{2,15}$/.test(val)) {
            alert('Invalid instance format. Use e.g., CS71');
            return;
        }

        group.sandboxes.push({ id: val, name: finalName });
        Watchtower.storage.saveInstances();
        instanceInput.value = '';
        if (aliasInput) aliasInput.value = '';
        Watchtower.sidebar.renderSidebarList();
        Watchtower.app.fetchAllStatuses();
    }

    function removeProdOrg(orgId) {
        const group = state.trackedConfig.find(g => g.id === orgId);
        if (!group) return;
        Watchtower.modal.showConfirmModal(`Remove Production Org <strong>${escapeHtml(group.prodName)}</strong> and all its tracked sandboxes?`, () => {
            state.trackedConfig = state.trackedConfig.filter(g => g.id !== orgId);
            Watchtower.storage.saveInstances();
            Watchtower.sidebar.renderSidebarList();
            Watchtower.app.fetchAllStatuses();
        });
    }

    function handleAddExternalService(e) {
        e.preventDefault();
        const svcId = els.externalSelect.value;
        if (!svcId) return;

        if (state.trackedExternalConfig.some(s => s.id === svcId)) {
            alert('External Service already tracked.');
            return;
        }

        const svcDef = SUPPORTED_EXTERNAL_SERVICES.find(s => s.id === svcId);
        if (svcDef) {
            const config = { ...svcDef };
            if (svcDef.type === 'azure') config.shownRegions = [];
            state.trackedExternalConfig.push(config);
            Watchtower.storage.saveExternalInstances();
            Watchtower.sidebar.renderExternalList();
            els.externalSelect.value = '';
            Watchtower.app.fetchAllStatuses();
        }
    }

    function removeExternalService(svcId) {
        const svc = state.trackedExternalConfig.find(s => s.id === svcId);
        if (!svc) return;

        Watchtower.modal.showConfirmModal(`Remove <strong>${escapeHtml(svc.name)}</strong> from tracking?`, () => {
            state.trackedExternalConfig = state.trackedExternalConfig.filter(s => s.id !== svcId);
            Watchtower.storage.saveExternalInstances();
            Watchtower.sidebar.renderExternalList();
            Watchtower.app.fetchAllStatuses();
        });
    }

    function removeSandbox(orgId, sandboxObj) {
        const group = state.trackedConfig.find(g => g.id === orgId);
        if (!group) return;

        Watchtower.modal.showConfirmModal(`Remove Sandbox <strong>${escapeHtml(sandboxObj.name)}</strong> from ${escapeHtml(group.prodName)}?`, () => {
            group.sandboxes = group.sandboxes.filter(s => s !== sandboxObj);
            Watchtower.storage.saveInstances();
            Watchtower.sidebar.renderSidebarList();
            Watchtower.app.fetchAllStatuses();
        });
    }

    function handleManualRefresh() {
        const icon = els.refreshBtn.querySelector('i');
        icon.classList.add('spinning');
        Watchtower.app.fetchAllStatuses({ silent: true }).finally(() => {
            setTimeout(() => {
                icon.classList.remove('spinning');
                Watchtower.dashboard.showRefreshSuccess();
            }, 500);
        });
    }

    function setupEventListeners() {
        els.sidebarToggle.addEventListener('click', () => els.sidebar.classList.toggle('collapsed'));
        els.addForm.addEventListener('submit', handleAddProdInstance);
        els.addExternalBtn.addEventListener('click', handleAddExternalService);
        els.refreshBtn.addEventListener('click', handleManualRefresh);

        if (els.appTitleInput) {
            els.appTitleInput.addEventListener('input', () => {
                state.appSettings.appTitle = els.appTitleInput.value.trim() || 'Watchtower';
                Watchtower.storage.saveAppSettings();
                Watchtower.config.applyAppTitle();
            });
            els.appTitleInput.addEventListener('blur', () => {
                if (!els.appTitleInput.value.trim()) {
                    state.appSettings.appTitle = 'Watchtower';
                    els.appTitleInput.value = 'Watchtower';
                    Watchtower.storage.saveAppSettings();
                    Watchtower.config.applyAppTitle();
                }
            });
        }
        if (els.refreshIntervalInput) {
            els.refreshIntervalInput.addEventListener('change', () => {
                const val = parseInt(els.refreshIntervalInput.value, 10);
                const mins = isNaN(val) || val < 1 ? 2 : Math.min(120, val);
                state.appSettings.refreshIntervalMinutes = mins;
                els.refreshIntervalInput.value = mins;
                Watchtower.storage.saveAppSettings();
                Watchtower.config.startAutoRefresh();
            });
            els.refreshIntervalInput.addEventListener('blur', () => {
                const val = parseInt(els.refreshIntervalInput.value, 10);
                if (isNaN(val) || val < 1) {
                    state.appSettings.refreshIntervalMinutes = 2;
                    els.refreshIntervalInput.value = 2;
                    Watchtower.storage.saveAppSettings();
                    Watchtower.config.startAutoRefresh();
                }
            });
        }

        els.btnExport.addEventListener('click', Watchtower.config.exportConfig);
        els.btnImport.addEventListener('click', () => els.fileImport.click());
        els.fileImport.addEventListener('change', Watchtower.config.importConfig);

        if (els.viewCardsBtn && els.viewTableBtn) {
            Watchtower.dashboard.applyViewToggle();
            els.viewCardsBtn.addEventListener('click', () => {
                state.appSettings.dashboardView = 'cards';
                Watchtower.storage.saveAppSettings();
                Watchtower.dashboard.applyViewToggle();
                Watchtower.dashboard.renderDashboardDOM();
            });
            els.viewTableBtn.addEventListener('click', () => {
                state.appSettings.dashboardView = 'table';
                Watchtower.storage.saveAppSettings();
                Watchtower.dashboard.applyViewToggle();
                Watchtower.dashboard.renderDashboardDOM();
            });
        }
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.events = {
        setupEventListeners,
        handleAddProdInstance,
        handleAddSandbox,
        handleAddExternalService,
        removeProdOrg,
        removeExternalService,
        removeSandbox,
        showError,
        hideError
    };
})(typeof window !== 'undefined' ? window : this);
