import "server-only";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";
import { xai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

type ModelChoice = { openrouter: string; xai: string; xaiReasoning?: "low" | "medium" | "high" };

// OpenRouter wins when both keys are set (measured faster, and prompts assume Claude).
export function pick(choice: ModelChoice): LanguageModel {
    if (process.env.OPENROUTER_API_KEY || !process.env.XAI_API_KEY) {
        return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(choice.openrouter);
    }
    const model = xai(choice.xai);
    if (!choice.xaiReasoning) {
        return model;
    }
    return wrapLanguageModel({
        model,
        middleware: defaultSettingsMiddleware({
            settings: { providerOptions: { xai: { reasoningEffort: choice.xaiReasoning } } },
        }),
    });
}

export const models = {
    chat: pick({ openrouter: "anthropic/claude-sonnet-5.5", xai: "grok-4.7", xaiReasoning: "low" }),
} satisfies Record<string, LanguageModel>;
