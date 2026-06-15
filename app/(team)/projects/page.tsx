import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ProjectType, StageStatus } from "@prisma/client";
import NewProjectButton from "@/components/team/NewProjectButton";
import ProjectCardMenu from "@/components/team/ProjectCardMenu";

const STAGE_LABELS: Record<number, string> = {
  1: "Onboarding",
  2: "Strategy",
  3: "Sketch",
  4: "Make",
  5: "Build",
  6: "Client Review",
  7: "Launch",
  8: "Complete",
};

const TYPE_LABELS: Record<ProjectType, string> = {
  WEBSITE: "Website",
  BRANDING: "Branding",
  MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM",
  OTHER: "Other",
};

function StagePips({
  currentStage,
  stageStatuses,
}: {
  currentStage: number;
  stageStatuses: { stageNumber: number; status: StageStatus }[];
}) {
  const statusMap = Object.fromEntries(
    stageStatuses.map((s) => [s.stageNumber, s.status])
  );

  return (
    <div className="flex items-center gap-1 mt-3">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
        const status = statusMap[n];
        const isCurrent = n === currentStage;
        const isDone = status === "COMPLETE";
        const isGate = status === "GATE_PENDING";

        let bg = "bg-neutral-200";
        if (isDone) bg = "bg-neutral-900";
        else if (isGate) bg = "bg-amber-400";
        else if (isCurrent) bg = "bg-neutral-500";

        return (
          <div
            key={n}
            title={`Stage ${n} — ${STAGE_LABELS[n]}`}
            className={`h-1.5 w-6 rounded-full ${bg}`}
          />
        );
      })}
    </div>
  );
}

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
          <h1 className="text-xl font-semibold text-neutral-900">Projects</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {projects.length} {showArchived ? "archived" : "active"} project
            {projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showArchived && <NewProjectButton />}
      </div>

      {/* View toggle */}
      <div className="flex gap-4 mb-6 border-b border-neutral-100 pb-4">
        <Link
          href="/projects"
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            !showArchived
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-600 hover:text-neutral-600"
          }`}
        >
          Active
        </Link>
        <Link
          href="/projects?view=archived"
          className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
            showArchived
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-600 hover:text-neutral-600"
          }`}
        >
          Archived
          {archivedCount > 0 && (
            <span className="ml-1.5 text-xs text-neutral-600">
              {archivedCount}
            </span>
          )}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 text-neutral-600 text-sm">
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
                  className="block bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-400 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-neutral-600 mt-0.5 truncate">
                        {project.client.name ?? project.client.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      {isOngoing && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                          Retainer
                        </span>
                      )}
                      {hasGate && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
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
                    <span className="text-xs text-neutral-500">
                      {TYPE_LABELS[project.type]}
                    </span>
                    <span className="text-xs font-medium text-neutral-700">
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
