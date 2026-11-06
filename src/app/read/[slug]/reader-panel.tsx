"use client";

import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createAnchor, findAnchor } from "@/lib/anchor";
import { useCards } from "@/lib/cards/use-cards";
import type { CardView } from "@/lib/cards/card-view";
import { cardAt, selectionOffsets, rangeAt, paint } from "./reader-dom";

import { ReaderDrawer, type ReaderMode } from "./reader-drawer";
// The server-rendered book does not change after loading.
const noSubscribe = () => () => { };

export function ReaderPanel({
    slug,
    signedIn,
    initialCards,
}: {
    slug: string;
    signedIn: boolean;
    initialCards: CardView[];
}) {
    const { cards, save, update, setChat } = useCards(initialCards);
    const chatRef = useRef<UIMessage[]>([]);
    const [mode, setMode] = useState<ReaderMode>({ kind: "closed" });
    const [gist, setGist] = useState("");
    const [title, setTitle] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isChatting, setIsChatting] = useState(false);
    const [isChatBusy, setIsChatBusy] = useState(false);

    // The book is rendered outside this component.
    const book = useSyncExternalStore(
        noSubscribe,
        () => document.getElementById("book"),
        () => null,
    );
    const bookText = book?.textContent ?? "";

    const openCard = cards.find((card) => mode.kind === "card" && card.id === mode.id);
    let hasChanges = false;
    if (mode.kind === "draft") {
        hasChanges = Boolean(gist.trim() || title.trim());
    } else if (openCard) {
        hasChanges = gist.trim() !== openCard.gist || title.trim() !== openCard.title;
    }
    // A started chat is work too: clicking the book shouldn't close the panel on it.
    const keepOpen = hasChanges || isChatting;

    function showPanel(next: ReaderMode) {
        setMode(next);
        setError(null);
        setIsChatting(false);
        const card = next.kind === "card" ? cards.find((card) => card.id === next.id) : undefined;
        chatRef.current = card?.chat ?? [];
        setGist(card?.gist ?? "");
        setTitle(card?.title ?? "");
    }

    const located = useMemo(
        () =>
            cards
                .map((card) => ({
                    card,
                    pos: card.quote
                        ? findAnchor(bookText, {
                            quote: card.quote,
                            prefix: card.quotePrefix ?? "",
                            suffix: card.quoteSuffix ?? "",
                        })
                        : null,
                }))
                .sort((first, second) => (first.pos?.start ?? Infinity) - (second.pos?.start ?? Infinity)),
        [cards, bookText],
    );

    const blockStarts = useMemo(() => {
        const starts = new Map<Element, number>();
        let offset = 0;
        for (const element of Array.from(book?.children ?? [])) {
            starts.set(element, offset);
            offset += element.textContent?.length ?? 0;
        }
        return starts;
    }, [book]);

    const keepOpenRef = useRef(keepOpen);
    const locatedRef = useRef(located);
    const openCardRef = useRef((id: string) => showPanel({ kind: "card", id }));
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        keepOpenRef.current = keepOpen;
        locatedRef.current = located;
        openCardRef.current = (id: string) => showPanel({ kind: "card", id });
    });
    useEffect(() => {
        if (!book) {
            return;
        }
        const onPointerUp = (event: PointerEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target)) {
                return;
            }
            const offsets = selectionOffsets(book);
            if (offsets) {
                setMode({ kind: "draft", anchor: createAnchor(bookText, offsets.start, offsets.end) });
                setGist("");
                setTitle("");
                setError(null);
                setIsChatting(false);
                chatRef.current = [];
                window.getSelection()?.removeAllRanges();
                return;
            }
            if (keepOpenRef.current) {
                return;
            }
            const hit = cardAt(book, blockStarts, locatedRef.current, event.clientX, event.clientY);
            if (hit) {
                openCardRef.current(hit);
            }
            else {
                setMode({ kind: "closed" });
            }
        };
        document.addEventListener("pointerup", onPointerUp);
        return () => {
            document.removeEventListener("pointerup", onPointerUp);
        };
    }, [book, bookText, blockStarts]);

    const [hoverId, setHoverId] = useState<string | null>(null);
    useEffect(() => {
        if (!book) {
            return;
        }
        let frame = 0;
        const onMove = (event: PointerEvent) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() =>
                setHoverId(cardAt(book, blockStarts, locatedRef.current, event.clientX, event.clientY)),
            );
        };
        const onLeave = () => setHoverId(null);
        book.addEventListener("pointermove", onMove);
        book.addEventListener("pointerleave", onLeave);
        return () => {
            cancelAnimationFrame(frame);
            book.removeEventListener("pointermove", onMove);
            book.removeEventListener("pointerleave", onLeave);
        };
    }, [book, blockStarts]);
    useEffect(() => {
        if (!book) {
            return;
        }

        if (hoverId) {
            document.documentElement.dataset.hoverCard = "";
        }
        else {
            delete document.documentElement.dataset.hoverCard;
        }
        const pos = located.find((entry) => entry.card.id === hoverId)?.pos;
        paint("fiche-hover", [pos ? rangeAt(book, pos) : null]);
    }, [book, hoverId, located]);

    useEffect(() => {
        if (!book) {
            return;
        }
        paint(
            "fiche-card",
            located.map(({ pos }) => pos && rangeAt(book, pos)),
        );
        const active =
            mode.kind === "draft"
                ? findAnchor(bookText, mode.anchor)
                : mode.kind === "card"
                    ? (located.find((entry) => entry.card.id === mode.id)?.pos ?? null)
                    : null;
        paint("fiche-draft", [active && rangeAt(book, active)]);
    }, [book, bookText, located, mode]);

    const open = mode.kind !== "closed";
    useEffect(() => {
        document.documentElement.dataset.drawer = open ? "open" : "closed";
        return () => {
            delete document.documentElement.dataset.drawer;
        };
    }, [open]);

    function scrollToCard(id: string, behavior: ScrollBehavior = "smooth") {
        showPanel({ kind: "card", id });
        const pos = located.find((entry) => entry.card.id === id)?.pos;
        if (!book || !pos) {
            return;
        }
        requestAnimationFrame(() => {
            const range = rangeAt(book, pos);
            if (!range) {
                return;
            }
            const top = range.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3;
            window.scrollTo({ top: Math.max(0, top), behavior });
        });
    }

    const scrollToCardRef = useRef(scrollToCard);
    useEffect(() => {
        scrollToCardRef.current = scrollToCard;
    });
    const arrived = useRef(false);
    useEffect(() => {
        const id = window.location.hash.match(/^#card-([0-9a-f-]{36})$/)?.[1];
        if (arrived.current || !id || !located.some((entry) => entry.card.id === id && entry.pos)) {
            return;
        }
        arrived.current = true;

        void document.fonts.ready.then(() => scrollToCardRef.current(id, "instant"));
    }, [located]);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (isSaving || isChatBusy) {
            return;
        }
        setIsSaving(true);
        setError(null);
        if (mode.kind === "draft") {
            const anchor = mode.anchor;
            const result = await save({
                textSlug: slug,
                quote: anchor.quote,
                quotePrefix: anchor.prefix,
                quoteSuffix: anchor.suffix,
                gist,
                title,
                chat: chatRef.current,
            });
            setIsSaving(false);
            if (!result.ok) {
                setError(result.error);
                return;
            }

            window.getSelection()?.removeAllRanges();
            if (isChatting) {
                setMode({ kind: "card", id: result.card.id });
            } else {
                setMode({ kind: "closed" });
            }
        } else if (openCard) {
            const result = await update(openCard.id, { gist, title });
            setIsSaving(false);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setGist(result.card.gist);
            setTitle(result.card.title);
        }
    }

    return (
        <div ref={panelRef}>
            {!open && (
                <button
                    type="button"
                    onClick={() => showPanel({ kind: "list" })}
                    className="fixed right-6 bottom-6 z-20 flex min-h-11 items-center gap-2 rounded-full border border-field bg-surface px-4 font-medium shadow-[0_2px_8px_rgba(23,23,28,0.08)] hover:border-foreground"
                >
                    Cards{cards.length > 0 && <span className="text-muted">· {cards.length}</span>}
                </button>
            )}

            {open && (
                <ReaderDrawer
                    mode={mode}
                    slug={slug}
                    signedIn={signedIn}
                    located={located}
                    openCard={openCard}
                    gist={gist}
                    title={title}
                    error={error}
                    isSaving={isSaving}
                    isChatBusy={isChatBusy}
                    onChatBusyChange={setIsChatBusy}
                    hasChanges={hasChanges}
                    onGistChange={setGist}
                    onTitleChange={setTitle}
                    onSubmit={handleSubmit}
                    onClose={() => setMode({ kind: "closed" })}
                    onShowList={() => showPanel({ kind: "list" })}
                    onOpenCard={scrollToCard}
                    onChatSend={() => setIsChatting(true)}
                    onChatMessages={(messages) => {
                        chatRef.current = messages;
                        if (mode.kind === "card") {
                            setChat(mode.id, messages);
                        }
                    }}
                />
            )}
        </div>
    );
}
