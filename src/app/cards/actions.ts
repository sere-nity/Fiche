"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { getBook, getTextMeta } from "@/lib/texts";
import { bookText, plainText } from "@/lib/book";
import { findAnchor } from "@/lib/anchor";
import { checkGist } from "@/lib/gist-check";
import { toCardView, type CardView } from "./card-view";

/**
 * Saving a card is two calls, so the UI can show "saving" then "checking":
 *   1. saveQuoteCard: validate and insert, gist_check = "unchecked"
 *   2. runGistCheck:  ask the AI, update the row
 * If step 2 fails, the card is already safe and stays "unchecked" (retryable).
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

/** Revise a card's gist or title. The old check no longer applies, so it's reset; the client re-runs it. */
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
      gistCheck: "unchecked",
      gistCheckReason: null,
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

export async function runGistCheck(cardId: string): Promise<ActionResult> {
  const learner = await getLearner();
  if (!learner) return { ok: false, error: "Sign in first." };

  const db = getDb();
  const where = and(eq(schema.cards.id, cardId), eq(schema.cards.learnerId, learner.id));
  const [card] = await db.select().from(schema.cards).where(where);
  if (!card || card.kind !== "quote" || !card.quote) return { ok: false, error: "Card not found." };

  try {
    const { source, passage } = await passageFor(card);
    const result = await checkGist({ source, passage, quote: card.quote, title: card.title, gist: card.gist });
    const [updated] = await db
      .update(schema.cards)
      .set({ gistCheck: result.verdict, gistCheckReason: result.reason })
      .where(where)
      .returning();
    return { ok: true, card: toCardView(updated) };
  } catch (err) {
    console.error("gist check failed", err);
    return { ok: false, error: "The check couldn't run. Your card is saved; try again later." };
  }
}

/**
 * The context the gist is judged against. For a Reader card: the paragraph(s)
 * the quote sits in, found by anchor. For a quote added directly: the quote.
 */
async function passageFor(card: typeof schema.cards.$inferSelect): Promise<{ source: string; passage: string }> {
  const quote = card.quote ?? "";
  const meta = card.textSlug ? getTextMeta(card.textSlug) : undefined;
  if (!meta) return { source: card.typedSource ?? "unknown", passage: quote };

  const source = `${meta.author}, ${meta.title}${meta.translator ? ` (tr. ${meta.translator})` : ""}`;
  const blocks = await getBook(meta.slug);
  const { text, starts } = bookText(blocks);
  const pos = findAnchor(text, { quote, prefix: card.quotePrefix ?? "", suffix: card.quoteSuffix ?? "" });
  if (!pos) return { source, passage: quote };

  // Every block that overlaps the quote.
  const passage = blocks
    .filter((b, i) => {
      const start = starts[i];
      const end = start + plainText(b).length;
      return start < pos.end && end > pos.start;
    })
    .map(plainText)
    .join("\n\n");
  return { source, passage };
}
