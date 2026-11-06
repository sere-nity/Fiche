import { sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index, primaryKey, check } from "drizzle-orm/pg-core";

export const cardKindEnum = pgEnum("card_kind", ["quote", "synthesis"]);

export const moveEnum = pgEnum("synthesis_move", [
    "lens",
    "fusion",
    "lineage",
    "counterweight",
    "concession",
    "test_case",
]);
export const essayModeEnum = pgEnum("essay_mode", ["practice", "exam"]);
export const verdictEnum = pgEnum("citation_verdict", ["substantive", "decorative", "misread"]);

export type Position = { x: number; y: number };

export type RubricDimension = "problematisation" | "dialectic" | "use_of_references" | "fidelity" | "clarity";
export type Feedback = {
    rubric: Record<RubricDimension, { score: 1 | 2 | 3 | 4; reason: string }>;

    pattern: string;
};

export const learners = pgTable("learners", {
    id: uuid("id").primaryKey().defaultRandom(),

    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
        // The riff (Reader) or linking chat (canvas) that belongs to this card.
        chat: jsonb("chat").$type<UIMessage[]>(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("cards_learner_idx").on(table.learnerId),

        check("quote_cards_have_quote", sql`${table.kind} = 'synthesis' OR ${table.quote} IS NOT NULL`),
    ],
);

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
    (table) => [
        primaryKey({ columns: [table.cardId, table.sourceId] }),
        index("card_sources_source_idx").on(table.sourceId),
        check("no_self_source", sql`${table.cardId} <> ${table.sourceId}`),
    ],
);

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
    (table) => [index("essays_learner_idx").on(table.learnerId)],
);

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
    (table) => [index("citations_card_idx").on(table.cardId)],
);
