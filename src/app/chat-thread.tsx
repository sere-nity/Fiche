"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { ChatContext } from "@/lib/chat/context";

const bubble = "max-w-[88%] rounded-[10px] px-3.5 py-3 leading-normal whitespace-pre-wrap";

function messageText(message: UIMessage): string {
    return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function ChatThread({
    context,
    opening,
    placeholder,
    initialMessages = [],
    onSend,
    autoFocus = false,
    onBusyChange,
    onMessagesChange,
}: {
    context: ChatContext;
    opening: string;
    placeholder: string;
    initialMessages?: UIMessage[];
    onSend?: () => void;
    autoFocus?: boolean;
    onBusyChange?: (busy: boolean) => void;
    onMessagesChange?: (messages: UIMessage[]) => void;
}) {
    const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
    const { messages, sendMessage, status, error, regenerate } = useChat({
        transport,
        messages: initialMessages,
        onFinish: ({ messages, isError, isAbort, isDisconnect }) => {
            if (!isError && !isAbort && !isDisconnect) {
                onMessagesChange?.(messages);
            }
        },
    });
    const inputId = useId();
    const [input, setInput] = useState("");
    const endRef = useRef<HTMLDivElement>(null);
    const busy = status === "submitted" || status === "streaming";

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "nearest" });
    }, [messages, status]);

    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

    function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = input.trim();
        if (!text || busy) {
            return;
        }
        onSend?.();
        void sendMessage({ text }, { body: { context } });
        setInput("");
    }

    return (
        <section aria-label="Chat" className="flex flex-1 flex-col border-t border-rule">
            <div aria-live="polite" aria-busy={busy} className="flex flex-1 flex-col gap-3 px-6 py-5">
                <p className={bubble + " self-start bg-chat"}>{opening}</p>
                {messages.map((message) => (
                    <p
                        key={message.id}
                        className={
                            bubble +
                            (message.role === "user" ? " self-end bg-accent text-white" : " self-start bg-chat")
                        }
                    >
                        {messageText(message)}
                    </p>
                ))}
                {status === "submitted" && (
                    <p className={bubble + " self-start animate-pulse bg-chat text-muted"}>Thinking…</p>
                )}
                {error && (
                    <p role="alert" className="text-warn">
                        Couldn&apos;t reach the AI.{" "}
                        <button
                            type="button"
                            onClick={() => regenerate({ body: { context } })}
                            className="font-medium underline"
                        >
                            Try again
                        </button>
                    </p>
                )}
                <div ref={endRef} />
            </div>
            <form onSubmit={send} className="sticky bottom-0 flex gap-2 border-t border-rule bg-surface px-6 py-3">
                <label htmlFor={inputId} className="sr-only">
                    Message
                </label>
                <input
                    id={inputId}
                    autoFocus={autoFocus}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-field px-3 outline-none focus:border-accent"
                />
                <button
                    disabled={busy || input.trim().length === 0}
                    className="min-h-11 rounded-lg border border-field bg-surface px-3.5 font-medium hover:border-foreground disabled:opacity-40"
                >
                    Send
                </button>
            </form>
        </section>
    );
}
