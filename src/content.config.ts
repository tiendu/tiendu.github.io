import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const stringList = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string()));

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.{md,mdx}",
  }),
  schema: z.looseObject({
      title: z.string(),
      date: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      description: z.string().optional(),
      categories: stringList,
      tags: stringList,
      pinned: z.boolean().default(false),
      draft: z.boolean().default(false),
      layout: z.string().optional(),
      permalink: z.string().optional(),
    }),
});

export const collections = { blog };
