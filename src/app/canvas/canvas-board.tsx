"use client";

import { useRef, useState } from "react";
import {
    applyNodeChanges,
    Background,
    BackgroundVariant,
    ConnectionMode,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    type Edge,
    type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { UIMessage } from "ai";
import { useCards } from "@/lib/cards/use-cards";
import { addSource, moveCard } from "@/lib/cards/actions";
import type { CardLink, CardView } from "@/lib/cards/card-view";
import { CanvasPanel, type PanelMode } from "./canvas-panel";
import { connectionHandles, dropTarget, synthesisPosition } from "./canvas-layout";
import { CanvasDisplayContext, Toolbar, nodeTypes, type CardNode, type DetailLevel } from "./canvas-controls";

export type Books = Record<string, { author: string; title: string }>;

const getGridPosition = (index: number) => ({ x: (index % 4) * 260, y: Math.floor(index / 4) * 150 });

function toNode(card: CardView, index: number, books: Books, links: CardLink[]): CardNode {
    const book = card.textSlug ? books[card.textSlug] : undefined;
    const label =
        card.kind === "synthesis"
            ? "Synthesis · " + links.filter((link) => link.cardId === card.id).length
            : (book?.author ?? card.typedSource ?? "");
    return { id: card.id, type: "card", deletable: card.kind === "synthesis", position: card.position ?? getGridPosition(index), data: { card, label } };
}

function toEdge(link: CardLink, cards: CardView[], nodes: CardNode[]): Edge {
    const source = nodes.find((node) => node.id === link.sourceId);
    const target = nodes.find((node) => node.id === link.cardId);
    const fromSynthesis = cards.find((card) => card.id === link.sourceId)?.kind === "synthesis";
    return {
        id: link.sourceId + "-" + link.cardId,
        source: link.sourceId,
        target: link.cardId,
        ...(source && target ? connectionHandles(source, target) : { sourceHandle: "right", targetHandle: "left" }),
        style: fromSynthesis
            ? { stroke: "var(--accent)", strokeWidth: 1.5, strokeDasharray: "5 4" }
            : { stroke: "var(--faint)", strokeWidth: 1.5 },
    };
}

export function CanvasBoard(props: { initialCards: CardView[]; initialLinks: CardLink[]; books: Books }) {
    return (
        <ReactFlowProvider>
            <Board {...props} />
        </ReactFlowProvider>
    );
}

function Board({
    initialCards,
    initialLinks,
    books,
}: {
    initialCards: CardView[];
    initialLinks: CardLink[];
    books: Books;
}) {
    const { cards, update, saveSynthesis, removeSyntheses, setChat } = useCards(initialCards);
    const [links, setLinks] = useState(initialLinks);
    const [nodes, setNodes] = useState<CardNode[]>(() =>
        initialCards.map((card, index) => toNode(card, index, books, initialLinks)),
    );

    const [serverCards, setServerCards] = useState(initialCards);
    if (initialCards !== serverCards) {
        setServerCards(initialCards);
        setLinks(initialLinks);
        const current = new Map(nodes.map((node) => [node.id, node]));
        setNodes(
            initialCards.map((card, index) => ({
                ...toNode(card, index, books, initialLinks),
                position: current.get(card.id)?.position ?? toNode(card, index, books, initialLinks).position,
                selected: current.get(card.id)?.selected,
            })),
        );
    }
    const [panel, setPanel] = useState<PanelMode>({ kind: "closed" });
    const [detailLevel, setDetailLevel] = useState<DetailLevel>("gists");
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const dragStartRef = useRef(new Map<string, XYPosition>());
    const [isMoving, setIsMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { zoom } = useViewport();
    const flow = useReactFlow();

    async function handleDragStop(node: CardNode, dragged: CardNode[]) {
        if (dragged.every((card) => {
            const start = dragStartRef.current.get(card.id);
            return start?.x === card.position.x && start?.y === card.position.y;
        })) {
            return;
        }
        const target = dragged.length === 1 ? dropTarget(node, flow.getNodes()) : undefined;
        setDropTargetId(null);
        setError(null);
        if (target) {
            setNodes((previous) => previous.map((other) => ({
                ...other,
                position: dragStartRef.current.get(other.id) ?? other.position,
                selected: false,
            })));
            await connectCards(node.id, target.id);
            return;
        }
        setIsMoving(true);
        try {
            const outcomes = await Promise.allSettled(dragged.map(async (card) => {
                const result = await moveCard(card.id, card.position);
                return { id: card.id, ok: result.ok };
            }));
            const failed = dragged.filter((_, index) => {
                const outcome = outcomes[index];
                return outcome.status === "rejected" || !outcome.value.ok;
            });
            if (failed.length > 0) {
                setNodes((previous) => previous.map((card) => failed.some((failedCard) => failedCard.id === card.id)
                    ? { ...card, position: dragStartRef.current.get(card.id) ?? card.position } : card));
                setError("Couldn't save the move. The cards are back where they were; try again.");
            }
        } finally {
            setIsMoving(false);
        }
    }

    async function connectCards(sourceId: string, targetId: string) {
        if (sourceId === targetId || isMoving) {
            return;
        }
        setError(null);
        const source = cards.find((card) => card.id === sourceId);
        const target = cards.find((card) => card.id === targetId);
        if (!source || !target) {
            return;
        }
        if (target.kind !== "synthesis") {
            selectCards([sourceId, targetId]);
            return;
        }
        setIsMoving(true);
        try {
            const result = await addSource(targetId, sourceId);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setLinks((previous) => previous.some((link) => link.cardId === targetId && link.sourceId === sourceId)
                ? previous : [...previous, { cardId: targetId, sourceId }]);
            selectCards([targetId]);
        } catch {
            setError("Couldn't add the source. Try again.");
        } finally {
            setIsMoving(false);
        }
    }

    async function deleteSelected(removed: CardNode[]) {
        if (isMoving || removed.length === 0) {
            return false;
        }
        const ids = removed.map((node) => node.id);
        setIsMoving(true);
        setError(null);
        try {
            const result = await removeSyntheses(ids);
            if (!result.ok) {
                setError(result.error);
                return false;
            }
            setLinks((previous) => previous.filter((link) => !ids.includes(link.cardId) && !ids.includes(link.sourceId)));
            selectCards([]);
            return true;
        } finally {
            setIsMoving(false);
        }
    }

    function selectCards(ids: string[]) {
        setNodes((previous) => previous.map((node) => ({ ...node, selected: ids.includes(node.id) })));
        if (ids.length >= 2) {
            setPanel({ kind: "link", ids: ids.sort() });
        } else if (ids.length === 1) {
            setPanel({ kind: "card", id: ids[0] });
        } else {
            setPanel({ kind: "closed" });
        }
    }

    async function addSynthesis(sourceIds: string[], input: { gist: string; title?: string; chat?: UIMessage[] }) {
        const ids = [...new Set(sourceIds)];
        const sources = nodes.filter((node) => ids.includes(node.id));
        if (sources.length < 2) {
            return { ok: false as const, error: "Choose at least two different cards." };
        }
        const position = synthesisPosition(sources);
        const result = await saveSynthesis({ ...input, sourceIds: ids, position });
        if (!result.ok) {
            return result;
        }
        const newLinks = ids.map((sourceId) => ({ cardId: result.card.id, sourceId }));
        setLinks((previous) => [...previous.filter((link) => link.cardId !== result.card.id), ...newLinks]);
        setNodes((previous) =>
            previous.some((node) => node.id === result.card.id)
                ? previous
                : [...previous, toNode(result.card, previous.length, books, newLinks)],
        );
        selectCards([result.card.id]);
        requestAnimationFrame(() => void flow.setCenter(
            position.x + 110, position.y + 40, { zoom: Math.min(zoom, 1), duration: 250 },
        ));
        return result;
    }

    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const openCard = panel.kind === "card" ? cardsById.get(panel.id) : undefined;
    const linkCards = panel.kind === "link" ? panel.ids.flatMap((id) => cards.filter((card) => card.id === id)) : [];
    const sourcesOf = (id: string) =>
        links.flatMap((link) => (link.cardId === id ? cards.filter((card) => card.id === link.sourceId) : []));
    const edges = links.map((link) => toEdge(link, cards, nodes));
    const visibleNodes = nodes.flatMap((node) => {
        const card = cardsById.get(node.id);
        return card ? [{ ...node, data: toNode(card, 0, books, links).data }] : [];
    });

    let panelMode: PanelMode = { kind: "closed" };
    if (
        (panel.kind === "card" && openCard) ||
        (panel.kind === "link" && linkCards.length >= 2)
    ) {
        panelMode = panel;
    }

    return (
        <div className="flex flex-1 flex-col lg:flex-row">
            <section aria-label="Card canvas" className="flex min-h-[calc(100dvh-73px)] min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-3.5">
                    <div className="flex flex-col">
                        <span className="font-serif text-xl">
                            Your cards <span className="text-muted">· {cards.length}</span>
                        </span>
                        <span className="text-xs text-muted">Drag between the blue dots to link cards, or drop one card onto another. Shift-click to choose several.</span>
                    </div>
                </div>

                {error && <p role="alert" className="border-b border-rule px-6 py-3 text-warn">{error}</p>}
                {isMoving && <p role="status" className="sr-only">Saving canvas…</p>}
                <div className="relative flex-1 bg-board">
                    <CanvasDisplayContext.Provider value={{ detailLevel, dropTargetId }}>
                            <ReactFlow
                                nodes={visibleNodes}
                                edges={edges}
                                nodeTypes={nodeTypes}
                                onNodesChange={(changes) =>
                                    setNodes((previous) => applyNodeChanges(changes, previous))
                                }
                                onNodeDragStart={(_, _node, dragged) => {
                                    dragStartRef.current = new Map(dragged.map((card) => [card.id, { ...card.position }]));
                                    setError(null);
                                }}
                                onNodeDrag={(_, node, dragged) => setDropTargetId(
                                    dragged.length === 1 ? dropTarget(node, flow.getNodes())?.id ?? null : null,
                                )}
                                onNodeDragStop={(_, node, dragged) => void handleDragStop(node, dragged)}
                                onNodeClick={(event, node) => {
                                    if ((event.target as Element).closest(".react-flow__handle")) {
                                        return;
                                    }
                                    const selected = event.shiftKey ? nodes.filter((other) => other.selected) : [];
                                    const ids = selected.filter((other) => other.id !== node.id).map((other) => other.id);
                                    if (!selected.some((other) => other.id === node.id)) {
                                        ids.push(node.id);
                                    }
                                    selectCards(ids);
                                }}
                                onPaneClick={() => selectCards([])}
                                selectionKeyCode={null}
                                multiSelectionKeyCode="Shift"
                                selectNodesOnDrag={false}
                                nodeDragThreshold={0}
                                nodesDraggable={!isMoving}
                                deleteKeyCode={["Backspace", "Delete"]}
                                onBeforeDelete={({ nodes: removed }) => deleteSelected(removed)}
                                fitView
                                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                                minZoom={0.4}
                                maxZoom={2}
                                connectionMode={ConnectionMode.Loose}
                                nodesConnectable={!isMoving}
                                onConnect={({ source, target }) => void connectCards(source, target)}
                                isValidConnection={({ source, target }) => source !== target}
                                connectionLineStyle={{ stroke: "var(--accent)", strokeWidth: 2 }}
                                edgesFocusable={false}
                            >
                                <Background
                                    variant={BackgroundVariant.Dots}
                                    gap={20}
                                    size={1.5}
                                    color="var(--board-dot)"
                                />
                            </ReactFlow>
                    </CanvasDisplayContext.Provider>

                    <Toolbar
                        zoom={zoom}
                        detailLevel={detailLevel}
                        onDetailLevel={setDetailLevel}
                        onZoomIn={() => flow.zoomIn()}
                        onZoomOut={() => flow.zoomOut()}
                    />

                    {cards.length === 0 && (
                        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center leading-normal text-muted">
                            No cards yet. Open a book from the Library and select a passage.
                        </p>
                    )}
                </div>
            </section>

            <CanvasPanel
                mode={panelMode}
                card={openCard}
                linkCards={linkCards}
                sources={openCard ? sourcesOf(openCard.id) : []}
                books={books}
                onEdit={update}
                onSaveLink={addSynthesis}
                onChatMessages={setChat}
                onClose={() => selectCards([])}
            />
        </div>
    );
}
