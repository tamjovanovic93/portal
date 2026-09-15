import { prisma } from "@/lib/prisma";

// Server-side secret lookup, backed by Supabase Vault.
//
// Resolution order for a given name:
//   1. process.env — an override. Keeps local development working without a
//      database, and gives an escape hatch if Vault is ever unreachable.
//   2. vault.decrypted_secrets — the store of record in production.
//
// Values are cached for the life of the process, so a warm serverless instance
// reads Vault once. Rotating a secret therefore takes effect on the next cold
// start; call clearSecretCache() from a deploy hook if that is ever too slow.
//
// What this does and does not buy: it removes copies of a secret from
// environment stores and gives one place to rotate. It does NOT reduce blast
// radius, because anything holding DATABASE_URL or the service-role key can
// read Vault too. Secrets that must live in the environment:
//   DATABASE_URL / DIRECT_URL — the credential for the database Vault lives in.
//   SUPABASE_SERVICE_ROLE_KEY — needed before any database call is possible.
//   CRON_SECRET — Vercel reads it to sign cron requests; our code only verifies.

const cache = new Map<string, string | undefined>();

export class MissingSecretError extends Error {
  constructor(name: string) {
    super(
      `Secret "${name}" is not set. Add it to the environment, or store it in ` +
        `Supabase Vault with: node --env-file=.env scripts/secrets-push.mjs ${name}`
    );
    this.name = "MissingSecretError";
  }
}

export async function getSecret(name: string): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    throw new Error(`getSecret("${name}") was called in the browser.`);
  }
  if (cache.has(name)) return cache.get(name);

  const fromEnv = process.env[name]?.trim();
  if (fromEnv) {
    cache.set(name, fromEnv);
    return fromEnv;
  }

  let value: string | undefined;
  try {
    const rows = await prisma.$queryRaw<{ decrypted_secret: string | null }[]>`
      select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1
    `;
    value = rows[0]?.decrypted_secret?.trim() || undefined;
  } catch (error) {
    // Vault unreachable or not provisioned: treat as "not found" so the caller
    // raises a clear MissingSecretError rather than a Postgres one.
    console.error(`Vault lookup failed for "${name}":`, error);
    value = undefined;
  }

  cache.set(name, value);
  return value;
}

// Same as getSecret but throws when absent, for call sites that cannot proceed.
export async function requireSecret(name: string): Promise<string> {
  const value = await getSecret(name);
  if (!value) throw new MissingSecretError(name);
  return value;
}

export function clearSecretCache(name?: string): void {
  if (name) cache.delete(name);
  else cache.clear();
}
