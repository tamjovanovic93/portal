import { NextRequest, NextResponse } from "next/server";
import { sweepJobs } from "@/lib/ai/jobs";

// Vercel Cron target (vercel.json). Vercel sends `Authorization: Bearer
// $CRON_SECRET` automatically when the env var is set.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
  const result = await sweepJobs(origin);
  return NextResponse.json(result);
}
