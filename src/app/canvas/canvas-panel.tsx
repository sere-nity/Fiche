"use client";

import { useState } from "react";
import Link from "next/link";
import type { CardView } from "@/lib/cards/card-view";
import type { useCards } from "@/lib/cards/use-cards";
import type { Books } from "./canvas-board";

export type PanelMode = { kind: "closed" } | { kind: "add" } | { kind: "card"; id: string };

type Cards = ReturnType<typeof useCards>;

const input = "w-full rounded-lg border border-field px-3 text-[15px] text-foreground outline-none focus:border-accent";
const label = "flex flex-col gap-1.5 text-xs text-muted";

/**
 * The canvas's side panel, after the design: a card's details, or a form to
 * add a quote from outside the library. A bottom sheet on small screens.
 * (Milestone 5 adds the synthesis drawer here.)
 */
export function CanvasPanel({
  mode,
  card,
  books,
  onAdd,
  onEdit,
  onClose,
}: {
  mode: PanelMode;
  card?: CardView;
  books: Books;
  onAdd: Cards["save"];
  onEdit: Cards["update"];
  onClose: () => void;
}) {
  if (mode.kind === "closed") return null;
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto border-t border-rule bg-surface shadow-2xl lg:static lg:max-h-none lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none">
      {mode.kind === "add" ? (
        <AddQuote onAdd={onAdd} onClose={onClose} />
      ) : card ? (
        // Keyed by card, so switching cards resets the form to that card's text.
        <CardDetail key={card.id} card={card} books={books} onEdit={onEdit} onClose={onClose} />
      ) : null}
    </aside>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-rule-soft hover:text-foreground"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function CardDetail({
  card,
  books,
  onEdit,
  onClose,
}: {
  card: CardView;
  books: Books;
  onEdit: Cards["update"];
  onClose: () => void;
}) {
  const [gist, setGist] = useState(card.gist);
  const [title, setTitle] = useState(card.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const book = card.textSlug ? books[card.textSlug] : undefined;
  const dirty = gist.trim() !== card.gist || title.trim() !== card.title;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await onEdit(card.id, { gist, title });
    setSaving(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6">
      <Header title="Card" onClose={onClose} />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">{book ? `${book.author} · ${book.title}` : card.typedSource}</span>
        <blockquote className="rounded-lg bg-quote px-3.5 py-3 font-serif text-base leading-normal">
          “{card.quote}”
        </blockquote>
        {card.textSlug && (
          <Link
            href={`/read/${card.textSlug}#card-${card.id}`}
            className="text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            Open in the book →
          </Link>
        )}
      </div>
      <label className={label}>
        Gist
        <textarea
          value={gist}
          onChange={(e) => setGist(e.target.value)}
          required
          className={`${input} field-sizing-content min-h-24 resize-none py-3 leading-snug`}
        />
      </label>
      <label className={label}>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className={`${input} min-h-11`}
        />
      </label>
      {error && (
        <p role="alert" className="text-warn">
          {error}
        </p>
      )}
      <button
        disabled={saving || !dirty}
        className="min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function AddQuote({ onAdd, onClose }: { onAdd: Cards["save"]; onClose: () => void }) {
  const empty = { quote: "", typedSource: "", gist: "", title: "" };
  const [fields, setFields] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await onAdd(fields); // on success the board switches the panel to the new card
    setSaving(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6">
      <Header title="Add a quote" onClose={onClose} />
      <p className="-mt-2 leading-normal text-muted">
        From outside the library: a Kindle highlight, a paper book, a lecture.
      </p>
      <label className={label}>
        Quote
        <textarea
          value={fields.quote}
          onChange={set("quote")}
          required
          className={`${input} field-sizing-content min-h-28 resize-none bg-quote py-3 font-serif text-base leading-normal`}
        />
      </label>
      <label className={label}>
        Source
        <input
          value={fields.typedSource}
          onChange={set("typedSource")}
          required
          placeholder="Author, work"
          className={`${input} min-h-11 placeholder:text-faint`}
        />
      </label>
      <label className={label}>
        <span>
          Gist <span className="text-faint">· one sentence, your words</span>
        </span>
        <textarea
          value={fields.gist}
          onChange={set("gist")}
          required
          className={`${input} field-sizing-content min-h-20 resize-none py-3 leading-snug`}
        />
      </label>
      <label className={label}>
        Title (optional)
        <input value={fields.title} onChange={set("title")} maxLength={80} className={`${input} min-h-11`} />
      </label>
      {error && (
        <p role="alert" className="text-warn">
          {error}
        </p>
      )}
      <button
        disabled={saving}
        className="min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {saving ? "Saving…" : "Add to canvas"}
      </button>
    </form>
  );
}
