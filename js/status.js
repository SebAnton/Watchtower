/**
 * Status mapping, incident filtering, and link helpers.
 */
(function (global) {
    'use strict';

    /** Normalize status from API (string or object) to a comparable string. */
    function normalizeStatusValue(status) {
        if (status == null) return '';
        if (typeof status === 'string') return status;
        if (typeof status === 'object') return status.indicator || status.value || status.status || '';
        return String(status);
    }

    /** Returns a digest string for cache comparison. */
    function getCacheDigest(cache) {
        const parts = [];
        Object.keys(cache).sort().forEach(instance => {
            const r = cache[instance];
            if (!r) return;
            let sig = `${instance}:${r.success ? '1' : '0'}`;
            if (r.success && r.data) {
                const d = r.data;
                sig += `:${normalizeStatusValue(d.status)}`;
                const incIds = (d.Incidents || []).map(i => `${i.id}:${i.status}`).sort().join(',');
                sig += `:${incIds}`;
                sig += `:${(d.Maintenances || []).length}`;
                const maintStarts = (d.Maintenances || []).map(m => m.startDate).sort().join(',');
                sig += `:${maintStarts}`;
                sig += `:${d.releaseVersion || ''}`;
                if (d.Components) sig += `:C${d.Components.map(c => `${c.key}:${c.status}`).sort().join(',')}`;
                if (d.AzureServices) {
                    const azParts = d.AzureServices.map(s =>
                        `${s.id}:${(s.geographies || []).map(g => `${g.id}:${g.health}`).join(';')}`
                    ).join('|');
                    sig += `:A${azParts}`;
                }
            }
            parts.push(sig);
        });
        return parts.join('||');
    }

    function getStatusInfo(statusString) {
        const status = (normalizeStatusValue(statusString) || '').toUpperCase();
        switch (status) {
            case 'OK':
            case 'AVAILABLE': return { raw: status, label: 'Operational', class: 'status-ok' };
            case 'MAJOR_INCIDENT_CORE':
            case 'MAJOR_INCIDENT_NONCORE':
            case 'MINOR_INCIDENT_CORE':
            case 'MINOR_INCIDENT_NONCORE':
            case 'INCIDENT':
            case 'OUTAGE':
            case 'SERVICE DISRUPTION': return { raw: status, label: 'Incident', class: 'status-critical' };
            case 'DEGRADATION':
            case 'PERFORMANCE DEGRADATION':
            case 'MAINTENANCE':
            case 'MAINTENANCE_CORE':
            case 'MAINTENANCE_NONCORE': return { raw: status, label: 'Warning', class: 'status-warning' };
            case 'INFORMATIONAL': return { raw: status, label: 'Informational', class: 'status-ok' };
            default: return { raw: status || 'UNKNOWN', label: 'Unknown', class: 'status-unknown' };
        }
    }

    function getIncidentDetailLink(incidentId, provider, result) {
        if (provider && provider.incidentUrlTemplate) {
            const url = provider.incidentUrlTemplate.replace('{id}', incidentId);
            const label = provider.name ? `View full details on ${provider.name}` : 'View full details';
            return { url, label, title: label };
        }
        if (!provider) {
            return { url: `https://status.salesforce.com/incidents/${incidentId}`, label: 'View full details on Trust', title: 'View exact incident details on Salesforce Trust' };
        }
        if (provider.statusPageUrl) {
            return { url: provider.statusPageUrl, label: 'View status page', title: `View ${provider.name} status` };
        }
        return null;
    }

    function getStatusPageLink(instance, provider, isExternal) {
        if (isExternal && provider && provider.statusPageUrl) {
            return { url: provider.statusPageUrl, title: `View on ${provider.name || 'Status Page'}` };
        }
        return { url: `https://status.salesforce.com/instances/${instance}`, title: 'View on Salesforce Trust' };
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
                if (resolvedTs && resolvedTs < fortyEightHoursBack) return;
            }
            if (inc && inc.id && !uniqueIncidents.has(inc.id)) {
                uniqueIncidents.set(inc.id, inc);
            }
        });

        return uniqueIncidents;
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.status = {
        normalizeStatusValue,
        getCacheDigest,
        getStatusInfo,
        getIncidentDetailLink,
        getStatusPageLink,
        filterAndDeduplicateIncidents
    };
})(typeof window !== 'undefined' ? window : this);
