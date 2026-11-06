"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { UIMessage } from "ai";
import type { CardView } from "@/lib/cards/card-view";
import { CloseButton } from "@/app/close-button";
import { ChatThread } from "@/app/chat-thread";
import { openingLine, type ChatContext } from "@/lib/chat/context";
import type { ActionResult, UpdateQuoteInput } from "@/lib/cards/actions";
import type { Books } from "./canvas-board";

export type PanelMode =
    { kind: "closed" } | { kind: "card"; id: string } | { kind: "link"; ids: string[] };

type EditCard = (id: string, input: UpdateQuoteInput) => Promise<ActionResult>;
export type SaveLink = (
    sourceIds: string[],
    input: { gist: string; title?: string; chat?: UIMessage[] },
) => Promise<ActionResult>;

const INPUT_CLASS =
    "w-full rounded-lg border border-field px-3 text-[15px] text-foreground outline-none focus:border-accent";
const LABEL_CLASS = "flex flex-col gap-1.5 text-xs text-muted";

export function CanvasPanel({
    mode,
    card,
    linkCards,
    sources,
    books,
    onEdit,
    onSaveLink,
    onChatMessages,
    onClose,
}: {
    mode: PanelMode;
    card?: CardView;
    linkCards: CardView[];
    sources: CardView[];
    books: Books;
    onEdit: EditCard;
    onSaveLink: SaveLink;
    onChatMessages: (cardId: string, messages: UIMessage[]) => void;
    onClose: () => void;
}) {
    if (mode.kind === "closed") {
        return null;
    }
    let content = null;
    if (mode.kind === "link") {
        content = <LinkPanel key={mode.ids.join()} cards={linkCards} onSave={onSaveLink} onClose={onClose} />;
    } else if (card) {
        content = (
            <CardDetail
                key={card.id}
                card={card}
                sources={sources}
                books={books}
                onEdit={onEdit}
                onChatMessages={onChatMessages}
                onClose={onClose}
            />
        );
    }
    return (
        <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto border-t border-rule bg-surface shadow-2xl lg:static lg:h-[calc(100dvh-73px)] lg:max-h-none lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none">
            {content}
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

function LinkPanel({ cards, onSave, onClose }: { cards: CardView[]; onSave: SaveLink; onClose: () => void }) {
    const [gist, setGist] = useState("");
    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const chatRef = useRef<UIMessage[]>([]);
    const [isChatBusy, setIsChatBusy] = useState(false);
    const context: ChatContext = { kind: "link", cardIds: cards.map((card) => card.id) };

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (isSaving) {
            return;
        }
        setIsSaving(true);
        setError(null);
        const result = await onSave(
            cards.map((card) => card.id),
            { gist, title, chat: chatRef.current },
        );
        setIsSaving(false);
        if (!result.ok) {
            setError(result.error);
        }
    }

    return (
        <div className="flex min-h-full flex-col">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-6">
                <Header title="Link" onClose={onClose} />
                <CardFields gist={gist} title={title} onGist={setGist} onTitle={setTitle} isSynthesis />
                {error && (
                    <p role="alert" className="text-warn">
                        {error}
                    </p>
                )}
                <button
                    disabled={isSaving || isChatBusy}
                    className="min-h-11 rounded-lg bg-foreground font-medium text-white disabled:opacity-40"
                >
                    {isSaving ? "Saving…" : isChatBusy ? "Waiting for reply…" : "Save synthesis"}
                </button>
            </form>
            <ChatThread
                context={context}
                opening={openingLine(
                    context,
                    cards.map((card) => card.title),
                )}
                placeholder="Reply…"
                autoFocus
                onBusyChange={setIsChatBusy}
                onMessagesChange={(messages) => {
                    chatRef.current = messages;
                }}
            />
        </div>
    );
}

function CardDetail({
    card,
    sources,
    books,
    onEdit,
    onChatMessages,
    onClose,
}: {
    card: CardView;
    sources: CardView[];
    books: Books;
    onEdit: EditCard;
    onChatMessages: (cardId: string, messages: UIMessage[]) => void;
    onClose: () => void;
}) {
    const [gist, setGist] = useState(card.gist);
    const [title, setTitle] = useState(card.title);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const book = card.textSlug ? books[card.textSlug] : undefined;
    const isSynthesis = card.kind === "synthesis";
    const hasChanges = gist.trim() !== card.gist || title.trim() !== card.title;
    const linkContext: ChatContext = { kind: "link", cardIds: sources.map((source) => source.id), cardId: card.id };

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (isSaving) {
            return;
        }
        setIsSaving(true);
        setError(null);
        const result = await onEdit(card.id, { gist, title });
        setIsSaving(false);
        if (!result.ok) {
            setError(result.error);
        }
    }

    return (
        <div className="flex min-h-full flex-col">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
                <Header title={isSynthesis ? "Link" : "Card"} onClose={onClose} />
                {!isSynthesis && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted">
                            {book ? book.author + " · " + book.title : card.typedSource}
                        </span>
                        <blockquote className="rounded-lg bg-quote px-3.5 py-3 font-serif text-base leading-normal">
                            “{card.quote}”
                        </blockquote>
                        {card.textSlug && (
                            <Link
                                href={"/read/" + card.textSlug + "#card-" + card.id}
                                className="text-[13px] font-medium text-accent hover:text-accent-hover"
                            >
                                Open in the book →
                            </Link>
                        )}
                    </div>
                )}
                <CardFields gist={gist} title={title} onGist={setGist} onTitle={setTitle} isSynthesis={isSynthesis} />
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
            {isSynthesis && sources.length >= 2 && (
                <ChatThread
                    context={linkContext}
                    opening={openingLine(
                        linkContext,
                        sources.map((source) => source.title),
                    )}
                    placeholder="Keep working on this link…"
                    initialMessages={card.chat}
                    onMessagesChange={(messages) => onChatMessages(card.id, messages)}
                />
            )}
        </div>
    );
}

function CardFields({ gist, title, onGist, onTitle, isSynthesis = false }: {
    gist: string;
    title: string;
    onGist: (value: string) => void;
    onTitle: (value: string) => void;
    isSynthesis?: boolean;
}) {
    return (
        <>
            <label className={LABEL_CLASS}>
                <span>{isSynthesis ? "The link" : "Gist"} <span className="text-faint">· one sentence, your words</span></span>
                <textarea
                    value={gist}
                    onChange={(event) => onGist(event.target.value)}
                    required
                    maxLength={400}
                    className={`${INPUT_CLASS} field-sizing-content min-h-20 resize-none py-3 leading-snug`}
                />
            </label>
            <label className={LABEL_CLASS}>
                Title (optional)
                <input
                    value={title}
                    onChange={(event) => onTitle(event.target.value)}
                    maxLength={80}
                    className={`${INPUT_CLASS} min-h-11`}
                />
            </label>
        </>
    );
}
