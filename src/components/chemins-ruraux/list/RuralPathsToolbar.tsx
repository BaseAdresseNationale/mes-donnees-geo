"use client";

import Link from "next/link";
import { Button } from "@gouvfr-lasuite/ui-components";
import styles from "./RuralPathsToolbar.module.css";

interface RuralPathToolbarProps {
  codeCommune: string;
}

export function RuralPathToolbar({ codeCommune }: RuralPathToolbarProps) {
  return (
    <div>
      <Link
        href={`/${codeCommune}/chemins-ruraux/new`}
        className={styles.newButton}
      >
        <Button
          color="brand"
          icon={<span className="material-icons">add</span>}
          aria-label="Créer un nouveau chemin rural"
          size="small"
        >
          Nouveau chemin
        </Button>
      </Link>
    </div>
  );
}
