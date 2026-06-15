import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AddMaterialForm from "@/components/team/AddMaterialForm";
import MaterialRow from "@/components/team/MaterialRow";

const CATEGORIES = ["copy", "visuals", "info", "access", "approval"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  received: "Received",
  verified: "Verified",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-neutral-600",
  submitted: "text-blue-600",
  received: "text-amber-600",
  verified: "text-green-600",
};

export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const items = await prisma.materialItem.findMany({
    where: { projectId: id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const byCategory = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = items.filter((i) => i.category === cat);
      return acc;
    },
    {} as Record<string, typeof items>
  );

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const totalCount = items.length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/projects/${id}`}
          className="text-xs text-neutral-600 hover:text-neutral-700 mb-3 inline-block"
        >
          ← {project.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Materials checklist
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {totalCount === 0
                ? "No items yet"
                : `${totalCount} item${totalCount !== 1 ? "s" : ""} · ${pendingCount} pending`}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <AddMaterialForm projectId={id} />
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-12">
          Add items above to build the checklist.
        </p>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map((cat) => {
            const catItems = byCategory[cat];
            if (catItems.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 capitalize">
                  {cat}
                </h2>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white overflow-hidden">
                  {catItems.map((item) => (
                    <MaterialRow
                      key={item.id}
                      item={{
                        id: item.id,
                        label: item.label,
                        category: item.category,
                        status: item.status,
                        notes: item.notes,
                        dueDate: item.dueDate?.toISOString() ?? null,
                      }}
                      statusLabel={STATUS_LABEL[item.status] ?? item.status}
                      statusStyle={STATUS_STYLE[item.status] ?? "text-neutral-500"}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
