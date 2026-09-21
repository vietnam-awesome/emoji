# AGENTS.md

This repository uses a split code/data architecture and a batched release workflow.

## Branch roles

- `main` — production code, UI, scripts, tests, and workflows.
- `data` — emoji catalog metadata (`src/data/**`) and emoji assets (`public/emojis/**`).
- `release/YYYY-MM-DD` — temporary integration branch used to batch multiple ready changes before production.

Do not put emoji catalog data or emoji binaries back on `main`.

## Production merge workflow

### Single change

For one isolated change, open a PR to `main` as usual. Do not merge it unless the user explicitly asks to merge.

### Multiple ready PRs / branches in the same work session

When two or more independent PRs are ready around the same time, prefer batching them instead of merging each one directly into `main`.

Use this flow:

1. Create or reuse a temporary integration branch named `release/YYYY-MM-DD` from the current `main`.
2. Retarget the ready feature/fix PRs from `main` to that release branch.
3. Merge those PRs into the release branch only.
4. Run CI and PR Live Preview against the combined release branch.
5. Open one final PR: `release/YYYY-MM-DD` -> `main`.
6. Merge that final release PR into `main` only when the user explicitly approves the production merge.
7. After the production merge is complete and stable, the temporary release branch can be deleted.

Example:

```text
fix/seo -----------\
fix/404 ------------> release/2026-09-17 --> PR --> main --> one Pages deploy
fix/back-to-top ---/
```

## Why batching matters

A merge into `main` can trigger an expensive GitHub Pages build/deploy. Merging several PRs independently can cause multiple long production builds, and `cancel-in-progress` can cancel an earlier deployment when another merge arrives. Batching related ready changes into one release branch avoids unnecessary repeated production deploys and tests the combined result before `main` changes.

## Important rules for AI agents

- Never merge a PR into `main` merely because CI is green; wait for explicit user approval.
- If several PRs are ready, proactively consider the release-batch flow above instead of serial merges to `main`.
- Before retargeting or merging, verify each PR is open and mergeable.
- Keep the release branch based on the latest intended `main` state and resolve integration conflicts there, not in production.
- CI/preview on feature PRs is useful, but the combined release PR must also pass because integrations can introduce new failures.
- Production GitHub Pages should ideally run once for a batch, after the final release PR enters `main`.

## Public discovery documentation rules

Public routes and tools must stay synchronized across the site's discovery surfaces.

- When adding, renaming, or removing a public human-readable route, review `src/pages/sitemap-static.xml.js`, `public/agents.md`, and `public/llms.txt` in the same change.
- If the route should be discoverable by search engines or AI agents, update all applicable discovery files instead of changing only navigation/UI.
- Verify every endpoint documented in `public/agents.md` and `public/llms.txt` actually exists in the current static deployment. Do not keep references to removed legacy `/api/*` endpoints.
- The public emoji editor at `/editor` is a discoverable site tool and must remain represented in the static sitemap, `public/agents.md`, and `public/llms.txt` while the route exists.
- The public Emoji Kitchen tool at `/kitchen` is also discoverable and must remain represented in the static sitemap, `public/agents.md`, and `public/llms.txt` while the route exists.
- Keep agent-facing capability descriptions aligned with implemented behavior. Do not advertise deferred editor features such as APNG frame-by-frame editing, interpolation, or AI-generated in-between frames unless they are actually implemented.
- Emoji Kitchen currently combines a curated set of standard Unicode emoji using local Canvas composition and the user's browser/device emoji font. Do not describe it as Google Emoji Kitchen, do not scrape or republish Emoji Kitchen artwork, and do not imply that third-party catalog artwork is remixed by `/kitchen` unless a future implementation adds an explicitly licensed source.
- When extending Emoji Kitchen, prefer the existing local BeUI motion primitives in `src/components/motion/**` for controls before adding another UI library or creating duplicate primitives.

## Data branch rules

Import/sync workflows write catalog changes to `data`, not `main`.

```text
main = code / UI / scripts / workflows
data = src/data/** + public/emojis/**
```

Do not require feature PRs for routine automated writes to `data` if doing so would break the import/sync workflows. Protect `data` from deletion and force pushes while preserving the workflow's direct-write path.
