import type { schema } from "@/db";

export type CardView = {
    id: string;
    title: string;
    gist: string;
    quote: string | null;
    quotePrefix: string | null;
    quoteSuffix: string | null;
    textSlug: string | null;
    typedSource: string | null;

    position: { x: number; y: number } | null;
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
        position: row.position ?? null,
    };
}
