/**
 * API fetching and data normalization.
 */
(function (global) {
    'use strict';

    function normalizeAtlassianData(rawData) {
        let mappedStatus = 'UNKNOWN';
        // A missing indicator means the response is not what we expect, so report UNKNOWN rather than OK.
        const indicator = rawData.status && typeof rawData.status.indicator === 'string' ? rawData.status.indicator.toLowerCase() : null;

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
                    title: inc.name,
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
        const health = rawData.status && typeof rawData.status.health === 'string' ? rawData.status.health.toLowerCase() : null;

        if (health === 'healthy') mappedStatus = 'OK';
        else if (health === 'degraded' || health === 'advisory') mappedStatus = 'DEGRADATION';
        else if (health === 'unhealthy') mappedStatus = 'INCIDENT';

        let mappedIncidents = [];
        if (mappedStatus !== 'OK' && rawData.status && rawData.status.message) {
            // The health API has no incident timestamps; leave them out rather than stamping "now" on every fetch.
            mappedIncidents.push({
                id: 'azure_inc_1',
                status: 'Active',
                externalId: 'AZURE_1',
                message: rawData.status.message
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

    // DocuSign component/impact values -> Watchtower status. Higher rank = worse.
    const DOCUSIGN_STATUS = {
        available: 'OK',
        performance_degradation: 'DEGRADATION',
        maintenance: 'MAINTENANCE',
        under_maintenance: 'MAINTENANCE',
        service_disruption: 'INCIDENT'
    };
    const STATUS_RANK = { OK: 0, UNKNOWN: 1, MAINTENANCE: 1, DEGRADATION: 2, INCIDENT: 3 };

    function mapDocuSignStatus(value) {
        return DOCUSIGN_STATUS[String(value || '').toLowerCase()] || 'UNKNOWN';
    }

    function worstStatus(statuses) {
        return statuses.reduce((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst), 'OK');
    }

    function capitalize(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : 'Update';
    }

    /**
     * Normalizes DocuSign's components.json + incidents.json. Components form a tree
     * (product or group -> product -> site); each top-level node is reported as one product,
     * matching the products listed on DocuSign's own status page.
     */
    function normalizeDocuSignData(componentsRaw, incidentsRaw) {
        const components = (componentsRaw && Array.isArray(componentsRaw.components)) ? componentsRaw.components : [];
        if (components.length === 0) return { status: 'UNKNOWN', Incidents: [], DocuSignProducts: [] };

        const byId = new Map(components.map(c => [c.id, c]));
        const topLevelName = (comp) => {
            let node = comp;
            const seen = new Set();
            while (node && node.parentId && byId.has(node.parentId) && !seen.has(node.id)) {
                seen.add(node.id);
                node = byId.get(node.parentId);
            }
            return node ? node.name : null;
        };

        const productMap = new Map();
        components.forEach(c => {
            const productName = topLevelName(c);
            if (!productName) return;
            if (!productMap.has(productName)) productMap.set(productName, { name: productName, statuses: [], affectedSites: [] });
            const product = productMap.get(productName);
            const status = mapDocuSignStatus(c.status);
            product.statuses.push(status);
            if (status !== 'OK' && c.type === 'site') product.affectedSites.push(`${c.name}: ${String(c.status).replace(/_/g, ' ')}`);
        });
        const DocuSignProducts = Array.from(productMap.values())
            .map(p => ({ name: p.name, status: worstStatus(p.statuses), affectedSites: p.affectedSites }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const rawIncidents = (incidentsRaw && Array.isArray(incidentsRaw.incidents)) ? incidentsRaw.incidents : [];
        const Incidents = rawIncidents.map(inc => {
            const refs = Array.isArray(inc.components) ? inc.components : [];
            const productNames = new Set();
            const serviceKeys = [];
            refs.forEach(ref => {
                const comp = byId.get(ref.id);
                const productName = comp ? topLevelName(comp) : null;
                if (productName) productNames.add(productName);
                serviceKeys.push(productName && productName !== ref.name ? `${productName} ${ref.name}` : ref.name);
            });
            return {
                id: inc.id,
                status: inc.status === 'resolved' ? 'Resolved' : 'Active',
                title: inc.title,
                message: inc.title,
                updatedAt: inc.updatedAt,
                impact: inc.impact,
                serviceKeys: serviceKeys.filter(Boolean),
                productNames: Array.from(productNames),
                timeline: (Array.isArray(inc.events) ? inc.events : []).map(ev => ({
                    title: capitalize(ev.status),
                    createdAt: ev.displayAt || ev.createdAt,
                    content: ev.body
                }))
            };
        });

        return { status: overallDocuSignStatus(DocuSignProducts, Incidents), Incidents, DocuSignProducts };
    }

    /**
     * Status for a set of products: the worst product status, made worse by the declared impact of any
     * active incident on those products. (DocuSign keeps products "available" for zero-impact incidents.)
     */
    function overallDocuSignStatus(products, incidents) {
        if (products.length === 0) return 'UNKNOWN';
        const activeImpacts = incidents.filter(i => i.status !== 'Resolved').map(i => mapDocuSignStatus(i.impact)).filter(s => s !== 'UNKNOWN');
        return worstStatus([...products.map(p => p.status), ...activeImpacts]);
    }

    /** Restricts normalized DocuSign data to the products the user chose (empty list = all products). */
    function filterDocuSignData(data, shownProducts) {
        if (!data || !Array.isArray(data.DocuSignProducts) || !Array.isArray(shownProducts) || shownProducts.length === 0) return data;
        const DocuSignProducts = data.DocuSignProducts.filter(p => shownProducts.includes(p.name));
        const Incidents = (data.Incidents || []).filter(i => !i.productNames || i.productNames.length === 0 || i.productNames.some(n => shownProducts.includes(n)));
        return { ...data, DocuSignProducts, Incidents, status: overallDocuSignStatus(DocuSignProducts, Incidents) };
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }

    async function fetchInstanceData(instance) {
        try {
            const response = await fetch(`https://api.status.salesforce.com/v1/instances/${encodeURIComponent(instance)}/status`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return { success: true, instance, data };
        } catch (e) {
            return { success: false, instance, error: e.message };
        }
    }

    async function fetchExternalInstanceData(svc) {
        try {
            let normalizedData;
            if (svc.type === 'docusign') {
                const [components, incidents] = await Promise.all([fetchJson(svc.api), fetchJson(svc.incidentsApi)]);
                normalizedData = normalizeDocuSignData(components, incidents);
            } else {
                const rawData = await fetchJson(svc.api);
                if (svc.type === 'atlassian') normalizedData = normalizeAtlassianData(rawData);
                else if (svc.type === 'azure') normalizedData = normalizeAzureData(rawData);
            }

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
        normalizeAzureData,
        normalizeDocuSignData,
        filterDocuSignData
    };
})(globalThis);
