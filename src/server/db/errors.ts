// MySQL error helpers. Drizzle wraps driver errors ("Failed query: …") and keeps the
// original mysql2 error as `cause`, so check both levels.
function errnoOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const direct = (error as { errno?: unknown }).errno;
  if (typeof direct === "number") return direct;
  return errnoOf((error as { cause?: unknown }).cause);
}

/** ER_DUP_ENTRY: a unique index rejected the row. */
export function isDuplicateKeyError(error: unknown): boolean {
  return errnoOf(error) === 1062;
}

/** ER_ROW_IS_REFERENCED_2: a RESTRICT foreign key blocked a delete. */
export function isForeignKeyBlockError(error: unknown): boolean {
  return errnoOf(error) === 1451;
}
