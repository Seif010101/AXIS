import "server-only";
import {
  convertToModelMessages,
  safeValidateUIMessages,
  streamText,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { AppError } from "@/server/errors";
import { resolveLanguageModel } from "./config";
import { aiErrorCode, toAiAppError } from "./errors";
import { assertFeature, toAiUsage, type AiCallOptions } from "./generate";
import {
  CHAT_LIMITS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  INLINE_FILE_MEDIA_TYPES,
  INLINE_FILES_MAX_BYTES,
} from "./limits";
import { finalizeCall, releaseCall, reserveCall, type AiUsage } from "./quota";

type ChatPart = UIMessage["parts"][number];

/** Stream chunks that carry model output (anything else is bookkeeping). */
const CONTENT_CHUNKS: ReadonlySet<string> = new Set([
  "text-delta",
  "reasoning-delta",
  "source",
  "file",
  "tool-input-start",
  "tool-input-delta",
  "tool-call",
]);

const DATA_URL = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(;[a-z0-9=._+-]+)*;base64,([a-z0-9+/]*={0,2})$/i;

/** Checks one attachment and returns its decoded size in bytes. */
function checkFilePart(part: Extract<ChatPart, { type: "file" }>): number {
  const match = DATA_URL.exec(part.url);
  // Only inline data: a URL would make the server (or the provider) fetch arbitrary links.
  if (!match || match[1].toLowerCase() !== part.mediaType.toLowerCase()) {
    throw new AppError("VALIDATION", "Chat attachments must be inline data URLs");
  }
  if (!INLINE_FILE_MEDIA_TYPES.has(part.mediaType.toLowerCase())) {
    throw new AppError("VALIDATION", `Unsupported attachment type ${part.mediaType}`);
  }
  const bytes = Math.floor((match[3].length * 3) / 4);
  if (bytes > CHAT_LIMITS.maxFileBytes) throw new AppError("VALIDATION", "Chat attachment is too large");
  return bytes;
}

/**
 * Validates chat history received from a client and converts it for the model. Only user
 * and assistant messages with text (and user attachments as inline data URLs) are kept;
 * system messages, tool calls, reasoning and custom data parts are rejected or dropped, so
 * a client can't inject instructions or make the server fetch URLs.
 */
export async function toSafeModelMessages(raw: unknown): Promise<ModelMessage[]> {
  const validated = await safeValidateUIMessages({ messages: raw });
  if (!validated.success) throw new AppError("VALIDATION", "Invalid chat messages");

  const recent = validated.data.slice(-CHAT_LIMITS.maxMessages);
  let textChars = 0;
  let files = 0;
  let fileBytes = 0;
  const cleaned: UIMessage[] = [];
  for (const message of recent) {
    if (message.role !== "user" && message.role !== "assistant") {
      throw new AppError("VALIDATION", "Only user and assistant messages are accepted");
    }
    const parts: ChatPart[] = [];
    for (const part of message.parts) {
      if (part.type === "text") {
        textChars += part.text.length;
        parts.push({ type: "text", text: part.text });
      } else if (part.type === "file") {
        if (message.role !== "user") continue;
        fileBytes += checkFilePart(part);
        files += 1;
        parts.push({ type: "file", url: part.url, mediaType: part.mediaType, filename: part.filename });
      }
      // Other parts (reasoning, step markers, tools, sources, data) never reach the model.
    }
    if (parts.length > 0) cleaned.push({ id: message.id, role: message.role, parts });
  }
  if (textChars > CHAT_LIMITS.maxTextChars) throw new AppError("VALIDATION", "Chat history is too long");
  if (files > CHAT_LIMITS.maxFiles) throw new AppError("VALIDATION", "Too many chat attachments");
  // Several files that are each allowed can still add up past what the provider accepts.
  if (fileBytes > INLINE_FILES_MAX_BYTES)
    throw new AppError("VALIDATION", "Chat attachments are too large in total");
  if (cleaned.at(-1)?.role !== "user")
    throw new AppError("VALIDATION", "The last message must be from the user");
  return convertToModelMessages(cleaned);
}

function sumUsage(usages: readonly LanguageModelUsage[]): AiUsage {
  return usages.reduce<AiUsage>(
    (total, usage) => {
      const next = toAiUsage(usage);
      return {
        inputTokens: total.inputTokens + next.inputTokens,
        outputTokens: total.outputTokens + next.outputTokens,
      };
    },
    { inputTokens: 0, outputTokens: 0 },
  );
}

/** The finished reply of a chat stream. */
export interface ChatFinish {
  /** The assistant's full reply (Markdown). */
  text: string;
  usage: AiUsage;
}

export interface StreamChatInput extends AiCallOptions {
  system: string;
  /**
   * The conversation as UIMessage[] (the `useChat` format). Untrusted: it is validated here.
   * Prefer history loaded from your own tables plus the new user message from the client.
   */
  messages: unknown;
  /**
   * Called once the reply is complete, after its usage was recorded: persist the assistant
   * message here. It runs even when the client disconnects mid-stream. Not called when the
   * stream fails or is aborted through `abortSignal`.
   */
  onFinish?: (result: ChatFinish) => Promise<void> | void;
}

/**
 * Streams a chat reply as a UI message stream Response (for `useChat` on the client).
 * Quota is checked before streaming (errors are thrown, turn them into a response with
 * toErrorResponse()); usage is recorded when the stream ends. Errors during the stream reach
 * the client as an error code (e.g. "INTERNAL"), never as provider text.
 *
 * Without `abortSignal` the reply is generated to the end even if the client leaves, so
 * it can still be saved. With `abortSignal: request.signal`, stopping saves tokens; the
 * finished steps are then recorded and `onFinish` is skipped.
 *
 * @example
 * export async function POST(request: Request) {
 *   try {
 *     const ctx = await requireSession({ area: "student" });
 *     const { messages } = await request.json();
 *     return await streamChat({
 *       ctx, feature: "chat.student", tier: "fast", messages,
 *       system: [SAFETY_PREAMBLE, languageInstruction(await getLocale()), TUTOR_PROMPT].join("\n\n"),
 *       onFinish: ({ text }) => saveAssistantMessage(ctx, conversationId, text),
 *     });
 *   } catch (error) {
 *     return toErrorResponse(error);
 *   }
 * }
 */
export async function streamChat(input: StreamChatInput): Promise<Response> {
  assertFeature(input.feature);
  const messages = await toSafeModelMessages(input.messages);
  const { model, modelId } = resolveLanguageModel(input.tier);
  const reservation = await reserveCall(input.ctx.actor, {
    feature: input.feature,
    model: modelId,
    kind: "text",
  });
  const context = { feature: input.feature, modelId };
  let settled = false;
  // Set once the model has produced content: from then on the call was billed, so a
  // failure still counts against the quota (otherwise breaking streams would give free
  // retries). Bookkeeping chunks such as "start" don't count.
  let started = false;
  // The SDK still calls onEnd after a stream error; a failed reply must not be saved.
  let failed = false;

  const settle = async (usage: AiUsage | null) => {
    if (settled) return;
    settled = true;
    try {
      if (usage) await finalizeCall(reservation, usage);
      else await releaseCall(reservation);
    } catch (error) {
      console.error("[ai] could not settle usage row", error);
    }
  };

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model,
      instructions: input.system,
      messages,
      maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      temperature: input.temperature,
      abortSignal: input.abortSignal,
      onChunk: ({ chunk }) => {
        if (CONTENT_CHUNKS.has(chunk.type)) started = true;
      },
      onEnd: async (event) => {
        const usage = toAiUsage(event.totalUsage);
        await settle(usage);
        if (input.onFinish && !failed) {
          try {
            await input.onFinish({ text: event.text, usage });
          } catch (error) {
            console.error("[ai] chat onFinish failed", { feature: input.feature, error });
          }
        }
      },
      onAbort: async (event) => {
        await settle(sumUsage(event.steps.map((step) => step.usage)));
      },
      onError: async ({ error }) => {
        failed = true;
        toAiAppError(error, context); // logs the provider error
        // Exact usage isn't reported for a broken stream; the call itself still counts.
        await settle(started ? { inputTokens: 0, outputTokens: 0 } : null);
      },
    });
  } catch (error) {
    await settle(null);
    throw toAiAppError(error, context);
  }

  // Run the generation to completion on the server even if the client disconnects, so the
  // usage is recorded and onFinish can persist the reply.
  void result.consumeStream({ onError: () => undefined });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
    onError: (error) => aiErrorCode(error),
  });
}
