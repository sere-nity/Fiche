import { sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index, primaryKey, check } from "drizzle-orm/pg-core";

/**
 * Five tables. A learner signs in with an email (no password: this is a
 * prototype, and anyone who types your email gets in). Their id is kept in an
 * httpOnly cookie; see src/lib/session.ts.
 *
 * Static content is not here: the books are files in data/texts/, and a
 * question is stored as plain text on the essay that uses it.
 */

// ---------- enums ----------

export const cardKindEnum = pgEnum("card_kind", ["quote", "synthesis"]);
/** How a synthesis card combines its sources. Optional: naming the move is a nudge, not a gate. */
export const moveEnum = pgEnum("synthesis_move", [
  "lens", // one idea reframes another
  "fusion", // two ideas produce a third neither says alone
  "lineage", // an idea travels into a new domain
  "counterweight", // an alternative exposes what's missing
  "concession", // grant the objection, then reposition
  "test_case", // reality tests the claim
]);
export const essayModeEnum = pgEnum("essay_mode", ["practice", "exam"]);
export const verdictEnum = pgEnum("citation_verdict", ["substantive", "decorative", "misread"]);

// ---------- jsonb shapes ----------

export type Position = { x: number; y: number };

export type RubricDimension = "problematisation" | "dialectic" | "use_of_references" | "fidelity" | "clarity";
export type Feedback = {
  rubric: Record<RubricDimension, { score: 1 | 2 | 3 | 4; reason: string }>;
  /** The one pattern to work on next time; becomes the learner's "last weakness". */
  pattern: string;
};

// ---------- tables ----------

export const learners = pgTable("learners", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stored lowercased and trimmed, so "Serene@x.com " and "serene@x.com" are one learner. */
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Every node on the canvas is a card. Two kinds:
 *
 * - quote: an idea saved from a book (or typed in with its source). title +
 *   gist are the learner's own words. Capture is pure: no AI judges them.
 * - synthesis: a connection the learner wrote between other cards. title
 *   names the move, gist is the claim, sources live in card_sources. No quote.
 *   A synthesis can itself be a source, so connections can be connected.
 *
 * A quote card from the Reader is anchored to its passage by text, not position
 * (W3C Web Annotation "TextQuoteSelector"): the quote plus ~32 characters
 * either side. To find it again, search the text for prefix + quote + suffix,
 * falling back to the quote alone. Edits elsewhere in the book never break
 * the anchor.
 *
 * A quote added directly has no text_slug or prefix/suffix and carries a
 * typed source instead.
 */
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    kind: cardKindEnum("kind").notNull().default("quote"),
    textSlug: text("text_slug"),
    typedSource: text("typed_source"),
    quote: text("quote"),
    quotePrefix: text("quote_prefix"),
    quoteSuffix: text("quote_suffix"),
    gist: text("gist").notNull(),
    title: text("title").notNull(),
    move: moveEnum("move"),
    position: jsonb("position").$type<Position>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cards_learner_idx").on(t.learnerId),
    // The database itself refuses a quote card with no quote.
    check("quote_cards_have_quote", sql`${t.kind} = 'synthesis' OR ${t.quote} IS NOT NULL`),
  ],
);

/**
 * "This synthesis draws on that card." Many-to-many: a synthesis can have any
 * number of sources, and a card can feed any number of syntheses. The edges
 * on the canvas are these rows. Cycles (A draws on B draws on A) are
 * prevented in code when an edge is created.
 */
export const cardSources = pgTable(
  "card_sources",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.sourceId] }),
    index("card_sources_source_idx").on(t.sourceId),
    check("no_self_source", sql`${t.cardId} <> ${t.sourceId}`),
  ],
);

/** A timed mini dissertation. feedback is null until graded. */
export const essays = pgTable(
  "essays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    mode: essayModeEnum("mode").notNull().default("practice"),
    body: text("body").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    feedback: jsonb("feedback").$type<Feedback>(),
  },
  (t) => [index("essays_learner_idx").on(t.learnerId)],
);

/**
 * One row per @ reference in an essay; verdict written by the grader.
 * A real table (not jsonb on essays) because personalisation queries it
 * directly: "cards never cited" and "this card's past verdicts".
 */
export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    essayId: uuid("essay_id")
      .notNull()
      .references(() => essays.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    verdict: verdictEnum("verdict"),
    reason: text("reason"),
  },
  (t) => [index("citations_card_idx").on(t.cardId)],
);
