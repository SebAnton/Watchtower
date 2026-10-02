/**
 * Validation and normalization of persisted / imported configuration.
 * Everything coming from localStorage or an imported file is treated as untrusted.
 */
(function (global) {
    'use strict';

    const { Watchtower } = global;
    const { SUPPORTED_EXTERNAL_SERVICES, AZURE_REGIONS } = Watchtower.constants;
    const { generateOrgId } = Watchtower.utils;

    const INSTANCE_PATTERN = /^[A-Z0-9]{2,15}$/;
    const ORG_ID_PATTERN = /^org_[A-Za-z0-9_]{1,64}$/;
    const MAX_NAME_LENGTH = 100;

    function isValidInstance(value) {
        return typeof value === 'string' && INSTANCE_PATTERN.test(value);
    }

    /** Only allow http(s) links so stored/imported data can never produce a javascript: URL. */
    function safeUrl(url) {
        if (typeof url !== 'string') return '#';
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '#';
        } catch (e) {
            return '#';
        }
    }

    function normalizeName(value, fallback) {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
        return trimmed || fallback;
    }

    function normalizeSandbox(sb) {
        const raw = typeof sb === 'string' ? { id: sb } : sb;
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
        const id = raw.id.trim().toUpperCase();
        if (!isValidInstance(id)) return null;
        return { id, name: normalizeName(raw.name, id) };
    }

    /** Returns a clean org group, or null if the entry is unusable. */
    function normalizeOrgGroup(g) {
        if (!g || typeof g !== 'object' || typeof g.prod !== 'string') return null;
        const prod = g.prod.trim().toUpperCase();
        if (!isValidInstance(prod)) return null;
        return {
            id: typeof g.id === 'string' && ORG_ID_PATTERN.test(g.id) ? g.id : generateOrgId(),
            prod,
            prodName: normalizeName(g.prodName, prod),
            sandboxes: (Array.isArray(g.sandboxes) ? g.sandboxes : []).map(normalizeSandbox).filter(Boolean),
            shownServices: Array.isArray(g.shownServices) ? g.shownServices.filter(s => typeof s === 'string') : []
        };
    }

    /** Converts the oldest storage format (flat array of instance strings) into org groups. */
    function convertLegacyInstanceList(list) {
        const isSandbox = i => i.startsWith('CS') || i.startsWith('TEST');
        const prods = list.filter(i => !isSandbox(i));
        const sandboxes = list.filter(isSandbox);
        if (prods.length === 0) {
            return [{ prod: 'LEGACY_PROD', prodName: 'LEGACY_PROD', sandboxes }];
        }
        return prods.map((p, idx) => ({ prod: p, prodName: p, sandboxes: idx === 0 ? sandboxes : [] }));
    }

    /** Normalizes any supported stored/imported shape into a list of valid org groups. */
    function normalizeTrackedConfig(parsed) {
        if (!Array.isArray(parsed)) return [];
        const source = parsed.length > 0 && parsed.every(i => typeof i === 'string')
            ? convertLegacyInstanceList(parsed)
            : parsed;
        const seenIds = new Set();
        return source.map(normalizeOrgGroup).filter(Boolean).map(g => {
            // Duplicate ids would make remove/rename act on several orgs at once.
            if (seenIds.has(g.id)) g.id = generateOrgId();
            seenIds.add(g.id);
            return g;
        });
    }

    /**
     * Rebuilds an external service entry from the built-in definition. Only the id and
     * user preferences are taken from the input, so URLs always come from constants.js.
     */
    function hydrateExternalService(s) {
        if (!s || typeof s !== 'object') return null;
        const def = SUPPORTED_EXTERNAL_SERVICES.find(d => d.id === s.id);
        if (!def) return null;
        const svc = { ...def };
        if (def.type === 'azure') {
            const validRegions = AZURE_REGIONS.map(r => r.id);
            svc.shownRegions = Array.isArray(s.shownRegions) ? s.shownRegions.filter(r => validRegions.includes(r)) : [];
        }
        return svc;
    }

    function normalizeExternalConfig(parsed) {
        if (!Array.isArray(parsed)) return [];
        const seen = new Set();
        return parsed.map(hydrateExternalService).filter(svc => {
            if (!svc || seen.has(svc.id)) return false;
            seen.add(svc.id);
            return true;
        });
    }

    /** The persisted form of external services: id plus user preferences only. */
    function serializeExternalConfig(list) {
        return list.map(svc => (Array.isArray(svc.shownRegions) ? { id: svc.id, shownRegions: svc.shownRegions } : { id: svc.id }));
    }

    global.Watchtower.validation = {
        INSTANCE_PATTERN,
        isValidInstance,
        safeUrl,
        normalizeOrgGroup,
        normalizeTrackedConfig,
        hydrateExternalService,
        normalizeExternalConfig,
        serializeExternalConfig
    };
})(typeof window !== 'undefined' ? window : this);
