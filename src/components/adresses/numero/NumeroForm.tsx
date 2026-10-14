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
import { CadastreContext } from "@/contexts/CadastreContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import { createNumero, updateNumero } from "@/lib/api-bal/generated/sdk.gen";
import type { Numero, Position } from "@/lib/api-bal/generated/types.gen";
import { useCommune } from "@/contexts/CommuneContext";
import { geometryBounds } from "@/lib/geo/bounds";
import { DEFAULT_POSITION_TYPE, POSITION_TYPES } from "@/lib/api-bal/positions";
import {
  NumeroFormMap,
  type FormPosition,
} from "@/components/map/bal/NumeroFormMap";
import { reloadBalTiles } from "@/components/map/bal/BalTilesMap";
import { parseApiFieldErrors } from "@/components/adresses/form/api-errors";
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

interface FormPositionWithSource extends FormPosition {
  // Source d'origine de la position, conservée à l'enregistrement
  source?: string;
}

function toFormPositions(numero: Numero): FormPositionWithSource[] {
  return numero.positions.flatMap((position, index) => {
    const coordinates = (position.point as { coordinates?: unknown })
      .coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    const [longitude, latitude] = coordinates as number[];
    return [
      {
        key: index,
        type: position.type,
        longitude,
        latitude,
        source: position.source || undefined,
      },
    ];
  });
}

// Formulaire d'un numéro : modification si `numero` est fourni, sinon
// création sur la voie `voieId`.
// Centre [lon, lat] de l'emprise d'une géométrie
function boundsCenter(
  geometry: Parameters<typeof geometryBounds>[0] | undefined,
): [number, number] | null {
  const bounds = geometry ? geometryBounds(geometry) : null;
  if (!bounds) return null;
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

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
  const { mapRef, setMapOverlayChildren } = useContext(MapContext);
  const { showCadastre, setShowCadastre } = useContext(CadastreContext);
  const [pending, startTransition] = useTransition();

  const [numeroValue, setNumeroValue] = useState(
    numero ? String(numero.numero) : "",
  );
  const [suffixe, setSuffixe] = useState(numero?.suffixe ?? "");
  const [toponymeId, setToponymeId] = useState(
    numero?.toponymeId ?? NO_TOPONYME,
  );
  const [positions, setPositions] = useState<FormPositionWithSource[]>(() => {
    if (numero) return toFormPositions(numero);
    const start = initialPosition ?? boundsCenter(communeContour?.geometry);
    if (!start) return [];
    const [longitude, latitude] = start;
    return [{ key: 0, type: DEFAULT_POSITION_TYPE, longitude, latitude }];
  });
  const [nextKey, setNextKey] = useState(positions.length);
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

  // Le cadastre est affiché pendant l'édition, puis remis dans son état initial
  useEffect(() => {
    const wasShown = showCadastre;
    setShowCadastre(true);
    return () => setShowCadastre(wasShown);
    // Seulement à l'ouverture / fermeture du formulaire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marqueurs et sélection de parcelles dans le second emplacement de carte
  useEffect(() => {
    setMapOverlayChildren(
      <NumeroFormMap
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

  const addPosition = useCallback(() => {
    const center = mapRef?.getCenter();
    if (!center) return;
    setPositions((rows) => [
      ...rows,
      {
        key: nextKey,
        type: DEFAULT_POSITION_TYPE,
        longitude: center.lng,
        latitude: center.lat,
      },
    ]);
    setNextKey((key) => key + 1);
  }, [mapRef, nextKey]);

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
      // L'ordre des positions définit leur rang ; id et rang sont générés
      // par l'API, d'où le cast vers le type Position du SDK.
      positions: positions.map((position) => ({
        type: position.type,
        ...(position.source ? { source: position.source } : {}),
        point: {
          type: "Point",
          coordinates: [position.longitude, position.latitude],
        },
      })) as unknown as Position[],
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
      reloadBalTiles(mapRef);
      router.push(voieHref);
      router.refresh();
    });
  }

  return (
    <form
      className={styles.form}
      aria-label={isEdit ? "Modification du numéro" : "Nouveau numéro"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className={styles.title}>
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

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Positions</legend>
        <p className={styles.hint}>
          Déplacez les points sur la carte pour ajuster les positions.
        </p>
        {positions.map((position) => (
          <div key={position.key} className={styles.positionRow}>
            <div className={styles.positionType}>
              <Select
                label="Type"
                options={POSITION_TYPES}
                value={position.type}
                onChange={(e) =>
                  setPositions((rows) =>
                    rows.map((row) =>
                      row.key === position.key &&
                      typeof e.target.value === "string"
                        ? { ...row, type: e.target.value }
                        : row,
                    ),
                  )
                }
                clearable={false}
                fullWidth
                disabled={pending}
              />
            </div>
            <span className={styles.coordinates}>
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </span>
            <Button
              type="button"
              variant="tertiary"
              color="neutral"
              icon={<span className="material-icons">delete</span>}
              aria-label="Supprimer cette position"
              title="Supprimer cette position"
              onClick={() =>
                setPositions((rows) =>
                  rows.filter((row) => row.key !== position.key),
                )
              }
              disabled={pending || positions.length <= 1}
            />
          </div>
        ))}
        {fieldErrors.positions && (
          <p className={styles.fieldError}>{fieldErrors.positions}</p>
        )}
        <div>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            size="small"
            icon={<span className="material-icons">add_location_alt</span>}
            onClick={addPosition}
            disabled={pending}
          >
            Ajouter une position
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Parcelles cadastrales</legend>
        <p className={styles.hint}>
          {showCadastre
            ? "Cliquez sur les parcelles de la carte pour les sélectionner ou les retirer (à partir du zoom 14)."
            : "Affichez le cadastre pour sélectionner des parcelles sur la carte."}
        </p>
        {parcelles.length > 0 ? (
          <ul className={styles.parcelles}>
            {parcelles.map((id) => (
              <li key={id} className={styles.parcelle}>
                <span>{id}</span>
                <button
                  type="button"
                  className={styles.parcelleRemove}
                  aria-label={`Retirer la parcelle ${id}`}
                  title="Retirer"
                  onClick={() => toggleParcelle(id)}
                  disabled={pending}
                >
                  <span className="material-icons">close</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Aucune parcelle sélectionnée.</p>
        )}
        {fieldErrors.parcelles && (
          <p className={styles.fieldError}>{fieldErrors.parcelles}</p>
        )}
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
          onClick={() => router.push(voieHref)}
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
