"use client";

import { Button } from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/navigation";

interface RuralPathToolbarProps {
  codeCommune: string;
}

export function RuralPathToolbar({ codeCommune }: RuralPathToolbarProps) {
  const router = useRouter();
  return (
    <div>
      <Button
        color="brand"
        icon={<span className="material-icons">add</span>}
        aria-label="Créer un nouveau chemin rural"
        size="small"
        onClick={() => router.push(`/${codeCommune}/chemins-ruraux/new`)}
      >
        Nouveau chemin
      </Button>
    </div>
  );
}
