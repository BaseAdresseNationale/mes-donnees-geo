-- CreateEnum
CREATE TYPE "local_path_gestionnaire" AS ENUM ('commune', 'departement', 'region', 'etat', 'epci', 'vnf', 'prive', 'concessionnaire', 'onf', 'grand_port_maritime', 'port_autonome', 'section_de_commune', 'collectivite_statut_particulier', 'collectivite_territoriale_unique', 'collectivite_outre_mer', 'collectivite_sui_generis');

-- CreateEnum
CREATE TYPE "local_path_deletion_reason" AS ENUM ('annexe', 'accapare', 'approprie', 'disparu', 'inexistant');

-- AlterTable
ALTER TABLE "local_paths" ADD COLUMN "gestionnaire" "local_path_gestionnaire";
ALTER TABLE "local_paths" ADD COLUMN "deletion_reason" "local_path_deletion_reason";
