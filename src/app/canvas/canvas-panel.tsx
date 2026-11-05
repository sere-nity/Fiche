"use client";

import { useState } from "react";
import Link from "next/link";
import type { CardView } from "@/lib/cards/card-view";
import { CloseButton } from "@/app/close-button";
import type { ActionResult, SaveQuoteInput, UpdateQuoteInput } from "@/lib/cards/actions";
import type { Books } from "./canvas-board";

export type PanelMode = { kind: "closed" } | { kind: "add" } | { kind: "card"; id: string };

type SaveCard = (input: SaveQuoteInput) => Promise<ActionResult>;
type EditCard = (id: string, input: UpdateQuoteInput) => Promise<ActionResult>;

const INPUT_CLASS = "w-full rounded-lg border border-field px-3 text-[15px] text-foreground outline-none focus:border-accent";
const LABEL_CLASS = "flex flex-col gap-1.5 text-xs text-muted";

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
    onAdd: SaveCard;
    onEdit: EditCard;
    onClose: () => void;
}) {
    if (mode.kind === "closed") {
        return null;
    }
    return (
        <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto border-t border-rule bg-surface shadow-2xl lg:static lg:max-h-none lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none">
            {mode.kind === "add" ? (
                <AddQuote onAdd={onAdd} onClose={onClose} />
            ) : card ? (

                <CardDetail key={card.id} card={card} books={books} onEdit={onEdit} onClose={onClose} />
            ) : null}
        </aside>
    );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <CloseButton onClick={onClose} />
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
    onEdit: EditCard;
    onClose: () => void;
}) {
    const [gist, setGist] = useState(card.gist);
    const [title, setTitle] = useState(card.title);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const book = card.textSlug ? books[card.textSlug] : undefined;
    const hasChanges = gist.trim() !== card.gist || title.trim() !== card.title;

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError(null);
        const result = await onEdit(card.id, { gist, title });
        setIsSaving(false);
        if (!result.ok) {
            setError(result.error);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
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
            <label className={LABEL_CLASS}>
                Gist
                <textarea
                    value={gist}
                    onChange={(event) => setGist(event.target.value)}
                    required
                    className={`${INPUT_CLASS} field-sizing-content min-h-24 resize-none py-3 leading-snug`}
                />
            </label>
            <label className={LABEL_CLASS}>
                Title
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    className={`${INPUT_CLASS} min-h-11`}
                />
            </label>
            {error && (
                <p role="alert" className="text-warn">
                    {error}
                </p>
            )}
            <button
                disabled={isSaving || !hasChanges}
                className="min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
                {isSaving ? "Saving…" : "Save changes"}
            </button>
        </form>
    );
}

function AddQuote({ onAdd, onClose }: { onAdd: SaveCard; onClose: () => void }) {
    const [fields, setFields] = useState({
        quote: "",
        typedSource: "",
        gist: "",
        title: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const { name, value } = event.target;
        setFields((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError(null);
        const result = await onAdd(fields);
        setIsSaving(false);
        if (!result.ok) {
            setError(result.error);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
            <Header title="Add a quote" onClose={onClose} />
            <p className="-mt-2 leading-normal text-muted">
                From outside the library: a Kindle highlight, a paper book, a lecture.
            </p>
            <label className={LABEL_CLASS}>
                Quote
                <textarea
                    name="quote"
                    value={fields.quote}
                    onChange={handleChange}
                    required
                    className={`${INPUT_CLASS} field-sizing-content min-h-28 resize-none bg-quote py-3 font-serif text-base leading-normal`}
                />
            </label>
            <label className={LABEL_CLASS}>
                Source
                <input
                    name="typedSource"
                    value={fields.typedSource}
                    onChange={handleChange}
                    required
                    placeholder="Author, work"
                    className={`${INPUT_CLASS} min-h-11 placeholder:text-faint`}
                />
            </label>
            <label className={LABEL_CLASS}>
                <span>
                    Gist <span className="text-faint">· one sentence, your words</span>
                </span>
                <textarea
                    name="gist"
                    value={fields.gist}
                    onChange={handleChange}
                    required
                    className={`${INPUT_CLASS} field-sizing-content min-h-20 resize-none py-3 leading-snug`}
                />
            </label>
            <label className={LABEL_CLASS}>
                Title (optional)
                <input name="title" value={fields.title} onChange={handleChange} maxLength={80} className={`${INPUT_CLASS} min-h-11`} />
            </label>
            {error && (
                <p role="alert" className="text-warn">
                    {error}
                </p>
            )}
            <button
                disabled={isSaving}
                className="min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
                {isSaving ? "Saving…" : "Add to canvas"}
            </button>
        </form>
    );
}
