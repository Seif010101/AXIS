import "server-only";

/** US dollars per one million tokens. */
export interface ModelPrice {
  input: number;
  output: number;
}

/**
 * Price list used by the owner's AI-cost report. These are estimates: edit them when the
 * provider's price list changes. A model id matches the longest key it starts with
 * (`gemini-3.8-flash-001` uses `gemini-3.8-flash`); unknown models use `DEFAULT_MODEL_PRICE`.
 *
 * Image models bill generated images as output tokens (about 1,300 tokens per image).
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-3.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-3.8-flash": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-image": { input: 0.3, output: 30 },
  // Built-in development fake and test models cost nothing.
  mock: { input: 0, output: 0 },
};

/** Used for models missing from MODEL_PRICES; deliberately on the expensive side. */
export const DEFAULT_MODEL_PRICE: ModelPrice = { input: 1.25, output: 10 };

/** The price entry for a model id (longest matching prefix, else the default). */
export function priceFor(model: string): ModelPrice {
  let best: string | undefined;
  for (const key of Object.keys(MODEL_PRICES)) {
    if (model.startsWith(key) && (best === undefined || key.length > best.length)) best = key;
  }
  return best === undefined ? DEFAULT_MODEL_PRICE : MODEL_PRICES[best];
}

/**
 * Estimated cost in US dollars of a call (or a sum of calls) on one model, rounded to
 * millionths of a dollar.
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  const cost = (Math.max(0, inputTokens) * price.input + Math.max(0, outputTokens) * price.output) / 1e6;
  return Math.round(cost * 1e6) / 1e6;
}
