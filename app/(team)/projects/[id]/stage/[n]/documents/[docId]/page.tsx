import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DeleteDocumentButton from "@/components/team/project/DeleteDocumentButton";
import OnboardingDocView from "@/components/team/project/OnboardingDocView";
import { stageLabel } from "@/lib/stages";

// Team-side editor for a PROJECT stage document. Onboarding forms use the
// collaborative prefill → review flow (see OnboardingDocView).
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; n: string; docId: string }>;
}) {
  const { id: projectId, n, docId: documentId } = await params;
  const stageNumber = parseInt(n, 10);

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [project, doc] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.document.findUnique({ where: { id: documentId } }),
  ]);

  if (!project || !doc || doc.projectId !== projectId) notFound();

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-2 space-x-1.5">
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
          Stage {stageNumber} — {stageLabel(stageNumber)}
        </Link>
        <span>›</span>
        <span className="text-ink-2">{doc.title}</span>
      </nav>

      <OnboardingDocView
        doc={doc}
        template={template}
        deleteControl={
          <DeleteDocumentButton documentId={documentId} projectId={projectId} stageNumber={stageNumber} />
        }
      />
    </div>
  );
}
