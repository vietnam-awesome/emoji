# POC: sharded emoji assets on GitHub Pages

## Why this exists

The production Pages deploy currently builds a single artifact that includes the entire `public/emojis` catalog. The artifact has grown to about 5.3 GB, which is too large for a normal GitHub Pages deployment.

This POC explores keeping the UI site on the existing GitHub Pages deployment while moving emoji binaries into several independent Pages sites.

Nothing in this PR changes the production deploy or current emoji URLs.

## Proposed shape

Keep the UI in the current repository:

- `emoji.eplus.dev` -> HTML, CSS, JS, search metadata, detail pages

Split binary assets into as many independent repositories/sites as the planner needs:

- `emoji-assets-01` -> `assets-01.emoji.eplus.dev`
- `emoji-assets-02` -> `assets-02.emoji.eplus.dev`
- `emoji-assets-03` -> `assets-03.emoji.eplus.dev`
- ...

The planner no longer requires a manually selected shard count. By default it targets at most 700 MB per shard and automatically increases the shard count until the largest hash-distributed shard is below that ceiling.

## Automatic shard sizing

Run:

```bash
npm run assets:shards -- --report .tmp/emoji-shards.json
```

The planner:

1. scans every file under `public/emojis`
2. sums the current byte size
3. starts with `ceil(total bytes / target bytes)` shards
4. assigns paths using deterministic SHA-256 hashing
5. checks the real byte size of every resulting shard
6. increases the shard count until every shard fits below the target

The default target is 700 MB. A different safety target can be selected without manually calculating the shard count:

```bash
npm run assets:shards -- --target-mb 650 --report .tmp/emoji-shards.json
```

An exact count is still supported for experiments or for pinning a production layout:

```bash
npm run assets:shards -- --count 8 --report .tmp/emoji-shards.json
```

## Stable shard assignment and production rollout

For a fixed shard count, `scripts/asset-shards.mjs` assigns each relative asset path using:

```text
sha256(relative/path) -> first 32 bits -> modulo shard count -> 1-based shard
```

That means an asset stays on the same shard while the shard count stays unchanged.

There is an important production caveat: changing the modulo shard count later, for example from 8 to 9, would move many existing files between shard hosts. Therefore automatic sizing is ideal for determining the initial layout, but a production rollout should either:

1. pin the selected count after the initial measurement and add a persistent assignment strategy before future expansion, or
2. keep the public `/emojis/*` URL behind a proxy/CDN so internal shard movement never changes public URLs.

A future production version should preserve existing assignments and place only new assets into shards with remaining capacity, creating a new shard only when required. That avoids rewriting old asset locations as the catalog grows.

## Example output

```text
Emoji asset shard plan: 197,379 files, 5.3 GB, 8 shards (auto-size, target <= 700 MB)

Shard  Files       Size
-----  ----------  ----------
01         24,xxx      xxx MB
02         24,xxx      xxx MB
...
```

The actual shard count may be higher than `ceil(total / target)` because file sizes are not evenly distributed by hash.

The report contains counts and byte totals. It does not copy emoji files.

## Export one shard for a real test

First run the report and use the automatically selected `shardCount`. Then export a shard with that count pinned so the export uses exactly the measured layout:

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
stable assignment
      |
      +--> shard 01 repo/site
      +--> shard 02 repo/site
      +--> shard 03 repo/site
      +--> ...
```

A future deployment workflow should determine which asset paths changed and update only the destination shard repositories that contain those paths.

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

This is the simplest setup and needs no Worker/proxy, but moving an existing asset to another shard would change its URL.

### Option B: preserve the existing public URL

Keep:

```text
https://emoji.eplus.dev/emojis/example.gif
```

but route `/emojis/*` through a proxy/CDN layer to the correct shard host.

This preserves old links even if internal shard placement changes, but adds routing infrastructure, so it is outside this first POC.

## Recommended experiment before implementation

1. Run the automatic shard report and verify the selected count and largest shard size.
2. Create only one temporary asset repository, for example `emoji-assets-poc`.
3. Export shard 1 using the selected count and publish it there.
4. Test static files, GIFs, cache headers, bandwidth behavior, and custom-domain DNS.
5. Only after that, decide whether to create all selected shard repositories.
6. Choose a persistent assignment strategy before allowing the shard count to grow in production.
7. Add a URL resolver behind a feature flag before changing production URLs.
8. Finally remove `public/emojis` from the main Pages artifact.

## What this PR intentionally does not do

- does not modify `.github/workflows/deploy-pages.yml`
- does not delete or move `public/emojis`
- does not create asset repositories
- does not change production DNS
- does not change existing emoji URLs
- does not require `gh-pages`

The goal is to make the storage split measurable and reproducible before touching production.
