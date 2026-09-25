"use client";

import { Button } from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/navigation";
import styles from "./LocalPathsToolbar.module.css";

interface LocalPathToolbarProps {
  codeCommune: string;
}

export function LocalPathToolbar({ codeCommune }: LocalPathToolbarProps) {
  const router = useRouter();
  return (
    <div className={styles.toolbar}>
      <Button
        color="brand"
        icon={<span className="material-icons">add</span>}
        aria-label="Créer un nouveau chemin rural"
        size="small"
        onClick={() => router.push(`/${codeCommune}/voies-locales/new`)}
      >
        Nouveau chemin
      </Button>
      <Button
        color="neutral"
        icon={<span className="material-icons">cloud_download</span>}
        aria-label="Importer des chemins depuis la BD TOPO"
        size="small"
        onClick={() => router.push(`/${codeCommune}/voies-locales/import`)}
      >
        Importer des chemins
      </Button>
    </div>
  );
}
