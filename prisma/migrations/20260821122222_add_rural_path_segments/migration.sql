/*
  Warnings:

  - You are about to drop the column `path` on the `rural_paths` table. All the data in the column will be lost.
  - You are about to drop the column `path_geom` on the `rural_paths` table. All the data in the column will be lost.
  - You are about to drop the column `surfaces` on the `rural_paths` table. All the data in the column will be lost.
  - Added the required column `classement` to the `rural_paths` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numero` to the `rural_paths` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "rural_path_classement" AS ENUM ('chemin_rural', 'voie_communale', 'chemin_d_exploitation', 'voie_communautaire');

-- CreateEnum
CREATE TYPE "rural_path_etat" AS ENUM ('excellent', 'bon', 'moyen', 'mauvais');

-- CreateEnum
CREATE TYPE "rural_path_domanialite" AS ENUM ('indetermine', 'prive', 'prive_ouvert_a_la_circulation', 'public');

-- DropIndex
DROP INDEX "rural_paths_path_geom_idx";

-- Le trigger/fonction historiques référencent la colonne "path" qu'on s'apprête
-- à supprimer, il faut les retirer avant l'ALTER TABLE.
DROP TRIGGER IF EXISTS rural_paths_sync_path_geom ON "rural_paths";
DROP FUNCTION IF EXISTS rural_paths_sync_path_geom();

-- AlterTable
-- classement/numero sont NOT NULL sans défaut applicatif : on backfille les lignes
-- existantes (dev) avec une valeur transitoire puis on retire le DEFAULT.
ALTER TABLE "rural_paths" DROP COLUMN "path",
DROP COLUMN "path_geom",
DROP COLUMN "surfaces",
ADD COLUMN     "classement" "rural_path_classement" NOT NULL DEFAULT 'chemin_rural',
ADD COLUMN     "commentaire" TEXT,
ADD COLUMN     "numero" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "rural_paths" ALTER COLUMN "classement" DROP DEFAULT,
ALTER COLUMN "numero" DROP DEFAULT;

-- CreateTable
CREATE TABLE "rural_path_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rural_path_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL,
    "path" JSONB NOT NULL,
    "path_geom" geometry(LineString, 4326),
    "surface" "rural_path_surface" NOT NULL,
    "largeur_moyenne" INTEGER,
    "etat_entretien" "rural_path_etat",
    "etat_conservation" "rural_path_etat",
    "domanialite" "rural_path_domanialite",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rural_path_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rural_path_segments_deleted_at_idx" ON "rural_path_segments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "rural_path_segments_rural_path_id_ordre_key" ON "rural_path_segments"("rural_path_id", "ordre");

-- AddForeignKey
ALTER TABLE "rural_path_segments" ADD CONSTRAINT "rural_path_segments_rural_path_id_fkey" FOREIGN KEY ("rural_path_id") REFERENCES "rural_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Colonne géométrie PostGIS dérivée de path (JSONB), maintenue par trigger
-- (ST_GeomFromGeoJSON n'est pas IMMUTABLE, pas de GENERATED column possible).
CREATE OR REPLACE FUNCTION rural_path_segments_sync_path_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.path_geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.path::text), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rural_path_segments_sync_path_geom
BEFORE INSERT OR UPDATE OF "path" ON "rural_path_segments"
FOR EACH ROW EXECUTE FUNCTION rural_path_segments_sync_path_geom();

CREATE INDEX "rural_path_segments_path_geom_idx" ON "rural_path_segments" USING GIST ("path_geom");

-- Trigger updated_at (même pattern que rural_paths / commune_settings)
CREATE OR REPLACE FUNCTION rural_path_segments_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rural_path_segments_updated_at
BEFORE UPDATE ON "rural_path_segments"
FOR EACH ROW EXECUTE FUNCTION rural_path_segments_touch_updated_at();
