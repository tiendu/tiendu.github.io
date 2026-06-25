export const SITE = {
  title: "Tien's notes",
  description:
    "Notes on platform operations, reliability, automation, scientific software, and engineering.",
  author: "Tien Du",
  email: "mailto:tiendu107@gmail.com",
  github: "https://github.com/tiendu",
  linkedin: "https://www.linkedin.com/in/tienhdu",
} as const;

export const PRIMARY_NAVIGATION = [
  { key: "posts", href: "/posts/", label: "POSTS", index: "01" },
  { key: "projects", href: "/projects/", label: "PROJECTS", index: "02" },
  { key: "tags", href: "/tags/", label: "TAGS", index: "03" },
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
