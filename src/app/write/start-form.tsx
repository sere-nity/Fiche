"use client";

import { useActionState } from "react";
import { startEssay, type StartEssayState } from "@/lib/essays/actions";

export function StartForm() {
    const [state, action, pending] = useActionState<StartEssayState, FormData>(startEssay, {});

    return (
        <form action={action} className="flex flex-col gap-3 rounded-[10px] border border-foreground bg-surface p-6">
            <label htmlFor="question" className="text-xs text-muted">
                Your question
            </label>
            <input
                id="question"
                name="question"
                required
                placeholder="e.g. Does justice need force?"
                className="min-h-12 rounded-lg border border-field px-3 font-serif text-xl outline-none placeholder:text-faint focus:border-accent"
            />
            {state.error && (
                <p role="alert" className="text-warn">
                    {state.error}
                </p>
            )}
            <button
                disabled={pending}
                className="min-h-11 self-start rounded-lg bg-accent px-5 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
                {pending ? "Starting…" : "Start writing"}
            </button>
        </form>
    );
}
