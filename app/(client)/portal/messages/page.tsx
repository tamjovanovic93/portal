import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import AnswerQuestions, { type ClientQuestion } from "@/components/client/AnswerQuestions";
import AskQuestionForm from "@/components/client/AskQuestionForm";
import SectionHeading from "@/components/ui/SectionHeading";
import { Pill } from "@/components/ui/kit";
import { WAITING_CLIENT_STATUSES } from "@/lib/questions";
import { formatWhen } from "@/lib/format";

export default async function ClientMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");
  const { project: projectParam } = await searchParams;

  const [projects, waiting, history] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: profile.id, isArchived: false },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.question.findMany({
      where: { recipientId: profile.id, status: { in: WAITING_CLIENT_STATUSES } },
      select: {
        id: true, kind: true, questionText: true, proposedAnswer: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Both directions: questions the team asked this client, and questions the
    // client asked the team.
    prisma.question.findMany({
      where: {
        OR: [{ recipientId: profile.id }, { askedById: profile.id }],
        status: { notIn: WAITING_CLIENT_STATUSES },
      },
      select: {
        id: true, questionText: true, answerText: true, status: true,
        askedById: true, createdAt: true, answeredAt: true,
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const waitingQuestions: ClientQuestion[] = waiting.map((q) => ({
    id: q.id,
    kind: q.kind,
    questionText: q.questionText,
    proposedAnswer: q.proposedAnswer,
    projectName: q.project?.name ?? "Your project",
  }));

  const validProject = projects.find((p) => p.id === projectParam)?.id;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <h1 className="page-title text-ink" style={{ fontSize: 30 }}>Messages</h1>
        <p className="text-sm text-ink-3 mt-2">
          Questions between you and your Zero Point team.
        </p>
      </div>

      <AskQuestionForm projects={projects} defaultProjectId={validProject} />

      <AnswerQuestions questions={waitingQuestions} />

      {history.length > 0 && (
        <section>
          <SectionHeading>History</SectionHeading>
          <div className="space-y-3">
            {history.map((q) => {
              const fromClient = q.askedById === profile.id;
              return (
                <div key={q.id} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow">
                      {fromClient ? "You asked" : "Your team asked"}
                      {q.project?.name ? ` · ${q.project.name}` : ""}
                    </span>
                    <Pill color={q.answerText ? "mint" : "amber"}>
                      {q.answerText ? "Answered" : "Open"}
                    </Pill>
                  </div>
                  <p className="text-sm text-ink">{q.questionText}</p>
                  {q.answerText ? (
                    <div className="pt-2 border-t border-line">
                      <p className="text-sm text-ink-2">{q.answerText}</p>
                      {q.answeredAt && (
                        <p className="text-xs text-ink-3 mt-1">{formatWhen(q.answeredAt.toISOString())}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-3">Waiting on your team.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
