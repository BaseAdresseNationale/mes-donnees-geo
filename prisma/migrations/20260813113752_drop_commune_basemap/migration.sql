/*
  Warnings:

  - You are about to drop the column `basemap` on the `commune_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "commune_settings" DROP COLUMN "basemap";

-- DropEnum
DROP TYPE "basemap_kind";
