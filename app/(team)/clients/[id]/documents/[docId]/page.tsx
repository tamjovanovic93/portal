import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DocumentForm, { type FormMode } from "@/components/DocumentForm";
import DeleteDocumentButton from "@/components/team/project/DeleteDocumentButton";
import OfferEditor from "@/components/team/project/OfferEditor";
import OfferPricingView from "@/components/OfferPricingView";
import IntakeBuilder from "@/components/team/project/IntakeBuilder";
import { applyConfig, getConfig } from "@/lib/templates/config";
import type { FormContent } from "@/lib/forms/collab";

// Team-side editor for CLIENT-scoped onboarding documents (initial form, offer,
// intake) — the client-level counterpart of the project stage document page.
const COLLAB_FORMS = new Set(["initial_client_form", "intake_form"]);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent to client",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function ClientDocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: clientId, docId: documentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.user_metadata?.role?.toLowerCase() === "client") redirect("/portal");

  const [client, doc] = await Promise.all([
    prisma.profile.findUnique({ where: { id: clientId }, select: { name: true, email: true, role: true } }),
    prisma.document.findUnique({ where: { id: documentId } }),
  ]);

  if (!client || client.role !== "CLIENT") notFound();
  if (!doc || doc.clientId !== clientId) notFound();

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  const clientName = client.name ?? client.email;
  const content = (doc.content ?? {}) as Record<string, unknown>;

  const isOffer = doc.templateType === "financial_offer";
  const isIntake = doc.templateType === "intake_form";
  const isCollab = COLLAB_FORMS.has(doc.templateType);
  const effectiveTemplate = isCollab ? applyConfig(template, getConfig(content)) : template;

  // While building the offer, show the client's Initial Form answers for
  // reference (their answers inform the scope/price).
  let initialFormAnswers: { label: string; value: string }[] = [];
  if (isOffer && doc.status === "DRAFT") {
    const initialDoc = await prisma.document.findFirst({
      where: { clientId, templateType: "initial_client_form" },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    if (initialDoc) {
      const initContent = (initialDoc.content ?? {}) as Record<string, unknown>;
      const initialTemplate = TEMPLATES["initial_client_form"];
      for (const section of initialTemplate.sections) {
        for (const field of section.fields) {
          const v = initContent[field.key];
          if (v != null && String(v).trim() !== "") {
            initialFormAnswers.push({ label: field.label, value: String(v) });
          }
        }
      }
    }
  }

  let mode: FormMode = "fill";
  let isReadOnly = doc.status === "APPROVED";
  if (isCollab) {
    if (doc.status === "DRAFT") {
      mode = "prefill";
      isReadOnly = false;
    } else if (doc.status === "APPROVED") {
      mode = "review";
      isReadOnly = false;
    } else {
      mode = "fill";
      isReadOnly = true;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <nav className="text-xs text-neutral-600 space-x-1.5">
        <Link href="/clients" className="hover:text-neutral-700">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${clientId}`} className="hover:text-neutral-700">{clientName}</Link>
        <span>›</span>
        <span className="text-neutral-600">{doc.title}</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
          {template.description && (
            <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-neutral-600">{STATUS_LABEL[doc.status] ?? doc.status}</span>
          {doc.status === "DRAFT" && (
            <DeleteDocumentButton documentId={documentId} clientId={clientId} />
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

      {isOffer ? (
        doc.status === "DRAFT" ? (
          <OfferEditor
            documentId={documentId}
            template={template}
            initialContent={content}
            initialFormAnswers={initialFormAnswers}
          />
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
            <OfferPricingView content={content} />
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
