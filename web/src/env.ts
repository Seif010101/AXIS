import "server-only";
import { z } from "zod";

// Server-side environment. Parsed once at import; the app refuses to start with a
// missing or weak secret (the legacy backend only logged a warning and kept going).
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // MySQL / MariaDB (Hostinger in production, XAMPP MariaDB locally).
  DATABASE_URL: z.string().regex(/^mysql:\/\//, "DATABASE_URL must start with mysql://"),
  // Shared hosting caps connections per database user, so keep the pool small.
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),

  // Accounts are generated as <prefix><id>@<domain>; the domain may change (see brand rename).
  ALLOWED_EMAIL_DOMAIN: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),

  // Signs short-lived library-proxy tickets (replaces putting the session token in URLs).
  PROXY_TICKET_SECRET: z.string().min(32),

  // AI (Gemini via AI SDK). Optional in dev: AI features return a clear "not configured" error.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL_FAST: z.string().default("gemini-3.5-flash-lite"),
  AI_MODEL_SMART: z.string().default("gemini-3.8-flash"),
  AI_MODEL_IMAGE: z.string().default("gemini-3.1-flash-image"),

  // File storage: Backblaze B2 (S3-compatible). Optional until book uploads are used.
  B2_KEY_ID: z.string().optional(),
  B2_APP_KEY: z.string().optional(),
  B2_BUCKET: z.string().optional(),
  B2_ENDPOINT: z.url().optional(),
  B2_REGION: z.string().optional(),

  // Optional "Sign in with Microsoft" (single tenant).
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  // Lint/type-check jobs may import server modules without secrets.
  if (process.env.SKIP_ENV_VALIDATION === "1") return process.env as unknown as Env;
  // Hosting panels save unset variables as empty strings; treat those as missing.
  const source = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
