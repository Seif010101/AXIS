import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import mysql from "mysql2/promise";

// Creates the first platform owner on a fresh production database, which is not reachable
// from outside the host (so `npm run create-owner` can't be pointed at it).
//
// Set BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_OWNER_NAME and BOOTSTRAP_OWNER_PASSWORD in the host's
// environment, restart once, then REMOVE the three variables. It only ever acts when the
// database has no owner yet, so leaving them set can't create a second owner or reset the
// first one's password. The owner must change the password and enroll two-factor
// authentication on first sign-in (must_change_password = 1, two_factor_enabled = 0).
//
// Runs from src/instrumentation.ts, outside the React server graph, so it talks to the
// database directly instead of going through Better Auth's adapter. The password hash is
// Better Auth's own scrypt format, so normal sign-in verifies it.
const MIN_PASSWORD_LENGTH = 12;

export type BootstrapOutcome = "not-configured" | "owner-exists" | "created";

export async function bootstrapOwner(
  env: Record<string, string | undefined> = process.env,
): Promise<BootstrapOutcome> {
  const email = env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  const name = env.BOOTSTRAP_OWNER_NAME?.trim();
  const password = env.BOOTSTRAP_OWNER_PASSWORD;
  if (!email && !name && !password) return "not-configured";
  if (!email || !name || !password || !env.DATABASE_URL) {
    throw new Error("[bootstrap] BOOTSTRAP_OWNER_EMAIL, _NAME and _PASSWORD must all be set");
  }
  const domain = env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
  if (!domain || !email.endsWith(`@${domain}`) || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new Error(`[bootstrap] BOOTSTRAP_OWNER_EMAIL must be an address ending with @${domain}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error(`[bootstrap] BOOTSTRAP_OWNER_PASSWORD must be ${MIN_PASSWORD_LENGTH}-128 characters`);
  }

  const connection = await mysql.createConnection({
    uri: env.DATABASE_URL,
    timezone: "Z",
    charset: "utf8mb4",
  });
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.beginTransaction();
    // Locks the owner rows (and the gap) so two booting instances can't both create one.
    const [owners] = await connection.query("SELECT id FROM users WHERE role = 'owner' LIMIT 1 FOR UPDATE");
    if ((owners as unknown[]).length > 0) {
      await connection.rollback();
      console.log("[bootstrap] an owner already exists; remove the BOOTSTRAP_OWNER_* variables");
      return "owner-exists";
    }
    const now = new Date();
    const userId = randomUUID();
    await connection.query(
      `INSERT INTO users (id, full_name, email, email_verified, role, is_active, must_change_password,
         two_factor_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 1, 'owner', 1, 1, 0, ?, ?)`,
      [userId, name, email, now, now],
    );
    await connection.query(
      `INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
       VALUES (?, ?, ?, 'credential', ?, ?, ?)`,
      [randomUUID(), userId, userId, await hashPassword(password), now, now],
    );
    await connection.commit();
    console.log(`[bootstrap] owner account created for ${email}; remove the BOOTSTRAP_OWNER_* variables`);
    return "created";
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}
