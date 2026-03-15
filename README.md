# 🏰 Watchtower

Watchtower is a modern, interactive dashboard for monitoring the status of Salesforce Production Orgs, Sandboxes, and external services (Jira, Bitbucket, Azure DevOps). Built with a sleek, dark-mode glassmorphism UI, it pulls real-time data from status APIs to keep you informed about incidents, maintenance, and overall service health.

## ✨ Features

- **Real-Time Monitoring**: Tracks operational status, active incidents, and maintenance events for Salesforce instances and external services.
- **Hierarchical Organization**: Group your instances logically! Add a Production Org and track its related Sandboxes under one umbrella.
- **External Services**: Monitor Jira Software, Atlassian Bitbucket, and Azure DevOps status alongside your Salesforce orgs.
- **Custom Aliases**: Rename instances (e.g., from `NA211` to `Global Sales Hub`) for easier identification.
- **Sub-Service Filtering**: Drill down into specific services (e.g., Analytics, B2B Commerce) and filter the view per organization. Azure DevOps supports region filtering.
- **Detailed Incident Timelines**: View timelines and updates for any active or recently resolved service disruptions.
- **Configuration Portability**: Export your configured orgs, sandboxes, external services, and app settings to a JSON file and import them anywhere.
- **Customizable App Title**: Set a custom dashboard title (e.g., your team or project name).
- **Configurable Auto-Refresh**: Set refresh interval from 1 to 120 minutes (default 2 minutes), with a manual refresh button for immediate updates.
- **Lightweight & Fast**: Zero-dependency vanilla HTML, CSS, and JavaScript. No build steps or heavy frameworks required.
- **Premium UI**: Crafted with dynamic CSS variables, glassmorphism effects, fluid animations, and modern typography (Outfit font & Phosphor Icons).

## 🚀 Getting Started

Watchtower is a purely client-side static web application. There's no build process, Node modules to install, or databases to configure.

### Prerequisites

You just need a static local server to avoid CORS/file protocol restrictions in modern web browsers.

### Running the App

1. Clone or download this repository.
2. Navigate to the project directory in your terminal.
3. Start a local server. For example, using Python 3:
   ```bash
   python3 -m http.server 8000
   ```
4. Open your browser and navigate to `http://localhost:8000`.

### Using the App

1. Open the **Sidebar Navigation** (list icon top left).
2. Under **Salesforce Configuration**, enter a Salesforce instance (e.g., `NA211`) in the input field.
3. (Optional) Provide an alias for the instance.
4. Click **Add**.
5. You can then add specific Sandboxes (e.g., `CS71`) nested under your newly created Production Org.
6. Under **External Services**, select Jira, Bitbucket, or Azure DevOps and click **Add** to track their status.

## 📁 Repository Structure

- `index.html`: The main dashboard UI and document structure.
- `js/`: Modular JavaScript application (load order matters):
  - `utils.js` — HTML/JS escaping utilities
  - `constants.js` — Storage keys, default config, external service definitions
  - `state.js` — Mutable application state
  - `dom.js` — Cached DOM element references
  - `status.js` — Status mapping, incident filtering, link helpers
  - `api.js` — API fetching and data normalization
  - `storage.js` — LocalStorage persistence and migration
  - `config.js` — Export/import, app title, refresh interval
  - `modal.js` — Confirm modal UI
  - `sidebar.js` — Sidebar org list, external services, filters
  - `dashboard.js` — Status grid and card rendering
  - `events.js` — Event listeners and handlers
  - `app.js` — Main orchestration and data fetching
- `styles.css`: The complete design system and glassmorphism UI components.
- `tests.html`: A custom, lightweight, zero-dependency test suite for the core JavaScript logic.

## 🧪 Running Tests

Watchtower includes its own bespoke testing framework built entirely in a single HTML file to validate the core logic (status mapping, incident deduplication, configuration management, migration logic).

To run the tests, simply open `tests.html` in your browser (via your local file server):
```
http://localhost:8000/tests.html
```
The test suite will execute immediately and display the results, passing/failing specs, and total counts directly in the browser!

## 📡 API Usage

Data is fetched from publicly available status APIs:

| Service | API Endpoint |
|---------|--------------|
| Salesforce | `https://api.status.salesforce.com/v1/instances/{instance}/status` |
| Jira Software | `https://jira-software.status.atlassian.com/api/v2/summary.json` |
| Atlassian Bitbucket | `https://bitbucket.status.atlassian.com/api/v2/summary.json` |
| Azure DevOps | `https://status.dev.azure.com/_apis/status/health?api-version=6.0-preview.1` |
