import { type JSONContent } from "@tiptap/core";
import Mention, { type MentionNodeAttrs, type MentionOptions } from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";
import { PluginKey } from "@tiptap/pm/state";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { citationText, splitCitations, type EssayCard } from "@/lib/essays/essay";
import { isFinishedCitation, matchCards } from "./mention";

export const citationPluginKey = new PluginKey("cardCitation");

export function essayDocument(body: string, cards: EssayCard[]): JSONContent {
    return {
        type: "doc",
        content: body.split("\n").map((line) => ({
            type: "paragraph",
            content: splitCitations(line, cards).map((segment) => {
                if ("card" in segment) {
                    return {
                        type: "mention",
                        attrs: {
                            id: segment.card.id,
                            label: segment.card.title,
                        },
                    };
                }
                return { type: "text", text: segment.text };
            }),
        })),
    };
}

export function citationExtensions(
    cards: EssayCard[],
    render?: SuggestionOptions<EssayCard, MentionNodeAttrs>["render"],
) {
    return [
        StarterKit.configure({
            blockquote: false,
            bold: false,
            bulletList: false,
            code: false,
            codeBlock: false,
            dropcursor: false,
            gapcursor: false,
            heading: false,
            horizontalRule: false,
            italic: false,
            link: false,
            listItem: false,
            listKeymap: false,
            orderedList: false,
            strike: false,
            trailingNode: false,
            underline: false,
        }),
        Mention.extend<MentionOptions<EssayCard>>({
            parseHTML() {
                return [
                    { tag: "button[data-type=mention]" },
                    { tag: "a[data-type=mention]" },
                    { tag: "span[data-type=mention]" },
                ];
            },
        }).configure({
            deleteTriggerWithBackspace: true,
            renderText({ node }) {
                return "@" + node.attrs.label;
            },
            renderHTML({ node, options }) {
                return [
                    "button",
                    {
                        ...options.HTMLAttributes,
                        type: "button",
                        "aria-label": "View citation: " + node.attrs.label,
                        "aria-haspopup": "dialog",
                        class: "cursor-pointer rounded bg-accent-soft px-1.5 py-px font-sans text-[15px] text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-accent",
                    },
                    citationText({ id: node.attrs.id, title: node.attrs.label }),
                ];
            },
            suggestion: {
                pluginKey: citationPluginKey,
                char: "@",
                allowSpaces: true,
                allowedPrefixes: [" ", "\n", "\t", "(", "[", "“", "\"", "'"],
                items({ query }) {
                    return isFinishedCitation(cards, query) ? [] : matchCards(cards, query);
                },
                render,
            },
        }),
    ];
}
