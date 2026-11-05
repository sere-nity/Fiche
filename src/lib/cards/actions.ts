"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { getTextMeta } from "@/lib/texts";
import { toCardView, type CardView } from "./card-view";

const refreshPages = () => revalidatePath("/", "layout");

export type ActionResult = { ok: true; card: CardView } | { ok: false; error: string };

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

        textSlug: z.string().optional(),
        quotePrefix: z.string().max(64).optional(),
        quoteSuffix: z.string().max(64).optional(),

        typedSource: z.string().trim().max(200).optional(),

        position: PositionSchema.optional(),
    })
    .refine((data) => wordCount(data.quote) <= MAX_QUOTE_WORDS, {
        message: `Keep quotes under ${MAX_QUOTE_WORDS} words: pick the line that carries the idea.`,
    })
    .refine((data) => (data.textSlug ? Boolean(getTextMeta(data.textSlug)) : Boolean(data.typedSource)), {
        message: "Say where the quote comes from.",
    });

export type SaveQuoteInput = z.input<typeof SaveQuoteCardSchema>;

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
            quote: data.textSlug ? data.quote : data.quote.trim(),
            textSlug: data.textSlug ?? null,
            quotePrefix: data.textSlug ? (data.quotePrefix ?? "") : null,
            quoteSuffix: data.textSlug ? (data.quoteSuffix ?? "") : null,
            typedSource: data.textSlug ? null : data.typedSource,
            position: data.position ? { x: Math.round(data.position.x), y: Math.round(data.position.y) } : null,
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

export async function moveCard(cardId: string, position: z.input<typeof PositionSchema>): Promise<{ ok: boolean }> {
    const learner = await getLearner();
    const parsed = PositionSchema.safeParse(position);
    if (!learner || !parsed.success) {
        return { ok: false };
    }
    const positionToSave = {
        x: Math.round(parsed.data.x),
        y: Math.round(parsed.data.y),
    };
    await getDb()
        .update(schema.cards)
        .set({ position: positionToSave })
        .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id)));
    return { ok: true };
}
