const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWatchtower } = require('./load');

const { validation } = loadWatchtower();
const plain = v => JSON.parse(JSON.stringify(v));

test('safeUrl only allows http(s)', () => {
    assert.equal(validation.safeUrl('https://status.dev.azure.com/'), 'https://status.dev.azure.com/');
    assert.equal(validation.safeUrl('javascript:alert(1)'), '#');
    assert.equal(validation.safeUrl('data:text/html,hi'), '#');
    assert.equal(validation.safeUrl('not a url'), '#');
    assert.equal(validation.safeUrl(undefined), '#');
});

test('normalizeTrackedConfig drops invalid orgs and sandboxes', () => {
    const result = plain(validation.normalizeTrackedConfig([
        { id: 'org_ok', prod: 'na211', prodName: 'Sales', sandboxes: ['cs71', { id: 'BAD ID!' }, { id: 'CS5', name: 'UAT' }] },
        { id: 'org_x', prod: '../../foo' },
        { id: 'org_y' },
        null,
        'string-in-object-list'
    ]));
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
        id: 'org_ok',
        prod: 'NA211',
        prodName: 'Sales',
        sandboxes: [{ id: 'CS71', name: 'CS71' }, { id: 'CS5', name: 'UAT' }],
        shownServices: []
    });
});

test('normalizeTrackedConfig replaces unsafe and duplicate org ids', () => {
    const result = validation.normalizeTrackedConfig([
        { id: '"><img src=x onerror=alert(1)>', prod: 'NA1' },
        { id: 'org_same', prod: 'NA2' },
        { id: 'org_same', prod: 'NA3' }
    ]);
    assert.match(result[0].id, /^org_\d+_[a-z0-9]+$/);
    assert.equal(result[1].id, 'org_same');
    assert.notEqual(result[2].id, 'org_same');
});

test('normalizeTrackedConfig fills in missing sandboxes so rendering cannot crash', () => {
    const [group] = validation.normalizeTrackedConfig([{ prod: 'NA1' }]);
    assert.deepEqual(plain(group.sandboxes), []);
    assert.equal(group.prodName, 'NA1');
});

test('normalizeTrackedConfig converts the legacy flat string list', () => {
    const result = plain(validation.normalizeTrackedConfig(['NA1', 'CS2', 'NA3']));
    assert.equal(result.length, 2);
    assert.deepEqual(result[0].sandboxes, [{ id: 'CS2', name: 'CS2' }]);
    assert.deepEqual(result[1].sandboxes, []);
});

test('external services take URLs from the built-in definitions only', () => {
    const [svc] = validation.normalizeExternalConfig([
        { id: 'jira', statusPageUrl: 'javascript:alert(1)', api: 'https://evil.example/' }
    ]);
    assert.equal(svc.statusPageUrl, 'https://jira-software.status.atlassian.com/');
    assert.equal(svc.api, 'https://jira-software.status.atlassian.com/api/v2/summary.json');
});

test('external services: unknown ids, duplicates and bad regions are dropped', () => {
    const result = plain(validation.normalizeExternalConfig([
        { id: 'nope' }, { id: 'azure', shownRegions: ['EU', 'MARS'] }, { id: 'azure' }
    ]));
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].shownRegions, ['EU']);
});

test('serializeExternalConfig persists only id and preferences', () => {
    const hydrated = validation.normalizeExternalConfig([{ id: 'jira' }, { id: 'azure', shownRegions: ['US'] }]);
    assert.deepEqual(plain(validation.serializeExternalConfig(hydrated)), [{ id: 'jira' }, { id: 'azure', shownRegions: ['US'] }]);
});
