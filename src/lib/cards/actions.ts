"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { getTextMeta } from "@/lib/texts";
import { toCardView, type CardView } from "./card-view";

/**
 * Capture is pure: saving or editing a card involves no AI. The first AI the
 * learner meets is on the canvas, where cards get connected.
 */

export type ActionResult = { ok: true; card: CardView } | { ok: false; error: string };

const MAX_QUOTE_WORDS = 60;
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const SaveQuoteCard = z
  .object({
    title: z.string().trim().max(80).optional(),
    gist: z.string().trim().min(1, "Write the gist in one sentence.").max(400),
    // Not trimmed: for a Reader card it must stay an exact substring of the book.
    quote: z.string().min(1).max(1200),
    // From the Reader:
    textSlug: z.string().optional(),
    quotePrefix: z.string().max(64).optional(),
    quoteSuffix: z.string().max(64).optional(),
    // Added directly:
    typedSource: z.string().trim().max(200).optional(),
  })
  .refine((d) => wordCount(d.quote) <= MAX_QUOTE_WORDS, {
    message: `Keep quotes under ${MAX_QUOTE_WORDS} words: pick the line that carries the idea.`,
  })
  .refine((d) => (d.textSlug ? Boolean(getTextMeta(d.textSlug)) : Boolean(d.typedSource)), {
    message: "Say where the quote comes from.",
  });

export async function saveQuoteCard(input: z.input<typeof SaveQuoteCard>): Promise<ActionResult> {
  const learner = await getLearner();
  if (!learner) return { ok: false, error: "Sign in to save cards." };

  const parsed = SaveQuoteCard.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [row] = await getDb()
    .insert(schema.cards)
    .values({
      learnerId: learner.id,
      kind: "quote",
      title: d.title || titleFrom(d.gist),
      gist: d.gist,
      quote: d.textSlug ? d.quote : d.quote.trim(),
      textSlug: d.textSlug ?? null,
      quotePrefix: d.textSlug ? (d.quotePrefix ?? "") : null,
      quoteSuffix: d.textSlug ? (d.quoteSuffix ?? "") : null,
      typedSource: d.textSlug ? null : d.typedSource,
    })
    .returning();
  return { ok: true, card: toCardView(row) };
}

const UpdateQuoteCard = z.object({
  gist: z.string().trim().min(1, "Write the gist in one sentence.").max(400),
  title: z.string().trim().max(80).optional(),
});

/** Edit a card's gist or title. */
export async function updateQuoteCard(
  cardId: string,
  input: z.input<typeof UpdateQuoteCard>,
): Promise<ActionResult> {
  const learner = await getLearner();
  if (!learner) return { ok: false, error: "Sign in first." };
  const parsed = UpdateQuoteCard.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const [row] = await getDb()
    .update(schema.cards)
    .set({
      gist: parsed.data.gist,
      title: parsed.data.title || titleFrom(parsed.data.gist),
    })
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id)))
    .returning();
  if (!row) return { ok: false, error: "Card not found." };
  return { ok: true, card: toCardView(row) };
}

/** A title is optional; without one, use the first few words of the gist. */
function titleFrom(gist: string): string {
  const words = gist.replace(/[.,;:!?]+$/, "").split(/\s+/);
  return words.length <= 6 ? words.join(" ") : `${words.slice(0, 6).join(" ")}…`;
}

const Position = z.object({ x: z.number().finite(), y: z.number().finite() });

/** Save where a card sits on the canvas (called when a drag ends). */
export async function moveCard(cardId: string, position: z.input<typeof Position>): Promise<{ ok: boolean }> {
  const learner = await getLearner();
  const parsed = Position.safeParse(position);
  if (!learner || !parsed.success) return { ok: false };
  const p = { x: Math.round(parsed.data.x), y: Math.round(parsed.data.y) };
  await getDb()
    .update(schema.cards)
    .set({ position: p })
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id)));
  return { ok: true };
}
