# Stylesheet architecture

The site uses external CSS only. Astro components own markup and behavior; styles
live under `src/styles/` so the cascade is visible, searchable, and testable.

## Ownership

```text
src/styles/
├── tokens.css                 Shared colors, fonts, and primitive values
├── global.css                 Reset, accessibility, and global layout helpers
├── system.css                 Import manifest for the dark system interface
├── system/                    Header, archives, projects, topics, and breakpoints
├── article.css                Import manifest for article pages
├── article/                   Reader, discovery, desktop, and article UX rules
├── pages/home.css             Import manifest for the terminal homepage
├── pages/home/                Homepage frame, shell, games, footer, responsiveness
└── components/                Styles owned by individual reusable components
```

The manifest files are intentionally small. Their import order defines cascade
order, so rules should be moved into the narrowest ownership file rather than
added to the end of a large catch-all stylesheet.

## Loading boundaries

- `BaseLayout.astro` loads only `tokens.css` and `global.css`.
- `SystemPageLayout.astro` loads `system.css`.
- `PostLayout.astro` loads `system.css` and `article.css`.
- `index.astro` loads `system.css` and `pages/home.css`.
- Game components import `components/arcade.css` plus their own variant file.

This avoids coupling every page to every stylesheet while retaining deterministic
cascade order.

## Rules for future changes

1. Put raw reusable values in `tokens.css`; do not scatter new hex values across
   unrelated files unless the value is truly component-specific.
2. Put a rule in the narrowest file that owns the rendered markup.
3. Keep selectors class-based and locally named. Component selectors should use
   a clear prefix such as `.snake-`, `.post-`, or `.system-`.
4. Do not add `<style>` blocks or `style="..."` attributes to Astro files.
5. Keep stylesheet manifests as imports and comments only.
6. Do not casually reorder manifest imports; later files may intentionally refine
   earlier declarations.
7. Split a stylesheet before it grows beyond 500 lines.
8. Run `make verify` before pushing.

## Automated guard

```bash
npm run check:styles
```

The check fails when it finds:

- embedded `<style>` blocks;
- inline style attributes;
- missing CSS imports;
- orphaned files under `src/styles/`;
- Astro `:global()` syntax in external CSS;
- a stylesheet larger than 500 lines.

Astro's normal build remains the final CSS syntax and bundling validation.
