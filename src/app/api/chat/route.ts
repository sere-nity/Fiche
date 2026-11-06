import {
    convertToModelMessages,
    createIdGenerator,
    createUIMessageStreamResponse,
    streamText,
    safeValidateUIMessages,
    toUIMessageStream,
} from "ai";
import { z } from "zod";
import { models } from "@/lib/ai";
import { getLearner } from "@/lib/session";
import { ChatContextSchema, ChatMessagesSchema, chatInstructions } from "@/lib/chat/instructions";
import { saveCardChat } from "@/lib/chat/store";

export const maxDuration = 60;

const ChatRequestSchema = z.object({ context: ChatContextSchema, messages: ChatMessagesSchema.min(1) });

export async function POST(request: Request) {
    const learner = await getLearner();
    if (!learner) {
        return new Response("Sign in to chat.", { status: 401 });
    }

    const parsed = ChatRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return new Response("Bad chat request.", { status: 400 });
    }
    const { context } = parsed.data;
    const validated = await safeValidateUIMessages({
        messages: parsed.data.messages.filter((message) => message.role !== "system"),
    });
    if (!validated.success || !validated.data.some((message) => message.role === "user")) {
        return new Response("Bad chat messages.", { status: 400 });
    }
    const messages = validated.data;

    const instructions = await chatInstructions(context, learner.id);
    if (!instructions) {
        return new Response("Those cards or that text weren't found.", { status: 404 });
    }

    const result = streamText({
        model: models.chat,
        instructions,
        maxOutputTokens: 500,
        messages: await convertToModelMessages(messages),
    });
    return createUIMessageStreamResponse({
        stream: toUIMessageStream({
            stream: result.stream,
            originalMessages: messages,
            generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
            sendReasoning: false,
            onEnd: async ({ messages: finished, outcome }) => {
                if (context.cardId && outcome.status === "completed") {
                    await saveCardChat(context.cardId, learner.id, finished);
                }
            },
        }),
    });
}
