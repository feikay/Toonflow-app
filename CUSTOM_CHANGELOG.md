# CUSTOM_CHANGELOG

Last updated: 2026-04-26

This file tracks the customization layer that must survive upstream upgrades.

## Customization Summary

| Area | Purpose | Main Files | Upgrade Risk | Keep Strategy |
| --- | --- | --- | --- | --- |
| Jimeng CLI bridge | Local video generation bridge | `scripts/jimeng-bridge.mjs`, `data/vendor/jimengcli.ts`, `docs/JIMENG_CLI_INTEGRATION.md` | Medium | Keep as added files and sync vendor layer separately |
| RunningHub integration | External AI app provider access | `data/vendor/runninghub.ts`, `data/vendor/newapi_channel_conn.ts`, `src/lib/vendor.json` | Medium | Treat vendor adapters as custom catalog files |
| Prompt template customization | Adjust generation behavior | DB prompt records plus helper routes | High | Prefer additive prompt instructions and dedicated helper functions |
| Director board fields | Store shot-language metadata | `src/lib/initDB.ts`, `src/lib/fixDB.ts`, `src/types/database.d.ts`, storyboard routes | High | Keep migration additive only; never replace old columns destructively |
| Panorama storyboard layer | Mother-board and hotspot model | `src/routes/production/panorama/*`, DB schema files, `getFlowData.ts` | High | Keep as additive tables and helper-backed route layer |
| Storyboard image generation enrichment | Inject director/panorama data into image generation | `src/lib/storyboardDirectorPrompt.ts`, `src/routes/production/storyboard/batchGenerateImage.ts` | High | Keep helper-owned prompt assembly and minimal flow hook |
| Video prompt enrichment | Inject director/panorama data into video prompt generation | `src/routes/production/workbench/generateVideoPrompt.ts` | High | Preserve extended storyboard item attributes and helper text rules |
| Video reference enrichment | Auto-attach panorama references to video generation | `src/routes/production/workbench/generateVideo.ts` | High | Preserve reference merge behavior as a clear custom layer |
| Workbench data enrichment | Return director/panorama context in workbench payloads | `src/routes/production/workbench/getGenerateData.ts` | High | Preserve field mapping and panorama hydration behavior |
| Custom update policy | Disable official updater and reserve our release channel | `src/lib/customUpdateSource.ts`, `src/routes/setting/about/checkUpdate.ts`, `src/routes/setting/about/downloadApp.ts`, `docs/UPDATE_POLICY.md`, `docs/AGENT_UPDATE_PLAYBOOK.md` | High | Keep official feed disabled until our own update source is configured |

## Current High-Conflict Files

- `src/agents/productionAgent/tools.ts`
- `src/lib/initDB.ts`
- `src/lib/fixDB.ts`
- `src/routes/production/getFlowData.ts`
- `src/routes/production/saveFlowData.ts`
- `src/routes/production/storyboard/batchGenerateImage.ts`
- `src/routes/production/workbench/generateVideo.ts`
- `src/routes/production/workbench/generateVideoPrompt.ts`
- `src/routes/production/workbench/getGenerateData.ts`
- `data/vendor/runninghub.ts`
- `src/routes/setting/about/checkUpdate.ts`
- `src/routes/setting/about/downloadApp.ts`

## Current Low-Conflict Added Files

- `src/lib/storyboardDirectorPrompt.ts`
- `src/lib/customUpdateSource.ts`
- `src/routes/production/panorama/saveScene.ts`
- `src/routes/production/panorama/getSceneList.ts`
- `src/routes/production/panorama/getSceneDetail.ts`
- `src/routes/production/panorama/saveHotspots.ts`
- `src/routes/production/panorama/getHotspots.ts`
- `src/routes/production/panorama/deleteScene.ts`
- `scripts/jimeng-bridge.mjs`
- `docs/JIMENG_CLI_INTEGRATION.md`

## Upgrade Checklist

Before merging upstream:

1. Create a dated backup
2. Read `docs/UPSTREAM_MERGE_WORKFLOW.md`
3. Review this file
4. Merge upstream on a temporary branch
5. Rebuild and run:
   - `npm run lint`
   - `npm run sync:runtime`
6. Validate custom flows

## Non-Negotiable Rules

- Do not delete custom database fields during upstream upgrades
- Do not overwrite custom vendor catalogs with upstream defaults
- Do not re-enable the official in-app update feed without replacing it with our custom source
- Do not publish runtime updates by hand without a sync script
- Do not trust memory for custom scope; update this file when custom scope changes
