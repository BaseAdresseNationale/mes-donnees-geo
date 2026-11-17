ALTER TABLE "bd_topo_import_jobs"
    ADD COLUMN "algorithm" VARCHAR(20) NOT NULL DEFAULT 'legacy',
    ADD CONSTRAINT "bd_topo_import_jobs_algorithm_check" CHECK ("algorithm" IN ('legacy', 'buffer', 'graph'));

DROP INDEX "bd_topo_import_jobs_active_commune_kind_idx";

CREATE UNIQUE INDEX "bd_topo_import_jobs_active_import_idx"
    ON "bd_topo_import_jobs"("code_insee") WHERE "status" = 'pending' AND "kind" = 'import';

CREATE UNIQUE INDEX "bd_topo_import_jobs_active_preview_idx"
    ON "bd_topo_import_jobs"("code_insee", "algorithm") WHERE "status" = 'pending' AND "kind" = 'preview';
