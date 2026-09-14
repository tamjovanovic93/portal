// Phase 1 one-off: mirror profiles.role into auth.users.app_metadata.role so
// the proxy can route from the JWT without a DB call. Idempotent — re-run safe.
// Run: node --env-file=.env scripts/p1-sync-app-metadata.mjs
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const profiles = await prisma.profile.findMany({ select: { id: true, email: true, role: true } });
let updated = 0, missing = 0, failed = 0;

for (const p of profiles) {
  const { data, error } = await admin.auth.admin.getUserById(p.id);
  if (error || !data?.user) {
    missing++;
    console.log(`  no auth user for ${p.email} (${p.role}) — skipped`);
    continue;
  }
  const current = data.user.app_metadata?.role;
  if (current === p.role) continue;
  const { error: updErr } = await admin.auth.admin.updateUserById(p.id, {
    app_metadata: { ...data.user.app_metadata, role: p.role },
  });
  if (updErr) {
    failed++;
    console.error(`  failed ${p.email}: ${updErr.message}`);
  } else {
    updated++;
    console.log(`  ${p.email} → ${p.role}`);
  }
}

console.log(`\nDone. updated=${updated} unchanged=${profiles.length - updated - missing - failed} no-auth-user=${missing} failed=${failed}`);
await prisma.$disconnect();
