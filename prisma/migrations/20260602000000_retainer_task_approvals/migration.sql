-- Approval: allow task-scoped approvals (stage optional, add task_id)
ALTER TABLE "approvals" ALTER COLUMN "stage_number" DROP NOT NULL;
ALTER TABLE "approvals" ADD COLUMN "task_id" UUID;

-- Task: deliverable client-approval flag
ALTER TABLE "tasks" ADD COLUMN "requires_client_approval" BOOLEAN NOT NULL DEFAULT false;

-- FK: approvals.task_id -> tasks.id
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
