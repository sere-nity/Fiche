import { Suspense } from "react";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { TEXTS } from "@/lib/texts";
import { toCardView } from "./card-view";
import { CardsClient } from "./cards-client";

export default function CardsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-2 px-4 py-8 sm:px-8">
      <h1 className="font-serif text-[26px]">Your cards</h1>
      <p className="max-w-prose leading-normal text-muted">
        Every idea you&apos;ve saved. Add one from outside the library: a Kindle highlight, a paper book, a lecture.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
        <CardsLoader />
      </Suspense>
    </main>
  );
}

async function CardsLoader() {
  const learner = await getLearner();
  if (!learner) redirect("/sign-in?next=/cards");

  const rows = await getDb()
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.learnerId, learner.id))
    .orderBy(desc(schema.cards.createdAt));

  const sourceLabels = Object.fromEntries(TEXTS.map((t) => [t.slug, `${t.author}, ${t.title}`]));
  return <CardsClient initialCards={rows.map(toCardView)} sourceLabels={sourceLabels} />;
}
