import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Who is signed in. The sign-in action (src/app/sign-in/actions.ts) puts the
 * learner's id in an httpOnly cookie; the browser sends it back on every
 * request, and this reads it.
 *
 * No password: anyone who types an email gets that learner. Fine for a
 * prototype, not for real users.
 */

export const SESSION_COOKIE = "fiche_learner";

export type Learner = { id: string; email: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in learner, or null. Runs once per request however often it's called. */
export const getLearner = cache(async (): Promise<Learner | null> => {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id || !UUID_RE.test(id)) return null;
  const [row] = await getDb()
    .select({ id: schema.learners.id, email: schema.learners.email })
    .from(schema.learners)
    .where(eq(schema.learners.id, id));
  return row ?? null;
});
