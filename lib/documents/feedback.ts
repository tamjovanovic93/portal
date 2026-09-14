import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WIREFRAME_STAGE, DESIGN_STAGE } from "@/lib/stages";

// Client review feedback documents (one per project per kind). Created lazily
// from mutations only — pages read; they never write.

export type FeedbackKind = "wireframe_feedback" | "design_feedback";

export const FEEDBACK_META: Record<FeedbackKind, { stageNumber: number; title: string; folder: string }> = {
  wireframe_feedback: { stageNumber: WIREFRAME_STAGE, title: "Wireframe Feedback", folder: "wireframes" },
  design_feedback: { stageNumber: DESIGN_STAGE, title: "Design Feedback", folder: "mockup" },
};

export function feedbackKindForFolder(folder: string | null | undefined): FeedbackKind | null {
  if (folder === "wireframes") return "wireframe_feedback";
  if (folder === "mockup") return "design_feedback";
  return null;
}

export function getFeedbackDoc(projectId: string, kind: FeedbackKind) {
  return prisma.document.findFirst({ where: { projectId, templateType: kind } });
}

// The partial unique index (documents_project_feedback_unique) guarantees one
// row per (project, kind); a concurrent create simply re-reads on conflict.
export async function getOrCreateFeedbackDoc(projectId: string, kind: FeedbackKind) {
  const existing = await getFeedbackDoc(projectId, kind);
  if (existing) return existing;
  const meta = FEEDBACK_META[kind];
  try {
    return await prisma.document.create({
      data: {
        projectId,
        stageNumber: meta.stageNumber,
        templateType: kind,
        title: meta.title,
        content: {} as Prisma.InputJsonValue,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await getFeedbackDoc(projectId, kind);
      if (again) return again;
    }
    throw err;
  }
}

// New wireframes/mockups after a submitted review reopen the review round.
export async function resetFeedbackIfSubmitted(projectId: string, kind: FeedbackKind): Promise<void> {
  await prisma.document.updateMany({
    where: { projectId, templateType: kind, status: "APPROVED" },
    data: { status: "SENT", completedAt: null, content: {} as Prisma.InputJsonValue },
  });
}
