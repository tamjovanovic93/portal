import type { ReactNode } from "react";
import type { Template } from "@/lib/templates/types";
import DocumentForm, { type FormMode } from "@/components/DocumentForm";
import OfferEditor from "@/components/team/project/OfferEditor";
import OfferPricingView from "@/components/OfferPricingView";
import OfferQuestionsAdmin from "@/components/team/project/OfferQuestionsAdmin";
import IntakeBuilder from "@/components/team/project/IntakeBuilder";
import { applyConfig, getConfig } from "@/lib/templates/config";
import type { FormContent } from "@/lib/forms/collab";
import { COLLAB_FORM_TYPES, TEMPLATE_TYPES } from "@/lib/documents/types";
import { DOC_STATUS_LABEL } from "@/lib/constants/documents";

type OfferQuestion = React.ComponentProps<typeof OfferQuestionsAdmin>["questions"][number];

// Team-side body of an onboarding document page (initial form / offer /
// intake): header with status + delete control, collab banners, and the
// editor that matches the document's type and status. Rendered as a fragment
// so the page's `space-y-*` container spaces the pieces as before.
export default function OnboardingDocView({
  doc,
  template,
  deleteControl,
  initialFormAnswers,
  offerQuestions,
  showOfferPricing = false,
}: {
  doc: { id: string; title: string; status: string; templateType: string; content: unknown };
  template: Template;
  deleteControl: ReactNode;
  // Offer editor reference answers (client-level page only).
  initialFormAnswers?: { label: string; value: string }[];
  // Client questions about the offer, answerable inline (client-level page only).
  offerQuestions?: OfferQuestion[];
  showOfferPricing?: boolean;
}) {
  const content = (doc.content ?? {}) as Record<string, unknown>;

  const isOffer = doc.templateType === TEMPLATE_TYPES.financialOffer;
  const isIntake = doc.templateType === TEMPLATE_TYPES.intakeForm;
  const isCollab = COLLAB_FORM_TYPES.has(doc.templateType);
  // Collaborative forms honor the team's builder config (removed/reordered).
  const effectiveTemplate = isCollab ? applyConfig(template, getConfig(content)) : template;

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
    <>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
          {template.description && (
            <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-neutral-600">{DOC_STATUS_LABEL[doc.status] ?? doc.status}</span>
          {doc.status === "DRAFT" && deleteControl}
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
            documentId={doc.id}
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
            {showOfferPricing && <OfferPricingView content={content} />}
          </div>
        )
      ) : null}

      {isOffer && offerQuestions && <OfferQuestionsAdmin questions={offerQuestions} />}

      {!isOffer &&
        (isIntake && doc.status === "DRAFT" ? (
          <IntakeBuilder documentId={doc.id} template={template} initialContent={content as FormContent} />
        ) : (
          <DocumentForm
            documentId={doc.id}
            template={effectiveTemplate}
            initialContent={content}
            readOnly={isReadOnly}
            isTeam
            mode={mode}
          />
        ))}
    </>
  );
}
