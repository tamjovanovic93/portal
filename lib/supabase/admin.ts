import { createClient } from "@supabase/supabase-js";
import { requireSecret } from "@/lib/secrets";

// Service-role client. Server only — bypasses RLS, and is the only credential
// that can manage auth users or reach the private storage bucket.
//
// The key is resolved through lib/secrets.ts, so it can live in Supabase Vault
// rather than an environment variable. That is not circular: Vault is read over
// the Prisma connection (DATABASE_URL), which never needs this key.
export async function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() was called in the browser. It holds the Supabase " +
        "service-role key and must only run on the server."
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    await requireSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const STORAGE_BUCKET = "project-assets";
