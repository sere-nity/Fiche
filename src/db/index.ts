import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres-js works against both a local Postgres and Neon's pooled endpoint.
// prepare: false is required behind Neon's PgBouncer (transaction pooling).
// The client is cached on globalThis so Next's dev hot-reload doesn't open a
// new connection pool on every edit.

type DB = PostgresJsDatabase<typeof schema>;
const globalForDb = globalThis as unknown as { __ficheDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__ficheDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    globalForDb.__ficheDb = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  }
  return globalForDb.__ficheDb;
}

export { schema };
