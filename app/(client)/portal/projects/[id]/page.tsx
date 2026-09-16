import Link from "next/link";
import { notFound } from "next/navigation";
import ApproveButton from "@/components/client/ApproveButton";
import BriefApprovalItem from "@/components/client/BriefApprovalItem";
import MaterialItem from "@/components/client/MaterialItem";
import RetainerBody from "./RetainerBody";
import { ActionCard, ActionRow } from "@/components/client/ActionCard";
import { PanelCard, PanelRow } from "@/components/client/PanelCard";
import ActivityList from "@/components/client/ActivityList";
import StageProgress from "@/components/client/StageProgress";
import SectionHeading from "@/components/ui/SectionHeading";
import Icon from "@/components/ui/Icon";
import { Pill } from "@/components/ui/kit";
import { clientStageDescription } from "@/lib/stages";
import { ASSET_KIND_LABEL, clientDocStatusLabel } from "@/lib/client-portal";
import { loadClientProject } from "./queries";
import { deriveClientProject } from "./derive";

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // requireProjectAccess throws on a missing or someone else's project; the
  // older client pages notFound() in that case and this one matches them.
  const data = await loadClientProject(id).catch(() => null);
  if (!data) notFound();

  const now = new Date();
  const d = deriveClientProject(data, now);
  const { project } = data;
  const isRetainer = project.mode === "ONGOING";

  const actionRows = [
    d.needsGateApproval ? (
      <ActionRow key="gate">
        <p className="text-sm font-medium text-ink">Your sign-off is needed before we continue.</p>
        <p className="text-xs text-ink-2 mt-1">
          Please review the shared work below and approve when you&apos;re ready.
        </p>
        <ApproveButton projectId={project.id} stageNumber={project.currentStage} />
      </ActionRow>
    ) : null,
    d.needsWireframeReview ? (
      <ActionRow
        key="wireframes"
        href={`/portal/wireframes/${project.id}`}
        label={`Review ${d.wireframeAssets.length} wireframe${d.wireframeAssets.length === 1 ? "" : "s"}`}
        sub="Leave feedback on each page or screen"
        cta="Review"
      />
    ) : null,
    d.needsDesignReview ? (
      <ActionRow
        key="designs"
        href={`/portal/design/${project.id}`}
        label="Review the full designs"
        sub={
          d.mockupAssets.some((a) => a.mimeType === "text/uri-list")
            ? "Includes links and files — approve or request changes"
            : "Review files and leave your feedback"
        }
        cta="Review"
      />
    ) : null,
    ...d.activeDocs.map((doc) => (
      <ActionRow key={doc.id} href={`/portal/documents/${doc.id}`} label={doc.title} cta="Open" />
    )),
  ].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <Link
        href="/portal/projects"
        className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink transition-colors"
      >
        <Icon name="chevR" size={14} style={{ transform: "rotate(180deg)" }} />
        All projects
      </Link>

      {/* Title block */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title text-ink" style={{ fontSize: 30 }}>{project.name}</h1>
            {isRetainer && <Pill color="blue">Retainer</Pill>}
          </div>
          <p className="text-xs text-ink-3 mt-2">
            Started{" "}
            {project.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="text-sm text-ink-2 mt-3">
            {isRetainer
              ? d.activeCycles.length > 0
                ? `Current cycle: ${d.activeCycles.map((c) => c.name).join(", ")}`
                : "Your ongoing work — your team will open the next cycle shortly."
              : clientStageDescription(project.currentStage)}
          </p>
        </div>
        {!isRetainer && <StageProgress current={project.currentStage} className="lg:text-right shrink-0" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* ── Main column ── */}
        <div className="space-y-8 min-w-0">
          {actionRows.length > 0 && <ActionCard count={actionRows.length}>{actionRows}</ActionCard>}

          {isRetainer ? (
            <RetainerBody projectId={project.id} data={data} derived={d} />
          ) : (
            <>
              {d.work.length > 0 && (
                <PanelCard title="Latest work">
                  {d.work.map((w) => (
                    <PanelRow
                      key={w.key}
                      href={w.href}
                      label={w.label}
                      sub={w.sub}
                      right={
                        <Pill color={w.status === "approved" ? "mint" : w.status === "review" ? "amber" : null}>
                          {w.status === "approved" ? "Approved ✓" : w.status === "review" ? "To review" : "In progress"}
                        </Pill>
                      }
                    />
                  ))}
                </PanelCard>
              )}

              {d.showNextSteps && (
                <div className="rounded-lg border border-line bg-surface px-5 py-4">
                  <p className="text-sm font-medium text-ink">What happens next</p>
                  <p className="text-sm text-ink-2 mt-1">
                    Your team is reviewing your intake answers and preparing your Project Brief. We&apos;ll notify you
                    here as soon as it&apos;s ready for you to review.
                  </p>
                </div>
              )}

              {(data.pendingCopy.messages.length > 0 || data.pendingCopy.slogans.length > 0) && (
                <section>
                  <SectionHeading>Your approval needed</SectionHeading>
                  <div className="space-y-3">
                    {data.pendingCopy.messages.map((msg) => (
                      <BriefApprovalItem
                        key={msg.message_id}
                        projectId={project.id}
                        id={msg.message_id}
                        kind="message"
                        text={(msg.message_text as string) ?? ""}
                        type={(msg.message_type as string) ?? null}
                        notes={(msg.tone_notes as string) ?? null}
                      />
                    ))}
                    {data.pendingCopy.slogans.map((s) => (
                      <BriefApprovalItem
                        key={s.slogan_id}
                        projectId={project.id}
                        id={s.slogan_id}
                        kind="slogan"
                        text={(s.slogan_text as string) ?? ""}
                        type={(s.type as string) ?? null}
                        notes={(s.usage_notes as string) ?? null}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data.materials.length > 0 && (
                <section>
                  <SectionHeading>We need from you</SectionHeading>
                  <div className="space-y-2">
                    {data.materials.map((item) => (
                      <MaterialItem
                        key={item.id}
                        item={{
                          id: item.id,
                          label: item.label,
                          notes: item.notes,
                          status: item.status,
                          dueDate: item.dueDate?.toISOString() ?? null,
                          projectId: project.id,
                          fileRef: item.fileRef,
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {d.completedDocs.length > 0 && (
                <details className="group">
                  <summary className="text-xs font-semibold text-ink-3 uppercase tracking-wider cursor-pointer list-none select-none hover:text-ink">
                    Completed ({d.completedDocs.length})
                  </summary>
                  <div className="space-y-2 mt-3">
                    {d.completedDocs.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/portal/documents/${doc.id}`}
                        className="flex items-center justify-between bg-surface border border-line rounded-md px-4 py-3 hover:border-line-3 transition-colors"
                      >
                        <span className="text-sm text-ink-2">{doc.title}</span>
                        <Pill color="mint">{clientDocStatusLabel(doc)}</Pill>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        {/* ── Rail ── */}
        <div className="space-y-5 min-w-0">
          <PanelCard
            title="Files"
            action={{ label: "View all", href: `/portal/files?project=${project.id}` }}
          >
            <div className="grid grid-cols-3 gap-2 p-4">
              {(["photo", "doc", "link"] as const).map((kind) => (
                <div
                  key={kind}
                  className="rounded-lg border border-line px-3 py-2.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <p className="figure text-ink" style={{ fontSize: 17 }}>{d.fileCounts[kind]}</p>
                  <p className="text-xs text-ink-3 mt-1">{ASSET_KIND_LABEL[kind]}</p>
                </div>
              ))}
            </div>
          </PanelCard>

          <div className="card p-4 flex items-center gap-3">
            <Icon name="comment" size={18} style={{ color: "var(--mint)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">Questions?</p>
              <p className="text-xs text-ink-3">Your Zero Point team is here.</p>
            </div>
            <Link href={`/portal/messages?project=${project.id}`} className="btn btn-sm">
              Message
            </Link>
          </div>

          <PanelCard title="Project info">
            {project.briefPublishedAt && (
              <PanelRow href={`/portal/brief/${project.id}`} label="Brief & Strategy" right="View →" />
            )}
            <PanelRow label="Shared files" right={String(data.assets.length)} />
            {data.siblings.length > 1 && (
              <PanelRow href="/portal/projects" label="Your other projects" right={String(data.siblings.length - 1)} />
            )}
          </PanelCard>

          <ActivityList items={d.activity} now={now} />
        </div>
      </div>
    </div>
  );
}
