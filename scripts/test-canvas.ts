import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@xyflow/react";
import { connectionHandles, dropTarget, synthesisPosition } from "../src/app/canvas/canvas-layout";
import { SourceIdsSchema, wouldCreateCycle } from "../src/lib/cards/links";

const node = (id: string, x: number, y: number, width = 220, height = 72): Node => ({
    id,
    position: { x, y },
    measured: { width, height },
    data: {},
});
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("a partial overlap is enough to link cards", () => {
    const dragged = node("a", 0, 0);
    assert.equal(dropTarget(dragged, [dragged, node("b", 210, 0)])?.id, "b");
});

test("dropping the center inside another card chooses that card", () => {
    const dragged = node("a", 140, 0);
    const target = { ...node("b", 210, 0), selected: true };
    assert.equal(dropTarget(dragged, [dragged, target])?.id, "b");
});

test("drop targets use measured sizes and canvas coordinates", () => {
    const dragged = node("a", -140, -50, 400, 180);
    const target = node("b", 0, 0, 90, 120);
    assert.equal(dropTarget(dragged, [target])?.id, "b");
});

test("cards moving together cannot become each other's drop target", () => {
    const dragged = node("a", 140, 0);
    assert.equal(dropTarget(dragged, [{ ...node("b", 210, 0), dragging: true }]), undefined);
});

test("touching edges do not count as a drop, and the largest overlap wins", () => {
    const dragged = node("a", 0, 0);
    assert.equal(dropTarget(dragged, [node("b", 220, 0)]), undefined);
    assert.equal(dropTarget(dragged, [node("b", 210, 0), node("c", 100, 0)])?.id, "c");
});

test("a new synthesis sits beyond the widest source and between their heights", () => {
    assert.deepEqual(synthesisPosition([node("a", 0, 40), node("b", 200, 240, 300)]), { x: 580, y: 140 });
});

test("duplicate IDs do not count as two synthesis sources", () => {
    assert.equal(SourceIdsSchema.safeParse([firstId, firstId]).success, false);
    assert.deepEqual(SourceIdsSchema.parse([firstId, secondId, firstId]), [firstId, secondId]);
    assert.equal(SourceIdsSchema.safeParse(["invalid", secondId]).success, false);
});

test("rejects both self-links and cycles through other syntheses", () => {
    const links = [{ cardId: "s1", sourceId: "a" }, { cardId: "s2", sourceId: "s1" }];
    assert.equal(wouldCreateCycle(links, "s1", "s1"), true);
    assert.equal(wouldCreateCycle(links, "s1", "s2"), true);
    assert.equal(wouldCreateCycle(links, "a", "s2"), true);
    assert.equal(wouldCreateCycle(links, "s2", "b"), false);
    assert.equal(wouldCreateCycle(links, "s2", "s1"), false);
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
