"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOffer, createIntakeForm } from "@/app/actions/onboarding";

type DocState = { id: string; status: string } | null;

export default function OnboardingPipeline({
  projectId,
  initialForm,
  offer,
  intake,
}: {
  projectId: string;
  initialForm: DocState;
  offer: DocState;
  intake: DocState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const docLink = (docId: string) => `/projects/${projectId}/stage/1/documents/${docId}`;

  const initialDone = initialForm?.status === "APPROVED";
  const offerDone = offer?.status === "APPROVED";
  const intakeDone = intake?.status === "APPROVED";

  function handleCreateOffer() {
    startTransition(async () => {
      const res = await createOffer(projectId);
      if (res.id) router.push(docLink(res.id));
    });
  }

  function handleCreateIntake() {
    startTransition(async () => {
      const res = await createIntakeForm(projectId);
      if (res.id) router.push(docLink(res.id));
    });
  }

  return (
    <ol className="space-y-2">
      {/* Step 1 — Initial Client Form */}
      <Step n={1} title="Initial Client Form" done={initialDone}>
        {!initialForm ? (
          <span className="text-xs text-neutral-500">Not created.</span>
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
      </Step>

      {/* Step 2 — Project / Financial Offer */}
      <Step n={2} title="Project / Financial Offer" done={offerDone} disabled={!initialDone}>
        {!initialDone ? (
          <span className="text-xs text-neutral-400">Complete the Initial Form first.</span>
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
      </Step>

      {/* Step 3 — Full intake form */}
      <Step n={3} title="Full Intake Form" done={intakeDone} disabled={!offerDone}>
        {!offerDone ? (
          <span className="text-xs text-neutral-400">Available after the offer is approved.</span>
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
      </Step>
      {intakeDone && (
        <p className="text-xs text-neutral-500 pl-8">
          Intake complete — run the brief &amp; strategy pipeline below.
        </p>
      )}

      <style jsx>{`
        .btn-mini {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 6px;
          background: #171717;
          color: #fff;
        }
        .chip {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .chip-amber {
          background: #fef3c7;
          color: #92400e;
        }
        .chip-green {
          background: #dcfce7;
          color: #166534;
        }
      `}</style>
    </ol>
  );
}

function Step({
  n,
  title,
  done,
  disabled,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex items-start gap-3 ${disabled ? "opacity-60" : ""}`}>
      <span
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
          done ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <div className="flex items-center gap-2 mt-1">{children}</div>
      </div>
    </li>
  );
}
