# 😀 ePlus Emoji

An open, searchable emoji directory for developers and communities, inspired by the browsing experience of Slackmojis and Discadia while keeping source and license metadata first-class.

## Features

- Fast static site built with Astro.
- Search by name, shortcode, tag, category or source.
- Copy Slack/Discord-style shortcodes in one click.
- Individual emoji pages with download, source, license and attribution.
- Public JSON index at `/api/emojis.json`.
- Automated importers for upstream Unicode sources and selected custom-emoji directories.
- SHA-256 metadata for exact duplicate detection.
- Incremental GitHub Pages publishing through the `gh-pages` branch.
- Scheduled source sync workflows with configurable import limits.

## Current sources

| Source | Artwork license | Sync support |
| --- | --- | --- |
| OpenMoji | CC BY-SA 4.0 | Yes |
| Twemoji | CC BY 4.0 | Yes |
| Noto Emoji | OFL 1.1 | Yes |
| Emoji.gg | Per asset / source terms | Yes |
| Slackmojis | Source terms / rights vary | Yes |
| Discords.com | Source terms / rights vary | Yes |
| Community submissions | Per contribution | Planned / PR-based |

See [NOTICE.md](NOTICE.md) before redistributing artwork.

## Local development

```bash
npm install
npm run dev
```

Build and verify:

```bash
npm test
npm run check:data
npm run build
```

## Sync emoji assets

Import up to 200 new assets from each supported Unicode source:

```bash
npm run sync
```

Import 500 new OpenMoji assets:

```bash
npm run sync -- --source=openmoji --limit=500
```

Import 500 Noto Emoji assets:

```bash
npm run sync -- --source=noto --limit=500
```

Import every remaining supported Unicode asset:

```bash
npm run sync -- --source=all --limit=0
```

The sync script downloads SVG files into `public/emojis/<source>/`, merges metadata into `src/data/emojis.json`, and updates `public/api/emojis.json`. Existing local assets are skipped, so scheduled runs gradually fill the repository without re-downloading the same files.

## Import Slackmojis

Slackmojis is read directly from its public JSON catalog at `https://slackmojis.com/emojis.json`, including the asset URL, category, contributor credit, and timestamps.

Import the 200 newest missing records:

```bash
npm run import:slackmojis -- --mode=recent --limit=200
```

Import every missing record returned by the JSON catalog:

```bash
npm run import:slackmojis -- --mode=all --limit=0
```

The importer validates downloaded PNG/GIF/WebP/JPEG bytes before writing anything, stores files in `public/emojis/community/slackmojis/`, and deduplicates exact assets by SHA-256.

## Import Discords.com

Discords.com exposes emoji previews from Discord's CDN on `https://discords.com/emoji-list` and tag pages. The importer scans only `cdn.discordapp.com/emojis/...` / `media.discordapp.net/emojis/...` assets and ignores unrelated site images.

Import up to 200 emoji from the home/trending page:

```bash
npm run import:discords -- --tag=home --limit=200
```

Import a specific tag:

```bash
npm run import:discords -- --tag=Pepe --limit=500 --max-pages=10
```

`--tag=all` first discovers public tag links from the emoji-list page and then scans them within the configured page and item limits.

## Data schema

Each record contains fields such as:

```json
{
  "id": "openmoji-1f600",
  "slug": "openmoji-grinning-face-1f600",
  "name": "Grinning Face",
  "shortcode": "grinning_face",
  "emoji": "😀",
  "hexcode": "1F600",
  "group": "smileys-emotion",
  "tags": ["happy", "smile"],
  "source": "openmoji",
  "image": "/emojis/openmoji/1F600.svg",
  "license": "CC-BY-SA-4.0",
  "attribution": "OpenMoji"
}
```

## GitHub Pages

The website uses the custom domain:

`https://emoji.eplus.dev`

Production publishing is incremental. The workflow builds Astro without checking out `public/emojis`, creates the generated HTML/CSS/JS tree, then reuses the existing Git tree at `main:public/emojis` as `gh-pages:emojis`. This avoids packaging and uploading the multi-gigabyte emoji catalog every time a UI file changes.

The publisher has two modes:

- `site`: used for source/UI/data changes. Astro and the static search index are rebuilt, but emoji binaries are not materialized into `dist`.
- `assets`: used when a push changes only `public/emojis/**`. The workflow updates only the `emojis` subtree on `gh-pages` and skips Node installation and the Astro build entirely.

After the migration is merged and the first `gh-pages` commit has been prepared, perform the one-time repository setting change **Settings → Pages → Source: Deploy from a branch → `gh-pages` → `/(root)`**. GitHub does not allow the normal workflow `GITHUB_TOKEN` to change this repository administration setting.

The workflow writes `.nojekyll`, preserves `CNAME`, checks whether branch-based Pages is active, and explicitly requests a Pages build on later pushes because pushes made with `GITHUB_TOKEN` do not trigger a branch-based Pages build by themselves.

PR previews remain separate and intentionally use a representative catalog sample plus production-hosted emoji assets.

## Adding another source

For upstream Unicode projects, prefer sources with an explicit redistribution license and add them through `scripts/lib/sources.mjs` plus `scripts/lib/source-assets.mjs`. Custom-directory importers should keep source URLs and rights metadata on every record and validate asset bytes before writing files.

## License

Repository code: MIT.

Emoji artwork: upstream licenses and source-specific terms; see [NOTICE.md](NOTICE.md).
