-- Phase 1: connected PM system foundation.
-- Team-member profile fields, Scope→Task linkage, sitemap→visual linkage, and
-- the generalized Question model.

-- CreateEnum
CREATE TYPE "QuestionContext" AS ENUM ('PROJECT', 'TASK', 'BRIEF', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('ANSWER', 'CONFIRM');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'WAITING_CLIENT', 'WAITING_TEAM', 'WAITING_CONFIRMATION', 'ANSWERED', 'RESOLVED');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "accent" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availability" JSONB,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sort_order" INTEGER,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "project_assets" ADD COLUMN     "sitemap_page_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "scope_item_id" TEXT,
ADD COLUMN     "source_brief_id" UUID,
ADD COLUMN     "start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "context_type" "QuestionContext" NOT NULL,
    "context_id" TEXT,
    "kind" "QuestionKind" NOT NULL DEFAULT 'ANSWER',
    "asked_by_id" UUID,
    "recipient_id" UUID,
    "recipient_role" "UserRole",
    "question_text" TEXT NOT NULL,
    "proposed_answer" TEXT,
    "answer_text" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_project_id_status_idx" ON "questions"("project_id", "status");

-- CreateIndex
CREATE INDEX "questions_recipient_id_status_idx" ON "questions"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "questions_context_type_context_id_idx" ON "questions"("context_type", "context_id");

-- CreateIndex
CREATE INDEX "questions_recipient_role_status_idx" ON "questions"("recipient_role", "status");

-- CreateIndex
CREATE INDEX "project_assets_sitemap_page_id_idx" ON "project_assets"("sitemap_page_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_scope_item_id_idx" ON "tasks"("scope_item_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_asked_by_id_fkey" FOREIGN KEY ("asked_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security for questions. App reads/writes go through Prisma (direct
-- connection, bypasses RLS); these policies protect the table on the Supabase
-- PostgREST API, matching 20260602180000_tier1_rls_missing_tables and notifications.
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;

-- Team members see and manage every question.
CREATE POLICY "Team all" ON "questions"
  FOR ALL TO public
  USING (is_team());

-- Clients may read questions addressed to them.
CREATE POLICY "Client read own" ON "questions"
  FOR SELECT TO public
  USING (recipient_id = auth.uid());

-- Clients may answer questions addressed to them (answer_text / status updated
-- server-side via Prisma, but keep parity with the read policy for the API).
CREATE POLICY "Client update own" ON "questions"
  FOR UPDATE TO public
  USING (recipient_id = auth.uid());
