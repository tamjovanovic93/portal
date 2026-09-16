import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import AnswerQuestions, { type ClientQuestion } from "@/components/client/AnswerQuestions";
import { ActionCard, ActionRow } from "@/components/client/ActionCard";
import { PanelCard, PanelRow } from "@/components/client/PanelCard";
import ProjectCard from "@/components/client/ProjectCard";
import ActivityList from "@/components/client/ActivityList";
import SectionHeading from "@/components/ui/SectionHeading";
import Icon from "@/components/ui/Icon";
import { Pill } from "@/components/ui/kit";
import { greeting, clientDocStatusLabel } from "@/lib/client-portal";
import type { BrandKit } from "@/app/actions/brand-kit";
import { loadClientDashboard } from "./queries";
import { deriveClientDashboard } from "./derive";

export default async function ClientPortalPage() {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  const now = new Date();
  const data = await loadClientDashboard(profile.id);
  const d = deriveClientDashboard(data, now);

  const firstName = (profile.name ?? profile.email).split(/[\s@]/)[0];
  const questions: ClientQuestion[] = data.questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    questionText: q.questionText,
    proposedAnswer: q.proposedAnswer,
    projectName: q.project?.name ?? "Your project",
  }));

  const brand = (data.brandKit?.content ?? null) as BrandKit | null;
  const brandColors = brand?.colors?.slice(0, 4) ?? [];

  // A client whose projects haven't been created yet still has onboarding to do.
  if (data.projects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div>
          <p className="text-sm text-ink-3">{greeting(now)}, {firstName}</p>
          <h1 className="page-title text-ink mt-1" style={{ fontSize: 28 }}>Welcome to Zero Point</h1>
        </div>
        <AnswerQuestions questions={questions} />
        {d.needs.length > 0 ? (
          <ActionCard count={d.needs.length}>
            {d.needs.map((n) => (
              <ActionRow key={n.key} href={n.href} label={n.label} sub={n.sub} cta={n.cta} />
            ))}
          </ActionCard>
        ) : (
          <p className="text-ink-3 text-sm text-center">
            Your onboarding is being set up. Check back shortly.
          </p>
        )}
        {d.onboardingDocs.length > 0 && (
          <PanelCard title="Your documents">
            {d.onboardingDocs.map((doc) => (
              <PanelRow
                key={doc.id}
                href={`/portal/documents/${doc.id}`}
                label={doc.title}
                right={<Pill color={doc.status === "APPROVED" ? "mint" : "amber"}>{clientDocStatusLabel(doc)}</Pill>}
              />
            ))}
          </PanelCard>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Hero */}
      <div className="space-y-4">
        <div>
          <p className="text-sm text-ink-3">{greeting(now)}, {firstName}</p>
          <h1 className="page-title text-ink mt-1" style={{ fontSize: 30 }}>
            {data.projects.length} active project{data.projects.length === 1 ? "" : "s"}
          </h1>
        </div>

        {d.workingOn.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="eyebrow">Currently working on</span>
            {d.workingOn.map((label, i) => (
              <Pill key={`${label}-${i}`}>{label}</Pill>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-7 gap-y-4 pt-1">
          <Stat value={data.projects.length} label="Projects" />
          <Divider />
          <Stat value={d.needs.length} label="Waiting for you" accent={d.needs.length > 0} />
          <Divider />
          <Stat value={d.questionCount} label={d.questionCount === 1 ? "Question" : "Questions"} />
        </div>
      </div>

      <AnswerQuestions questions={questions} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* ── Main column ── */}
        <div className="space-y-8 min-w-0">
          {d.needs.length > 0 && (
            <ActionCard count={d.needs.length}>
              {d.needs.map((n) => (
                <ActionRow
                  key={n.key}
                  href={n.href}
                  eyebrow={n.projectName}
                  label={n.label}
                  sub={n.sub}
                  cta={n.cta}
                />
              ))}
            </ActionCard>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionHeading>Your projects</SectionHeading>
              <span className="text-xs text-ink-3">{d.cards.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {d.cards.map((card) => (
                <ProjectCard key={card.id} project={card} />
              ))}
            </div>
          </section>

          <ActivityList items={d.activity} now={now} />
        </div>

        {/* ── Rail ── */}
        <div className="space-y-5 min-w-0">
          <section className="card p-[18px] space-y-3">
            <span className="eyebrow">Ask Zero Point</span>
            <p className="text-sm text-ink-2">Have a question about any of your projects?</p>
            <Link href="/portal/messages" className="btn btn-primary w-full">
              <Icon name="comment" size={15} />
              Ask a question
            </Link>
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-sm text-ink-2">
                {d.questionCount === 0
                  ? "No open questions"
                  : `${d.questionCount} open question${d.questionCount === 1 ? "" : "s"}`}
              </span>
              <Link href="/portal/messages" className="text-xs font-medium text-mint hover:underline">
                Messages →
              </Link>
            </div>
          </section>

          {d.onboardingDocs.length > 0 && (
            <PanelCard title="Documents">
              {d.onboardingDocs.map((doc) => (
                <PanelRow
                  key={doc.id}
                  href={`/portal/documents/${doc.id}`}
                  label={doc.title}
                  right={<Pill color={doc.status === "APPROVED" ? "mint" : "amber"}>{clientDocStatusLabel(doc)}</Pill>}
                />
              ))}
            </PanelCard>
          )}

          {brand && (
            <PanelCard title="Brand guidelines" action={{ label: "View", href: "/portal/brand" }}>
              <div className="px-5 py-4 space-y-3">
                {brandColors.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {brandColors.map((c, i) => (
                        <span
                          key={`${c.hex}-${i}`}
                          title={c.name ?? c.hex}
                          className="rounded-full border border-line"
                          style={{ width: 20, height: 20, background: c.hex }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-ink-3">
                      {brand.colors?.length} colour{brand.colors?.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                {brand.typography?.[0] && (
                  <div className="flex items-center justify-between pt-3 border-t border-line">
                    <span className="text-ink font-bold" style={{ fontSize: 20 }}>Aa</span>
                    <span className="text-xs text-ink-3">{brand.typography[0].font}</span>
                  </div>
                )}
              </div>
            </PanelCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className="figure" style={{ fontSize: 22, color: accent ? "var(--mint)" : "var(--text)" }}>{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:block" style={{ width: 1, height: 30, background: "var(--border)" }} />;
}
