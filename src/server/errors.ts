// Error contract for the /api/v1 routes: { code, message }. The client maps `code` to a
// localized string; `message` is an English fallback for logs and developers.
export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NO_SCHOOL: 403,
  TWO_FACTOR_REQUIRED: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  STEP_UP_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  AI_NOT_CONFIGURED: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string = code, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { code: error.code, message: error.message, details: error.details },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json({ code: "INTERNAL", message: "Internal server error" }, { status: 500 });
}
