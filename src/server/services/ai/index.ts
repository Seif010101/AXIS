import "server-only";

// The only entry point for AI in the app (docs/CONVENTIONS.md §7). Every call names a
// feature, passes the caller (quota + usage accounting) and a model tier.
//
//   generateStructured()  typed object validated by a zod schema
//   generateTextResult()  Markdown text
//   streamChat()          UI message stream Response for useChat (route handlers)
//   generateImage()       one image (base64) from the image model
//   cachedJson()          cache for deterministic, non-personal results
//   usageSummary()        token totals and estimated cost for the owner's report
//
// Tests: setAiTestModel(mockTextModel(...)) / resetAiTestModel(). Local development
// without a key: AI_PROVIDER=mock.

export { cachedJson, cacheKey, purgeExpiredCache, type CachedJsonOptions, type CacheKeyPart } from "./cache";
export { streamChat, toSafeModelMessages, type ChatFinish, type StreamChatInput } from "./chat";
export { isAiConfigured, resetAiTestModel, setAiTestModel, type AiTier } from "./config";
export {
  generateImage,
  generateStructured,
  generateTextResult,
  type AiCaller,
  type AiCallOptions,
  type AiInlineFile,
  type AiPrompt,
  type GeneratedImage,
} from "./generate";
export { AI_DAILY_LIMITS, CHAT_LIMITS, dailyLimit, type AiQuotaKind } from "./limits";
export { mockImageModel, mockTextModel, mockUsage, type AiImageModel, type AiLanguageModel } from "./mock";
export { DEFAULT_MODEL_PRICE, estimateCostUsd, MODEL_PRICES, type ModelPrice } from "./pricing";
export { languageInstruction, SAFETY_PREAMBLE } from "./prompts";
export { usedToday, type AiUsage } from "./quota";
export {
  usageSummary,
  type UsageGroupBy,
  type UsageSummary,
  type UsageSummaryRow,
  type UsageTotals,
} from "./usage";
