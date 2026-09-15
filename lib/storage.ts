import { createAdminClient, STORAGE_BUCKET } from "@/lib/supabase/admin";

// Best-effort removal of storage objects. Never throws — the DB rows are
// already gone by the time this runs; a failure only leaves an orphaned file.
export async function removeStorageObjects(paths: string[]): Promise<void> {
  const real = paths.filter((p) => p && !/^https?:\/\//i.test(p));
  if (real.length === 0) return;
  const admin = await createAdminClient();
  for (let i = 0; i < real.length; i += 100) {
    const chunk = real.slice(i, i + 100);
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(chunk);
    if (error) console.error("removeStorageObjects failed:", error.message, chunk.length, "paths");
  }
}

// Signed URLs for a batch of storage paths in one round-trip. Links (text/uri-list
// assets) are returned unchanged.
export async function getSignedUrls(
  paths: string[],
  ttlSeconds = 60 * 60
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const real = paths.filter((p) => p && !/^https?:\/\//i.test(p));
  for (const p of paths) if (!real.includes(p)) out.set(p, p);
  if (real.length === 0) return out;
  const admin = await createAdminClient();
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUrls(real, ttlSeconds);
  if (error || !data) {
    console.error("getSignedUrls failed:", error?.message);
    return out;
  }
  for (const row of data) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
