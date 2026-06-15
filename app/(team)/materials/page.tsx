import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Icon from "@/components/ui/Icon";
import { Eyebrow, Pill, type Accent } from "@/components/ui/kit";

const STATUS_COLOR: Record<string, Accent> = {
  pending: "amber",
  submitted: "blue",
  received: "mint",
  verified: "mint",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting client",
  submitted: "To review",
  received: "Received",
  verified: "Verified",
};

function formatDue(d: Date | null) {
  if (!d) return null;
  const days = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  return { text: `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, overdue: false };
}

export default async function MaterialsPage() {
  const items = await prisma.materialItem.findMany({
    where: { status: { in: ["pending", "submitted", "received"] } },
    include: { project: { select: { id: true, name: true, client: { select: { name: true, email: true } } } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const pending = items.filter((m) => m.status === "pending").length;
  const toReview = items.filter((m) => m.status === "submitted").length;

  // group by project
  const groups = new Map<string, { id: string; name: string; client: string; rows: typeof items }>();
  for (const m of items) {
    const g = groups.get(m.projectId) ?? {
      id: m.project.id,
      name: m.project.name,
      client: m.project.client.name ?? m.project.client.email,
      rows: [] as typeof items,
    };
    g.rows.push(m);
    groups.set(m.projectId, g);
  }
  const grouped = [...groups.values()];

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1100, margin: "0 auto" }} className="space-y-6">
      <div className="fade-up flex items-end justify-between gap-5">
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>WAITING 0N CLIENTS</Eyebrow>
          <h1 className="page-title" style={{ fontSize: 32 }}>Materials</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5 }}>
            Everything outstanding from clients across every engagement.
          </p>
        </div>
      </div>

      <div className="fade-up grid grid-cols-3 gap-3.5">
        {[
          { n: items.length, label: "Outstanding", color: "mint" as Accent },
          { n: pending, label: "Awaiting client", color: "amber" as Accent },
          { n: toReview, label: "To review", color: "blue" as Accent },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
            <div className="figure" style={{ fontSize: 26, color: `var(--${s.color})`, lineHeight: 1 }}>{String(s.n).padStart(2, "0")}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
          Nothing outstanding — every client material is in.
        </div>
      ) : (
        <div className="fade-up space-y-4">
          {grouped.map((g) => (
            <div key={g.id} className="card" style={{ overflow: "hidden" }}>
              <div className="flex items-center justify-between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <Link href={`/projects/${g.id}`} style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</Link>
                  <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>{g.client}</p>
                </div>
                <span className="tech faint" style={{ fontSize: 11 }}>{g.rows.length} ITEM{g.rows.length !== 1 ? "S" : ""}</span>
              </div>
              <div>
                {g.rows.map((m, i) => {
                  const due = formatDue(m.dueDate);
                  return (
                    <div key={m.id} className="flex items-center gap-3" style={{ padding: "11px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <Icon name="layers" size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <span style={{ fontSize: 13 }}>{m.label}</span>
                        <span className="faint" style={{ fontSize: 11.5, marginLeft: 8, textTransform: "capitalize" }}>{m.category}</span>
                      </div>
                      {due && (
                        <span className="tech" style={{ fontSize: 11, color: due.overdue ? "var(--rose)" : "var(--text-3)" }}>{due.text}</span>
                      )}
                      <Pill color={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status] ?? m.status}</Pill>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
