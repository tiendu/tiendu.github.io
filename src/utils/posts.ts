import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export function getPostSlug(post: BlogPost): string {
  if (post.data.urlSlug) return post.data.urlSlug;

  const id = post.id.split("/").pop() ?? post.id;
  return id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export function getPostRoute(post: BlogPost): string {
  const year = post.data.date.getUTCFullYear();
  const month = String(post.data.date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(post.data.date.getUTCDate()).padStart(2, "0");

  return `/${year}/${month}/${day}/${getPostSlug(post)}.html`;
}

export function getPostRouteParts(post: BlogPost) {
  const date = post.data.date;

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
    slug: getPostSlug(post),
  };
}

export function slugifyLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getTopicRoute(topic: string): string {
  return `/topics/${slugifyLabel(topic)}/`;
}

export function wordCount(body: string): number {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingTime(body: string): number {
  return Math.max(1, Math.ceil(wordCount(body) / 200));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCompactDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .replaceAll("-", ".");
}

export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export function getRelatedPosts(
  currentPost: BlogPost,
  posts: BlogPost[],
  limit = 3,
): BlogPost[] {
  const currentKeywords = new Set(
    currentPost.data.keywords.map((keyword) => slugifyLabel(keyword)),
  );

  return posts
    .filter((post) => post.id !== currentPost.id && !post.data.draft)
    .map((post) => {
      const sharedKeywords = post.data.keywords.reduce(
        (count, keyword) =>
          count + (currentKeywords.has(slugifyLabel(keyword)) ? 1 : 0),
        0,
      );
      const topicMatch = post.data.topic === currentPost.data.topic ? 4 : 0;

      return { post, score: topicMatch + sharedKeywords * 2 };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.data.date.valueOf() - a.post.data.date.valueOf(),
    )
    .slice(0, limit)
    .map(({ post }) => post);
}
