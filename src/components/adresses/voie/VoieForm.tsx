"use client";

import { useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Radio,
  RadioGroup,
  TextArea,
} from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import { createVoie, updateVoie } from "@/lib/api-bal/generated/sdk.gen";
import type {
  ExtendedVoieDto,
  UpdateVoieDto,
} from "@/lib/api-bal/generated/types.gen";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";
import { useLineDraw } from "@/components/map/bal/useLineDraw";
import { parseApiFieldErrors } from "@/components/adresses/form/api-errors";
import {
  LanguesRegionalesField,
  toLangueRows,
  toNomAlt,
} from "@/components/adresses/form/LanguesRegionalesField";
import styles from "@/components/adresses/form/form.module.css";

const COMMENT_MAX_LENGTH = 5000;

type TypeNumerotation = ExtendedVoieDto["typeNumerotation"];

const TYPES_NUMEROTATION: { value: TypeNumerotation; label: string }[] = [
  { value: "numerique", label: "Numérique" },
  { value: "metrique", label: "Métrique (tracé de la voie)" },
];

type FieldErrors = Partial<
  Record<"nom" | "nomAlt" | "trace" | "comment", string>
>;

// Préfixes des erreurs de validation de l'API → champs du formulaire
const API_FIELDS: Record<string, keyof FieldErrors> = {
  voie_nom: "nom",
  lang_alt: "nomAlt",
  trace: "trace",
  comment: "comment",
};

// Coordonnées du tracé d'une voie (null si elle n'en a pas)
function traceCoordinates(trace: unknown): number[][] | null {
  const coordinates = (trace as { coordinates?: unknown } | null)?.coordinates;
  return Array.isArray(coordinates) && coordinates.length >= 2
    ? (coordinates as number[][])
    : null;
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
  const [typeNumerotation, setTypeNumerotation] = useState<TypeNumerotation>(
    voie?.typeNumerotation ?? "numerique",
  );
  const [trace, setTrace] = useState<number[][] | null>(() =>
    traceCoordinates(voie?.trace),
  );
  const [comment, setComment] = useState(voie?.comment ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Numérotation métrique : le tracé se dessine / se modifie sur la carte
  const isMetrique = typeNumerotation === "metrique";
  useLineDraw(isMetrique && !pending, trace, setTrace);

  function submit() {
    setFormError(null);
    if (!nom.trim()) {
      setFieldErrors({ nom: "Le nom de la voie est obligatoire." });
      return;
    }
    setFieldErrors({});

    const body = {
      nom: nom.trim(),
      nomAlt: toNomAlt(langues),
      typeNumerotation,
      // Tracé seulement en métrique ; null pour le retirer. Le type généré
      // n'autorise pas null, mais l'API l'accepte (comme mes-adresses).
      trace: (isMetrique && trace
        ? { type: "LineString", coordinates: trace }
        : null) as UpdateVoieDto["trace"],
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

      <LanguesRegionalesField
        rows={langues}
        onChange={setLangues}
        error={fieldErrors.nomAlt}
        disabled={pending}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Type de numérotation</legend>
        <RadioGroup>
          {TYPES_NUMEROTATION.map(({ value, label }) => (
            <Radio
              key={value}
              name="typeNumerotation"
              label={label}
              value={value}
              checked={typeNumerotation === value}
              onChange={() => setTypeNumerotation(value)}
              disabled={pending}
            />
          ))}
        </RadioGroup>
      </fieldset>

      {isMetrique && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Tracé de la voie</legend>
          <p className={styles.hint}>
            {trace
              ? `Tracé de ${trace.length} points. Déplacez les points sur la carte pour le modifier.`
              : "Dessinez le tracé de la voie sur la carte : cliquez pour placer les points, puis sur le dernier point pour terminer."}
          </p>
          {fieldErrors.trace && (
            <p className={styles.fieldError}>{fieldErrors.trace}</p>
          )}
          {trace && (
            <div>
              <Button
                type="button"
                variant="secondary"
                color="error"
                size="small"
                icon={<span className="material-icons">delete</span>}
                onClick={() => setTrace(null)}
                disabled={pending}
              >
                Effacer le tracé
              </Button>
            </div>
          )}
        </fieldset>
      )}

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
