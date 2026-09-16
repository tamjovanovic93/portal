import {
  WIREFRAME_STAGE,
  DESIGN_STAGE,
  GATED_STAGES,
  clientStageLabel,
  clientStageDescription,
} from "@/lib/stages";
import { TEMPLATE_TYPES, ONBOARDING_TEMPLATE_TYPES } from "@/lib/documents/types";
import { isDocActive } from "@/lib/client-portal";
import type { ProjectCardData } from "@/components/client/ProjectCard";
import type { ActivityItem } from "@/components/client/ActivityList";
import type { ClientDashboardData } from "./queries";

// Pure shaping for the client dashboard — no I/O. Mirrors the
// queries.ts / derive.ts split on the team dashboard.

const GATE_STAGES = new Set(GATED_STAGES);

export type NeedItem = {
  key: string;
  projectName?: string;
  label: string;
  sub?: string;
  cta: string;
  href: string;
};

export function deriveClientDashboard(data: ClientDashboardData, now: Date) {
  const { projects, assets, projectDocs, clientDocs, pendingMaterials, questions } = data;

  const materialCount = new Map(pendingMaterials.map((m) => [m.projectId, m._count._all]));
  const needs: NeedItem[] = [];
  const cards: ProjectCardData[] = [];

  // Client-level onboarding forms come first — a client with an unfinished
  // intake has nothing else to do.
  for (const doc of clientDocs.filter(isDocActive)) {
    needs.push({
      key: `clientdoc-${doc.id}`,
      label: doc.title,
      cta: doc.templateType === TEMPLATE_TYPES.financialOffer ? "Review" : "Open",
      href: `/portal/documents/${doc.id}`,
    });
  }

  for (const project of projects) {
    const isRetainer = project.mode === "ONGOING";
    const myAssets = assets.filter((a) => a.projectId === project.id);
    const myDocs = projectDocs.filter((d) => d.projectId === project.id);

    const wireframes = myAssets.filter((a) => a.folder === "wireframes");
    const mockups = myAssets.filter((a) => a.folder === "mockup");

    const gateApproved = (stage: number) =>
      project.stages.find((s) => s.stageNumber === stage)?.gateApproved ?? false;

    const feedbackSubmitted = (templateType: string, against: typeof myAssets) => {
      const doc = myDocs.find((d) => d.templateType === templateType);
      if (doc?.status !== "APPROVED") return false;
      return !against.some((a) => doc.completedAt && a.uploadedAt > doc.completedAt);
    };

    const needsGate = GATE_STAGES.has(project.currentStage) && !gateApproved(project.currentStage);
    const needsWireframeReview =
      wireframes.length > 0 &&
      !feedbackSubmitted(TEMPLATE_TYPES.wireframeFeedback, wireframes) &&
      !gateApproved(WIREFRAME_STAGE);
    const needsDesignReview =
      mockups.length > 0 &&
      !feedbackSubmitted(TEMPLATE_TYPES.designFeedback, mockups) &&
      !gateApproved(DESIGN_STAGE);

    const activeDocs = myDocs.filter(isDocActive);
    const pendingMaterialCount = materialCount.get(project.id) ?? 0;
    const myQuestions = questions.filter((q) => q.project?.id === project.id);

    if (needsGate) {
      needs.push({
        key: `gate-${project.id}`,
        projectName: project.name,
        label: "Approve the current stage",
        sub: "Your sign-off is needed before we continue",
        cta: "Approve",
        href: `/portal/projects/${project.id}`,
      });
    }
    if (needsWireframeReview) {
      needs.push({
        key: `wf-${project.id}`,
        projectName: project.name,
        label: `Review ${wireframes.length} wireframe${wireframes.length === 1 ? "" : "s"}`,
        cta: "Review",
        href: `/portal/wireframes/${project.id}`,
      });
    }
    if (needsDesignReview) {
      needs.push({
        key: `dz-${project.id}`,
        projectName: project.name,
        label: "Review the full designs",
        cta: "Review",
        href: `/portal/design/${project.id}`,
      });
    }
    for (const doc of activeDocs) {
      needs.push({
        key: `doc-${doc.id}`,
        projectName: project.name,
        label: doc.title,
        cta: "Open",
        href: `/portal/documents/${doc.id}`,
      });
    }
    if (pendingMaterialCount > 0) {
      needs.push({
        key: `mat-${project.id}`,
        projectName: project.name,
        label: `Send us ${pendingMaterialCount} item${pendingMaterialCount === 1 ? "" : "s"}`,
        sub: "Files or information we still need",
        cta: "Upload",
        href: `/portal/projects/${project.id}`,
      });
    }

    // The card's one-line summary of what this project is waiting on.
    const outstanding =
      (needsGate ? 1 : 0) +
      (needsWireframeReview ? 1 : 0) +
      (needsDesignReview ? 1 : 0) +
      activeDocs.length +
      pendingMaterialCount;

    const actionLine =
      outstanding > 0
        ? { text: `${outstanding} waiting for you`, needsAction: true }
        : myQuestions.length > 0
          ? { text: `${myQuestions.length} question${myQuestions.length === 1 ? "" : "s"} for you`, needsAction: true }
          : { text: "Nothing needed from you", needsAction: false };

    cards.push({
      id: project.id,
      name: project.name,
      stageLabel: isRetainer ? (project.cycles[0]?.name ?? "Ongoing") : clientStageLabel(project.currentStage),
      stageNumber: isRetainer ? null : project.currentStage,
      isRetainer,
      actionLine,
      nextLine: isRetainer
        ? project.cycles[0]
          ? "Current cycle in progress"
          : "Your team will open the next cycle shortly"
        : clientStageDescription(project.currentStage),
    });
  }

  // Copy approvals are client-level; point them at the first project that can
  // show them.
  const copyCount = data.pendingCopy.messages.length + data.pendingCopy.slogans.length;
  if (copyCount > 0 && projects.length > 0) {
    needs.push({
      key: "copy",
      label: `Approve ${copyCount} piece${copyCount === 1 ? "" : "s"} of copy`,
      sub: "Key messages and slogans from your team",
      cta: "Review",
      href: `/portal/projects/${projects[0].id}`,
    });
  }

  // "Recent" — derived from approvals, shared uploads, completed stages and
  // submitted documents. ActivityLog is not a usable source.
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const activity: ActivityItem[] = [
    ...data.approvals.map((a) => ({
      key: `approval-${a.id}`,
      label: a.stageNumber ? `You approved ${clientStageLabel(a.stageNumber)}` : "You approved a deliverable",
      at: a.approvedAt,
    })),
    ...assets.slice(0, 6).map((a) => ({
      key: `asset-${a.id}`,
      label: `${a.filename} shared with you`,
      at: a.uploadedAt,
    })),
    ...data.completedStages.map((s) => ({
      key: `stage-${s.projectId}-${s.stageNumber}`,
      label: `${clientStageLabel(s.stageNumber)} completed${
        projectName.get(s.projectId) ? ` · ${projectName.get(s.projectId)}` : ""
      }`,
      at: s.completedAt as Date,
    })),
    ...clientDocs
      .filter((d) => d.completedAt && !isDocActive(d))
      .map((d) => ({ key: `cdoc-${d.id}`, label: `${d.title} submitted`, at: d.completedAt as Date })),
  ]
    .filter((i) => i.at instanceof Date && i.at <= now)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  return {
    needs,
    cards,
    activity,
    questionCount: questions.length,
    // Onboarding history stays visible after completion so clients can revisit.
    onboardingDocs: clientDocs.filter((d) =>
      ONBOARDING_TEMPLATE_TYPES.some((t) => t === d.templateType)
    ),
    workingOn: projects
      .map((p) => (p.mode === "ONGOING" ? p.cycles[0]?.name : clientStageLabel(p.currentStage)))
      .filter((v): v is string => !!v),
  };
}
