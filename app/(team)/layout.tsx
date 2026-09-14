import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import AppSidebar from "@/components/team/AppSidebar";
import Topbar from "@/components/team/Topbar";
import NotificationsBell from "@/components/NotificationsBell";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  // Token is valid but the profile is missing or deactivated: end the session
  // instead of bouncing to /login, which the proxy would send straight back.
  if (!user) redirect("/auth/signout");
  if (user.role === "CLIENT") redirect("/portal");

  return (
    <div className="theme-dark theme-root flex h-screen">
      <AppSidebar userEmail={user.email} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar notifications={<NotificationsBell />} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
