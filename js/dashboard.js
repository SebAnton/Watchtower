/**
 * Dashboard grid and status card rendering.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { escapeHtml } = Watchtower.utils;
    const { AZURE_REGIONS } = Watchtower.constants;
    const state = Watchtower.state;
    const { els } = Watchtower.dom;
    const { getStatusInfo, getIncidentDetailLink, getStatusPageLink, filterAndDeduplicateIncidents } = Watchtower.status;

    function updateTimestamp(showSuccess = false) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        els.lastUpdated.textContent = 'Last checked: ' + timeStr;
        if (showSuccess) {
            els.lastUpdated.textContent = 'Last checked: ' + timeStr + ' ✓';
            els.lastUpdated.classList.add('refresh-success');
            setTimeout(() => {
                els.lastUpdated.textContent = 'Last checked: ' + timeStr;
                els.lastUpdated.classList.remove('refresh-success');
            }, 2000);
        }
    }

    function showRefreshSuccess() {
        updateTimestamp(true);
    }

    function buildStatusCard(result, isProd, displayName, parentProdId, isExternal = false, provider = null) {
        const card = document.createElement('div');

        let badgeLabel = `<span class="badge badge-sandbox">SANDBOX</span>`;
        if (isProd) badgeLabel = `<span class="badge" style="background: rgba(59,130,246,0.15); color: var(--accent-blue); border: 1px solid rgba(59,130,246,0.3)">PRODUCTION</span>`;
        if (isExternal) badgeLabel = `<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3)">GLOBAL SERVICE</span>`;

        const subtitleText = (result.instance !== displayName && !isExternal) ? `Instance: ${escapeHtml(result.instance)}` : '';
        let iconClass = isProd ? 'ph-server' : 'ph-hard-drive';
        if (isExternal) iconClass = 'ph-globe';

        if (!result.success) {
            card.className = 'status-card glass-panel status-unknown';
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="instance-id">
                            <i class="ph ${iconClass}"></i>
                            ${escapeHtml(displayName)}
                            ${isExternal && provider && provider.statusPageUrl ? `<a href="${escapeHtml(provider.statusPageUrl)}" target="_blank" class="trust-link" title="View status page"><i class="ph ph-arrow-square-out"></i></a>` : ''}
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

        const { data } = result;
        const statusInfo = getStatusInfo(data.status);
        let incidentHtml = '';
        const uniqueIncidents = filterAndDeduplicateIncidents(data.Incidents);

        if (uniqueIncidents.size > 0) {
            const incidentsToDisplay = Array.from(uniqueIncidents.values());
            const activeIncident = incidentsToDisplay[0];
            const isResolved = activeIncident.status === 'Resolved';
            let previewSubject = activeIncident.externalId ? `Incident ID: ${escapeHtml(activeIncident.externalId)}` : 'Service Issues Detected';
            if (activeIncident.serviceKeys && activeIncident.serviceKeys.length > 0) {
                previewSubject += ` (${escapeHtml(activeIncident.serviceKeys.join(', '))})`;
            }

            let timelineHtml = '';
            if (activeIncident.timeline && activeIncident.timeline.length > 0) {
                const sortedTimeline = [...activeIncident.timeline].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                timelineHtml = sortedTimeline.map(item => {
                    const itemDate = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const safeContent = item.content ? escapeHtml(item.content).replace(/\n/g, '<br>') : '';
                    return `
                        <div style="margin-bottom: 0.8rem; border-left: 2px solid var(--border-glass); padding-left: 0.8rem;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${escapeHtml(item.title)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: 0.3rem;">${itemDate}</span></div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${safeContent}</div>
                        </div>
                    `;
                }).join('');
            } else if (activeIncident.IncidentEvents && activeIncident.IncidentEvents.length > 0) {
                timelineHtml = activeIncident.IncidentEvents.map(ev => {
                    const evDate = new Date(ev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const safeMessage = ev.message ? escapeHtml(ev.message).replace(/\n/g, '<br>') : '';
                    return `
                        <div style="margin-bottom: 0.8rem; border-left: 2px solid var(--border-glass); padding-left: 0.8rem;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);"><span style="text-transform: capitalize;">${escapeHtml(ev.type)}</span> <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-left: 0.3rem;">${evDate}</span></div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${safeMessage}</div>
                        </div>
                    `;
                }).join('');
            } else {
                const safeMsg = activeIncident.message ? escapeHtml(activeIncident.message).replace(/\n/g, '<br>') : 'No additional details provided at this time.';
                timelineHtml = `<div>${safeMsg}</div>`;
            }

            const iconClassInc = isResolved ? 'ph-check-circle' : 'ph-warning-circle';
            const colorClass = isResolved ? 'var(--status-ok)' : 'var(--status-warning)';
            const headerText = isResolved ? 'Resolved Incident' : 'Active Incident';
            const incidentLink = getIncidentDetailLink(activeIncident.id, provider, result);
            const incidentLinkSection = incidentLink ? `
                <div style="font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px dashed var(--border-glass);">
                    <a href="${escapeHtml(incidentLink.url)}" target="_blank" class="trust-link" style="color: var(--accent-blue); font-weight: 500; display: inline-flex; gap: 0.3rem;" title="${escapeHtml(incidentLink.title)}" onclick="event.stopPropagation();">
                        ${escapeHtml(incidentLink.label)} <i class="ph ph-arrow-square-out"></i>
                    </a>
                </div>
            ` : '';

            incidentHtml = `
                <div class="incident-alert" onclick="this.querySelector('.incident-details').classList.toggle('hidden')">
                    <strong><i class="ph ${iconClassInc}" style="color: ${colorClass};"></i> ${headerText} <i class="ph ph-caret-down" style="font-size:0.8rem; color: var(--text-muted)"></i></strong>
                    <div class="incident-preview">${previewSubject}</div>
                    <div class="incident-details hidden">
                        <div style="margin-bottom: 1rem;">${timelineHtml}</div>
                        ${incidentLinkSection}
                    </div>
                </div>
            `;
        }

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

        let servicesHtml = '';
        if (data.Services && data.Services.length > 0) {
            const parentGroup = state.trackedConfig.find(g => g.prod === parentProdId);
            const shownList = parentGroup ? (parentGroup.shownServices || []) : [];
            const visibleServices = data.Services.filter(s => shownList.includes(s.key));

            if (visibleServices.length > 0) {
                const sortedServices = visibleServices.sort((a, b) => {
                    if (a.isCore && !b.isCore) return -1;
                    if (!a.isCore && b.isCore) return 1;
                    return a.key.localeCompare(b.key);
                });
                const pillNodes = sortedServices.map(s => {
                    let dotClass = 'service-dot';
                    if (statusInfo.raw !== 'OK') {
                        if (statusInfo.raw.includes('CORE') && s.isCore) dotClass = 'service-dot warn';
                        if (statusInfo.raw.includes('NONCORE') && !s.isCore) dotClass = 'service-dot warn';
                        if (statusInfo.raw === 'INCIDENT' || statusInfo.raw === 'MAJOR_INCIDENT_CORE') dotClass = 'service-dot down';
                    }
                    return `<div class="service-pill ${s.isCore ? 'core' : ''}"><div class="${dotClass}"></div>${escapeHtml(s.key)}</div>`;
                });
                servicesHtml = `<div class="sub-services">${pillNodes.join('')}</div>`;
            }
        }

        let componentsHtml = '';
        if (isExternal && data.Components && data.Components.length > 0) {
            const sortedComponents = [...data.Components].sort((a, b) => a.key.localeCompare(b.key));
            const pillNodes = sortedComponents.map(c => {
                let dotClass = 'service-dot';
                const compStatus = (c.status || 'operational').toLowerCase();
                if (compStatus === 'degraded_performance') dotClass = 'service-dot warn';
                else if (compStatus === 'partial_outage' || compStatus === 'major_outage') dotClass = 'service-dot down';
                return `<div class="service-pill"><div class="${dotClass}"></div>${escapeHtml(c.key)}</div>`;
            });
            componentsHtml = `<div class="sub-services"><div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem;">Components</div>${pillNodes.join('')}</div>`;
        }

        let azureServicesHtml = '';
        if (isExternal && provider && provider.type === 'azure' && data.AzureServices && data.AzureServices.length > 0) {
            const azureSvc = state.trackedExternalConfig.find(s => s.id === result.instance);
            const selectedRegions = (azureSvc && azureSvc.shownRegions && azureSvc.shownRegions.length > 0)
                ? azureSvc.shownRegions
                : AZURE_REGIONS.map(r => r.id);
            const regionNames = Object.fromEntries(AZURE_REGIONS.map(r => [r.id, r.name]));
            const pills = [];
            data.AzureServices.forEach(svc => {
                (svc.geographies || []).filter(g => selectedRegions.includes(g.id)).forEach(geo => {
                    const health = (geo.health || 'healthy').toLowerCase();
                    let dotClass = 'service-dot';
                    if (health === 'degraded' || health === 'advisory') dotClass = 'service-dot warn';
                    else if (health === 'unhealthy') dotClass = 'service-dot down';
                    pills.push({ region: geo.id, service: svc.id, dotClass, name: regionNames[geo.id] || geo.id });
                });
            });
            pills.sort((a, b) => a.region.localeCompare(b.region) || a.service.localeCompare(b.service));
            const pillNodes = pills.map(p => `<div class="service-pill" title="${escapeHtml(p.name)} • ${escapeHtml(p.service)}"><div class="${p.dotClass}"></div>${escapeHtml(p.region)} ${escapeHtml(p.service)}</div>`);
            azureServicesHtml = `<div class="sub-services"><div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem;">Components</div>${pillNodes.join('')}</div>`;
        }

        const locText = data.location ? `• ${escapeHtml(data.location)}` : '';
        const statusPageLink = getStatusPageLink(result.instance, provider, isExternal);

        card.className = `status-card glass-panel ${statusInfo.class}`;
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="instance-id">
                        <i class="ph ${isProd ? 'ph-server' : 'ph-hard-drive'}"></i>
                        ${escapeHtml(displayName)}
                        <a href="${escapeHtml(statusPageLink.url)}" target="_blank" class="trust-link" title="${escapeHtml(statusPageLink.title)}">
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
                    <span class="detail-value" style="color: var(--${statusInfo.class})">${statusInfo.label}</span>
                </div>
                ${data.statusDescription ? `<div class="detail-row"><span class="detail-label"></span><span class="detail-value" style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(data.statusDescription)}</span></div>` : ''}
                ${!isExternal ? `<div class="release-version">Release: ${escapeHtml(data.releaseVersion || 'N/A')}</div>` : ''}
                ${maintenanceHtml}
                ${incidentHtml}
                ${servicesHtml}
                ${componentsHtml}
                ${azureServicesHtml}
            </div>
        `;
        return card;
    }

    function applyViewToggle() {
        const view = state.appSettings.dashboardView || 'cards';
        if (els.viewCardsBtn && els.viewTableBtn) {
            els.viewCardsBtn.classList.toggle('active', view === 'cards');
            els.viewTableBtn.classList.toggle('active', view === 'table');
        }
        els.statusGrid.classList.toggle('dashboard-table-view', view === 'table');
    }

    function renderTableDOM() {
        const tableRowHtml = (r) => `
            <tr class="status-row status-${r.statusInfo.class.replace('status-', '')}">
                <td class="status-indicator-cell">
                    <a href="${escapeHtml(r.statusPageLink.url)}" target="_blank" class="table-instance-link" title="${escapeHtml(r.statusPageLink.title)}">
                        ${escapeHtml(r.name)}
                        ${r.instance !== r.name ? `<span class="table-instance-id">${escapeHtml(r.instance)}</span>` : ''}
                        <i class="ph ph-arrow-square-out table-link-icon"></i>
                    </a>
                </td>
                <td><span class="table-badge ${r.typeClass}">${escapeHtml(r.type)}</span></td>
                <td><span class="table-status ${r.statusInfo.class}">${escapeHtml(r.statusInfo.label)}</span></td>
                <td class="table-incidents">${escapeHtml(r.incidentSummary)}</td>
                <td class="table-release">${r.release}</td>
            </tr>
        `;

        const tableRows = [];

        state.trackedConfig.forEach(group => {
            tableRows.push(`<tr class="table-group-header"><td colspan="5"><i class="ph ph-hard-drives"></i> ${escapeHtml(group.prodName)}</td></tr>`);

            const prodResult = state.fetchCache[group.prod];
            const statusInfo = prodResult && prodResult.success && prodResult.data
                ? getStatusInfo(prodResult.data.status)
                : { label: 'Error', class: 'status-unknown' };
            const incidents = prodResult && prodResult.success && prodResult.data
                ? filterAndDeduplicateIncidents(prodResult.data.Incidents)
                : new Map();
            const incidentSummary = incidents.size > 0
                ? (Array.from(incidents.values())[0].status === 'Resolved' ? '1 resolved' : `${incidents.size} active`)
                : '—';
            const release = prodResult && prodResult.success && prodResult.data && prodResult.data.releaseVersion
                ? escapeHtml(prodResult.data.releaseVersion)
                : '—';
            const statusPageLink = prodResult && prodResult.success
                ? getStatusPageLink(group.prod, null, false)
                : { url: `https://status.salesforce.com/instances/${group.prod}`, title: 'View on Trust' };
            tableRows.push(tableRowHtml({
                name: group.prodName,
                instance: group.prod,
                type: 'Production',
                typeClass: 'badge-prod',
                statusInfo,
                incidentSummary,
                release,
                statusPageLink
            }));

            group.sandboxes.forEach(sb => {
                const sbResult = state.fetchCache[sb.id];
                const sbStatusInfo = sbResult && sbResult.success && sbResult.data
                    ? getStatusInfo(sbResult.data.status)
                    : { label: 'Error', class: 'status-unknown' };
                const sbIncidents = sbResult && sbResult.success && sbResult.data
                    ? filterAndDeduplicateIncidents(sbResult.data.Incidents)
                    : new Map();
                const sbIncidentSummary = sbIncidents.size > 0
                    ? (Array.from(sbIncidents.values())[0].status === 'Resolved' ? '1 resolved' : `${sbIncidents.size} active`)
                    : '—';
                const sbRelease = sbResult && sbResult.success && sbResult.data && sbResult.data.releaseVersion
                    ? escapeHtml(sbResult.data.releaseVersion)
                    : '—';
                const sbLink = sbResult && sbResult.success
                    ? getStatusPageLink(sb.id, null, false)
                    : { url: `https://status.salesforce.com/instances/${sb.id}`, title: 'View on Trust' };
                tableRows.push(tableRowHtml({
                    name: sb.name,
                    instance: sb.id,
                    type: 'Sandbox',
                    typeClass: 'badge-sandbox',
                    statusInfo: sbStatusInfo,
                    incidentSummary: sbIncidentSummary,
                    release: sbRelease,
                    statusPageLink: sbLink
                }));
            });
        });

        if (state.trackedExternalConfig.length > 0) {
            tableRows.push(`<tr class="table-group-header"><td colspan="5"><i class="ph ph-globe"></i> External Services</td></tr>`);
            state.trackedExternalConfig.forEach(svc => {
                const res = state.fetchCache[svc.id];
                const statusInfo = res && res.success && res.data
                    ? getStatusInfo(res.data.status)
                    : { label: 'Error', class: 'status-unknown' };
                const incidents = res && res.success && res.data
                    ? filterAndDeduplicateIncidents(res.data.Incidents)
                    : new Map();
                const incidentSummary = incidents.size > 0
                    ? (Array.from(incidents.values())[0].status === 'Resolved' ? '1 resolved' : `${incidents.size} active`)
                    : '—';
                const statusPageLink = svc.statusPageUrl
                    ? { url: escapeHtml(svc.statusPageUrl), title: `View ${escapeHtml(svc.name)}` }
                    : { url: '#', title: '' };
                tableRows.push(tableRowHtml({
                    name: svc.name,
                    instance: svc.id,
                    type: 'External',
                    typeClass: 'badge-external',
                    statusInfo,
                    incidentSummary,
                    release: '—',
                    statusPageLink
                }));
            });
        }

        return `
            <div class="dashboard-table-wrapper glass-panel">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>Instance</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Incidents</th>
                            <th>Release</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows.join('')}</tbody>
                </table>
            </div>
        `;
    }

    function renderDashboardDOM() {
        els.statusGrid.innerHTML = '';

        const view = state.appSettings.dashboardView || 'cards';
        if (view === 'table') {
            els.statusGrid.innerHTML = renderTableDOM();
            updateTimestamp();
            return;
        }

        state.trackedConfig.forEach(group => {
            const prodResult = state.fetchCache[group.prod];
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

            groupHeader.innerHTML = `
                <h2>${escapeHtml(group.prodName)}</h2>
                <span class="org-group-badge">${escapeHtml(badgeText)}</span>
            `;
            groupWrapper.appendChild(groupHeader);

            const innerGrid = document.createElement('div');
            innerGrid.className = 'dashboard-grid';
            if (prodResult) {
                innerGrid.appendChild(buildStatusCard(prodResult, true, group.prodName, group.prod));
            } else {
                innerGrid.appendChild(buildStatusCard({ success: false, instance: group.prod }, true, group.prodName, group.prod));
            }
            group.sandboxes.forEach(sb => {
                const sbResult = state.fetchCache[sb.id];
                if (sbResult) {
                    innerGrid.appendChild(buildStatusCard(sbResult, false, sb.name, group.prod));
                } else {
                    innerGrid.appendChild(buildStatusCard({ success: false, instance: sb.id }, false, sb.name, group.prod));
                }
            });
            groupWrapper.appendChild(innerGrid);
            els.statusGrid.appendChild(groupWrapper);
        });

        if (state.trackedExternalConfig.length > 0) {
            const extWrapper = document.createElement('div');
            extWrapper.className = 'org-group';
            const extHeader = document.createElement('div');
            extHeader.className = 'org-group-header';

            let hasIncident = false;
            let hasWarning = false;
            state.trackedExternalConfig.forEach(svc => {
                const res = state.fetchCache[svc.id];
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
            state.trackedExternalConfig.forEach(svc => {
                const sbResult = state.fetchCache[svc.id];
                if (sbResult) {
                    extInnerGrid.appendChild(buildStatusCard(sbResult, false, svc.name, svc.id, true, svc));
                } else {
                    extInnerGrid.appendChild(buildStatusCard({ success: false, instance: svc.id, provider: svc }, false, svc.name, svc.id, true, svc));
                }
            });
            extWrapper.appendChild(extInnerGrid);
            els.statusGrid.appendChild(extWrapper);
        }

        updateTimestamp();
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.dashboard = {
        updateTimestamp,
        showRefreshSuccess,
        applyViewToggle,
        buildStatusCard,
        renderDashboardDOM,
        renderTableDOM
    };
})(typeof window !== 'undefined' ? window : this);
