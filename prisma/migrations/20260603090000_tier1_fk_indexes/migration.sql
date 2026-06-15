-- Tier 1: Index the foreign-key columns that nearly every query filters on.
-- Postgres does not auto-index FK columns. Names match Prisma's @@index convention
-- (<table>_<column>_idx) so the schema and DB stay consistent.
-- project_stages is intentionally omitted — its (project_id, stage_number) unique
-- index already serves project_id lookups.

CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");
CREATE INDEX "project_assets_project_id_idx" ON "project_assets"("project_id");
CREATE INDEX "material_items_project_id_idx" ON "material_items"("project_id");
CREATE INDEX "cycles_project_id_idx" ON "cycles"("project_id");
CREATE INDEX "approvals_project_id_idx" ON "approvals"("project_id");
CREATE INDEX "approvals_task_id_idx" ON "approvals"("task_id");
CREATE INDEX "app_events_project_id_idx" ON "app_events"("project_id");
CREATE INDEX "activity_log_project_id_idx" ON "activity_log"("project_id");
CREATE INDEX "tasks_cycle_id_idx" ON "tasks"("cycle_id");
