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

## Data branch rules

Import/sync workflows write catalog changes to `data`, not `main`.

```text
main = code / UI / scripts / workflows
data = src/data/** + public/emojis/**
```

Do not require feature PRs for routine automated writes to `data` if doing so would break the import/sync workflows. Protect `data` from deletion and force pushes while preserving the workflow's direct-write path.
