// Secret lookup for plain Node scripts: environment first, then Supabase Vault.
// Mirrors lib/secrets.ts, which the app uses. Needs DATABASE_URL in .env.
export async function getSecret(prisma, name) {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const rows = await prisma.$queryRawUnsafe(
    `select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1`,
    name
  );
  return rows[0]?.decrypted_secret?.trim() || undefined;
}

export async function requireSecret(prisma, name) {
  const v = await getSecret(prisma, name);
  if (!v) throw new Error(`Secret "${name}" not found in the environment or Vault.`);
  return v;
}
