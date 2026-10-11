import { sql } from "drizzle-orm";
import { db } from "@/server/db";

// Liveness check for the host and for deploy verification. Reports whether the database
// answers; never returns configuration or error details.
export const dynamic = "force-dynamic";

// TEMPORARY (remove once advanced.ipAddress is configured): echoes the caller's own
// forwarding headers so we can see how the hosting proxy reports client addresses.
const FORWARDING_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "forwarded",
  "via",
];

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("diag") === "ip") {
    return Response.json(
      Object.fromEntries(FORWARDING_HEADERS.map((name) => [name, request.headers.get(name)])),
      { headers: { "cache-control": "no-store" } },
    );
  }
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
