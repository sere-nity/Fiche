import { z } from "zod";
import type { Feedback, RubricDimension } from "@/db/schema";
import type { CardLink } from "@/lib/cards/card-view";

export const RUBRIC = [
    { key: "problematisation", label: "Framing the problem", description: "Identify a genuine tension in the question." },
    { key: "dialectic", label: "Argument and counterargument", description: "Develop a claim and take a serious objection into account." },
    { key: "use_of_references", label: "Use of references", description: "Make the cited ideas do argumentative work." },
    { key: "fidelity", label: "Accuracy", description: "Represent the quoted ideas and your syntheses faithfully." },
    { key: "clarity", label: "Clarity", description: "Use precise language and a clear line of reasoning." },
] as const satisfies readonly { key: RubricDimension; label: string; description: string }[];

const ScoreSchema = z.object({ score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), reason: z.string().min(1).max(500) });
export const FeedbackSchema = z.object({
    rubric: z.object({
        problematisation: ScoreSchema,
        dialectic: ScoreSchema,
        use_of_references: ScoreSchema,
        fidelity: ScoreSchema,
        clarity: ScoreSchema,
    }),
    pattern: z.string().min(1).max(700),
});
export const CitationGradeSchema = z.object({
    cardId: z.string().uuid(),
    verdict: z.enum(["substantive", "decorative", "misread"]),
    reason: z.string().min(1).max(700),
});
export const GradeSchema = FeedbackSchema.extend({ citations: z.array(CitationGradeSchema) });
export type CitationGrade = z.infer<typeof CitationGradeSchema>;
export type GradingCard = { id: string; title: string; kind: "quote" | "synthesis"; quote: string | null; gist: string; source: string };

export function totalScore(feedback: Feedback): number {
    return RUBRIC.reduce((total, dimension) => total + feedback.rubric[dimension.key].score, 0);
}

export function gradingCards(ids: string[], cards: GradingCard[], links: CardLink[]) {
    const included = new Set(ids);
    const pending = [...ids];
    while (pending.length > 0) {
        const id = pending.pop();
        for (const link of links.filter((link) => link.cardId === id)) {
            if (!included.has(link.sourceId)) {
                included.add(link.sourceId);
                pending.push(link.sourceId);
            }
        }
    }
    return cards.filter((card) => included.has(card.id)).map((card) => ({
        ...card,
        sourceIds: links.filter((link) => link.cardId === card.id).map((link) => link.sourceId),
    }));
}

export function validateCitationGrades(citations: CitationGrade[], ids: string[]) {
    const returned = new Set(citations.map((citation) => citation.cardId));
    if (returned.size !== ids.length || citations.length !== ids.length || ids.some((id) => !returned.has(id))) {
        throw new Error("The marking did not cover the cited cards correctly.");
    }
}
