/**
 * Loads the DOM-free browser modules into a sandbox so they can be unit-tested with Node.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PURE_MODULES = ['utils.js', 'constants.js', 'validation.js', 'status.js', 'api.js'];

function loadWatchtower() {
    const context = vm.createContext({ URL, console });
    context.window = context;
    for (const file of PURE_MODULES) {
        const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
        vm.runInContext(code, context, { filename: file });
    }
    return context.Watchtower;
}

module.exports = { loadWatchtower };
