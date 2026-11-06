import "server-only";
import type { UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function saveCardChat(cardId: string, learnerId: string, messages: UIMessage[]): Promise<void> {
    await getDb()
        .update(schema.cards)
        .set({ chat: messages })
        .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learnerId)));
}
