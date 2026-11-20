import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { SITE } from "../config/site";
import { getPostRoute, sortPosts } from "../utils/posts";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error("The Astro site URL is required to generate the feed.");

  const posts = sortPosts(await getCollection("blog", ({ data }) => !data.draft));
  const items = posts.map((post) => {
    const url = new URL(getPostRoute(post), site).href;

    return `
      <item>
        <title>${escapeXml(post.data.title)}</title>
        <link>${url}</link>
        <guid isPermaLink="true">${url}</guid>
        <pubDate>${post.data.date.toUTCString()}</pubDate>
        <description>${escapeXml(post.data.description)}</description>
        <category>${escapeXml(post.data.topic)}</category>
      </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>${escapeXml(SITE.title)}</title>
        <link>${site.href}</link>
        <description>${escapeXml(SITE.description)}</description>
        <language>${SITE.language}</language>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
