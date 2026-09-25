-- Renommage rural_path* -> local_path* (module "chemins ruraux" -> "voies locales").
-- Le classement CHEMIN_RURAL/VOIE_COMMUNALE reste inchangé (distinction interne).

-- Types enum
ALTER TYPE "rural_path_status" RENAME TO "local_path_status";
ALTER TYPE "rural_path_revetement" RENAME TO "local_path_revetement";
ALTER TYPE "rural_path_type" RENAME TO "local_path_type";
ALTER TYPE "rural_path_classement" RENAME TO "local_path_classement";
ALTER TYPE "rural_path_etat" RENAME TO "local_path_etat";
ALTER TYPE "rural_path_servitude" RENAME TO "local_path_servitude";
ALTER TYPE "rural_path_bornage" RENAME TO "local_path_bornage";
ALTER TYPE "rural_path_source" RENAME TO "local_path_source";

-- Fonctions de trigger (les triggers les référencent par OID : le rename ne les casse pas)
ALTER FUNCTION "rural_paths_touch_updated_at"() RENAME TO "local_paths_touch_updated_at";
ALTER FUNCTION "rural_path_segments_touch_updated_at"() RENAME TO "local_path_segments_touch_updated_at";
ALTER FUNCTION "rural_path_segments_sync_path_geom"() RENAME TO "local_path_segments_sync_path_geom";

-- Tables
ALTER TABLE "rural_paths" RENAME TO "local_paths";
ALTER TABLE "rural_path_segments" RENAME TO "local_path_segments";

-- Colonne FK
ALTER TABLE "local_path_segments" RENAME COLUMN "rural_path_id" TO "local_path_id";

-- Contraintes
ALTER TABLE "local_paths" RENAME CONSTRAINT "rural_paths_pkey" TO "local_paths_pkey";
ALTER TABLE "local_paths" RENAME CONSTRAINT "rural_paths_code_insee_format" TO "local_paths_code_insee_format";
ALTER TABLE "local_path_segments" RENAME CONSTRAINT "rural_path_segments_pkey" TO "local_path_segments_pkey";
ALTER TABLE "local_path_segments" RENAME CONSTRAINT "rural_path_segments_rural_path_id_fkey" TO "local_path_segments_local_path_id_fkey";

-- Index
ALTER INDEX "rural_paths_code_insee_idx" RENAME TO "local_paths_code_insee_idx";
ALTER INDEX "rural_paths_deleted_at_idx" RENAME TO "local_paths_deleted_at_idx";
ALTER INDEX "rural_path_segments_rural_path_id_ordre_key" RENAME TO "local_path_segments_local_path_id_ordre_key";
ALTER INDEX "rural_path_segments_deleted_at_idx" RENAME TO "local_path_segments_deleted_at_idx";
ALTER INDEX "rural_path_segments_source_source_ref_idx" RENAME TO "local_path_segments_source_source_ref_idx";
ALTER INDEX "rural_path_segments_path_geom_idx" RENAME TO "local_path_segments_path_geom_idx";

-- Triggers
ALTER TRIGGER "rural_paths_updated_at" ON "local_paths" RENAME TO "local_paths_updated_at";
ALTER TRIGGER "rural_path_segments_updated_at" ON "local_path_segments" RENAME TO "local_path_segments_updated_at";
ALTER TRIGGER "rural_path_segments_sync_path_geom" ON "local_path_segments" RENAME TO "local_path_segments_sync_path_geom";

-- Données : l'id du plugin change dans les préférences par commune.
UPDATE "commune_settings"
SET "disabled_plugins" = array_replace("disabled_plugins", 'chemins-ruraux', 'voies-locales')
WHERE 'chemins-ruraux' = ANY("disabled_plugins");
