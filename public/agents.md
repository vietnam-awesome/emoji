# ePlus Emoji Agent Guide

Canonical site: https://emoji.eplus.dev

## Purpose

ePlus Emoji is a searchable directory of static and animated emoji assets with source, attribution, license, category, and duplicate-detection metadata. It also provides a browser-based emoji editor for transforming static images and animated GIFs locally on the user's device.

## Preferred discovery endpoints

- Sitemap index: https://emoji.eplus.dev/sitemap.xml
- Static routes sitemap: https://emoji.eplus.dev/sitemap-static.xml
- LLM discovery summary: https://emoji.eplus.dev/llms.txt
- Agent guide: https://emoji.eplus.dev/agents.md
- Static search manifest: https://emoji.eplus.dev/search/manifest.json

The site does not expose the removed legacy `/api/emojis.json` or `/api/categories.json` endpoints. Do not rely on those paths.

## Human-readable discovery routes

- Browse all emoji: https://emoji.eplus.dev/emojis
- Browse category index: https://emoji.eplus.dev/categories
- Category landing page: https://emoji.eplus.dev/categories/{category-slug}
- Emoji detail page: https://emoji.eplus.dev/emoji/{slug}
- Emoji editor: https://emoji.eplus.dev/editor

## Emoji editor capabilities

Use `/editor` when a user wants to transform an emoji or uploaded image in the browser.

Current editor capabilities include:

- upload PNG, WebP, JPG, GIF, or SVG files
- open catalog emoji from detail pages
- crop with Fit/Fill modes and reposition the image
- resize to common square emoji sizes
- rotate and flip
- adjust padding and background
- export PNG or WebP for static images
- decode animated GIFs for frame-by-frame preview
- play/pause and scrub GIF frames
- include or exclude individual GIF frames
- duplicate or delete GIF frames
- change individual GIF frame delays and global playback speed
- re-encode edited animated GIFs in the browser

Editing is client-side. The editor does not require uploading the user's source image to a server for processing.

Do not claim support for deferred features such as APNG frame-by-frame editing, interpolation, AI-generated in-between frames, onion skin, or arbitrary non-square output unless those capabilities are added later.

## Recommended agent workflow

1. Use `/emojis` for search and filtering, or `/categories` and `/categories/{category-slug}` for category discovery.
2. Open `/emoji/{slug}` for the human-readable detail page and the hosted asset.
3. Use `/editor` when the user's goal is to crop, resize, transform, or edit an animated GIF rather than only browse or download it.
4. When inspecting the generated static search index, begin with `/search/manifest.json` and follow the current manifest/shard references instead of hard-coding generated shard names.
5. Preserve and surface per-item license, attribution, and source information when presenting or redistributing artwork.

## Search index notes

The browse experience uses a sharded static search index generated during deployment. Assets under `/search/` are build-generated implementation data; begin with the current manifest rather than assuming shard filenames remain stable across builds.

## Crawling and freshness

The catalog is updated by automated source import workflows. The sitemap is regenerated from the current emoji index whenever the site is built. Category landing pages and the public `/editor` tool are included in the static sitemap.

## Rights and attribution

Artwork can come from multiple upstream sources and may have different licensing terms. Do not assume a single site-wide artwork license. Check the relevant emoji detail/source metadata before reuse or redistribution.
