import "server-only";
import type { ImageModel, JSONSchema7, LanguageModel } from "ai";
import { MockImageModelV4, MockLanguageModelV4, simulateReadableStream } from "ai/test";

// Fake models so tests and local development never call Google.
//
// - Tests: `setAiTestModel(mockTextModel("..."))` in a test, `resetAiTestModel()` after it.
// - Local development without a key: set AI_PROVIDER=mock (see .env.example). The built-in
//   fake answers every prompt deterministically and fills structured outputs with
//   placeholder values that satisfy the requested schema.

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;
type ImageResult = Awaited<ReturnType<MockImageModelV4["doGenerate"]>>;

/** A model object (not a model id string) that can stand in for the real provider. */
export type AiLanguageModel = Exclude<LanguageModel, string>;
export type AiImageModel = Exclude<ImageModel, string>;

/** Token usage in the provider format, for hand-written mocks. */
export function mockUsage(inputTokens: number, outputTokens: number): GenerateResult["usage"] {
  return {
    inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
  };
}

const roughTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

/** The plain text of a prompt (system + user + assistant text parts). */
function promptText(options: CallOptions): string {
  return options.prompt
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => (part.type === "text" ? part.text : "")).join(" "),
    )
    .join("\n");
}

function lastUserText(options: CallOptions): string {
  const user = [...options.prompt].reverse().find((message) => message.role === "user");
  if (!user || typeof user.content === "string") return "";
  return user.content.map((part) => (part.type === "text" ? part.text : "")).join(" ");
}

function textStream(text: string, usage: GenerateResult["usage"]): StreamResult {
  const words = text.match(/\S+\s*/g) ?? [text];
  const chunks: StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "text-1" },
    ...words.map((delta): StreamPart => ({ type: "text-delta", id: "text-1", delta })),
    { type: "text-end", id: "text-1" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
  ];
  return { stream: simulateReadableStream({ chunks }) };
}

export interface MockTextModelOptions {
  /** Reported input tokens (default: estimated from the prompt). */
  inputTokens?: number;
  /** Reported output tokens (default: estimated from the reply). */
  outputTokens?: number;
  modelId?: string;
}

/**
 * A fake language model that answers every call (generate and stream) with `reply`. For
 * structured output, make `reply` the JSON text the model should return.
 *
 * @example
 * setAiTestModel(mockTextModel(JSON.stringify({ title: "Fractions" }), { inputTokens: 12, outputTokens: 5 }));
 */
export function mockTextModel(
  reply: string | ((options: CallOptions) => string),
  options: MockTextModelOptions = {},
): MockLanguageModelV4 {
  const answer = (call: CallOptions) => {
    const text = typeof reply === "function" ? reply(call) : reply;
    const usage = mockUsage(
      options.inputTokens ?? roughTokens(promptText(call)),
      options.outputTokens ?? roughTokens(text),
    );
    return { text, usage };
  };
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: options.modelId ?? "mock-text",
    doGenerate: async (call) => {
      const { text, usage } = answer(call);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream: async (call) => {
      const { text, usage } = answer(call);
      return textStream(text, usage);
    },
  });
}

// A 1x1 transparent PNG.
const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** A fake image model that returns a 1x1 PNG. */
export function mockImageModel(options: { modelId?: string; outputTokens?: number } = {}): MockImageModelV4 {
  const modelId = options.modelId ?? "mock-image";
  return new MockImageModelV4({
    provider: "mock",
    modelId,
    doGenerate: async (): Promise<ImageResult> => ({
      images: [PIXEL_PNG],
      warnings: [],
      response: { timestamp: new Date(0), modelId, headers: undefined },
      usage: { inputTokens: 10, outputTokens: options.outputTokens ?? 1290, totalTokens: undefined },
    }),
  });
}

// ---------------------------------------------------------------------------------------
// Built-in development fake (AI_PROVIDER=mock)

type SchemaNode = JSONSchema7 | boolean;

function resolveRef(root: JSONSchema7, ref: string): SchemaNode | undefined {
  const match = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
  if (!match) return undefined;
  const defs = match[1] === "$defs" ? root.$defs : root.definitions;
  return defs?.[decodeURIComponent(match[2])];
}

/** A placeholder value that satisfies common JSON Schema constraints. */
export function sampleFromSchema(node: SchemaNode, root: JSONSchema7, depth = 0): unknown {
  if (typeof node === "boolean" || depth > 8) return null;
  if (node.$ref) {
    const target = resolveRef(root, node.$ref);
    return target === undefined ? null : sampleFromSchema(target, root, depth + 1);
  }
  if (node.const !== undefined) return node.const;
  if (node.enum && node.enum.length > 0) return node.enum[0];
  const options = node.anyOf ?? node.oneOf ?? node.allOf;
  if (options && options.length > 0) {
    const preferred = options.find((option) => typeof option !== "boolean" && option.type !== "null");
    return sampleFromSchema(preferred ?? options[0], root, depth + 1);
  }
  const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  if (types.length > 0 && types.every((candidate) => candidate === "null")) return null;
  const type = types.find((candidate) => candidate !== "null") ?? (node.properties ? "object" : "string");
  switch (type) {
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.properties ?? {})) {
        result[key] = sampleFromSchema(child, root, depth + 1);
      }
      return result;
    }
    case "array": {
      const count = Math.max(1, node.minItems ?? 1);
      const items = node.items;
      return Array.from({ length: count }, (_, index) => {
        const item = Array.isArray(items) ? items[Math.min(index, items.length - 1)] : items;
        return item === undefined ? null : sampleFromSchema(item, root, depth + 1);
      });
    }
    case "integer":
    case "number": {
      let value = node.minimum ?? (typeof node.exclusiveMinimum === "number" ? node.exclusiveMinimum + 1 : 1);
      if (node.maximum !== undefined) value = Math.min(value, node.maximum);
      return type === "integer" ? Math.ceil(value) : value;
    }
    case "boolean":
      return false;
    default: {
      if (node.format === "date-time") return "2026-01-01T00:00:00.000Z";
      if (node.format === "date") return "2026-01-01";
      const text = "Sample text";
      const min = node.minLength ?? 0;
      const padded = text.length >= min ? text : text.padEnd(min, ".");
      return node.maxLength !== undefined ? padded.slice(0, node.maxLength) : padded;
    }
  }
}

function builtInReply(call: CallOptions): string {
  const format = call.responseFormat;
  if (format?.type === "json") {
    return JSON.stringify(format.schema ? sampleFromSchema(format.schema, format.schema) : {});
  }
  const question = lastUserText(call).trim().slice(0, 200);
  return [
    "**Development mode:** this answer comes from the built-in mock model (`AI_PROVIDER=mock`), not from Gemini.",
    "",
    question ? `> ${question.replace(/\s+/g, " ")}` : "",
    "",
    "- Lists, **bold text** and math such as $a^2 + b^2 = c^2$ render as in production.",
  ].join("\n");
}

/** The built-in development fake for a tier (AI_PROVIDER=mock). */
export function builtInMockModel(tier: string): MockLanguageModelV4 {
  return mockTextModel(builtInReply, { modelId: `mock-${tier}` });
}
