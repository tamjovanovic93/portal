-- Tier 1: Convert material_items.status from free-text to a proper enum.
-- Existing values (pending | submitted | received | verified) are all valid members,
-- so the USING cast is lossless.

CREATE TYPE "MaterialItemStatus" AS ENUM ('pending', 'submitted', 'received', 'verified');

ALTER TABLE "material_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "material_items"
  ALTER COLUMN "status" TYPE "MaterialItemStatus" USING ("status"::"MaterialItemStatus");
ALTER TABLE "material_items" ALTER COLUMN "status" SET DEFAULT 'pending';
