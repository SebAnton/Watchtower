/**
 * Sidebar UI: org list, external services, filters.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { escapeHtml, escapeForJsString } = Watchtower.utils;
    const { SUPPORTED_EXTERNAL_SERVICES, AZURE_REGIONS } = Watchtower.constants;
    const state = Watchtower.state;
    const { els } = Watchtower.dom;

    function populateExternalSelect() {
        els.externalSelect.innerHTML = '<option value="" disabled selected>Select a Service</option>';
        SUPPORTED_EXTERNAL_SERVICES.forEach(svc => {
            const option = document.createElement('option');
            option.value = svc.id;
            option.textContent = svc.name;
            els.externalSelect.appendChild(option);
        });
    }

    function populateOrgFilters() {
        state.trackedConfig.forEach(group => {
            const serviceSet = new Set();
            const prodRes = state.fetchCache[group.prod];
            if (prodRes && prodRes.success && prodRes.data && prodRes.data.Services) {
                prodRes.data.Services.forEach(s => serviceSet.add(s.key));
            }
            group.sandboxes.forEach(sb => {
                const sbRes = state.fetchCache[sb.id];
                if (sbRes && sbRes.success && sbRes.data && sbRes.data.Services) {
                    sbRes.data.Services.forEach(s => serviceSet.add(s.key));
                }
            });

            const container = document.getElementById(`filters-${group.id}`);
            if (!container) return;

            if (serviceSet.size === 0) {
                container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.3rem 0;">No services found.</div>';
                return;
            }

            const sortedServices = Array.from(serviceSet).sort((a, b) => a.localeCompare(b));
            const shownList = group.shownServices || [];
            let html = '';
            sortedServices.forEach(srv => {
                const isChecked = shownList.includes(srv);
                html += `
                    <label class="filter-item">
                        <input type="checkbox" value="${escapeHtml(srv)}" ${isChecked ? 'checked' : ''} onchange="Watchtower.sidebar.toggleOrgServiceFilter('${escapeForJsString(group.id)}', '${escapeForJsString(srv)}', this.checked)">
                        ${escapeHtml(srv)}
                    </label>
                `;
            });
            container.innerHTML = html;
        });
    }

    function toggleOrgServiceFilter(orgId, serviceKey, isChecked) {
        const group = state.trackedConfig.find(g => g.id === orgId);
        if (!group) return;
        if (!group.shownServices) group.shownServices = [];

        if (isChecked) {
            if (!group.shownServices.includes(serviceKey)) group.shownServices.push(serviceKey);
        } else {
            group.shownServices = group.shownServices.filter(s => s !== serviceKey);
        }
        Watchtower.storage.saveInstances();
        Watchtower.dashboard.renderDashboardDOM();
    }

    function populateAzureRegionFilters() {
        state.trackedExternalConfig.filter(s => s.type === 'azure').forEach(svc => {
            const container = document.getElementById(`filters-azure-${svc.id}`);
            if (!container) return;

            const shownList = svc.shownRegions || [];
            let html = '';
            AZURE_REGIONS.forEach(reg => {
                const isChecked = shownList.length === 0 || shownList.includes(reg.id);
                html += `
                    <label class="filter-item">
                        <input type="checkbox" value="${escapeHtml(reg.id)}" ${isChecked ? 'checked' : ''} onchange="Watchtower.sidebar.toggleAzureRegionFilter('${escapeForJsString(svc.id)}', '${escapeForJsString(reg.id)}', this.checked)">
                        ${reg.name} (${reg.id})
                    </label>
                `;
            });
            container.innerHTML = html;
        });
    }

    function toggleAzureRegionFilter(svcId, regionId, isChecked) {
        const svc = state.trackedExternalConfig.find(s => s.id === svcId);
        if (!svc) return;
        if (!svc.shownRegions) svc.shownRegions = [];
        const allIds = AZURE_REGIONS.map(r => r.id);

        if (isChecked) {
            if (!svc.shownRegions.includes(regionId)) svc.shownRegions.push(regionId);
            if (svc.shownRegions.length === allIds.length) svc.shownRegions = [];
        } else {
            if (svc.shownRegions.length === 0) svc.shownRegions = [...allIds];
            svc.shownRegions = svc.shownRegions.filter(r => r !== regionId);
        }
        Watchtower.storage.saveExternalInstances();
        Watchtower.dashboard.renderDashboardDOM();
    }

    function enableEditMode(container, currentName, onSaveCallback) {
        const originalHtml = container.innerHTML;
        container.innerHTML = `<form class="edit-form" style="display:flex; gap:0.2rem;"><input type="text" class="edit-input" value="${escapeHtml(currentName)}" autofocus><button type="submit" class="btn-edit" title="Save"><i class="ph ph-check"></i></button></form>`;

        const form = container.querySelector('.edit-form');
        const input = container.querySelector('.edit-input');
        input.setSelectionRange(input.value.length, input.value.length);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = input.value.trim();
            if (newName) {
                onSaveCallback(newName);
            } else {
                container.innerHTML = originalHtml;
                renderSidebarList();
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== form.querySelector('button')) {
                    renderSidebarList();
                }
            }, 150);
        });
    }

    function renderSidebarList() {
        els.instanceList.innerHTML = '';

        if (state.trackedConfig.length === 0) {
            els.instanceList.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No Salesforce orgs tracked.</div>`;
            return;
        }

        state.trackedConfig.forEach(group => {
            const section = document.createElement('div');
            section.className = 'org-section';

            const header = document.createElement('div');
            header.className = 'org-section-header';

            const titleContainer = document.createElement('div');
            titleContainer.className = 'instance-name';
            titleContainer.style.fontWeight = '600';
            titleContainer.style.flexGrow = '1';
            const displayNameHtml = group.prodName !== group.prod ? `${escapeHtml(group.prodName)} <span style="font-size:0.7em; color:var(--text-muted); font-weight:normal;">(${escapeHtml(group.prod)})</span>` : escapeHtml(group.prod);
            titleContainer.innerHTML = `<i class="ph ph-hard-drives"></i> <span class="name-text">${displayNameHtml}</span>`;

            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '0.2rem';
            actionsDiv.innerHTML = `
                <button class="btn-edit" title="Rename" data-action="edit-prod"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn-remove" title="Remove Org" data-action="remove-prod"><i class="ph ph-trash"></i></button>
            `;

            header.appendChild(titleContainer);
            header.appendChild(actionsDiv);

            header.querySelector('[data-action="remove-prod"]').addEventListener('click', () => Watchtower.events.removeProdOrg(group.id));
            header.querySelector('[data-action="edit-prod"]').addEventListener('click', () => {
                enableEditMode(titleContainer, group.prodName, (newName) => {
                    group.prodName = newName;
                    Watchtower.storage.saveInstances();
                    renderSidebarList();
                    Watchtower.app.fetchAllStatuses();
                });
            });

            section.appendChild(header);

            if (group.sandboxes.length > 0) {
                const list = document.createElement('ul');
                list.className = 'sandbox-list';
                group.sandboxes.forEach(sandbox => {
                    const item = document.createElement('li');
                    item.className = 'sandbox-item';
                    const sbTitleContainer = document.createElement('div');
                    sbTitleContainer.className = 'instance-name';
                    sbTitleContainer.style.flexGrow = '1';
                    const sbDisplayNameHtml = sandbox.name !== sandbox.id ? `${escapeHtml(sandbox.name)} <span style="font-size:0.75em; color:var(--text-muted);">(${escapeHtml(sandbox.id)})</span>` : escapeHtml(sandbox.id);
                    sbTitleContainer.innerHTML = `<i class="ph ph-arrow-elbow-down-right" style="color: var(--text-muted)"></i> <span class="name-text">${sbDisplayNameHtml}</span>`;
                    const sbActionsDiv = document.createElement('div');
                    sbActionsDiv.style.display = 'flex';
                    sbActionsDiv.style.gap = '0.2rem';
                    sbActionsDiv.innerHTML = `
                        <button class="btn-edit" title="Rename Sandbox" data-action="edit-sb"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-remove" title="Remove Sandbox" data-action="remove-sb"><i class="ph ph-x"></i></button>
                    `;
                    item.appendChild(sbTitleContainer);
                    item.appendChild(sbActionsDiv);
                    item.querySelector('[data-action="remove-sb"]').addEventListener('click', () => Watchtower.events.removeSandbox(group.id, sandbox));
                    item.querySelector('[data-action="edit-sb"]').addEventListener('click', () => {
                        enableEditMode(sbTitleContainer, sandbox.name, (newName) => {
                            sandbox.name = newName;
                            Watchtower.storage.saveInstances();
                            renderSidebarList();
                            Watchtower.app.fetchAllStatuses();
                        });
                    });
                    list.appendChild(item);
                });
                section.appendChild(list);
            }

            const addSbForm = document.createElement('form');
            addSbForm.className = 'add-sandbox-form';
            addSbForm.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.4rem; flex-grow: 1;">
                    <input type="text" class="add-sandbox-input" placeholder="Instance (e.g. CS71)" required autocomplete="off">
                    <div style="display: flex; gap: 0.4rem;">
                        <input type="text" class="add-sandbox-alias" placeholder="Alias (Optional)" autocomplete="off" style="flex-grow: 1;">
                        <button type="submit" class="btn-sandbox-add" title="Add Sandbox"><i class="ph ph-plus"></i></button>
                    </div>
                </div>
            `;
            addSbForm.addEventListener('submit', (e) => {
                e.preventDefault();
                Watchtower.events.handleAddSandbox(group.id, addSbForm.querySelector('.add-sandbox-input'), addSbForm.querySelector('.add-sandbox-alias'));
            });
            section.appendChild(addSbForm);

            const filtersDetails = document.createElement('details');
            filtersDetails.className = 'org-filters-details';
            filtersDetails.innerHTML = `
                <summary><i class="ph ph-faders"></i> Filter Sub-Services</summary>
                <div id="filters-${group.id}" class="filter-list">
                    <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.3rem 0;">Waiting for data...</div>
                </div>
            `;
            section.appendChild(filtersDetails);

            els.instanceList.appendChild(section);
        });
    }

    function renderExternalList() {
        els.externalList.innerHTML = '';

        if (state.trackedExternalConfig.length === 0) {
            els.externalList.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0 1rem 0;">No external services tracked.</div>`;
            return;
        }

        const list = document.createElement('ul');
        list.className = 'instance-list';
        list.style.marginBottom = '1rem';

        state.trackedExternalConfig.forEach(svc => {
            const item = document.createElement('li');
            item.className = 'instance-item';
            const titleContainer = document.createElement('div');
            titleContainer.className = 'instance-name';
            let iconHtml = '<i class="ph ph-globe"></i>';
            if (svc.type === 'atlassian') iconHtml = '<i class="ph ph-kanban"></i>';
            else if (svc.type === 'azure') iconHtml = '<i class="ph ph-microsoft-logo"></i>';
            titleContainer.innerHTML = `${iconHtml} <span class="name-text">${escapeHtml(svc.name)}</span>`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.title = 'Remove External Service';
            removeBtn.innerHTML = '<i class="ph ph-trash"></i>';
            removeBtn.addEventListener('click', () => Watchtower.events.removeExternalService(svc.id));
            item.appendChild(titleContainer);
            item.appendChild(removeBtn);

            if (svc.type === 'azure') {
                const filtersDetails = document.createElement('details');
                filtersDetails.className = 'org-filters-details';
                filtersDetails.style.marginTop = '0.3rem';
                filtersDetails.innerHTML = `
                    <summary><i class="ph ph-map-trifold"></i> Filter Regions</summary>
                    <div id="filters-azure-${svc.id}" class="filter-list">
                        <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.3rem 0;">Select regions to display</div>
                    </div>
                `;
                item.appendChild(filtersDetails);
            }
            list.appendChild(item);
        });

        els.externalList.appendChild(list);
        populateAzureRegionFilters();
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.sidebar = {
        populateExternalSelect,
        populateOrgFilters,
        populateAzureRegionFilters,
        toggleOrgServiceFilter,
        toggleAzureRegionFilter,
        renderSidebarList,
        renderExternalList
    };
})(typeof window !== 'undefined' ? window : this);
