import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import NotificationsBell from "@/components/NotificationsBell";
import Button from "@/components/ui/Button";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  // See the note in app/(team)/layout.tsx.
  if (!user) redirect("/auth/signout");
  if (user.role !== "CLIENT") redirect("/dashboard");

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
              <Button variant="ghost" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="w-full">{children}</main>
    </div>
  );
}
