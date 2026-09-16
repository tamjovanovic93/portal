import DeliverableApproval from "@/components/client/DeliverableApproval";
import MaterialItem from "@/components/client/MaterialItem";
import SectionHeading from "@/components/ui/SectionHeading";
import type { ClientProjectData } from "./queries";
import type { deriveClientProject } from "./derive";

// The ONGOING (retainer) view: cycles and deliverables rather than stages.

export default function RetainerBody({
  projectId,
  data,
  derived,
}: {
  projectId: string;
  data: ClientProjectData;
  derived: ReturnType<typeof deriveClientProject>;
}) {
  const { awaitingApproval, delivered, closedCycles } = derived;

  return (
    <div className="space-y-8">
      {awaitingApproval.length > 0 && (
        <section>
          <SectionHeading>Needs your approval</SectionHeading>
          <div className="space-y-3">
            {awaitingApproval.map((t) => (
              <DeliverableApproval key={t.id} taskId={t.id} taskName={t.name} description={t.description} />
            ))}
          </div>
        </section>
      )}

      {delivered.length > 0 && (
        <section>
          <SectionHeading>Delivered this cycle</SectionHeading>
          <div className="border border-line rounded-lg bg-surface divide-y divide-line overflow-hidden">
            {delivered.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{t.name}</p>
                  {t.description && <p className="text-xs text-ink-2 mt-0.5 truncate">{t.description}</p>}
                </div>
                <span className="text-xs text-mint shrink-0 ml-3">
                  ✓ {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "Done"}
                </span>
              </div>
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
                  projectId,
                  fileRef: item.fileRef,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {closedCycles.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-ink-3 uppercase tracking-wider cursor-pointer list-none select-none hover:text-ink">
            Past cycles ({closedCycles.length})
          </summary>
          <div className="mt-3 space-y-3">
            {closedCycles.map((c) => {
              const done = c.tasks.filter((t) => t.status === "DONE");
              return (
                <div key={c.id} className="border border-line rounded-lg bg-surface overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-line bg-page">
                    <p className="text-sm font-medium text-ink-2">{c.name}</p>
                  </div>
                  {done.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-ink-2">No client-facing deliverables.</p>
                  ) : (
                    <div className="divide-y divide-line">
                      {done.map((t) => (
                        <div key={t.id} className="px-4 py-2.5 text-sm text-ink-2">{t.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
