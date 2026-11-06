"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import {
    deleteSynthesisCards,
    saveQuoteCard,
    saveSynthesisCard,
    updateQuoteCard,
    type ActionResult,
    type DeleteResult,
    type SaveQuoteInput,
    type SaveSynthesisInput,
    type UpdateQuoteInput,
} from "./actions";
import type { CardView } from "./card-view";

const SAVE_ERROR = "Couldn't save. Check your connection and try again.";

export function useCards(initialCards: CardView[]) {
    const [cards, setCards] = useState(initialCards);
    const [serverCards, setServerCards] = useState(initialCards);

    if (initialCards !== serverCards) {
        setServerCards(initialCards);
        setCards(initialCards);
    }

    async function save(input: SaveQuoteInput): Promise<ActionResult> {
        try {
            const result = await saveQuoteCard(input);
            if (result.ok) {
                setCards((previous) => [...previous.filter((card) => card.id !== result.card.id), result.card]);
            }
            return result;
        } catch {
            return { ok: false, error: SAVE_ERROR };
        }
    }

    async function update(id: string, input: UpdateQuoteInput): Promise<ActionResult> {
        try {
            const result = await updateQuoteCard(id, input);
            if (result.ok) {
                setCards((previous) => previous.map((card) => (card.id === id ? result.card : card)));
            }
            return result;
        } catch {
            return { ok: false, error: SAVE_ERROR };
        }
    }

    async function saveSynthesis(input: SaveSynthesisInput): Promise<ActionResult> {
        try {
            const result = await saveSynthesisCard(input);
            if (result.ok) {
                setCards((previous) => [...previous.filter((card) => card.id !== result.card.id), result.card]);
            }
            return result;
        } catch {
            return { ok: false, error: SAVE_ERROR };
        }
    }

    async function removeSyntheses(ids: string[]): Promise<DeleteResult> {
        try {
            const result = await deleteSynthesisCards(ids);
            if (result.ok) {
                setCards((previous) => previous.filter((card) => !ids.includes(card.id)));
            }
            return result;
        } catch {
            return { ok: false, error: "Couldn't delete the synthesis. Try again." };
        }
    }

    // The chat route saves to the database; keep the open page current too.
    function setChat(id: string, chat: UIMessage[]) {
        setCards((previous) => previous.map((card) => (card.id === id ? { ...card, chat } : card)));
    }

    return { cards, save, update, saveSynthesis, removeSyntheses, setChat };
}
