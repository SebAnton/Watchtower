const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('shared modules load in Node with the same validation rules as the browser', () => {
    const { validation } = require('../lib/shared');
    const [group] = validation.normalizeTrackedConfig([{ id: '"><img src=x>', prod: 'na211', sandboxes: ['cs71'] }]);
    assert.equal(group.prod, 'NA211');
    assert.match(group.id, /^org_/);
    assert.equal(validation.normalizeTrackedConfig([{ prod: '../../x' }]).length, 0);
    assert.equal(validation.safeUrl('javascript:alert(1)'), '#');
});

test('no inline event handlers or inline scripts (required by the Content Security Policy)', () => {
    const root = path.join(__dirname, '..');
    const files = ['index.html', ...fs.readdirSync(path.join(root, 'js')).map(f => path.join('js', f))];
    for (const file of files) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(source, /\son[a-z]+\s*=\s*["'`]/i, `${file} contains an inline event handler`);
        assert.doesNotMatch(source, /<script(?![^>]*\bsrc=)[^>]*>/i, `${file} contains an inline <script>`);
        assert.doesNotMatch(source, /href\s*=\s*["'`]javascript:/i, `${file} contains a javascript: link`);
    }
});

test('the Content Security Policy allows every status API the dashboard calls', () => {
    const { constants } = require('../lib/shared');
    const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const csp = vercel.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
    const connectSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('connect-src')).split(/\s+/).slice(1);
    const urls = ['https://api.status.salesforce.com/v1/instances/NA1/status'];
    constants.SUPPORTED_EXTERNAL_SERVICES.forEach(s => urls.push(s.api, ...(s.incidentsApi ? [s.incidentsApi] : [])));
    for (const url of urls) {
        assert.ok(connectSrc.includes(new URL(url).origin), `connect-src is missing ${new URL(url).origin}`);
    }
});
