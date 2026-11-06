"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { CloseButton } from "@/app/close-button";
import type { SessionCard } from "@/lib/essays/essay";
import { citationExtensions, citationPluginKey, essayDocument } from "./editor-document";

type Suggestions = SuggestionProps<SessionCard, MentionNodeAttrs>;
type CitationMenu = {
    items: SessionCard[];
    command: Suggestions["command"];
    top: number;
    left: number;
    width: number;
};

export function CitationEditor({
    initialBody,
    cards,
    onChange,
    editable = true,
}: {
    initialBody: string;
    cards: SessionCard[];
    onChange: (body: string) => void;
    editable?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<{ card: SessionCard; rect: DOMRect } | null>(null);
    const menuRef = useRef<CitationMenu | null>(null);
    const highlightedRef = useRef(0);
    const [menu, setMenu] = useState<CitationMenu | null>(null);
    const [highlighted, setHighlighted] = useState(0);

    function closeMenu() {
        menuRef.current = null;
        setMenu(null);
    }

    function showMenu(props: Suggestions) {
        const container = containerRef.current;
        const rect = props.clientRect?.();
        if (!container || !rect || props.items.length === 0) {
            closeMenu();
            return;
        }
        const bounds = container.getBoundingClientRect();
        const width = Math.min(320, bounds.width);
        const next = {
            items: props.items,
            command: props.command,
            top: rect.bottom - bounds.top + 4,
            left: Math.max(0, Math.min(rect.left - bounds.left, bounds.width - width)),
            width,
        };
        menuRef.current = next;
        highlightedRef.current = 0;
        setMenu(next);
        setHighlighted(0);
    }

    function highlight(index: number) {
        highlightedRef.current = index;
        setHighlighted(index);
    }

    function choose(card: SessionCard) {
        const current = menuRef.current;
        closeMenu();
        current?.command({ id: card.id, label: card.title });
    }

    function showCitation(target: EventTarget | null) {
        const chip = target instanceof Element ? target.closest<HTMLElement>("[data-type=mention]") : null;
        const card = cards.find((card) => card.id === chip?.dataset.id);
        if (!chip || !card) {
            return false;
        }
        closeMenu();
        setPreview({ card, rect: chip.getBoundingClientRect() });
        return true;
    }

    const editor = useEditor({
        immediatelyRender: false,
        autofocus: "end",
        extensions: citationExtensions(cards, () => ({
            onStart: showMenu,
            onUpdate: showMenu,
            onExit: closeMenu,
            onKeyDown({ event }) {
                const current = menuRef.current;
                if (!current || event.isComposing) {
                    return false;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    highlight((highlightedRef.current + direction + current.items.length) % current.items.length);
                    return true;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                    event.preventDefault();
                    choose(current.items[highlightedRef.current]);
                    return true;
                }
                if (event.key === "Escape") {
                    closeMenu();
                    return true;
                }
                return false;
            },
        })),
        content: essayDocument(initialBody, cards),
        editorProps: {
            attributes: {
                id: "essay",
                role: "combobox",
                "aria-label": "Your essay",
                "aria-multiline": "true",
                "aria-autocomplete": "list",
                "aria-expanded": "false",
                class: "min-h-[50vh] w-full whitespace-pre-wrap break-words bg-transparent font-serif text-[19px] leading-[1.65] outline-none [&_p]:m-0",
            },
        },
        onUpdate({ editor }) {
            onChange(editor.getText({ blockSeparator: "\n" }));
        },
        onBlur({ editor }) {
            closeMenu();
            exitSuggestion(editor.view, citationPluginKey);
        },
    });

    useEffect(() => {
        editor?.setEditable(editable, false);
    }, [editor, editable]);

    function closePreview() {
        previewRef.current?.hidePopover();
        editor?.commands.focus();
    }

    useEffect(() => {
        const element = previewRef.current;
        if (!preview || !element) {
            return;
        }
        element.showPopover();
        const { width, height } = element.getBoundingClientRect();
        const below = preview.rect.bottom + 8;
        element.style.left = Math.max(16, Math.min(preview.rect.left, window.innerWidth - width - 16)) + "px";
        element.style.top = (below + height <= window.innerHeight - 16
            ? below : Math.max(16, preview.rect.top - height - 8)) + "px";
    }, [preview]);

    useEffect(() => {
        if (!editor) {
            return;
        }
        const element = editor.view.dom;
        element.setAttribute("aria-expanded", String(Boolean(menu)));
        if (menu) {
            element.setAttribute("aria-controls", "card-menu");
            element.setAttribute("aria-activedescendant", "card-option-" + highlighted);
        } else {
            element.removeAttribute("aria-controls");
            element.removeAttribute("aria-activedescendant");
        }
    }, [editor, menu, highlighted]);

    return (
        <div
            ref={containerRef}
            className="relative"
            onClick={(event) => showCitation(event.target)}
            onKeyDownCapture={(event) => {
                if (event.key === "Escape" && previewRef.current?.matches(":popover-open")) {
                    closePreview();
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                if ((event.key === "Enter" || event.key === " ") && showCitation(event.target)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }}
        >
            <EditorContent editor={editor} />
            {(!editor || editor.isEmpty) && (
                <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 font-serif text-[19px] leading-[1.65] text-faint">
                    Turn the question into a tension, then argue one side, then the other. Type @ to cite a card.
                </p>
            )}
            {preview && (
                <div
                    ref={previewRef}
                    popover="auto"
                    role="dialog"
                    aria-label="Citation preview"
                    className="fixed inset-auto m-0 max-h-[calc(100dvh-32px)] w-[360px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[10px] border border-field bg-surface p-4 text-foreground shadow-[0_8px_24px_rgba(23,23,28,0.12)]"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-medium">{preview.card.title}</h2>
                            <p className="mt-1 text-xs text-muted">{preview.card.source || "Your synthesis"}</p>
                        </div>
                        <CloseButton onClick={closePreview} />
                    </div>
                    {preview.card.quote && (
                        <blockquote className="mt-3 rounded-lg bg-quote p-3 font-serif text-base leading-normal">
                            “{preview.card.quote}”
                        </blockquote>
                    )}
                    <p className="mt-3 text-sm leading-normal">{preview.card.gist}</p>
                </div>
            )}
            {menu && (
                <ul
                    id="card-menu"
                    role="listbox"
                    aria-label="Your cards"
                    style={{ top: menu.top, left: menu.left, width: menu.width }}
                    className="absolute z-10 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-field bg-surface p-1.5 shadow-[0_8px_24px_rgba(23,23,28,0.12)]"
                >
                    {menu.items.map((card, index) => (
                        <li
                            key={card.id}
                            id={"card-option-" + index}
                            role="option"
                            aria-selected={index === highlighted}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(card)}
                            onMouseEnter={() => highlight(index)}
                            className={"flex cursor-pointer justify-between gap-2 rounded-md p-2.5 " + (index === highlighted ? "bg-accent-soft" : "")}
                        >
                            <span className={index === highlighted ? "font-medium" : ""}>{card.title}</span>
                            {card.source && <span className="shrink-0 text-xs text-muted">{card.source}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
