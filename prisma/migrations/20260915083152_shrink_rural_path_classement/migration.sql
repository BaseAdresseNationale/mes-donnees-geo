/*
  Warnings:

  - The values [chemin_d_exploitation,voie_communautaire] on the enum `rural_path_classement` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "rural_path_classement_new" AS ENUM ('chemin_rural', 'voie_communale');
ALTER TABLE "rural_paths" ALTER COLUMN "classement" TYPE "rural_path_classement_new" USING ("classement"::text::"rural_path_classement_new");
ALTER TYPE "rural_path_classement" RENAME TO "rural_path_classement_old";
ALTER TYPE "rural_path_classement_new" RENAME TO "rural_path_classement";
DROP TYPE "public"."rural_path_classement_old";
COMMIT;
