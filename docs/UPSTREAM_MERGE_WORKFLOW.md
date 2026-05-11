# Toonflow Upstream Merge Workflow

Last updated: 2026-04-26

## Goal

Keep Toonflow upgradeable from the upstream open-source project without overwriting our custom layer.

This repository currently has two kinds of code:

1. Upstream Toonflow code from `HBAI-Ltd/Toonflow-app`
2. Our customization layer for:
   - Jimeng CLI bridge
   - RunningHub API integration
   - custom prompt templates
   - director board and panorama storyboard features

The rule is simple:

- upstream changes should be merged in
- our custom layer should be reattached, not rewritten blindly

## Repository Strategy

Recommended remote layout:

- `origin`: your own private repo or main working repo
- `upstream`: `https://github.com/HBAI-Ltd/Toonflow-app.git`

If the current `origin` already points to the open-source repo, do not force-change it during active work.
When you are ready, add a second remote for your own persistent repo and use that as the long-term custom mainline.

## Branch Strategy

Use these branches:

- `main`: your current stable customized line
- `feature/<topic>`: one customization per branch
- `merge-upstream-YYYYMMDD`: temporary branch for each upstream merge round

Do not make long-term work directly on an upstream-tracking branch.

## Upgrade Procedure

### 1. Refresh upstream

```powershell
git fetch --all --prune
```

### 2. Create a merge branch from current custom mainline

```powershell
git checkout main
git checkout -b merge-upstream-20260425
```

### 3. Merge upstream changes

If you have a dedicated `upstream` remote:

```powershell
git merge upstream/main
```

If the current remote is still the upstream repo, merge from the appropriate fetched branch instead of overwriting local work.

### 4. Resolve only real conflicts

When conflicts appear, use this order:

1. Keep upstream base logic when it improves the original product
2. Reapply our custom hook/helper layer on top
3. Avoid re-copying old large file rewrites unless there is no better path

### 5. Rebuild and sync runtime

```powershell
npm run build
npm run sync:runtime
```

### 6. Run verification

At minimum:

```powershell
npm run lint
```

And then test:

- login
- storyboard image generation
- video prompt generation
- video generation
- RunningHub model selection
- director board / panorama linked flows

### 7. Merge back when stable

```powershell
git checkout main
git merge merge-upstream-20260425
```

## Conflict Handling Rules

These areas are high-conflict and must be reviewed carefully during each upstream merge:

- `src/routes/production/workbench/generateVideo.ts`
- `src/routes/production/workbench/generateVideoPrompt.ts`
- `src/routes/production/workbench/getGenerateData.ts`
- `src/routes/production/storyboard/batchGenerateImage.ts`
- `src/agents/productionAgent/tools.ts`
- `src/lib/initDB.ts`
- `src/lib/fixDB.ts`
- `data/vendor/runninghub.ts`
- `src/routes/setting/about/checkUpdate.ts`
- `src/routes/setting/about/downloadApp.ts`

## Keep Custom Logic Layered

Whenever possible:

- add helpers under `src/lib/`
- add scripts under `scripts/`
- add docs under `docs/`
- avoid large invasive rewrites in upstream-owned files

Preferred pattern:

- upstream file owns the flow
- our helper owns the custom behavior
- the upstream file calls our helper in one or two clear lines

## Runtime Sync Principle

Never hand-copy release files as an undocumented step.

Use the sync script so the following stay aligned:

- `data/serve/app.js`
- `dist/win-unpacked/resources/data/serve/app.js`
- `C:\Users\Administrator\AppData\Roaming\toonflow\data\serve\app.js`
- `data/vendor/*.ts`
- `dist/win-unpacked/resources/data/vendor/*.ts`
- `C:\Users\Administrator\AppData\Roaming\toonflow\data\vendor\*.ts`

## Mandatory Files To Check Before Every Upgrade

- `CUSTOM_CHANGELOG.md`
- `docs/UPSTREAM_MERGE_WORKFLOW.md`
- `scripts/sync-runtime.ps1`

These three files define:

- what we changed
- how we merge upstream safely
- how we publish the custom runtime safely

Also check:

- `docs/UPDATE_POLICY.md`
- `docs/AGENT_UPDATE_PLAYBOOK.md`

These define the rule that the in-app updater must only use our custom release channel.
