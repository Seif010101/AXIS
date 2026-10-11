import { sql } from "drizzle-orm";
import { db } from "@/server/db";

// Liveness check for the host and for deploy verification. Reports whether the database
// answers; never returns configuration or error details.
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "unavailable" = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error("[health] database check failed", error);
    database = "unavailable";
  }
  return Response.json(
    { status: database === "ok" ? "ok" : "degraded", database },
    { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
