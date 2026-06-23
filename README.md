# tiendu.github.io

Astro-based source for <https://tiendu.github.io>.

## Development

```bash
npm install
npm run dev
```

Run the production checks before pushing:

```bash
npm run check
npm run build
```

## Posts

Place Markdown posts in `src/content/blog/`. Existing Jekyll-style frontmatter is supported:

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

## Static downloads

Files in `public/` are copied to the built site unchanged. Downloadable scripts and generated GIFs remain under:

```text
public/assets/scripts/
public/assets/images/
```

## Deployment

The workflow in `.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages. In the repository settings, set **Pages → Source** to **GitHub Actions**.
