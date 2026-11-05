import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { models } from "./ai";

/**
 * AI job 1 of 4: does the learner's gist say what the passage says?
 * It judges and names what's off. It never rewrites the gist: the learner
 * has to do that themselves.
 */

export const GistCheckResult = z.object({
  verdict: z
    .enum(["faithful", "partly", "no"])
    .describe("faithful: accurate. partly: right direction but misses or distorts something important. no: misreads the passage."),
  reason: z
    .string()
    .describe("One sentence. If not faithful, name exactly what is off, e.g. 'The passage says X; the gist says Y.'"),
});
export type GistCheckResult = z.infer<typeof GistCheckResult>;

const INSTRUCTIONS = `You check whether a learner has understood a passage they saved from a book.
They wrote a title (a few words) and a gist (one sentence) in their own words.

Judge fidelity only: does the gist say what the passage says? A one-sentence gist cannot cover everything, so do not penalise omissions unless the gist distorts the meaning. Ignore style and grammar.

Rules:
- Never rewrite the gist or suggest replacement wording. Name what is off; the learner fixes it.
- Judge against the passage, not against what you know about the author. If the learner's reading is defensible from the passage, it is faithful.
- Flag the title only if it misrepresents the passage.
- One sentence of reason, plain and specific.`;

export async function checkGist(input: {
  source: string;
  passage: string;
  quote: string;
  title: string;
  gist: string;
}): Promise<GistCheckResult> {
  const { output } = await generateText({
    model: models.check,
    instructions: INSTRUCTIONS,
    output: Output.object({ schema: GistCheckResult }),
    prompt: [
      `Source: ${input.source}`,
      `Passage (context around the selection):\n"""\n${input.passage}\n"""`,
      `Selected quote:\n"""\n${input.quote}\n"""`,
      `Learner's title: ${input.title}`,
      `Learner's gist: ${input.gist}`,
    ].join("\n\n"),
    abortSignal: AbortSignal.timeout(30_000),
  });
  return output;
}
