-- Task status lifecycle: rename existing values, add the internal-approval step
ALTER TYPE "TaskStatus" RENAME VALUE 'BRIEF' TO 'PLANNING';
ALTER TYPE "TaskStatus" RENAME VALUE 'REVIEW' TO 'WAITING_FINAL_APPROVAL';
ALTER TYPE "TaskStatus" ADD VALUE 'NEEDS_APPROVAL' BEFORE 'IN_PROGRESS';

-- Task owner role
CREATE TYPE "TaskOwnerRole" AS ENUM ('PROJECT_MANAGER', 'DEV_TEAM', 'DESIGN_TEAM', 'CLIENT');

-- New task fields
ALTER TABLE "tasks" ADD COLUMN "owner_role" "TaskOwnerRole";
ALTER TABLE "tasks" ADD COLUMN "is_blocker" BOOLEAN NOT NULL DEFAULT false;

-- Cycle focus / "what needs to happen"
ALTER TABLE "cycles" ADD COLUMN "focus" TEXT;
