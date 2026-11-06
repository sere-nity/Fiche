"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { citedCardIds } from "./essay";

const QuestionSchema = z.string().trim().min(5, "Type the question you'll write on.").max(300);
const BodySchema = z.string().max(20000);
const EssayIdSchema = z.string().uuid();

export type StartEssayState = { error?: string };

export async function startEssay(_previous: StartEssayState, formData: FormData): Promise<StartEssayState> {
    const learner = await getLearner();
    if (!learner) {
        redirect("/sign-in?next=/write");
    }

    const parsed = QuestionSchema.safeParse(formData.get("question"));
    if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
    }

    const [essay] = await getDb()
        .insert(schema.essays)
        .values({ learnerId: learner.id, question: parsed.data })
        .returning({ id: schema.essays.id });
    redirect(`/write/${essay.id}`);
}

export async function saveEssayBody(essayId: string, body: string): Promise<{ ok: boolean }> {
    const learner = await getLearner();
    const parsed = BodySchema.safeParse(body);
    if (!learner || !parsed.success || !EssayIdSchema.safeParse(essayId).success) {
        return { ok: false };
    }

    const saved = await getDb().transaction(async (transaction) => {
        const [essay] = await transaction.select({ body: schema.essays.body }).from(schema.essays)
            .where(and(eq(schema.essays.id, essayId), eq(schema.essays.learnerId, learner.id)))
            .for("update");
        if (!essay) {
            return false;
        }
        if (essay.body === parsed.data) {
            return true;
        }
        await transaction.update(schema.essays)
            .set({ body: parsed.data, feedback: null, submittedAt: null })
            .where(eq(schema.essays.id, essayId));
        const cards = await transaction
            .select({ id: schema.cards.id, title: schema.cards.title })
            .from(schema.cards)
            .where(eq(schema.cards.learnerId, learner.id));
        await transaction.delete(schema.citations).where(eq(schema.citations.essayId, essayId));
        const cited = citedCardIds(parsed.data, cards);
        if (cited.length > 0) {
            await transaction.insert(schema.citations).values(cited.map((cardId) => ({ essayId, cardId })));
        }
        return true;
    });

    if (saved) {
        // Shelf counts ("unused") change as cards get cited.
        revalidatePath("/", "layout");
    }
    return { ok: saved };
}
