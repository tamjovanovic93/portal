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

  if (!user) redirect("/login");
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
