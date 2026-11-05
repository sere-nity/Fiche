export type BlockKind = "heading" | "num" | "verse" | "p";
export type Block = { id: string; kind: BlockKind; text: string };
export type Segment = { text: string; em: boolean };

export function parseBook(markdown: string): Block[] {
    return markdown
        .split(/\n\s*\n/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk, index): Block => {
            const id = `p-${String(index + 1).padStart(4, "0")}`;
            if (chunk.startsWith("### ")) {
                return { id, kind: "num", text: chunk.slice(4) };
            }
            if (chunk.startsWith("## ")) {
                return { id, kind: "heading", text: chunk.slice(3) };
            }
            if (chunk.startsWith("> ")) {
                return { id, kind: "verse", text: chunk.split("\n").map((line) => line.replace(/^> ?/, "")).join("\n") };
            }
            return { id, kind: "p", text: chunk };
        });
}

export function segments(text: string): Segment[] {
    return text
        .split(/_([^_\n]+)_/)
        .map((text, index) => ({ text: text, em: index % 2 === 1 }))
        .filter((segment) => segment.text.length > 0);
}
