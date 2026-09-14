-- suggested_projects was added after supabase/setup.sql was written, so it was
-- the one public table left without row-level security. Not currently
-- reachable (PostgREST grants no data privileges on it), but every other table
-- is protected and a future GRANT would otherwise expose it.
-- Same shape as the other client-scoped tables: team sees all, client reads own.
ALTER TABLE "suggested_projects" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team all" ON "suggested_projects";
CREATE POLICY "Team all" ON "suggested_projects" FOR ALL USING (is_team());

DROP POLICY IF EXISTS "Client read own" ON "suggested_projects";
CREATE POLICY "Client read own" ON "suggested_projects" FOR SELECT USING (client_id = auth.uid());
