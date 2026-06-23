import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
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
    const description = post.data.description ?? "A note by Tien Du.";

    return `
      <item>
        <title>${escapeXml(post.data.title)}</title>
        <link>${url}</link>
        <guid>${url}</guid>
        <pubDate>${post.data.date.toUTCString()}</pubDate>
        <description>${escapeXml(description)}</description>
      </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>Tien's notes</title>
        <link>${site.href}</link>
        <description>Notes on platform operations, reliability, automation, scientific software, and engineering.</description>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
