"use client";

import { Button, Input, Select } from "@gouvfr-lasuite/ui-components";
import {
  LANGUES_REGIONALES,
  getLangueLabel,
} from "@/lib/api-bal/langues-regionales";
import styles from "./form.module.css";

export interface LangueRow {
  // Clé React stable, indépendante de la langue choisie
  key: number;
  code: string;
  nom: string;
}

export function toLangueRows(
  nomAlt: Record<string, unknown> | null,
): LangueRow[] {
  return Object.entries(nomAlt ?? {}).map(([code, nom], index) => ({
    key: index,
    code,
    nom: typeof nom === "string" ? nom : "",
  }));
}

// nomAlt envoyé à l'API : lignes incomplètes ignorées, et null plutôt qu'un
// objet vide (refusé par l'API)
export function toNomAlt(rows: LangueRow[]): Record<string, string> | null {
  const nomAlt = Object.fromEntries(
    rows
      .filter((row) => row.code && row.nom.trim())
      .map((row) => [row.code, row.nom.trim()]),
  );
  return Object.keys(nomAlt).length > 0 ? nomAlt : null;
}

// Langues régionales d'un nom (voie, toponyme) : une ligne par langue
export function LanguesRegionalesField({
  rows,
  onChange,
  error,
  disabled,
}: {
  rows: LangueRow[];
  onChange: (rows: LangueRow[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const usedCodes = new Set(rows.map((row) => row.code));
  const allLanguesUsed = usedCodes.size >= LANGUES_REGIONALES.length;

  function update(key: number, patch: Partial<LangueRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function add() {
    const key = Math.max(-1, ...rows.map((row) => row.key)) + 1;
    onChange([...rows, { key, code: "", nom: "" }]);
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Langues régionales</legend>
      {rows.map((row) => (
        <div key={row.key} className={styles.langueRow}>
          <div className={styles.langueSelect}>
            <Select
              label="Langue"
              options={LANGUES_REGIONALES.filter(
                ({ code }) => code === row.code || !usedCodes.has(code),
              ).map(({ code, label }) => ({ value: code, label }))}
              value={row.code || undefined}
              onChange={(e) =>
                update(row.key, {
                  code:
                    typeof e.target.value === "string" ? e.target.value : "",
                })
              }
              clearable={false}
              fullWidth
              disabled={disabled}
            />
          </div>
          <div className={styles.langueNom}>
            <Input
              label={row.code ? `Nom en ${getLangueLabel(row.code)}` : "Nom"}
              fullWidth
              value={row.nom}
              onChange={(e) => update(row.key, { nom: e.target.value })}
              disabled={disabled || !row.code}
            />
          </div>
          <Button
            type="button"
            variant="tertiary"
            color="neutral"
            icon={<span className="material-icons">delete</span>}
            aria-label="Retirer cette langue"
            title="Retirer cette langue"
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            disabled={disabled}
          />
        </div>
      ))}
      {error && <p className={styles.fieldError}>{error}</p>}
      <div>
        <Button
          type="button"
          variant="secondary"
          color="neutral"
          size="small"
          icon={<span className="material-icons">add</span>}
          onClick={add}
          disabled={disabled || allLanguesUsed}
        >
          Ajouter une langue régionale
        </Button>
      </div>
    </fieldset>
  );
}
