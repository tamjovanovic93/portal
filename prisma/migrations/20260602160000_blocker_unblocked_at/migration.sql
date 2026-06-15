-- When a blocker was cleared
ALTER TABLE "tasks" ADD COLUMN "unblocked_at" TIMESTAMP(3);
