// Copy secrets from the local environment into Supabase Vault, so they no
// longer have to live in an environment store. Values never touch git.
//
//   node --env-file=.env scripts/secrets-push.mjs ANTHROPIC_API_KEY AI_JOB_SECRET
//   node --env-file=.env scripts/secrets-push.mjs --list
//
// Re-running with a changed value updates the stored secret.
//
// Not every secret can move. DATABASE_URL and DIRECT_URL are the credential for
// the database Vault lives in, so storing them there is circular. CRON_SECRET is
// read by Vercel itself to sign cron requests. Those stay in the environment.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BLOCKED = new Set(["DATABASE_URL", "DIRECT_URL", "CRON_SECRET"]);

const args = process.argv.slice(2);

if (args.includes("--list") || args.length === 0) {
  const rows = await prisma.$queryRawUnsafe(
    `select name, description, updated_at from vault.secrets order by name`
  );
  if (rows.length === 0) console.log("Vault is empty.");
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(24)} updated ${new Date(r.updated_at).toISOString()}`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

for (const name of args) {
  if (BLOCKED.has(name)) {
    console.log(`  ${name}: refused — must stay in the environment (see header).`);
    continue;
  }
  const value = process.env[name]?.trim();
  if (!value) {
    console.log(`  ${name}: not set in the environment, skipped.`);
    continue;
  }
  const existing = await prisma.$queryRawUnsafe(
    `select id from vault.secrets where name = $1 limit 1`,
    name
  );
  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `select vault.update_secret($1::uuid, $2, $3)`,
      existing[0].id,
      value,
      name
    );
    console.log(`  ${name}: updated (${value.length} chars)`);
  } else {
    await prisma.$executeRawUnsafe(
      `select vault.create_secret($1, $2, $3)`,
      value,
      name,
      `Set from the environment on ${new Date().toISOString().slice(0, 10)}`
    );
    console.log(`  ${name}: stored (${value.length} chars)`);
  }
}

// Prove they read back before anyone deletes the environment copy.
for (const name of args.filter((a) => !BLOCKED.has(a))) {
  const rows = await prisma.$queryRawUnsafe(
    `select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1`,
    name
  );
  const ok = rows[0]?.decrypted_secret === process.env[name]?.trim();
  console.log(`  ${name}: read-back ${ok ? "matches" : "MISMATCH"}`);
}

await prisma.$disconnect();
