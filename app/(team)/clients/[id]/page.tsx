import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProjectType, StageStatus } from "@prisma/client";
import NewProjectButton from "@/components/team/NewProjectButton";
import DeleteClientButton from "@/components/team/DeleteClientButton";
import EditClientButton from "@/components/team/client/EditClientButton";
import ClientCredentials from "@/components/team/client/ClientCredentials";
import ProjectCardMenu from "@/components/team/ProjectCardMenu";
import Icon from "@/components/ui/Icon";
import { Eyebrow, Pill, Avatar, VAR, type Accent } from "@/components/ui/kit";
import { STAGE_LABELS, STAGE_COUNT } from "@/lib/stages";
import ClientOnboardingPipeline from "@/components/team/client/ClientOnboardingPipeline";
import ClientIntakePipeline from "@/components/team/client/ClientIntakePipeline";
import { getProfile, getStrategy } from "@/lib/intake/store";

const TYPE_LABELS: Record<ProjectType, string> = {
  WEBSITE: "Website", BRANDING: "Branding", MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM", OTHER: "Other",
};

function StagePips({ currentStage, stageStatuses }: {
  currentStage: number;
  stageStatuses: { stageNumber: number; status: StageStatus }[];
}) {
  const statusMap = Object.fromEntries(stageStatuses.map((s) => [s.stageNumber, s.status]));
  return (
    <div className="flex items-center gap-1 mt-3">
      {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => {
        const status = statusMap[n];
        const isCurrent = n === currentStage;
        let bg = "var(--surface-3)";
        if (status === "COMPLETE") bg = "var(--mint)";
        else if (status === "GATE_PENDING") bg = "var(--amber)";
        else if (isCurrent) bg = "var(--mint)";
        return (
          <div
            key={n}
            title={`Stage ${n} — ${STAGE_LABELS[n]}`}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: bg, boxShadow: isCurrent ? `0 0 8px ${VAR.mint}` : "none", opacity: status === "COMPLETE" || isCurrent || status === "GATE_PENDING" ? 1 : 0.6 }}
          />
        );
      })}
    </div>
  );
}

export default async function ClientStreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.profile.findUnique({
    where: { id },
    include: {
      projectsAsClient: {
        include: {
          stages: { select: { stageNumber: true, status: true } },
          materials: { select: { status: true } },
          cycles: {
            where: { status: "ACTIVE" },
            select: {
              name: true,
              tasks: { select: { status: true, isBlocker: true, unblockedAt: true, dueDate: true, assigneeId: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  // Client-level onboarding + Client Data state (all client-scoped, no project).
  const [onboardingDocs, profile, strategy] = await Promise.all([
    prisma.document.findMany({
      where: {
        clientId: id,
        templateType: { in: ["initial_client_form", "financial_offer", "intake_form"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, templateType: true, status: true },
    }),
    getProfile(id),
    getStrategy(id),
  ]);
  const initialForm = onboardingDocs.find((d) => d.templateType === "initial_client_form") ?? null;
  const offer = onboardingDocs.find((d) => d.templateType === "financial_offer") ?? null;
  const intake = onboardingDocs.find((d) => d.templateType === "intake_form") ?? null;
  const intakeApproved = intake?.status === "APPROVED";
  const profileStatus = (profile?._meta?.status ?? null) as "draft" | "verified" | null;
  const hasStrategy = !!strategy;

  const clientName = client.name ?? client.email;
  const all = client.projectsAsClient;
  const active = all.filter((p) => !p.isArchived);
  const archived = all.filter((p) => p.isArchived);
  const retainers = active.filter((p) => p.mode === "ONGOING");
  const projects = active.filter((p) => p.mode !== "ONGOING");
  const now = new Date();

  const gateCount = projects.filter((p) => p.stages.some((s) => s.status === "GATE_PENDING")).length;
  const blockerCount = retainers.reduce(
    (n, p) => n + p.cycles.flatMap((c) => c.tasks).filter((t) => t.isBlocker && !t.unblockedAt && t.status !== "DONE").length,
    0
  );

  function outstandingMaterials(p: (typeof all)[number]) {
    return p.materials.filter((m) => m.status === "pending" || m.status === "submitted").length;
  }

  const attention = gateCount + blockerCount;
  const chips: { n: number; label: string; color: Accent }[] = [
    { n: active.length, label: "Engagements", color: "mint" },
    { n: projects.length, label: `Project${projects.length !== 1 ? "s" : ""}`, color: "mint" },
    { n: retainers.length, label: "Ongoing", color: "blue" },
    { n: attention, label: "Need attention", color: attention > 0 ? "amber" : "mint" },
  ];

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1320, margin: "0 auto" }} className="space-y-6">
      <Link href="/clients" className="faint inline-flex items-center gap-1.5" style={{ fontSize: 12.5 }}>
        <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} /> Clients
      </Link>

      {/* Header */}
      <div className="fade-up flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={clientName} size={52} />
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>CLIENT STREAM</Eyebrow>
            <h1 className="page-title" style={{ fontSize: 30 }}>{clientName}</h1>
            <p className="muted mono" style={{ margin: "6px 0 0", fontSize: 12.5 }}>{client.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <NewProjectButton prefillEmail={client.email} label="+ New project" />
          <EditClientButton clientId={id} name={clientName} email={client.email} />
          <DeleteClientButton clientId={id} clientName={clientName} />
        </div>
      </div>

      {/* Stat chips */}
      <div className="fade-up grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {chips.map((c) => (
          <div key={c.label} className="card" style={{ padding: "16px 18px" }}>
            <div className="figure" style={{ fontSize: 26, color: VAR[c.color], lineHeight: 1 }}>{String(c.n).padStart(2, "0")}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Client login credentials */}
      <section className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>CLIENT LOGIN</Eyebrow>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <ClientCredentials clientId={id} email={client.email} />
        </div>
      </section>

      {/* Onboarding & Client Data pipeline — happens once at the client level */}
      <section className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>ONBOARDING &amp; CLIENT DATA</Eyebrow>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Onboarding</p>
            <p className="faint" style={{ fontSize: 12, marginBottom: 14 }}>
              Initial form, offer and intake — collected once at the client level.
            </p>
            <ClientOnboardingPipeline
              clientId={id}
              initialForm={initialForm}
              offer={offer}
              intake={intake}
            />
          </div>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Data pipeline</p>
            <p className="faint" style={{ fontSize: 12, marginBottom: 14 }}>
              Agents build the profile, verification queue and strategy from the intake.
            </p>
            <ClientIntakePipeline
              clientId={id}
              hasApprovedIntake={intakeApproved}
              profileStatus={profileStatus}
              hasStrategy={hasStrategy}
            />
          </div>
        </div>
      </section>

      {/* Client Data — shared across all of this client's projects */}
      <section className="fade-up">
        <Eyebrow style={{ marginBottom: 14 }}>CLIENT DATA</Eyebrow>
        <Link href={`/clients/${id}/data`} className="card block" style={{ padding: 18 }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "var(--surface-2)", color: "var(--mint)" }} className="flex items-center justify-center">
              <Icon name="folder" size={19} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 15, fontWeight: 600 }}>Client Data</p>
              <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                Business, audience, messaging, strategy &amp; brand — shared by every project
              </p>
            </div>
            <Icon name="chevR" size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          </div>
        </Link>
      </section>

      {/* Ongoing retainers */}
      {retainers.length > 0 && (
        <section className="fade-up">
          <Eyebrow style={{ marginBottom: 14 }}>0NG0ING — RETAINERS</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {retainers.map((p) => {
              const tasks = p.cycles.flatMap((c) => c.tasks);
              const openCount = tasks.filter((t) => t.status !== "DONE").length;
              const blockers = tasks.filter((t) => t.isBlocker && !t.unblockedAt && t.status !== "DONE").length;
              const overdue = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < now).length;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="card block" style={{ padding: 18, borderLeft: "3px solid var(--blue)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ fontSize: 15, fontWeight: 600 }} className="truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Pill color="blue">RETAINER</Pill>
                      <ProjectCardMenu projectId={p.id} />
                    </div>
                  </div>
                  <p className="faint truncate" style={{ fontSize: 12, marginTop: 3 }}>{p.cycles[0]?.name ?? "No active cycle"}</p>
                  <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 12 }}>
                    <span className="tech" style={{ fontSize: 11, color: "var(--text-2)" }}>{openCount} OPEN</span>
                    {blockers > 0 && <Pill color="rose">{blockers} BLOCKER{blockers !== 1 ? "S" : ""}</Pill>}
                    {overdue > 0 && <Pill color="amber">{overdue} OVERDUE</Pill>}
                    {blockers === 0 && overdue === 0 && <Pill color="mint">ON TRACK</Pill>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section className="fade-up">
          <Eyebrow style={{ marginBottom: 14 }}>PR0JECTS</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {projects.map((p) => {
              const hasGate = p.stages.some((s) => s.status === "GATE_PENDING");
              const outstanding = outstandingMaterials(p);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="card block" style={{ padding: 18 }}>
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ fontSize: 15, fontWeight: 600 }} className="truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasGate && <Pill color="amber">GATE</Pill>}
                      <ProjectCardMenu projectId={p.id} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                    <span className="faint" style={{ fontSize: 12 }}>{TYPE_LABELS[p.type]}</span>
                    <span className="tech" style={{ fontSize: 11, color: "var(--text-2)" }}>{STAGE_LABELS[p.currentStage]}</span>
                  </div>
                  <StagePips currentStage={p.currentStage} stageStatuses={p.stages} />
                  <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
                    {outstanding > 0 ? `${outstanding} material${outstanding !== 1 ? "s" : ""} outstanding` : "Materials clear"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {active.length === 0 && (
        <div className="card muted" style={{ padding: 40, textAlign: "center", fontSize: 13.5 }}>
          No active engagements for this client.
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <details className="fade-up">
          <summary className="eyebrow" style={{ cursor: "pointer", listStyle: "none" }}>ARCHIVED ({archived.length})</summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" style={{ marginTop: 14 }}>
            {archived.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="card block" style={{ padding: 16, opacity: 0.7 }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="muted truncate" style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</p>
                  <Pill>{p.mode === "ONGOING" ? "RETAINER" : TYPE_LABELS[p.type]}</Pill>
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
