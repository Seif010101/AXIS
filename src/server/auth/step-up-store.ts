import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { stepUps } from "@/server/db/schema";

// Storage for step-up grants, separate from step-up.ts so the Better Auth hooks can read
// it without importing the auth instance (which would be circular).

export const STEP_UP_TTL_SECONDS = 5 * 60;

export async function hasValidStepUp(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ sessionId: stepUps.sessionId })
    .from(stepUps)
    .where(and(eq(stepUps.sessionId, sessionId), gt(stepUps.expiresAt, new Date())))
    .limit(1);
  return Boolean(row);
}

export async function recordStepUp(sessionId: string, userId: string): Promise<Date> {
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + STEP_UP_TTL_SECONDS * 1000);
  await db
    .insert(stepUps)
    .values({ sessionId, userId, verifiedAt, expiresAt })
    .onDuplicateKeyUpdate({ set: { verifiedAt, expiresAt } });
  return expiresAt;
}
