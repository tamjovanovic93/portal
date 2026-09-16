import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { Pill } from "@/components/ui/kit";
import { STAGE_COUNT } from "@/lib/stages";

export type ProjectCardData = {
  id: string;
  name: string;
  /** Client-facing stage name, or the active cycle name for a retainer. */
  stageLabel: string;
  /** null for ONGOING projects — retainers have cycles, not steps. */
  stageNumber: number | null;
  isRetainer: boolean;
  /** What the client has to do, if anything. */
  actionLine: { text: string; needsAction: boolean };
  /** What happens next — a date, a deliverable, or the stage description. */
  nextLine: string;
};

export default function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      href={`/portal/projects/${project.id}`}
      className="card p-4 flex flex-col gap-3 hover:border-line-3 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-ink leading-tight group-hover:underline">{project.name}</h3>
        <Icon name="chevR" size={15} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 2 }} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Pill color={project.isRetainer ? "blue" : "mint"}>{project.stageLabel}</Pill>
        {project.stageNumber !== null ? (
          <span className="text-xs text-ink-3">Step {project.stageNumber} of {STAGE_COUNT}</span>
        ) : (
          <span className="text-xs text-ink-3">Retainer</span>
        )}
      </div>

      <div className="space-y-1">
        <p className={`text-xs font-medium ${project.actionLine.needsAction ? "text-amber" : "text-ink-2"}`}>
          {project.actionLine.text}
        </p>
        <p className="text-xs text-ink-3">{project.nextLine}</p>
      </div>
    </Link>
  );
}
