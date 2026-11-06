export type EssayCard = {
    id: string;
    title: string;
    source: string;
    quote: string | null;
    gist: string;
};

type CardReference = { id: string; title: string };

export function citationText(card: CardReference): string {
    return `@${card.title}`;
}

type EssaySegment = { text: string } | { card: CardReference };

// Splits an essay into text and citations. A citation is "@" at the start or
// after a space or opening bracket/quote (not "me@x"), and the longest matching
// title wins, so "@Fear outlasts love" isn't read as "@Fear" plus text.
export function splitCitations(body: string, cards: CardReference[]): EssaySegment[] {
    const byLength = [...cards].sort((first, second) => second.title.length - first.title.length);
    const segments: EssaySegment[] = [];
    let text = "";
    let index = 0;
    while (index < body.length) {
        const startsCitation = body[index] === "@" && (index === 0 || /[\s(\[“"']/.test(body[index - 1]));
        const card = startsCitation
            ? byLength.find((candidate) => body.startsWith(citationText(candidate), index))
            : undefined;
        if (card) {
            if (text) {
                segments.push({ text });
                text = "";
            }
            segments.push({ card });
            index += citationText(card).length;
        } else {
            text += body[index];
            index += 1;
        }
    }
    if (text) {
        segments.push({ text });
    }
    return segments;
}

export function citedCardIds(body: string, cards: CardReference[]): string[] {
    const ids = splitCitations(body, cards).flatMap((segment) => ("card" in segment ? [segment.card.id] : []));
    return [...new Set(ids)];
}

export function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
