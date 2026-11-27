export const SITE = {
  title: "Tien's Notes",
  shortTitle: "Tien's Notes",
  description:
    "Engineering notes, small projects, games, and occasional thoughts on life.",
  author: "Tien Du",
  url: "https://tiendu.github.io",
  email: "mailto:tiendu107@gmail.com",
  github: "https://github.com/tiendu",
  language: "en",
} as const;

export const PRIMARY_NAVIGATION = [
  { key: "posts", href: "/posts/", label: "POSTS", index: "01" },
  { key: "games", href: "/games/", label: "GAMES", index: "02" },
  { key: "about", href: "/about/", label: "ABOUT", index: "03" },
] as const;

export type NavigationKey = (typeof PRIMARY_NAVIGATION)[number]["key"];

export const CONTACT_LINKS = [
  { href: SITE.email, label: "EMAIL", external: false },
  { href: SITE.github, label: "GITHUB", external: true },
] as const;

export function getSystemRevision(date = new Date()): string {
  return date
    .toLocaleString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}
