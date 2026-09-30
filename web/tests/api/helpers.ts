import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";

export const ORIGIN = "http://localhost:3000";

export async function resetDatabase() {
  const { db } = await import("@/server/db");
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  const [rows] = await db.execute(
    sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`,
  );
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const row of rows as unknown as { name: string }[]) {
    await db.execute(sql.raw(`TRUNCATE TABLE \`${row.name}\``));
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

/** A browser-like client: keeps cookies between requests to the Better Auth handler. */
export class TestClient {
  private cookies = new Map<string, string>();

  get cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /** Headers as a Next.js request would carry them (for code that calls next/headers). */
  get headers(): Headers {
    return new Headers({ cookie: this.cookieHeader, origin: ORIGIN });
  }

  async request(method: "GET" | "POST", path: string, body?: unknown) {
    const { auth } = await import("@/server/auth/auth");
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          cookie: this.cookieHeader,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = setCookie.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  signIn(email: string, password: string) {
    return this.request("POST", "/sign-in/email", { email, password });
  }
}

// Independent RFC 6238 implementation (SHA-1, 6 digits, 30 s) — the same algorithm
// Microsoft Authenticator and Google Authenticator use. Proves real apps will work.
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

export function totpFromUri(totpUri: string, atMs = Date.now()): string {
  const secret = new URL(totpUri).searchParams.get("secret");
  if (!secret) throw new Error("TOTP URI has no secret");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export function wrongCode(correct: string): string {
  return correct === "000000" ? "111111" : "000000";
}
