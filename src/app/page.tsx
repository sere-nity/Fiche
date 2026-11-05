import { Suspense } from "react";
import Link from "next/link";
import { TEXTS, type TextMeta } from "@/lib/texts";
import { getLearner } from "@/lib/session";
import { getShelfCounts } from "@/lib/shelf";

/**
 * Library. The shelf itself is static; only the card counts depend on who's
 * signed in, so each count streams into its row.
 *
 * Later milestones add a "Today" row above the shelf: the session question
 * (milestone 3) and how many of your cards you've used (milestone 6).
 */
export default function LibraryPage() {
  const texts = [...TEXTS].sort((a, b) => a.year - b.year);

  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-4 py-8 sm:px-8">
      <section aria-labelledby="shelf-h" className="flex flex-col gap-3">
        <h1 id="shelf-h" className="font-serif text-[26px]">
          Your shelf
        </h1>

        <ul className="overflow-hidden rounded-[10px] border border-rule bg-surface">
          {texts.map((t, i) => (
            <li key={t.slug} className={i > 0 ? "border-t border-rule-soft" : ""}>
              <ShelfRow text={t} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function ShelfRow({ text: t }: { text: TextMeta }) {
  return (
    <Link
      href={`/read/${t.slug}`}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 hover:bg-background"
    >
      <div className="flex flex-[2_1_260px] flex-col gap-0.5">
        <span className="font-serif text-xl">{t.title}</span>
        <span className="text-xs text-muted">
          {t.author} · {t.year}
          {t.translator ? ` · tr. ${t.translator}` : ""}
        </span>
      </div>
      <span className="flex-[1_1_140px] text-secondary">
        <Suspense>
          <Count slug={t.slug} />
        </Suspense>
      </span>
      <span className="flex-none font-medium text-accent">Read →</span>
    </Link>
  );
}

async function Count({ slug }: { slug: string }) {
  const learner = await getLearner();
  if (!learner) return null;
  const c = (await getShelfCounts(learner.id))[slug];
  if (!c) return <span className="text-faint">No cards yet</span>;
  return (
    <>
      {c.total} {c.total === 1 ? "card" : "cards"} · {c.unused} unused
    </>
  );
}
