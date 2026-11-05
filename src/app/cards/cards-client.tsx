"use client";

import { useState } from "react";
import Link from "next/link";
import { CardItem } from "./card-item";
import { useCards } from "./use-cards";
import type { CardView } from "./card-view";

export function CardsClient({
  initialCards,
  sourceLabels,
}: {
  initialCards: CardView[];
  sourceLabels: Record<string, string>;
}) {
  const { cards, checking, checkErrors, save, check } = useCards(initialCards);

  return (
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
      <AddQuoteForm onSave={save} />
      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-[0.06em] text-muted uppercase">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </h2>
        {cards.length === 0 ? (
          <p className="leading-normal text-muted">
            None yet. Open a book in the{" "}
            <Link href="/" className="text-accent underline">
              Library
            </Link>{" "}
            and select a passage, or add a quote here.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                source={card.textSlug ? sourceLabels[card.textSlug] : (card.typedSource ?? undefined)}
                checking={checking.has(card.id)}
                checkError={checkErrors[card.id]}
                onRetry={() => check(card.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AddQuoteForm({ onSave }: { onSave: ReturnType<typeof useCards>["save"] }) {
  const empty = { quote: "", typedSource: "", gist: "", title: "" };
  type Field = keyof typeof empty;
  const [fields, setFields] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await onSave(fields);
    setSaving(false);
    if (!r.ok) return setError(r.error);
    setFields(empty);
  }

  const input = "w-full rounded-lg border border-field px-3 text-[15px] outline-none focus:border-accent";
  const label = "flex flex-col gap-1.5 text-xs text-muted";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-[10px] border border-rule bg-surface p-6">
      <h2 className="text-[15px] font-semibold">Add a quote</h2>
      <label className={label}>
        Quote
        <textarea
          value={fields.quote}
          onChange={set("quote")}
          rows={4}
          required
          className={`${input} resize-y bg-quote py-3 font-serif text-base leading-normal text-foreground`}
        />
      </label>
      <label className={label}>
        Source <span className="sr-only">(author, work)</span>
        <input value={fields.typedSource} onChange={set("typedSource")} required placeholder="Author, work" className={`${input} min-h-11 text-foreground placeholder:text-faint`} />
      </label>
      <label className={label}>
        <span>
          Gist <span className="text-faint">· one sentence, your words</span>
        </span>
        <textarea value={fields.gist} onChange={set("gist")} rows={3} required className={`${input} resize-y py-3 leading-snug text-foreground`} />
      </label>
      <label className={label}>
        Title (optional)
        <input value={fields.title} onChange={set("title")} maxLength={80} className={`${input} min-h-11 text-foreground`} />
      </label>
      {error && (
        <p role="alert" className="text-warn">
          {error}
        </p>
      )}
      <button disabled={saving} className="min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40">
        {saving ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}
