"use client";

import { createContext, useContext, useRef, useState } from "react";
import {
    applyNodeChanges,
    Background,
    BackgroundVariant,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    type Node,
    type NodeChange,
    type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCards } from "@/lib/cards/use-cards";
import { moveCard, type SaveQuoteInput } from "@/lib/cards/actions";
import type { CardView } from "@/lib/cards/card-view";
import { CanvasPanel, type PanelMode } from "./canvas-panel";

export type Books = Record<string, { author: string; title: string }>;

type DetailLevel = "titles" | "gists" | "quotes";
const LEVELS: [DetailLevel, string][] = [
    ["titles", "Titles"],
    ["gists", "Gists"],
    ["quotes", "Quotes"],
];
const DetailContext = createContext<DetailLevel>("gists");

type CardNode = Node<{ card: CardView; label: string }, "card">;

const getGridPosition = (index: number) => ({ x: (index % 4) * 260, y: Math.floor(index / 4) * 150 });

function toNode(card: CardView, index: number, books: Books): CardNode {
    const book = card.textSlug ? books[card.textSlug] : undefined;
    return {
        id: card.id,
        type: "card",
        position: card.position ?? getGridPosition(index),
        data: { card, label: book?.author ?? card.typedSource ?? "" },
    };
}

export function CanvasBoard(props: { initialCards: CardView[]; books: Books }) {
    return (
        <ReactFlowProvider>
            <Board {...props} />
        </ReactFlowProvider>
    );
}

function Board({ initialCards, books }: { initialCards: CardView[]; books: Books }) {
    const { cards, save, update } = useCards(initialCards);
    const [nodes, setNodes] = useState<CardNode[]>(() => initialCards.map((card, index) => toNode(card, index, books)));

    const [fromServer, setFromServer] = useState(initialCards);
    if (initialCards !== fromServer) {
        setFromServer(initialCards);
        const selected = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
        setNodes(initialCards.map((card, index) => ({ ...toNode(card, index, books), selected: selected.has(card.id) })));
    }
    const [panel, setPanel] = useState<PanelMode>({ kind: "closed" });
    const [detailLevel, setLevel] = useState<DetailLevel>("gists");
    const { zoom } = useViewport();
    const boardRef = useRef<HTMLDivElement>(null);
    const flow = useReactFlow();

    async function addCard(input: SaveQuoteInput) {

        const rect = boardRef.current?.getBoundingClientRect();
        const center = rect
            ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
            : { x: 0, y: 0 };
        const result = await save({ ...input, position: { x: center.x - 110, y: center.y - 36 } });
        if (!result.ok) {
            return result;
        }
        setNodes((previous) => (previous.some((node) => node.id === result.card.id) ? previous : [...previous, toNode(result.card, previous.length, books)]));
        setPanel({ kind: "card", id: result.card.id });
        return result;
    }

    async function editCard(id: string, input: { gist: string; title?: string }) {
        const result = await update(id, input);
        if (result.ok) {
            setNodes((previous) => previous.map((node) => {
                if (node.id !== id) {
                    return node;
                }
                return {
                    ...node,
                    data: {
                        ...node.data,
                        card: result.card,
                    },
                };
            }));
        }
        return result;
    }

    const openCard = panel.kind === "card" ? cards.find((card) => card.id === panel.id) : undefined;

    return (
        <div className="flex flex-1 flex-col lg:flex-row">
            <section aria-label="Card canvas" className="flex min-h-[calc(100dvh-73px)] min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-3.5">

                    <span className="font-serif text-xl">
                        Your cards <span className="text-muted">· {cards.length}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setPanel({ kind: "add" })}
                        className="min-h-10 rounded-lg border border-field bg-surface px-3.5 font-medium hover:border-foreground"
                    >
                        Add a quote
                    </button>
                </div>

                <div ref={boardRef} className="relative flex-1 bg-board">
                    <DetailContext.Provider value={detailLevel}>
                        <ReactFlow
                            nodes={nodes}
                            nodeTypes={nodeTypes}
                            onNodesChange={(changes: NodeChange<CardNode>[]) => setNodes((previous) => applyNodeChanges(changes, previous))}
                            onNodeDragStop={(_, node) => void moveCard(node.id, node.position)}
                            onNodeClick={(_, node) => setPanel({ kind: "card", id: node.id })}
                            onPaneClick={() => setPanel({ kind: "closed" })}
                            fitView
                            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                            minZoom={0.4}
                            maxZoom={2}
                            nodesConnectable={false}
                        >
                            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--board-dot)" />
                        </ReactFlow>
                    </DetailContext.Provider>

                    <Toolbar
                        zoom={zoom}
                        detailLevel={detailLevel}
                        onLevel={setLevel}
                        onZoomIn={() => flow.zoomIn()}
                        onZoomOut={() => flow.zoomOut()}
                    />

                    {cards.length === 0 && (
                        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center leading-normal text-muted">
                            No cards yet. Open a book from the Library and select a passage, or add a quote.
                        </p>
                    )}
                </div>
            </section>

            <CanvasPanel
                mode={openCard || panel.kind === "add" ? panel : { kind: "closed" }}
                card={openCard}
                books={books}
                onAdd={addCard}
                onEdit={editCard}
                onClose={() => setPanel({ kind: "closed" })}
            />
        </div>
    );
}

function Toolbar({ zoom, detailLevel, onLevel, onZoomIn, onZoomOut }: {
    zoom: number;
    detailLevel: DetailLevel;
    onLevel: (l: DetailLevel) => void;
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
                        onClick={() => onLevel(id)}
                        className={`min-h-10 px-3 text-[13px] ${index > 0 ? "border-l border-field" : ""} ${detailLevel === id ? "bg-foreground text-white" : "bg-surface hover:bg-rule-soft"
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CardNodeView({ data, selected }: NodeProps<CardNode>) {
    const detailLevel = useContext(DetailContext);
    const { card, label } = data;
    return (
        <div
            className={`flex min-h-[72px] w-[220px] flex-col gap-1.5 rounded-[10px] bg-surface px-3.5 py-3 ${selected ? "border-2 border-accent" : "border border-field"
                }`}
        >
            <span className="truncate text-[11px] text-muted">{label}</span>
            {detailLevel === "titles" && <span className="font-serif text-lg leading-tight">{card.title}</span>}
            {detailLevel === "gists" && <span className="text-sm leading-snug">{card.gist}</span>}
            {detailLevel === "quotes" && <span className="font-serif text-sm leading-snug italic">“{card.quote}”</span>}
        </div>
    );
}

const nodeTypes = { card: CardNodeView };
