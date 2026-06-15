-- Tier 1: Enforce the implied activity_log.actor_id -> profiles relationship.
-- The column held a profile UUID with no FK. Table is empty so this is safe.
-- ON DELETE SET NULL keeps the audit row if the actor profile is ever removed.

ALTER TABLE "activity_log"
  ADD CONSTRAINT "activity_log_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
