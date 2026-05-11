# Toonflow Agent Update Playbook

Last updated: 2026-04-26

This playbook is for any agent that updates this repository or the packaged app.

## Read First

1. `docs/UPDATE_POLICY.md`
2. `docs/UPSTREAM_MERGE_WORKFLOW.md`
3. `CUSTOM_CHANGELOG.md`

## What You Must Not Do

- Do not enable or use the official upstream in-app update feed
- Do not overwrite runtime files by hand without `scripts/sync-runtime.ps1`
- Do not merge upstream directly into a dirty working line without a dated backup
- Do not drop custom DB fields, vendor files, or director/panorama logic

## Standard Procedure For Upstream Sync

1. Create a dated backup
2. Review `CUSTOM_CHANGELOG.md`
3. Create a temporary merge branch
4. Merge upstream changes
5. Resolve conflicts by preserving custom hooks and custom files
6. Run:

```powershell
npm run lint
npm run build
npm run sync:runtime
```

7. Verify:
   - login
   - RunningHub model list
   - storyboard image generation
   - video prompt generation
   - video generation
   - director board fields
   - panorama storyboard references

## Standard Procedure For Custom-Only Release

Use this when upstream is not being merged and only our custom logic changed.

```powershell
npm run release:custom
```

Then validate the packaged app before delivery.

## Custom Update Source Rule

The app updater may only use:

```powershell
TOONFLOW_CUSTOM_UPDATE_URL
```

If this is not configured, update checks must remain disabled.

## Future Custom Update Source Checklist

When a real release location exists, prepare:

1. a hosted `update.json`
2. a hosted installer package
3. a hosted patch zip
4. a published version record

Until then, keep the custom updater reserved but disabled.
