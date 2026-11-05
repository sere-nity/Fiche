"use client";

import { useState } from "react";
import {
    saveQuoteCard,
    updateQuoteCard,
    type ActionResult,
    type SaveQuoteInput,
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
                setCards((previous) => [result.card, ...previous]);
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
                setCards((previous) => previous.map((card) => card.id === id ? result.card : card));
            }
            return result;
        } catch {
            return { ok: false, error: SAVE_ERROR };
        }
    }

    return { cards, save, update };
}
