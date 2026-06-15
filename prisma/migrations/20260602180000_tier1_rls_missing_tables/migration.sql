-- Tier 1: Add RLS to activity_log and app_events
-- Both were missing RLS entirely — any authenticated user could read/write all rows.

-- activity_log: internal team audit trail, clients never see it
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team all" ON "activity_log"
  FOR ALL TO public
  USING (is_team());

-- Allow inserts from service role (used by server-side actions via service key)
-- The USING clause on INSERT is the WITH CHECK. Team inserts pass is_team().
-- Service role bypasses RLS by default in Supabase.

-- app_events: team calendar, clients have no calendar view
ALTER TABLE "app_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team all" ON "app_events"
  FOR ALL TO public
  USING (is_team());
