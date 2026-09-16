import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import ProjectCard from "@/components/client/ProjectCard";
import SectionHeading from "@/components/ui/SectionHeading";
import { loadClientDashboard } from "../queries";
import { deriveClientDashboard } from "../derive";

export default async function ClientProjectsPage() {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  const now = new Date();
  // Archived projects are included here — this is the full history, unlike the
  // dashboard which only shows what is live.
  const data = await loadClientDashboard(profile.id, { includeArchived: true });
  const { cards } = deriveClientDashboard(data, now);

  const archivedIds = new Set(data.projects.filter((p) => p.isArchived).map((p) => p.id));
  const active = cards.filter((c) => !archivedIds.has(c.id));
  const archived = cards.filter((c) => archivedIds.has(c.id));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <h1 className="page-title text-ink" style={{ fontSize: 30 }}>Your projects</h1>
        <p className="text-sm text-ink-3 mt-2">
          {active.length} active{archived.length > 0 ? ` · ${archived.length} completed` : ""}
        </p>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <p className="text-sm text-ink-3">
          You don&apos;t have any projects yet. Your team will set one up shortly.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {active.map((card) => (
            <ProjectCard key={card.id} project={card} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section>
          <SectionHeading>Completed</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {archived.map((card) => (
              <ProjectCard key={card.id} project={card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
