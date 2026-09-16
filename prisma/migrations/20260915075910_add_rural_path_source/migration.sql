-- CreateEnum
CREATE TYPE "rural_path_source" AS ENUM ('manuel', 'bd_topo');

-- AlterTable
ALTER TABLE "rural_paths" ADD COLUMN     "source" "rural_path_source" NOT NULL DEFAULT 'manuel',
ADD COLUMN     "source_ref" TEXT;

-- CreateIndex
CREATE INDEX "rural_paths_code_insee_source_source_ref_idx" ON "rural_paths"("code_insee", "source", "source_ref");
