import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homeFor(user.role));
}
