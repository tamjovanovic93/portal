-- Undo 20260914130000_p7_drop_legacy_project_columns.
--
-- That migration was applied while production still ran the previous release,
-- whose Prisma client selects these columns on every Project query. Dropping
-- them broke production with `column "health" does not exist`.
--
-- Columns are cheap; an outage is not. They come back now and are dropped
-- again only once the release that stopped reading them is live in production
-- (expand -> deploy -> contract).
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'NEEDS_ATTENTION', 'AT_RISK');

ALTER TABLE "projects"
  ADD COLUMN "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK',
  ADD COLUMN "brief_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "onboarding_step" TEXT;
