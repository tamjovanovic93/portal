import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import NotificationsBell from "@/components/NotificationsBell";
import PortalNav from "@/components/client/PortalNav";
import Button from "@/components/ui/Button";
import { Avatar } from "@/components/ui/kit";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  // See the note in app/(team)/layout.tsx.
  if (!user) redirect("/auth/signout");
  if (user.role !== "CLIENT") redirect("/dashboard");

  const displayName = user.name ?? user.email;

  return (
    <div className="theme-light theme-root min-h-screen">
      {/* zIndex is inline, not a utility: design.css is imported unlayered and
          its `.theme-root > * { z-index: 1 }` outranks any Tailwind z-* class,
          which would let <main> paint over this header. */}
      <header
        className="sticky top-0"
        style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)", zIndex: 50 }}
      >
        <div className="px-4 sm:px-6 lg:px-8 h-[62px] flex items-center gap-4 sm:gap-8">
          <Link href="/portal" className="flex items-center gap-2.5 shrink-0">
            <div
              style={{ width: 26, height: 26, borderRadius: 8, background: "var(--mint)", boxShadow: "var(--mint-glow)" }}
              className="flex items-center justify-center"
            >
              <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2.5px solid #fff" }} />
            </div>
            <span className="tech" style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}>ZER0&nbsp;P0INT</span>
          </Link>
          <div className="hidden sm:block">
            <PortalNav />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <span className="hidden md:flex items-center gap-2.5">
              <Avatar name={displayName} color="mint" size={26} ring={false} />
              <span className="text-sm text-ink-2 whitespace-nowrap">{displayName}</span>
            </span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
        </div>
        {/* Under sm the links drop to their own scrollable row. */}
        <div className="sm:hidden">
          <PortalNav mobile />
        </div>
      </header>
      <main className="w-full">{children}</main>
    </div>
  );
}
