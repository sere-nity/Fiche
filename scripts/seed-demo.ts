import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { createAnchor, findAnchor } from "../src/lib/anchor";
import { parseBook, segments } from "../src/lib/book";
import { citedCardIds } from "../src/lib/essays/essay";

config({ path: ".env.local", quiet: true });
const EMAIL = "demo@fiche.app";
const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client, { schema });
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const quotes = [
    { key: "fear", slug: "machiavelli-prince", title: "Fear outlasts love", quote: "it is much safer to be feared than loved, when, of the two, either must be dispensed with.", gist: "Fear can protect a ruler when goodwill fails, but Machiavelli is describing what is safer, not what is morally better.", x: 0, y: 0 },
    { key: "hatred", slug: "machiavelli-prince", title: "Fear must stop short of hatred", quote: "he must endeavour only to avoid hatred, as is noted.", gist: "Fear becomes politically dangerous when it turns into hatred, so a ruler's use of force has practical limits.", x: 0, y: 190 },
    { key: "law", slug: "hobbes-leviathan-1", title: "Law needs a common power", quote: "Where there is no common Power, there is no Law: where no Law, no Injustice.", gist: "For Hobbes, the institutions that make laws effective also make public standards of justice possible.", x: 0, y: 380 },
    { key: "power", slug: "hobbes-leviathan-1", title: "Power seeks more power", quote: "a perpetuall and restlesse desire of Power after power, that ceaseth onely in Death.", gist: "The pursuit of power is driven partly by the need to secure what one already has.", x: 0, y: 570 },
    { key: "freedom", slug: "rousseau-social-contract", title: "Freedom needs justification", quote: "Man is born free; and everywhere he is in chains.", gist: "The fact that people obey does not settle whether the authority over them is legitimate.", x: 1000, y: 80 },
    { key: "force", slug: "rousseau-social-contract", title: "Force is not right", quote: "The strongest is never strong enough to be always the master, unless he transforms strength into right, and obedience into duty.", gist: "Force can compel obedience, but it cannot by itself create a moral duty to obey.", x: 1000, y: 270 },
    { key: "justice", slug: "pascal-pensees", title: "Justice needs might", quote: "Justice without might is helpless; might without justice is tyrannical.", gist: "Justice must be enforceable, but power must also answer to a standard beyond its own success.", x: 0, y: 800 },
    { key: "nature", slug: "pascal-pensees", title: "Custom feels natural", quote: "Custom is a second nature which destroys the former.", gist: "A habit can become so familiar that we mistake its authority for something natural or necessary.", x: 1000, y: 830 },
    { key: "barbarism", slug: "montaigne-essays-selection", title: "Barbarism is a local label", quote: "every one gives the title of barbarism to everything that is not in use in his own country.", gist: "We often judge unfamiliar practices by local habits rather than by an independent standard.", x: 340, y: 1050 },
    { key: "custom", slug: "montaigne-essays-selection", title: "Custom trains judgement", quote: "custom is a violent and treacherous schoolmistress.", gist: "Custom quietly shapes what feels reasonable, making inherited assumptions hard to notice and challenge.", x: 1000, y: 1030 },
    { key: "mild", slug: "tocqueville-democracy-2", title: "Mild power can dominate", quote: "That power is absolute, minute, regular, provident, and mild.", gist: "Domination need not be visibly cruel: a protective authority can gradually weaken people's capacity to act for themselves.", x: 0, y: 1060 },
    { key: "individualism", slug: "tocqueville-democracy-2", title: "Private life narrows public life", quote: "Individualism is a mature and calm feeling, which disposes each member of the community to sever himself from the mass of his fellow-creatures;", gist: "Withdrawal into private life can leave common affairs to others and make dependence on central power easier.", x: 1000, y: 1220 },
];
const syntheses = [
    { key: "order", title: "Order needs credible power", gist: "Machiavelli and Hobbes make stable order depend on a power people cannot safely ignore, rather than on goodwill alone.", sources: ["fear", "law"], x: 340, y: 100 },
    { key: "justice-power", title: "Justice must constrain power", gist: "Enforcement can make justice effective, but Pascal shows why effective force must still be judged by a moral standard.", sources: ["order", "justice"], x: 680, y: 280 },
    { key: "legitimacy", title: "Order is not legitimacy", gist: "A power may maintain peace without earning a right to obedience: stable order and legitimate authority answer different questions.", sources: ["justice-power", "force"], x: 1360, y: 220 },
    { key: "domination", title: "Custom can hide domination", gist: "Montaigne's suspicion of local standards helps explain how Tocqueville's mild domination can feel normal rather than oppressive.", sources: ["barbarism", "mild"], x: 680, y: 950 },
    { key: "unjust-rule", title: "A familiar rule may be unjust", gist: "Pascal and Montaigne challenge the leap from a practice being familiar to its being justified, including apparently protective forms of authority.", sources: ["nature", "domination"], x: 1360, y: 990 },
];

const essays = [
    {
        key: "justice-essay", question: "Does justice need force?", daysAgo: 4,
        body: `Justice appears to demand obedience because it is right, while force obtains obedience whether or not it is right. Yet a just rule that nobody can enforce may protect nobody. The question is therefore whether force is merely an instrument of justice or can also supply its authority.

There is a practical case for enforcement. @Law needs a common power argues that public standards depend on institutions able to settle disputes. A judgement that leaves each person free to act as their own judge offers little security. @Fear outlasts love similarly identifies the weakness of relying on goodwill. These ideas support my synthesis @Order needs credible power: a stable rule must give people a reason to comply even when compliance is inconvenient. This does not show that every effective ruler is just. It shows why justice can need an effective institution.

The objection is that a tyrant also creates order. @Force is not right separates being compelled from having a duty to obey. If the only reason for following a law is fear, the law has not yet justified itself. A peaceful society could therefore be orderly and unjust at the same time. @Power seeks more power also discusses power. This makes power an important theme for the argument.

@Justice needs might gives a way of stating the tension without erasing it: justice without force is helpless, while force without justice becomes tyranny. Courts need the means to enforce their decisions, but their decisions also need reasons that can be challenged. A judgement against a powerful official offers a concrete test: if enforcement operates only against the weak, the institution has confused power with justice.

Justice consequently needs force as a limited means, not as its proof. Force can establish the conditions in which claims are heard and protected, but it cannot decide by itself which claims deserve protection. The remaining difficulty is to explain who can constrain the enforcer without merely placing a stronger force above it.`,
    },
    {
        key: "custom-essay", question: "Can custom make injustice seem natural?", daysAgo: 2,
        body: `A familiar practice often needs less explanation than an unfamiliar one. That psychological advantage can be useful: shared habits make cooperation possible. But when familiarity becomes a reason not to ask for justification, custom may conceal injustice. The problem is how to question a practice without assuming that novelty is automatically better.

@Custom feels natural identifies the mechanism. A learned habit can become a second nature, so its authority feels independent of learning. @Barbarism is a local label adds a consequence: people may condemn an unfamiliar way of life simply because it is not their own. Taken together, these ideas undermine the inference from normality to moral authority. A practice being widespread tells us something about its history, not yet whether it treats people fairly.

The danger is not restricted to openly violent authority. @Mild power can dominate describes a power that is regular, provident and mild. People may welcome protection while gradually losing the ability to act without permission. My synthesis @Custom can hide domination connects that description to Montaigne's suspicion of local standards. A dependent way of life can become so familiar that the loss of agency stops looking like a loss.

There is nevertheless a serious objection. Customs can preserve forms of mutual obligation that an abstract demand for individual freedom overlooks. For example, a local duty to care for an elderly neighbour may restrict convenience while sustaining a valuable relationship. Rejecting it merely because it is inherited would repeat the original error in reverse: its age would again substitute for examining its reasons.

The better test is therefore whether people affected by a practice can question it and whether its burdens can be justified to them. A protective institution that prevents criticism fails that test even if its routines are comfortable. A demanding custom that remains open to challenge may pass it. @A familiar rule may be unjust states the limited conclusion: familiarity neither proves injustice nor excuses a practice from justification.

Custom can make injustice appear natural, but criticism should recover the question of justification rather than replace inherited certainty with a new certainty. The task is to examine whose agency a practice protects, whose it weakens, and whether that difference can be defended.`,
    },
    {
        key: "consent-draft", question: "Can political order exist without consent?", daysAgo: 0,
        body: `An order may be stable because people fear its collapse, yet that does not show that they have consented to it. @Order is not legitimacy helps separate these claims. Hobbes makes the insecurity of unregulated power visible, while Rousseau asks a different question about the right to obedience.

My first claim is that coercion can produce a kind of order without consent. The harder objection is that an order maintained entirely through fear may not be stable for long. @Fear must stop short of hatred suggests a limit even within a practical defence of strong authority.

I need a concrete case that tests whether obedience expresses consent, resignation, or simply the lack of a safe alternative.`,
    },
];

function idFor(learnerId: string, key: string) {
    const hex = createHash("sha256").update(learnerId + ":fiche-demo:" + key).digest("hex").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function seed() {
    const books = new Map<string, string>();
    for (const quote of quotes) {
        if (!books.has(quote.slug)) {
            const markdown = await readFile(`data/texts/${quote.slug}.md`, "utf8");
            books.set(quote.slug, parseBook(markdown).map((block) => segments(block.text).map((part) => part.text).join("")).join(""));
        }
    }
    await db.transaction(async (transaction) => {
        await transaction.insert(schema.learners).values({ email: EMAIL }).onConflictDoNothing();
        const [learner] = await transaction.select().from(schema.learners).where(eq(schema.learners.email, EMAIL));
        const ids = new Map([...quotes, ...syntheses].map((card) => [card.key, idFor(learner.id, card.key)]));
        const demoCards: { id: string; title: string; gist: string; quote: string | null }[] = [];
        for (const [index, quote] of quotes.entries()) {
            const text = books.get(quote.slug)!;
            const start = text.toLowerCase().indexOf(quote.quote.toLowerCase());
            if (start === -1) {
                throw new Error(`Demo quote not found: ${quote.title}`);
            }
            const anchor = createAnchor(text, start, start + quote.quote.length);
            if (!findAnchor(text, anchor)) {
                throw new Error(`Demo anchor not found: ${quote.title}`);
            }
            const card = { id: ids.get(quote.key)!, title: quote.title, gist: quote.gist, quote: anchor.quote };
            demoCards.push(card);
            await transaction.insert(schema.cards).values({ ...card, learnerId: learner.id, kind: "quote", textSlug: quote.slug,
                quotePrefix: anchor.prefix, quoteSuffix: anchor.suffix, position: { x: quote.x, y: quote.y },
                createdAt: new Date(now - 8 * DAY + index * 60 * 60 * 1000),
                chat: quote.key === "fear" ? [
                    { id: "demo-reader-user", role: "user", parts: [{ type: "text", text: "Does safer mean that fear is also morally better?" }] },
                    { id: "demo-reader-assistant", role: "assistant", parts: [{ type: "text", text: "What changes if you read safer as a claim about keeping power rather than deserving it?" }] },
                ] : null,
            }).onConflictDoNothing();
        }
        for (const [index, synthesis] of syntheses.entries()) {
            const card = { id: ids.get(synthesis.key)!, title: synthesis.title, gist: synthesis.gist, quote: null };
            demoCards.push(card);
            await transaction.insert(schema.cards).values({ ...card, learnerId: learner.id, kind: "synthesis",
                position: { x: synthesis.x, y: synthesis.y }, createdAt: new Date(now - 6 * DAY + index * 60 * 60 * 1000),
                chat: synthesis.key === "order" ? [
                    { id: "demo-link-user", role: "user", parts: [{ type: "text", text: "Both authors seem to connect order with a power people take seriously." }] },
                    { id: "demo-link-assistant", role: "assistant", parts: [{ type: "text", text: "Does that explain why an order lasts, or why it deserves obedience? What case would distinguish them?" }] },
                ] : null,
            }).onConflictDoNothing();
            await transaction.insert(schema.cardSources).values(synthesis.sources.map((key) => ({ cardId: card.id, sourceId: ids.get(key)! }))).onConflictDoNothing();
        }
        for (const essay of essays) {
            const essayId = idFor(learner.id, essay.key);
            const [inserted] = await transaction.insert(schema.essays).values({ id: essayId, learnerId: learner.id,
                question: essay.question, body: essay.body, startedAt: new Date(now - essay.daysAgo * DAY),
            }).onConflictDoNothing().returning({ id: schema.essays.id });
            if (inserted) {
                const cited = citedCardIds(essay.body, demoCards);
                if (cited.length > 0) {
                    await transaction.insert(schema.citations).values(cited.map((cardId) => ({ essayId, cardId })));
                }
            }
            console.log(`Essay: ${essay.question}`);
        }
    });
    console.log(`Demo account: ${EMAIL} (prototype email sign-in, no password)`);
    console.log(`${quotes.length} highlighted passages, ${syntheses.length} syntheses, ${syntheses.reduce((count, card) => count + card.sources.length, 0)} links, ${essays.length} essays.`);
}
seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => client.end());
