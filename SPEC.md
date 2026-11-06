# Fiche: prototype spec

Nov 5, 2026 · @Serene

## Product summary

Fiche trains one skill: linking ideas from the great books to an unseen question, the way the French *culture générale* dissertation demands. You read inside the app, save ideas as cards, connect them on a canvas, then write a short timed essay where the only help is your own cards.

**Who it's for.** Curious adults who read the canon and want to *use* it: concours candidates, humanities students, and builders like me who want a framework for how institutions and power work. The first user is me.

**What's hard about learning this.** Not the reading. Ideas get filed by author ("Pascal said..."), but questions arrive by tension ("Does technology liberate?"). When the question lands, nothing in your head is indexed under it, so the idea never surfaces. My own Milanote quote library has a column literally called *Unsorted*. The prep-school answer was the *fiche*: one card per idea, filed by the themes it serves. Most reading tools test recall. The exam tests transfer.

**Design principle.** The AI never makes a connection for you. It reads, questions and judges your connections. If it proposed them, it would do the exact cognitive work the app exists to train.

**Success looks like:**

- A first-time user reads a passage, saves two cards, writes a 300-word mini essay citing them, and gets feedback that clearly knows their library.
- On their second visit, the prompt and the AI's opening are chosen because of what happened on the first.
- Over weeks: more cards cited per essay, from more distant sources, with a rising share of references judged substantive rather than decorative.

## Core loop

The main app supports reading, linking cards and writing essays. The marking rubric and essay-history context in chat are an extension, preserved in the `demo/marking-extension` worktree.

&#91;embedded content: core loop · 4 modes aimed at one question\]

You type the session question, or ask the AI for an unseen one shaped by your history (unused cards, last weakness). It grounds both the canvas chat and the essay.

## Screens and UX

Five screens, plus a sign-in page (email only). Every AI call shows a loading state, and every failure keeps the user's work.

| Screen | What the user does | Key states |
| --- | --- | --- |
| Library | Picks one of six public-domain texts; each shows how many cards you've saved from it and how many are still unused | Empty never happens: the six texts ship with the app |
| Reader | Reads, selects a passage (snapped to whole words), and a drawer asks for the gist (one sentence) and an optional title (a few words; without one, the gist's first words are used). Pure capture: no AI here. Saved passages stay underlined on reread; clicking a saved passage reopens its card for editing | Saving card; save fails (draft kept, error shown); quote over 60 words |
| Canvas (diverge) | Sees cards as nodes, drags them into place (positions saved). Clicking a card shows it, editable, with a link back to its passage in the book. Connects two cards by dragging between their dots, then saves a new synthesis. Dragging card bodies only changes their positions. Selecting several cards or adding more sources is an extension. A drawer opens: the AI asks how these sources combine to answer the session question (the one the next essay is on); the user then writes the synthesis: a title naming the move and a one-sentence claim, optionally tagged with the move (lens, fusion, lineage, counterweight, concession, test case). A synthesis can itself be a source, so connections can be connected. A toolbar toggle sets what every card shows: titles, gists (and claims), or quotes. (Detail that changes automatically with zoom level is cut for simplicity.) | Fewer than 2 cards: prompt to go read; streaming reply; a synthesis with no claim written yet isn't saved |
| Write (converge) | Types a question, then writes a short essay: a tension, then one side, then the other. Types @ to search cards by title; clicking a suggestion inserts a blue citation chip; clicking opens the quote and gist in a small preview without leaving the essay. Autosaves the essay and its citations. There is no submit button in the main app; submission and AI marking are in the extension worktree. No AI assistance while drafting, and no timer | Save fails (shown); no cards cited (allowed) |
| Feedback (extension) | Sees a rubric score per dimension and, for every @ reference, the card quoted with a verdict: does it do argumentative work or is it decoration | Grading pending; grading fails (essay kept, retry button) |

**Citing from titles only.** The card list shows titles, not quotes: you recall the idea from its name, as you would in a closed-book exam. (Separate practice and exam modes are cut.)

**Feedback flows forward.** Each citation's verdict is stored on its card, and the grader's pattern becomes your "last weakness." Both shape the next session's question and feedback.

## AI roles and rules

The AI prompts and judges; it never proposes a connection or writes for the user. Three jobs, each its own endpoint, and none during capture: reading and saving cards stays pure, so the learner's own words come first. Syntheses are never judged on their own: a connection has no ground truth until a question gives it one, so judgement happens only in the essay grader.

| Job | When | Input | Output | Rule |
| --- | --- | --- | --- | --- |
| Question generator | User asks for a question | The learner's unused cards and last weakness | One question in the style of a bac philo or concours subject: a genuine tension, short | Never names a card, author or text; the learner must find which cards apply |
| Synthesis examiner | Synthesis card opened on canvas | Every source card (quote or claim, gist, title) and the session question | Streamed chat turns | Asks how the sources combine to answer the question, using the moves as prompts ("does one reframe the other, or do they make something neither says alone?", "what case would test this?", "what's the strongest objection?"). Never states the connection. Ends by asking the user to write the claim. Gives no verdict |
| Essay grader (extension) | Essay submitted | Question, essay, every cited card in full (for a synthesis: its claim and its sources), the learner's last weakness | Structured: score 1–4 per rubric dimension with a one-line reason; per citation, the card quoted plus verdict (substantive / decorative / misread) and why; one pattern to work on | Must quote each card it judges. No rewrite of the essay. The only place syntheses are judged |

**Rubric dimensions** (loosely after how French dissertations and UK humanities essays are marked): problematisation (turns the question into a real tension), dialectic (both sides argued fairly, not a strawman), use of references (integrated as argument, not ornament), fidelity (references used accurately), clarity.

**Questions.** There is no question bank. The learner types a question, or asks the question generator for an unseen one. The question is stored as plain text on the essay.

**Model calls** use AI SDK `generateText` with `Output.object({ schema })` and Zod schemas for every structured job (`generateObject` is deprecated in current versions), and `streamText` plus `useChat` for the synthesis examiner. Verify against the AI SDK docs for the installed version.

## Personalisation (extension)

There is no separate learner model. Personalisation is two queries over tables that already exist, computed on read so they can't drift from what happened.

**What changes on your next visit:**

1. **The question.** The generator is steered toward tensions your unused cards (saved but never cited) could serve, without naming them.
2. **The feedback.** The grader is told your last pattern ("antithesis was a strawman") and says whether it improved.

**One cheap extra: encoding vs retrieval balance.** A count of cards saved and syntheses written against essays written. When it tips too far, the Library shows a nudge: "34 cards and 1 essay this week; your library is outgrowing your ability to use it." Following Justin Sung, it's a dial rather than two modes, so it stays implicit.

**Cut for the weekend:** examiner personalisation, flagged pairs on the canvas, move-type and source-concentration signals.

They can come back once real usage shows which signals actually predict better essays.

## Data model

Five Postgres tables. Static content stays out of the database: the six books are Markdown files in the repo, and a question is plain text on its essay. Every card and essay belongs to a learner.

**Sign-in.** Email only, no password: the sign-in action finds or creates the learner by email and puts their id in an httpOnly cookie. That gives a returning learner their history from any browser, and lets the demo start from a real library. Anyone who types an email gets that learner, which is acceptable only for a prototype.

| Table | Key fields | Notes |
| --- | --- | --- |
| learners | id, email (unique, lowercased), created\_at | |
| cards | id, learner\_id, kind (quote / synthesis), text\_slug, typed\_source, quote, quote\_prefix, quote\_suffix, gist, title, move, position jsonb (x, y), created\_at | Every canvas node is a card. A quote card holds the selected span (capped at \~60 words); the database rejects a quote card with no quote. A synthesis card has no quote: title names the move, gist is the claim |
| card\_sources | card\_id, source\_id | "This synthesis draws on that card." Many-to-many, so a synthesis can have any number of sources and can itself be a source. These rows are the canvas edges. Cycles are rejected in code |
| essays | id, learner\_id, question (text), mode (practice / exam), body, started\_at, submitted\_at, feedback jsonb (rubric + pattern) | Rubric = per-dimension score + reason |
| citations | id, essay\_id, card\_id, verdict, reason | One row per @ reference, written by the grader. A table, not jsonb, because personalisation queries it |

**Anchoring a highlight.** A quote card points at its passage by text, not position: the quote plus \~32 characters either side (the W3C Web Annotation "TextQuoteSelector", as used by Hypothesis). To show it again, search the book for prefix + quote + suffix, then the quote alone. Fixing a typo elsewhere in a book never breaks a card.

## Stack and architecture

Full-stack TypeScript on Next.js (App Router), deployed to Vercel, with Neon Postgres from day one so local and deployed behave the same.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js App Router, TypeScript | One repo for UI and API routes; deploys to Vercel with no config |
| AI | Vercel AI SDK (`ai`) with OpenRouter (`@openrouter/ai-sdk-provider`, Claude) | Structured output and streaming in one API; model configuration lives in one file |
| Database | Neon Postgres via the Vercel marketplace integration | Server-side persistence; free tier; `DATABASE_URL` works locally too |
| ORM | Drizzle | Typed schema, plain SQL feel, simple migrations |
| Canvas | React Flow (`@xyflow/react`) | Nodes, drag-to-connect edges, pan and zoom out of the box |
| Essay editor | Tiptap with its Mention extension | @ autocomplete over cards without building an editor |
| Validation | Zod | Shared by API input checks and AI output schemas |

**Server actions and routes.** Mutations from the app's own pages are Next.js server actions (typed function calls, no hand-written API). A route handler is used only where a stream is needed.

| Action / route | Does |
| --- | --- |
| `signIn`, `signOut` | Find or create the learner by email, set or clear the cookie |
| `saveQuoteCard`, `updateQuoteCard`, `moveCard` | Validate and insert a quote card; edit its gist or title; save its canvas position |
| `saveSynthesisCard` | Save a synthesis from exactly two source cards |
| POST /api/chat | Stream a passage or synthesis conversation; saved-card chats persist |
| `generateQuestion` | Generate an unseen question |
| `startEssay` | Start an essay with its question text |
| `submitEssay` (extension) | Save body, run the grader, write citations |
| history query (server-side) | Your history: unused cards, last weakness, encoding vs retrieval counts |

**Texts.** Six public-domain English translations from Project Gutenberg: Machiavelli's *The Prince*, Hobbes' *Leviathan* part 1, Rousseau's *Social Contract*, seven Montaigne essays, Pascal's *Pensées* and Tocqueville vol. 2. A one-off script trimmed front matter and editors' notes and wrote one Markdown file per book (`data/texts/<slug>.md`) plus a manifest of titles, authors and themes. The app reads them as static files; they never go in the database. Copyright is noted per translation in the README.

## Build plan

Six milestones in order, each ending in something that runs. Write mode and feedback come before the canvas: they're the forcing function and the "checks understanding" focus, and a plain card list can stand in for the canvas if time runs out. Instruction for Claude Code: do one milestone at a time, stop after each, and explain the files it created so I can walk through them in the interview.

1. **Skeleton and data (about 1 hour). Done.** Next.js app, Drizzle schema and migrations, Postgres connection (local or Neon), anonymous learner cookie, the six texts as static Markdown. *Done when:* `npm run db:migrate` creates the tables and the Library page lists the texts.
2. **Reader, sign-in and cards (about 2 hours). Done.** Email sign-in; render a text by paragraph; select to save a card with gist and optional title, anchored by quote text; saved passages underlined on reread. *Done when:* a saved card survives a refresh and reappears underlined in the text.

   *Cut: an AI gist check on save.* Writing the gist is where the learning happens; a verdict on every card is passive, adds friction while reading, and checks comprehension, which isn't the hard part. Fidelity is still judged where it matters, when a card is cited in an essay.
3. **Write mode (about 1 hour). Done.** Type a question, write with a Tiptap editor, cite cards through the @ menu (inserts inline linked chips), autosave, submit to a review page, edit and resubmit. On submit, the body is saved and one citation row is written per cited card. *Done when:* an essay with two @ citations submits and its body and citations are stored. *Cut for simplicity:* the timer, the AI question generator and practice/exam modes.
4. **Grader and feedback (extension worktree).** Grader endpoint with Zod schema; same-page feedback with rubric and per-citation verdicts. *Done when:* a deliberately name-dropping citation is marked decorative and the reason quotes the card.
5. **Canvas and synthesis (about 2 hours).** React Flow canvas of cards, create a synthesis card by connecting two cards, streamed examiner chat in a drawer, claim and optional move submission, titles / gists / quotes toggle, examiner grounded in the session question. Keep the tooling light: most synthesis still happens while writing the essay. *Done when:* a synthesis of two cards, one of them itself a synthesis, survives a refresh and can be @-cited in an essay.
6. **History and polish (about 1 hour).** History queries (unused cards, last weakness, encoding vs retrieval counts), question generation steered by them, last weakness passed to the grader, a small profile strip on the Library page, loading and error states everywhere. Deploy to Vercel. *Done when:* a second session's generated question visibly targets the first session's unused cards.

## Out of scope, and with more time

Cut for the weekend, in the order I'd add them back:

- **Voice teach-back.** How I actually study: record myself riffing on a card, a link or a week's reading for a few minutes, uninterrupted, as if teaching someone. Only then does the AI tear it down: knowledge gaps, places I contradicted my own cards, open threads I said I wanted to chase, and links I made aloud but never saved. I then push back on its claims, and that argument is retrieval too. Judging speech is fuzzier than judging a 300-word essay, so the feedback is about gaps, not a score.

* **Upload your own books.** EPUB first (it's zipped HTML, so already structured), then .txt, then PDF (the riskiest: running headers, hyphenation, scanned pages with no text). Files go straight from the browser to blob storage, the server extracts text, and the Reader reads it like a built-in book. Showing original PDF pages with highlights comes after that.
* **Essay as a path through the graph.** Pick a question, walk three or four of your own synthesis cards, and their claims become paragraph openers.
* **Spaced revisits.** Bring back cards and syntheses on a schedule, like Anki, but for linking rather than recall.
* **Grand oral mode.** A spoken viva with follow-up questions, using streaming speech-to-text.
* **Full five-hour dissertation** with a plan stage, graded on structure.
* **Real auth.** Email sign-in has no password or verification. A magic link or OAuth would make it safe for real users.
* **Grader evaluation.** A small set of hand-marked mini essays to check the grader agrees with a human, since LLM graders tend to be lenient.

## Open decisions

- [ ] What the synthesis conversation is for: a Socratic chat until you write the claim (current), one hard challenge after you've written it, or no AI on the canvas at all? Keep transcripts or not?
- [ ] Do synthesis cards earn their keep? If they feel heavy in use, revert to simple pairwise links with a bridge sentence.
- [ ] Which model and provider: a fast model for the examiner chat and question generator, a stronger one for grading?
- [ ] Name: "Fiche" is a working title.
