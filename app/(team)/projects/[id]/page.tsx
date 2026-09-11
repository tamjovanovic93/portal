import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import StageProgressBar from "@/components/team/project/StageProgressBar";
import ClientLoginLink from "@/components/team/project/ClientLoginLink";
import IntakePipeline from "@/components/team/project/IntakePipeline";
import OnboardingPipeline from "@/components/team/project/OnboardingPipeline";
import { getProfile, getStrategy } from "@/lib/intake/store";
import { getProjectBrief, ensureProjectBrief } from "@/app/actions/project-brief";
import BriefsSection from "@/components/team/brief/BriefsSection";
import { getRoster } from "@/lib/team";
import ProjectStageTasks from "@/components/team/project/ProjectStageTasks";
import type { StageTask } from "@/components/team/project/StageTasks";
import ApprovalCard from "@/components/team/project/ApprovalCard";
import SendCopyCard from "@/components/team/project/SendCopyCard";
import MarkReviewedButton from "@/components/team/project/MarkReviewedButton";
import MaterialRow from "@/components/team/MaterialRow";
import AddMaterialForm from "@/components/team/AddMaterialForm";
import RetainerView from "./RetainerView";
import NewProjectButton from "@/components/team/NewProjectButton";
import ProjectFiles from "@/components/team/ProjectFiles";
import ClientUploadAction from "@/components/team/ClientUploadAction";
import { STAGE_LABELS, STAGE_INFO, STAGE_COUNT, WIREFRAME_STAGE, DESIGN_STAGE } from "@/lib/stages";

const TYPE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  BRANDING: "Branding",
  MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM",
  OTHER: "Other",
};

const MATERIAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  received: "Received",
  verified: "Verified",
};

const MATERIAL_STATUS_STYLE: Record<string, string> = {
  pending: "text-neutral-600",
  submitted: "text-blue-600",
  received: "text-amber-600",
  verified: "text-green-600",
};

const MATERIAL_CATEGORIES = ["copy", "visuals", "info", "access", "approval"] as const;

const APPROVAL_METHOD_LABEL: Record<string, string> = {
  PORTAL: "Portal",
  EMAIL: "Email",
  VERBAL: "Verbal",
  OTHER: "Other",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS = [
  { tabId: "files", label: "Files" },
  { tabId: "approvals", label: "Approvals" },
];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab = rawTab ?? "files";

  // Retainers don't use the 8-stage path — render the cycle-based view instead.
  const modeRow = await prisma.project.findUnique({
    where: { id },
    select: { mode: true },
  });
  if (!modeRow) notFound();
  if (modeRow.mode === "ONGOING") {
    return <RetainerView projectId={id} />;
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true } },
      stages: { orderBy: { stageNumber: "asc" } },
      materials: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      assets: { orderBy: { uploadedAt: "desc" } },
      approvals: {
        include: { approvedBy: { select: { name: true, email: true } } },
        orderBy: { approvedAt: "desc" },
      },
      documents: {
        where: { status: "APPROVED" },
        orderBy: { completedAt: "desc" },
      },
      cycles: {
        orderBy: { createdAt: "desc" },
        include: {
          tasks: {
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { approvals: true } } },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // Onboarding docs (Initial Client Form, Offer, Intake) — any status.
  const onboardingDocs = await prisma.document.findMany({
    where: {
      projectId: id,
      templateType: { in: ["initial_client_form", "financial_offer", "intake_form"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, templateType: true, status: true },
  });
  const initialFormDoc =
    onboardingDocs.find((d) => d.templateType === "initial_client_form") ?? null;
  const offerDoc = onboardingDocs.find((d) => d.templateType === "financial_offer") ?? null;
  const intakeDoc = onboardingDocs.find((d) => d.templateType === "intake_form") ?? null;

  // Client Data (profile + strategy) is shared at the CLIENT level; the Brief
  // is the project's single brief (guaranteed to exist).
  const clientId = project.clientId;
  const [profile, strategy, roster] = await Promise.all([
    getProfile(clientId), getStrategy(clientId), getRoster(),
  ]);
  let brief = await getProjectBrief(id);
  if (!brief) {
    await ensureProjectBrief(id);
    brief = await getProjectBrief(id);
  }
  const company = profile?.company ?? null;

  // Data contacts offered as a convenience for the Brief's client-contact picker.
  const dataContacts = ((profile?.contacts ?? []) as Record<string, unknown>[])
    .filter((c) => c.value)
    .map((c) => ({
      label: `${String(c.type ?? c.platform ?? "contact")} · ${String(c.value)}`,
      value: String(c.value),
    }));
  const primaryGoals = (profile?.goals ?? [])
    .filter((g) => g.goal_level === "primary")
    .slice(0, 3);
  const keyMessages = profile?.messaging?.key_messages ?? [];
  const slogans = profile?.messaging?.slogans ?? [];

  // Acknowledged items for the Approvals log
  const ackedMessages = keyMessages.filter((m) => m.team_acknowledged_at);
  const ackedSlogans = slogans.filter((s) => s.team_acknowledged_at);

  // Look up acknowledger names
  const acknowledgerIds = [
    ...new Set([
      ...ackedMessages.map((m) => m.team_acknowledged_by).filter(Boolean),
      ...ackedSlogans.map((s) => s.team_acknowledged_by).filter(Boolean),
    ]),
  ] as string[];
  const acknowledgerProfiles =
    acknowledgerIds.length > 0
      ? await prisma.profile.findMany({
          where: { id: { in: acknowledgerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const acknowledgerMap = Object.fromEntries(
    acknowledgerProfiles.map((p) => [p.id, p.name ?? p.email])
  );

  const pendingMaterials = project.materials.filter((m) => m.status === "pending");
  const submittedMaterials = project.materials.filter((m) => m.status === "submitted");
  // Only unseen (unapproved) client uploads need action.
  const clientUploads = project.assets.filter(
    (a) => a.uploadedBy === project.clientId && !a.approvedAt
  );
  const gateStages = project.stages.filter((s) => s.status === "GATE_PENDING");
  const databaseGenerated = !!profile;
  const profileStatus = profile?._meta?.status ?? null;
  const hasStrategy = !!strategy;
  const briefReviewed = !!project.briefReviewedAt;
  const wireframeFeedbackDoc = project.documents.find(
    (d) => d.templateType === "wireframe_feedback"
  );
  const designFeedbackDoc = project.documents.find(
    (d) => d.templateType === "design_feedback"
  );
  // Feedback is an action item only until the team has reviewed (handled) it.
  const wireframeFeedbackActive = !!wireframeFeedbackDoc && !wireframeFeedbackDoc.handledAt;
  const designFeedbackActive = !!designFeedbackDoc && !designFeedbackDoc.handledAt;

  // Feedback docs have no fillable template page — they're surfaced as their own
  // action items linking to the stage, never to /documents/[id].
  const submittedDocs = project.documents.filter(
    (d) =>
      d.templateType !== "wireframe_feedback" &&
      d.templateType !== "design_feedback" &&
      !(d.templateType === "intake_form" && databaseGenerated)
  );
  // Client-submitted forms awaiting review vs already reviewed (→ history).
  const docsToReview = submittedDocs.filter((d) => !d.handledAt);
  const docsHandled = submittedDocs.filter((d) => d.handledAt);

  const MESSAGE_TYPE_LABELS: Record<string, string> = {
    headline: "Headline", hook: "Hook", body: "Body copy",
    cta: "Call to action", caption: "Caption",
    tagline: "Tagline", service_slogan: "Service slogan",
    campaign: "Campaign line", seasonal: "Seasonal copy",
  };

  type ApprovalItem = { id: string; text: string; kind: string; itemKind: "message" | "slogan"; requested: boolean };
  // Only items not yet acknowledged by the team appear in the live lists.
  const liveMessages = keyMessages.filter((m) => !m.team_acknowledged_at);
  const liveSlogans = slogans.filter((s) => !s.team_acknowledged_at);
  const buildApprovals = (decision: string): ApprovalItem[] => [
    ...liveMessages
      .filter((m) => (m.approved ?? "pending") === decision)
      .map((m) => ({ id: m.message_id, itemKind: "message" as const, text: (m.message_text as string) ?? "—", kind: MESSAGE_TYPE_LABELS[(m.message_type as string) ?? ""] ?? "Message", requested: !!m.client_approval_requested_at })),
    ...liveSlogans
      .filter((s) => (s.approved ?? "pending") === decision)
      .map((s) => ({ id: s.slogan_id, itemKind: "slogan" as const, text: (s.slogan_text as string) ?? "—", kind: MESSAGE_TYPE_LABELS[(s.type as string) ?? ""] ?? "Slogan", requested: !!s.client_approval_requested_at })),
  ];
  // Pending copy splits in two: generated-but-not-yet-sent (internal — the team
  // decides whether to send it) vs. already sent and awaiting the client.
  const pendingRaw = buildApprovals("pending");
  const generatedCopy = pendingRaw.filter((i) => !i.requested);
  const pendingApprovals = pendingRaw.filter((i) => i.requested);
  const clientApproved = buildApprovals("yes");
  const changesRequested = buildApprovals("no");

  // Needs the team to act now.
  const hasActions =
    docsToReview.length > 0 ||
    submittedMaterials.length > 0 ||
    changesRequested.length > 0 ||
    clientUploads.length > 0 ||
    wireframeFeedbackActive ||
    designFeedbackActive;
  // Waiting on the client (in-flight — no team action needed).
  const hasWaiting =
    gateStages.length > 0 || pendingMaterials.length > 0 || pendingApprovals.length > 0;
  // Recently completed items that used to be action items.
  const hasCompleted = docsHandled.length > 0 || clientApproved.length > 0;

  const intakeSubmitted = project.documents.some((d) => d.templateType === "intake_form");
  const intakeApproved = project.documents.some(
    (d) => d.templateType === "intake_form" && d.status === "APPROVED"
  );
  // Onboarding + brief pipelines belong to the setup stage only. Setup is done
  // once the brief is published or the project has moved past Strategy (stage 1).
  const setupComplete = !!project.briefPublishedAt || project.currentStage >= 2;

  // Tasks / to-do lists (reused Cycle+Task) — available from Strategy (stage 1).
  const activeCycles = project.cycles.filter((c) => c.status === "ACTIVE");
  const openTasks = activeCycles.reduce(
    (n, c) => n + c.tasks.filter((t) => t.status !== "DONE").length,
    0
  );
  const tasksAvailable = project.currentStage >= 1;
  // All scope-derived tasks for the stage-tabbed board (Stage 1 = planning
  // overview of everything; Stage 2+ = only that stage's tasks).
  const projectStageTasks: StageTask[] = project.cycles.flatMap((c) =>
    c.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      stageNumber: t.stageNumber,
      assigneeId: t.assigneeId,
      estimateDate: t.estimateDate ? t.estimateDate.toISOString() : null,
      workLink: t.workLink,
      notes: t.notes,
      isBlocker: t.isBlocker,
      listName: c.name,
    }))
  );

  type ActivityItem = {
    type: "upload" | "approval" | "stage_complete";
    date: Date;
    label: string;
    sub?: string;
  };

  const activityItems: ActivityItem[] = [
    ...project.assets.map((a) => ({
      type: "upload" as const,
      date: a.uploadedAt,
      label: `Uploaded ${a.filename}`,
      sub: a.stageNumber ? STAGE_LABELS[a.stageNumber] : undefined,
    })),
    ...project.approvals.map((a) => ({
      type: "approval" as const,
      date: a.approvedAt,
      label: `Stage ${a.stageNumber} — ${STAGE_LABELS[a.stageNumber ?? 0]} approved`,
      sub: a.approvedBy.name ?? a.approvedBy.email,
    })),
    ...project.stages
      .filter((s) => s.completedAt != null)
      .map((s) => ({
        type: "stage_complete" as const,
        date: s.completedAt as Date,
        label: `${STAGE_LABELS[s.stageNumber]} completed`,
      })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  // ── Summary-card derivations (display only) ──
  const currentInfo = STAGE_INFO[project.currentStage];
  const currentStageRow = project.stages.find((s) => s.stageNumber === project.currentStage);
  const receivedMaterials = project.materials.filter(
    (m) => m.status === "received" || m.status === "verified"
  ).length;
  // Client-submitted things that still need a team response (not yet handled).
  const openClientItems =
    docsToReview.length +
    submittedMaterials.length +
    clientUploads.length +
    (wireframeFeedbackActive ? 1 : 0) +
    (designFeedbackActive ? 1 : 0);

  type Gate = "pending" | "approved" | "ahead" | "none";
  const gateStatus: Gate =
    gateStages.length > 0
      ? "pending"
      : currentInfo?.hasGate && currentStageRow?.gateApproved
      ? "approved"
      : currentInfo?.hasGate
      ? "ahead"
      : "none";

  // Single most-urgent action item, highest priority first.
  const mostUrgent: { text: string; tone: "amber" | "violet" | "blue" | "green" | "neutral" } =
    gateStages.length > 0
      ? { text: `Gate pending — ${STAGE_LABELS[gateStages[0].stageNumber]}`, tone: "amber" }
      : wireframeFeedbackActive
      ? { text: "Wireframe feedback received — review", tone: "violet" }
      : designFeedbackActive
      ? { text: "Design feedback received — review", tone: "violet" }
      : docsToReview.length > 0
      ? { text: `${docsToReview[0].title} submitted — review`, tone: "green" }
      : submittedMaterials.length > 0
      ? { text: `${submittedMaterials[0].label} submitted — review`, tone: "blue" }
      : clientUploads.length > 0
      ? { text: `Client upload — ${clientUploads[0].filename}`, tone: "blue" }
      : pendingApprovals.length > 0
      ? { text: `${pendingApprovals[0].kind} — awaiting client approval`, tone: "amber" }
      : pendingMaterials.length > 0
      ? { text: `${pendingMaterials[0].label} — pending from client`, tone: "amber" }
      : openTasks > 0
      ? { text: `${openTasks} open task${openTasks !== 1 ? "s" : ""}`, tone: "blue" }
      : { text: currentInfo?.description ?? "Team working", tone: "neutral" };

  const URGENT_DOT: Record<typeof mostUrgent.tone, string> = {
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    neutral: "bg-neutral-300",
  };

  return (
    <div className="p-8 max-w-6xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-xs text-neutral-600 hover:text-neutral-700 mb-3 inline-block"
        >
          ← Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title" style={{ fontSize: 26 }}>{project.name}</h1>
              {project.mode === "ONGOING" && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Retainer
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-neutral-700">
              <Link
                href={`/clients/${project.clientId}`}
                className="font-medium text-neutral-900 hover:underline underline-offset-2"
              >
                {project.client.name ?? project.client.email}
              </Link>
              <span className="text-neutral-700">·</span>
              <span>{TYPE_LABELS[project.type] ?? project.type}</span>
              <span className="text-neutral-700">·</span>
              <span>
                Stage {project.currentStage} — {STAGE_LABELS[project.currentStage]}
              </span>
              <span className="text-neutral-700">·</span>
              <span>
                Started{" "}
                {new Date(project.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-neutral-700">·</span>
              <span>Project</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NewProjectButton
              prefillEmail={project.client.email}
              label="+ New engagement"
              triggerClassName="text-sm text-neutral-600 border border-neutral-300 px-3 py-1.5 rounded-md hover:bg-neutral-50 transition-colors"
            />
            <ClientLoginLink projectId={id} />
          </div>
        </div>
      </div>

      {/* ── Briefs — multiple per project, compact by default ── */}
      <div className="mb-6">
        <BriefsSection
          projectId={id}
          projectName={project.name}
          currentStageLabel={STAGE_LABELS[project.currentStage] ?? `Stage ${project.currentStage}`}
          brief={brief}
          roster={roster}
          dataContacts={dataContacts}
          clientDefault={{ name: project.client.name ?? undefined, email: project.client.email }}
        />
      </div>

      {/* ── Status summary card — everything at a glance, before the scroll ──── */}
      <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Current stage */}
          <div>
            <p className="text-xs text-neutral-700 mb-1">Current stage</p>
            <p className="text-base font-semibold text-neutral-900 leading-tight">
              {STAGE_LABELS[project.currentStage]}
            </p>
            <p className="text-xs text-neutral-700 mt-0.5">Stage {project.currentStage} of {STAGE_COUNT}</p>
          </div>
          {/* Gate status */}
          <div>
            <p className="text-xs text-neutral-700 mb-1">Gate</p>
            {gateStatus === "pending" ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" /></svg>
                Pending
              </span>
            ) : gateStatus === "approved" ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5" /></svg>
                Approved
              </span>
            ) : gateStatus === "ahead" ? (
              <span className="text-sm font-semibold text-neutral-600">Gate ahead</span>
            ) : (
              <span className="text-sm font-semibold text-neutral-600">No gate</span>
            )}
          </div>
          {/* Materials pending */}
          <div>
            <p className="text-xs text-neutral-700 mb-1">Materials pending</p>
            <p className={`text-base font-semibold ${pendingMaterials.length > 0 ? "text-amber-700" : "text-neutral-900"}`}>
              {pendingMaterials.length}
            </p>
            <p className="text-xs text-neutral-700 mt-0.5">{receivedMaterials}/{project.materials.length} received</p>
          </div>
          {/* Open client items */}
          <div>
            <p className="text-xs text-neutral-700 mb-1">Open client items</p>
            <p className={`text-base font-semibold ${openClientItems > 0 ? "text-blue-700" : "text-neutral-900"}`}>
              {openClientItems}
            </p>
            <p className="text-xs text-neutral-700 mt-0.5">awaiting your review</p>
          </div>
        </div>
        {/* Most-urgent action */}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${URGENT_DOT[mostUrgent.tone]}`} />
          <span className="text-xs text-neutral-700">Next up</span>
          <span className="text-sm font-medium text-neutral-900 truncate">{mostUrgent.text}</span>
        </div>
      </div>

      {/* ── Project setup: onboarding + brief pipelines (only while in setup) ─── */}
      {setupComplete ? (
        <div className="mb-6 bg-white border border-neutral-200 rounded-lg px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[11px] font-semibold flex items-center justify-center">✓</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Project setup — completed</p>
              <p className="text-xs text-neutral-700 mt-0.5">
                Onboarding, intake, and brief are done. The record stays available.
              </p>
            </div>
          </div>
          {databaseGenerated && (
            <Link
              href={`/clients/${project.clientId}/data`}
              className="text-sm text-neutral-900 font-medium border border-neutral-400 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shrink-0"
            >
              Data →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Onboarding (Initial Form → Offer → Intake) — hidden once intake is done */}
          {initialFormDoc && !intakeApproved && (
            <div className="mb-6 bg-white border border-neutral-200 rounded-lg px-5 py-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Onboarding</p>
                <p className="text-xs text-neutral-700 mt-0.5">
                  Initial form, offer, and intake — before the brief pipeline.
                </p>
              </div>
              <OnboardingPipeline
                projectId={id}
                initialForm={initialFormDoc}
                offer={offerDoc}
                intake={intakeDoc}
              />
            </div>
          )}

          {/* Brief pipeline (Agent 1 → verify → Agent 2 → publish) */}
          {intakeSubmitted && (
            <div className="mb-6 bg-white border border-neutral-200 rounded-lg px-5 py-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Intake pipeline</p>
                  <p className="text-xs text-neutral-700 mt-0.5">
                    {company?.company_name ?? project.client.name ?? "Client"} · profile, verification queue, and strategy.
                  </p>
                </div>
                {databaseGenerated && (
                  <Link
                    href={`/clients/${project.clientId}/data`}
                    className="text-sm text-neutral-900 font-medium border border-neutral-400 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shrink-0"
                  >
                    Data →
                  </Link>
                )}
              </div>
              <IntakePipeline
                projectId={id}
                hasApprovedIntake={intakeSubmitted}
                profileStatus={profileStatus}
                hasStrategy={hasStrategy}
                briefPublished={!!project.briefPublishedAt}
              />
            </div>
          )}
        </>
      )}

      {/* ── Stage progress bar ───────────────────────────────────────────────── */}
      <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
          Stage progress — click to expand
        </p>
        <StageProgressBar
          stages={project.stages.map((s) => ({
            stageNumber: s.stageNumber,
            status: s.status,
            gateApproved: s.gateApproved,
          }))}
          currentStage={project.currentStage}
          projectId={id}
        />
      </div>

      {/* ── Tasks — stage-tabbed board (Stage 1 planning, Stage 2+ Kanban) ───── */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
          Tasks
        </p>
        {!tasksAvailable ? (
          <p className="text-sm text-neutral-600">
            Tasks become available from the Strategy stage (stage 1).
          </p>
        ) : projectStageTasks.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No tasks yet. Approve “Sync Scope to Tasks” on the brief to generate them.
          </p>
        ) : (
          <ProjectStageTasks projectId={id} tasks={projectStageTasks} roster={roster} initialStage={1} />
        )}
      </div>

      {/* ── Needs your attention (team must act) ─────────────────────────────── */}
      {hasActions && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
            Needs your attention
          </p>
          <div className="space-y-2">
            {docsToReview.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3"
              >
                <Link
                  href={`/projects/${id}/stage/${doc.stageNumber}/documents/${doc.id}`}
                  className="min-w-0 flex-1 group"
                >
                  <p className="text-sm font-medium text-green-900 group-hover:underline">{doc.title}</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Submitted by client
                    {doc.completedAt && <> · {new Date(doc.completedAt).toLocaleDateString()}</>}
                    {" · "}Stage {doc.stageNumber} — {STAGE_LABELS[doc.stageNumber]}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/projects/${id}/stage/${doc.stageNumber}/documents/${doc.id}`}
                    className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 font-medium"
                  >
                    Review →
                  </Link>
                  <MarkReviewedButton
                    documentId={doc.id}
                    className="text-xs px-2.5 py-1 rounded-full bg-white border border-green-300 text-green-800 font-medium hover:bg-green-100 transition-colors shrink-0"
                  />
                </div>
              </div>
            ))}
            {wireframeFeedbackActive && wireframeFeedbackDoc && (
              <div className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-300 border-l-4 border-l-violet-500 rounded-lg px-5 py-4">
                <Link href={`/projects/${id}/stage/${WIREFRAME_STAGE}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-200 text-violet-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 8c0 2.8-2.7 5-6 5-.9 0-1.7-.2-2.5-.5L2 13l.8-2.8C2.3 9.5 2 8.8 2 8c0-2.8 2.7-5 6-5s6 2.2 6 5Z" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-violet-900 group-hover:underline">Wireframe feedback received</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Client has reviewed the wireframes and left feedback
                      {wireframeFeedbackDoc.completedAt && <> · {new Date(wireframeFeedbackDoc.completedAt).toLocaleDateString()}</>}
                    </p>
                  </div>
                </Link>
                <MarkReviewedButton documentId={wireframeFeedbackDoc.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-violet-300 text-violet-800 font-medium hover:bg-violet-100 transition-colors shrink-0" />
              </div>
            )}
            {designFeedbackActive && designFeedbackDoc && (
              <div className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-300 border-l-4 border-l-violet-500 rounded-lg px-5 py-4">
                <Link href={`/projects/${id}/stage/${DESIGN_STAGE}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-200 text-violet-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 8c0 2.8-2.7 5-6 5-.9 0-1.7-.2-2.5-.5L2 13l.8-2.8C2.3 9.5 2 8.8 2 8c0-2.8 2.7-5 6-5s6 2.2 6 5Z" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-violet-900 group-hover:underline">Design feedback received</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Client has reviewed the designs and left feedback
                      {designFeedbackDoc.completedAt && <> · {new Date(designFeedbackDoc.completedAt).toLocaleDateString()}</>}
                    </p>
                  </div>
                </Link>
                <MarkReviewedButton documentId={designFeedbackDoc.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-violet-300 text-violet-800 font-medium hover:bg-violet-100 transition-colors shrink-0" />
              </div>
            )}
            {submittedMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-blue-900">{m.label}</p>
                  <p className="text-xs text-blue-700 mt-0.5 capitalize">
                    {m.category} · Submitted by client — needs review
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium">Review</span>
              </div>
            ))}
            {clientUploads.map((a) => (
              <ClientUploadAction
                key={a.id}
                assetId={a.id}
                filename={a.filename}
                folder={a.folder}
                uploadedAt={a.uploadedAt.toISOString()}
              />
            ))}
            {changesRequested.map((item) => (
              <ApprovalCard
                key={item.id}
                projectId={id}
                id={item.id}
                kind={item.itemKind}
                variant="revise"
                headline={`${item.kind} — client requested changes`}
                text={item.text}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Generated copy (internal — send only if you choose to) ───────────── */}
      {generatedCopy.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Generated copy — internal
          </p>
          <p className="text-xs text-neutral-500 mb-2">
            Draft copy the agent generated. It is not visible to the client. Send an item only if you want the client to approve it.
          </p>
          <div className="space-y-2">
            {generatedCopy.map((item) => (
              <SendCopyCard
                key={item.id}
                projectId={id}
                id={item.id}
                kind={item.itemKind}
                label={item.kind}
                text={item.text}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Waiting on client (in-flight, no team action) ────────────────────── */}
      {hasWaiting && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
            Waiting on client
          </p>
          <div className="space-y-2">
            {gateStages.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-lg px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-200 text-amber-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-amber-900">Gate pending — {STAGE_LABELS[s.stageNumber]}</p>
                    <p className="text-xs text-amber-700 mt-0.5">Waiting for client approval to advance</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium shrink-0">Waiting</span>
              </div>
            ))}
            {pendingApprovals.map((item) => (
              <ApprovalCard
                key={item.id}
                projectId={id}
                id={item.id}
                kind={item.itemKind}
                variant="pending"
                headline={`${item.kind} — awaiting client approval`}
                text={item.text}
              />
            ))}
            {pendingMaterials.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <p className="text-sm text-neutral-700 truncate">{m.label}</p>
                  <span className="text-xs text-neutral-600 capitalize shrink-0">
                    {m.category}
                    {m.dueDate && <> · due {new Date(m.dueDate).toLocaleDateString()}</>}
                  </span>
                </div>
                <span className="text-xs text-neutral-700 shrink-0 ml-2">Pending</span>
              </div>
            ))}
            {pendingMaterials.length > 3 && (
              <p className="text-xs text-neutral-600 pl-4">
                +{pendingMaterials.length - 3} more pending material
                {pendingMaterials.length - 3 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Recently completed (history of former action items) ──────────────── */}
      {hasCompleted && (
        <details className="mb-6 group">
          <summary className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2 cursor-pointer hover:text-neutral-900 select-none list-none">
            Recently completed ({docsHandled.length + clientApproved.length})
          </summary>
          <div className="space-y-2 mt-2">
            {docsHandled.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 bg-white border border-neutral-200 rounded-lg px-4 py-3">
                <Link href={`/projects/${id}/stage/${doc.stageNumber}/documents/${doc.id}`} className="min-w-0 flex-1 group">
                  <p className="text-sm text-neutral-700 group-hover:underline">{doc.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Reviewed{doc.handledAt && <> · {new Date(doc.handledAt).toLocaleDateString()}</>}
                    {" · "}Stage {doc.stageNumber} — {STAGE_LABELS[doc.stageNumber]}
                  </p>
                </Link>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium shrink-0">Reviewed ✓</span>
              </div>
            ))}
            {clientApproved.map((item) => (
              <ApprovalCard
                key={item.id}
                projectId={id}
                id={item.id}
                kind={item.itemKind}
                variant="approved"
                headline={`${item.kind} approved by client`}
                text={item.text}
              />
            ))}
          </div>
        </details>
      )}

      {/* ── Materials checklist ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
            Materials checklist
          </p>
          {project.materials.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-1.5 w-24 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((receivedMaterials / project.materials.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-neutral-700 tabular-nums">
                {receivedMaterials} / {project.materials.length} received
              </span>
            </div>
          )}
        </div>
        <div className="mb-3">
          <AddMaterialForm projectId={id} />
        </div>
        {project.materials.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-8">
            Add items above to build the checklist.
          </p>
        ) : (
          <div className="space-y-5">
            {MATERIAL_CATEGORIES.map((cat) => {
              const catItems = project.materials.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              return (
                <section key={cat}>
                  <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 capitalize">
                    {cat}
                  </h3>
                  <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white overflow-hidden">
                    {catItems.map((item) => (
                      <MaterialRow
                        key={item.id}
                        item={{
                          id: item.id,
                          label: item.label,
                          category: item.category,
                          status: item.status,
                          notes: item.notes,
                          dueDate: item.dueDate?.toISOString() ?? null,
                        }}
                        statusLabel={MATERIAL_STATUS_LABEL[item.status] ?? item.status}
                        statusStyle={MATERIAL_STATUS_STYLE[item.status] ?? "text-neutral-700"}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Files — folders (same section retainers have) ────────────────────── */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
          Files
        </p>
        <ProjectFiles
          projectId={id}
          briefGenerated={databaseGenerated}
          assets={project.assets.map((a) => ({
            id: a.id,
            filename: a.filename,
            folder: a.folder,
            sizeBytes: a.sizeBytes,
            uploadedAt: a.uploadedAt.toISOString(),
            approvedAt: a.approvedAt?.toISOString() ?? null,
            visibility: a.visibility as string,
            isClientUpload: a.uploadedBy === project.clientId,
          }))}
        />
      </div>

      {/* ── Latest uploads + Brief snapshot + Activity log ───────────────────── */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Latest uploads */}
        <div>
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
            Latest uploads
          </p>
          {project.assets.length === 0 ? (
            <p className="text-sm text-neutral-600 py-4">No files uploaded yet.</p>
          ) : (
            <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
              {project.assets.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/api/download?id=${a.id}`}
                      className="text-sm text-neutral-800 hover:underline truncate block"
                    >
                      {a.filename}
                    </a>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {a.stageNumber && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                          {STAGE_LABELS[a.stageNumber]}
                        </span>
                      )}
                      <span className="text-xs text-neutral-600">
                        {formatBytes(a.sizeBytes)}
                      </span>
                      <span className="text-xs text-neutral-600">
                        {new Date(a.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      a.visibility === "SHARED"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {a.visibility === "SHARED" ? "Shared" : "Internal"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {project.assets.length > 5 && (
            <p className="text-xs text-neutral-600 mt-2">
              +{project.assets.length - 5} more —{" "}
              <Link
                href={`/projects/${id}?tab=files`}
                className="hover:text-neutral-700 underline underline-offset-2"
              >
                see all in Files
              </Link>
            </p>
          )}
        </div>

        {/* Brief snapshot + Activity log */}
        <div className="space-y-6">
          {/* Brief snapshot */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Data snapshot
            </p>
            <div className="border border-neutral-200 rounded-lg bg-white p-4 space-y-2.5">
              {company ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-neutral-600 w-20 shrink-0 pt-0.5">Company</span>
                    <span className="text-sm text-neutral-800">
                      {company.company_name ?? project.client.name ?? "—"}
                    </span>
                  </div>
                  {company.industry && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-neutral-600 w-20 shrink-0 pt-0.5">Industry</span>
                      <span className="text-sm text-neutral-800">{company.industry}</span>
                    </div>
                  )}
                  {company.brand_essence && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-neutral-600 w-20 shrink-0 pt-0.5">Essence</span>
                      <span className="text-sm text-neutral-800">{company.brand_essence}</span>
                    </div>
                  )}
                  {company.current_challenge && (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-neutral-600 w-20 shrink-0 pt-0.5">Challenge</span>
                      <span className="text-sm text-neutral-800">{company.current_challenge}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-600">No company data yet.</p>
              )}
              {primaryGoals.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 space-y-1">
                  <p className="text-xs text-neutral-600 mb-1">Primary goals</p>
                  {primaryGoals.map((g, i) => (
                    <p key={i} className="text-sm text-neutral-800">
                      {(g.goal_description as string) ?? "—"}
                    </p>
                  ))}
                </div>
              )}
              <div className="pt-1.5 border-t border-neutral-100">
                <Link
                  href={`/clients/${project.clientId}/data`}
                  className="text-xs text-neutral-700 hover:text-neutral-800 transition-colors"
                >
                  View all data →
                </Link>
              </div>
            </div>
          </div>

          {/* Activity log */}
          <div>
            <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Activity
            </p>
            {activityItems.length === 0 ? (
              <p className="text-sm text-neutral-600">No activity yet.</p>
            ) : (
              <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
                {activityItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div
                      className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${
                        item.type === "approval"
                          ? "bg-green-500"
                          : item.type === "stage_complete"
                          ? "bg-neutral-900"
                          : "bg-blue-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-800">{item.label}</p>
                      {item.sub && (
                        <p className="text-xs text-neutral-600">{item.sub}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="border-t border-neutral-200 pt-6">
        <nav className="flex gap-1 border-b border-neutral-200 mb-6">
          {TABS.map(({ tabId, label }) => (
            <Link
              key={tabId}
              href={`/projects/${id}?tab=${tabId}`}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tabId
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-700 hover:text-neutral-700"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={`/clients/${project.clientId}/data`}
            className="px-4 py-2.5 text-sm font-medium text-neutral-700 hover:text-neutral-700 transition-colors border-b-2 border-transparent -mb-px"
          >
            Data ↗
          </Link>
        </nav>

        {/* Files tab — folders */}
        {activeTab === "files" && (
          <ProjectFiles
            projectId={id}
            briefGenerated={databaseGenerated}
            assets={project.assets.map((a) => ({
              id: a.id,
              filename: a.filename,
              folder: a.folder,
              sizeBytes: a.sizeBytes,
              uploadedAt: a.uploadedAt.toISOString(),
              approvedAt: a.approvedAt?.toISOString() ?? null,
              visibility: a.visibility as string,
              isClientUpload: a.uploadedBy === project.clientId,
            }))}
          />
        )}

        {/* Approvals tab */}
        {activeTab === "approvals" && (
          <div>
            {project.approvals.length === 0 ? (
              <p className="text-sm text-neutral-600 text-center py-12">
                No approvals recorded yet.
              </p>
            ) : (
              <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                        Approved by
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {project.approvals.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {STAGE_LABELS[a.stageNumber ?? 0] ?? `Stage ${a.stageNumber}`}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {a.approvedBy.name ?? a.approvedBy.email}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {APPROVAL_METHOD_LABEL[a.method] ?? a.method}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {new Date(a.approvedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 text-xs">
                          {a.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Brief item acknowledgements */}
            {(ackedMessages.length > 0 || ackedSlogans.length > 0) && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">
                  Brief &amp; messaging acknowledgements
                </p>
                <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">Content</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">Client decision</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">Seen by</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-700 uppercase tracking-wider">Seen at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {ackedMessages.map((m) => (
                        <tr key={m.message_id}>
                          <td className="px-4 py-3 text-neutral-700 capitalize whitespace-nowrap">
                            {(m.message_type as string) ?? "Message"}
                          </td>
                          <td className="px-4 py-3 text-neutral-900 max-w-xs truncate">
                            {(m.message_text as string) ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              m.approved === "yes"
                                ? "bg-green-100 text-green-800"
                                : m.approved === "no"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}>
                              {m.approved === "yes" ? "Approved" : m.approved === "no" ? "Changes requested" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {m.team_acknowledged_by ? (acknowledgerMap[m.team_acknowledged_by] ?? "—") : "—"}
                          </td>
                          <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">
                            {m.team_acknowledged_at ? new Date(m.team_acknowledged_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {ackedSlogans.map((s) => (
                        <tr key={s.slogan_id}>
                          <td className="px-4 py-3 text-neutral-700 capitalize whitespace-nowrap">
                            {(s.type as string) ?? "Slogan"}
                          </td>
                          <td className="px-4 py-3 text-neutral-900 max-w-xs truncate">
                            {(s.slogan_text as string) ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              s.approved === "yes"
                                ? "bg-green-100 text-green-800"
                                : s.approved === "no"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}>
                              {s.approved === "yes" ? "Approved" : s.approved === "no" ? "Changes requested" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {s.team_acknowledged_by ? (acknowledgerMap[s.team_acknowledged_by] ?? "—") : "—"}
                          </td>
                          <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">
                            {s.team_acknowledged_at ? new Date(s.team_acknowledged_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
