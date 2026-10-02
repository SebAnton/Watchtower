const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWatchtower } = require('./load');

const { status, api } = loadWatchtower();
const recent = new Date().toISOString();

test('filterAndDeduplicateIncidents puts active incidents before resolved ones', () => {
    const map = status.filterAndDeduplicateIncidents([
        { id: 1, status: 'Resolved', updatedAt: recent },
        { id: 2, status: 'Active', updatedAt: recent }
    ]);
    assert.deepEqual(Array.from(map.keys()), [2, 1]);
});

test('filterAndDeduplicateIncidents drops incidents resolved over 48h ago', () => {
    const old = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    const map = status.filterAndDeduplicateIncidents([{ id: 1, status: 'Resolved', updatedAt: old }]);
    assert.equal(map.size, 0);
});

test('summarizeIncidents counts active and resolved separately', () => {
    const map = status.filterAndDeduplicateIncidents([
        { id: 1, status: 'Resolved', updatedAt: recent },
        { id: 2, status: 'Active' },
        { id: 3, status: 'Active' }
    ]);
    assert.equal(status.summarizeIncidents(map), '2 active, 1 resolved');
    assert.equal(status.summarizeIncidents(new Map()), '—');
});

test('cache digest changes when an ongoing incident gets a new update', () => {
    const make = timeline => ({ NA1: { success: true, data: { status: 'OK', Incidents: [{ id: 7, status: 'Active', updatedAt: recent, timeline }] } } });
    const before = status.getCacheDigest(make([{ title: 'Investigating' }]));
    const after = status.getCacheDigest(make([{ title: 'Investigating' }, { title: 'Identified' }]));
    assert.notEqual(before, after);
});

test('status page links encode the instance', () => {
    assert.equal(status.getStatusPageLink('../x', null, false).url, 'https://status.salesforce.com/instances/..%2Fx');
});

test('normalizers report UNKNOWN for responses without a status', () => {
    assert.equal(api.normalizeAtlassianData({}).status, 'UNKNOWN');
    assert.equal(api.normalizeAzureData({}).status, 'UNKNOWN');
    assert.equal(api.normalizeAtlassianData({ status: { indicator: 'none' } }).status, 'OK');
    assert.equal(api.normalizeAzureData({ status: { health: 'healthy' } }).status, 'OK');
});

test('Azure incidents are stable between fetches', () => {
    const raw = { status: { health: 'degraded', message: 'Slow builds' } };
    const a = { azure: { success: true, data: api.normalizeAzureData(raw) } };
    const b = { azure: { success: true, data: api.normalizeAzureData(raw) } };
    assert.equal(status.getCacheDigest(a), status.getCacheDigest(b));
});
