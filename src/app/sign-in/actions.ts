"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE } from "@/lib/session";

const Email = z.string().trim().toLowerCase().pipe(z.email());

/** Only allow redirects back into this site ("/read/x"), never "//evil.com". */
function safeNext(next: FormDataEntryValue | null): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "That doesn't look like an email address." };

  // Find or create the learner in one statement. The no-op update makes
  // RETURNING give back the existing row's id when the email already exists.
  const [learner] = await getDb()
    .insert(schema.learners)
    .values({ email: parsed.data })
    .onConflictDoUpdate({ target: schema.learners.email, set: { email: parsed.data } })
    .returning({ id: schema.learners.id });

  (await cookies()).set({
    name: SESSION_COOKIE,
    value: learner.id,
    httpOnly: true, // page JavaScript can't read it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // one year
  });

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
