import { createClient } from "@supabase/supabase-js";

// Service-role client. Server only — bypasses RLS and can manage auth users and
// private storage. Never import from a client component.
//
// The key is read from process.env at call time, so it is never inlined into a
// bundle (only NEXT_PUBLIC_* vars are). The guards below turn a future mistake
// into a loud failure instead of a silent, broken client.
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() was called in the browser. It holds the Supabase " +
        "service-role key and must only run on the server."
    );
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required for user " +
        "provisioning and private file storage."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const STORAGE_BUCKET = "project-assets";
