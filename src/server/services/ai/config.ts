import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/env";
import { AppError } from "@/server/errors";
import { builtInMockModel, mockImageModel, type AiImageModel, type AiLanguageModel } from "./mock";

/** `fast` for short or bulk tasks, `smart` for reasoning-heavy ones (models come from env). */
export type AiTier = "fast" | "smart";

interface ResolvedModel<Model> {
  model: Model;
  /** Stored in ai_usage and used for pricing. */
  modelId: string;
}

const testOverride: { language?: AiLanguageModel; image?: AiImageModel } = {};
let warnedAboutMock = false;

const usesBuiltInMock = () => env.AI_PROVIDER === "mock";

/**
 * True when AI calls can run: a Gemini key is set, AI_PROVIDER=mock, or a test model is
 * installed. Features can use it to hide AI buttons instead of failing on click.
 */
export function isAiConfigured(): boolean {
  return Boolean(testOverride.language || usesBuiltInMock() || env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * Tests only: routes every AI text call (both tiers) to `model`, and image calls to
 * `options.image` when given. Pair with `resetAiTestModel()` in `afterEach`.
 * Refuses to run in production.
 *
 * @example
 * import { mockTextModel, resetAiTestModel, setAiTestModel } from "@/server/services/ai";
 * beforeEach(() => setAiTestModel(mockTextModel(JSON.stringify({ questions: [] }))));
 * afterEach(() => resetAiTestModel());
 */
export function setAiTestModel(model: AiLanguageModel, options: { image?: AiImageModel } = {}): void {
  if (env.NODE_ENV === "production") throw new Error("setAiTestModel() is for tests only");
  testOverride.language = model;
  testOverride.image = options.image;
}

/** Removes the model installed by `setAiTestModel()`. */
export function resetAiTestModel(): void {
  testOverride.language = undefined;
  testOverride.image = undefined;
}

let googleProvider: { apiKey: string; provider: ReturnType<typeof createGoogleGenerativeAI> } | undefined;

function google(): ReturnType<typeof createGoogleGenerativeAI> {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new AppError("AI_NOT_CONFIGURED", "GOOGLE_GENERATIVE_AI_API_KEY is not set");
  if (googleProvider?.apiKey !== apiKey) {
    googleProvider = { apiKey, provider: createGoogleGenerativeAI({ apiKey }) };
  }
  return googleProvider.provider;
}

function warnIfMockInProduction() {
  if (env.NODE_ENV === "production" && !warnedAboutMock) {
    warnedAboutMock = true;
    console.warn("[ai] AI_PROVIDER=mock is set in production: answers come from the fake model");
  }
}

/** The language model for a tier. Throws AI_NOT_CONFIGURED when no provider is available. */
export function resolveLanguageModel(tier: AiTier): ResolvedModel<AiLanguageModel> {
  if (testOverride.language) {
    return { model: testOverride.language, modelId: testOverride.language.modelId };
  }
  if (usesBuiltInMock()) {
    warnIfMockInProduction();
    const model = builtInMockModel(tier);
    return { model, modelId: model.modelId };
  }
  const modelId = tier === "smart" ? env.AI_MODEL_SMART : env.AI_MODEL_FAST;
  return { model: google()(modelId), modelId };
}

/** The image model. Throws AI_NOT_CONFIGURED when no provider is available. */
export function resolveImageModel(): ResolvedModel<AiImageModel> {
  if (testOverride.language) {
    if (!testOverride.image) {
      throw new AppError("AI_NOT_CONFIGURED", "No test image model installed (setAiTestModel options.image)");
    }
    return { model: testOverride.image, modelId: testOverride.image.modelId };
  }
  if (usesBuiltInMock()) {
    warnIfMockInProduction();
    const model = mockImageModel();
    return { model, modelId: model.modelId };
  }
  const modelId = env.AI_MODEL_IMAGE;
  return { model: google().image(modelId), modelId };
}

/** Model ids whose calls count toward the daily image quota. */
export function imageModelIds(): string[] {
  const ids = new Set([env.AI_MODEL_IMAGE, "mock-image"]);
  if (testOverride.image) ids.add(testOverride.image.modelId);
  return [...ids];
}
