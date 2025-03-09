import { defineConfig } from 'astro/config';
import preact from "@astrojs/preact";
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    site: 'https://tiendu.github.io',
    integrations: [
        preact(),
        mdx(),
        sitemap(),
    ]
});
