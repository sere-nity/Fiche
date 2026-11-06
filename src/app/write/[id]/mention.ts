import type { EssayCard } from "@/lib/essays/essay";

const MAX_MATCHES = 6;

export function matchCards(cards: EssayCard[], query: string): EssayCard[] {
    const needle = query.trim().toLowerCase();
    return cards
        .filter((card) => card.title.toLowerCase().includes(needle))
        .sort((first, second) => {
            const firstStarts = first.title.toLowerCase().startsWith(needle) ? 0 : 1;
            const secondStarts = second.title.toLowerCase().startsWith(needle) ? 0 : 1;
            return firstStarts - secondStarts;
        })
        .slice(0, MAX_MATCHES);
}

export function isFinishedCitation(cards: EssayCard[], query: string): boolean {
    const lowered = query.toLowerCase();
    if (cards.some((card) => card.title.toLowerCase().startsWith(lowered))) {
        return false;
    }
    return cards.some((card) => lowered.length > card.title.length && lowered.startsWith(card.title.toLowerCase()));
}
