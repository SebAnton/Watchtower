/**
 * DOM element references - cached at load time.
 */
(function (global) {
    'use strict';

    const els = {
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        instanceList: document.getElementById('instance-list'),
        addForm: document.getElementById('add-instance-form'),
        newInput: document.getElementById('new-instance-input'),
        newAlias: document.getElementById('new-instance-alias'),
        inputError: document.getElementById('input-error'),
        externalList: document.getElementById('external-list'),
        externalSelect: document.getElementById('new-external-select'),
        addExternalBtn: document.getElementById('btn-add-external'),
        statusGrid: document.getElementById('status-grid'),
        refreshBtn: document.getElementById('refresh-btn'),
        lastUpdated: document.getElementById('last-updated'),
        confirmModal: document.getElementById('confirm-modal'),
        confirmMessage: document.getElementById('confirm-message'),
        confirmCancelBtn: document.getElementById('confirm-cancel'),
        confirmOkBtn: document.getElementById('confirm-ok'),
        btnExport: document.getElementById('btn-export'),
        btnImport: document.getElementById('btn-import'),
        fileImport: document.getElementById('import-file'),
        appTitle: document.getElementById('app-title'),
        appTitleInput: document.getElementById('app-title-input'),
        refreshIntervalInput: document.getElementById('refresh-interval-input')
    };

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.dom = { els };
})(typeof window !== 'undefined' ? window : this);
