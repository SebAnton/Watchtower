/**
 * Server-side entry point for the browser modules that have no DOM dependencies, so the API
 * validates and normalizes config with exactly the same rules as the dashboard.
 * The modules attach themselves to globalThis.Watchtower (window in the browser).
 */
require('../js/utils.js');
require('../js/constants.js');
require('../js/validation.js');
require('../js/status.js');
require('../js/api.js');

const { utils, constants, validation, status, api } = globalThis.Watchtower;

module.exports = { utils, constants, validation, status, api };
