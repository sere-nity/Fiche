"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { citedCardIds } from "./essay";
import { getTextMeta } from "@/lib/texts";
import type { Feedback } from "@/db/schema";
import { gradeEssay } from "./grading";
import { getEssayHistory } from "./history";
import { gradingCards, type CitationGrade } from "./rubric";

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

// Editing clears the old grade and refreshes the cited cards.
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

export type SubmitResult = { ok: true; feedback: Feedback; citations: CitationGrade[] } | { ok: false; error: string };

export async function submitEssay(essayId: string, body: string): Promise<SubmitResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in to submit an essay." };
    }
    if (!EssayIdSchema.safeParse(essayId).success || !BodySchema.safeParse(body).success || !body.trim()) {
        return { ok: false, error: "Write an essay before submitting (up to 20,000 characters)." };
    }
    try {
        const saved = await saveEssayBody(essayId, body);
        if (!saved.ok) {
            return { ok: false, error: "Couldn't save your essay. Try again." };
        }
        const [essay] = await getDb().select().from(schema.essays)
            .where(and(eq(schema.essays.id, essayId), eq(schema.essays.learnerId, learner.id)));
        const cards = await getDb().select().from(schema.cards).where(eq(schema.cards.learnerId, learner.id));
        const ids = citedCardIds(body, cards);
        if (essay.feedback && essay.body === body) {
            const citations = await getDb().select().from(schema.citations).where(eq(schema.citations.essayId, essayId));
            return { ok: true, feedback: essay.feedback, citations: citations.flatMap((citation) => citation.verdict && citation.reason
                ? [{ cardId: citation.cardId, verdict: citation.verdict, reason: citation.reason }] : []) };
        }
        const links = await getDb().select({ cardId: schema.cardSources.cardId, sourceId: schema.cardSources.sourceId })
            .from(schema.cardSources).innerJoin(schema.cards, eq(schema.cards.id, schema.cardSources.cardId))
            .where(eq(schema.cards.learnerId, learner.id));
        const context = gradingCards(ids, cards.map((card) => ({
            id: card.id, title: card.title, kind: card.kind, quote: card.quote, gist: card.gist,
            source: (card.textSlug ? getTextMeta(card.textSlug)?.author : card.typedSource) ?? "Your synthesis",
        })), links);
        const grade = await gradeEssay(essay.question, body, ids, context, await getEssayHistory(learner.id, essayId));
        const feedback = { rubric: grade.rubric, pattern: grade.pattern };
        const stored = await getDb().transaction(async (transaction) => {
            const [current] = await transaction.update(schema.essays).set({ feedback, submittedAt: new Date() })
                .where(and(eq(schema.essays.id, essayId), eq(schema.essays.learnerId, learner.id), eq(schema.essays.body, body)))
                .returning({ id: schema.essays.id });
            if (!current) {
                return false;
            }
            await transaction.delete(schema.citations).where(eq(schema.citations.essayId, essayId));
            if (grade.citations.length > 0) {
                await transaction.insert(schema.citations).values(grade.citations.map((citation) => ({ ...citation, essayId })));
            }
            return true;
        });
        if (!stored) {
            return { ok: false, error: "Your essay changed while it was being marked. Submit again." };
        }
        revalidatePath("/", "layout");
        return { ok: true, feedback, citations: grade.citations };
    } catch (error) {
        console.error("Essay marking failed:", error instanceof Error ? error.message : error);
        return { ok: false, error: "Couldn't finish marking. Your text is kept; please try again." };
    }
}
