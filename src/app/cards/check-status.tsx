"use client";

import type { CardView } from "./card-view";

/**
 * How a gist check looks, after the design: blue when the gist holds up,
 * orange when it needs work. The same palette marks essay citations on the
 * Feedback screen (substantive vs decorative / misread).
 */
export const VERDICT: Record<CardView["gistCheck"], { label: string; pill: string; box: string; heading: string }> = {
  faithful: {
    label: "Faithful",
    pill: "bg-accent-soft text-accent-hover",
    box: "border-accent-soft bg-accent-soft/50",
    heading: "text-accent-hover",
  },
  partly: {
    label: "Partly faithful",
    pill: "bg-warn-soft text-warn",
    box: "border-warn-border bg-warn-soft",
    heading: "text-warn",
  },
  no: {
    label: "Misread",
    pill: "bg-[#fff0e3] text-warn",
    box: "border-warn-strong/40 bg-[#fff0e3]",
    heading: "text-warn",
  },
  unchecked: {
    label: "Not checked",
    pill: "bg-rule-soft text-muted",
    box: "border-rule bg-background",
    heading: "text-muted",
  },
};

/** The check result box under a card's gist. */
export function CheckStatus({
  card,
  checking,
  error,
  onRetry,
}: {
  card: CardView;
  checking: boolean;
  error?: string;
  onRetry: () => void;
}) {
  if (checking) {
    return (
      <div role="status" className="animate-pulse rounded-lg border border-rule bg-background p-3.5 text-muted">
        Checking your gist against the passage…
      </div>
    );
  }
  const v = VERDICT[card.gistCheck];
  return (
    <div role="status" className={`flex flex-col gap-1.5 rounded-lg border p-3.5 ${v.box}`}>
      <span className={`text-xs font-semibold ${v.heading}`}>{v.label}</span>
      {card.gistCheck === "unchecked" ? (
        <span className="leading-normal text-secondary">
          {error ?? "The gist hasn't been checked yet."}{" "}
          <button type="button" onClick={onRetry} className="font-medium text-accent underline hover:text-accent-hover">
            Check now
          </button>
        </span>
      ) : (
        card.gistCheckReason && <span className="leading-normal text-secondary">{card.gistCheckReason}</span>
      )}
    </div>
  );
}
