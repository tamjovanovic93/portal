// Small display formatters shared across pages. Each keeps the exact output of
// the copy it replaced, so text on screen does not change.

const DAY = 86400000;

// "512 B" / "48 KB" / "1.2 MB". Empty string for null/0.
export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Same as formatBytes but never drops below KB ("0 KB" for tiny files).
export function formatBytesKb(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "03_home-page.png" -> "Home Page". Falls back to the filename.
export function labelFromFilename(filename: string): string {
  const name = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]/g, " ")
    .replace(/^\d+\s*/, "")
    .trim();
  return name.replace(/\b\w/g, (c) => c.toUpperCase()) || filename;
}

// Local-time yyyy-mm-dd for <input type="date">; "" when null.
export function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Like toDateInput but defaults to today when null.
export function toDateInputOrToday(d: Date | string | null): string {
  return toDateInput(d ?? new Date());
}

// UTC yyyy-mm-dd (ISO slice) for <input type="date">; "" when null.
export function toIsoDateInput(d: string | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

// Full, unambiguous timestamp (e.g. "8 Sep 2026, 14:32").
export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// "5m ago" / "3h ago" / "2d ago" relative to `now`.
export function timeAgo(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / DAY);
  return `${days}d ago`;
}

// "Today" / "Tomorrow" / "Mon 14 Sep".
export function formatUpcomingDate(d: Date, now: Date): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - startOfToday.getTime()) / DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY);
}
