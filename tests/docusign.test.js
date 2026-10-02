const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWatchtower } = require('./load');

const { api, validation } = loadWatchtower();
const plain = v => JSON.parse(JSON.stringify(v));

// Trimmed-down shape of health.docusign.com components.json: group -> product -> site, and product -> site.
const components = {
    components: [
        { id: 'esign', name: 'eSignature', type: 'product', parentId: null, status: 'available', children: ['na1', 'eu'] },
        { id: 'na1', name: 'NA1', type: 'site', parentId: 'esign', status: 'available', children: [] },
        { id: 'eu', name: 'EU', type: 'site', parentId: 'esign', status: 'available', children: [] },
        { id: 'clm', name: 'CLM', type: 'product', parentId: null, status: 'available', children: ['clm-na11'] },
        { id: 'clm-na11', name: 'NA11', type: 'site', parentId: 'clm', status: 'available', children: [] },
        { id: 'iam', name: 'IAM Features', type: 'group', parentId: null, status: 'available', children: ['notary'] },
        { id: 'notary', name: 'Notary', type: 'product', parentId: 'iam', status: 'available', children: ['notary-prod'] },
        { id: 'notary-prod', name: 'PROD', type: 'site', parentId: 'notary', status: 'available', children: [] }
    ]
};

const incident = (overrides = {}) => ({
    id: 'inc1',
    title: 'Envelope sending delayed',
    status: 'investigating',
    impact: 'available',
    updatedAt: new Date().toISOString(),
    components: [{ id: 'na1', name: 'NA1', status: 'performance_degradation' }],
    events: [{ status: 'investigating', body: 'Looking into it', displayAt: new Date().toISOString() }],
    ...overrides
});

const withSiteStatus = (siteId, status) => ({
    components: components.components.map(c => (c.id === siteId ? { ...c, status } : c))
});

test('top-level products (including groups) are reported, sorted by name', () => {
    const data = api.normalizeDocuSignData(components, { incidents: [] });
    assert.deepEqual(plain(data.DocuSignProducts.map(p => p.name)), ['CLM', 'eSignature', 'IAM Features']);
    assert.equal(data.status, 'OK');
});

test('a degraded site degrades its product and lists the site', () => {
    const data = api.normalizeDocuSignData(withSiteStatus('na1', 'performance_degradation'), { incidents: [] });
    const esign = data.DocuSignProducts.find(p => p.name === 'eSignature');
    assert.equal(esign.status, 'DEGRADATION');
    assert.deepEqual(plain(esign.affectedSites), ['NA1: performance degradation']);
    assert.equal(data.status, 'DEGRADATION');
});

test('a zero-impact active incident is shown but does not change the status', () => {
    const data = api.normalizeDocuSignData(components, { incidents: [incident()] });
    assert.equal(data.status, 'OK');
    assert.equal(data.Incidents.length, 1);
    assert.equal(data.Incidents[0].status, 'Active');
    assert.equal(data.Incidents[0].title, 'Envelope sending delayed');
    assert.deepEqual(plain(data.Incidents[0].serviceKeys), ['eSignature NA1']);
    assert.deepEqual(plain(data.Incidents[0].productNames), ['eSignature']);
    assert.equal(data.Incidents[0].timeline[0].title, 'Investigating');
});

test('an active incident with impact raises the status; resolved ones do not', () => {
    const active = api.normalizeDocuSignData(components, { incidents: [incident({ impact: 'service_disruption' })] });
    assert.equal(active.status, 'INCIDENT');
    const resolved = api.normalizeDocuSignData(components, { incidents: [incident({ impact: 'service_disruption', status: 'resolved' })] });
    assert.equal(resolved.status, 'OK');
    assert.equal(resolved.Incidents[0].status, 'Resolved');
});

test('filtering by product narrows products, incidents and status', () => {
    const data = api.normalizeDocuSignData(withSiteStatus('na1', 'service_disruption'), { incidents: [incident()] });
    assert.equal(data.status, 'INCIDENT');

    const clmOnly = api.filterDocuSignData(data, ['CLM']);
    assert.deepEqual(plain(clmOnly.DocuSignProducts.map(p => p.name)), ['CLM']);
    assert.equal(clmOnly.Incidents.length, 0);
    assert.equal(clmOnly.status, 'OK');

    assert.equal(api.filterDocuSignData(data, []), data, 'empty filter means all products');
});

test('unknown component statuses and empty feeds report UNKNOWN rather than OK', () => {
    assert.equal(api.normalizeDocuSignData({ components: [] }, { incidents: [] }).status, 'UNKNOWN');
    assert.equal(api.normalizeDocuSignData(withSiteStatus('eu', 'something_new'), { incidents: [] }).status, 'UNKNOWN');
});

test('DocuSign product filter is validated and persisted', () => {
    const [svc] = validation.normalizeExternalConfig([{ id: 'docusign', shownProducts: ['CLM', 'CLM', 42, '', 'eSignature'], api: 'https://evil.example/' }]);
    assert.deepEqual(plain(svc.shownProducts), ['CLM', 'eSignature']);
    assert.equal(svc.incidentsApi, 'https://health.docusign.com/production/1ds/ssg/apps/health/dynamic/incidents.json');
    assert.deepEqual(plain(validation.serializeExternalConfig([svc])), [{ id: 'docusign', shownProducts: ['CLM', 'eSignature'] }]);
});
