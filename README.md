# Fiche

Fiche trains one skill: linking ideas from the great books to a question you haven't seen yet, the way the French *culture générale* dissertation demands. You read, save ideas as cards, link them on a canvas, then write a short timed essay. The only help you get is your own cards. See [SPEC.md](SPEC.md).

**Status:** milestone 1 of 6 is done (skeleton and data).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Drizzle ORM · Postgres (Neon in production, any Postgres locally) · Tailwind v4

## Run locally

Requires Node 22+ and a Postgres database.

```bash
npm install

# 1. Point at a database
cp .env.example .env.local
#    then set DATABASE_URL in .env.local to either:
#    - local:  postgres://YOUR_USER@localhost:5432/fiche   (createdb fiche first)
#    - Neon:   the *pooled* connection string from the Neon console

# 2. Create the tables
npm run db:migrate

# 3. Start the app
npm run dev        # http://localhost:3000
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run db:generate` | Write a new SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations in `drizzle/` |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run texts:prepare` | Re-download and re-split the Gutenberg texts into `data/texts/` (rarely needed) |
| `npm run typecheck` / `npm run lint` | Checks |

## Layout

```
src/
  app/            routes (Library at /)
  db/schema.ts    the four tables: cards, card_sources, essays, citations
  lib/texts.ts    the list of books (from data/texts/manifest.json)
scripts/          prepare-texts.ts: one-off, made data/texts/ from Gutenberg
data/texts/       the books: <slug>.md + manifest.json (static, not in the DB)
drizzle/          generated SQL migrations
```

## Seed texts

All six texts come from Project Gutenberg. Editors' introductions and notes are cut. Each one is a Markdown file in `data/texts/` with one block per paragraph. Headings use `##`, numbered fragments use `###` and verse uses `>`. The app reads these files directly; they're never stored in the database. A card points at a passage by `text_slug` plus the quote and ~32 characters either side, so it can be found again by text search. Fixing a typo in a `.md` file won't break existing cards.

| Text | Translation | Public domain |
| --- | --- | --- |
| Machiavelli, *The Prince* | W. K. Marriott, 1908 | Everywhere |
| Hobbes, *Leviathan*, Part I | English original, 1651 | Everywhere |
| Rousseau, *The Social Contract* | G. D. H. Cole, 1913 | US only; UK/EU from 2030 |
| Montaigne, *Essays* (7 essays) | Charles Cotton, 1685 | Everywhere |
| Pascal, *Pensées* | W. F. Trotter, 1910 (T. S. Eliot intro cut) | US |
| Tocqueville, *Democracy in America*, vol. 2 | Henry Reeve, 1840 | Everywhere |

## Questions

There is no question bank. You either type your own question or ask the AI for an unseen one. An essay or link stores its question as plain text.
