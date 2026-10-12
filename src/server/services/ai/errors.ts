import "server-only";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { AppError, type ErrorCode } from "@/server/errors";
import type { AiUsage } from "./quota";

function rootCause(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

function providerStatus(error: unknown): number | undefined {
  const cause = rootCause(error);
  return APICallError.isInstance(cause) ? cause.statusCode : undefined;
}

/** The error code a client sees for a failed model call (no provider details). */
export function aiErrorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) return error.code;
  return providerStatus(error) === 429 ? "RATE_LIMITED" : "INTERNAL";
}

/**
 * Turns anything a model call throws into an AppError. Provider details are logged on the
 * server and never reach the client: the provider's 429 becomes RATE_LIMITED, everything
 * else INTERNAL. AppErrors (quota, configuration, validation) pass through unchanged.
 */
export function toAiAppError(error: unknown, context: { feature: string; modelId: string }): AppError {
  if (error instanceof AppError) return error;
  const cause = rootCause(error);
  console.error("[ai] model call failed", {
    feature: context.feature,
    model: context.modelId,
    error: cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
    status: providerStatus(error),
  });
  return aiErrorCode(error) === "RATE_LIMITED"
    ? new AppError("RATE_LIMITED", "The AI provider is busy", { reason: "ai_provider_busy" })
    : new AppError("INTERNAL", "AI request failed");
}

/** Token usage carried by an error, when the model did answer (e.g. an invalid object). */
export function usageFromError(error: unknown): AiUsage | undefined {
  if (NoObjectGeneratedError.isInstance(error) && error.usage) {
    return { inputTokens: error.usage.inputTokens ?? 0, outputTokens: error.usage.outputTokens ?? 0 };
  }
  return undefined;
}
