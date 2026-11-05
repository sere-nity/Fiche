import { Suspense } from "react";
import Link from "next/link";
import { TEXTS, type TextMeta } from "@/lib/texts";
import { getLearner } from "@/lib/session";
import { getShelfCounts } from "@/lib/shelf";

export default function LibraryPage() {
    const texts = [...TEXTS].sort((a, b) => a.year - b.year);

    return (
        <main className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-4 py-8 sm:px-8">
            <section aria-labelledby="shelf-h" className="flex flex-col gap-3">
                <h1 id="shelf-h" className="font-serif text-[26px]">
                    Your shelf
                </h1>

                <ul className="overflow-hidden rounded-[10px] border border-rule bg-surface">
                    {texts.map((text, i) => (
                        <li key={text.slug} className={i > 0 ? "border-t border-rule-soft" : ""}>
                            <ShelfRow text={text} />
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}

function ShelfRow({ text }: { text: TextMeta }) {
    return (
        <Link
            href={`/read/${text.slug}`}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 hover:bg-background"
        >
            <div className="flex flex-[2_1_260px] flex-col gap-0.5">
                <span className="font-serif text-xl">{text.title}</span>
                <span className="text-xs text-muted">
                    {text.author} · {text.year}
                    {text.translator ? ` · tr. ${text.translator}` : ""}
                </span>
            </div>
            <span className="flex-[1_1_140px] text-secondary">
                <Suspense>
                    <Count slug={text.slug} />
                </Suspense>
            </span>
            <span className="flex-none font-medium text-accent">Read →</span>
        </Link>
    );
}

async function Count({ slug }: { slug: string }) {
    const learner = await getLearner();
    if (!learner) {
        return null;
    }
    const counts = (await getShelfCounts(learner.id))[slug];
    if (!counts) {
        return <span className="text-faint">No cards yet</span>;
    }
    return (
        <>
            {counts.total} {counts.total === 1 ? "card" : "cards"} · {counts.unused} unused
        </>
    );
}
