import mysql from "mysql2/promise";

// Deletes rows that have expired and are never read again, so the auth and cache tables
// don't grow forever on a small hosting database: ended sessions (their step-up grants
// cascade), used/expired verification values (2FA sign-in challenges), stale rate-limit
// and throttle counters, and expired AI cache entries.
//
// Runs from src/instrumentation.ts at startup and then every few hours. Like the migrator
// it talks to the database directly (instrumentation runs outside the React server graph).

/** Longest throttle window in the app is 1 hour; a day of margin keeps every live counter. */
const COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface HousekeepingResult {
  sessions: number;
  stepUps: number;
  verifications: number;
  rateLimits: number;
  throttles: number;
  contentCache: number;
}

export async function runHousekeeping(
  url: string | undefined = process.env.DATABASE_URL,
  now: Date = new Date(),
): Promise<HousekeepingResult | null> {
  if (!url) return null;
  const connection = await mysql.createConnection({ uri: url, timezone: "Z", charset: "utf8mb4" });
  const cutoff = new Date(now.getTime() - COUNTER_RETENTION_MS);
  const remove = async (statement: string, value: Date | number) => {
    const [result] = await connection.query(statement, [value]);
    return (result as mysql.ResultSetHeader).affectedRows;
  };
  try {
    await connection.query("SET time_zone = '+00:00'");
    return {
      sessions: await remove("DELETE FROM sessions WHERE expires_at < ?", now),
      stepUps: await remove("DELETE FROM step_ups WHERE expires_at < ?", now),
      verifications: await remove("DELETE FROM verifications WHERE expires_at < ?", now),
      // Better Auth stores the last request as epoch milliseconds.
      rateLimits: await remove("DELETE FROM rate_limits WHERE last_request < ?", cutoff.getTime()),
      throttles: await remove("DELETE FROM throttles WHERE window_started_at < ?", cutoff),
      contentCache: await remove("DELETE FROM content_cache WHERE expires_at < ?", now),
    };
  } finally {
    await connection.end();
  }
}

const EVERY_SIX_HOURS = 6 * 60 * 60 * 1000;

/** Runs housekeeping now and every six hours. Failures are logged, never fatal. */
export function scheduleHousekeeping(): void {
  const run = () =>
    runHousekeeping()
      .then((result) => {
        if (result) console.log("[housekeeping] removed expired rows", result);
      })
      .catch((error: unknown) =>
        console.error("[housekeeping] failed", error instanceof Error ? error.message : error),
      );
  void run();
  // unref(): a pending timer must never keep the process alive on shutdown.
  setInterval(run, EVERY_SIX_HOURS).unref();
}
