import "server-only";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";
import { xai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * One place to choose models. The provider is picked by which key is set in
 * .env.local, so switching providers never touches feature code:
 *
 *   XAI_API_KEY         → xAI directly (Grok)
 *   OPENROUTER_API_KEY  → OpenRouter (Claude)
 *
 * With neither, every AI call fails; each feature must fall back gracefully.
 */
export function pick(models: { xai: string; openrouter: string; xaiReasoning?: "low" | "medium" | "high" }): LanguageModel {
  if (process.env.XAI_API_KEY) {
    const model = xai(models.xai);
    if (!models.xaiReasoning) return model;
    // Grok 4.7 reasons at "high" by default; lighter jobs don't need it.
    return wrapLanguageModel({
      model,
      middleware: defaultSettingsMiddleware({
        settings: { providerOptions: { xai: { reasoningEffort: models.xaiReasoning } } },
      }),
    });
  }
  return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(models.openrouter);
}

/**
 * The AI jobs, added as they're built: the question generator (milestone 3),
 * the synthesis examiner (5) and the essay grader (4). Capture has no AI.
 * When adding one: "grok-4.7" reasons at "high" by default; for quick
 * judgements pass xaiReasoning: "low" (measured ~2x faster, same verdicts).
 */
export const models = {} satisfies Record<string, LanguageModel>;
