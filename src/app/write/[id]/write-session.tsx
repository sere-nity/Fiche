"use client";

import { useEffect, useRef, useState } from "react";
import { saveEssayBody } from "@/lib/essays/actions";
import { citedCardIds, wordCount, type EssayCard } from "@/lib/essays/essay";
import { CitationEditor } from "./citation-editor";

const AUTOSAVE_DELAY_MS = 2000;

export function WriteSession({ essayId, question, initialBody, cards }: {
    essayId: string;
    question: string;
    initialBody: string;
    cards: EssayCard[];
}) {
    const [body, setBody] = useState(initialBody);
    const [savedBody, setSavedBody] = useState(initialBody);
    const [saveFailed, setSaveFailed] = useState(false);
    const saveRequest = useRef(Promise.resolve({ ok: true }));

    useEffect(() => {
        if (body === savedBody) {
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
    }, [body, savedBody, essayId]);

    const citedCount = citedCardIds(body, cards).length;
    const saveStatus = saveFailed ? "Couldn't save yet" : body === savedBody ? "Saved" : "Saving…";

    return (
        <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pt-10 sm:px-8">
            <div className="flex flex-col gap-1.5">
                <span className="text-xs tracking-[0.06em] text-muted uppercase">Your question</span>
                <h1 className="font-serif text-[36px] leading-tight sm:text-[40px]">{question}</h1>
            </div>
            <CitationEditor key={essayId} initialBody={initialBody} cards={cards} onChange={setBody} />
            <div className="sticky bottom-0 border-t border-rule bg-background py-3">
                <span className="text-xs text-muted">
                    {wordCount(body)} words · {citedCount} cited · {saveStatus}
                    {cards.length === 0 && " · no cards to cite yet"}
                </span>
            </div>
        </main>
    );
}
