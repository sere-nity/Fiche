"use client";

import { useState } from "react";
import { runGistCheck, saveQuoteCard, updateQuoteCard } from "./actions";
import type { CardView } from "./card-view";

type SaveInput = Parameters<typeof saveQuoteCard>[0];

/**
 * A list of cards plus the save → check flow, shared by the Reader and the
 * Cards page. Saving adds the card straight away; the gist check then runs in
 * the background and updates it.
 */
export function useCards(initial: CardView[]) {
  const [cards, setCards] = useState(initial);
  const [checking, setChecking] = useState<ReadonlySet<string>>(new Set());
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});

  async function check(id: string) {
    setChecking((s) => new Set(s).add(id));
    setCheckErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    let error: string | undefined;
    try {
      const r = await runGistCheck(id);
      if (r.ok) setCards((cs) => cs.map((c) => (c.id === id ? r.card : c)));
      else error = r.error;
    } catch {
      error = "The check couldn't run. Your card is saved; try again later.";
    }
    if (error) setCheckErrors((e) => ({ ...e, [id]: error }));
    setChecking((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  async function save(input: SaveInput): Promise<{ ok: true; card: CardView } | { ok: false; error: string }> {
    try {
      const r = await saveQuoteCard(input);
      if (!r.ok) return r;
      setCards((cs) => [r.card, ...cs]);
      void check(r.card.id);
      return r;
    } catch {
      return { ok: false, error: "Couldn't save. Check your connection and try again." };
    }
  }

  /** Revise gist/title, then re-run the check against the new wording. */
  async function update(id: string, input: { gist: string; title?: string }) {
    try {
      const r = await updateQuoteCard(id, input);
      if (!r.ok) return r;
      setCards((cs) => cs.map((c) => (c.id === id ? r.card : c)));
      void check(id);
      return r;
    } catch {
      return { ok: false as const, error: "Couldn't save. Check your connection and try again." };
    }
  }

  return { cards, checking, checkErrors, save, update, check };
}
