import assert from "node:assert/strict";
import test from "node:test";
import { generateText, getSchema } from "@tiptap/core";
import { citedCardIds, splitCitations, type EssayCard } from "../src/lib/essays/essay";
import { citationExtensions, essayDocument } from "../src/app/write/[id]/editor-document";
import { isFinishedCitation, matchCards } from "../src/app/write/[id]/mention";

const cards: EssayCard[] = [
    {
        id: "fear",
        title: "Fear",
        source: "Machiavelli",
        gist: "Fear can sustain authority.",
        quote: "A short quote.",
    },
    {
        id: "fear-outlasts",
        title: "Fear outlasts love",
        source: "Machiavelli",
        gist: "Fear can sustain authority.",
        quote: "Another quote.",
    },
    {
        id: "justice",
        title: "Justice needs might",
        source: "Pascal",
        gist: "Justice needs the power to enforce it.",
        quote: "Justice without might is helpless.",
    },
    {
        id: "typed",
        title: "A lecture",
        source: "Lecture notes",
        gist: "An idea captured from the lecture.",
        quote: "A typed quote.",
    },
];

test("restores saved citations as atomic mention nodes", () => {
    const document = essayDocument("As @Justice needs might argues.", cards);
    const schema = getSchema(citationExtensions(cards));
    const node = schema.nodeFromJSON(document);
    const mention = node.firstChild?.child(1);
    assert.equal(mention?.type.name, "mention");
    assert.equal(mention?.attrs.id, "justice");
    assert.equal(mention?.isAtom, true);
    assert.equal(generateText(document, citationExtensions(cards), { blockSeparator: "\n" }), "As @Justice needs might argues.");
});

test("keeps paragraph breaks and trailing blank lines when autosaving", () => {
    const body = "First argument.\n\nAs @Fear outlasts love suggests.\n";
    assert.equal(generateText(essayDocument(body, cards), citationExtensions(cards), { blockSeparator: "\n" }), body);
});

test("keeps unfinished and unknown references as editable text", () => {
    const body = "An argument using @jus and @Unknown.";
    const document = essayDocument(body, cards);
    assert.equal(document.content?.[0].content?.some((node) => node.type === "mention"), false);
    assert.equal(generateText(document, citationExtensions(cards), { blockSeparator: "\n" }), body);
});

test("uses the longest matching title and counts each card once", () => {
    const body = "@Fear outlasts love supports @Justice needs might. Again, @Fear outlasts love.";
    assert.deepEqual(citedCardIds(body, cards), ["fear-outlasts", "justice"]);
    assert.equal(splitCitations(body, cards).filter((segment) => "card" in segment).length, 3);
});

test("email addresses do not become citations", () => {
    assert.deepEqual(citedCardIds("me@Fear and name@example.com", cards), []);
});

test("matching leaves space to finish a longer card title", () => {
    assert.equal(isFinishedCitation(cards, "Fear "), false);
    assert.equal(isFinishedCitation(cards, "Justice needs might"), false);
    assert.equal(isFinishedCitation(cards, "Justice needs might "), true);
    assert.equal(isFinishedCitation(cards, "Justice needs might argues"), true);
    assert.deepEqual(matchCards(cards, "JUSTICE").map((card) => card.id), ["justice"]);
});

test("citation chips use native buttons for previews without navigation or a delayed tooltip", () => {
    const schema = getSchema(citationExtensions(cards));
    for (const card of cards) {
        const document = schema.nodeFromJSON(essayDocument("@" + card.title, cards));
        const mention = document.firstChild!.firstChild!;
        const rendered = mention.type.spec.toDOM!(mention);
        assert.ok(Array.isArray(rendered));
        assert.equal(rendered[0], "button");
        assert.equal(rendered[1]["data-id"], card.id);
        assert.equal(rendered[1].type, "button");
        assert.equal(rendered[1]["aria-haspopup"], "dialog");
        assert.equal(rendered[1].title, undefined);
        assert.equal(rendered[1].href, undefined);
        assert.equal(rendered[1].target, undefined);
        assert.equal(rendered[2], "@" + card.title);
    }
});
