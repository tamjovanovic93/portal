import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import ApproveButton from "@/components/client/ApproveButton";
import MaterialItem from "@/components/client/MaterialItem";
import BriefApprovalItem from "@/components/client/BriefApprovalItem";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";
import DeliverableApproval from "@/components/client/DeliverableApproval";
import { hasOpenClientItems, type FormContent } from "@/lib/forms/collab";
import AnswerQuestions, { type ClientQuestion } from "@/components/client/AnswerQuestions";
import { WIREFRAME_STAGE, DESIGN_STAGE, GATED_STAGES } from "@/lib/stages";
import { COLLAB_FORM_TYPES } from "@/lib/documents/types";
import SectionHeading from "@/components/ui/SectionHeading";

// A document still needs the client's attention if it's been sent (fill/approve)
// or it's an approved collab form with open team edits/questions. Everything
// else (completed forms, approved offers) is history.
function isDocActive(doc: { status: string; templateType: string; content: unknown }) {
  if (doc.status === "SENT") return true;
  if (doc.status === "APPROVED" && COLLAB_FORM_TYPES.has(doc.templateType)) {
    return hasOpenClientItems((doc.content ?? {}) as FormContent);
  }
  return false;
}

// Plain-language stage descriptions — clients never see "Stage N"
const CLIENT_STAGE_DESCRIPTION: Record<number, string> = {
  1: "We're working on your strategy and scope.",
  2: "We're putting together the first structural direction.",
  3: "We're working on the full design.",
  4: "We're building everything.",
  5: "Your project is ready for your final review.",
  6: "We're preparing to launch or deliver.",
  7: "Your project is complete.",
};

// Gated stages that require client action (see lib/stages.ts).
const GATE_STAGES = new Set(GATED_STAGES);

export default async function ClientPortalPage() {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  // A client can have multiple projects — load all. Everything the page needs
  // is fetched in parallel; clients never see INTERNAL tasks so those are
  // filtered in the query rather than after loading.
  const [projects, clientProfileDoc, questionRows, clientDocs, answeredQuestions] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: profile.id, isArchived: false },
      include: {
        stages: { orderBy: { stageNumber: "asc" } },
        assets: {
          where: { visibility: "SHARED" },
          orderBy: { uploadedAt: "desc" },
        },
        materials: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        documents: {
          where: { status: { in: ["SENT", "APPROVED"] } },
          orderBy: { sentAt: "desc" },
        },
        cycles: {
          orderBy: { startDate: "desc" },
          include: {
            tasks: {
              where: { type: { not: "INTERNAL" } },
              orderBy: { createdAt: "asc" },
              include: { _count: { select: { approvals: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Pending message/slogan approvals live in the client's single client_profile
    // JSON (client-level). They're shared, so surface them under each project.
    prisma.document.findFirst({
      where: { clientId: profile.id, templateType: PROFILE_DOC },
      select: { content: true },
    }),
    // Open questions addressed to this client (across their projects).
    prisma.question.findMany({
      where: { recipientId: profile.id, status: { in: ["WAITING_CLIENT", "WAITING_CONFIRMATION"] } },
      select: { id: true, kind: true, questionText: true, proposedAnswer: true, project: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Client-level onboarding forms (no project yet) awaiting the client's action.
    prisma.document.findMany({
      where: { clientId: profile.id, projectId: null, status: { in: ["SENT", "APPROVED"] } },
      orderBy: { sentAt: "desc" },
      select: { id: true, title: true, status: true, templateType: true, content: true },
    }),
    // Questions asked & answered involving this client (both directions).
    prisma.question.findMany({
      where: {
        OR: [{ recipientId: profile.id }, { askedById: profile.id }],
        answerText: { not: null },
      },
      orderBy: { answeredAt: "desc" },
      take: 20,
      select: { id: true, questionText: true, answerText: true },
    }),
  ]);

  const pendingApprovals = (() => {
    if (!clientProfileDoc) return null;
    const content = clientProfileDoc.content as ClientProfile;
    // Copy is client-facing ONLY after a team member explicitly sends it for
    // approval (client_approval_requested_at). Agent-generated copy stays
    // internal — it never auto-appears in the client's approval flow.
    return {
      messages: (content.messaging?.key_messages ?? []).filter(
        (m) => !!m.client_approval_requested_at && (m.approved ?? "pending") === "pending"
      ),
      slogans: (content.messaging?.slogans ?? []).filter(
        (s) => !!s.client_approval_requested_at && (s.approved ?? "pending") === "pending"
      ),
    };
  })();

  const clientQuestions: ClientQuestion[] = questionRows.map((q) => ({
    id: q.id, kind: q.kind, questionText: q.questionText, proposedAnswer: q.proposedAnswer,
    projectName: q.project?.name ?? "Your project",
  }));

  const clientActionDocs = clientDocs.filter(isDocActive);

  // Persistent mini-dashboard: the client's initial form, approved offer and
  // intake — always visible so they can revisit them after onboarding.
  const onboardingHistory = clientDocs.filter((d) =>
    ["initial_client_form", "financial_offer", "intake_form"].includes(d.templateType)
  );

  const miniDashboard =
    onboardingHistory.length > 0 || answeredQuestions.length > 0 ? (
      <section>
        <SectionHeading>
          Your onboarding
        </SectionHeading>
        {onboardingHistory.length > 0 && (
          <div className="space-y-2 mb-4">
            {onboardingHistory.map((doc) => (
              <Link
                key={doc.id}
                href={`/portal/documents/${doc.id}`}
                className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
              >
                <span className="text-sm text-ink group-hover:underline">{doc.title}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
                    doc.status === "APPROVED" ? "bg-mint-fill text-mint" : "bg-amber-fill text-amber"
                  }`}
                >
                  {doc.status === "APPROVED"
                    ? doc.templateType === "financial_offer" ? "Accepted" : "Submitted"
                    : "Action needed"}
                </span>
              </Link>
            ))}
          </div>
        )}
        {answeredQuestions.length > 0 && (
          <div className="bg-surface border border-line rounded-md px-4 py-3 space-y-2.5">
            <p className="text-xs font-medium text-ink-3">Questions &amp; answers</p>
            {answeredQuestions.map((q) => (
              <div key={q.id}>
                <p className="text-sm text-ink">{q.questionText}</p>
                <p className="text-sm text-ink-2 mt-0.5">↳ {q.answerText}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    ) : null;

  const onboardingForms =
    clientActionDocs.length > 0 ? (
      <section>
        <SectionHeading>
          Needs your attention
        </SectionHeading>
        <div className="space-y-2">
          {clientActionDocs.map((doc) => (
            <Link
              key={doc.id}
              href={`/portal/documents/${doc.id}`}
              className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
            >
              <span className="text-sm font-medium text-ink group-hover:underline">{doc.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 bg-amber-fill text-amber">
                Action needed
              </span>
            </Link>
          ))}
        </div>
      </section>
    ) : null;

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <AnswerQuestions questions={clientQuestions} />
        {clientActionDocs.length > 0 ? (
          onboardingForms
        ) : onboardingHistory.length === 0 && answeredQuestions.length === 0 ? (
          <p className="text-ink-3 text-sm text-center">
            Your onboarding is being set up. Check back shortly.
          </p>
        ) : null}
        {miniDashboard}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <AnswerQuestions questions={clientQuestions} />
      {onboardingForms}
      {miniDashboard}
      {projects.map((project) => {
        // ── Retainer (ONGOING) clients get a cycle/task view, not stages ──
        if (project.mode === "ONGOING") {
          const activeCycles = project.cycles.filter((c) => c.status === "ACTIVE");
          const closedCycles = project.cycles.filter((c) => c.status === "CLOSED");
          // Internal tasks are excluded in the query — clients never see them.
          const visibleActiveTasks = activeCycles.flatMap((c) => c.tasks);
          const awaiting = visibleActiveTasks.filter(
            (t) =>
              t.type === "DELIVERABLE" &&
              t.requiresClientApproval &&
              t.status === "WAITING_FINAL_APPROVAL" &&
              t._count.approvals === 0
          );
          const delivered = visibleActiveTasks.filter((t) => t.status === "DONE");
          const sharedFiles = project.assets;

          return (
            <section key={project.id}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-fill text-blue font-medium">
                  Retainer
                </span>
              </div>
              <p className="text-sm text-ink-3 mb-6">
                {activeCycles.length > 0
                  ? `Current cycle: ${activeCycles.map((c) => c.name).join(", ")}`
                  : "Your ongoing work — your team will open the next cycle shortly."}
              </p>

              {/* Forms & documents (onboarding intake, etc.) — active only */}
              {project.documents.filter(isDocActive).length > 0 && (
                <div className="mb-6">
                  <SectionHeading>
                    Needs your attention
                  </SectionHeading>
                  <div className="space-y-2">
                    {project.documents.filter(isDocActive).map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/portal/documents/${doc.id}`}
                        className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
                      >
                        <span className="text-sm font-medium text-ink group-hover:underline">
                          {doc.title}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 bg-amber-fill text-amber">
                          Action needed
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Needs your attention */}
              {awaiting.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>
                    Needs your approval
                  </SectionHeading>
                  <div className="space-y-3">
                    {awaiting.map((t) => (
                      <DeliverableApproval
                        key={t.id}
                        taskId={t.id}
                        taskName={t.name}
                        description={t.description}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Delivered this cycle */}
              {delivered.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>
                    Delivered this cycle
                  </SectionHeading>
                  <div className="border border-line rounded-lg bg-surface divide-y divide-line overflow-hidden">
                    {delivered.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-ink">{t.name}</p>
                          {t.description && (
                            <p className="text-xs text-ink-2 mt-0.5 truncate">{t.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-mint shrink-0 ml-3">
                          ✓ {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "Done"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials checklist */}
              {project.materials.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>
                    We need from you
                  </SectionHeading>
                  <div className="space-y-2">
                    {project.materials.map((item) => (
                      <MaterialItem
                        key={item.id}
                        item={{
                          id: item.id,
                          label: item.label,
                          notes: item.notes,
                          status: item.status,
                          dueDate: item.dueDate?.toISOString() ?? null,
                          projectId: project.id,
                          fileRef: item.fileRef,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Shared files */}
              {sharedFiles.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>
                    Shared with you
                  </SectionHeading>
                  <div className="space-y-2">
                    {sharedFiles.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3"
                      >
                        <a
                          href={`/api/download?id=${asset.id}`}
                          className="text-sm font-medium text-ink hover:underline truncate"
                        >
                          {asset.filename}
                        </a>
                        <span className="text-xs text-ink-2 shrink-0 ml-4">
                          {new Date(asset.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Closed cycle history */}
              {closedCycles.length > 0 && (
                <details className="group">
                  <summary className="text-xs font-semibold text-ink-3 uppercase tracking-wider cursor-pointer list-none select-none hover:text-neutral-700">
                    Past cycles ({closedCycles.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {closedCycles.map((c) => {
                      const clientDone = c.tasks.filter((t) => t.status === "DONE");
                      return (
                        <div key={c.id} className="border border-line rounded-lg bg-surface overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-line bg-page">
                            <p className="text-sm font-medium text-ink-2">{c.name}</p>
                          </div>
                          {clientDone.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-ink-2">No client-facing deliverables.</p>
                          ) : (
                            <div className="divide-y divide-line">
                              {clientDone.map((t) => (
                                <div key={t.id} className="px-4 py-2.5 text-sm text-ink-2">
                                  {t.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </section>
          );
        }

        const currentStageRow = project.stages.find(
          (s) => s.stageNumber === project.currentStage
        );
        const needsApproval =
          GATE_STAGES.has(project.currentStage) &&
          !currentStageRow?.gateApproved;

        const wireframeAssets = project.assets.filter((a) => a.folder === "wireframes");
        const mockupAssets = project.assets.filter((a) => a.folder === "mockup");
        const sharedAssets = project.assets.filter(
          (a) => a.folder !== "wireframes" && a.folder !== "mockup"
        );

        const stage3Approved = project.stages.find((s) => s.stageNumber === WIREFRAME_STAGE)?.gateApproved ?? false;
        const stage4Approved = project.stages.find((s) => s.stageNumber === DESIGN_STAGE)?.gateApproved ?? false;

        // Wireframe feedback: hide CTA once submitted, unless newer wireframes were uploaded after
        const wireframeFeedbackDoc = project.documents.find(
          (d) => d.templateType === "wireframe_feedback"
        );
        const wireframeFeedbackSubmitted =
          wireframeFeedbackDoc?.status === "APPROVED" &&
          !wireframeAssets.some(
            (a) => wireframeFeedbackDoc.completedAt && a.uploadedAt > wireframeFeedbackDoc.completedAt
          );

        // Design feedback: same logic
        const designFeedbackDoc = project.documents.find(
          (d) => d.templateType === "design_feedback"
        );
        const designFeedbackSubmitted =
          designFeedbackDoc?.status === "APPROVED" &&
          !mockupAssets.some(
            (a) => designFeedbackDoc.completedAt && a.uploadedAt > designFeedbackDoc.completedAt
          );

        const stageDescription =
          CLIENT_STAGE_DESCRIPTION[project.currentStage] ?? "In progress.";

        // Active vs completed forms.
        const activeDocs = project.documents.filter(isDocActive);
        const completedDocs = project.documents.filter((d) => !isDocActive(d));
        // Intake finished but brief not yet shared → focus on what's next.
        const intakeDoc = project.documents.find((d) => d.templateType === "intake_form");
        const intakeComplete =
          intakeDoc?.status === "APPROVED" &&
          !hasOpenClientItems((intakeDoc.content ?? {}) as FormContent);
        const showNextSteps = intakeComplete && !project.briefPublishedAt;

        return (
          <section key={project.id}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-semibold text-ink">
                {project.name}
              </h2>
            </div>
            <p className="text-sm text-ink-3 mb-6">{stageDescription}</p>

            {/* Brief & strategy — once the team has published them */}
            {project.briefPublishedAt && (
              <div className="mb-6">
                <Link
                  href={`/portal/brief/${project.id}`}
                  className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:underline">
                      Your Brief &amp; Strategy
                    </p>
                    <p className="text-xs text-ink-2 mt-0.5">
                      View the finished brief and strategy
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-mint-fill text-mint font-medium shrink-0 ml-4">
                    View →
                  </span>
                </Link>
              </div>
            )}

            {/* Approval gate */}
            {needsApproval && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-fill px-5 py-4">
                <p className="text-sm font-medium text-amber-900">
                  Your sign-off is needed before we continue.
                </p>
                <p className="text-xs text-amber mt-1">
                  Please review the shared work below and approve when you&apos;re
                  ready.
                </p>
                <ApproveButton
                  projectId={project.id}
                  stageNumber={project.currentStage}
                />
              </div>
            )}

            {/* Brief approvals — key messages and slogans pending client sign-off */}
            {(() => {
              const ap = pendingApprovals;
              const msgs = ap?.messages ?? [];
              const sls = ap?.slogans ?? [];
              if (msgs.length === 0 && sls.length === 0) return null;
              return (
                <div className="mb-6">
                  <SectionHeading>
                    Your approval needed
                  </SectionHeading>
                  <div className="space-y-3">
                    {msgs.map((msg) => (
                      <BriefApprovalItem
                        key={msg.message_id}
                        projectId={project.id}
                        id={msg.message_id}
                        kind="message"
                        text={(msg.message_text as string) ?? ""}
                        type={(msg.message_type as string) ?? null}
                        notes={(msg.tone_notes as string) ?? null}
                      />
                    ))}
                    {sls.map((s) => (
                      <BriefApprovalItem
                        key={s.slogan_id}
                        projectId={project.id}
                        id={s.slogan_id}
                        kind="slogan"
                        text={(s.slogan_text as string) ?? ""}
                        type={(s.type as string) ?? null}
                        notes={(s.usage_notes as string) ?? null}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Wireframe review — action needed until submitted or approved */}
            {wireframeAssets.length > 0 && !wireframeFeedbackSubmitted && !stage3Approved && (
              <div className="mb-6">
                <SectionHeading>
                  Wireframes — ready for your review
                </SectionHeading>
                <Link
                  href={`/portal/wireframes/${project.id}`}
                  className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:underline">
                      Review {wireframeAssets.length} wireframe{wireframeAssets.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-ink-2 mt-0.5">
                      Leave feedback on each page or screen
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-fill text-amber font-medium shrink-0 ml-4">
                    Action needed →
                  </span>
                </Link>
              </div>
            )}

            {/* Wireframes folder — accessible after submission or approval */}
            {wireframeAssets.length > 0 && (wireframeFeedbackSubmitted || stage3Approved) && (
              <div className="mb-4">
                <Link
                  href={`/portal/wireframes/${project.id}`}
                  className="inline-flex items-center gap-2 text-xs text-ink-2 hover:text-neutral-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  Wireframes — {stage3Approved ? "approved ✓" : "feedback submitted"}
                </Link>
              </div>
            )}

            {/* Design review — action needed until submitted or approved */}
            {mockupAssets.length > 0 && !designFeedbackSubmitted && !stage4Approved && (
              <div className="mb-6">
                <SectionHeading>
                  Designs — ready for your review
                </SectionHeading>
                <Link
                  href={`/portal/design/${project.id}`}
                  className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-ink group-hover:underline">
                      Review the full designs
                    </p>
                    <p className="text-xs text-ink-2 mt-0.5">
                      {mockupAssets.filter(a => a.mimeType === "text/uri-list").length > 0
                        ? "Includes links and files — approve or request changes"
                        : "Review files and leave your feedback"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-fill text-amber font-medium shrink-0 ml-4">
                    Action needed →
                  </span>
                </Link>
              </div>
            )}

            {/* What happens next — after intake is submitted, before the brief */}
            {showNextSteps && (
              <div className="mb-6 rounded-lg border border-line bg-surface px-5 py-4">
                <p className="text-sm font-medium text-ink">What happens next</p>
                <p className="text-sm text-ink-2 mt-1">
                  Your team is reviewing your intake answers and preparing your Project Brief.
                  We&apos;ll notify you here as soon as it&apos;s ready for you to review.
                </p>
              </div>
            )}

            {/* Forms & documents — only those needing action */}
            {activeDocs.length > 0 && (
              <div className="mb-6">
                <SectionHeading>
                  Needs your attention
                </SectionHeading>
                <div className="space-y-2">
                  {activeDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/portal/documents/${doc.id}`}
                      className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors group"
                    >
                      <span className="text-sm font-medium text-ink group-hover:underline">
                        {doc.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 bg-amber-fill text-amber">
                        Action needed
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Completed forms — tucked into history */}
            {completedDocs.length > 0 && (
              <details className="mb-6 group">
                <summary className="text-xs font-semibold text-ink-3 uppercase tracking-wider cursor-pointer hover:text-neutral-700 select-none list-none">
                  Completed ({completedDocs.length})
                </summary>
                <div className="space-y-2 mt-3">
                  {completedDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/portal/documents/${doc.id}`}
                      className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors"
                    >
                      <span className="text-sm text-ink-2">{doc.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 bg-mint-fill text-mint">
                        {doc.templateType === "financial_offer" ? "Approved" : "Submitted"}
                      </span>
                    </Link>
                  ))}
                </div>
              </details>
            )}

            {/* Shared assets (non-wireframe) */}
            {sharedAssets.length > 0 && (
              <div className="mb-6">
                <SectionHeading>
                  Shared with you
                </SectionHeading>
                <div className="space-y-2">
                  {sharedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3"
                    >
                      <div>
                        <a
                          href={`/api/download?id=${asset.id}`}
                          className="text-sm font-medium text-ink hover:underline"
                        >
                          {asset.filename}
                        </a>
                        {asset.notes && (
                          <p className="text-xs text-ink-2 mt-0.5">{asset.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-ink-2 shrink-0 ml-4">
                        {new Date(asset.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materials checklist */}
            {project.materials.length > 0 && (
              <div>
                <SectionHeading>
                  We need from you
                </SectionHeading>
                <div className="space-y-2">
                  {project.materials.map((item) => (
                    <MaterialItem
                      key={item.id}
                      item={{
                        id: item.id,
                        label: item.label,
                        notes: item.notes,
                        status: item.status,
                        dueDate: item.dueDate?.toISOString() ?? null,
                        projectId: project.id,
                        fileRef: item.fileRef,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
