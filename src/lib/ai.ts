import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

export const models = {
    chat: openrouter("anthropic/claude-sonnet-5.5"),
};
