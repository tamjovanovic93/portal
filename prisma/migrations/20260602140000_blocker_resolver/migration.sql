-- Who needs to clear a blocker
ALTER TABLE "tasks" ADD COLUMN "blocker_resolver" "TaskOwnerRole";
