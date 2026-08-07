-- CreateEnum
CREATE TYPE "basemap_kind" AS ENUM ('openmaptiles', 'ortho', 'ign');

-- CreateTable
CREATE TABLE "commune_settings" (
    "code_insee" VARCHAR(5) NOT NULL,
    "disabled_plugins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "basemap" "basemap_kind" NOT NULL DEFAULT 'ortho',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commune_settings_pkey" PRIMARY KEY ("code_insee"),
    CONSTRAINT "commune_settings_code_insee_format"
      CHECK ("code_insee" ~ '^(?:2[AB]\d{3}|\d{5})$')
);

-- Trigger de mise à jour de updated_at (non exprimable via schema.prisma)
CREATE OR REPLACE FUNCTION commune_settings_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commune_settings_updated_at
BEFORE UPDATE ON "commune_settings"
FOR EACH ROW EXECUTE FUNCTION commune_settings_touch_updated_at();
