# Main / data branch architecture

## Goal

Keep UI/code deployments independent from the large emoji binary catalog while staying in one GitHub repository.

## Branch responsibilities

### `main`

Application plane only:

- Astro UI and components
- build/import/sync scripts
- GitHub Actions workflows
- tests and project configuration

Production UI jobs deliberately sparse-check out `main` without `public/emojis/**` and without the catalog copy under `src/data/**`.

### `data`

Data plane only:

- `src/data/**` — catalog metadata, JSON shards, categories and sync state
- `public/emojis/**` — binary emoji assets

Import/sync workflows execute the current scripts from `main` while their working directory is a sparse checkout of `data`. Commits therefore update only `data`.

## Asset URLs

The current POC serves binary files directly from the GitHub `data` branch:

```text
https://raw.githubusercontent.com/vietnam-awesome/emoji/data/public/emojis/<path>
```

The UI keeps storing normal `/emojis/...` asset paths in catalog records. `src/lib/emojiAsset.ts` applies the asset origin when rendering the final URL.

An alternate origin can be supplied with `EMOJI_ASSET_ORIGIN`. This intentionally makes it possible to put a CDN/proxy in front later without migrating catalog records.

jsDelivr was evaluated but is not used for this catalog: its GitHub package limits are far below the current multi-gigabyte repository size, and its documented soft file-count guidance is also below this catalog.

## UI deployment

`deploy-pages.yml` does not checkout the emoji binaries.

```text
main (code only)
       +
data:src/data (metadata only)
       |
       v
hydrate catalog -> static search -> Astro build
       |
       v
GitHub Pages artifact without public/emojis
```

This means a CSS/component/UI edit does not materialize or upload the multi-gigabyte emoji asset tree.

## Import flow

```text
main scripts                  data branch
    |                              |
    +------ execute against ------>|
                                   |
                            add/update emoji
                                   |
                            commit + push data
                                   |
                                   +--> dispatch UI deploy
```

The import job checks out only the source-specific asset subtree it needs, for example `public/emojis/community/emojigg/`, instead of materializing every emoji source.

## Turso

Turso synchronization reads metadata from `data:src/data/**`. Turso remains the query/search database; Git branch `data` remains the durable source of truth for the static catalog and assets.

## Migration state

The `data` branch was initialized from the current production catalog before switching the workflows. Existing catalog metadata and binaries are preserved there.

The current `main` history still contains the old data objects, because Git history is immutable. After this architecture is validated and merged, the tracked copies of `src/data/**` and `public/emojis/**` can be removed from the current `main` tree in a dedicated cleanup commit. That cleanup changes the visible `main` tree but does not rewrite repository history.

## Operational rules

1. UI/code changes go to `main`.
2. Emoji imports and catalog mutations go to `data` only.
3. UI deploys read metadata from `data`, never binary assets.
4. Binary URLs currently use the raw GitHub `data` branch; `EMOJI_ASSET_ORIGIN` allows a future CDN/proxy.
5. Data changes may dispatch a new UI build so new `/emoji/<slug>` static pages appear, but they do not create a commit on `main`.
6. Do not merge `data` back into `main`.
