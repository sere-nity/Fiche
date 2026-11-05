"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createAnchor, findAnchor, type Anchor } from "@/lib/anchor";
import { useCards } from "@/lib/cards/use-cards";
import type { CardView } from "@/lib/cards/card-view";

const MAX_WORDS = 60;

type Mode = { kind: "closed" } | { kind: "list" } | { kind: "draft"; anchor: Anchor } | { kind: "card"; id: string };
type Pos = { start: number; end: number };

/**
 * The interactive half of the Reader. The book itself is server-rendered
 * static HTML in #book; this component finds it in the DOM and:
 * - turns a text selection into a draft card (quote + context anchor)
 * - saves cards (pure capture: no AI here), and lets you edit one later
 * - marks saved passages: an underline painted with the CSS Custom Highlight
 *   API (no DOM changes, so it can't fight React), plus a dot in the margin;
 *   clicking either opens that card
 *
 * The panel is a drawer, closed by default so the text has the page. It opens
 * on a selection (new card), a margin dot (that card) or the "Cards" button
 * (this book's cards), and closes when you click away.
 */
export function ReaderPanel({
  slug,
  signedIn,
  initialCards,
}: {
  slug: string;
  signedIn: boolean;
  initialCards: CardView[];
}) {
  const { cards, save, update } = useCards(initialCards);
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [gist, setGist] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The server-rendered book and its margin live outside this component, so
  // read them as external state (null during server rendering).
  const book = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById("book"),
    () => null,
  );
  const margin = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById("book-margin"),
    () => null,
  );
  const bookText = useMemo(() => book?.textContent ?? "", [book]);

  const openCard = cards.find((c) => mode.kind === "card" && c.id === mode.id);
  const dirty =
    mode.kind === "draft"
      ? Boolean(gist.trim() || title.trim())
      : openCard
        ? gist.trim() !== openCard.gist || title.trim() !== openCard.title
        : false;

  function show(next: Mode) {
    setMode(next);
    setError(null);
    const card = next.kind === "card" ? cards.find((c) => c.id === next.id) : undefined;
    setGist(card?.gist ?? "");
    setTitle(card?.title ?? "");
  }

  // Where each card sits in the book (null if its quote can't be found), in reading order.
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
        .sort((a, b) => (a.pos?.start ?? Infinity) - (b.pos?.start ?? Infinity)),
    [cards, bookText],
  );

  // Where each paragraph starts in the book's text, for turning a click into a character offset.
  const blockStarts = useMemo(() => {
    const starts = new Map<Element, number>();
    let n = 0;
    for (const el of Array.from(book?.children ?? [])) {
      starts.set(el, n);
      n += el.textContent?.length ?? 0;
    }
    return starts;
  }, [book]);

  // Selecting text opens a draft. Clicking an underlined passage opens its
  // card. Clicking anywhere else closes the drawer, unless there are unsaved
  // edits. Escape always closes it.
  const dirtyRef = useRef(dirty);
  const locatedRef = useRef(located);
  const openCardRef = useRef((id: string) => show({ kind: "card", id }));
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dirtyRef.current = dirty;
    locatedRef.current = located;
    openCardRef.current = (id: string) => show({ kind: "card", id });
  });
  useEffect(() => {
    if (!book) return;
    const fromSelection = () => {
      const offsets = selectionOffsets(book);
      if (!offsets) return false;
      setMode({ kind: "draft", anchor: createAnchor(bookText, offsets.start, offsets.end) });
      setGist("");
      setTitle("");
      setError(null);
      return true;
    };
    const onPointerUp = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || margin?.contains(target)) return;
      if (fromSelection()) {
        // The lime highlight now shows the word-snapped passage; drop the
        // browser's own selection so the two don't overlap.
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (dirtyRef.current) return; // don't throw away unsaved edits
      const hit = cardAt(book, blockStarts, locatedRef.current, e.clientX, e.clientY);
      if (hit) openCardRef.current(hit);
      else setMode({ kind: "closed" });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode({ kind: "closed" });
      else fromSelection(); // keyboard selection (shift + arrows); keep it so it can be extended
    };
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [book, margin, bookText, blockStarts]);

  // Hovering an underlined passage: pointer cursor and a faint wash, so it reads as clickable.
  const [hoverId, setHoverId] = useState<string | null>(null);
  useEffect(() => {
    if (!book) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setHoverId(cardAt(book, blockStarts, locatedRef.current, e.clientX, e.clientY)),
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
    if (!book) return;
    // Cursor via an attribute on <html> (styled in globals.css), like the drawer flag.
    if (hoverId) document.documentElement.dataset.hoverCard = "";
    else delete document.documentElement.dataset.hoverCard;
    const pos = located.find((l) => l.card.id === hoverId)?.pos;
    paint("fiche-hover", [pos ? rangeAt(book, pos) : null]);
  }, [book, hoverId, located]);

  // Paint: saved passages underlined; the draft (or the opened card) in lime.
  useEffect(() => {
    if (!book) return;
    paint(
      "fiche-card",
      located.map(({ pos }) => pos && rangeAt(book, pos)),
    );
    const active =
      mode.kind === "draft"
        ? findAnchor(bookText, mode.anchor)
        : mode.kind === "card"
          ? (located.find((l) => l.card.id === mode.id)?.pos ?? null)
          : null;
    paint("fiche-draft", [active && rangeAt(book, active)]);
  }, [book, bookText, located, mode]);

  const dots = useMarginDots(book, margin, located);

  // Tell the page the drawer is open, so it can make room on mid-size screens (globals.css).
  const open = mode.kind !== "closed";
  useEffect(() => {
    document.documentElement.dataset.drawer = open ? "open" : "closed";
    return () => {
      delete document.documentElement.dataset.drawer;
    };
  }, [open]);

  function jumpTo(id: string) {
    const pos = located.find((l) => l.card.id === id)?.pos;
    const range = book && pos ? rangeAt(book, pos) : null;
    if (range) {
      const top = range.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3;
      window.scrollTo({ top, behavior: "smooth" });
    }
    show({ kind: "card", id });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode.kind === "draft") {
      const a = mode.anchor;
      const r = await save({
        textSlug: slug,
        quote: a.quote,
        quotePrefix: a.prefix,
        quoteSuffix: a.suffix,
        gist,
        title,
      });
      setBusy(false);
      if (!r.ok) return setError(r.error);
      // Back to reading: the new underline and margin dot confirm the save.
      window.getSelection()?.removeAllRanges();
      setMode({ kind: "closed" });
    } else if (openCard) {
      const r = await update(openCard.id, { gist, title });
      setBusy(false);
      if (!r.ok) return setError(r.error);
      setGist(r.card.gist);
      setTitle(r.card.title);
    }
  }

  const quote = mode.kind === "draft" ? mode.anchor.quote : (openCard?.quote ?? "");
  const words = quote.trim().split(/\s+/).filter(Boolean).length;
  const tooLong = mode.kind === "draft" && words > MAX_WORDS;

  return (
    <div ref={panelRef}>
      {margin &&
        dots.map((d) =>
          createPortal(
            <button
              key={d.id}
              type="button"
              aria-label={`Open card: ${d.title}`}
              onClick={() => jumpTo(d.id)}
              style={{ top: d.top }}
              className={`absolute left-0 h-2 w-2 rounded-full before:absolute before:-inset-3 before:content-[''] ${
                mode.kind === "card" && mode.id === d.id ? "bg-foreground" : "bg-accent"
              }`}
            />,
            margin,
            d.id,
          ),
        )}

      {!open && (
        <button
          type="button"
          onClick={() => show({ kind: "list" })}
          className="fixed right-6 bottom-6 z-20 flex min-h-11 items-center gap-2 rounded-full border border-field bg-surface px-4 font-medium shadow-[0_2px_8px_rgba(23,23,28,0.08)] hover:border-foreground"
        >
          Cards{cards.length > 0 && <span className="text-muted">· {cards.length}</span>}
        </button>
      )}

      {open && (
        // The drawer: a bottom sheet on small screens, a full-height panel on the right from lg up.
        <div className="fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto border-t border-rule bg-surface shadow-2xl lg:inset-y-0 lg:left-auto lg:max-h-none lg:w-[380px] lg:border-t-0 lg:border-l lg:shadow-[-8px_0_24px_rgba(23,23,28,0.06)]">
          {mode.kind === "list" || (mode.kind === "card" && !openCard) ? (
            <CardList
              signedIn={signedIn}
              slug={slug}
              located={located}
              onOpen={jumpTo}
              onClose={() => setMode({ kind: "closed" })}
            />
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-7">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold">{mode.kind === "draft" ? "New card" : "Card"}</h2>
                <div className="flex items-center gap-1">
                  {mode.kind === "card" && (
                    <button
                      type="button"
                      onClick={() => show({ kind: "list" })}
                      className="px-2 text-[13px] text-accent"
                    >
                      All cards
                    </button>
                  )}
                  <CloseButton onClick={() => setMode({ kind: "closed" })} />
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
                      onChange={(e) => setGist(e.target.value)}
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
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={80}
                      className="min-h-11 w-full rounded-lg border border-field px-3 text-[15px] outline-none focus:border-accent"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-warn">
                      {error}
                    </p>
                  )}

                  {/* Right under the fields, not pinned to the bottom of the drawer, so it's always in view. */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode({ kind: "closed" })}
                      className="min-h-11 flex-1 rounded-lg border border-field bg-surface font-medium hover:border-foreground"
                    >
                      {mode.kind === "draft" ? "Discard" : "Done"}
                    </button>
                    <button
                      disabled={busy || tooLong || (mode.kind === "card" && !dirty)}
                      className="min-h-11 flex-[2] rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                    >
                      {busy ? "Saving…" : mode.kind === "draft" ? "Save card" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
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
  located: { card: CardView; pos: Pos | null }[];
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

// ---------- margin dots ----------

type Dot = { id: string; title: string; top: number };

/** Vertical position of each located card's first line, relative to the margin column. */
function useMarginDots(
  book: HTMLElement | null,
  margin: HTMLElement | null,
  located: { card: CardView; pos: Pos | null }[],
): Dot[] {
  const [dots, setDots] = useState<Dot[]>([]);
  useLayoutEffect(() => {
    if (!book || !margin) return;
    const measure = () => {
      const origin = margin.getBoundingClientRect().top;
      setDots(
        located.flatMap(({ card, pos }) => {
          const rect = pos && rangeAt(book, pos)?.getClientRects()[0];
          return rect ? [{ id: card.id, title: card.title, top: rect.top - origin + rect.height / 2 - 4 }] : [];
        }),
      );
    };
    // Measure now and whenever the layout shifts: window resize, web fonts arriving.
    const observer = new ResizeObserver(measure);
    observer.observe(book);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [book, margin, located]);
  return dots;
}

// ---------- DOM helpers ----------

/**
 * The saved card whose underlined passage is under the point (x, y), if any.
 * Highlights painted by the CSS Custom Highlight API don't receive events, so:
 * find the character under the pointer, look for a card covering it, then
 * confirm the point is really on that passage's text (not past a line's end).
 */
function cardAt(
  book: HTMLElement,
  blockStarts: Map<Element, number>,
  located: { card: CardView; pos: Pos | null }[],
  x: number,
  y: number,
): string | null {
  const caret = caretAt(x, y);
  if (!caret || !book.contains(caret.node)) return null;
  let block: Element | null = caret.node instanceof Element ? caret.node : caret.node.parentElement;
  while (block && block.parentElement !== book) block = block.parentElement;
  const blockStart = block ? blockStarts.get(block) : undefined;
  if (!block || blockStart === undefined) return null;

  const upToCaret = document.createRange();
  upToCaret.setStart(block, 0);
  upToCaret.setEnd(caret.node, caret.offset);
  const offset = blockStart + upToCaret.toString().length;

  for (const { card, pos } of located) {
    if (!pos || offset < pos.start || offset > pos.end) continue;
    const rects = rangeAt(book, pos)?.getClientRects() ?? [];
    if (Array.from(rects).some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return card.id;
  }
  return null;
}

/** The text position under a point, in whichever API this browser has. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const p = document.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y); // older Safari
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

const noSubscribe = () => () => {}; // the book never changes after load

/** Letters, digits, and apostrophes or hyphens inside words ("prince's", "well-governed"). */
const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/**
 * The current selection as character offsets into root's text: trimmed of
 * surrounding whitespace, then widened to whole words, so dragging from the
 * middle of "you" to the middle of "experience" takes both words in full.
 */
function selectionOffsets(root: HTMLElement): Pos | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  let start = before.toString().length;
  let end = start + range.toString().length;

  const text = root.textContent ?? "";
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end <= start) return null;
  while (start > 0 && WORD_CHAR.test(text[start - 1]) && WORD_CHAR.test(text[start])) start--;
  while (end < text.length && WORD_CHAR.test(text[end]) && WORD_CHAR.test(text[end - 1])) end++;
  // Don't start on stray punctuation left over from the previous clause (", I have…").
  while (start < end && /[\s,;:.!?)\]]/.test(text[start])) start++;
  return end > start ? { start, end } : null;
}

/** A DOM Range covering characters [start, end) of root's text. */
function rangeAt(root: HTMLElement, { start, end }: Pos): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const len = node.data.length;
    if (!started && start < pos + len) {
      range.setStart(node, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

/** Paint ranges under a named highlight (styled in globals.css with ::highlight(name)). */
function paint(name: string, ranges: (Range | null)[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return; // older browsers: no highlights, still works
  const valid = ranges.filter((r): r is Range => r !== null);
  if (valid.length === 0) CSS.highlights.delete(name);
  else CSS.highlights.set(name, new Highlight(...valid));
}
