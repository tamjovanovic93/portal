"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import ProjectBriefCard from "@/components/team/brief/ProjectBriefCard";
import { createBrief, type BriefSummary } from "@/app/actions/project-brief";
import type { RosterMember } from "@/lib/team";

type Props = {
  projectId: string;
  projectName: string;
  currentStageLabel: string;
  briefs: BriefSummary[];
  roster: RosterMember[];
  dataContacts: { label: string; value: string }[];
  clientDefault: { name?: string; email?: string };
};

export default function BriefsSection(props: Props) {
  const { projectId, briefs } = props;
  const router = useRouter();
  const [pending, start] = useTransition();

  function addBrief() {
    start(async () => {
      await createBrief(projectId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Briefs</span>
          <span className="faint" style={{ fontSize: 12 }}>{briefs.length} brief{briefs.length !== 1 ? "s" : ""}</span>
        </div>
        <button type="button" onClick={addBrief} disabled={pending} className="btn btn-sm btn-primary">
          {pending ? "Adding…" : "+ Add New Brief"}
        </button>
      </div>

      {briefs.length === 0 ? (
        <div className="card muted" style={{ padding: 28, textAlign: "center", fontSize: 13.5 }}>
          No briefs yet. Add one to define this project.
        </div>
      ) : (
        <div className="space-y-4">
          {briefs.map((b) => (
            <ProjectBriefCard
              key={b.id}
              projectId={projectId}
              briefId={b.id}
              projectName={props.projectName}
              currentStageLabel={props.currentStageLabel}
              brief={b.content}
              publishedAt={b.publishedAt}
              roster={props.roster}
              dataContacts={props.dataContacts}
              clientDefault={props.clientDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
