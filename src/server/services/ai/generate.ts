import "server-only";
import {
  generateImage as sdkGenerateImage,
  generateText,
  Output,
  type LanguageModelUsage,
  type ModelMessage,
} from "ai";
import type { z } from "zod";
import type { Actor } from "@/server/policy/scope";
import { AppError } from "@/server/errors";
import { resolveImageModel, resolveLanguageModel, type AiTier } from "./config";
import { toAiAppError, usageFromError } from "./errors";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  INLINE_FILE_MEDIA_TYPES,
  INLINE_FILES_MAX_BYTES,
  type AiQuotaKind,
} from "./limits";
import { finalizeCall, releaseCall, reserveCall, type AiUsage } from "./quota";

/** Who is calling: a SessionContext works, as does `{ actor }` for jobs run on someone's behalf. */
export interface AiCaller {
  actor: Actor;
}

/** Options shared by every text call. */
export interface AiCallOptions {
  /** The caller: quotas and usage accounting use `ctx.actor`. */
  ctx: AiCaller;
  /**
   * What the call is for, reported on the owner's AI-cost screen. Lowercase, dot or dash
   * separated, ≤ 50 characters: "worksheet.generate", "library.summary", "chat.student".
   */
  feature: string;
  tier: AiTier;
  /** System instructions (put SAFETY_PREAMBLE and languageInstruction() here). */
  system?: string;
  /** Cap on generated tokens (default 4096). */
  maxOutputTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

/** A file sent inline with a prompt (image, PDF or plain text). */
export interface AiInlineFile {
  data: Uint8Array;
  mediaType: string;
  fileName?: string;
}

/** Either a single prompt (optionally with files) or a server-built message list. */
export type AiPrompt =
  | { prompt: string; files?: readonly AiInlineFile[]; messages?: never }
  | { messages: ModelMessage[]; prompt?: never; files?: never };

const FEATURE_PATTERN = /^[a-z][a-z0-9_.-]{1,49}$/;

export function assertFeature(feature: string): void {
  if (!FEATURE_PATTERN.test(feature)) {
    throw new AppError("VALIDATION", `Invalid AI feature name "${feature}"`);
  }
}

export function toAiUsage(usage: LanguageModelUsage | undefined): AiUsage {
  return { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 };
}

function toMessages(input: AiPrompt): ModelMessage[] {
  if (input.messages) return input.messages;
  const files = input.files ?? [];
  if (files.length === 0) return [{ role: "user", content: input.prompt }];
  let total = 0;
  for (const file of files) {
    total += file.data.byteLength;
    if (!INLINE_FILE_MEDIA_TYPES.has(file.mediaType)) {
      throw new AppError("VALIDATION", `Unsupported inline file type ${file.mediaType}`);
    }
  }
  if (total > INLINE_FILES_MAX_BYTES) throw new AppError("VALIDATION", "Inline files are too large");
  return [
    {
      role: "user",
      content: [
        { type: "text", text: input.prompt },
        ...files.map((file) => ({
          type: "file" as const,
          data: file.data,
          mediaType: file.mediaType,
          filename: file.fileName,
        })),
      ],
    },
  ];
}

/**
 * Reserves quota, runs the call, records its usage. Failed calls release their reservation
 * unless the model already answered (then the tokens are still recorded, they were billed).
 */
async function metered<Model, T>(
  options: { ctx: AiCaller; feature: string; kind: AiQuotaKind },
  resolve: () => { model: Model; modelId: string },
  execute: (model: Model) => Promise<{ value: T; usage: AiUsage }>,
): Promise<T> {
  assertFeature(options.feature);
  const { model, modelId } = resolve();
  const reservation = await reserveCall(options.ctx.actor, {
    feature: options.feature,
    model: modelId,
    kind: options.kind,
  });
  let outcome: { value: T; usage: AiUsage };
  try {
    outcome = await execute(model);
  } catch (error) {
    const usage = usageFromError(error);
    await (usage ? finalizeCall(reservation, usage) : releaseCall(reservation)).catch(
      (cleanupError: unknown) => console.error("[ai] could not settle usage row", cleanupError),
    );
    throw toAiAppError(error, { feature: options.feature, modelId });
  }
  await finalizeCall(reservation, outcome.usage);
  return outcome.value;
}

/**
 * Generates an object that matches a zod schema (validated; never parse JSON by hand).
 * Throws AI_NOT_CONFIGURED, RATE_LIMITED (daily quota or provider busy), VALIDATION
 * (bad feature name or inline file) or INTERNAL (provider failure, invalid output).
 *
 * @example
 * const quiz = await generateStructured({
 *   ctx, feature: "assessments.generate", tier: "smart",
 *   schema: z.object({ questions: z.array(z.object({ text: z.string(), answer: z.string() })) }),
 *   system: [SAFETY_PREAMBLE, languageInstruction(locale)].join("\n\n"),
 *   prompt: `Write 5 questions about ${topic}`,
 * });
 */
export async function generateStructured<T>(
  input: AiCallOptions &
    AiPrompt & {
      schema: z.ZodType<T>;
      /** Optional name/description of the object, a hint for the model. */
      schemaName?: string;
      schemaDescription?: string;
    },
): Promise<T> {
  const messages = toMessages(input);
  return metered(
    { ctx: input.ctx, feature: input.feature, kind: "text" },
    () => resolveLanguageModel(input.tier),
    async (model) => {
      const result = await generateText({
        model,
        instructions: input.system,
        messages,
        output: Output.object({
          schema: input.schema,
          name: input.schemaName,
          description: input.schemaDescription,
        }),
        maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        temperature: input.temperature,
        abortSignal: input.abortSignal,
      });
      return { value: result.output, usage: toAiUsage(result.totalUsage) };
    },
  );
}

/**
 * Generates plain text (Markdown) for a prompt. Same errors as generateStructured.
 *
 * @example
 * const outline = await generateTextResult({ ctx, feature: "studio.outline", tier: "fast", prompt });
 */
export async function generateTextResult(input: AiCallOptions & AiPrompt): Promise<string> {
  const messages = toMessages(input);
  return metered(
    { ctx: input.ctx, feature: input.feature, kind: "text" },
    () => resolveLanguageModel(input.tier),
    async (model) => {
      const result = await generateText({
        model,
        instructions: input.system,
        messages,
        maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        temperature: input.temperature,
        abortSignal: input.abortSignal,
      });
      return { value: result.text, usage: toAiUsage(result.totalUsage) };
    },
  );
}

/** An image produced by generateImage(). */
export interface GeneratedImage {
  mediaType: string;
  base64: string;
}

/** Prepended to image prompts unless `raw: true`. */
const IMAGE_SAFETY_PREFIX =
  "Create a safe, age-appropriate educational illustration for school students, with no text unless asked. Subject: ";

/**
 * Generates one image with the image model, counted against the daily image quota.
 *
 * @example
 * const { mediaType, base64 } = await generateImage({ ctx, feature: "studio.image", prompt });
 * return `data:${mediaType};base64,${base64}`;
 */
export async function generateImage(input: {
  ctx: AiCaller;
  feature: string;
  prompt: string;
  aspectRatio?: `${number}:${number}`;
  /** Skip the built-in safety prefix (only for prompts written entirely by the server). */
  raw?: boolean;
  abortSignal?: AbortSignal;
}): Promise<GeneratedImage> {
  const prompt = input.raw ? input.prompt : IMAGE_SAFETY_PREFIX + input.prompt;
  return metered(
    { ctx: input.ctx, feature: input.feature, kind: "image" },
    resolveImageModel,
    async (model) => {
      const result = await sdkGenerateImage({
        model,
        prompt,
        aspectRatio: input.aspectRatio,
        abortSignal: input.abortSignal,
      });
      return {
        value: { mediaType: result.image.mediaType, base64: result.image.base64 },
        usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
      };
    },
  );
}
