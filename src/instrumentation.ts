// Runs once when a Next.js server instance starts, before it handles requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./server/db/migrate");
  // A failed migration stops the server from starting: running against a schema the code
  // doesn't expect is worse than being down.
  await runMigrations();
}
