# Setup

Requires Node.js 22+ and a Postgres database.

From the project directory:

```bash
npm install
cp .env.example .env.local
```

In `.env.local`, set `DATABASE_URL` to your Postgres connection string and add `OPENROUTER_API_KEY` 

```bash
npm run db:migrate
npm run db:seed
npm run dev -- --port 3001
```

Open [localhost:3001](http://localhost:3001). Sign in as `demo@fiche.app` with no password.
