-- local_paths : date d'affectation (obligatoire, défaut = date du jour)
ALTER TABLE "local_paths" ADD COLUMN "date_d_affectation" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- local_path_segments : bornage -> delimitation
CREATE TYPE "local_path_delimitation" AS ENUM ('indetermine', 'bornage', 'alignement_individuel', 'plan_d_alignement', 'plan_parcellaire', 'aucune');

ALTER TABLE "local_path_segments" ADD COLUMN "delimitation" "local_path_delimitation";

UPDATE "local_path_segments"
SET "delimitation" = (CASE "bornage"::text
  WHEN 'non_borne' THEN 'aucune'
  ELSE 'bornage'
END)::"local_path_delimitation"
WHERE "bornage" IS NOT NULL;

ALTER TABLE "local_path_segments" DROP COLUMN "bornage";

DROP TYPE "local_path_bornage";
