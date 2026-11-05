import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

// Prototype sign-in trusts the learner ID cookie.
export const SESSION_COOKIE = "fiche_learner";

export type Learner = { id: string; email: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getLearner = cache(async (): Promise<Learner | null> => {
    const id = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!id || !UUID_RE.test(id)) {
        return null;
    }
    const [row] = await getDb()
        .select({ id: schema.learners.id, email: schema.learners.email })
        .from(schema.learners)
        .where(eq(schema.learners.id, id));
    return row ?? null;
});
