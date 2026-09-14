-- Phase 3: indexes for the query patterns every page runs.
CREATE INDEX IF NOT EXISTS "documents_client_id_template_type_idx" ON "documents"("client_id", "template_type");
CREATE INDEX IF NOT EXISTS "documents_project_id_template_type_idx" ON "documents"("project_id", "template_type");
CREATE INDEX IF NOT EXISTS "documents_status_completed_at_idx" ON "documents"("status", "completed_at");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks"("due_date");
CREATE INDEX IF NOT EXISTS "tasks_stage_number_idx" ON "tasks"("stage_number");
CREATE INDEX IF NOT EXISTS "tasks_source_brief_id_idx" ON "tasks"("source_brief_id");
CREATE INDEX IF NOT EXISTS "material_items_status_due_date_idx" ON "material_items"("status", "due_date");
CREATE INDEX IF NOT EXISTS "notifications_recipient_role_read_at_idx" ON "notifications"("recipient_role", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");
CREATE INDEX IF NOT EXISTS "projects_is_archived_idx" ON "projects"("is_archived");
CREATE INDEX IF NOT EXISTS "app_events_start_at_idx" ON "app_events"("start_at");
