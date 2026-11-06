import type { Feedback } from "@/db/schema";
import type { SessionCard } from "@/lib/essays/essay";
import { RUBRIC, totalScore, type CitationGrade } from "@/lib/essays/rubric";

export function EssayFeedback({ feedback, citations, cards }: { feedback: Feedback; citations: CitationGrade[]; cards: SessionCard[] }) {
    return (
        <section aria-label="Essay feedback" className="flex flex-col gap-5 border-t border-rule pt-6 pb-4">
            <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-2xl">Feedback</h2>
                <span className="font-medium tabular-nums">{totalScore(feedback)} / 20</span>
            </div>
            <p className="text-xs text-muted">AI marking · 1 Missing · 2 Developing · 3 Good · 4 Strong</p>
            <dl className="divide-y divide-rule rounded-lg border border-rule">
                {RUBRIC.map((dimension) => (
                    <div key={dimension.key} className="px-4 py-3">
                        <dt className="flex justify-between gap-3 font-medium">
                            {dimension.label}<span>{feedback.rubric[dimension.key].score} / 4</span>
                        </dt>
                        <dd className="mt-1 text-sm leading-normal text-muted">{feedback.rubric[dimension.key].reason}</dd>
                    </div>
                ))}
            </dl>
            <div className="rounded-lg bg-accent-soft p-4">
                <h3 className="font-medium">Next time</h3>
                <p className="mt-1 text-sm leading-normal">{feedback.pattern}</p>
            </div>
            {citations.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3 className="font-medium">Your references</h3>
                    {citations.map((citation) => {
                        const card = cards.find((card) => card.id === citation.cardId);
                        return (
                            <div key={citation.cardId} className="rounded-lg border border-rule p-4">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <span className="font-medium">{card?.title ?? "Removed card"}</span>
                                    <span className="rounded bg-rule-soft px-2 py-0.5 text-xs capitalize">{citation.verdict}</span>
                                </div>
                                {card && <blockquote className="mt-2 font-serif text-sm leading-normal">“{card.quote ?? card.gist}”</blockquote>}
                                <p className="mt-2 text-sm leading-normal text-muted">{citation.reason}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
