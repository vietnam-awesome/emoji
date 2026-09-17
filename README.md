# Emoji data branch

This branch is the data plane for the emoji catalog.

Authoritative paths:

- `src/data/**` — emoji metadata, catalog shards, categories and sync state
- `public/emojis/**` — emoji binary assets

Application code, UI and GitHub Actions live on `main`. Import workflows use code from `main` while committing data changes only to this branch.
