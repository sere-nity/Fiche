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
import { moveCard } from "@/lib/cards/actions";
import type { CardView } from "@/lib/cards/card-view";
import { CanvasPanel, type PanelMode } from "./canvas-panel";

export type Books = Record<string, { author: string; title: string }>;

// ---------- detail level ----------
//
// What each card shows: its title, its gist, or its quote. Chosen in the
// toolbar; zooming just scales the board.

type Level = "titles" | "gists" | "quotes";
const LEVELS: [Level, string][] = [
  ["titles", "Titles"],
  ["gists", "Gists"],
  ["quotes", "Quotes"],
];
const LevelContext = createContext<Level>("gists");

type CardNode = Node<{ card: CardView; label: string }, "card">;

/** Where a card goes before the learner has ever dragged it: a simple grid. */
const gridPosition = (i: number) => ({ x: (i % 4) * 260, y: Math.floor(i / 4) * 150 });

function toNode(card: CardView, i: number, books: Books): CardNode {
  const book = card.textSlug ? books[card.textSlug] : undefined;
  return {
    id: card.id,
    type: "card",
    position: card.position ?? gridPosition(i),
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
  const [nodes, setNodes] = useState<CardNode[]>(() => initialCards.map((c, i) => toNode(c, i, books)));
  const [panel, setPanel] = useState<PanelMode>({ kind: "closed" });
  const [level, setLevel] = useState<Level>("gists");
  const { zoom } = useViewport(); // for the zoom % in the toolbar
  const boardRef = useRef<HTMLDivElement>(null);
  const flow = useReactFlow();


  async function addCard(input: Parameters<typeof save>[0]) {
    const r = await save(input);
    if (!r.ok) return r;
    // Drop the new card in the middle of what's on screen, and keep it there.
    const rect = boardRef.current?.getBoundingClientRect();
    const center = rect
      ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    const position = { x: center.x - 110, y: center.y - 55 };
    setNodes((ns) => [...ns, { ...toNode(r.card, ns.length, books), position }]);
    void moveCard(r.card.id, position);
    setPanel({ kind: "card", id: r.card.id });
    return r;
  }

  async function editCard(id: string, input: { gist: string; title?: string }) {
    const r = await update(id, input);
    if (r.ok) setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, card: r.card } } : n)));
    return r;
  }

  const openCard = panel.kind === "card" ? cards.find((c) => c.id === panel.id) : undefined;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <section aria-label="Card canvas" className="flex min-h-[calc(100dvh-73px)] min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-3.5">
          {/* Milestone 3: the session question goes here. */}
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
          <LevelContext.Provider value={level}>
            <ReactFlow
              nodes={nodes}
              nodeTypes={nodeTypes}
              onNodesChange={(changes: NodeChange<CardNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns))}
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
          </LevelContext.Provider>

          <Toolbar
            zoom={zoom}
            level={level}
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

function Toolbar(props: {
  zoom: number;
  level: Level;
  onLevel: (l: Level) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 rounded-[10px] border border-rule bg-surface p-1.5 shadow-[0_2px_8px_rgba(23,23,28,0.08)]">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={props.onZoomOut}
          className="h-10 w-10 rounded-md text-xl hover:bg-rule-soft"
        >
          −
        </button>
        <span className="min-w-12 text-center text-[13px] tabular-nums">{Math.round(props.zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={props.onZoomIn}
          className="h-10 w-10 rounded-md text-xl hover:bg-rule-soft"
        >
          +
        </button>
      </div>
      <div role="group" aria-label="Detail" className="flex overflow-hidden rounded-lg border border-field">
        {LEVELS.map(([id, label], i) => (
          <button
            key={id}
            type="button"
            aria-pressed={props.level === id}
            onClick={() => props.onLevel(id)}
            className={`min-h-10 px-3 text-[13px] ${i > 0 ? "border-l border-field" : ""} ${
              props.level === id ? "bg-foreground text-white" : "bg-surface hover:bg-rule-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A card on the board: its source, then its title, gist or quote. Grows to fit its text. */
function CardNodeView({ data, selected }: NodeProps<CardNode>) {
  const level = useContext(LevelContext);
  const { card, label } = data;
  return (
    <div
      className={`flex min-h-[72px] w-[220px] flex-col gap-1.5 rounded-[10px] bg-surface px-3.5 py-3 ${
        selected ? "border-2 border-accent" : "border border-field"
      }`}
    >
      <span className="truncate text-[11px] text-muted">{label}</span>
      {level === "titles" && <span className="font-serif text-lg leading-tight">{card.title}</span>}
      {level === "gists" && <span className="text-sm leading-snug">{card.gist}</span>}
      {level === "quotes" && <span className="font-serif text-sm leading-snug italic">“{card.quote}”</span>}
    </div>
  );
}

const nodeTypes = { card: CardNodeView };
