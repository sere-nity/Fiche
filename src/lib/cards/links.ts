import { z } from "zod";
import type { CardLink } from "./card-view";

export const SourceIdsSchema = z.array(z.string().uuid())
    .max(12)
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length >= 2, "Choose at least two different cards.");

export function wouldCreateCycle(links: CardLink[], cardId: string, sourceId: string): boolean {
    const pending = [sourceId];
    const visited = new Set<string>();
    while (pending.length > 0) {
        const id = pending.pop()!;
        if (id === cardId) {
            return true;
        }
        if (!visited.has(id)) {
            visited.add(id);
            pending.push(...links.filter((link) => link.cardId === id).map((link) => link.sourceId));
        }
    }
    return false;
}
