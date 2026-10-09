-- local_paths.statut : DRAFT/PUBLISHED/CERTIFIED -> A_QUALIFIER/QUALIFIEE
-- Les voies brouillon issues d'un import BD TOPO restent à qualifier, tout le reste est qualifié.
CREATE TYPE "local_path_status_new" AS ENUM ('a_qualifier', 'qualifiee');

ALTER TABLE "local_paths" ADD COLUMN "statut_new" "local_path_status_new" NOT NULL DEFAULT 'qualifiee';

UPDATE "local_paths" lp
SET "statut_new" = 'a_qualifier'
WHERE lp."statut"::text = 'draft'
  AND EXISTS (
    SELECT 1 FROM "local_path_segments" s
    WHERE s."local_path_id" = lp."id" AND s."source"::text = 'bd_topo'
  );

ALTER TABLE "local_paths" DROP COLUMN "statut";
ALTER TABLE "local_paths" RENAME COLUMN "statut_new" TO "statut";
DROP TYPE "local_path_status";
ALTER TYPE "local_path_status_new" RENAME TO "local_path_status";

-- Publications data.gouv
CREATE TABLE "local_path_publications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code_insee" VARCHAR(5) NOT NULL,
  "published_by" TEXT,
  "changes_count" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_path_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "local_path_publications_code_insee_created_at_idx"
  ON "local_path_publications"("code_insee", "created_at");

CREATE TABLE "local_path_publication_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publication_id" UUID NOT NULL,
  "local_path_id" UUID NOT NULL,
  "hash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_path_publication_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "local_path_publication_items_publication_id_fkey"
    FOREIGN KEY ("publication_id") REFERENCES "local_path_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "local_path_publication_items_publication_id_local_path_id_key"
  ON "local_path_publication_items"("publication_id", "local_path_id");

CREATE INDEX "local_path_publication_items_local_path_id_idx"
  ON "local_path_publication_items"("local_path_id");
