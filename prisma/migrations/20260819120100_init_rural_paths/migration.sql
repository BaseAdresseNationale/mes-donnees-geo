-- Extension PostGIS (nécessaire pour le type geometry et l'index GIST)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enums métier
CREATE TYPE "rural_path_status" AS ENUM ('draft', 'published', 'certified');
CREATE TYPE "rural_path_surface" AS ENUM ('terre', 'gravier', 'enrobe', 'empierre', 'herbe');

-- Table principale
CREATE TABLE "rural_paths" (
    "id"         UUID                  NOT NULL DEFAULT gen_random_uuid(),
    "code_insee" VARCHAR(5)            NOT NULL,
    "statut"     "rural_path_status"   NOT NULL DEFAULT 'draft',
    "nom"        TEXT,
    "path"       JSONB,
    "surfaces"   "rural_path_surface"[] NOT NULL DEFAULT ARRAY[]::"rural_path_surface"[],
    "created_at" TIMESTAMPTZ(6)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rural_paths_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rural_paths_code_insee_format"
      CHECK ("code_insee" ~ '^(?:2[AB]\d{3}|\d{5})$'),
    -- Cohérence : 1 revêtement par LineString du MultiLineString
    CONSTRAINT "rural_paths_surfaces_match_segments"
      CHECK (
        "path" IS NULL
        OR jsonb_array_length("path"->'coordinates') = COALESCE(array_length("surfaces", 1), 0)
      )
);

CREATE INDEX "rural_paths_code_insee_idx" ON "rural_paths" ("code_insee");
CREATE INDEX "rural_paths_deleted_at_idx" ON "rural_paths" ("deleted_at");

-- Colonne géométrie PostGIS : ST_GeomFromGeoJSON n'étant pas IMMUTABLE, on
-- ne peut pas utiliser une GENERATED colonne. On la maintient via trigger.
ALTER TABLE "rural_paths" ADD COLUMN "path_geom" geometry(MultiLineString, 4326);

CREATE OR REPLACE FUNCTION rural_paths_sync_path_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.path IS NULL THEN
    NEW.path_geom := NULL;
  ELSE
    NEW.path_geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.path::text), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rural_paths_sync_path_geom
BEFORE INSERT OR UPDATE OF "path" ON "rural_paths"
FOR EACH ROW EXECUTE FUNCTION rural_paths_sync_path_geom();

CREATE INDEX "rural_paths_path_geom_idx" ON "rural_paths" USING GIST ("path_geom");

-- Trigger updated_at (même pattern que commune_settings)
CREATE OR REPLACE FUNCTION rural_paths_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rural_paths_updated_at
BEFORE UPDATE ON "rural_paths"
FOR EACH ROW EXECUTE FUNCTION rural_paths_touch_updated_at();
