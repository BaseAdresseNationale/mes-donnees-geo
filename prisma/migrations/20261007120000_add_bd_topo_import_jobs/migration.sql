CREATE TABLE "bd_topo_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_insee" VARCHAR(5) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    CONSTRAINT "bd_topo_import_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bd_topo_import_jobs_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed'))
);

CREATE INDEX "bd_topo_import_jobs_code_insee_created_at_idx"
    ON "bd_topo_import_jobs"("code_insee", "created_at");

CREATE UNIQUE INDEX "bd_topo_import_jobs_active_commune_idx"
    ON "bd_topo_import_jobs"("code_insee") WHERE "status" = 'pending';