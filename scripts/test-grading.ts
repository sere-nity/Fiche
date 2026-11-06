import assert from "node:assert/strict";
import test from "node:test";
import { FeedbackSchema, gradingCards, totalScore, validateCitationGrades, type CitationGrade, type GradingCard } from "../src/lib/essays/rubric";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const feedback = {
    rubric: {
        problematisation: { score: 3, reason: "A clear tension." },
        dialectic: { score: 2, reason: "Develop the objection." },
        use_of_references: { score: 4, reason: "The references support claims." },
        fidelity: { score: 3, reason: "Faithful use of the cards." },
        clarity: { score: 4, reason: "Clear reasoning." },
    },
    pattern: "Develop the strongest counterexample.",
};
const mark = (cardId: string): CitationGrade => ({ cardId, verdict: "substantive", reason: "Supports the argument." });

test("rubric requires all five dimensions with scores from one to four", () => {
    const parsed = FeedbackSchema.parse(feedback);
    assert.equal(totalScore(parsed), 16);
    assert.equal(FeedbackSchema.safeParse({ ...feedback, rubric: { ...feedback.rubric, clarity: { score: 5, reason: "Too high." } } }).success, false);
    assert.equal(FeedbackSchema.safeParse({ ...feedback, rubric: { clarity: feedback.rubric.clarity } }).success, false);
});

test("every cited card must be marked exactly once, with no invented cards", () => {
    assert.doesNotThrow(() => validateCitationGrades([mark(first), mark(second)], [first, second]));
    assert.throws(() => validateCitationGrades([mark(first)], [first, second]));
    assert.throws(() => validateCitationGrades([mark(first), mark(first)], [first, second]));
    assert.throws(() => validateCitationGrades([mark(first), mark(second)], [first]));
    assert.doesNotThrow(() => validateCitationGrades([], []));
});

test("grading includes sources of nested syntheses but excludes unrelated cards", () => {
    const cards: GradingCard[] = ["outer", "inner", "quote", "unused"].map((id) => ({
        id, title: id, kind: id === "quote" ? "quote" : "synthesis", quote: id === "quote" ? "An actual quote." : null,
        gist: "Their own claim.", source: "A source",
    }));
    const context = gradingCards(["outer"], cards, [{ cardId: "outer", sourceId: "inner" }, { cardId: "inner", sourceId: "quote" }]);
    assert.deepEqual(context.map((card) => card.id), ["outer", "inner", "quote"]);
    assert.deepEqual(context[0].sourceIds, ["inner"]);
    assert.equal(context[2].quote, "An actual quote.");
});

test("shared sources and malformed cyclic data cannot duplicate or trap the context walk", () => {
    const cards: GradingCard[] = ["a", "b"].map((id) => ({ id, title: id, kind: "synthesis", quote: null, gist: "A claim", source: "Own synthesis" }));
    const context = gradingCards(["a", "b"], cards, [{ cardId: "a", sourceId: "b" }, { cardId: "b", sourceId: "a" }]);
    assert.equal(context.length, 2);
});
