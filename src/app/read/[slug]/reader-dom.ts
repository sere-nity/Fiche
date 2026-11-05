import type { CardView } from "@/lib/cards/card-view";

export type TextPosition = { start: number; end: number };
export type LocatedCard = { card: CardView; pos: TextPosition | null };

export function cardAt(
    book: HTMLElement,
    blockStarts: Map<Element, number>,
    located: LocatedCard[],
    x: number,
    y: number,
): string | null {
    const caret = caretAt(x, y);
    if (!caret || !book.contains(caret.node)) {
        return null;
    }
    let block: Element | null = caret.node instanceof Element ? caret.node : caret.node.parentElement;
    while (block && block.parentElement !== book) {
        block = block.parentElement;
    }
    const blockStart = block ? blockStarts.get(block) : undefined;
    if (!block || blockStart === undefined) {
        return null;
    }

    const upToCaret = document.createRange();
    upToCaret.setStart(block, 0);
    upToCaret.setEnd(caret.node, caret.offset);
    const offset = blockStart + upToCaret.toString().length;

    for (const { card, pos } of located) {
        if (!pos || offset < pos.start || offset > pos.end) {
            continue;
        }
        const rects = rangeAt(book, pos)?.getClientRects() ?? [];
        if (Array.from(rects).some((range) => x >= range.left && x <= range.right && y >= range.top && y <= range.bottom)) {
            return card.id;
        }
    }
    return null;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
    if (typeof document.caretPositionFromPoint === "function") {
        const position = document.caretPositionFromPoint(x, y);
        return position ? { node: position.offsetNode, offset: position.offset } : null;
    }
    const range = document.caretRangeFromPoint?.(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

export function selectionOffsets(root: HTMLElement): TextPosition | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        return null;
    }

    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    let start = before.toString().length;
    let end = start + range.toString().length;

    const text = root.textContent ?? "";
    while (start < end && /\s/.test(text[start])) {
        start++;
    }
    while (end > start && /\s/.test(text[end - 1])) {
        end--;
    }
    if (end <= start) {
        return null;
    }
    while (start > 0 && WORD_CHAR.test(text[start - 1]) && WORD_CHAR.test(text[start])) {
        start--;
    }
    while (end < text.length && WORD_CHAR.test(text[end]) && WORD_CHAR.test(text[end - 1])) {
        end++;
    }

    while (start < end && /[\s,;:.!?)\]]/.test(text[start])) {
        start++;
    }
    return end > start ? { start, end } : null;
}

export function rangeAt(root: HTMLElement, { start, end }: TextPosition): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0;
    let started = false;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const length = node.data.length;
        if (!started && start < pos + length) {
            range.setStart(node, start - pos);
            started = true;
        }
        if (started && end <= pos + length) {
            range.setEnd(node, end - pos);
            return range;
        }
        pos += length;
    }
    return null;
}

export function paint(name: string, ranges: (Range | null)[]) {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) {
        return;
    }
    const valid = ranges.filter((range): range is Range => range !== null);
    if (valid.length === 0) {
        CSS.highlights.delete(name);
    }
    else {
        CSS.highlights.set(name, new Highlight(...valid));
    }
}
