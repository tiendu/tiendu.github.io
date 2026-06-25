# tiendu.github.io

Astro source for <https://tiendu.github.io>.

The site uses three related interfaces:

- `/` — full-screen interactive terminal with small retro games
- `/posts/`, `/projects/`, `/tags/`, `/about/` — a shared minimal dark interface
- individual posts — the same minimal chrome with a paper reading surface

## Development

```bash
make install
make hot
```

To expose the development server on the local network for phone testing:

```bash
make host
```

Run the production checks before pushing:

```bash
make verify
```

Build and preview the production output:

```bash
make preview
```

## Repository structure

```text
src/
├── components/       Shared UI and game components
├── config/           Site metadata and navigation
├── content/blog/     Markdown posts
├── data/             Structured project data
├── layouts/          Base, system-page, and article layouts
├── pages/            Astro routes
├── styles/           Global, system, and article styles
└── utils/            Post routing and formatting helpers
```

## Posts

Place Markdown posts in `src/content/blog/`. Use this frontmatter format:

```yaml
---
title: "Post title"
date: 2026-06-23
categories: ["Platform Engineering", "Personal Notes"]
pinned: false
---
```

Post URLs retain the legacy format:

```text
/YYYY/MM/DD/post-filename.html
```

The filename should normally remain `YYYY-MM-DD-post-filename.md`.

The build runs `scripts/fix-html-routes.mjs` after Astro so legacy `.html`
routes are emitted as files rather than directories.

## Static files

Files in `public/` are copied to the built site unchanged. Downloadable scripts,
images, and favicons live there.

## Deployment

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages.
Repository settings should use **Pages → Source → GitHub Actions**.
