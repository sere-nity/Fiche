import { Suspense } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { TEXTS } from "@/lib/texts";
import { toCardView } from "@/lib/cards/card-view";
import { CanvasBoard } from "./canvas-board";

/**
 * The canvas: every card the learner has saved, laid out on a board. For now
 * it's for arranging, reviewing and adding cards; synthesis cards and the
 * examiner arrive in milestone 5.
 */
export default function CanvasPage() {
  return (
    <Suspense fallback={<p className="px-8 py-10 text-muted">Laying out your cards…</p>}>
      <CanvasLoader />
    </Suspense>
  );
}

async function CanvasLoader() {
  const learner = await getLearner();
  if (!learner) redirect("/sign-in?next=/canvas");

  const rows = await getDb()
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.learnerId, learner.id))
    .orderBy(asc(schema.cards.createdAt));

  const books = Object.fromEntries(TEXTS.map((t) => [t.slug, { author: t.author, title: t.title }]));
  return <CanvasBoard initialCards={rows.map(toCardView)} books={books} />;
}
