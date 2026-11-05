"use client";

import { useState } from "react";
import { saveQuoteCard, updateQuoteCard } from "./actions";
import type { CardView } from "./card-view";

type SaveInput = Parameters<typeof saveQuoteCard>[0];
type Result = { ok: true; card: CardView } | { ok: false; error: string };
const OFFLINE: Result = { ok: false, error: "Couldn't save. Check your connection and try again." };

/** A list of cards plus save and edit, shared by the Reader and the Cards page. */
export function useCards(initial: CardView[]) {
  const [cards, setCards] = useState(initial);

  async function save(input: SaveInput): Promise<Result> {
    try {
      const r = await saveQuoteCard(input);
      if (r.ok) setCards((cs) => [r.card, ...cs]);
      return r;
    } catch {
      return OFFLINE;
    }
  }

  async function update(id: string, input: { gist: string; title?: string }): Promise<Result> {
    try {
      const r = await updateQuoteCard(id, input);
      if (r.ok) setCards((cs) => cs.map((c) => (c.id === id ? r.card : c)));
      return r;
    } catch {
      return OFFLINE;
    }
  }

  return { cards, save, update };
}
