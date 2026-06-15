-- Client intake reworked into a two-agent JSON pipeline. The 27 relational
-- client-data tables are replaced by three JSON Document rows per project
-- (client_profile / verification_queue / strategy). Drop the old tables and
-- their dependent RLS policies (CASCADE).

DROP TABLE IF EXISTS
  "company","services","contacts","company_stats","competitors","goals",
  "budget","pricing_modifiers","verification_queue","client_specific_data",
  "persona_groups","personas","pain_points","needs","benefits","objections",
  "key_messages","slogans","brand_voice_observations","strategic_objectives",
  "initiatives","cross_cutting_initiatives","cross_cutting_deployments",
  "key_results","cross_cutting_krs","funnel_stages","calendar_entries","risks"
CASCADE;

DROP TYPE IF EXISTS "VerificationStatus";
