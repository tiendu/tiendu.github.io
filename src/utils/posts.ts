import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export function getPostSlug(post: BlogPost): string {
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

export function getPostLabels(post: BlogPost): string[] {
  return post.data.tags.length > 0 ? post.data.tags : post.data.categories;
}

export function readingTime(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

