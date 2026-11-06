export type CitableCard = { id: string; title: string };
export type CitationCard = CitableCard & { quote: string | null; textSlug: string | null };
export type SessionCard = CitationCard & { source: string; gist: string };

export function citationText(card: CitableCard): string {
    return `@${card.title}`;
}

export type EssaySegment<Card extends CitableCard> = { text: string } | { card: Card };

// Splits an essay into text and citations. A citation is "@" at the start or
// after a space or opening bracket/quote (not "me@x"), and the longest matching
// title wins, so "@Fear outlasts love" isn't read as "@Fear" plus text.
export function splitCitations<Card extends CitableCard>(body: string, cards: Card[]): EssaySegment<Card>[] {
    const byLength = [...cards].sort((first, second) => second.title.length - first.title.length);
    const segments: EssaySegment<Card>[] = [];
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

export function citedCardIds(body: string, cards: CitableCard[]): string[] {
    const ids = splitCitations(body, cards).flatMap((segment) => ("card" in segment ? [segment.card.id] : []));
    return [...new Set(ids)];
}

export function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
