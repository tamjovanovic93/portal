import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eyebrow, Pill, Avatar } from "@/components/ui/kit";

export default async function ClientsPage() {
  // Every profile that owns at least one project, with a lightweight set of
  // their engagements so we can show counts per client.
  const clients = await prisma.profile.findMany({
    where: { projectsAsClient: { some: {} } },
    include: {
      projectsAsClient: {
        select: { id: true, mode: true, isArchived: true, updatedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = clients
    .map((c) => {
      const active = c.projectsAsClient.filter((p) => !p.isArchived);
      return {
        id: c.id,
        name: c.name ?? c.email,
        email: c.email,
        total: active.length,
        projects: active.filter((p) => p.mode !== "ONGOING").length,
        retainers: active.filter((p) => p.mode === "ONGOING").length,
        lastActivity: c.projectsAsClient.reduce<Date | null>(
          (latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest),
          null
        ),
      };
    })
    .sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 10 }}>CLIENTS</Eyebrow>
        <h1 className="page-title" style={{ fontSize: 32 }}>Clients</h1>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5 }}>
          {rows.length} client{rows.length !== 1 ? "s" : ""} — each stream holds all their engagements.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
          No clients yet. They appear here once a project is created for them.
        </div>
      ) : (
        <div className="fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rows.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card block" style={{ padding: 18 }}>
              <div className="flex items-center gap-3">
                <Avatar name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }} className="truncate">{c.name}</p>
                  <p className="faint mono truncate" style={{ fontSize: 11.5, marginTop: 2 }}>{c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 14 }}>
                <Pill color="mint">{c.total} ACTIVE</Pill>
                {c.projects > 0 && <Pill>{c.projects} PROJECT{c.projects !== 1 ? "S" : ""}</Pill>}
                {c.retainers > 0 && <Pill color="blue">{c.retainers} ONGOING</Pill>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
