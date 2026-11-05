/**
 * One-off: download public-domain translations from Project Gutenberg, trim
 * front/back matter and editors' notes, and write
 *   data/texts/<slug>.md      the text, one block per paragraph
 *   data/texts/manifest.json  title, author, translator, themes...
 * Both are committed. The app reads them as static content; they never go
 * in the database. Re-running only matters if you change the trimming rules,
 * and any paragraph shift shows up in the .md diff.
 *
 *   npm run texts:prepare          # uses cached downloads in data/raw/
 *
 * Copyright notes (checked Nov 2026):
 * - Marriott (1908, d. 1927), Cotton (1685), Reeve (1840), Hobbes (English
 *   original): public domain everywhere.
 * - Trotter's Pascal (1910) and Cole's Rousseau (1913): public domain in the
 *   US (published before 1931). Cole d. 1959, so not yet PD in UK/EU (2030).
 *   The T. S. Eliot introduction to the Pascal edition is deliberately cut.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { TextMeta } from "../src/lib/texts";

const RAW_DIR = path.join(process.cwd(), "data/raw");
const OUT_DIR = path.join(process.cwd(), "data/texts");

/** A slice of the raw file: from the line matching `start` up to (not including) `end`. */
type Segment = {
  /** Markers matched in order; the slice starts at the last one. Lines are compared after trimEnd. */
  start: (string | RegExp)[];
  end: string | RegExp;
  /** Replace the first `replace` blocks (default 1) with this heading: fixes typos, merges split titles. */
  heading?: string;
  replace?: number;
};

type Source = {
  slug: string;
  gutenbergId: number;
  title: string;
  author: string;
  year: number;
  translator: string | null;
  themes: string[];
  segments: Segment[];
};

const MONTAIGNE_END = /^\s*(CHAPTER [IVXLC]+\.?$|ESSAYS OF MICHEL DE MONTAIGNE|ETEXT EDITOR|\*\*\* END)/;
const montaigne = (heading: string, display?: string): Segment => ({
  start: [heading],
  end: MONTAIGNE_END,
  heading: display ?? heading,
});

const SOURCES: Source[] = [
  {
    slug: "machiavelli-prince",
    gutenbergId: 1232,
    title: "The Prince",
    author: "Niccolò Machiavelli",
    year: 1532,
    translator: "W. K. Marriott (1908)",
    themes: ["power", "state", "morality", "violence", "history"],
    // Stop before the two shorter works bundled in this edition.
    segments: [{ start: ["DEDICATION"], end: /^DESCRIPTION OF THE METHODS ADOPTED/ }],
  },
  {
    slug: "hobbes-leviathan-1",
    gutenbergId: 3207,
    title: "Leviathan, Part I: Of Man",
    author: "Thomas Hobbes",
    year: 1651,
    translator: null,
    themes: ["power", "state", "nature", "reason", "language", "religion", "violence", "justice"],
    segments: [{ start: ["THE INTRODUCTION"], end: "PART II." }],
  },
  {
    slug: "rousseau-social-contract",
    gutenbergId: 46333,
    title: "The Social Contract",
    author: "Jean-Jacques Rousseau",
    year: 1762,
    translator: "G. D. H. Cole (1913)",
    themes: ["freedom", "state", "law", "justice", "equality", "power"],
    // Skip Cole's introduction and the table of contents; stop before the Discourses.
    segments: [
      {
        start: ["A DISCOURSE ON POLITICAL ECONOMY", "THE SOCIAL CONTRACT"],
        end: "A DISCOURSE",
        heading: "THE SOCIAL CONTRACT, OR PRINCIPLES OF POLITICAL RIGHT",
        replace: 4,
      },
    ],
  },
  {
    slug: "montaigne-essays-selection",
    gutenbergId: 3600,
    title: "Essays (a selection)",
    author: "Michel de Montaigne",
    year: 1580,
    translator: "Charles Cotton (1685), ed. W. C. Hazlitt",
    themes: ["culture", "death", "self", "custom", "nature", "time", "morality"],
    segments: [
      montaigne("THAT TO STUDY PHILOSOPY IS TO LEARN TO DIE", "THAT TO STUDY PHILOSOPHY IS TO LEARN TO DIE"),
      montaigne("OF CUSTOM, AND THAT WE SHOULD NOT EASILY CHANGE A LAW RECEIVED"),
      montaigne("OF FRIENDSHIP"),
      montaigne("OF CANNIBALS"),
      montaigne("OF SOLITUDE"),
      montaigne("OF REPENTANCE"),
      montaigne("OF EXPERIENCE"),
    ],
  },
  {
    slug: "pascal-pensees",
    gutenbergId: 18269,
    title: "Pensées",
    author: "Blaise Pascal",
    year: 1670,
    translator: "W. F. Trotter (1910)",
    themes: ["religion", "reason", "happiness", "self", "truth", "desire", "science"],
    // Start at Section I (skips the T. S. Eliot introduction), stop before the editor's notes.
    segments: [{ start: ["SECTION I"], end: "NOTES" }],
  },
  {
    slug: "tocqueville-democracy-2",
    gutenbergId: 816,
    title: "Democracy in America, Volume 2",
    author: "Alexis de Tocqueville",
    year: 1840,
    translator: "Henry Reeve (1840)",
    themes: ["equality", "freedom", "state", "society", "religion", "work", "art", "science"],
    // Stop before the appendices (which belong to Volume 1 and include the US Constitution).
    segments: [{ start: [/^De Tocqueville's Preface To The Second Part/], end: "Part I." }],
  },
];

function matches(line: string, m: string | RegExp): boolean {
  const l = line.replace(/\s+$/, "");
  return typeof m === "string" ? l === m : m.test(l);
}

function slice(lines: string[], seg: Segment, label: string): string[] {
  let i = -1;
  for (const marker of seg.start) {
    const next = lines.findIndex((l, idx) => idx > i && matches(l, marker));
    if (next === -1) throw new Error(`${label}: start marker not found: ${marker}`);
    i = next;
  }
  const end = lines.findIndex((l, idx) => idx > i && matches(l, seg.end));
  if (end === -1) throw new Error(`${label}: end marker not found: ${seg.end}`);
  return lines.slice(i, end);
}

// ---------- Gutenberg plain text → Markdown ----------
//
// Output format, one block per paragraph:
//   ## Heading
//   ### 12              a numbered fragment (Pascal)
//   > a line of verse   indented quotation, line breaks kept
//   A plain paragraph, with _italics_.

type Block = { kind: "heading" | "num" | "verse" | "p"; text: string };

const HEADING_WORD = /^(chapter|book|section|part|introduction|dedication|foreword|preface)\b/i;

function gutenbergToBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of raw.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    const lines = chunk.split("\n").map((l) => l.replace(/\s+$/, "")).filter(Boolean);
    if (lines.length === 0) continue;

    const joined = lines.map((l) => l.trim()).join(" ").replace(/\s+/g, " ").trim();
    if (!joined || /^\[Illustration/i.test(joined)) continue;

    if (/^\d{1,4}\.?$/.test(joined)) {
      blocks.push({ kind: "num", text: joined.replace(/\.$/, "") });
    } else if (lines.every((l) => /^ {4,}/.test(l))) {
      blocks.push({ kind: "verse", text: lines.map((l) => l.trim()).join("\n") });
    } else if (isHeading(joined)) {
      blocks.push({ kind: "heading", text: joined });
    } else {
      blocks.push({ kind: "p", text: joined });
    }
  }
  return blocks;
}

function isHeading(s: string): boolean {
  if (s.length > 200) return false;
  const hasLetters = /\p{L}/u.test(s);
  const hasLower = /\p{Ll}/u.test(s);
  if (hasLetters && !hasLower) return true; // ALL CAPS line
  return HEADING_WORD.test(s) && s.length < 160 && !/[.;:,]\s+\p{Ll}/u.test(s.slice(0, 40));
}

function blocksToMarkdown(blocks: Block[]): string {
  const out = blocks.map((b) => {
    switch (b.kind) {
      case "heading":
        return `## ${b.text}`;
      case "num":
        return `### ${b.text}`;
      case "verse":
        return b.text
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n");
      default:
        return b.text;
    }
  });
  return out.join("\n\n") + "\n";
}

/**
 * Editors' footnotes are cut: note paragraphs ("[1] Duke Lodovico was...",
 * "[Footnote a: ...]") are dropped and their in-text markers ("[1]", " *a")
 * removed, so a selected passage contains only the author's words.
 */
function dropNotes(blocks: Block[]): Block[] {
  return blocks
    .filter((b) => !/^(\[(\d+|Footnote)|APOLOGY:)/.test(b.text))
    .map((b) => ({
      ...b,
      text: b.text
        .replace(/\s*\[Footnote [^\]]*\]/g, "")
        .replace(/\[\d+\]/g, "")
        .replace(/ \*[a-z]{1,2}\b/g, ""),
    }));
}

async function loadRaw(id: number): Promise<string> {
  const file = path.join(RAW_DIR, `pg${id}.txt`);
  try {
    await access(file);
  } catch {
    const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
    console.log(`  downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed for ${id}: ${res.status}`);
    await writeFile(file, await res.text());
  }
  return readFile(file, "utf8");
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const manifest: TextMeta[] = [];

  for (const src of SOURCES) {
    const raw = await loadRaw(src.gutenbergId);
    const lines = raw.split(/\r?\n/);
    const blocks: Block[] = [];

    for (const seg of src.segments) {
      const segBlocks = dropNotes(gutenbergToBlocks(slice(lines, seg, src.slug).join("\n")));
      if (seg.heading) segBlocks.splice(0, seg.replace ?? 1, { kind: "heading", text: seg.heading });
      blocks.push(...segBlocks);
    }

    const md = blocksToMarkdown(blocks);
    await writeFile(path.join(OUT_DIR, `${src.slug}.md`), md);
    manifest.push({
      slug: src.slug,
      title: src.title,
      author: src.author,
      year: src.year,
      translator: src.translator,
      source: `Project Gutenberg #${src.gutenbergId}`,
      themes: src.themes,
    });
    console.log(`✓ ${src.slug}.md: ${blocks.length} paragraphs, ${(md.length / 1024).toFixed(0)} KB`);
  }

  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ manifest.json: ${manifest.length} texts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
