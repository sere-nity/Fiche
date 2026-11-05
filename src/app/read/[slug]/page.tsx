import { Fragment, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getLearner } from "@/lib/session";
import { getBook, getTextMeta, TEXTS } from "@/lib/texts";
import { segments, type Block } from "@/lib/book";
import { toCardView } from "@/lib/cards/card-view";
import { ReaderPanel } from "./reader-panel";

type Params = PageProps<"/read/[slug]">["params"];

/** Prerender all six books at build time. */
export function generateStaticParams() {
  return TEXTS.map((t) => ({ slug: t.slug }));
}

/**
 * The page itself only holds what's the same for every book (the reading
 * column), so Next can prefetch one shared shell for all /read/* links.
 * Everything that depends on which book sits in <Suspense>.
 */
export default function ReadPage({ params }: PageProps<"/read/[slug]">) {
  return (
    // #reader-main makes room for the cards drawer on mid-size screens (see globals.css).
    <main id="reader-main" className="flex-1 px-6 pt-10 pb-24 transition-[padding] duration-200 sm:px-8">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-1.5">
        <Link href="/" className="text-[13px] text-accent hover:text-accent-hover">
          ← Library
        </Link>
        <Suspense fallback={<p className="mt-6 text-muted">Opening the book…</p>}>
          <Book params={params} />
        </Suspense>
      </div>
      {/* The cards drawer: depends on who's signed in, so it streams in. */}
      <Suspense>
        <Panel params={params} />
      </Suspense>
    </main>
  );
}

async function Book({ params }: { params: Params }) {
  const { slug } = await params;
  const meta = getTextMeta(slug);
  if (!meta) notFound();
  const blocks = await getBook(slug);

  return (
    <>
      <span className="text-xs tracking-[0.06em] text-muted uppercase">
        {meta.author} · {meta.year}
        {meta.translator ? ` · tr. ${meta.translator}` : ""}
      </span>
      <h1 className="mb-6 font-serif text-[32px] leading-[1.15]">{meta.title}</h1>
      {/* #book-margin holds the dots beside saved passages (placed by ReaderPanel). */}
      <div className="relative">
        <div id="book-margin" className="absolute inset-y-0 -left-5 w-2 sm:-left-7" />
        <BookText blocks={blocks} />
      </div>
    </>
  );
}

async function Panel({ params }: { params: Params }) {
  const { slug } = await params;
  if (!getTextMeta(slug)) return null;
  const learner = await getLearner();
  const rows = learner
    ? await getDb()
        .select()
        .from(schema.cards)
        .where(and(eq(schema.cards.learnerId, learner.id), eq(schema.cards.textSlug, slug)))
    : [];
  return <ReaderPanel slug={slug} signedIn={Boolean(learner)} initialCards={rows.map(toCardView)} />;
}

/**
 * The book. Highlights are measured in characters of #book's textContent, so
 * keep only the book's blocks inside #book (no buttons or labels).
 */
function BookText({ blocks }: { blocks: Block[] }) {
  return (
    <article id="book" className="font-serif text-xl leading-[1.65]">
      {blocks.map((b) => {
        const inline = segments(b.text).map((s, i) =>
          s.em ? <em key={i}>{s.text}</em> : <Fragment key={i}>{s.text}</Fragment>,
        );
        switch (b.kind) {
          case "heading":
            return (
              // Source headings are ALL CAPS, so they're set smaller and spaced rather than large.
              <h2 key={b.id} id={b.id} className="mt-14 mb-2 font-serif text-[17px] font-semibold leading-snug tracking-[0.04em]">
                {inline}
              </h2>
            );
          case "num":
            return (
              <h3 key={b.id} id={b.id} className="mt-10 font-sans text-xs text-muted">
                {inline}
              </h3>
            );
          case "verse":
            return (
              <p key={b.id} id={b.id} className="my-5 whitespace-pre-line pl-6 italic">
                {inline}
              </p>
            );
          default:
            return (
              <p key={b.id} id={b.id} className="my-5">
                {inline}
              </p>
            );
        }
      })}
    </article>
  );
}
