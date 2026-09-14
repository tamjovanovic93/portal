-- Phase 5: background AI jobs. Actions enqueue a row and return; /api/ai/run
-- executes it under the route's maxDuration; /api/ai/sweep re-dispatches
-- stale rows. See lib/ai/jobs.ts.
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "result" JSONB,
    "created_by" UUID,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_jobs_status_created_at_idx" ON "ai_jobs"("status", "created_at");
CREATE INDEX "ai_jobs_target_id_type_idx" ON "ai_jobs"("target_id", "type");

ALTER TABLE "ai_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team all" ON "ai_jobs" FOR ALL TO public USING (is_team());
