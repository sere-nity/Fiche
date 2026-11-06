// What a chat is about: one passage while reading, or several cards while linking.
// cardId is the card the conversation is saved on, once there is one.
export type ChatContext =
    | { kind: "passage"; textSlug: string; quote: string; cardId?: string }
    | { kind: "link"; cardIds: string[]; cardId?: string };

function quoted(title: string): string {
    return "“" + title + "”";
}

// The first line of every chat is a template, so opening a chat costs no AI call.
export function openingLine(context: ChatContext, titles: string[]): string {
    if (context.kind === "passage") {
        return "What's catching you about this passage?";
    }
    if (titles.length === 2) {
        return "How does " + quoted(titles[0]) + " link to " + quoted(titles[1]) + "?";
    }
    const quotedTitles = titles.map(quoted);
    return "How do " + quotedTitles.slice(0, -1).join(", ") + " and " + quotedTitles.at(-1) + " link?";
}
