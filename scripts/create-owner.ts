// Creates the first platform owner. There is no public sign-up, so a fresh database
// needs this once. Prints a temporary password exactly once; the owner must change it
// and enroll two-factor authentication on first login.
//
// Usage: npm run create-owner -- <email> "<full name>"
import { createAccount } from "@/server/services/accounts";
import { closeDb } from "@/server/db";

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Usage: npm run create-owner -- <email> "<full name>"');
    process.exit(1);
  }
  const account = await createAccount({ email, name, role: "owner" });
  console.log(`Owner created: ${account.email}`);
  console.log(`Temporary password (shown once): ${account.password}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
