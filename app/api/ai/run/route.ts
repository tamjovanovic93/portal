import { NextRequest, NextResponse, after } from "next/server";
import { claimJob, executeJob } from "@/lib/ai/jobs";
import { getSecret } from "@/lib/secrets";

// Executes one queued AI job. Called server-to-server (lib/ai/jobs dispatchJob)
// with the shared secret; responds 202 immediately and runs the job in after(),
// which lives for this route's maxDuration (raise on Vercel Pro if needed).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = await getSecret("AI_JOB_SECRET");
  if (!secret || req.headers.get("x-ai-job-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobId: string | undefined;
  try {
    ({ jobId } = (await req.json()) as { jobId?: string });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const claimed = await claimJob(jobId);
  if (!claimed) return NextResponse.json({ ok: true, claimed: false }, { status: 200 });

  after(() => executeJob(jobId!));
  return NextResponse.json({ ok: true, claimed: true }, { status: 202 });
}
