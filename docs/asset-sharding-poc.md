# POC: sharded emoji assets on GitHub Pages

## Why this exists

The production Pages deploy currently builds a single artifact that includes the entire `public/emojis` catalog. The artifact has grown to about 5.3 GB, which is too large for a normal GitHub Pages deployment.

This POC explores keeping the UI site on the existing GitHub Pages deployment while moving emoji binaries into several independent Pages sites.

Nothing in this PR changes the production deploy or current emoji URLs.

## Proposed shape

Keep the UI in the current repository:

- `emoji.eplus.dev` -> HTML, CSS, JS, search metadata, detail pages

Split binary assets into 8 repositories/sites:

- `emoji-assets-01` -> `assets-01.emoji.eplus.dev`
- `emoji-assets-02` -> `assets-02.emoji.eplus.dev`
- `emoji-assets-03` -> `assets-03.emoji.eplus.dev`
- `emoji-assets-04` -> `assets-04.emoji.eplus.dev`
- `emoji-assets-05` -> `assets-05.emoji.eplus.dev`
- `emoji-assets-06` -> `assets-06.emoji.eplus.dev`
- `emoji-assets-07` -> `assets-07.emoji.eplus.dev`
- `emoji-assets-08` -> `assets-08.emoji.eplus.dev`

With the current catalog size, 8 shards should average roughly 650-700 MB each. The actual sizes should be measured with the planner before creating any repositories.

## Stable shard assignment

`scripts/asset-shards.mjs` assigns each relative asset path to a shard using:

```text
sha256(relative/path) -> first 32 bits -> modulo shard count -> 1-based shard
```

The important property is that an existing asset remains on the same shard as long as the shard count remains unchanged.

Do not change the production shard count after rollout without a migration plan, because modulo-based assignment would move many existing files.

## Measure the current distribution

```bash
npm run assets:shards -- --count 8 --report .tmp/emoji-shards.json
```

Example output:

```text
Emoji asset shard plan: 197,379 files, 5.3 GB, 8 shards

Shard  Files       Size
-----  ----------  ----------
01         24,xxx      xxx MB
02         24,xxx      xxx MB
...
```

The report only contains counts and byte totals. It does not copy emoji files.

## Export one shard for a real test

```bash
npm run assets:shards -- \
  --count 8 \
  --export-shard 1 \
  --out .tmp/emoji-assets-01
```

The output is Pages-ready:

```text
.tmp/emoji-assets-01/
├── .nojekyll
├── shard.json
└── emojis/
    └── ...
```

That folder can be published to a temporary repository to measure actual Pages behavior before any production migration.

## Suggested deployment flow

The source repository remains the source of truth for imports.

```text
import new emoji
      |
      v
public/emojis/<path>
      |
      v
stable shard(path)
      |
      +--> shard 01 repo/site
      +--> shard 02 repo/site
      +--> ...
      +--> shard 08 repo/site
```

A future deployment workflow should determine which asset paths changed, calculate their shard number, and update only those destination repositories.

The default `GITHUB_TOKEN` from this repository cannot be treated as a general cross-repository write credential. For cross-repository publishing, use either:

1. a GitHub App installed only on the asset repositories, or
2. a fine-grained token limited to `Contents: write` on those repositories.

A GitHub App is preferable for a long-lived production setup.

## URL migration options

### Option A: expose shard hostnames directly

An emoji currently referenced as:

```text
https://emoji.eplus.dev/emojis/example.gif
```

would become something like:

```text
https://assets-03.emoji.eplus.dev/emojis/example.gif
```

This is the simplest setup and needs no Worker/proxy.

### Option B: preserve the existing public URL

Keep:

```text
https://emoji.eplus.dev/emojis/example.gif
```

but route `/emojis/*` through a proxy/CDN layer to the correct shard host.

This preserves old links but adds routing infrastructure, so it is outside this first POC.

## Recommended experiment before implementation

1. Run the shard report and verify every shard stays comfortably below the Pages size ceiling.
2. Create only one temporary asset repository, for example `emoji-assets-poc`.
3. Export shard 1 and publish it there.
4. Test static files, GIFs, cache headers, bandwidth behavior, and custom-domain DNS.
5. Only after that, decide whether to create all 8 repositories.
6. Add a URL resolver behind a feature flag before changing production URLs.
7. Finally remove `public/emojis` from the main Pages artifact.

## What this PR intentionally does not do

- does not modify `.github/workflows/deploy-pages.yml`
- does not delete or move `public/emojis`
- does not create asset repositories
- does not change production DNS
- does not change existing emoji URLs
- does not require `gh-pages`

The goal is to make the storage split measurable and reproducible before touching production.
