import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function getEssayHistory(learnerId: string, excludeId?: string) {
    return getDb().select({
        question: schema.essays.question,
        body: schema.essays.body,
        feedback: schema.essays.feedback,
    }).from(schema.essays)
        .where(and(eq(schema.essays.learnerId, learnerId), excludeId ? ne(schema.essays.id, excludeId) : undefined))
        .orderBy(desc(schema.essays.startedAt))
        .limit(3);
}
