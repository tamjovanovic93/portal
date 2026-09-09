import ProjectBriefCard from "@/components/team/brief/ProjectBriefCard";
import type { BriefSummary } from "@/app/actions/project-brief";
import type { RosterMember } from "@/lib/team";

type Props = {
  projectId: string;
  projectName: string;
  currentStageLabel: string;
  brief: BriefSummary | null;
  roster: RosterMember[];
  dataContacts: { label: string; value: string }[];
  clientDefault: { name?: string; email?: string };
};

// Each project has exactly one Brief. (A separate engagement for the same
// client is a new Project under that client, not a second brief here.)
export default function BriefsSection(props: Props) {
  const { brief } = props;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Brief</span>
      </div>

      {!brief ? (
        <div className="card muted" style={{ padding: 28, textAlign: "center", fontSize: 13.5 }}>
          Preparing this project&apos;s brief…
        </div>
      ) : (
        <ProjectBriefCard
          projectId={props.projectId}
          briefId={brief.id}
          projectName={props.projectName}
          currentStageLabel={props.currentStageLabel}
          brief={brief.content}
          publishedAt={brief.publishedAt}
          roster={props.roster}
          dataContacts={props.dataContacts}
          clientDefault={props.clientDefault}
        />
      )}
    </div>
  );
}
