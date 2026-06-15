import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import ApproveButton from "@/components/client/ApproveButton";
import MaterialItem from "@/components/client/MaterialItem";
import BriefApprovalItem from "@/components/client/BriefApprovalItem";
import { PROFILE_DOC, type ClientProfile } from "@/lib/intake/types";
import DeliverableApproval from "@/components/client/DeliverableApproval";

// Plain-language stage descriptions — clients never see "Stage N"
const CLIENT_STAGE_DESCRIPTION: Record<number, string> = {
  1: "We're getting your project set up.",
  2: "We're working on your strategy and scope.",
  3: "We're putting together the first structural direction.",
  4: "We're working on the full design.",
  5: "We're building everything.",
  6: "Your project is ready for your final review.",
  7: "We're preparing to launch or deliver.",
  8: "Your project is complete.",
};

// Gated stages that require client action
const GATE_STAGES = new Set([3, 4, 6]);

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });
  if (!profile) redirect("/login");

  // A client can have multiple projects — load all
  const projects = await prisma.project.findMany({
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
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { approvals: true } } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Pending message/slogan approvals now live in each project's client_profile JSON.
  const profileRows = await prisma.document.findMany({
    where: { projectId: { in: projects.map((p) => p.id) }, templateType: PROFILE_DOC },
    select: { projectId: true, content: true },
  });
  const pendingApprovalsByProject = new Map<
    string,
    { messages: ClientProfile["messaging"]["key_messages"]; slogans: ClientProfile["messaging"]["slogans"] }
  >();
  for (const row of profileRows) {
    const content = row.content as ClientProfile;
    pendingApprovalsByProject.set(row.projectId, {
      messages: (content.messaging?.key_messages ?? []).filter((m) => (m.approved ?? "pending") === "pending"),
      slogans: (content.messaging?.slogans ?? []).filter((s) => (s.approved ?? "pending") === "pending"),
    });
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 text-center">
        <p className="text-neutral-500 text-sm">
          Your project is being set up. Check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      {projects.map((project) => {
        // ── Retainer (ONGOING) clients get a cycle/task view, not stages ──
        if (project.mode === "ONGOING") {
          const activeCycles = project.cycles.filter((c) => c.status === "ACTIVE");
          const closedCycles = project.cycles.filter((c) => c.status === "CLOSED");
          // Clients never see internal tasks.
          const visibleActiveTasks = activeCycles
            .flatMap((c) => c.tasks)
            .filter((t) => t.type !== "INTERNAL");
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
                <h2 className="text-lg font-semibold text-neutral-900">{project.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Retainer
                </span>
              </div>
              <p className="text-sm text-neutral-500 mb-6">
                {activeCycles.length > 0
                  ? `Current cycle: ${activeCycles.map((c) => c.name).join(", ")}`
                  : "Your ongoing work — your team will open the next cycle shortly."}
              </p>

              {/* Forms & documents (onboarding intake, etc.) */}
              {project.documents.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Forms &amp; documents
                  </h3>
                  <div className="space-y-2">
                    {project.documents.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/portal/documents/${doc.id}`}
                        className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3 hover:border-neutral-400 transition-colors group"
                      >
                        <span className="text-sm font-medium text-neutral-800 group-hover:underline">
                          {doc.title}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
                            doc.status === "APPROVED"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {doc.status === "APPROVED" ? "Submitted" : "Action needed"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Needs your attention */}
              {awaiting.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Needs your approval
                  </h3>
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
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Delivered this cycle
                  </h3>
                  <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100 overflow-hidden">
                    {delivered.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-800">{t.name}</p>
                          {t.description && (
                            <p className="text-xs text-neutral-600 mt-0.5 truncate">{t.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-green-700 shrink-0 ml-3">
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
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    We need from you
                  </h3>
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
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Shared with you
                  </h3>
                  <div className="space-y-2">
                    {sharedFiles.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3"
                      >
                        <a
                          href={`/api/download?id=${asset.id}`}
                          className="text-sm font-medium text-neutral-800 hover:underline truncate"
                        >
                          {asset.filename}
                        </a>
                        <span className="text-xs text-neutral-600 shrink-0 ml-4">
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
                  <summary className="text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer list-none select-none hover:text-neutral-700">
                    Past cycles ({closedCycles.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {closedCycles.map((c) => {
                      const clientDone = c.tasks.filter(
                        (t) => t.type !== "INTERNAL" && t.status === "DONE"
                      );
                      return (
                        <div key={c.id} className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
                            <p className="text-sm font-medium text-neutral-700">{c.name}</p>
                          </div>
                          {clientDone.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-neutral-600">No client-facing deliverables.</p>
                          ) : (
                            <div className="divide-y divide-neutral-100">
                              {clientDone.map((t) => (
                                <div key={t.id} className="px-4 py-2.5 text-sm text-neutral-600">
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

        const stage3Approved = project.stages.find((s) => s.stageNumber === 3)?.gateApproved ?? false;
        const stage4Approved = project.stages.find((s) => s.stageNumber === 4)?.gateApproved ?? false;

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

        return (
          <section key={project.id}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-semibold text-neutral-900">
                {project.name}
              </h2>
            </div>
            <p className="text-sm text-neutral-500 mb-6">{stageDescription}</p>

            {/* Approval gate */}
            {needsApproval && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
                <p className="text-sm font-medium text-amber-900">
                  Your sign-off is needed before we continue.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Please review the shared work below and approve when you're
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
              const ap = pendingApprovalsByProject.get(project.id);
              const msgs = ap?.messages ?? [];
              const sls = ap?.slogans ?? [];
              if (msgs.length === 0 && sls.length === 0) return null;
              return (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Your approval needed
                  </h3>
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
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Wireframes — ready for your review
                </h3>
                <Link
                  href={`/portal/wireframes/${project.id}`}
                  className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3 hover:border-neutral-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800 group-hover:underline">
                      Review {wireframeAssets.length} wireframe{wireframeAssets.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Leave feedback on each page or screen
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0 ml-4">
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
                  className="inline-flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-700 transition-colors"
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
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Designs — ready for your review
                </h3>
                <Link
                  href={`/portal/design/${project.id}`}
                  className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3 hover:border-neutral-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800 group-hover:underline">
                      Review the full designs
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {mockupAssets.filter(a => a.mimeType === "text/uri-list").length > 0
                        ? "Includes links and files — approve or request changes"
                        : "Review files and leave your feedback"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium shrink-0 ml-4">
                    Action needed →
                  </span>
                </Link>
              </div>
            )}

            {/* Documents to fill out */}
            {project.documents.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Forms & documents
                </h3>
                <div className="space-y-2">
                  {project.documents.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/portal/documents/${doc.id}`}
                      className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3 hover:border-neutral-400 transition-colors group"
                    >
                      <span className="text-sm font-medium text-neutral-800 group-hover:underline">
                        {doc.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
                          doc.status === "APPROVED"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {doc.status === "APPROVED" ? "Submitted" : "Action needed"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Shared assets (non-wireframe) */}
            {sharedAssets.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Shared with you
                </h3>
                <div className="space-y-2">
                  {sharedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-4 py-3"
                    >
                      <div>
                        <a
                          href={`/api/download?id=${asset.id}`}
                          className="text-sm font-medium text-neutral-800 hover:underline"
                        >
                          {asset.filename}
                        </a>
                        {asset.notes && (
                          <p className="text-xs text-neutral-600 mt-0.5">{asset.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-neutral-600 shrink-0 ml-4">
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
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  We need from you
                </h3>
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
