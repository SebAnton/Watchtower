# 🏰 Watchtower

Watchtower is a modern, interactive dashboard for monitoring the status of Salesforce Production Orgs and Sandboxes. Built with a sleek, dark-mode glassmorphism UI, it pulls real-time data directly from the Salesforce Trust API to keep you informed about incidents, maintenance, and overall service health.

## ✨ Features

- **Real-Time Monitoring**: Tracks operational status, active incidents, and maintenance events for any Salesforce instance.
- **Hierarchical Organization**: Group your instances logically! Add a Production Org and track its related Sandboxes under one umbrella.
- **Custom Aliases**: Rename instances (e.g., from `NA211` to `Global Sales Hub`) for easier identification.
- **Sub-Service Filtering**: Drill down into specific services (e.g., Analytics, B2B Commerce) and filter the view per organization.
- **Detailed Incident Timelines**: View timelines and updates for any active or recently resolved service disruptions.
- **Configuration Portability**: Export your configured orgs and sandboxes to a JSON file and import them anywhere.
- **Auto-Refresh**: Automatically refreshes data every 2 minutes, with a manual refresh button for immediate updates.
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

## 📁 Repository Structure

- `index.html`: The main dashboard UI and document structure.
- `app.js`: Core application logic (API requests, state management, UI rendering, local storage).
- `styles.css`: The complete design system and glassmorphism UI components.
- `tests.html`: A custom, lightweight, zero-dependency test suite for the core JavaScript logic.

## 🧪 Running Tests

Watchtower includes its own bespoke testing framework built entirely in a single HTML file to validate the core logic (status mapping, array deduplication, configuration management).

To run the tests, simply open `tests.html` in your browser (via your local file server):
```
http://localhost:8000/tests.html
```
The test suite will execute immediately and display the results, passing/failing specs, and total counts directly in the browser!

## 📡 API Usage

Data is fetched directly from the publicly available Salesforce Trust API:
`https://api.status.salesforce.com/v1/instances/{instance}/status`
