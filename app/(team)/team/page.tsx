import TeamView from "@/components/team/TeamView";
import { getTeamData } from "@/lib/team";

export default async function TeamPage() {
  const members = await getTeamData();
  return <TeamView members={members} />;
}
