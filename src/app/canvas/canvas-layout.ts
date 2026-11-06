import type { Node, XYPosition } from "@xyflow/react";

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
