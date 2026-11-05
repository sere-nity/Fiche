/**
 * A book's .md file (data/texts/<slug>.md) as paragraphs, and the plain text
 * the reader sees.
 *
 * Format, one block per paragraph:
 *   ## Heading
 *   ### 12              a numbered fragment (Pascal)
 *   > a line of verse   indented quotation, line breaks kept
 *   A plain paragraph, with _italics_.
 *
 * Highlights are anchored by character offsets into the rendered book's text
 * (#book's textContent): the browser measures a selection against it and finds
 * saved quotes in it, so the same string is used both ways.
 */

export type BlockKind = "heading" | "num" | "verse" | "p";
export type Block = { id: string; kind: BlockKind; text: string };
export type Segment = { text: string; em: boolean };

export function parseBook(md: string): Block[] {
  return md
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, i): Block => {
      const id = `p-${String(i + 1).padStart(4, "0")}`; // for scrolling only; nothing stores it
      if (chunk.startsWith("### ")) return { id, kind: "num", text: chunk.slice(4) };
      if (chunk.startsWith("## ")) return { id, kind: "heading", text: chunk.slice(3) };
      if (chunk.startsWith("> ")) {
        return { id, kind: "verse", text: chunk.split("\n").map((l) => l.replace(/^> ?/, "")).join("\n") };
      }
      return { id, kind: "p", text: chunk };
    });
}

/** Split "_italic_ words" into styled runs. */
export function segments(text: string): Segment[] {
  return text
    .split(/_([^_\n]+)_/)
    .map((t, i) => ({ text: t, em: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}
