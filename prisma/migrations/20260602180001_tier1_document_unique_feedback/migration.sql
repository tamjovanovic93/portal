-- Tier 1: Prevent duplicate feedback documents per project
-- wireframe_feedback and design_feedback must be unique per project.
-- Both are created by the client review pages and caused a race-condition duplicate.
-- A partial unique index (not a full unique constraint) so other template types
-- can still have multiple docs per project where that's intentional.

CREATE UNIQUE INDEX "documents_project_feedback_unique"
  ON "documents" ("project_id", "template_type")
  WHERE "template_type" IN ('wireframe_feedback', 'design_feedback');
