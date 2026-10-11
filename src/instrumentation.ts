// Runs once when a Next.js server instance starts, before it handles requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./server/db/migrate");
  // A failed migration stops the server from starting: running against a schema the code
  // doesn't expect is worse than being down.
  await runMigrations();

  // First-owner bootstrap for a fresh production database (no-op unless configured).
  // A misconfiguration is logged, not fatal: the rest of the platform keeps working.
  const { bootstrapOwner } = await import("./server/bootstrap-owner");
  await bootstrapOwner().catch((error: unknown) =>
    console.error(error instanceof Error ? error.message : error),
  );
}
