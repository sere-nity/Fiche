import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../../data/texts/manifest.json";
import { parseBook, type Block } from "./book";

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
    return TEXTS.find((text) => text.slug === slug);
}

export async function getBook(slug: string): Promise<Block[]> {
    "use cache";
    if (!getTextMeta(slug)) {
        throw new Error(`Unknown text: ${slug}`);
    }
    const markdown = await readFile(path.join(process.cwd(), "data/texts", `${slug}.md`), "utf8");
    return parseBook(markdown);
}
