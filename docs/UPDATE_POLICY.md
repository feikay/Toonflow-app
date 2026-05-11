# Toonflow Custom Update Policy

Last updated: 2026-04-26

## Goal

Make application updates safe for our customized Toonflow build.

This repository must never update the running app from the official upstream update feed.
The in-app updater is reserved for our custom release channel only.

## Non-Negotiable Rules

1. Official update feeds are disabled by default
2. In-app updates may only use our custom update source
3. If no custom update source is configured, the updater must report "disabled" instead of falling back to upstream
4. Upstream updates must be merged into our codebase first, then published as our own release
5. No agent may bypass `CUSTOM_CHANGELOG.md`, `UPSTREAM_MERGE_WORKFLOW.md`, or `scripts/sync-runtime.ps1`

## Custom Release Channel

Reserved environment variable:

```powershell
TOONFLOW_CUSTOM_UPDATE_URL
```

This value should point to our own `update.json`.

Example:

```text
https://your-domain.example.com/toonflow/update.json
```

Until this is configured, the updater should stay disabled.

## Safe Update Model

There are two different update layers:

1. Code maintenance layer
   - selectively merge upstream changes
   - preserve our custom layer
   - rebuild and validate

2. App distribution layer
   - publish our packaged build
   - expose our own `update.json`
   - let the app update only from our feed

Do not confuse these two layers.

## Must-Preserve Custom Areas

- Jimeng CLI bridge
- RunningHub integration and model catalog
- prompt template behavior
- director board fields and logic
- panorama storyboard layer

## Required Docs Before Any Update Work

- `docs/UPDATE_POLICY.md`
- `docs/AGENT_UPDATE_PLAYBOOK.md`
- `docs/UPSTREAM_MERGE_WORKFLOW.md`
- `CUSTOM_CHANGELOG.md`
