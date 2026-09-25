-- CreateEnum
CREATE TYPE "rural_path_revetement" AS ENUM ('revetu', 'empierre', 'non_revetu');

-- CreateEnum
CREATE TYPE "rural_path_type" AS ENUM ('chemin', 'impasse', 'troncon', 'sentier', 'place', 'rue');

-- CreateEnum
CREATE TYPE "rural_path_servitude" AS ENUM ('interet_communautaire', 'pdipr', 'dfci', 'desserte_forestiere', 'halage', 'passage_longitudinal', 'autre_servitude');

-- CreateEnum
CREATE TYPE "rural_path_bornage" AS ENUM ('total', 'unilateral', 'partiel', 'non_borne');

-- AlterTable: nouveau champ "type" (requis, defaut troncon).
ALTER TABLE "rural_path_segments" ADD COLUMN "type" "rural_path_type" NOT NULL DEFAULT 'troncon';

-- AlterTable: renommage surface -> revetement avec nouvelles valeurs.
-- Conversion : enrobe -> revetu, empierre -> empierre, reste (terre/gravier/herbe) -> non_revetu.
ALTER TABLE "rural_path_segments" ADD COLUMN "revetement" "rural_path_revetement";
UPDATE "rural_path_segments" SET "revetement" = (
  CASE
    WHEN "surface" = 'enrobe' THEN 'revetu'
    WHEN "surface" = 'empierre' THEN 'empierre'
    ELSE 'non_revetu'
  END
)::"rural_path_revetement";
ALTER TABLE "rural_path_segments" ALTER COLUMN "revetement" SET NOT NULL;
ALTER TABLE "rural_path_segments" DROP COLUMN "surface";

-- AlterTable: fusion etat_entretien + etat_conservation -> etat (requis, defaut bon, pas de backfill).
ALTER TABLE "rural_path_segments" DROP COLUMN "etat_entretien";
ALTER TABLE "rural_path_segments" DROP COLUMN "etat_conservation";
DROP TYPE "rural_path_etat";
CREATE TYPE "rural_path_etat" AS ENUM ('en_projet', 'en_construction', 'bon', 'moyen', 'mauvais', 'tres_mauvais');
ALTER TABLE "rural_path_segments" ADD COLUMN "etat" "rural_path_etat" NOT NULL DEFAULT 'bon';

-- AlterTable: nouveaux attributs facultatifs.
ALTER TABLE "rural_path_segments" ADD COLUMN "ferme_a_la_circulation" BOOLEAN;
ALTER TABLE "rural_path_segments" ADD COLUMN "servitudes" "rural_path_servitude"[] NOT NULL DEFAULT ARRAY[]::"rural_path_servitude"[];
ALTER TABLE "rural_path_segments" ADD COLUMN "bornage" "rural_path_bornage";

-- AlterTable: suppression de domanialite.
ALTER TABLE "rural_path_segments" DROP COLUMN "domanialite";
DROP TYPE "rural_path_domanialite";

-- DropEnum
DROP TYPE "rural_path_surface";
