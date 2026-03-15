/**
 * API fetching and data normalization.
 */
(function (global) {
    'use strict';

    function normalizeAtlassianData(rawData) {
        let mappedStatus = 'UNKNOWN';
        const indicator = rawData.status && rawData.status.indicator ? rawData.status.indicator.toLowerCase() : 'none';

        if (indicator === 'none') mappedStatus = 'OK';
        else if (indicator === 'minor') mappedStatus = 'DEGRADATION';
        else if (indicator === 'major' || indicator === 'critical') mappedStatus = 'INCIDENT';

        let mappedIncidents = [];
        if (rawData.incidents && rawData.incidents.length > 0) {
            mappedIncidents = rawData.incidents.map(inc => {
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
                    timeline: mappedTimeline,
                    impact: inc.impact
                };
            });
        }

        let Components = [];
        if (rawData.components && rawData.components.length > 0) {
            Components = rawData.components.map(c => ({
                key: c.name,
                status: (c.status || 'operational').toLowerCase(),
                isCore: false
            }));
        }

        let Maintenances = [];
        if (rawData.scheduled_maintenances && rawData.scheduled_maintenances.length > 0) {
            Maintenances = rawData.scheduled_maintenances.map(m => ({
                startDate: m.scheduled_for || m.scheduled_until || new Date().toISOString(),
                name: m.name,
                status: m.status
            }));
        }

        const statusDescription = rawData.status && rawData.status.description ? rawData.status.description : null;
        return { status: mappedStatus, Incidents: mappedIncidents, Components, Maintenances, statusDescription };
    }

    function normalizeAzureData(rawData) {
        let mappedStatus = 'UNKNOWN';
        const health = rawData.status && rawData.status.health ? rawData.status.health.toLowerCase() : 'healthy';

        if (health === 'healthy') mappedStatus = 'OK';
        else if (health === 'degraded' || health === 'advisory') mappedStatus = 'DEGRADATION';
        else if (health === 'unhealthy') mappedStatus = 'INCIDENT';

        let mappedIncidents = [];
        if (mappedStatus !== 'OK' && rawData.status && rawData.status.message) {
            mappedIncidents.push({
                id: 'azure_inc_1',
                status: 'Active',
                externalId: 'AZURE_1',
                message: rawData.status.message,
                updatedAt: new Date().toISOString(),
                timeline: [{ title: 'Update', createdAt: new Date().toISOString(), content: rawData.status.message }]
            });
        }

        let AzureServices = [];
        if (rawData.services && rawData.services.length > 0) {
            AzureServices = rawData.services.map(svc => ({
                id: svc.id,
                geographies: (svc.geographies || []).map(g => ({
                    id: g.id,
                    name: g.name || g.id,
                    health: (g.health || 'healthy').toLowerCase()
                }))
            }));
        }

        return { status: mappedStatus, Incidents: mappedIncidents, AzureServices };
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

            return { success: true, instance: svc.id, data: normalizedData, provider: svc };
        } catch (e) {
            console.error(`External fetch failed for ${svc.id}:`, e);
            return { success: false, instance: svc.id, error: e.message, provider: svc };
        }
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.api = {
        fetchInstanceData,
        fetchExternalInstanceData,
        normalizeAtlassianData,
        normalizeAzureData
    };
})(typeof window !== 'undefined' ? window : this);
