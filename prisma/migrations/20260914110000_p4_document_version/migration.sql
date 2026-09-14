-- Phase 4: optimistic locking for JSON documents. Every content write does
-- UPDATE ... WHERE id = $1 AND version = $2, so concurrent editors never
-- silently overwrite each other (lib/documents/mutate.ts).
ALTER TABLE "documents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
