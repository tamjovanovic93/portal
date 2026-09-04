import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DocumentForm, { type FormMode } from "@/components/DocumentForm";
import DeleteDocumentButton from "@/components/team/project/DeleteDocumentButton";
import OfferEditor from "@/components/team/project/OfferEditor";
import IntakeBuilder from "@/components/team/project/IntakeBuilder";
import { applyConfig, getConfig } from "@/lib/templates/config";
import type { FormContent } from "@/lib/forms/collab";

// Onboarding forms use the collaborative prefill → review flow.
const COLLAB_FORMS = new Set(["initial_client_form", "intake_form"]);

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

  const content = (doc.content ?? {}) as Record<string, unknown>;

  // Decide how the team interacts with this document.
  const isOffer = doc.templateType === "financial_offer";
  const isIntake = doc.templateType === "intake_form";
  const isCollab = COLLAB_FORMS.has(doc.templateType);
  // Collaborative forms honor the team's builder config (removed/reordered).
  const effectiveTemplate = isCollab
    ? applyConfig(template, getConfig(content))
    : template;
  let mode: FormMode = "fill";
  let isReadOnly = doc.status === "APPROVED";
  if (isCollab) {
    if (doc.status === "DRAFT") {
      mode = "prefill";
      isReadOnly = false;
    } else if (doc.status === "APPROVED") {
      mode = "review";
      isReadOnly = false; // review mode manages its own controls
    } else {
      mode = "fill";
      isReadOnly = true; // SENT — waiting on the client
    }
  }

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

      {isCollab && doc.status === "SENT" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
          Sent to the client — waiting for them to complete it.
        </p>
      )}
      {isCollab && doc.status === "APPROVED" && (
        <p className="text-xs text-neutral-600">
          Client completed this form. Review each answer below — you can change an answer
          (the client re-approves) or ask a question about it.
        </p>
      )}

      {/* Form */}
      {isOffer ? (
        doc.status === "DRAFT" ? (
          <OfferEditor documentId={documentId} template={template} initialContent={content} />
        ) : (
          <div className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-4">
            {template.sections[0].fields.map((field) => (
              <div key={field.key}>
                <p className="text-xs text-neutral-500">{field.label}</p>
                <p className="text-sm text-neutral-900 whitespace-pre-wrap">
                  {(content[field.key] as string) || "—"}
                </p>
              </div>
            ))}
          </div>
        )
      ) : isIntake && doc.status === "DRAFT" ? (
        <IntakeBuilder
          documentId={documentId}
          template={template}
          initialContent={content as FormContent}
        />
      ) : (
        <DocumentForm
          documentId={documentId}
          template={effectiveTemplate}
          initialContent={content}
          readOnly={isReadOnly}
          isTeam
          mode={mode}
        />
      )}
    </div>
  );
}
