import "server-only";
import { defaultSettingsMiddleware, wrapLanguageModel, type LanguageModel } from "ai";
import { xai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function pick(models: { xai: string; openrouter: string; xaiReasoning?: "low" | "medium" | "high" }): LanguageModel {
    if (process.env.XAI_API_KEY) {
        const model = xai(models.xai);
        if (!models.xaiReasoning) {
            return model;
        }

        return wrapLanguageModel({
            model,
            middleware: defaultSettingsMiddleware({
                settings: { providerOptions: { xai: { reasoningEffort: models.xaiReasoning } } },
            }),
        });
    }
    return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(models.openrouter);
}

export const models = {} satisfies Record<string, LanguageModel>;
