"use client";

import { createContext, useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CardView } from "@/lib/cards/card-view";

export type CardNode = Node<{ card: CardView; label: string }, "card">;
export type DetailLevel = "titles" | "gists" | "quotes";
const LEVELS: [DetailLevel, string][] = [["titles", "Titles"], ["gists", "Gists"], ["quotes", "Quotes"]];
export const CanvasDisplayContext = createContext<DetailLevel>("gists");

export function Toolbar({
    zoom,
    detailLevel,
    onDetailLevel,
    onZoomIn,
    onZoomOut,
}: {
    zoom: number;
    detailLevel: DetailLevel;
    onDetailLevel: (level: DetailLevel) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}) {
    return (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 rounded-[10px] border border-rule bg-surface p-1.5 shadow-[0_2px_8px_rgba(23,23,28,0.08)]">
            <div className="flex items-center gap-0.5">
                <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={onZoomOut}
                    className="h-10 w-10 rounded-md text-xl hover:bg-rule-soft"
                >
                    −
                </button>
                <span className="min-w-12 text-center text-[13px] tabular-nums">{Math.round(zoom * 100)}%</span>
                <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={onZoomIn}
                    className="h-10 w-10 rounded-md text-xl hover:bg-rule-soft"
                >
                    +
                </button>
            </div>
            <div role="group" aria-label="Detail" className="flex overflow-hidden rounded-lg border border-field">
                {LEVELS.map(([id, label], index) => (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={detailLevel === id}
                        onClick={() => onDetailLevel(id)}
                        className={`min-h-10 px-3 text-[13px] ${index > 0 ? "border-l border-field" : ""} ${
                            detailLevel === id ? "bg-foreground text-white" : "bg-surface hover:bg-rule-soft"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const HANDLE_STYLE = {
    width: 12,
    height: 12,
    border: "2px solid var(--accent)",
    background: "var(--surface)",
};

function CardNodeView({ data, selected }: NodeProps<CardNode>) {
    const detailLevel = useContext(CanvasDisplayContext);
    const { card, label } = data;
    const isSynthesis = card.kind === "synthesis";

    let body = card.gist;
    let bodyClass = "text-sm leading-snug";
    if (detailLevel === "titles") {
        body = card.title;
        bodyClass = "font-serif text-lg leading-tight";
    } else if (detailLevel === "quotes" && !isSynthesis) {
        body = "“" + card.quote + "”";
        bodyClass = "font-serif text-sm leading-snug italic";
    }

    let frame = isSynthesis ? "bg-foreground text-white" : "border border-field bg-surface";
    if (selected) {
        frame += " outline-2 outline-offset-3 outline-accent";
    }

    return (
        <div className={"flex min-h-[72px] w-[220px] flex-col gap-1.5 rounded-[10px] px-3.5 py-3 " + frame}>
            <Handle
                id="left"
                type="source"
                position={Position.Left}
                style={HANDLE_STYLE}
                role="button"
                aria-label={"Link from the left of " + card.title}
                title="Drag to link this card"
            />
            <span className={"truncate text-[11px] " + (isSynthesis ? "text-[#c8c8d0]" : "text-muted")}>{label}</span>
            <span className={bodyClass}>{body}</span>
            <Handle
                id="right"
                type="source"
                position={Position.Right}
                style={HANDLE_STYLE}
                role="button"
                aria-label={"Link from the right of " + card.title}
                title="Drag to another card to link"
            />
        </div>
    );
}

export const nodeTypes = { card: CardNodeView };
