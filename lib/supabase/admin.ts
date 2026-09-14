import { createClient } from "@supabase/supabase-js";

// Service-role client. Server only — bypasses RLS and can manage auth users and
// private storage. Never import from a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const STORAGE_BUCKET = "project-assets";
