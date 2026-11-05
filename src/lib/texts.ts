import manifest from "../../data/texts/manifest.json";

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
