"use client";

import { useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, TextArea } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import { createVoie, updateVoie } from "@/lib/api-bal/generated/sdk.gen";
import type { ExtendedVoieDto } from "@/lib/api-bal/generated/types.gen";
import {
  LANGUES_REGIONALES,
  getLangueLabel,
} from "@/lib/api-bal/langues-regionales";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";
import { parseApiFieldErrors } from "@/components/adresses/form/api-errors";
import styles from "./VoieForm.module.css";

const COMMENT_MAX_LENGTH = 5000;

interface LangueRow {
  // Clé React stable, indépendante de la langue choisie
  key: number;
  code: string;
  nom: string;
}

type FieldErrors = Partial<Record<"nom" | "nomAlt" | "comment", string>>;

// Préfixes des erreurs de validation de l'API → champs du formulaire
const API_FIELDS: Record<string, keyof FieldErrors> = {
  voie_nom: "nom",
  lang_alt: "nomAlt",
  comment: "comment",
};

function toLangueRows(nomAlt: ExtendedVoieDto["nomAlt"] | null): LangueRow[] {
  return Object.entries(nomAlt ?? {}).map(([code, nom], index) => ({
    key: index,
    code,
    nom: typeof nom === "string" ? nom : "",
  }));
}

// Formulaire d'une voie : modification si `voie` est fourni, sinon création.
export function VoieForm({
  balId,
  voie,
  voiesHref,
}: {
  balId: string;
  voie?: ExtendedVoieDto;
  // Liste des voies de la BAL (/{codeCommune}/adresses/{balId}/voies)
  voiesHref: string;
}) {
  const isEdit = voie !== undefined;
  // Annuler : retour à la voie modifiée, ou à la liste en création
  const cancelHref = isEdit ? `${voiesHref}/${voie.id}` : voiesHref;
  const router = useRouter();
  const { mapRef } = useContext(MapContext);
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(voie?.nom ?? "");
  const [langues, setLangues] = useState(() =>
    toLangueRows(voie?.nomAlt ?? null),
  );
  const [nextKey, setNextKey] = useState(langues.length);
  const [comment, setComment] = useState(voie?.comment ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const usedCodes = new Set(langues.map((langue) => langue.code));
  const allLanguesUsed = usedCodes.size >= LANGUES_REGIONALES.length;

  function updateLangue(key: number, patch: Partial<LangueRow>) {
    setLangues((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addLangue() {
    setLangues((rows) => [...rows, { key: nextKey, code: "", nom: "" }]);
    setNextKey((key) => key + 1);
  }

  function removeLangue(key: number) {
    setLangues((rows) => rows.filter((row) => row.key !== key));
  }

  function submit() {
    setFormError(null);
    if (!nom.trim()) {
      setFieldErrors({ nom: "Le nom de la voie est obligatoire." });
      return;
    }
    setFieldErrors({});

    // Lignes incomplètes ignorées ; l'API refuse un objet vide (null attendu)
    const nomAlt = Object.fromEntries(
      langues
        .filter((langue) => langue.code && langue.nom.trim())
        .map((langue) => [langue.code, langue.nom.trim()]),
    );

    const body = {
      nom: nom.trim(),
      nomAlt: Object.keys(nomAlt).length > 0 ? nomAlt : null,
      comment: comment.trim() || null,
    };

    startTransition(async () => {
      const client = createBalClient(balId);
      const { data, error, response } = isEdit
        ? await updateVoie({ client, path: { voieId: voie.id }, body })
        : await createVoie({ client, path: { baseLocaleId: balId }, body });

      if (error || !data || !response?.ok) {
        const errors = parseApiFieldErrors(error, API_FIELDS);
        if (errors) {
          setFieldErrors(errors);
        } else if (response?.status === 403) {
          setFormError(
            "Cette Base Adresse Locale ne peut pas être modifiée pour le moment.",
          );
        } else {
          setFormError(
            isEdit
              ? "La voie n'a pas pu être enregistrée. Réessayez."
              : "La voie n'a pas pu être créée. Réessayez.",
          );
        }
        return;
      }

      // Voie (nouvelle ou renommée) visible sur la carte et dans les listes
      reloadBalTiles(mapRef);
      router.push(`${voiesHref}/${data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className={styles.form}
      aria-label={isEdit ? "Modification de la voie" : "Nouvelle voie"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className={styles.title}>
        {isEdit ? "Modifier la voie" : "Nouvelle voie"}
      </h2>

      <Input
        label="Nom de la voie"
        fullWidth
        required
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        state={fieldErrors.nom ? "error" : "default"}
        text={fieldErrors.nom}
        disabled={pending}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Langues régionales</legend>
        {langues.map((langue) => (
          <div key={langue.key} className={styles.langueRow}>
            <div className={styles.langueSelect}>
              <Select
                label="Langue"
                options={LANGUES_REGIONALES.filter(
                  ({ code }) => code === langue.code || !usedCodes.has(code),
                ).map(({ code, label }) => ({ value: code, label }))}
                value={langue.code || undefined}
                onChange={(e) =>
                  updateLangue(langue.key, {
                    code:
                      typeof e.target.value === "string" ? e.target.value : "",
                  })
                }
                clearable={false}
                fullWidth
                disabled={pending}
              />
            </div>
            <div className={styles.langueNom}>
              <Input
                label={
                  langue.code ? `Nom en ${getLangueLabel(langue.code)}` : "Nom"
                }
                fullWidth
                value={langue.nom}
                onChange={(e) =>
                  updateLangue(langue.key, { nom: e.target.value })
                }
                disabled={pending || !langue.code}
              />
            </div>
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              icon={<span className="material-icons">delete</span>}
              aria-label="Retirer cette langue"
              title="Retirer cette langue"
              onClick={() => removeLangue(langue.key)}
              disabled={pending}
            />
          </div>
        ))}
        {fieldErrors.nomAlt && (
          <p className={styles.fieldError}>{fieldErrors.nomAlt}</p>
        )}
        <div>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            size="small"
            icon={<span className="material-icons">add</span>}
            onClick={addLangue}
            disabled={pending || allLanguesUsed}
          >
            Ajouter une langue régionale
          </Button>
        </div>
      </fieldset>

      <TextArea
        label="Commentaire"
        fullWidth
        placeholder="Cette note est confidentielle et ne sera pas diffusée."
        maxLength={COMMENT_MAX_LENGTH}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        state={fieldErrors.comment ? "error" : "default"}
        text={fieldErrors.comment}
        disabled={pending}
      />

      {formError && (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          type="button"
          color="neutral"
          variant="tertiary"
          onClick={() => router.push(cancelHref)}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" color="brand" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
