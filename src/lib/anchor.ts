export type Anchor = { quote: string; prefix: string; suffix: string };

const CONTEXT = 32;

export function createAnchor(text: string, start: number, end: number): Anchor {
    return {
        quote: text.slice(start, end),
        prefix: text.slice(Math.max(0, start - CONTEXT), start),
        suffix: text.slice(end, end + CONTEXT),
    };
}

export function findAnchor(text: string, anchor: Anchor): { start: number; end: number } | null {
    const contextStart = text.indexOf(anchor.prefix + anchor.quote + anchor.suffix);
    if (contextStart !== -1) {
        const start = contextStart + anchor.prefix.length;
        return { start, end: start + anchor.quote.length };
    }
    const quoteStart = text.indexOf(anchor.quote);
    if (quoteStart !== -1) {
        return { start: quoteStart, end: quoteStart + anchor.quote.length };
    }
    return null;
}
