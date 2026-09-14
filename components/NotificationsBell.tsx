import { getSessionUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notifications";
import Notifications from "@/components/Notifications";

// Server component: loads the current user's notifications and renders the
// interactive bell. Placed in the team Topbar and the client header.
export default async function NotificationsBell() {
  const user = await getSessionUser();
  if (!user) return null;

  const rows = await listNotifications(user.id, user.role);
  const items = rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    link: n.link,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return <Notifications items={items} />;
}
