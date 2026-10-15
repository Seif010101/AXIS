import { eq } from "drizzle-orm";
import { auth } from "@/server/auth/auth";
import { closeDb, db, schema } from "@/server/db";
import { createAccount, resetPassword } from "@/server/services/accounts";

async function main() {
  const [key, role] = process.argv.slice(2) as [string, "admin" | "student"];
  const email = `fui.${key}@morix.tech`;
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email);
  let password: string;
  if (existing) {
    await db.delete(schema.twoFactors).where(eq(schema.twoFactors.userId, existing.user.id));
    await db.update(schema.users).set({ twoFactorEnabled: false }).where(eq(schema.users.id, existing.user.id));
    password = await resetPassword(existing.user.id);
  } else {
    password = (await createAccount({ email, name: `Flow ${key}`, role, schoolId: null })).password;
  }
  console.log(JSON.stringify({ email, password }));
}
main().finally(closeDb);
