import { Suspense } from "react";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getTextMeta } from "@/lib/texts";
import { getEssay } from "@/lib/essays/queries";
import type { EssayCard } from "@/lib/essays/essay";
import { WriteSession } from "./write-session";

export default function EssayPage({ params }: PageProps<"/write/[id]">) {
    return (
        <Suspense fallback={<p className="px-8 py-10 text-muted">Opening your essay…</p>}>
            <Essay params={params} />
        </Suspense>
    );
}

async function Essay({ params }: { params: PageProps<"/write/[id]">["params"] }) {
    const { id } = await params;
    const result = await getEssay(id);
    if (!result) {
        return (
            <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 py-10 sm:px-8">
                <h1 className="font-serif text-3xl">Essay unavailable</h1>
                <p className="text-muted">This essay may have been removed, or it belongs to a different account.</p>
                <Link href="/write" className="text-accent underline">Back to your essays</Link>
            </main>
        );
    }
    const { essay, learnerId } = result;
    const cards = await getDb()
        .select({
            id: schema.cards.id,
            title: schema.cards.title,
            quote: schema.cards.quote,
            gist: schema.cards.gist,
            textSlug: schema.cards.textSlug,
            typedSource: schema.cards.typedSource,
        })
        .from(schema.cards)
        .where(eq(schema.cards.learnerId, learnerId))
        .orderBy(asc(schema.cards.createdAt));
    const essayCards: EssayCard[] = cards.map((card) => ({
        id: card.id,
        title: card.title,
        quote: card.quote,
        gist: card.gist,
        source: (card.textSlug ? getTextMeta(card.textSlug)?.author : card.typedSource) ?? "",
    }));

    return <WriteSession essayId={essay.id} question={essay.question} initialBody={essay.body} cards={essayCards} />;
}
