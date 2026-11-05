import "server-only";
import { anthropic } from "@ai-sdk/anthropic";

/**
 * One place to choose models. The provider reads ANTHROPIC_API_KEY from the
 * environment; without it every AI call fails, and each feature falls back
 * (a card saves as "unchecked").
 */
export const models = {
  /** Gist check: a short fidelity judgement. */
  check: anthropic("claude-sonnet-5-5"),
};
