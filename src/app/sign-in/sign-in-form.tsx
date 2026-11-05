"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "./actions";

export function SignInForm() {
    const next = useSearchParams().get("next") ?? "/";
    const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

    return (
        <form action={action} className="mt-8 flex flex-col gap-1.5">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="email" className="text-xs text-muted">
                Email
            </label>
            <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                className="min-h-11 rounded-lg border border-field bg-surface px-3 text-[15px] outline-none focus:border-accent"
            />
            {state.error && (
                <p role="alert" className="text-warn">
                    {state.error}
                </p>
            )}
            <button
                disabled={pending}
                className="mt-3 min-h-11 rounded-lg bg-accent font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
                {pending ? "Signing in…" : "Continue"}
            </button>
        </form>
    );
}
