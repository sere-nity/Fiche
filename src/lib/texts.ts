import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../../data/texts/manifest.json";
import { parseBook, type Block } from "./book";

/**
 * The six books are static content shipped with the app: data/texts/<slug>.md
 * plus this manifest. They never go in the database.
 */
export type TextMeta = {
  slug: string;
  title: string;
  author: string;
  year: number;
  translator: string | null;
  source: string;
  themes: string[];
};

export const TEXTS: TextMeta[] = manifest;

export function getTextMeta(slug: string): TextMeta | undefined {
  return TEXTS.find((t) => t.slug === slug);
}

/** A book's paragraphs. Cached: the files never change while the app runs. */
export async function getBook(slug: string): Promise<Block[]> {
  "use cache";
  if (!getTextMeta(slug)) throw new Error(`Unknown text: ${slug}`);
  const md = await readFile(path.join(process.cwd(), "data/texts", `${slug}.md`), "utf8");
  return parseBook(md);
}
