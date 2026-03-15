/**
 * Application constants and configuration.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'sf_status_instances';
    const DEFAULT_CONFIG = [
        { prod: 'NA211', prodName: 'NA211', sandboxes: [{ id: 'CS71', name: 'CS71' }], shownServices: [] }
    ];
    const EXTERNAL_STORAGE_KEY = 'sf_status_external_instances';
    const APP_SETTINGS_KEY = 'sf_status_app_settings';

    const SUPPORTED_EXTERNAL_SERVICES = [
        { id: 'jira', name: 'Jira Software', type: 'atlassian', api: 'https://jira-software.status.atlassian.com/api/v2/summary.json', statusPageUrl: 'https://jira-software.status.atlassian.com/', incidentUrlTemplate: 'https://jira-software.status.atlassian.com/incidents/{id}' },
        { id: 'bitbucket', name: 'Atlassian Bitbucket', type: 'atlassian', api: 'https://bitbucket.status.atlassian.com/api/v2/summary.json', statusPageUrl: 'https://bitbucket.status.atlassian.com/', incidentUrlTemplate: 'https://bitbucket.status.atlassian.com/incidents/{id}' },
        { id: 'azure', name: 'Azure DevOps', type: 'azure', api: 'https://status.dev.azure.com/_apis/status/health?api-version=6.0-preview.1', statusPageUrl: 'https://status.dev.azure.com/', incidentUrlTemplate: null }
    ];

    const AZURE_REGIONS = [
        { id: 'US', name: 'United States' },
        { id: 'CA', name: 'Canada' },
        { id: 'BR', name: 'Brazil' },
        { id: 'EU', name: 'Europe' },
        { id: 'UK', name: 'United Kingdom' },
        { id: 'APAC', name: 'Asia Pacific' },
        { id: 'AU', name: 'Australia' },
        { id: 'IN', name: 'India' }
    ];

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.constants = {
        STORAGE_KEY,
        DEFAULT_CONFIG,
        EXTERNAL_STORAGE_KEY,
        APP_SETTINGS_KEY,
        SUPPORTED_EXTERNAL_SERVICES,
        AZURE_REGIONS
    };
})(typeof window !== 'undefined' ? window : this);
