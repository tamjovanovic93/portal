import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DocumentForm from "@/components/DocumentForm";
import OfferApprove from "@/components/client/OfferApprove";
import OfferPricingView from "@/components/OfferPricingView";
import AnswerFollowups, { type Followup } from "@/components/client/AnswerFollowups";
import { getCollab, type FormContent } from "@/lib/forms/collab";
import { applyConfig, getConfig } from "@/lib/templates/config";

// Forms that use the collaborative approve/change flow rather than a plain fill.
const COLLAB_FORMS = new Set(["initial_client_form", "intake_form"]);

export default async function ClientDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) redirect("/login");

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { project: { select: { clientId: true } } },
  });

  if (!doc) notFound();
  // A document belongs to the client directly (client-scoped onboarding) or via
  // its project (legacy). Either way it must belong to the signed-in client.
  const ownerId = doc.clientId ?? doc.project?.clientId ?? null;
  if (ownerId !== profile.id) notFound();

  if (doc.status === "DRAFT") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-500 text-sm">
          This document isn&apos;t ready for you yet. Your team will share it when it&apos;s ready.
        </p>
        <Link href="/portal" className="mt-6 inline-block text-sm text-neutral-900 underline underline-offset-2">
          Back to portal
        </Link>
      </div>
    );
  }

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  const content = (doc.content ?? {}) as FormContent;

  const backLink = (
    <Link href="/portal" className="text-xs text-neutral-600 hover:text-neutral-700 transition-colors">
      ← Back to portal
    </Link>
  );
  const header = (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
      {template.description && (
        <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
      )}
    </div>
  );

  // ── Financial offer: read-only display + accept / additional questions ──
  if (doc.templateType === "financial_offer") {
    const offerQuestions = await prisma.question.findMany({
      where: { contextType: "BRIEF", contextId: doc.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, questionText: true, answerText: true },
    });
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {backLink}
        {header}
        <div className="border border-neutral-200 rounded-lg bg-white px-6 py-6 space-y-4">
          {template.sections[0].fields.map((field) => (
            <div key={field.key}>
              <p className="text-xs text-neutral-500">{field.label}</p>
              <p className="text-sm text-neutral-900 whitespace-pre-wrap">
                {(content[field.key] as string) || "—"}
              </p>
            </div>
          ))}
          <OfferPricingView content={content as Record<string, unknown>} />
        </div>
        <OfferApprove
          documentId={doc.id}
          approved={doc.status === "APPROVED"}
          questions={offerQuestions}
        />
      </div>
    );
  }

  // ── Collaborative / plain forms ──
  const isCollab = COLLAB_FORMS.has(doc.templateType);
  const isIntake = doc.templateType === "intake_form";
  // Honor the team's builder config (removed / reordered sections & fields).
  const effectiveTemplate = isCollab ? applyConfig(template, getConfig(content)) : template;

  // ── Completed collaborative form — focus on what's next, not the old answers ──
  if (isCollab && (doc.status === "APPROVED" || doc.status === "REJECTED")) {
    const followups = computeFollowups(effectiveTemplate, content);

    if (followups.length === 0) {
      return (
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
          {backLink}
          {header}
          <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            {isIntake ? (
              <>
                <h3 className="text-lg font-semibold text-green-900">
                  Thank you — your intake form has been submitted.
                </h3>
                <p className="text-sm text-green-800 max-w-md mx-auto">
                  Our team is reviewing your answers and preparing the next stage of your project.
                  You&apos;ll be notified here when your Project Brief is ready for review.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-green-900">This form is complete.</h3>
                <p className="text-sm text-green-800 max-w-md mx-auto">
                  Thanks — your team has what they need for now and will be in touch with the next step.
                </p>
              </>
            )}
          </div>
        </div>
      );
    }

    // Open follow-ups need a response — show those, with answers tucked away.
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {backLink}
        {header}
        <AnswerFollowups documentId={doc.id} followups={followups} />
        <details className="group">
          <summary className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900 select-none">
            View your submitted answers
          </summary>
          <div className="mt-4">
            <DocumentForm
              documentId={doc.id}
              template={effectiveTemplate}
              initialContent={content}
              readOnly
              isTeam={false}
              mode="fill"
            />
          </div>
        </details>
      </div>
    );
  }

  // ── Active fill (SENT) or non-collaborative forms ──
  const mode = doc.status === "SENT" ? (isCollab ? "respond" : "fill") : "fill";
  const readOnly = doc.status === "APPROVED" || doc.status === "REJECTED";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {backLink}
      {header}
      {readOnly && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-block">
          You&apos;ve already submitted this form.
        </p>
      )}
      <DocumentForm
        documentId={doc.id}
        template={effectiveTemplate}
        initialContent={content}
        readOnly={readOnly}
        isTeam={false}
        mode={mode}
        stepped={isIntake && mode === "respond"}
      />
    </div>
  );
}

// Build the list of open team edits/questions the client still needs to act on.
function computeFollowups(
  template: (typeof TEMPLATES)[string],
  content: FormContent
): Followup[] {
  const collab = getCollab(content);
  const out: Followup[] = [];
  for (const section of template.sections) {
    for (const field of section.fields) {
      const c = collab[field.key];
      if (!c) continue;
      if (c.edit?.status === "pending") {
        out.push({ fieldKey: field.key, label: field.label, kind: "edit", value: String(c.edit.value ?? "") });
      }
      if (c.question?.status === "open") {
        out.push({ fieldKey: field.key, label: field.label, kind: "question", question: c.question.text });
      }
    }
  }
  return out;
}
