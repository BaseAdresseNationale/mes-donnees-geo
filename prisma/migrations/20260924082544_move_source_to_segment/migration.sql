/*
  Warnings:

  - Les colonnes `source`/`source_ref` sont déplacées de `rural_paths` vers `rural_path_segments`.
    Les valeurs existantes sont recopiées sur les segments avant suppression sur le chemin
    (à ce stade chaque chemin importé n'a qu'un segment, cf. import historique).

*/
-- DropIndex
DROP INDEX "rural_paths_code_insee_source_source_ref_idx";

-- AlterTable
ALTER TABLE "rural_path_segments" ADD COLUMN     "source" "rural_path_source" NOT NULL DEFAULT 'manuel',
ADD COLUMN     "source_ref" TEXT;

-- Backfill : recopie la source du chemin sur ses segments avant de la supprimer côté chemin.
UPDATE "rural_path_segments" AS s
SET "source" = p."source",
    "source_ref" = p."source_ref"
FROM "rural_paths" AS p
WHERE s."rural_path_id" = p."id";

-- AlterTable
ALTER TABLE "rural_paths" DROP COLUMN "source",
DROP COLUMN "source_ref";

-- CreateIndex
CREATE INDEX "rural_path_segments_source_source_ref_idx" ON "rural_path_segments"("source", "source_ref");
