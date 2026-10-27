"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, TextArea } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { useCommune } from "@/contexts/CommuneContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import { createNumero, updateNumero } from "@/lib/api-bal/generated/sdk.gen";
import type { Numero } from "@/lib/api-bal/generated/types.gen";
import { DEFAULT_POSITION_TYPE } from "@/lib/api-bal/positions";
import { AddressFormMap } from "@/components/map/bal/AddressFormMap";
import { useBalChanged } from "@/components/adresses/bal-changes";
import { parseApiFieldErrors } from "@/components/adresses/form/api-errors";
import {
  boundsCenter,
  toApiPositions,
  toFormPositions,
  type FormPosition,
} from "@/components/adresses/form/positions";
import { PositionsField } from "@/components/adresses/form/PositionsField";
import { ParcellesField } from "@/components/adresses/form/ParcellesField";
import { useShowCadastre } from "@/components/adresses/form/useShowCadastre";
import {
  useGoBack,
  useSetFormBackFallback,
} from "@/components/adresses/form/form-back";
import formStyles from "@/components/adresses/form/form.module.css";
import styles from "./NumeroForm.module.css";

const COMMENT_MAX_LENGTH = 5000;
const NUMERO_MAX = 99998;
const NO_TOPONYME = "";

type FieldErrors = Partial<
  Record<
    "numero" | "suffixe" | "toponyme" | "positions" | "parcelles" | "comment",
    string
  >
>;

// Préfixes des erreurs de validation de l'API → champs du formulaire
const API_FIELDS: Record<string, keyof FieldErrors> = {
  numero: "numero",
  suffixe: "suffixe",
  toponymeId: "toponyme",
  position: "positions",
  positions: "positions",
  cad_parcelles: "parcelles",
  comment: "comment",
};

// Formulaire d'un numéro : modification si `numero` est fourni, sinon
// création sur la voie `voieId`.
export function NumeroForm({
  balId,
  voieId,
  numero,
  initialPosition,
  toponymes,
  voieHref,
}: {
  balId: string;
  voieId: string;
  numero?: Numero;
  // Création : emplacement du premier point [lon, lat] (ex. centroïde de la
  // voie) ; à défaut, le point est placé au centre de la commune.
  initialPosition?: [number, number] | null;
  toponymes: { id: string; nom: string }[];
  voieHref: string;
}) {
  const isEdit = numero !== undefined;
  const { contour: communeContour } = useCommune();
  const router = useRouter();
  // Recharge la carte et le compteur des modifications à publier
  const notifyBalChanged = useBalChanged();
  const { setMapOverlayChildren } = useContext(MapContext);
  const showCadastre = useShowCadastre();
  // Retour / Annuler : page précédente, sinon la voie du numéro
  useSetFormBackFallback(voieHref);
  const goBack = useGoBack();
  const [pending, startTransition] = useTransition();

  const [numeroValue, setNumeroValue] = useState(
    numero ? String(numero.numero) : "",
  );
  const [suffixe, setSuffixe] = useState(numero?.suffixe ?? "");
  const [toponymeId, setToponymeId] = useState(
    numero?.toponymeId ?? NO_TOPONYME,
  );
  const [positions, setPositions] = useState<FormPosition[]>(() => {
    if (numero) return toFormPositions(numero.positions);
    const start = initialPosition ?? boundsCenter(communeContour?.geometry);
    if (!start) return [];
    const [longitude, latitude] = start;
    return [{ key: 0, type: DEFAULT_POSITION_TYPE, longitude, latitude }];
  });
  const [parcelles, setParcelles] = useState<string[]>(numero?.parcelles ?? []);
  const [comment, setComment] = useState(numero?.comment ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Libellé des marqueurs : numéro complet tel que saisi
  const markerLabel =
    [numeroValue, suffixe.trim().toLowerCase()].filter(Boolean).join(" ") ||
    "Nouveau numéro";

  const movePosition = useCallback(
    (key: number, longitude: number, latitude: number) => {
      setPositions((rows) =>
        rows.map((row) =>
          row.key === key ? { ...row, longitude, latitude } : row,
        ),
      );
    },
    [],
  );

  const toggleParcelle = useCallback((id: string) => {
    setParcelles((ids) =>
      ids.includes(id) ? ids.filter((p) => p !== id) : [...ids, id],
    );
  }, []);

  // Marqueurs et sélection de parcelles dans le second emplacement de carte
  useEffect(() => {
    setMapOverlayChildren(
      <AddressFormMap
        label={markerLabel}
        positions={positions}
        onMovePosition={movePosition}
        parcelles={parcelles}
        onToggleParcelle={toggleParcelle}
        parcellesSelectable={showCadastre && !pending}
      />,
    );
  }, [
    setMapOverlayChildren,
    markerLabel,
    positions,
    movePosition,
    parcelles,
    toggleParcelle,
    showCadastre,
    pending,
  ]);
  useEffect(() => () => setMapOverlayChildren(null), [setMapOverlayChildren]);

  function submit() {
    setFormError(null);
    const numeroInt = Number(numeroValue);
    const errors: FieldErrors = {};
    if (
      !numeroValue.trim() ||
      !Number.isInteger(numeroInt) ||
      numeroInt < 0 ||
      numeroInt > NUMERO_MAX
    ) {
      errors.numero = `Le numéro doit être un entier entre 0 et ${NUMERO_MAX}.`;
    }
    if (positions.length === 0) {
      errors.positions = "Le numéro doit avoir au moins une position.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const body = {
      numero: numeroInt,
      suffixe: suffixe.trim().toLowerCase() || null,
      toponymeId: toponymeId || null,
      positions: toApiPositions(positions),
      parcelles,
      comment: comment.trim() || null,
    };

    startTransition(async () => {
      const client = createBalClient(balId);
      const { error, response } = isEdit
        ? await updateNumero({ client, path: { numeroId: numero.id }, body })
        : await createNumero({ client, path: { voieId }, body });

      if (error || !response?.ok) {
        const apiErrors = parseApiFieldErrors(error, API_FIELDS);
        if (apiErrors) {
          setFieldErrors(apiErrors);
        } else if (response?.status === 403) {
          setFormError(
            "Cette Base Adresse Locale ne peut pas être modifiée pour le moment.",
          );
        } else {
          setFormError(
            isEdit
              ? "Le numéro n'a pas pu être enregistré. Réessayez."
              : "Le numéro n'a pas pu être créé. Réessayez.",
          );
        }
        return;
      }

      // Nouvelle position visible sur la carte et liste à jour
      notifyBalChanged();
      router.push(voieHref);
      router.refresh();
    });
  }

  return (
    <form
      className={formStyles.form}
      aria-label={isEdit ? "Modification du numéro" : "Nouveau numéro"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className={formStyles.title}>
        {isEdit
          ? `Modifier le numéro ${numero.numeroComplet}`
          : "Nouveau numéro"}
      </h2>

      <div className={styles.row}>
        <div className={styles.numero}>
          <Input
            label="Numéro"
            type="number"
            min={0}
            max={NUMERO_MAX}
            step={1}
            fullWidth
            required
            value={numeroValue}
            onChange={(e) => setNumeroValue(e.target.value)}
            state={fieldErrors.numero ? "error" : "default"}
            text={fieldErrors.numero}
            disabled={pending}
          />
        </div>
        <div className={styles.suffixe}>
          <Input
            label="Suffixe"
            fullWidth
            maxLength={9}
            value={suffixe}
            onChange={(e) => setSuffixe(e.target.value)}
            state={fieldErrors.suffixe ? "error" : "default"}
            text={fieldErrors.suffixe}
            disabled={pending}
          />
        </div>
      </div>

      <Select
        label="Toponyme"
        options={[
          { value: NO_TOPONYME, label: "Aucun toponyme" },
          ...toponymes.map(({ id, nom }) => ({ value: id, label: nom })),
        ]}
        value={toponymeId}
        onChange={(e) =>
          setToponymeId(
            typeof e.target.value === "string" ? e.target.value : NO_TOPONYME,
          )
        }
        clearable={false}
        fullWidth
        state={fieldErrors.toponyme ? "error" : "default"}
        text={fieldErrors.toponyme}
        disabled={pending}
      />

      <PositionsField
        positions={positions}
        onChange={setPositions}
        defaultType={DEFAULT_POSITION_TYPE}
        minPositions={1}
        addLabel="Ajouter une position"
        error={fieldErrors.positions}
        disabled={pending}
      />

      <ParcellesField
        parcelles={parcelles}
        onRemove={toggleParcelle}
        showCadastre={showCadastre}
        error={fieldErrors.parcelles}
        disabled={pending}
      />

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
        <p className={formStyles.error} role="alert">
          {formError}
        </p>
      )}

      <div className={formStyles.actions}>
        <Button
          type="button"
          color="neutral"
          variant="tertiary"
          onClick={() => goBack(voieHref)}
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
