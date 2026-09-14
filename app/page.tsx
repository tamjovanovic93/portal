import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getSessionUser();
  // Reached only with a valid token (the proxy handles the no-token case),
  // so a missing profile means the session has to go.
  if (!user) redirect("/auth/signout");
  redirect(homeFor(user.role));
}
