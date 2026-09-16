import { prisma } from "@/lib/prisma";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";
import { TEMPLATE_TYPES, COLLAB_FORM_TYPES } from "@/lib/documents/types";
import { WAITING_CLIENT_STATUSES } from "@/lib/questions";

// I/O for the client dashboard. One wave: every aggregate is filtered by the
// project *relation* rather than by a list of ids fetched first, so nothing
// here waits on anything else here. Same reasoning as commit 7fc4a19 on the
// team dashboard — round-trip latency dominates at this data size.

export async function loadClientDashboard(clientId: string, opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived ?? false;
  const projectScope = includeArchived ? { clientId } : { clientId, isArchived: false };
  const inMyProjects = { project: projectScope };

  const [projects, assets, projectDocs, clientDocs, pendingMaterials, questions, clientProfileDoc, brandKitDoc, approvals, completedStages] =
    await Promise.all([
      prisma.project.findMany({
        where: projectScope,
        select: {
          id: true, name: true, mode: true, currentStage: true, isArchived: true,
          briefPublishedAt: true, createdAt: true, updatedAt: true,
          stages: { select: { stageNumber: true, gateApproved: true } },
          cycles: { where: { status: "ACTIVE" }, select: { name: true }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // Shared assets drive both the wireframe/design review detection and the
      // "Recent" feed, so they come back once with only the columns needed.
      prisma.projectAsset.findMany({
        where: { ...inMyProjects, visibility: "SHARED" },
        select: { id: true, filename: true, folder: true, mimeType: true, uploadedAt: true, projectId: true },
        orderBy: { uploadedAt: "desc" },
      }),

      // Project documents the client can see. `content` is needed for
      // hasOpenClientItems on collab forms, so the status filter mirrors
      // isDocActive to avoid pulling every historical payload.
      prisma.document.findMany({
        where: {
          ...inMyProjects,
          OR: [
            { status: "SENT" },
            { status: "APPROVED", templateType: { in: [...COLLAB_FORM_TYPES] } },
            { templateType: { in: [TEMPLATE_TYPES.wireframeFeedback, TEMPLATE_TYPES.designFeedback] } },
          ],
        },
        select: {
          id: true, title: true, status: true, templateType: true, content: true,
          projectId: true, completedAt: true,
        },
      }),

      // Client-level onboarding documents (no project yet).
      prisma.document.findMany({
        where: { clientId, projectId: null, status: { in: ["SENT", "APPROVED"] } },
        select: { id: true, title: true, status: true, templateType: true, content: true, completedAt: true },
        orderBy: { sentAt: "desc" },
      }),

      prisma.materialItem.groupBy({
        by: ["projectId"],
        where: { ...inMyProjects, status: "pending" },
        _count: { _all: true },
      }),

      prisma.question.findMany({
        where: { recipientId: clientId, status: { in: WAITING_CLIENT_STATUSES } },
        select: {
          id: true, kind: true, questionText: true, proposedAnswer: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),

      prisma.document.findFirst({
        where: { clientId, templateType: PROFILE_DOC },
        select: { content: true },
      }),

      prisma.document.findFirst({
        where: { clientId, templateType: TEMPLATE_TYPES.brandKit, status: { not: "DRAFT" } },
        select: { content: true, updatedAt: true },
      }),

      prisma.approval.findMany({
        where: { project: projectScope },
        select: { id: true, stageNumber: true, approvedAt: true },
        orderBy: { approvedAt: "desc" },
        take: 5,
      }),

      prisma.projectStage.findMany({
        where: { project: projectScope, completedAt: { not: null } },
        select: { stageNumber: true, completedAt: true, projectId: true },
        orderBy: { completedAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    projects,
    assets,
    projectDocs,
    clientDocs,
    pendingMaterials,
    questions,
    pendingCopy: pendingCopyApprovals(clientProfileDoc?.content),
    brandKit: brandKitDoc,
    approvals,
    completedStages,
  };
}

export type ClientDashboardData = Awaited<ReturnType<typeof loadClientDashboard>>;

// Copy is client-facing ONLY once a team member has sent it for approval.
function pendingCopyApprovals(content: unknown) {
  const profile = (content ?? {}) as ClientProfile;
  const pending = <T extends { approved?: string | null; client_approval_requested_at?: string | null }>(
    rows: T[] | undefined
  ) => (rows ?? []).filter((r) => !!r.client_approval_requested_at && (r.approved ?? "pending") === "pending");
  return {
    messages: pending(profile.messaging?.key_messages),
    slogans: pending(profile.messaging?.slogans),
  };
}
