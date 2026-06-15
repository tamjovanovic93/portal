import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import StageProgressBar from "@/components/team/project/StageProgressBar";
import ClientLoginLink from "@/components/team/project/ClientLoginLink";
import IntakePipeline from "@/components/team/project/IntakePipeline";
import { getProfile, getStrategy } from "@/lib/intake/store";
import ApprovalCard from "@/components/team/project/ApprovalCard";
import AdvanceStageButton from "@/components/team/AdvanceStageButton";
import MaterialRow from "@/components/team/MaterialRow";
import AddMaterialForm from "@/components/team/AddMaterialForm";
import RetainerView from "./RetainerView";
import NewProjectButton from "@/components/team/NewProjectButton";
import ProjectFiles from "@/components/team/ProjectFiles";
import ClientUploadAction from "@/components/team/ClientUploadAction";

const STAGE_LABELS: Record<number, string> = {
  1: "Onboarding", 2: "Strategy", 3: "Sketch", 4: "Make",
  5: "Build", 6: "Client Review", 7: "Launch", 8: "Complete",
};

const STAGE_INFO: Record<number, { label: string; description: string; hasGate: boolean }> = {
  1: { label: "Onboarding", description: "Intake form, client database, brief", hasGate: false },
  2: { label: "Strategy", description: "Research, scope of work, materials checklist", hasGate: false },
  3: { label: "Sketch", description: "Wireframes / first direction", hasGate: true },
  4: { label: "Make", description: "Full design / creative output", hasGate: true },
  5: { label: "Build", description: "Build, QA, dev handoff", hasGate: false },
  6: { label: "Client Review", description: "Final review and sign-off", hasGate: true },
  7: { label: "Launch / Delivery", description: "Go live, delivery checklist, handover", hasGate: false },
  8: { label: "Complete", description: "Archived — project record retained", hasGate: false },
};

const TYPE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  BRANDING: "Branding",
  MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM",
  OTHER: "Other",
};

const STAGE_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  GATE_PENDING: "Gate pending",
  COMPLETE: "Complete",
};

const STAGE_STATUS_STYLE: Record<string, string> = {
  NOT_STARTED: "text-neutral-600",
  IN_PROGRESS: "text-blue-600",
  GATE_PENDING: "text-amber-600",
  COMPLETE: "text-neutral-900",
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
  { tabId: "stages", label: "Stages" },
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
  const activeTab = rawTab ?? "stages";

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
    },
  });

  if (!project) notFound();

  // Client profile + strategy now live as JSON documents (the intake pipeline).
  const [profile, strategy] = await Promise.all([getProfile(id), getStrategy(id)]);
  const company = profile?.company ?? null;
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
  // Feedback docs have no fillable template page — they're surfaced as their own
  // action items linking to the stage, never to /documents/[id].
  const submittedDocs = project.documents.filter(
    (d) =>
      d.templateType !== "wireframe_feedback" &&
      d.templateType !== "design_feedback" &&
      !(d.templateType === "intake_form" && databaseGenerated)
  );

  const MESSAGE_TYPE_LABELS: Record<string, string> = {
    headline: "Headline", hook: "Hook", body: "Body copy",
    cta: "Call to action", caption: "Caption",
    tagline: "Tagline", service_slogan: "Service slogan",
    campaign: "Campaign line", seasonal: "Seasonal copy",
  };

  type ApprovalItem = { id: string; text: string; kind: string; itemKind: "message" | "slogan" };
  // Only items not yet acknowledged by the team appear in the live lists.
  const liveMessages = keyMessages.filter((m) => !m.team_acknowledged_at);
  const liveSlogans = slogans.filter((s) => !s.team_acknowledged_at);
  const buildApprovals = (decision: string): ApprovalItem[] => [
    ...liveMessages
      .filter((m) => (m.approved ?? "pending") === decision)
      .map((m) => ({ id: m.message_id, itemKind: "message" as const, text: (m.message_text as string) ?? "—", kind: MESSAGE_TYPE_LABELS[(m.message_type as string) ?? ""] ?? "Message" })),
    ...liveSlogans
      .filter((s) => (s.approved ?? "pending") === decision)
      .map((s) => ({ id: s.slogan_id, itemKind: "slogan" as const, text: (s.slogan_text as string) ?? "—", kind: MESSAGE_TYPE_LABELS[(s.type as string) ?? ""] ?? "Slogan" })),
  ];
  const pendingApprovals = buildApprovals("pending");
  const clientApproved = buildApprovals("yes");
  const changesRequested = buildApprovals("no");

  const hasActions =
    gateStages.length > 0 ||
    pendingMaterials.length > 0 ||
    submittedMaterials.length > 0 ||
    submittedDocs.length > 0 ||
    !!wireframeFeedbackDoc ||
    !!designFeedbackDoc ||
    pendingApprovals.length > 0 ||
    clientApproved.length > 0 ||
    changesRequested.length > 0 ||
    clientUploads.length > 0;
  const intakeSubmitted = project.documents.some((d) => d.templateType === "intake_form");

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
  // Client-submitted things that need a team response.
  const openClientItems =
    submittedDocs.length +
    submittedMaterials.length +
    clientUploads.length +
    (wireframeFeedbackDoc ? 1 : 0) +
    (designFeedbackDoc ? 1 : 0);

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
      : wireframeFeedbackDoc
      ? { text: "Wireframe feedback received — review", tone: "violet" }
      : designFeedbackDoc
      ? { text: "Design feedback received — review", tone: "violet" }
      : submittedDocs.length > 0
      ? { text: `${submittedDocs[0].title} submitted — review`, tone: "green" }
      : submittedMaterials.length > 0
      ? { text: `${submittedMaterials[0].label} submitted — review`, tone: "blue" }
      : clientUploads.length > 0
      ? { text: `Client upload — ${clientUploads[0].filename}`, tone: "blue" }
      : pendingApprovals.length > 0
      ? { text: `${pendingApprovals[0].kind} — awaiting client approval`, tone: "amber" }
      : pendingMaterials.length > 0
      ? { text: `${pendingMaterials[0].label} — pending from client`, tone: "amber" }
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

      {/* ── Status summary card — everything at a glance, before the scroll ──── */}
      <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Current stage */}
          <div>
            <p className="text-xs text-neutral-700 mb-1">Current stage</p>
            <p className="text-base font-semibold text-neutral-900 leading-tight">
              {STAGE_LABELS[project.currentStage]}
            </p>
            <p className="text-xs text-neutral-700 mt-0.5">Stage {project.currentStage} of 8</p>
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

      {/* ── Intake pipeline (Agent 1 → verify → Agent 2) ─────────────────────── */}
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
                href={`/projects/${id}/brief`}
                className="text-sm text-neutral-900 font-medium border border-neutral-400 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shrink-0"
              >
                Brief & data →
              </Link>
            )}
          </div>
          <IntakePipeline
            projectId={id}
            hasApprovedIntake={intakeSubmitted}
            profileStatus={profileStatus}
            hasStrategy={hasStrategy}
          />
        </div>
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

      {/* ── Action items ─────────────────────────────────────────────────────── */}
      {hasActions && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
            Action required
          </p>
          <div className="space-y-2">
            {submittedDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/projects/${id}/stage/${doc.stageNumber}/documents/${doc.id}`}
                className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 hover:border-green-400 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-green-900">
                    {doc.title}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Submitted by client
                    {doc.completedAt && (
                      <> · {new Date(doc.completedAt).toLocaleDateString()}</>
                    )}
                    {" · "}Stage {doc.stageNumber} — {STAGE_LABELS[doc.stageNumber]}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 font-medium shrink-0">
                  Review →
                </span>
              </Link>
            ))}
            {wireframeFeedbackDoc && (
              <Link
                href={`/projects/${id}/stage/3`}
                className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-300 border-l-4 border-l-violet-500 rounded-lg px-5 py-4 hover:border-violet-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-200 text-violet-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 8c0 2.8-2.7 5-6 5-.9 0-1.7-.2-2.5-.5L2 13l.8-2.8C2.3 9.5 2 8.8 2 8c0-2.8 2.7-5 6-5s6 2.2 6 5Z" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-violet-900">
                      Wireframe feedback received
                    </p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Client has reviewed the wireframes and left feedback
                      {wireframeFeedbackDoc.completedAt && (
                        <> · {new Date(wireframeFeedbackDoc.completedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 font-medium shrink-0">
                  View feedback →
                </span>
              </Link>
            )}
            {designFeedbackDoc && (
              <Link
                href={`/projects/${id}/stage/4`}
                className="flex items-center justify-between gap-3 bg-violet-50 border border-violet-300 border-l-4 border-l-violet-500 rounded-lg px-5 py-4 hover:border-violet-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-200 text-violet-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 8c0 2.8-2.7 5-6 5-.9 0-1.7-.2-2.5-.5L2 13l.8-2.8C2.3 9.5 2 8.8 2 8c0-2.8 2.7-5 6-5s6 2.2 6 5Z" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-violet-900">
                      Design feedback received
                    </p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Client has reviewed the designs and left feedback
                      {designFeedbackDoc.completedAt && (
                        <> · {new Date(designFeedbackDoc.completedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-200 text-violet-800 font-medium shrink-0">
                  View feedback →
                </span>
              </Link>
            )}
            {gateStages.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-lg px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-200 text-amber-800 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" /></svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold text-amber-900">
                      Gate pending — {STAGE_LABELS[s.stageNumber]}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Waiting for client approval to advance
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium shrink-0">
                  Attention
                </span>
              </div>
            ))}
            {pendingMaterials.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-4 py-2"
              >
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
            {submittedMaterials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-blue-900">{m.label}</p>
                  <p className="text-xs text-blue-700 mt-0.5 capitalize">
                    {m.category} · Submitted by client — needs review
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium">
                  Review
                </span>
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
              Brief snapshot
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
                  href={`/projects/${id}/brief`}
                  className="text-xs text-neutral-700 hover:text-neutral-800 transition-colors"
                >
                  Full brief & data →
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
            href={`/projects/${id}/brief`}
            className="px-4 py-2.5 text-sm font-medium text-neutral-700 hover:text-neutral-700 transition-colors border-b-2 border-transparent -mb-px"
          >
            Brief & data ↗
          </Link>
        </nav>

        {/* Stages tab */}
        {activeTab === "stages" && (
          <div className="space-y-2">
            {project.stages.map((stage) => {
              const info = STAGE_INFO[stage.stageNumber];
              const isCurrent = stage.stageNumber === project.currentStage;
              return (
                <div
                  key={stage.stageNumber}
                  className={`rounded-lg border px-5 py-4 flex items-center justify-between bg-white ${
                    isCurrent ? "border-neutral-900" : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-mono ${
                        isCurrent ? "text-neutral-900 font-semibold" : "text-neutral-600"
                      }`}
                    >
                      {String(stage.stageNumber).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium ${
                            isCurrent ? "text-neutral-900" : "text-neutral-600"
                          }`}
                        >
                          {info.label}
                        </p>
                        {info.hasGate && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            gate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">{info.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${STAGE_STATUS_STYLE[stage.status]}`}>
                      {STAGE_STATUS_LABEL[stage.status]}
                    </span>
                    <Link
                      href={`/projects/${id}/stage/${stage.stageNumber}`}
                      className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
                    >
                      Docs →
                    </Link>
                    {isCurrent && stage.status !== "COMPLETE" && (
                      <AdvanceStageButton
                        projectId={id}
                        currentStage={project.currentStage}
                        hasGate={info.hasGate}
                        gateApproved={stage.gateApproved}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
