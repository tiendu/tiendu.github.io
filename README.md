# tiendu.github.io

Astro source for <https://tiendu.github.io>.

The site uses three related interfaces:

- `/` — full-screen interactive terminal with small retro games
- `/posts/`, `/projects/`, `/topics/`, `/about/` — a shared minimal dark interface
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
├── components/       Shared UI, topic archives, and game components
├── config/           Site metadata and navigation
├── content/blog/     Markdown posts
├── data/             Project and topic data
├── layouts/          Base, system-page, and article layouts
├── pages/            Astro routes
├── styles/           Layered external styles and import manifests
└── utils/            Post routing, related-post, and formatting helpers
```

## Styles

Styles are externalized under `src/styles/` and loaded by the page or layout that
owns them. Run the architecture guard directly with:

```bash
npm run check:styles
```

`make verify` includes this check. See [`docs/STYLES.md`](docs/STYLES.md) for the
ownership map and maintenance rules.

## Posts

Place Markdown posts in `src/content/blog/`. Use descriptive source filenames and
this frontmatter format:

```yaml
---
title: "Diagnosing Intermittent Production Failures: An SRE Playbook"
date: 2026-02-23
description: "A specific one- or two-sentence summary of the problem and what the article teaches."
topic: "Reliability & Operations"
keywords:
  - "SRE"
  - "production debugging"
  - "observability"
urlSlug: "sre-playbook"
pinned: false
---
```

Each post has exactly one public `topic`. Use `keywords` only for related-post
matching and search metadata; they do not create public archive pages.

`urlSlug` controls the public URL independently of the Markdown filename. This
allows source files to be renamed without breaking indexed pages or backlinks.
For existing posts, do not change `urlSlug` casually.

Post URLs retain the legacy format:

```text
/YYYY/MM/DD/url-slug.html
```

The build runs `scripts/fix-html-routes.mjs` after Astro so legacy `.html`
routes are emitted as files rather than directories.

## Search metadata

The build generates:

- canonical URLs
- unique descriptions for every post
- Open Graph and article metadata
- `Person`, `WebSite`, `BlogPosting`, `CollectionPage`, and breadcrumb JSON-LD
- one curated topic directory and topic archive pages
- related-post links
- RSS
- `robots.txt`
- `sitemap-index.xml` and `sitemap-0.xml`

Keywords remain internal metadata, so readers see one predictable navigation system instead of overlapping category and tag archives.

After deploying, submit `https://tiendu.github.io/sitemap-index.xml` in Google
Search Console and inspect the most important post URLs.

## Static files

Files in `public/` are copied to the built site unchanged. Downloadable scripts,
images, favicons, and `robots.txt` live there.

## Deployment

`.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages.
Repository settings should use **Pages → Source → GitHub Actions**.

