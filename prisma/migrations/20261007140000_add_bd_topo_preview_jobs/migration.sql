ALTER TABLE "bd_topo_import_jobs"
    ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'import',
    ADD COLUMN "result" JSONB,
    ADD CONSTRAINT "bd_topo_import_jobs_kind_check" CHECK ("kind" IN ('import', 'preview'));

DROP INDEX "bd_topo_import_jobs_active_commune_idx";
CREATE UNIQUE INDEX "bd_topo_import_jobs_active_commune_kind_idx"
    ON "bd_topo_import_jobs"("code_insee", "kind") WHERE "status" = 'pending';