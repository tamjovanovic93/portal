import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import NotificationsBell from "@/components/NotificationsBell";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.user_metadata?.role?.toLowerCase() !== "client") redirect("/dashboard");

  return (
    <div className="theme-light theme-root min-h-screen">
      <header style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              style={{ width: 26, height: 26, borderRadius: 8, background: "var(--mint)", boxShadow: "var(--mint-glow)" }}
              className="flex items-center justify-center"
            >
              <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2.5px solid #fff" }} />
            </div>
            <span className="tech" style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}>ZER0&nbsp;P0INT</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <form action={logout}>
              <button type="submit" className="btn btn-sm btn-ghost">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="w-full">{children}</main>
    </div>
  );
}
