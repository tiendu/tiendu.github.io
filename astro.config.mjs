import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://tiendu.github.io",
  output: "static",
  trailingSlash: "ignore",
  integrations: [
    sitemap({
      filter(page) {
        return !page.includes("/tags/") && !page.includes("/categories/");
      },
      serialize(item) {
        return {
          ...item,
          url: item.url.replace(/\.html\/$/, ".html"),
        };
      },
    }),
  ],
});
