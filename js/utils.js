/**
 * Utility functions for the Watchtower app.
 */
(function (global) {
    'use strict';

    /** Escape string for safe use in HTML attributes and content to prevent XSS. */
    function escapeHtml(str) {
        if (str == null) return '';
        const s = String(str);
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Escape string for safe use inside a single-quoted JavaScript string in HTML. */
    function escapeForJsString(str) {
        if (str == null) return '';
        return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.utils = { escapeHtml, escapeForJsString };
})(typeof window !== 'undefined' ? window : this);
