"use client";

import { Badge, Select } from "@gouvfr-lasuite/ui-components";
import { useParams, useRouter } from "next/navigation";
import type { BaseLocale } from "@/lib/api-bal/generated/types.gen";
import styles from "./BalSelect.module.css";

const STATUS_LABELS: Record<BaseLocale["status"], string> = {
  draft: "Brouillon",
  published: "Publiée",
  demo: "Démo",
  replaced: "Remplacée",
};

const STATUS_BADGE_TYPES = {
  draft: "neutral",
  published: "success",
  demo: "info",
  replaced: "warning",
} as const satisfies Record<BaseLocale["status"], string>;

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("fr-FR");
}

interface BalSelectProps {
  // null si mes-adresses-api n'a pas pu être interrogée
  bals: BaseLocale[] | null;
}

export function BalSelect({ bals }: BalSelectProps) {
  // BAL sélectionnée = celle de l'URL /{codeCommune}/adresses/{balId}
  const { codeCommune, balId } = useParams<{
    codeCommune: string;
    balId?: string;
  }>();
  const router = useRouter();

  if (bals === null) {
    return (
      <p className={styles.message}>
        Impossible de récupérer les BAL de la commune.
      </p>
    );
  }

  if (bals.length === 0) {
    return <p className={styles.message}>Aucune BAL pour cette commune.</p>;
  }

  const options = bals.map((bal) => ({
    value: bal.id,
    label: bal.nom,
    render: () => (
      <div className={styles.option}>
        <span className={styles.optionName}>{bal.nom}</span>
        <span className={styles.optionMeta}>
          <Badge type={STATUS_BADGE_TYPES[bal.status]}>
            {STATUS_LABELS[bal.status]}
          </Badge>
          Mise à jour le {formatDate(bal.updatedAt)}
        </span>
      </div>
    ),
  }));

  return (
    <div className={styles.container}>
      <Select
        label="Base Adresse Locale"
        placeholder="Sélectionner une BAL"
        options={options}
        value={balId}
        onChange={(e) => {
          if (typeof e.target.value === "string") {
            router.push(`/${codeCommune}/adresses/${e.target.value}`);
          }
        }}
        clearable={false}
        fullWidth
      />
    </div>
  );
}
