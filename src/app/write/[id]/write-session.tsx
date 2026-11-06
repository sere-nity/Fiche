"use client";

import { useEffect, useRef, useState } from "react";
import type { Feedback } from "@/db/schema";
import { saveEssayBody, submitEssay } from "@/lib/essays/actions";
import { citedCardIds, wordCount, type SessionCard } from "@/lib/essays/essay";
import type { CitationGrade } from "@/lib/essays/rubric";
import { CitationEditor } from "./citation-editor";
import { EssayFeedback } from "./essay-feedback";

const AUTOSAVE_DELAY_MS = 2000;

export function WriteSession({ essayId, question, initialBody, cards, initialFeedback, initialCitations }: {
    essayId: string;
    question: string;
    initialBody: string;
    cards: SessionCard[];
    initialFeedback: Feedback | null;
    initialCitations: CitationGrade[];
}) {
    const [body, setBody] = useState(initialBody);
    const [savedBody, setSavedBody] = useState(initialBody);
    const [saveFailed, setSaveFailed] = useState(false);
    const [feedback, setFeedback] = useState(initialFeedback);
    const [citations, setCitations] = useState(initialCitations);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const saveRequest = useRef(Promise.resolve({ ok: true }));

    useEffect(() => {
        if (isSubmitting || body === savedBody) {
            return;
        }
        const timeout = setTimeout(async () => {
            const request = saveRequest.current.then(() => saveEssayBody(essayId, body));
            saveRequest.current = request.catch(() => ({ ok: false }));
            const result = await saveRequest.current;
            setSaveFailed(!result.ok);
            if (result.ok) {
                setSavedBody(body);
            }
        }, AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timeout);
    }, [body, savedBody, essayId, isSubmitting]);

    function changeBody(next: string) {
        setBody(next);
        setFeedback(null);
        setCitations([]);
        setError("");
    }

    async function submit() {
        if (isSubmitting || !body.trim()) {
            return;
        }
        setIsSubmitting(true);
        setError("");
        try {
            await saveRequest.current;
            const result = await submitEssay(essayId, body);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setSavedBody(body);
            setSaveFailed(false);
            setFeedback(result.feedback);
            setCitations(result.citations);
        } catch {
            setError("Couldn't finish marking. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const citedCount = citedCardIds(body, cards).length;
    const saveStatus = saveFailed ? "Couldn't save yet" : body === savedBody ? "Saved" : "Saving…";

    return (
        <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pt-10 sm:px-8">
            <div className="flex flex-col gap-1.5">
                <span className="text-xs tracking-[0.06em] text-muted uppercase">Your question</span>
                <h1 className="font-serif text-[36px] leading-tight sm:text-[40px]">{question}</h1>
            </div>
            <CitationEditor key={essayId} initialBody={initialBody} cards={cards} onChange={changeBody} editable={!isSubmitting} />
            {feedback && <EssayFeedback feedback={feedback} citations={citations} cards={cards} />}
            {error && <p role="alert" className="text-warn">{error}</p>}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-background py-3">
                <span className="text-xs text-muted">
                    {wordCount(body)} words · {citedCount} cited · {saveStatus}
                    {cards.length === 0 && " · no cards to cite yet"}
                </span>
                <button type="button" onClick={submit} disabled={isSubmitting || !body.trim() || Boolean(feedback)}
                    className="min-h-11 rounded-lg bg-accent px-4 font-medium text-white hover:bg-accent-hover disabled:opacity-40">
                    {isSubmitting ? "Marking…" : feedback ? "Marked" : "Submit for marking"}
                </button>
            </div>
        </main>
    );
}
