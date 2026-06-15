import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppSidebar from "@/components/team/AppSidebar";
import Topbar from "@/components/team/Topbar";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.user_metadata?.role?.toLowerCase() === "client") redirect("/portal");

  return (
    <div className="theme-dark theme-root flex h-screen">
      <AppSidebar userEmail={user.email ?? ""} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
