-- Staged onboarding flow (Initial Form → Offer → Intake → Brief) + in-app notifications.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "brief_published_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_step" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "handled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "recipient_id" UUID,
    "recipient_role" "UserRole",
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_role_idx" ON "notifications"("recipient_role");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security. All app reads/writes go through Prisma (direct connection,
-- bypasses RLS); these policies protect the table on the Supabase PostgREST API,
-- matching the posture set in 20260602180000_tier1_rls_missing_tables.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- Team members see and manage every notification (team-targeted rows carry
-- recipient_role = 'TEAM').
CREATE POLICY "Team all" ON "notifications"
  FOR ALL TO public
  USING (is_team());

-- Clients may only read notifications addressed to them.
CREATE POLICY "Client read own" ON "notifications"
  FOR SELECT TO public
  USING (recipient_id = auth.uid());
