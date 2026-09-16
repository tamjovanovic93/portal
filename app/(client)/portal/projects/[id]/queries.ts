import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth/access";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";

// I/O for the client project detail page. One wave — nothing here depends on
// anything else here, so the whole page costs a single database round trip.
// (See app/(team)/dashboard/queries.ts for the same pattern on the team side.)

export async function loadClientProject(projectId: string) {
  // Throws NotFoundError / UnauthorizedError; the page turns both into notFound().
  const { user, project: guard } = await requireProjectAccess(projectId);
  const clientId = guard.clientId;

  const [project, assets, materials, documents, cycles, approvals, completedStages, clientProfileDoc, siblings] =
    await Promise.all([
      prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: {
          id: true, name: true, type: true, mode: true, currentStage: true,
          briefPublishedAt: true, createdAt: true,
          stages: {
            select: { stageNumber: true, status: true, gateApproved: true, completedAt: true },
            orderBy: { stageNumber: "asc" },
          },
        },
      }),
      prisma.projectAsset.findMany({
        where: { projectId, visibility: "SHARED" },
        select: {
          id: true, filename: true, folder: true, mimeType: true, sizeBytes: true,
          storagePath: true, notes: true, uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.materialItem.findMany({
        where: { projectId },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      prisma.document.findMany({
        where: { projectId, status: { in: ["SENT", "APPROVED"] } },
        orderBy: { sentAt: "desc" },
      }),
      // Empty for PROJECT-mode projects. Fetched unconditionally so mode does
      // not cost a second round trip.
      prisma.cycle.findMany({
        where: { projectId },
        orderBy: { startDate: "desc" },
        include: {
          tasks: {
            where: { type: { not: "INTERNAL" } },
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { approvals: true } } },
          },
        },
      }),
      prisma.approval.findMany({
        where: { projectId },
        select: { id: true, stageNumber: true, approvedAt: true },
        orderBy: { approvedAt: "desc" },
        take: 5,
      }),
      prisma.projectStage.findMany({
        where: { projectId, completedAt: { not: null } },
        select: { stageNumber: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: 5,
      }),
      // Key messages / slogans awaiting this client's sign-off live in the
      // client-level profile document, not on the project.
      prisma.document.findFirst({
        where: { clientId, templateType: PROFILE_DOC },
        select: { content: true },
      }),
      prisma.project.findMany({
        where: { clientId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  return {
    user,
    project,
    assets,
    materials,
    documents,
    cycles,
    approvals,
    completedStages,
    pendingCopy: pendingCopyApprovals(clientProfileDoc?.content),
    siblings,
  };
}

export type ClientProjectData = Awaited<ReturnType<typeof loadClientProject>>;

// Copy is client-facing ONLY after a team member explicitly sends it for
// approval. Agent-generated copy stays internal.
function pendingCopyApprovals(content: unknown) {
  const profile = (content ?? {}) as ClientProfile;
  const pending = <T extends { approved?: string | null; client_approval_requested_at?: string | null }>(
    rows: T[] | undefined
  ) =>
    (rows ?? []).filter((r) => !!r.client_approval_requested_at && (r.approved ?? "pending") === "pending");
  return {
    messages: pending(profile.messaging?.key_messages),
    slogans: pending(profile.messaging?.slogans),
  };
}
