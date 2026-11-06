"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { UIMessage } from "ai";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { getTextMeta } from "@/lib/texts";
import { ChatMessagesSchema } from "@/lib/chat/instructions";
import { toCardView, type CardView } from "./card-view";
import { SourceIdsSchema, wouldCreateCycle } from "./links";

const refreshPages = () => revalidatePath("/", "layout");

export type ActionResult = { ok: true; card: CardView } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

const MAX_QUOTE_WORDS = 60;
const PositionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
function wordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

const SaveQuoteCardSchema = z
    .object({
        title: z.string().trim().max(80).optional(),
        gist: z.string().trim().min(1, "Write the gist in one sentence.").max(400),

        // Preserve the exact reader selection for highlight matching.
        quote: z.string().min(1).max(1200),

        textSlug: z.string().refine((slug) => Boolean(getTextMeta(slug)), "Choose a passage from a book."),
        quotePrefix: z.string().max(64).optional(),
        quoteSuffix: z.string().max(64).optional(),

        position: PositionSchema.optional(),

        chat: ChatMessagesSchema.optional(),
    })
    .refine((data) => wordCount(data.quote) <= MAX_QUOTE_WORDS, {
        message: `Keep quotes under ${MAX_QUOTE_WORDS} words: pick the line that carries the idea.`,
    });

export type SaveQuoteInput = Omit<z.input<typeof SaveQuoteCardSchema>, "chat"> & { chat?: UIMessage[] };

export async function saveQuoteCard(input: SaveQuoteInput): Promise<ActionResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in to save cards." };
    }

    const parsed = SaveQuoteCardSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    const [card] = await getDb()
        .insert(schema.cards)
        .values({
            learnerId: learner.id,
            kind: "quote",
            title: data.title || titleFrom(data.gist),
            gist: data.gist,
            quote: data.quote,
            textSlug: data.textSlug,
            quotePrefix: data.quotePrefix ?? "",
            quoteSuffix: data.quoteSuffix ?? "",
            position: data.position ? { x: Math.round(data.position.x), y: Math.round(data.position.y) } : null,
            chat: data.chat?.length ? (data.chat as UIMessage[]) : null,
        })
        .returning();
    refreshPages();
    return { ok: true, card: toCardView(card) };
}

const UpdateQuoteCardSchema = z.object({
    gist: z.string().trim().min(1, "Write the gist in one sentence.").max(400),
    title: z.string().trim().max(80).optional(),
});

export type UpdateQuoteInput = z.input<typeof UpdateQuoteCardSchema>;

const SaveSynthesisSchema = z.object({
    sourceIds: SourceIdsSchema,
    gist: z.string().trim().min(1, "Write the link in one sentence.").max(400),
    title: z.string().trim().max(80).optional(),
    position: PositionSchema,
    chat: ChatMessagesSchema.optional(),
});

export type SaveSynthesisInput = Omit<z.input<typeof SaveSynthesisSchema>, "chat"> & { chat?: UIMessage[] };

export async function saveSynthesisCard(input: SaveSynthesisInput): Promise<ActionResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in to save links." };
    }
    const parsed = SaveSynthesisSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;
    const sourceIds = data.sourceIds;

    const card = await getDb().transaction(async (transaction) => {
        const owned = await transaction
            .select({ id: schema.cards.id })
            .from(schema.cards)
            .where(and(inArray(schema.cards.id, sourceIds), eq(schema.cards.learnerId, learner.id)));
        if (owned.length !== sourceIds.length) {
            return null;
        }
        const [synthesis] = await transaction
            .insert(schema.cards)
            .values({
                learnerId: learner.id,
                kind: "synthesis",
                gist: data.gist,
                title: data.title || titleFrom(data.gist),
                position: { x: Math.round(data.position.x), y: Math.round(data.position.y) },
                chat: data.chat?.length ? (data.chat as UIMessage[]) : null,
            })
            .returning();
        await transaction
            .insert(schema.cardSources)
            .values(sourceIds.map((sourceId) => ({ cardId: synthesis.id, sourceId })));
        return synthesis;
    });

    if (!card) {
        return { ok: false, error: "Some of those cards weren't found." };
    }
    refreshPages();
    return { ok: true, card: toCardView(card) };
}

export async function updateQuoteCard(
    cardId: string,
    input: UpdateQuoteInput,
): Promise<ActionResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in first." };
    }
    const parsed = UpdateQuoteCardSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0].message };
    }

    const [card] = await getDb()
        .update(schema.cards)
        .set({
            gist: parsed.data.gist,
            title: parsed.data.title || titleFrom(parsed.data.gist),
        })
        .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id)))
        .returning();
    if (!card) {
        return { ok: false, error: "Card not found." };
    }
    refreshPages();
    return { ok: true, card: toCardView(card) };
}

function titleFrom(gist: string): string {
    const words = gist.replace(/[.,;:!?]+$/, "").split(/\s+/);
    return words.length <= 6 ? words.join(" ") : `${words.slice(0, 6).join(" ")}…`;
}

const AddSourceSchema = z.object({
    cardId: z.string().uuid(),
    sourceId: z.string().uuid(),
});

export async function addSource(cardId: string, sourceId: string): Promise<ActionResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in to save links." };
    }
    const parsed = AddSourceSchema.safeParse({ cardId, sourceId });
    if (!parsed.success) {
        return { ok: false, error: "Choose two different cards." };
    }
    const result = await getDb().transaction(async (transaction): Promise<ActionResult> => {
        // Serialize source changes so simultaneous drops cannot create a cycle.
        await transaction.select({ id: schema.learners.id }).from(schema.learners)
            .where(eq(schema.learners.id, learner.id)).for("update");
        const owned = await transaction.select().from(schema.cards)
            .where(and(inArray(schema.cards.id, [cardId, sourceId]), eq(schema.cards.learnerId, learner.id)));
        const synthesis = owned.find((card) => card.id === cardId && card.kind === "synthesis");
        if (!synthesis || owned.length !== 2) {
            return { ok: false, error: "Choose a synthesis and a different card of your own." };
        }
        const links = await transaction
            .select({ cardId: schema.cardSources.cardId, sourceId: schema.cardSources.sourceId })
            .from(schema.cardSources)
            .innerJoin(schema.cards, eq(schema.cards.id, schema.cardSources.cardId))
            .where(eq(schema.cards.learnerId, learner.id));
        const sources = links.filter((link) => link.cardId === cardId);
        if (sources.some((link) => link.sourceId === sourceId)) {
            return { ok: true, card: toCardView(synthesis) };
        }
        if (sources.length >= 12) {
            return { ok: false, error: "A synthesis can have up to 12 sources." };
        }
        if (wouldCreateCycle(links, cardId, sourceId)) {
            return { ok: false, error: "That would make the synthesis depend on itself." };
        }
        await transaction.insert(schema.cardSources).values({ cardId, sourceId });
        return { ok: true, card: toCardView(synthesis) };
    });
    if (result.ok) {
        refreshPages();
    }
    return result;
}

export async function moveCard(cardId: string, position: z.input<typeof PositionSchema>): Promise<{ ok: boolean }> {
    const learner = await getLearner();
    const parsed = PositionSchema.safeParse(position);
    if (!learner || !parsed.success || !z.string().uuid().safeParse(cardId).success) {
        return { ok: false };
    }
    const [card] = await getDb()
        .update(schema.cards)
        .set({ position: { x: Math.round(parsed.data.x), y: Math.round(parsed.data.y) } })
        .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id)))
        .returning({ id: schema.cards.id });
    return { ok: Boolean(card) };
}

export async function deleteSynthesisCards(cardIds: string[]): Promise<DeleteResult> {
    const learner = await getLearner();
    if (!learner) {
        return { ok: false, error: "Sign in to delete a synthesis." };
    }
    const parsed = z.array(z.string().uuid()).min(1).safeParse(cardIds);
    if (!parsed.success) {
        return { ok: false, error: "Choose the synthesis cards to delete." };
    }
    const ids = [...new Set(parsed.data)];
    const deleted = await getDb().transaction(async (transaction) => {
        const owned = await transaction.select({ id: schema.cards.id }).from(schema.cards)
            .where(and(inArray(schema.cards.id, ids), eq(schema.cards.learnerId, learner.id), eq(schema.cards.kind, "synthesis")))
            .for("update");
        if (owned.length !== ids.length) {
            return false;
        }
        await transaction.delete(schema.cards).where(inArray(schema.cards.id, ids));
        return true;
    });
    if (!deleted) {
        return { ok: false, error: "Those synthesis cards weren't found." };
    }
    refreshPages();
    return { ok: true };
}
