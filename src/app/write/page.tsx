import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { StartForm } from "./start-form";

export default function WritePage() {
    return (
        <main className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-10 sm:px-8">
            <div className="flex flex-col gap-2">
                <h1 className="font-serif text-[32px] leading-tight">Write</h1>
            </div>
            <StartForm />
            <Suspense>
                <Essays />
            </Suspense>
        </main>
    );
}

async function Essays() {
    const learner = await getLearner();
    if (!learner) {
        redirect("/sign-in?next=/write");
    }

    const essays = await getDb()
        .select({
            id: schema.essays.id,
            question: schema.essays.question,
            startedAt: schema.essays.startedAt,
        })
        .from(schema.essays)
        .where(eq(schema.essays.learnerId, learner.id))
        .orderBy(desc(schema.essays.startedAt))
        .limit(10);

    if (essays.length === 0) {
        return null;
    }
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xs tracking-[0.06em] text-muted uppercase">Your essays</h2>
            <ul className="overflow-hidden rounded-[10px] border border-rule bg-surface">
                {essays.map((essay, index) => (
                    <li key={essay.id} className={index > 0 ? "border-t border-rule-soft" : ""}>
                        <Link
                            href={`/write/${essay.id}`}
                            className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4 hover:bg-background"
                        >
                            <span className="font-serif text-lg">{essay.question}</span>
                            <span className="text-xs text-muted">
                                {essay.startedAt.toLocaleDateString("en-GB")}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
