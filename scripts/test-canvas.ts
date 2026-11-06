import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@xyflow/react";
import { connectionHandles, synthesisPosition } from "../src/app/canvas/canvas-layout";
import { SourceIdsSchema } from "../src/lib/cards/links";

const node = (id: string, x: number, y: number, width = 220, height = 72): Node => ({
    id,
    position: { x, y },
    measured: { width, height },
    data: {},
});
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("a new synthesis sits beyond the widest source and between their heights", () => {
    assert.deepEqual(synthesisPosition([node("a", 0, 40), node("b", 200, 240, 300)]), { x: 580, y: 140 });
});

test("a synthesis requires exactly two different cards", () => {
    assert.equal(SourceIdsSchema.safeParse([firstId, firstId]).success, false);
    assert.deepEqual(SourceIdsSchema.parse([firstId, secondId]), [firstId, secondId]);
    assert.equal(SourceIdsSchema.safeParse([firstId]).success, false);
    assert.equal(SourceIdsSchema.safeParse([firstId, secondId, firstId]).success, false);
    assert.equal(SourceIdsSchema.safeParse([firstId, secondId, "33333333-3333-4333-8333-333333333333"]).success, false);
    assert.equal(SourceIdsSchema.safeParse(["invalid", secondId]).success, false);
});

test("sources on opposite sides enter opposite synthesis handles", () => {
    const synthesis = node("s", 320, 0);
    assert.deepEqual(connectionHandles(node("left", 0, 120), synthesis), { sourceHandle: "right", targetHandle: "left" });
    assert.deepEqual(connectionHandles(node("right", 640, 120), synthesis), { sourceHandle: "left", targetHandle: "right" });
});

test("connection handles follow moved cards and measured widths", () => {
    const source = node("a", 0, 0, 500);
    const target = node("s", 100, 0, 100);
    assert.deepEqual(connectionHandles(source, target), { sourceHandle: "left", targetHandle: "right" });
    source.position.x = -400;
    assert.deepEqual(connectionHandles(source, target), { sourceHandle: "right", targetHandle: "left" });
});
