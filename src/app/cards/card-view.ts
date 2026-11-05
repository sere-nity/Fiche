import type { schema } from "@/db";

/** The fields the browser needs for a card. Sent from server to client components. */
export type CardView = {
  id: string;
  title: string;
  gist: string;
  quote: string | null;
  quotePrefix: string | null;
  quoteSuffix: string | null;
  textSlug: string | null;
  typedSource: string | null;
  gistCheck: "faithful" | "partly" | "no" | "unchecked";
  gistCheckReason: string | null;
};

export function toCardView(row: typeof schema.cards.$inferSelect): CardView {
  return {
    id: row.id,
    title: row.title,
    gist: row.gist,
    quote: row.quote,
    quotePrefix: row.quotePrefix,
    quoteSuffix: row.quoteSuffix,
    textSlug: row.textSlug,
    typedSource: row.typedSource,
    gistCheck: row.gistCheck,
    gistCheckReason: row.gistCheckReason,
  };
}
