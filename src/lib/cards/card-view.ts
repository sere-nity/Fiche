import type { UIMessage } from "ai";
import type { schema } from "@/db";

export type CardLink = { cardId: string; sourceId: string };

export type CardView = {
    id: string;
    kind: "quote" | "synthesis";
    title: string;
    gist: string;
    quote: string | null;
    quotePrefix: string | null;
    quoteSuffix: string | null;
    textSlug: string | null;
    typedSource: string | null;

    position: { x: number; y: number } | null;
    chat: UIMessage[];
};

export function toCardView(row: typeof schema.cards.$inferSelect): CardView {
    return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        gist: row.gist,
        quote: row.quote,
        quotePrefix: row.quotePrefix,
        quoteSuffix: row.quoteSuffix,
        textSlug: row.textSlug,
        typedSource: row.typedSource,
        position: row.position ?? null,
        chat: row.chat ?? [],
    };
}
