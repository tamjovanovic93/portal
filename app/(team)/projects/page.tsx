import { prisma } from "@/lib/prisma";
import Link from "next/link";
import NewProjectButton from "@/components/team/NewProjectButton";
import ProjectCardMenu from "@/components/team/ProjectCardMenu";
import { STAGE_LABELS } from "@/lib/stages";
import { PROJECT_TYPE_LABELS } from "@/lib/constants/projects";
import StagePips from "@/components/team/StagePips";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { view } = await searchParams;
  const showArchived = view === "archived";

  const projects = await prisma.project.findMany({
    where: { isArchived: showArchived },
    include: {
      client: { select: { name: true, email: true } },
      stages: { select: { stageNumber: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const archivedCount = showArchived
    ? projects.length
    : await prisma.project.count({ where: { isArchived: true } });

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Projects</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {projects.length} {showArchived ? "archived" : "active"} project
            {projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showArchived && <NewProjectButton />}
      </div>

      {/* View toggle */}
      <div className="flex gap-4 mb-6 border-b border-line pb-4">
        <Link
          href="/projects"
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            !showArchived
              ? "border-neutral-900 text-ink"
              : "border-transparent text-ink-2 hover:text-neutral-600"
          }`}
        >
          Active
        </Link>
        <Link
          href="/projects?view=archived"
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            showArchived
              ? "border-neutral-900 text-ink"
              : "border-transparent text-ink-2 hover:text-neutral-600"
          }`}
        >
          Archived
          {archivedCount > 0 && (
            <span className="ml-1.5 text-xs text-ink-2">
              {archivedCount}
            </span>
          )}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 text-ink-2 text-sm">
          {showArchived
            ? "No archived projects."
            : "No active projects. Create one to get started."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasGate = project.stages.some(
              (s) => s.status === "GATE_PENDING"
            );
            const isOngoing = project.mode === "ONGOING";

            return (
              <div key={project.id} className="relative">
                <Link
                  href={`/projects/${project.id}`}
                  className="block bg-surface border border-line rounded-lg p-5 hover:border-line-3 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-ink-2 mt-0.5 truncate">
                        {project.client.name ?? project.client.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      {isOngoing && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-fill text-blue font-medium">
                          Retainer
                        </span>
                      )}
                      {hasGate && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-fill text-amber font-medium">
                          Gate
                        </span>
                      )}
                      <ProjectCardMenu
                        projectId={project.id}
                        isArchived={showArchived}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-ink-3">
                      {PROJECT_TYPE_LABELS[project.type]}
                    </span>
                    <span className="text-xs font-medium text-ink-2">
                      Stage {project.currentStage} —{" "}
                      {STAGE_LABELS[project.currentStage]}
                    </span>
                  </div>

                  <StagePips
                    currentStage={project.currentStage}
                    stageStatuses={project.stages}
                  />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
