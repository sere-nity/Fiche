"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion";
import { CloseButton } from "@/app/close-button";
import type { EssayCard } from "@/lib/essays/essay";
import { citationExtensions, citationPluginKey, essayDocument } from "./editor-document";

type Suggestions = SuggestionProps<EssayCard, MentionNodeAttrs>;
type CitationMenu = {
    items: EssayCard[];
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
    cards: EssayCard[];
    onChange: (body: string) => void;
    editable?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<{ card: EssayCard; rect: DOMRect } | null>(null);
    const [menu, setMenu] = useState<CitationMenu | null>(null);

    function closeMenu() {
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
        setMenu({
            items: props.items,
            command: props.command,
            top: rect.bottom - bounds.top + 4,
            left: Math.max(0, Math.min(rect.left - bounds.left, bounds.width - width)),
            width,
        });
    }

    function choose(card: EssayCard) {
        menu?.command({ id: card.id, label: card.title });
        closeMenu();
    }

    function showCitation(target: EventTarget | null) {
        const chip = target instanceof Element ? target.closest<HTMLElement>("[data-type=mention]") : null;
        const card = cards.find((card) => card.id === chip?.dataset.id);
        if (!chip || !card) {
            return;
        }
        closeMenu();
        setPreview({ card, rect: chip.getBoundingClientRect() });
    }

    const editor = useEditor({
        immediatelyRender: false,
        autofocus: "end",
        extensions: citationExtensions(cards, () => ({
            onStart: showMenu,
            onUpdate: showMenu,
            onExit: closeMenu,
        })),
        content: essayDocument(initialBody, cards),
        editorProps: {
            attributes: {
                id: "essay",
                role: "textbox",
                "aria-label": "Your essay",
                "aria-multiline": "true",
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

    return (
        <div
            ref={containerRef}
            className="relative"
            onClick={(event) => showCitation(event.target)}
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
                    aria-label="Your cards"
                    style={{ top: menu.top, left: menu.left, width: menu.width }}
                    className="absolute z-10 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-field bg-surface p-1.5 shadow-[0_8px_24px_rgba(23,23,28,0.12)]"
                >
                    {menu.items.map((card) => (
                        <li key={card.id}>
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => choose(card)}
                                className="flex w-full cursor-pointer justify-between gap-2 rounded-md p-2.5 text-left hover:bg-accent-soft"
                            >
                                <span>{card.title}</span>
                                {card.source && <span className="shrink-0 text-xs text-muted">{card.source}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
