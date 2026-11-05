/**
 * Text-quote anchoring for highlights (after the W3C Web Annotation
 * TextQuoteSelector, as used by Hypothesis).
 *
 * A card stores the exact quote plus a little context either side. That
 * survives edits anywhere in the book except inside the quote itself, and the
 * context tells apart a phrase that appears more than once.
 *
 * `text` is the book's plain text (src/lib/book.ts bookText): the same string
 * the browser measures selections against.
 */

export type Anchor = { quote: string; prefix: string; suffix: string };

const CONTEXT = 32;

/** Build an anchor from a selection given as character offsets into `text`. */
export function createAnchor(text: string, start: number, end: number): Anchor {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

/**
 * Find an anchor in `text`. Returns character offsets of the quote, or null if
 * the quote no longer appears. Tries the full context first, then the quote
 * alone (context edited but quote intact).
 */
export function findAnchor(text: string, a: Anchor): { start: number; end: number } | null {
  const withContext = text.indexOf(a.prefix + a.quote + a.suffix);
  if (withContext !== -1) {
    const start = withContext + a.prefix.length;
    return { start, end: start + a.quote.length };
  }
  const bare = text.indexOf(a.quote);
  if (bare !== -1) return { start: bare, end: bare + a.quote.length };
  return null;
}
