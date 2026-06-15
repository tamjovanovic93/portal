import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DocumentForm from "@/components/DocumentForm";
import DeleteDocumentButton from "@/components/team/project/DeleteDocumentButton";

const STAGE_NAMES: Record<number, string> = {
  1: "Onboarding", 2: "Strategy", 3: "Sketch",
  4: "Make", 5: "Build", 6: "Client Review",
  7: "Launch", 8: "Complete",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};


export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; n: string; docId: string }>;
}) {
  const { id: projectId, n, docId: documentId } = await params;
  const stageNumber = parseInt(n, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [project, doc] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.document.findUnique({ where: { id: documentId } }),
  ]);

  if (!project || !doc || doc.projectId !== projectId) notFound();

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  const isReadOnly = doc.status === "APPROVED";
  const content = (doc.content ?? {}) as Record<string, unknown>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-600 space-x-1.5">
        <Link href="/dashboard" className="hover:text-neutral-700">
          Projects
        </Link>
        <span>›</span>
        <Link href={`/projects/${projectId}`} className="hover:text-neutral-700">
          {project.name}
        </Link>
        <span>›</span>
        <Link
          href={`/projects/${projectId}/stage/${stageNumber}`}
          className="hover:text-neutral-700"
        >
          Stage {stageNumber} — {STAGE_NAMES[stageNumber]}
        </Link>
        <span>›</span>
        <span className="text-neutral-600">{doc.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
          {template.description && (
            <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-neutral-600">
            {STATUS_LABEL[doc.status] ?? doc.status}
          </span>
          {doc.status === "DRAFT" && (
            <DeleteDocumentButton
              documentId={documentId}
              projectId={projectId}
              stageNumber={stageNumber}
            />
          )}
        </div>
      </div>

      {/* Form */}
      <DocumentForm
        documentId={documentId}
        template={template}
        initialContent={content}
        readOnly={isReadOnly}
        isTeam
      />
    </div>
  );
}
