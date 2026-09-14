"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientInitialForm, createClientOffer, createClientIntakeForm } from "@/app/actions/onboarding";
import PipelineStep from "@/components/team/PipelineStep";

// Client-level onboarding: Initial Client Form → Offer → Full Intake Form.
// All documents are client-scoped (no project required). Mirrors the old
// project OnboardingPipeline but keyed by clientId.
type DocState = { id: string; status: string } | null;

export default function ClientOnboardingPipeline({
  clientId,
  initialForm,
  offer,
  intake,
}: {
  clientId: string;
  initialForm: DocState;
  offer: DocState;
  intake: DocState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const docLink = (docId: string) => `/clients/${clientId}/documents/${docId}`;

  const initialDone = initialForm?.status === "APPROVED";
  const offerDone = offer?.status === "APPROVED";
  const intakeDone = intake?.status === "APPROVED";

  function handleCreateInitial() {
    startTransition(async () => {
      const res = await createClientInitialForm(clientId);
      if (res.id) router.push(docLink(res.id));
    });
  }

  function handleCreateOffer() {
    startTransition(async () => {
      const res = await createClientOffer(clientId);
      if (res.id) router.push(docLink(res.id));
    });
  }

  function handleCreateIntake() {
    startTransition(async () => {
      const res = await createClientIntakeForm(clientId);
      if (res.id) router.push(docLink(res.id));
    });
  }

  return (
    <ol className="space-y-2">
      <PipelineStep n={1} title="Initial Client Form" done={initialDone}>
        {!initialForm ? (
          <button onClick={handleCreateInitial} disabled={isPending} className="btn-mini">
            {isPending ? "Creating…" : "Create form →"}
          </button>
        ) : initialForm.status === "DRAFT" ? (
          <Link href={docLink(initialForm.id)} className="btn-mini">
            Pre-fill &amp; send →
          </Link>
        ) : initialForm.status === "SENT" ? (
          <span className="chip chip-amber">Sent — waiting on client</span>
        ) : (
          <Link href={docLink(initialForm.id)} className="btn-mini">
            Review client answers →
          </Link>
        )}
      </PipelineStep>

      <PipelineStep n={2} title="Project / Financial Offer" done={offerDone} disabled={!initialDone}>
        {!initialDone ? (
          <span className="text-xs text-ink-4">Complete the Initial Form first.</span>
        ) : !offer ? (
          <button onClick={handleCreateOffer} disabled={isPending} className="btn-mini">
            {isPending ? "Creating…" : "Create offer →"}
          </button>
        ) : offer.status === "DRAFT" ? (
          <Link href={docLink(offer.id)} className="btn-mini">
            Edit &amp; send offer →
          </Link>
        ) : offer.status === "SENT" ? (
          <span className="chip chip-amber">Sent — waiting on client approval</span>
        ) : (
          <span className="chip chip-green">Approved ✓</span>
        )}
      </PipelineStep>

      <PipelineStep n={3} title="Full Intake Form" done={intakeDone} disabled={!offerDone}>
        {!offerDone ? (
          <span className="text-xs text-ink-4">Available after the offer is approved.</span>
        ) : !intake ? (
          <button onClick={handleCreateIntake} disabled={isPending} className="btn-mini">
            {isPending ? "Creating…" : "Configure & send intake →"}
          </button>
        ) : intake.status === "DRAFT" ? (
          <Link href={docLink(intake.id)} className="btn-mini">
            Configure &amp; send intake →
          </Link>
        ) : intake.status === "SENT" ? (
          <span className="chip chip-amber">Sent — waiting on client</span>
        ) : (
          <Link href={docLink(intake.id)} className="btn-mini">
            Review intake answers →
          </Link>
        )}
      </PipelineStep>
      {intakeDone && (
        <p className="text-xs text-ink-3 pl-8">
          Intake complete — run the Client Data pipeline below.
        </p>
      )}
    </ol>
  );
}

