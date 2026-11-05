import "server-only";
import { cache } from "react";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type ShelfCount = { total: number; unused: number };

export const getShelfCounts = cache(async (learnerId: string): Promise<Record<string, ShelfCount>> => {
    const { cards, citations } = schema;
    const rows = await getDb()
        .select({
            slug: cards.textSlug,
            total: sql<number>`count(*)::int`,
            unused: sql<number>`(count(*) filter (where not exists (select 1 from ${citations} where ${citations.cardId} = ${cards.id})))::int`,
        })
        .from(cards)
        .where(and(eq(cards.learnerId, learnerId), isNotNull(cards.textSlug)))
        .groupBy(cards.textSlug);
    return Object.fromEntries(rows.map((row) => [row.slug!, { total: row.total, unused: row.unused }]));
});
