import { Suspense } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { TEXTS } from "@/lib/texts";
import { toCardView } from "@/lib/cards/card-view";
import { CanvasBoard } from "./canvas-board";

export default function CanvasPage() {
    return (
        <Suspense fallback={<p className="px-8 py-10 text-muted">Laying out your cards…</p>}>
            <CanvasLoader />
        </Suspense>
    );
}

async function CanvasLoader() {
    const learner = await getLearner();
    if (!learner) {
        redirect("/sign-in?next=/canvas");
    }

    const rows = await getDb()
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.learnerId, learner.id))
        .orderBy(asc(schema.cards.createdAt));

    const links = await getDb()
        .select({ cardId: schema.cardSources.cardId, sourceId: schema.cardSources.sourceId })
        .from(schema.cardSources)
        .innerJoin(schema.cards, eq(schema.cards.id, schema.cardSources.cardId))
        .where(eq(schema.cards.learnerId, learner.id));

    const books = Object.fromEntries(TEXTS.map((text) => [text.slug, { author: text.author, title: text.title }]));
    return <CanvasBoard initialCards={rows.map(toCardView)} initialLinks={links} books={books} />;
}
