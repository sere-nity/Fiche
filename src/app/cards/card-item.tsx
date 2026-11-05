"use client";

import type { CardView } from "./card-view";
import { CheckStatus, VERDICT } from "./check-status";

/** A card on the Cards page. */
export function CardItem({
  card,
  source,
  checking,
  checkError,
  onRetry,
}: {
  card: CardView;
  source?: string;
  checking: boolean;
  checkError?: string;
  onRetry: () => void;
}) {
  const v = VERDICT[card.gistCheck];
  return (
    <article className="flex flex-col gap-3 rounded-[10px] border border-rule bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-serif text-lg leading-snug">{card.title}</h3>
          {source && <span className="text-xs text-muted">{source}</span>}
        </div>
        {!checking && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.pill}`}>{v.label}</span>}
      </div>
      <p className="leading-normal">{card.gist}</p>
      {card.quote && (
        <blockquote className="border-l-2 border-rule pl-3 font-serif text-base leading-normal text-secondary">
          “{card.quote}”
        </blockquote>
      )}
      {(checking || card.gistCheck !== "faithful") && (
        <CheckStatus card={card} checking={checking} error={checkError} onRetry={onRetry} />
      )}
    </article>
  );
}
