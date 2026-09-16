import { WIREFRAME_STAGE, DESIGN_STAGE, GATED_STAGES, clientStageLabel } from "@/lib/stages";
import { isDocActive, assetKind, type AssetKind } from "@/lib/client-portal";
import { hasOpenClientItems, type FormContent } from "@/lib/forms/collab";
import { TEMPLATE_TYPES } from "@/lib/documents/types";
import type { ActivityItem } from "@/components/client/ActivityList";
import type { ClientProjectData } from "./queries";

// Pure shaping for the client project detail page — no I/O. Mirrors the
// queries.ts / derive.ts split the team dashboard uses.

const GATE_STAGES = new Set(GATED_STAGES);

export type WorkItem = {
  key: string;
  label: string;
  sub: string;
  status: "review" | "progress" | "approved";
  href: string;
};

export function deriveClientProject(data: ClientProjectData, now: Date) {
  const { project, assets, documents, materials, approvals, completedStages } = data;

  const currentStageRow = project.stages.find((s) => s.stageNumber === project.currentStage);
  const needsGateApproval = GATE_STAGES.has(project.currentStage) && !currentStageRow?.gateApproved;

  const wireframeAssets = assets.filter((a) => a.folder === "wireframes");
  const mockupAssets = assets.filter((a) => a.folder === "mockup");
  const sharedAssets = assets.filter((a) => a.folder !== "wireframes" && a.folder !== "mockup");

  const wireframesApproved = project.stages.find((s) => s.stageNumber === WIREFRAME_STAGE)?.gateApproved ?? false;
  const designApproved = project.stages.find((s) => s.stageNumber === DESIGN_STAGE)?.gateApproved ?? false;

  // A feedback round is done once submitted — unless newer work landed after it.
  const feedbackSubmitted = (templateType: string, against: typeof assets) => {
    const doc = documents.find((d) => d.templateType === templateType);
    if (doc?.status !== "APPROVED") return false;
    return !against.some((a) => doc.completedAt && a.uploadedAt > doc.completedAt);
  };
  const wireframeFeedbackSubmitted = feedbackSubmitted(TEMPLATE_TYPES.wireframeFeedback, wireframeAssets);
  const designFeedbackSubmitted = feedbackSubmitted(TEMPLATE_TYPES.designFeedback, mockupAssets);

  const needsWireframeReview = wireframeAssets.length > 0 && !wireframeFeedbackSubmitted && !wireframesApproved;
  const needsDesignReview = mockupAssets.length > 0 && !designFeedbackSubmitted && !designApproved;

  const activeDocs = documents.filter(isDocActive);
  const completedDocs = documents.filter((d) => !isDocActive(d));
  const pendingMaterials = materials.filter((m) => m.status === "pending");

  // Intake finished but the brief isn't shared yet → tell them what's coming.
  const intakeDoc = documents.find((d) => d.templateType === TEMPLATE_TYPES.intakeForm);
  const intakeComplete =
    intakeDoc?.status === "APPROVED" && !hasOpenClientItems((intakeDoc.content ?? {}) as FormContent);
  const showNextSteps = intakeComplete && !project.briefPublishedAt;

  // Retainer
  const activeCycles = data.cycles.filter((c) => c.status === "ACTIVE");
  const closedCycles = data.cycles.filter((c) => c.status === "CLOSED");
  const activeTasks = activeCycles.flatMap((c) => c.tasks);
  const awaitingApproval = activeTasks.filter(
    (t) =>
      t.type === "DELIVERABLE" &&
      t.requiresClientApproval &&
      t.status === "WAITING_FINAL_APPROVAL" &&
      t._count.approvals === 0
  );
  const delivered = activeTasks.filter((t) => t.status === "DONE");

  // How many things are actually waiting on the client right now.
  const actionCount =
    (needsGateApproval ? 1 : 0) +
    (needsWireframeReview ? 1 : 0) +
    (needsDesignReview ? 1 : 0) +
    activeDocs.length +
    pendingMaterials.length +
    data.pendingCopy.messages.length +
    data.pendingCopy.slogans.length +
    awaitingApproval.length;

  // "Latest work" — what the team has shared, newest first.
  const work: WorkItem[] = [];
  if (wireframeAssets.length > 0) {
    work.push({
      key: "wireframes",
      label: "Wireframes",
      sub: `${wireframeAssets.length} page${wireframeAssets.length === 1 ? "" : "s"}`,
      status: wireframesApproved ? "approved" : needsWireframeReview ? "review" : "progress",
      href: `/portal/wireframes/${project.id}`,
    });
  }
  if (mockupAssets.length > 0) {
    work.push({
      key: "designs",
      label: "Designs",
      sub: `${mockupAssets.length} file${mockupAssets.length === 1 ? "" : "s"}`,
      status: designApproved ? "approved" : needsDesignReview ? "review" : "progress",
      href: `/portal/design/${project.id}`,
    });
  }

  // File counts by kind, for the Files panel.
  const fileCounts = assets.reduce<Record<AssetKind, number>>(
    (acc, a) => {
      acc[assetKind(a.mimeType)] += 1;
      return acc;
    },
    { photo: 0, link: 0, doc: 0 }
  );

  // "Recent" — derived from approvals, uploads, completed stages and submitted
  // documents. There is no activity-log table to read.
  const activity: ActivityItem[] = [
    ...approvals.map((a) => ({
      key: `approval-${a.id}`,
      label: a.stageNumber ? `You approved ${clientStageLabel(a.stageNumber)}` : "You approved a deliverable",
      at: a.approvedAt,
    })),
    ...assets.slice(0, 5).map((a) => ({
      key: `asset-${a.id}`,
      label: `${a.filename} shared with you`,
      at: a.uploadedAt,
    })),
    ...completedStages.map((s) => ({
      key: `stage-${s.stageNumber}`,
      label: `${clientStageLabel(s.stageNumber)} completed`,
      at: s.completedAt as Date,
    })),
    ...completedDocs
      .filter((d) => d.completedAt)
      .map((d) => ({ key: `doc-${d.id}`, label: `${d.title} submitted`, at: d.completedAt as Date })),
  ]
    .filter((i) => i.at instanceof Date && i.at <= now)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  return {
    needsGateApproval,
    wireframeAssets,
    mockupAssets,
    sharedAssets,
    needsWireframeReview,
    needsDesignReview,
    wireframeFeedbackSubmitted,
    designFeedbackSubmitted,
    wireframesApproved,
    designApproved,
    activeDocs,
    completedDocs,
    pendingMaterials,
    showNextSteps,
    activeCycles,
    closedCycles,
    awaitingApproval,
    delivered,
    actionCount,
    work,
    fileCounts,
    activity,
  };
}
