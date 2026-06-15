import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CycleBoard from "@/components/team/retainer/CycleBoard";
import RetainerStageBar from "@/components/team/retainer/RetainerStageBar";
import BlockerUnblockControl from "@/components/team/retainer/BlockerUnblockControl";
import { OWNER_ROLE_LABEL } from "@/lib/retainer-labels";
import ClientLoginLink from "@/components/team/project/ClientLoginLink";
import IntakePipeline from "@/components/team/project/IntakePipeline";
import { getProfile, getStrategy } from "@/lib/intake/store";
import ProjectFiles from "@/components/team/ProjectFiles";
import MaterialRow from "@/components/team/MaterialRow";
import AddMaterialForm from "@/components/team/AddMaterialForm";
import NewProjectButton from "@/components/team/NewProjectButton";
import { createCycle } from "@/app/actions/retainer";

const MATERIAL_CATEGORIES = ["copy", "visuals", "info", "access", "approval"] as const;
const MATERIAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending", submitted: "Submitted", received: "Received", verified: "Verified",
};
const MATERIAL_STATUS_STYLE: Record<string, string> = {
  pending: "text-neutral-600", submitted: "text-blue-600",
  received: "text-amber-600", verified: "text-green-600",
};

const TYPE_LABELS: Record<string, string> = {
  WEBSITE: "Website", BRANDING: "Branding", MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM", OTHER: "Other",
};

async function NewCycleForm({ projectId }: { projectId: string }) {
  async function handleCreate(formData: FormData) {
    "use server";
    await createCycle(projectId, formData);
  }

  return (
    <details className="group border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-neutral-50 transition-colors">
        <span className="text-sm font-medium text-neutral-700">New cycle</span>
        <span className="text-neutral-600 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
      </summary>
      <form action={handleCreate} className="px-5 pb-5 pt-1 grid grid-cols-3 gap-3 border-t border-neutral-100">
        <div>
          <label className="block text-xs text-neutral-700 mb-1">Cycle name</label>
          <input name="name" required placeholder="e.g. June 2026"
            className="w-full text-sm rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-700 mb-1">Start date</label>
          <input name="startDate" type="date" required
            className="w-full text-sm rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-700 mb-1">End date (optional)</label>
          <input name="endDate" type="date"
            className="w-full text-sm rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-neutral-700 mb-1">Focus — what needs to happen (optional)</label>
          <textarea name="focus" rows={2} placeholder="e.g. Launch summer campaign, finalise landing page"
            className="w-full text-sm rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none" />
        </div>
        <button type="submit"
          className="col-span-3 justify-self-start text-sm px-4 py-2 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors">
          Create cycle
        </button>
      </form>
    </details>
  );
}

export default async function RetainerView({ projectId }: { projectId: string }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { name: true, email: true } },
      stages: { select: { stageNumber: true }, orderBy: { stageNumber: "asc" } },
      documents: {
        select: { id: true, templateType: true, title: true, status: true, stageNumber: true },
        orderBy: { createdAt: "asc" },
      },
      materials: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      assets: { orderBy: { uploadedAt: "desc" } },
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

  // Backfill stages for retainers created before stages were tracked.
  if (project.stages.length === 0) {
    await prisma.projectStage.createMany({
      data: Array.from({ length: 8 }, (_, i) => ({
        projectId,
        stageNumber: i + 1,
        status: i === 0 ? ("IN_PROGRESS" as const) : ("NOT_STARTED" as const),
      })),
      skipDuplicates: true,
    });
  }

  const cycles = project.cycles;
  const activeCycles = project.cycles.filter((c) => c.status === "ACTIVE");
  const closedCycles = project.cycles.filter((c) => c.status === "CLOSED");

  const openTasks = activeCycles.reduce(
    (n, c) => n + c.tasks.filter((t) => t.status !== "DONE").length, 0
  );

  const intakeDoc = project.documents.find((d) => d.templateType === "intake_form");
  const intakeSubmitted = intakeDoc?.status === "APPROVED";
  const [profile, strategy] = await Promise.all([getProfile(projectId), getStrategy(projectId)]);
  const databaseGenerated = !!profile;
  const profileStatus = profile?._meta?.status ?? null;
  const hasStrategy = !!strategy;

  function toBoardCycle(c: (typeof cycles)[number]) {
    return {
      id: c.id,
      name: c.name,
      focus: c.focus,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status as "ACTIVE" | "CLOSED",
      tasks: c.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        description: t.description,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        ownerRole: t.ownerRole,
        isBlocker: t.isBlocker,
        blockerResolver: t.blockerResolver,
        unblockedAt: t.unblockedAt,
        requiresClientApproval: t.requiresClientApproval,
        approvalCount: t._count.approvals,
      })),
    };
  }

  const activeCycleSummaries = activeCycles.map((c) => ({ id: c.id, name: c.name }));

  // ── Top-of-page signals across active cycles ──
  const activeTasks = activeCycles.flatMap((c) =>
    c.tasks.map((t) => ({ ...t, cycleName: c.name }))
  );
  const blockers = activeTasks.filter((t) => t.isBlocker && !t.unblockedAt && t.status !== "DONE");
  const awaitingClientTasks = activeTasks.filter(
    (t) =>
      t.type === "DELIVERABLE" &&
      t.requiresClientApproval &&
      t.status === "WAITING_FINAL_APPROVAL" &&
      t._count.approvals === 0
  );
  const overdueTasks = activeTasks.filter(
    (t) => t.dueDate && t.status !== "DONE" && t.dueDate < new Date()
  );

  // Materials the client has submitted but the team hasn't confirmed yet —
  // surfaced as a notification so the team can review and clear any blocker.
  const submittedMaterials = project.materials.filter((m) => m.status === "submitted");

  return (
    <div className="p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-xs text-neutral-600 hover:text-neutral-700 mb-3 inline-block">
          ← Projects
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title" style={{ fontSize: 26 }}>{project.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Retainer</span>
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
              <span>{openTasks} open task{openTasks !== 1 ? "s" : ""} across {activeCycles.length} active cycle{activeCycles.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NewProjectButton
              prefillEmail={project.client.email}
              label="+ New engagement"
              triggerClassName="text-sm text-neutral-600 border border-neutral-300 px-3 py-1.5 rounded-md hover:bg-neutral-50 transition-colors"
            />
            <ClientLoginLink projectId={projectId} />
          </div>
        </div>
      </div>

      {/* Stage progression — visible at the top */}
      <RetainerStageBar projectId={projectId} currentStage={project.currentStage} />

      {/* Health summary — at-a-glance retainer state as stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-neutral-900 tabular-nums leading-none">{openTasks}</p>
          <p className="text-xs text-neutral-700 mt-1.5">Open task{openTasks !== 1 ? "s" : ""}</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${blockers.length > 0 ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
          <p className={`text-2xl font-semibold tabular-nums leading-none ${blockers.length > 0 ? "text-red-700" : "text-neutral-300"}`}>{blockers.length}</p>
          <p className={`text-xs mt-1.5 ${blockers.length > 0 ? "text-red-700" : "text-neutral-700"}`}>Blocker{blockers.length !== 1 ? "s" : ""}</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${awaitingClientTasks.length > 0 ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"}`}>
          <p className={`text-2xl font-semibold tabular-nums leading-none ${awaitingClientTasks.length > 0 ? "text-amber-700" : "text-neutral-300"}`}>{awaitingClientTasks.length}</p>
          <p className={`text-xs mt-1.5 ${awaitingClientTasks.length > 0 ? "text-amber-700" : "text-neutral-700"}`}>Awaiting client</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${overdueTasks.length > 0 ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
          <p className={`text-2xl font-semibold tabular-nums leading-none ${overdueTasks.length > 0 ? "text-red-700" : "text-neutral-300"}`}>{overdueTasks.length}</p>
          <p className={`text-xs mt-1.5 ${overdueTasks.length > 0 ? "text-red-700" : "text-neutral-700"}`}>Overdue</p>
        </div>
      </div>

      {/* New from client — submitted materials awaiting team review */}
      {submittedMaterials.length > 0 && (
        <section className="space-y-2">
          {submittedMaterials.map((m) => (
            <Link
              key={`sub-${m.id}`}
              href={`/projects/${projectId}/materials`}
              className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-300 border-l-4 border-l-blue-500 rounded-lg px-5 py-4 hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-200 text-blue-800 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 13h4l2 3h6l2-3h4M5 13l2-7h10l2 7M5 13v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-blue-900 truncate">
                    Client submitted — {m.label}
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5 capitalize">
                    {m.category} · submitted {new Date(m.updatedAt).toLocaleDateString()} · review &amp; confirm receipt
                  </p>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 font-medium shrink-0">
                New →
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Attention: blockers, awaiting client, overdue */}
      {(blockers.length > 0 || awaitingClientTasks.length > 0 || overdueTasks.length > 0) && (
        <section className="space-y-2">
          {/* Blockers — most urgent, with who must clear them */}
          {blockers.map((t) => (
            <div
              key={`blk-${t.id}`}
              className="bg-white border border-red-200 border-l-4 border-l-red-500 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-0.5">
                  Blocker · {t.cycleName}
                </p>
                <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-neutral-700">
                  Resolver:{" "}
                  <span className="font-medium text-neutral-800">
                    {t.blockerResolver
                      ? OWNER_ROLE_LABEL[t.blockerResolver]
                      : t.ownerRole
                      ? OWNER_ROLE_LABEL[t.ownerRole]
                      : "Unassigned"}
                  </span>
                </span>
                <BlockerUnblockControl taskId={t.id} projectId={projectId} />
              </div>
            </div>
          ))}

          {/* Awaiting client + overdue summary chips */}
          {(awaitingClientTasks.length > 0 || overdueTasks.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {awaitingClientTasks.length > 0 && (
                <span className="text-xs px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                  {awaitingClientTasks.length} awaiting client approval
                </span>
              )}
              {overdueTasks.length > 0 && (
                <span className="text-xs px-3 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-medium">
                  {overdueTasks.length} task{overdueTasks.length !== 1 ? "s" : ""} overdue
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Current cycle — name + what needs to happen */}
      {activeCycles.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            Current cycle{activeCycles.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {activeCycles.map((c) => (
              <div key={c.id}>
                <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                <p className="text-sm text-neutral-600">
                  {c.focus ?? <span className="text-neutral-600">No focus set — add one on the cycle below.</span>}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Onboarding: review the submitted intake, then run the intake pipeline */}
      {intakeSubmitted && intakeDoc && (
        <div className="bg-white border border-neutral-200 rounded-lg px-5 py-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-900">Intake pipeline</p>
              <p className="text-xs text-neutral-700 mt-0.5">
                Review the client&apos;s answers, then run the pipeline.
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/stage/${intakeDoc.stageNumber}/documents/${intakeDoc.id}`}
              className="text-sm text-neutral-700 border border-neutral-300 px-4 py-2 rounded-md hover:bg-neutral-50 transition-colors shrink-0"
            >
              Review brief →
            </Link>
          </div>
          <IntakePipeline
            projectId={projectId}
            hasApprovedIntake={intakeSubmitted}
            profileStatus={profileStatus}
            hasStrategy={hasStrategy}
          />
        </div>
      )}

      {/* New cycle */}
      <NewCycleForm projectId={projectId} />

      {/* Active cycles */}
      {activeCycles.length > 0 ? (
        <div className="space-y-6">
          {activeCycles.map((c) => (
            <CycleBoard
              key={c.id}
              cycle={toBoardCycle(c)}
              projectId={projectId}
              otherActiveCycles={activeCycleSummaries.filter((s) => s.id !== c.id)}
            />
          ))}
        </div>
      ) : (
        closedCycles.length === 0 && (
          <p className="text-sm text-neutral-600 text-center py-12">
            No cycles yet. Create one to start tracking retainer work.
          </p>
        )
      )}

      {/* Closed cycles */}
      {closedCycles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Closed cycles</h2>
          {closedCycles.map((c) => (
            <CycleBoard key={c.id} cycle={toBoardCycle(c)} projectId={projectId} />
          ))}
        </div>
      )}

      {/* Materials checklist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Materials checklist</h2>
          {project.materials.length > 0 && (
            <span className="text-xs text-neutral-600">{project.materials.length} item{project.materials.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="mb-3"><AddMaterialForm projectId={projectId} /></div>
        {project.materials.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-6">Add items above to build the checklist.</p>
        ) : (
          <div className="space-y-5">
            {MATERIAL_CATEGORIES.map((cat) => {
              const items = project.materials.filter((i) => i.category === cat);
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 capitalize">{cat}</h3>
                  <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white overflow-hidden">
                    {items.map((item) => (
                      <MaterialRow
                        key={item.id}
                        item={{
                          id: item.id, label: item.label, category: item.category,
                          status: item.status, notes: item.notes,
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

      {/* Files — folders */}
      <div>
        <h2 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Files</h2>
        <ProjectFiles
          projectId={projectId}
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
    </div>
  );
}
