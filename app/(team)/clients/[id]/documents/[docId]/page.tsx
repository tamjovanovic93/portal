import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/registry";
import DeleteDocumentButton from "@/components/team/project/DeleteDocumentButton";
import OnboardingDocView from "@/components/team/project/OnboardingDocView";
import { TEMPLATE_TYPES } from "@/lib/documents/types";

// Team-side editor for CLIENT-scoped onboarding documents (initial form, offer,
// intake) — the client-level counterpart of the project stage document page.
export default async function ClientDocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: clientId, docId: documentId } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal");

  const [client, doc] = await Promise.all([
    prisma.profile.findUnique({ where: { id: clientId }, select: { name: true, email: true, role: true } }),
    prisma.document.findUnique({ where: { id: documentId } }),
  ]);

  if (!client || client.role !== "CLIENT") notFound();
  if (!doc || doc.clientId !== clientId) notFound();

  const template = TEMPLATES[doc.templateType];
  if (!template) notFound();

  const clientName = client.name ?? client.email;
  const isOffer = doc.templateType === TEMPLATE_TYPES.financialOffer;

  // Client questions about the offer (client → team), answerable inline.
  const offerQuestions = isOffer
    ? await prisma.question.findMany({
        where: { contextType: "BRIEF", contextId: documentId },
        orderBy: { createdAt: "asc" },
        select: { id: true, questionText: true, answerText: true, status: true },
      })
    : [];

  // While building the offer, show the client's Initial Form answers for
  // reference (their answers inform the scope/price).
  const initialFormAnswers: { label: string; value: string }[] = [];
  if (isOffer && doc.status === "DRAFT") {
    const initialDoc = await prisma.document.findFirst({
      where: { clientId, templateType: TEMPLATE_TYPES.initialClientForm },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    if (initialDoc) {
      const initContent = (initialDoc.content ?? {}) as Record<string, unknown>;
      const initialTemplate = TEMPLATES[TEMPLATE_TYPES.initialClientForm];
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <nav className="text-xs text-neutral-600 space-x-1.5">
        <Link href="/clients" className="hover:text-neutral-700">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${clientId}`} className="hover:text-neutral-700">{clientName}</Link>
        <span>›</span>
        <span className="text-neutral-600">{doc.title}</span>
      </nav>

      <OnboardingDocView
        doc={doc}
        template={template}
        deleteControl={<DeleteDocumentButton documentId={documentId} clientId={clientId} />}
        initialFormAnswers={initialFormAnswers}
        offerQuestions={offerQuestions}
        showOfferPricing
      />
    </div>
  );
}
