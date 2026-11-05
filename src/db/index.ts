import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;
// Reuse the database pool across development reloads.
const databaseCache = globalThis as unknown as { __ficheDb?: Database };

export function getDb(): Database {
    if (!databaseCache.__ficheDb) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
        }
        // Pooled Neon connections use transaction pooling.
        databaseCache.__ficheDb = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
    }
    return databaseCache.__ficheDb;
}

export { schema };
