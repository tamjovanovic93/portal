"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { mutateDoc, clientIdForProject } from "@/lib/intake/store";
import { notifyClient } from "@/lib/notifications";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";

async function requireTeam() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (user.user_metadata?.role?.toLowerCase() === "client") throw new Error("Unauthorized");
  return user;
}

// Team EXPLICITLY sends a generated key message / slogan to the client for
// approval. Nothing reaches the client until this runs — agents only generate
// copy internally; a human decides what (if anything) to send.
export async function requestClientApprovalForItem(
  projectId: string,
  id: string,
  kind: "message" | "slogan"
): Promise<{ ok?: boolean; error?: string }> {
  await requireTeam();
  const clientId = await clientIdForProject(projectId);
  if (!clientId) return { error: "Project has no client." };

  let found = false;
  await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (content) => {
    const item =
      kind === "message"
        ? content.messaging?.key_messages?.find((m) => m.message_id === id)
        : content.messaging?.slogans?.find((s) => s.slogan_id === id);
    if (!item) return;
    found = true;
    item.client_approval_requested_at = new Date().toISOString();
    // Ensure it's pending so it surfaces as an open approval for the client.
    if ((item.approved ?? "pending") !== "pending") item.approved = "pending";
  });
  if (!found) return { error: "Item not found." };

  await notifyClient(clientId, {
    projectId,
    type: "copy_approval_requested",
    message: "Your team sent new copy for your approval.",
    link: "/portal",
  });
  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

async function getClientProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) throw new Error("Unauthorized");
  return profile;
}

async function assertOwnsProject(projectId: string, profileId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project || project.clientId !== profileId) throw new Error("Not found");
}

// Client approves / requests changes on a key message in the profile JSON.
export async function respondToKeyMessage(
  projectId: string,
  messageId: string,
  decision: "yes" | "no"
) {
  const profile = await getClientProfile();
  await assertOwnsProject(projectId, profile.id);

  const clientId = (await clientIdForProject(projectId)) ?? profile.id;
  await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (content) => {
    const item = content.messaging?.key_messages?.find((m) => m.message_id === messageId);
    if (item) item.approved = decision;
  });
  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
}

export async function respondToSlogan(
  projectId: string,
  sloganId: string,
  decision: "yes" | "no"
) {
  const profile = await getClientProfile();
  await assertOwnsProject(projectId, profile.id);

  const clientId = (await clientIdForProject(projectId)) ?? profile.id;
  await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (content) => {
    const item = content.messaging?.slogans?.find((s) => s.slogan_id === sloganId);
    if (item) item.approved = decision;
  });
  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
}

// Team dismisses an approval item from the project Approvals view by stamping
// who acknowledged it and when.
export async function acknowledgeApprovalItem(
  projectId: string,
  id: string,
  kind: "message" | "slogan"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const now = new Date().toISOString();
  const clientId = (await clientIdForProject(projectId)) ?? user.id;
  await mutateDoc<ClientProfile>(clientId, PROFILE_DOC, (content) => {
    const item =
      kind === "message"
        ? content.messaging?.key_messages?.find((m) => m.message_id === id)
        : content.messaging?.slogans?.find((s) => s.slogan_id === id);
    if (item) {
      item.team_acknowledged_at = now;
      item.team_acknowledged_by = user.id;
    }
  });
  revalidatePath(`/projects/${projectId}`);
}

// Client approve / request-changes on a retainer deliverable task. (Unchanged —
// operates on Task rows, not the intake JSON.)
export async function respondToDeliverableTask(
  taskId: string,
  decision: "approve" | "changes",
  notes?: string
) {
  const profile = await getClientProfile();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { cycle: { include: { project: { select: { id: true, clientId: true } } } } },
  });
  if (!task || task.cycle.project.clientId !== profile.id) throw new Error("Not found");

  const projectId = task.cycle.project.id;
  const trimmedNotes = notes?.trim() || null;

  if (decision === "approve") {
    await prisma.$transaction([
      prisma.approval.create({
        data: {
          projectId,
          taskId,
          approvedById: profile.id,
          method: "PORTAL",
          notes: trimmedNotes,
        },
      }),
      prisma.task.update({
        where: { id: taskId },
        data: { status: "DONE", completedAt: new Date() },
      }),
      prisma.activityLog.create({
        data: {
          projectId,
          actorId: profile.id,
          action: "deliverable_approved",
          detail: `Client approved deliverable: ${task.name}`,
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: { status: "IN_PROGRESS" },
      }),
      prisma.activityLog.create({
        data: {
          projectId,
          actorId: profile.id,
          action: "deliverable_changes_requested",
          detail: `Client requested changes on: ${task.name}`,
          metadata: trimmedNotes ? { notes: trimmedNotes } : undefined,
        },
      }),
    ]);
  }

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
