-- CommuneSettings hérite désormais de "base_entity" :
--   id (UUID v4, PK), created_at, updated_at (déjà présents), deleted_at (nullable)
-- code_insee reste unique et conserve son CHECK format.

ALTER TABLE "commune_settings" DROP CONSTRAINT "commune_settings_pkey";

ALTER TABLE "commune_settings"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "commune_settings" ADD CONSTRAINT "commune_settings_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "commune_settings_code_insee_key" ON "commune_settings" ("code_insee");
