export const SITE = {
  title: "Tien Du's Engineering Notes",
  shortTitle: "Tien's notes",
  description:
    "Practical notes on platform operations, reliability, infrastructure, software engineering, bioinformatics, and scientific computing.",
  author: "Tien Du",
  role: "Platform Operations Engineer",
  url: "https://tiendu.github.io",
  email: "mailto:tiendu107@gmail.com",
  github: "https://github.com/tiendu",
  linkedin: "https://www.linkedin.com/in/tienhdu",
  language: "en",
} as const;

export const PRIMARY_NAVIGATION = [
  { key: "posts", href: "/posts/", label: "POSTS", index: "01" },
  { key: "projects", href: "/projects/", label: "PROJECTS", index: "02" },
  { key: "topics", href: "/topics/", label: "TOPICS", index: "03" },
  { key: "about", href: "/about/", label: "ABOUT", index: "04" },
] as const;

export type NavigationKey = (typeof PRIMARY_NAVIGATION)[number]["key"];

export const CONTACT_LINKS = [
  { href: SITE.email, label: "EMAIL", external: false },
  { href: SITE.github, label: "GITHUB", external: true },
  { href: SITE.linkedin, label: "LINKEDIN", external: true },
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
