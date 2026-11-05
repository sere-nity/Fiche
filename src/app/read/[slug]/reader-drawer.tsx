"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { CloseButton } from "@/app/close-button";
import type { Anchor } from "@/lib/anchor";
import type { CardView } from "@/lib/cards/card-view";
import type { LocatedCard } from "./reader-dom";

export type ReaderMode = { kind: "closed" } | { kind: "list" } | { kind: "draft"; anchor: Anchor } | { kind: "card"; id: string };

const MAX_WORDS = 60;

type ReaderDrawerProps = {
    mode: ReaderMode;
    slug: string;
    signedIn: boolean;
    located: LocatedCard[];
    openCard?: CardView;
    gist: string;
    title: string;
    error: string | null;
    isSaving: boolean;
    hasChanges: boolean;
    onGistChange: (gist: string) => void;
    onTitleChange: (title: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onClose: () => void;
    onShowList: () => void;
    onOpenCard: (id: string) => void;
};

export function ReaderDrawer({
    mode,
    slug,
    signedIn,
    located,
    openCard,
    gist,
    title,
    error,
    isSaving,
    hasChanges,
    onGistChange,
    onTitleChange,
    onSubmit,
    onClose,
    onShowList,
    onOpenCard,
}: ReaderDrawerProps) {
    const quote = mode.kind === "draft" ? mode.anchor.quote : (openCard?.quote ?? "");
    const words = quote.trim().split(/\s+/).filter(Boolean).length;
    const tooLong = mode.kind === "draft" && words > MAX_WORDS;

    return (

        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto border-t border-rule bg-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:max-h-none lg:w-[380px] lg:border-t-0 lg:border-l lg:shadow-[-8px_0_24px_rgba(23,23,28,0.06)]">
            {mode.kind === "list" || (mode.kind === "card" && !openCard) ? (
                <CardList
                    signedIn={signedIn}
                    slug={slug}
                    located={located}
                    onOpen={onOpenCard}
                    onClose={onClose}
                />
            ) : (
                <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-7">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[15px] font-semibold">{mode.kind === "draft" ? "New card" : "Card"}</h2>
                        <div className="flex items-center gap-1">
                            {mode.kind === "card" && (
                                <button
                                    type="button"
                                    onClick={onShowList}
                                    className="px-2 text-[13px] text-accent"
                                >
                                    All cards
                                </button>
                            )}
                            <CloseButton onClick={onClose} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted">Quote</span>
                        <blockquote className="rounded-lg bg-quote px-3.5 py-3 font-serif text-base leading-normal">
                            “{quote}”
                        </blockquote>
                        {tooLong && (
                            <span className="text-xs text-warn">
                                {words} words. Keep it under {MAX_WORDS}: select the line that carries the idea.
                            </span>
                        )}
                    </div>

                    {!signedIn ? (
                        <p className="leading-normal text-secondary">
                            <Link href={`/sign-in?next=/read/${slug}`} className="font-medium text-accent underline">
                                Sign in
                            </Link>{" "}
                            to save this as a card.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="gist" className="text-xs text-muted">
                                    Gist <span className="text-faint">· one sentence, your words</span>
                                </label>
                                <textarea
                                    id="gist"
                                    rows={3}
                                    value={gist}
                                    onChange={(event) => onGistChange(event.target.value)}
                                    required
                                    className="field-sizing-content min-h-24 w-full resize-none rounded-lg border border-field p-3 text-[15px] leading-snug outline-none focus:border-accent"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="title" className="text-xs text-muted">
                                    Title (optional)
                                </label>
                                <input
                                    id="title"
                                    value={title}
                                    onChange={(event) => onTitleChange(event.target.value)}
                                    maxLength={80}
                                    className="min-h-11 w-full rounded-lg border border-field px-3 text-[15px] outline-none focus:border-accent"
                                />
                            </div>

                            {error && (
                                <p role="alert" className="text-warn">
                                    {error}
                                </p>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="min-h-11 flex-1 rounded-lg border border-field bg-surface font-medium hover:border-foreground"
                                >
                                    {mode.kind === "draft" ? "Discard" : "Done"}
                                </button>
                                <button
                                    disabled={isSaving || tooLong || (mode.kind === "card" && !hasChanges)}
                                    className="min-h-11 flex-[2] rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                                >
                                    {isSaving ? "Saving…" : mode.kind === "draft" ? "Save card" : "Save changes"}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            )}
        </div>
    );
}

function CardList({
    signedIn,
    slug,
    located,
    onOpen,
    onClose,
}: {
    signedIn: boolean;
    slug: string;
    located: LocatedCard[];
    onOpen: (id: string) => void;
    onClose: () => void;
}) {
    return (
        <section className="flex flex-col gap-4 px-6 py-7">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="text-[15px] font-semibold">
                        Cards from this book
                        {located.length > 0 && <span className="font-normal text-muted"> · {located.length}</span>}
                    </h2>
                    <p className="leading-normal text-muted">Select a passage to make a card from it.</p>
                </div>
                <CloseButton onClick={onClose} />
            </div>
            {!signedIn ? (
                <p className="leading-normal text-secondary">
                    <Link href={`/sign-in?next=/read/${slug}`} className="font-medium text-accent underline">
                        Sign in
                    </Link>{" "}
                    to save cards and see them here.
                </p>
            ) : (
                located.length > 0 && (
                    <ul className="flex flex-col overflow-hidden rounded-[10px] border border-rule">
                        {located.map(({ card }, i) => (
                            <li key={card.id} className={i > 0 ? "border-t border-rule-soft" : ""}>
                                <button
                                    type="button"
                                    onClick={() => onOpen(card.id)}
                                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-background"
                                >
                                    <span className="font-serif text-base leading-snug">{card.title}</span>
                                    <span className="line-clamp-2 text-[13px] leading-snug text-secondary">{card.gist}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </section>
    );
}
