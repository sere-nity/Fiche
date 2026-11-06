import type { Node, XYPosition } from "@xyflow/react";

export function dropTarget(node: Node, nodes: Node[]): Node | undefined {
    let target: Node | undefined;
    let largestOverlap = 0;
    const width = node.measured?.width ?? 220;
    const height = node.measured?.height ?? 72;
    for (const other of nodes) {
        if (other.id === node.id || other.dragging) {
            continue;
        }
        const overlapWidth = Math.min(node.position.x + width, other.position.x + (other.measured?.width ?? 220))
            - Math.max(node.position.x, other.position.x);
        const overlapHeight = Math.min(node.position.y + height, other.position.y + (other.measured?.height ?? 72))
            - Math.max(node.position.y, other.position.y);
        const overlap = Math.max(0, overlapWidth) * Math.max(0, overlapHeight);
        if (overlap > largestOverlap) {
            target = other;
            largestOverlap = overlap;
        }
    }
    return target;
}

export function synthesisPosition(sources: Node[]): XYPosition {
    return {
        x: Math.max(...sources.map((node) => node.position.x + (node.measured?.width ?? 220))) + 80,
        y: sources.reduce((total, node) => total + node.position.y, 0) / sources.length,
    };
}

export function connectionHandles(source: Node, target: Node) {
    const sourceCenter = source.position.x + (source.measured?.width ?? 220) / 2;
    const targetCenter = target.position.x + (target.measured?.width ?? 220) / 2;
    return sourceCenter <= targetCenter
        ? { sourceHandle: "right", targetHandle: "left" }
        : { sourceHandle: "left", targetHandle: "right" };
}
