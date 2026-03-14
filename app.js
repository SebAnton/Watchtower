// App State & Configuration
// ==========================================================================
const STORAGE_KEY = 'sf_status_instances';

// Default configuration if nothing is saved
const DEFAULT_CONFIG = [
    { prod: 'NA211', prodName: 'NA211', sandboxes: [{ id: 'CS71', name: 'CS71' }], shownServices: [] }
];

// Array of objects: [{ prod: string, prodName: string, sandboxes: [{ id: string, name: string }], shownServices: string[] }]
let trackedConfig = [];

// Storage for External Services (Jira, Bitbucket, Azure DevOps)
const EXTERNAL_STORAGE_KEY = 'sf_status_external_instances';
// Form: [{ id: 'jira', name: 'Jira Software', type: 'atlassian', url: 'https://jira-software.status.atlassian.com/api/v2/summary.json' }]
let trackedExternalConfig = [];

const SUPPORTED_EXTERNAL_SERVICES = [
    { id: 'jira', name: 'Jira Software', type: 'atlassian', api: 'https://jira-software.status.atlassian.com/api/v2/summary.json' },
    { id: 'bitbucket', name: 'Atlassian Bitbucket', type: 'atlassian', api: 'https://bitbucket.status.atlassian.com/api/v2/summary.json' },
    { id: 'azure', name: 'Azure DevOps', type: 'azure', api: 'https://status.dev.azure.com/_apis/status/health?api-version=6.0-preview.1' }
];

// ==========================================================================
// DOM Elements
// ==========================================================================
const els = {
    sidebar: document.querySelector('.sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    instanceList: document.getElementById('instance-list'),
    addForm: document.getElementById('add-instance-form'),
    newInput: document.getElementById('new-instance-input'),
    newAlias: document.getElementById('new-instance-alias'),
    inputError: document.getElementById('input-error'),
    externalList: document.getElementById('external-list'),
    externalSelect: document.getElementById('new-external-select'),
    addExternalBtn: document.getElementById('btn-add-external'),
    statusGrid: document.getElementById('status-grid'),
    refreshBtn: document.getElementById('refresh-btn'),
    lastUpdated: document.getElementById('last-updated'),
    
    // Modal
    confirmModal: document.getElementById('confirm-modal'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmCancelBtn: document.getElementById('confirm-cancel'),
    confirmOkBtn: document.getElementById('confirm-ok'),
    
    // Config Tools
    btnExport: document.getElementById('btn-export'),
    btnImport: document.getElementById('btn-import'),
    fileImport: document.getElementById('import-file')
};

// ==========================================================================
// Initialization
// ==========================================================================
function init() {
    loadInstances();
    loadExternalInstances();
    populateExternalSelect();
    setupEventListeners();
    fetchAllStatuses();
    
    // Auto refresh every 2 minutes
    setInterval(fetchAllStatuses, 2 * 60 * 1000);
}

function loadInstances() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            
            // Migration logic for old arrays to new object schema
            if (Array.isArray(parsed) && parsed.length > 0) {
                
                // Oldest format: ['NA211', 'CS71']
                if (typeof parsed[0] === 'string') {
                    const prods = parsed.filter(i => !i.startsWith('CS') && !i.startsWith('TEST'));
                    const sandboxes = parsed.filter(i => i.startsWith('CS') || i.startsWith('TEST')).map(sb => ({ id: sb, name: sb }));
                    
                    if (prods.length === 0) {
                        trackedConfig = [{ prod: 'LEGACY_PROD', prodName: 'LEGACY_PROD', sandboxes }];
                    } else {
                        trackedConfig = prods.map((p, idx) => ({
                            prod: p,
                            prodName: p,
                            sandboxes: idx === 0 ? sandboxes : []
                        }));
                    }
                    saveInstances();
                } 
                // Immediate previous format: [{ prod: 'NA211', sandboxes: ['CS71'] }]
                else if (typeof parsed[0] === 'object' && parsed[0].prod && (!parsed[0].prodName || (parsed[0].sandboxes.length > 0 && typeof parsed[0].sandboxes[0] === 'string'))) {
                     trackedConfig = parsed.map(g => ({
                         prod: g.prod,
                         prodName: g.prodName || g.prod,
                         sandboxes: (g.sandboxes || []).map(sb => {
                             return typeof sb === 'string' ? { id: sb, name: sb } : sb;
                         })
                     }));
                     saveInstances();
                } else {
                    trackedConfig = parsed;
                }
            } else {
                trackedConfig = parsed;
            }
            
            // Migration: hoist shownServices from old globalSettings into each org
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
                        trackedConfig.forEach(g => {
                            if (!g.shownServices) {
                                g.shownServices = shownByOrg[g.prod] || [];
                            }
                        });
                        migrated = true;
                    }
                    localStorage.removeItem('sf_status_settings');
                }
            } catch(me) { /* Settings migration skipped */ }
            
            // Ensure every org has a shownServices array
            trackedConfig.forEach(g => {
                if (!g.shownServices) g.shownServices = [];
            });
            
            if (migrated) saveInstances();
        } catch (e) {
            console.error('Failed to parse saved instances:', e);
            trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    } else {
        trackedConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveInstances();
    }
    renderSidebarList();
}

function saveInstances() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedConfig));
}

function loadExternalInstances() {
    const saved = localStorage.getItem(EXTERNAL_STORAGE_KEY);
    if (saved) {
        try {
            trackedExternalConfig = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse external instances:', e);
            trackedExternalConfig = [];
        }
    } else {
        trackedExternalConfig = [];
    }
    renderExternalList();
}

function saveExternalInstances() {
    localStorage.setItem(EXTERNAL_STORAGE_KEY, JSON.stringify(trackedExternalConfig));
}

function populateExternalSelect() {
    els.externalSelect.innerHTML = '<option value="" disabled selected>Select a Service</option>';
    SUPPORTED_EXTERNAL_SERVICES.forEach(svc => {
        const option = document.createElement('option');
        option.value = svc.id;
        option.textContent = svc.name;
        els.externalSelect.appendChild(option);
    });
}

// ==========================================================================
// Event Listeners
// ==========================================================================
function setupEventListeners() {
    els.sidebarToggle.addEventListener('click', () => {
        els.sidebar.classList.toggle('collapsed');
    });

    els.addForm.addEventListener('submit', handleAddProdInstance);
    els.addExternalBtn.addEventListener('click', handleAddExternalService);
    els.refreshBtn.addEventListener('click', handleManualRefresh);
    
    // Config Tools
    els.btnExport.addEventListener('click', exportConfig);
    els.btnImport.addEventListener('click', () => els.fileImport.click());
    els.fileImport.addEventListener('change', importConfig);
}

function handleAddProdInstance(e) {
    e.preventDefault();
    const val = els.newInput.value.trim().toUpperCase();
    const aliasVal = els.newAlias.value.trim();
    
    if (!val) return;
    
    if (trackedConfig.some(g => g.prod === val)) {
        showError('Production Org already tracked.');
        return;
    }

    // Basic validation
    if (!/^[A-Z0-9]{2,15}$/.test(val)) {
        showError('Invalid instance format. Use e.g., NA211');
        return;
    }

    hideError();
    const finalAlias = aliasVal ? aliasVal : val;
    trackedConfig.push({ prod: val, prodName: finalAlias, sandboxes: [], shownServices: [] });
    saveInstances();
    els.newInput.value = '';
    els.newAlias.value = '';
    
    renderSidebarList();
    fetchAllStatuses();
}

function handleAddSandbox(prodName, inputElement) {
    const val = inputElement.value.trim().toUpperCase();
    if (!val) return;

    const group = trackedConfig.find(g => g.prod === prodName);
    if (!group) return;

    // Allow multiple sandboxes on the same instance, but not the exact same name initially
    if (group.sandboxes.some(s => s.id === val && s.name === val)) {
        alert('Sandbox instance already tracked with default name under this Organization.');
        return;
    }

    if (!/^[A-Z0-9]{2,15}$/.test(val)) {
        alert('Invalid instance format. Use e.g., CS71');
        return;
    }

    group.sandboxes.push({ id: val, name: val });
    saveInstances();
    inputElement.value = '';
    
    renderSidebarList();
    fetchAllStatuses();
}

function removeProdOrg(prodName) {
    showConfirmModal(`Remove Production Org <strong>${prodName}</strong> and all its tracked sandboxes?`, () => {
        trackedConfig = trackedConfig.filter(g => g.prod !== prodName);
        saveInstances();
        renderSidebarList();
        fetchAllStatuses();
    });
}

function handleAddExternalService(e) {
    e.preventDefault();
    const svcId = els.externalSelect.value;
    if (!svcId) return;

    if (trackedExternalConfig.some(s => s.id === svcId)) {
        alert('External Service already tracked.');
        return;
    }

    const svcDef = SUPPORTED_EXTERNAL_SERVICES.find(s => s.id === svcId);
    if (svcDef) {
        trackedExternalConfig.push(svcDef);
        saveExternalInstances();
        renderExternalList();
        els.externalSelect.value = '';
        fetchAllStatuses();
    }
}

function removeExternalService(svcId) {
    const svc = trackedExternalConfig.find(s => s.id === svcId);
    if (!svc) return;

    showConfirmModal(`Remove <strong>${svc.name}</strong> from tracking?`, () => {
        trackedExternalConfig = trackedExternalConfig.filter(s => s.id !== svcId);
        saveExternalInstances();
        renderExternalList();
        fetchAllStatuses();
    });
}

function removeSandbox(prodName, sandboxObj) {
    const group = trackedConfig.find(g => g.prod === prodName);
    if (!group) return;
    
    showConfirmModal(`Remove Sandbox <strong>${sandboxObj.name}</strong> from ${prodName}?`, () => {
        // Match exactly the object reference to allow duplicates
        group.sandboxes = group.sandboxes.filter(s => s !== sandboxObj);
        saveInstances();
        renderSidebarList();
        fetchAllStatuses();
    });
}

function showConfirmModal(messageHtml, onConfirmCallback) {
    els.confirmMessage.innerHTML = messageHtml;
    els.confirmModal.classList.remove('hidden');
    
    const cleanup = () => {
        els.confirmModal.classList.add('hidden');
        els.confirmOkBtn.removeEventListener('click', onOk);
        els.confirmCancelBtn.removeEventListener('click', onCancel);
    };
    
    const onOk = () => {
        cleanup();
        onConfirmCallback();
    };
    
    const onCancel = () => {
        cleanup();
    };

    els.confirmOkBtn.addEventListener('click', onOk);
    els.confirmCancelBtn.addEventListener('click', onCancel);
}

function enableEditMode(container, currentName, onSaveCallback) {
    const originalHtml = container.innerHTML;
    container.innerHTML = `<form class="edit-form" style="display:flex; gap:0.2rem;"><input type="text" class="edit-input" value="${currentName}" autofocus><button type="submit" class="btn-edit" title="Save"><i class="ph ph-check"></i></button></form>`;
    
    const form = container.querySelector('.edit-form');
    const input = container.querySelector('.edit-input');
    
    // Move cursor to end
    input.setSelectionRange(input.value.length, input.value.length);
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = input.value.trim();
        if (newName) {
            onSaveCallback(newName);
        } else {
            container.innerHTML = originalHtml; // Revert if empty
            // Re-bind listeners by completely re-rendering the list
            renderSidebarList();
        }
    });

    input.addEventListener('blur', () => {
        // slight delay to allow submit button click to fire first
        setTimeout(() => {
            if (document.activeElement !== form.querySelector('button')) {
                 renderSidebarList();
            }
        }, 150);
    });
}

function handleManualRefresh() {
    const icon = els.refreshBtn.querySelector('i');
    icon.classList.add('spinning');
    
    fetchAllStatuses().finally(() => {
        setTimeout(() => icon.classList.remove('spinning'), 500); 
    });
}

function showError(msg) {
    els.inputError.textContent = msg;
    els.inputError.classList.remove('hidden');
}

function hideError() {
    els.inputError.classList.add('hidden');
}

// ==========================================================================
// Sub-Service Filters Logic
// ==========================================================================
function populateOrgFilters() {
    trackedConfig.forEach(group => {
        const serviceSet = new Set();
        
        // Collect services for prod
        const prodRes = fetchCache[group.prod];
        if (prodRes && prodRes.success && prodRes.data && prodRes.data.Services) {
            prodRes.data.Services.forEach(s => serviceSet.add(s.key));
        }
        
        // Collect services for sandboxes
        group.sandboxes.forEach(sb => {
            const sbRes = fetchCache[sb.id];
            if (sbRes && sbRes.success && sbRes.data && sbRes.data.Services) {
                sbRes.data.Services.forEach(s => serviceSet.add(s.key));
            }
        });

        const container = document.getElementById(`filters-${group.prod}`);
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
                    <input type="checkbox" value="${srv}" ${isChecked ? 'checked' : ''} onchange="toggleOrgServiceFilter('${group.prod}', '${srv}', this.checked)">
                    ${srv}
                </label>
            `;
        });
        
        container.innerHTML = html;
    });
}

window.toggleOrgServiceFilter = function(prodId, serviceKey, isChecked) {
    const group = trackedConfig.find(g => g.prod === prodId);
    if (!group) return;
    if (!group.shownServices) group.shownServices = [];
    
    if (isChecked) {
        if (!group.shownServices.includes(serviceKey)) {
            group.shownServices.push(serviceKey);
        }
    } else {
        group.shownServices = group.shownServices.filter(s => s !== serviceKey);
    }
    
    saveInstances();
    renderDashboardDOM(); // Rerender grid immediately
};

// ==========================================================================
// Rendering Sidebar
// ==========================================================================
function renderSidebarList() {
    els.instanceList.innerHTML = '';
    
    if (trackedConfig.length === 0) {
        els.instanceList.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No Production Orgs tracked.</div>`;
        return;
    }

    trackedConfig.forEach(group => {
        const section = document.createElement('div');
        section.className = 'org-section';
        
        // Prod Header
        const header = document.createElement('div');
        header.className = 'org-section-header';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'instance-name';
        titleContainer.style.fontWeight = '600';
        titleContainer.style.flexGrow = '1';
        
        const displayNameHtml = group.prodName !== group.prod ? `${group.prodName} <span style="font-size:0.7em; color:var(--text-muted); font-weight:normal;">(${group.prod})</span>` : group.prod;
        
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

        // Events
        header.querySelector('[data-action="remove-prod"]').addEventListener('click', () => removeProdOrg(group.prod));
        header.querySelector('[data-action="edit-prod"]').addEventListener('click', () => {
            enableEditMode(titleContainer, group.prodName, (newName) => {
                group.prodName = newName;
                saveInstances();
                renderSidebarList();
                fetchAllStatuses(); // Re-render grid to show new name immediately
            });
        });

        section.appendChild(header);

        // Sandboxes List
        if (group.sandboxes.length > 0) {
            const list = document.createElement('ul');
            list.className = 'sandbox-list';
            
            group.sandboxes.forEach(sandbox => {
                const item = document.createElement('li');
                item.className = 'sandbox-item';
                
                const sbTitleContainer = document.createElement('div');
                sbTitleContainer.className = 'instance-name';
                sbTitleContainer.style.flexGrow = '1';
                
                const sbDisplayNameHtml = sandbox.name !== sandbox.id ? `${sandbox.name} <span style="font-size:0.75em; color:var(--text-muted);">(${sandbox.id})</span>` : sandbox.id;
                
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

                // Events
                item.querySelector('[data-action="remove-sb"]').addEventListener('click', () => removeSandbox(group.prod, sandbox));
                item.querySelector('[data-action="edit-sb"]').addEventListener('click', () => {
                     enableEditMode(sbTitleContainer, sandbox.name, (newName) => {
                        sandbox.name = newName;
                        saveInstances();
                        renderSidebarList();
                        fetchAllStatuses();
                    });
                });

                list.appendChild(item);
            });
            section.appendChild(list);
        }

        // Add Sandbox Form
        const addSbForm = document.createElement('form');
        addSbForm.className = 'add-sandbox-form';
        addSbForm.innerHTML = `
            <input type="text" class="add-sandbox-input" placeholder="Add Sandbox (CS71)" required>
            <button type="submit" class="btn-sandbox-add" title="Add Sandbox"><i class="ph ph-plus"></i></button>
        `;
        addSbForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = addSbForm.querySelector('.add-sandbox-input');
            handleAddSandbox(group.prod, input);
        });
        section.appendChild(addSbForm);

        // Sub-Service Filters Accordion
        const filtersDetails = document.createElement('details');
        filtersDetails.className = 'org-filters-details';
        filtersDetails.innerHTML = `
            <summary><i class="ph ph-faders"></i> Filter Sub-Services</summary>
            <div id="filters-${group.prod}" class="filter-list">
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.3rem 0;">Waiting for data...</div>
            </div>
        `;
        section.appendChild(filtersDetails);

        els.instanceList.appendChild(section);
    });
}

function renderExternalList() {
    els.externalList.innerHTML = '';
    
    if (trackedExternalConfig.length === 0) {
        els.externalList.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0 1rem 0;">No external services tracked.</div>`;
        return;
    }

    const list = document.createElement('ul');
    list.className = 'instance-list';
    list.style.marginBottom = '1rem';

    trackedExternalConfig.forEach(svc => {
        const item = document.createElement('li');
        item.className = 'instance-item';
        
        const titleContainer = document.createElement('div');
        titleContainer.className = 'instance-name';
        
        let iconHtml = '<i class="ph ph-globe"></i>';
        if (svc.type === 'atlassian') iconHtml = '<i class="ph ph-kanban"></i>';
        else if (svc.type === 'azure') iconHtml = '<i class="ph ph-microsoft-logo"></i>';

        titleContainer.innerHTML = `${iconHtml} <span class="name-text">${svc.name}</span>`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.title = 'Remove External Service';
        removeBtn.innerHTML = '<i class="ph ph-trash"></i>';
        removeBtn.addEventListener('click', () => removeExternalService(svc.id));

        item.appendChild(titleContainer);
        item.appendChild(removeBtn);
        list.appendChild(item);
    });

    els.externalList.appendChild(list);
}

// ==========================================================================
// API & Main Grid Rendering (with Deduplication)
// ==========================================================================
let fetchCache = {};

async function fetchAllStatuses() {
    if (trackedConfig.length === 0 && trackedExternalConfig.length === 0) {
        // Assume renderEmptyState exists or manually clear grid if needed
        els.statusGrid.innerHTML = '';
        els.statusGrid.classList.remove('dashboard-grid');
        els.statusGrid.innerHTML = `<div style="text-align:center; padding: 4rem; color: var(--text-muted);">
            <i class="ph ph-binoculars" style="font-size: 4rem; color: rgba(255,255,255,0.1); margin-bottom: 1rem;"></i>
            <h3>No Services Tracked</h3>
            <p style="margin-top: 0.5rem; max-width: 400px; margin-left: auto; margin-right: auto;">Add a Salesforce Production org, or an external service from the sidebar configuration to begin tracking status.</p>
        </div>`;
        updateTimestamp();
        return;
    }

    // Render skeleton groups
    els.statusGrid.innerHTML = '';
    els.statusGrid.classList.remove('dashboard-grid'); 
    
    // Collect unique instance IDs to fetch across everything
    const uniqueInstances = new Set();
    
    trackedConfig.forEach(group => {
        uniqueInstances.add(group.prod);
        group.sandboxes.forEach(sb => uniqueInstances.add(sb.id));
        
        const skeletonHtml = `
            <div class="org-group">
                <div class="org-group-header">
                    <h2>${group.prodName}</h2>
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

    // Skeleton for External Services Group
    if (trackedExternalConfig.length > 0) {
        const extSkeletonHtml = `
            <div class="org-group">
                <div class="org-group-header">
                    <h2>External Services</h2>
                    <span class="org-group-badge">Loading...</span>
                </div>
                <div class="dashboard-grid">
                    ${trackedExternalConfig.map(() => '<div class="status-card glass-panel skeleton"><div class="card-header"><div class="skeleton-text short"></div><div class="skeleton-circle"></div></div><div class="skeleton-text long"></div></div>').join('')}
                </div>
            </div>
        `;
        els.statusGrid.innerHTML += extSkeletonHtml;
    }

    // Fetch deduplicated SF instances
    const fetchPromises = Array.from(uniqueInstances).map(instance => fetchInstanceData(instance));
    
    // Fetch External Services
    const fetchExternalPromises = trackedExternalConfig.map(svc => fetchExternalInstanceData(svc));

    try {
        const results = await Promise.all([...fetchPromises, ...fetchExternalPromises]);
        
        // Store in local cache map for easy lookup
        fetchCache = {};
        results.forEach(res => {
            fetchCache[res.instance] = res;
        });

        // Build the checkbox UI
        populateOrgFilters();

        // Render dashboard immediately
        renderDashboardDOM();
    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

function renderDashboardDOM() {
    // Clear skeletons and render actual grouped data using the cache
    els.statusGrid.innerHTML = '';
        
    trackedConfig.forEach(group => {
            const prodResult = fetchCache[group.prod];
            
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'org-group';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'org-group-header';
            
            let badgeText = 'Organization';
            if (prodResult && prodResult.success && prodResult.data) {
                const prodStatus = getStatusInfo(prodResult.data.status).label;
                const filteredIncidents = filterAndDeduplicateIncidents(prodResult.data.Incidents);
                if (filteredIncidents.size > 0) {
                    const firstInc = Array.from(filteredIncidents.values())[0];
                    badgeText = firstInc.status === 'Resolved' ? 'Resolved Incident' : 'Active Incidents';
                } else {
                    badgeText = prodStatus;
                }
            }

            // Display Title
            groupHeader.innerHTML = `
                <h2>${group.prodName}</h2>
                <span class="org-group-badge">${badgeText}</span>
            `;
            groupWrapper.appendChild(groupHeader);
            
            const innerGrid = document.createElement('div');
            innerGrid.className = 'dashboard-grid';
            
            // Build the Prod Card
            if (prodResult) {
                innerGrid.appendChild(buildStatusCard(prodResult, true, group.prodName, group.prod));
            } else {
                // Fallback if missing
                innerGrid.appendChild(buildStatusCard({success: false, instance: group.prod}, true, group.prodName, group.prod));
            }
            
            // Build the Sandbox Cards
            group.sandboxes.forEach(sb => {
                const sbResult = fetchCache[sb.id];
                if (sbResult) {
                    innerGrid.appendChild(buildStatusCard(sbResult, false, sb.name, group.prod));
                } else {
                    innerGrid.appendChild(buildStatusCard({success: false, instance: sb.id}, false, sb.name, group.prod));
                }
            });
            
        groupWrapper.appendChild(innerGrid);
        els.statusGrid.appendChild(groupWrapper);
    });

    // Render External Services
    if (trackedExternalConfig.length > 0) {
        const extWrapper = document.createElement('div');
        extWrapper.className = 'org-group';
        
        const extHeader = document.createElement('div');
        extHeader.className = 'org-group-header';
        
        // Compute overall badge state for external services
        let hasIncident = false;
        let hasWarning = false;
        
        trackedExternalConfig.forEach(svc => {
            const res = fetchCache[svc.id];
            if (res && res.success && res.data) {
                if (res.data.status === 'INCIDENT') hasIncident = true;
                if (res.data.status === 'DEGRADATION') hasWarning = true;
            }
        });

        let extBadgeText = 'Operational';
        if (hasIncident) extBadgeText = 'Active Incidents';
        else if (hasWarning) extBadgeText = 'Degraded Performance';

        extHeader.innerHTML = `
            <h2>External Services</h2>
            <span class="org-group-badge">${extBadgeText}</span>
        `;
        extWrapper.appendChild(extHeader);
        
        const extInnerGrid = document.createElement('div');
        extInnerGrid.className = 'dashboard-grid';
        
        trackedExternalConfig.forEach(svc => {
            const sbResult = fetchCache[svc.id];
            if (sbResult) {
                // We use buildStatusCard but treat it as a top-level external service
                extInnerGrid.appendChild(buildStatusCard(sbResult, false, svc.name, svc.id, true));
            } else {
                extInnerGrid.appendChild(buildStatusCard({success: false, instance: svc.id}, false, svc.name, svc.id, true));
            }
        });
        
        extWrapper.appendChild(extInnerGrid);
        els.statusGrid.appendChild(extWrapper);
    }
    
    updateTimestamp();
}

function updateTimestamp() {
    const now = new Date();
    els.lastUpdated.textContent = 'Last checked: ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ==========================================================================
// Configuration Import / Export
// ==========================================================================
function exportConfig() {
    const backup = {
        trackedConfig: trackedConfig
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
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed && typeof parsed === 'object') {
                if (parsed.trackedConfig && Array.isArray(parsed.trackedConfig)) {
                     // Ensure every org has shownServices
                     parsed.trackedConfig.forEach(g => {
                         if (!g.shownServices) g.shownServices = [];
                     });
                     trackedConfig = parsed.trackedConfig;
                     saveInstances();
                } else {
                     throw new Error('Missing or invalid trackedConfig array');
                }
                
                // Clear state UI and fetch new configurations
                els.inputError.classList.add('hidden');
                renderSidebarList();
                fetchAllStatuses(); // Refetches and triggers renderDashboardDOM
                
                // Show generic success
                alert('Configuration imported successfully!');
            }
        } catch (err) {
            console.error('Import failed:', err);
            alert('Failed to parse the configuration file. Please ensure it is a valid export.');
        } finally {
            // Reset input so importing the same file again triggers 'change' event
            els.fileImport.value = '';
        }
    };
    reader.readAsText(file);
}

async function fetchInstanceData(instance) {
    try {
        const response = await fetch(`https://api.status.salesforce.com/v1/instances/${instance}/status`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, instance, data };
    } catch (e) {
        return { success: false, instance, error: e.message };
    }
}

async function fetchExternalInstanceData(svc) {
    try {
        const response = await fetch(svc.api);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData = await response.json();
        
        let normalizedData;
        if (svc.type === 'atlassian') normalizedData = normalizeAtlassianData(rawData);
        else if (svc.type === 'azure') normalizedData = normalizeAzureData(rawData);
        
        return { success: true, instance: svc.id, data: normalizedData };
    } catch(e) {
        console.error(`External fetch failed for ${svc.id}:`, e);
        return { success: false, instance: svc.id, error: e.message };
    }
}

function normalizeAtlassianData(rawData) {
    // Determine high level status
    // Atlassian indicator maps: none -> OK, minor -> DEGRADATION, major/critical -> INCIDENT
    let mappedStatus = 'UNKNOWN';
    const indicator = rawData.status && rawData.status.indicator ? rawData.status.indicator.toLowerCase() : 'none';
    
    if (indicator === 'none') mappedStatus = 'OK';
    else if (indicator === 'minor') mappedStatus = 'DEGRADATION';
    else if (indicator === 'major' || indicator === 'critical') mappedStatus = 'INCIDENT';

    // Normalize incidents array
    let mappedIncidents = [];
    if (rawData.incidents && rawData.incidents.length > 0) {
        mappedIncidents = rawData.incidents.map(inc => {
            // Atlassian statuses: investigating, identified, monitoring, resolved, postmortem
            const isResolved = (inc.status === 'resolved' || inc.status === 'postmortem');
            
            let mappedTimeline = [];
            if (inc.incident_updates) {
                mappedTimeline = inc.incident_updates.map(upd => ({
                    title: upd.status ? (upd.status.charAt(0).toUpperCase() + upd.status.slice(1)) : 'Update',
                    createdAt: upd.created_at,
                    content: upd.body
                }));
            }
            
            return {
                id: inc.id,
                status: isResolved ? 'Resolved' : 'Active',
                externalId: inc.id,
                message: inc.name,
                updatedAt: inc.updated_at,
                timeline: mappedTimeline
            };
        });
    }
    
    return { status: mappedStatus, Incidents: mappedIncidents };
}

function normalizeAzureData(rawData) {
    // Azure rawData format: { status: { health: 'healthy|degraded|unhealthy', message: '' } }
    let mappedStatus = 'UNKNOWN';
    const health = rawData.status && rawData.status.health ? rawData.status.health.toLowerCase() : 'healthy';

    if (health === 'healthy') mappedStatus = 'OK';
    else if (health === 'degraded') mappedStatus = 'DEGRADATION';
    else if (health === 'unhealthy') mappedStatus = 'INCIDENT';
    
    let mappedIncidents = [];
    // Azure doesn't easily provide an incidents array in this endpoint format without crawling further, 
    // so we fabricate one if there's a non-healthy state mapping.
    if (mappedStatus !== 'OK' && rawData.status.message) {
        mappedIncidents.push({
            id: 'azure_inc_1',
            status: 'Active',
            externalId: 'AZURE_1',
            message: rawData.status.message,
            updatedAt: new Date().toISOString(),
            timeline: [{ title: 'Update', createdAt: new Date().toISOString(), content: rawData.status.message }]
        });
    }
    
    return { status: mappedStatus, Incidents: mappedIncidents };
}

function getStatusInfo(statusString) {
    const status = (statusString || '').toUpperCase();
    switch(status) {
        case 'OK': return { raw: status, label: 'Operational', class: 'status-ok' };
        case 'MAJOR_INCIDENT_CORE':
        case 'MAJOR_INCIDENT_NONCORE':
        case 'INCIDENT': return { raw: status, label: 'Incident', class: 'status-critical' };
        case 'DEGRADATION':
        case 'MAINTENANCE_CORE':
        case 'MAINTENANCE_NONCORE': return { raw: status, label: 'Warning', class: 'status-warning' };
        default: return { raw: status || 'UNKNOWN', label: 'Unknown', class: 'status-unknown' };
    }
}

function filterAndDeduplicateIncidents(incidentsData) {
    const uniqueIncidents = new Map();
    if (!incidentsData || incidentsData.length === 0) return uniqueIncidents;
    
    const now = new Date();
    const fortyEightHoursBack = new Date(now.getTime() - (48 * 60 * 60 * 1000));

    incidentsData.forEach(inc => {
        if (inc.status === 'Resolved') {
            let resolvedTs = inc.updatedAt ? new Date(inc.updatedAt) : null;
            if (inc.timeline) {
                const resolvedEvent = inc.timeline.find(t => t.title === 'Resolved');
                if (resolvedEvent && resolvedEvent.createdAt) {
                    resolvedTs = new Date(resolvedEvent.createdAt);
                }
            }
            if (resolvedTs && resolvedTs < fortyEightHoursBack) {
                return;
            }
        }
        if (inc && inc.id && !uniqueIncidents.has(inc.id)) {
             uniqueIncidents.set(inc.id, inc);
        }
    });
    
    return uniqueIncidents;
}

function buildStatusCard(result, isProd, displayName, parentProdId, isExternal = false) {
    const card = document.createElement('div');
    
    let badgeLabel = `<span class="badge badge-sandbox">SANDBOX</span>`;
    if (isProd) badgeLabel = `<span class="badge" style="background: rgba(59,130,246,0.15); color: var(--accent-blue); border: 1px solid rgba(59,130,246,0.3)">PRODUCTION</span>`;
    if (isExternal) badgeLabel = `<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3)">GLOBAL SERVICE</span>`;
    
    // Subtitle now shows the actual ID so the big header can use the alias
    const subtitleText = (result.instance !== displayName && !isExternal) ? `Instance: ${result.instance}` : '';
    let iconClass = isProd ? 'ph-server' : 'ph-hard-drive';
    if (isExternal) iconClass = 'ph-globe';
    
    if (!result.success) {
        card.className = 'status-card glass-panel status-unknown';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="instance-id">
                        <i class="ph ${iconClass}"></i>
                        ${displayName}
                    </div>
                    ${badgeLabel}
                    <span class="region-txt" style="margin-top:0.3rem;">${subtitleText}</span>
                </div>
                <div class="status-indicator"><div class="status-dot"></div>Error</div>
            </div>
            <div class="card-details">
                <p style="color: var(--status-critical); font-size: 0.85rem;">Failed to fetch data.</p>
            </div>
        `;
        return card;
    }

    const { data, instance } = result;
    const statusInfo = getStatusInfo(data.status);
    
    // Incidents
    let incidentHtml = '';
    
    // Optional array for unique incidents
    const uniqueIncidents = filterAndDeduplicateIncidents(data.Incidents);

    if (uniqueIncidents.size > 0) {
        const incidentsToDisplay = Array.from(uniqueIncidents.values());
        const activeIncident = incidentsToDisplay[0];
        
        const isResolved = activeIncident.status === 'Resolved';
        let previewSubject = activeIncident.externalId ? `Incident ID: ${activeIncident.externalId}` : 'Service Issues Detected';
        if (activeIncident.serviceKeys && activeIncident.serviceKeys.length > 0) {
             previewSubject += ` (${activeIncident.serviceKeys.join(', ')})`;
        }
        
        // Build timeline
        let timelineHtml = '';
        if (activeIncident.timeline && activeIncident.timeline.length > 0) {
            const sortedTimeline = [...activeIncident.timeline].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            timelineHtml = sortedTimeline.map(item => {
                const itemDate = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <div style="margin-bottom: 0.8rem; border-left: 2px solid var(--border-glass); padding-left: 0.8rem;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${item.title} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: 0.3rem;">${itemDate}</span></div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${item.content ? item.content.replace(/\\n/g, '<br>') : ''}</div>
                    </div>
                `;
            }).join('');
        } else if (activeIncident.IncidentEvents && activeIncident.IncidentEvents.length > 0) {
            timelineHtml = activeIncident.IncidentEvents.map(ev => {
                const evDate = new Date(ev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <div style="margin-bottom: 0.8rem; border-left: 2px solid var(--border-glass); padding-left: 0.8rem;">
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);"><span style="text-transform: capitalize;">${ev.type}</span> <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: 0.3rem;">${evDate}</span></div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${ev.message ? ev.message.replace(/\\n/g, '<br>') : ''}</div>
                    </div>
                `;
            }).join('');
        } else {
            timelineHtml = `<div>${activeIncident.message ? activeIncident.message.replace(/\\n/g, '<br>') : 'No additional details provided at this time.'}</div>`;
        }

        const iconClass = isResolved ? 'ph-check-circle' : 'ph-warning-circle';
        const colorClass = isResolved ? 'var(--status-ok)' : 'var(--status-warning)';
        const headerText = isResolved ? 'Resolved Incident' : 'Active Incident';

        incidentHtml = `
            <div class="incident-alert" onclick="this.querySelector('.incident-details').classList.toggle('hidden')">
                <strong><i class="ph ${iconClass}" style="color: ${colorClass};"></i> ${headerText} <i class="ph ph-caret-down" style="font-size:0.8rem; color: var(--text-muted)"></i></strong>
                <div class="incident-preview">${previewSubject}</div>
                <div class="incident-details hidden">
                    <div style="margin-bottom: 1rem;">${timelineHtml}</div>
                    <div style="font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-glass);">
                        <a href="https://status.salesforce.com/incidents/${activeIncident.id}" target="_blank" class="trust-link" style="color: var(--accent-blue); font-weight: 500; display: inline-flex; gap: 0.3rem;" title="View exact incident details on Salesforce Trust" onclick="event.stopPropagation();">
                            View full details on Trust <i class="ph ph-arrow-square-out"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // Maintenances
    let maintenanceHtml = '';
    if (data.Maintenances && data.Maintenances.length > 0) {
        const upcoming = data.Maintenances.find(m => new Date(m.startDate) > new Date());
        if (upcoming) {
            const dateStr = new Date(upcoming.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            maintenanceHtml = `
                <div class="maintenance-badge">
                    <i class="ph ph-wrench"></i>
                    <div>
                        <div style="font-weight: 500;">Upcoming Maintenance</div>
                        <div style="font-size: 0.75rem; opacity: 0.8;">${dateStr}</div>
                    </div>
                </div>
            `;
        }
    }

    // Services
    let servicesHtml = '';
    if (data.Services && data.Services.length > 0) {
        const parentGroup = trackedConfig.find(g => g.prod === parentProdId);
        const shownList = parentGroup ? (parentGroup.shownServices || []) : [];

        // Filter for shown services first, then sort core first, then alphabetical
        const visibleServices = data.Services.filter(s => shownList.includes(s.key));
        
        if (visibleServices.length > 0) {
            const sortedServices = visibleServices.sort((a, b) => {
                 if (a.isCore && !b.isCore) return -1;
                 if (!a.isCore && b.isCore) return 1;
                 return a.key.localeCompare(b.key);
            });
            
            const pillNodes = sortedServices.map(s => {
                let dotClass = 'service-dot'; // Green
                if (statusInfo.raw !== 'OK') {
                    if (statusInfo.raw.includes('CORE') && s.isCore) dotClass = 'service-dot warn';
                    if (statusInfo.raw.includes('NONCORE') && !s.isCore) dotClass = 'service-dot warn';
                    if (statusInfo.raw === 'INCIDENT' || statusInfo.raw === 'MAJOR_INCIDENT_CORE') dotClass = 'service-dot down';
                }
                
                return `<div class="service-pill ${s.isCore ? 'core' : ''}"><div class="${dotClass}"></div>${s.key}</div>`;
            });
            
            servicesHtml = `<div class="sub-services">${pillNodes.join('')}</div>`;
        }
    }

    const locText = data.location ? `• ${data.location}` : '';

    card.className = `status-card glass-panel ${statusInfo.class}`;
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="instance-id">
                    <i class="ph ${isProd ? 'ph-server' : 'ph-hard-drive'}"></i>
                    ${displayName}
                    <a href="https://status.salesforce.com/instances/${result.instance}" target="_blank" class="trust-link" title="View on Salesforce Trust">
                        <i class="ph ph-arrow-square-out"></i>
                    </a>
                </div>
                <div style="display:flex; align-items:center; gap: 0.5rem; margin-top: 0.3rem;">
                    ${badgeLabel}
                    <span class="region-txt" style="margin-top:0;">${subtitleText} ${locText}</span>
                </div>
            </div>
            <div class="status-indicator" title="${statusInfo.raw}">
                <div class="status-dot"></div>
                ${statusInfo.label}
            </div>
        </div>
        
        <div class="card-details">
            <div class="detail-row">
                <span class="detail-label"><i class="ph ph-activity"></i> Status</span>
                <span class="detail-value" style="color: var(--${statusInfo.class.replace('status-', 'status-')})">${statusInfo.label}</span>
            </div>
            ${ data.maintenanceWindow ? `
                <div class="detail-row">
                    <span class="detail-label"><i class="ph ph-clock"></i> Weekly Window</span>
                    <span class="detail-value">${data.maintenanceWindow}</span>
                </div>
            ` : ''}
            
            <div class="release-version">Release: ${data.releaseVersion || 'N/A'}</div>
            
            ${maintenanceHtml}
            ${incidentHtml}
            ${servicesHtml}
        </div>
    `;
    return card;
}

function renderEmptyState() {
    els.statusGrid.classList.add('dashboard-grid');
    els.statusGrid.innerHTML = `
        <div class="empty-state">
            <i class="ph ph-magnifying-glass-plus"></i>
            <h3>No Orgs Tracked</h3>
            <p>Add a Salesforce Organization to begin monitoring.</p>
        </div>
    `;
}

function updateTimestamp() {
    const now = new Date();
    els.lastUpdated.textContent = `Last checked: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ==========================================================================
// Boot
// ==========================================================================
document.addEventListener('DOMContentLoaded', init);
