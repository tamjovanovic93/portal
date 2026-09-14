-- Phase 7: columns that no code reads or writes any more.
ALTER TABLE "projects" DROP COLUMN "health", DROP COLUMN "brief_reviewed_at", DROP COLUMN "onboarding_step";
DROP TYPE "ProjectHealth";
