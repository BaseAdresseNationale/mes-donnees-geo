"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { useCommune } from "@/contexts/CommuneContext";
import { createBalClient } from "@/lib/api-bal/browser-client";
import {
  createToponyme,
  searchNumerosInPolygon,
  updateNumeros,
  updateToponyme,
} from "@/lib/api-bal/generated/sdk.gen";
import type { ExtentedToponymeDto } from "@/lib/api-bal/generated/types.gen";
import { AddressFormMap } from "@/components/map/bal/AddressFormMap";
import { useBalChanged } from "@/components/adresses/bal-changes";
import { usePolygonDraw } from "@/components/map/bal/usePolygonDraw";
import { parseApiFieldErrors } from "@/components/adresses/form/api-errors";
import {
  LanguesRegionalesField,
  toLangueRows,
  toNomAlt,
} from "@/components/adresses/form/LanguesRegionalesField";
import {
  boundsCenter,
  toApiPositions,
  toFormPositions,
  type FormPosition,
} from "@/components/adresses/form/positions";
import { PositionsField } from "@/components/adresses/form/PositionsField";
import { ParcellesField } from "@/components/adresses/form/ParcellesField";
import { useShowCadastre } from "@/components/adresses/form/useShowCadastre";
import styles from "@/components/adresses/form/form.module.css";

// Position par défaut d'un toponyme (comme dans mes-adresses)
const DEFAULT_TOPONYME_POSITION_TYPE = "segment";

export interface NumeroOption {
  id: string;
  // Ex. « 12 bis Rue des Lilas »
  label: string;
}

type FieldErrors = Partial<
  Record<"nom" | "nomAlt" | "positions" | "parcelles" | "numeros", string>
>;

// Préfixes des erreurs de validation de l'API → champs du formulaire
const API_FIELDS: Record<string, keyof FieldErrors> = {
  voie_nom: "nom",
  lang_alt: "nomAlt",
  position: "positions",
  positions: "positions",
  cad_parcelles: "parcelles",
  polygon: "numeros",
};

// Liste de numéros en pastilles, chacun retirable
function NumeroChips({
  numeros,
  onRemove,
  disabled,
}: {
  numeros: NumeroOption[];
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <ul className={styles.chips}>
      {numeros.map(({ id, label }) => (
        <li key={id} className={styles.chip}>
          <span>{label}</span>
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={`Retirer ${label}`}
            title="Retirer"
            onClick={() => onRemove(id)}
            disabled={disabled}
          >
            <span className="material-icons">close</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Formulaire d'un toponyme (modification si `toponyme` est fourni, sinon
// création) : nom, langues régionales, positions, parcelles, et association
// de numéros en dessinant un contour.
export function ToponymeForm({
  balId,
  toponyme,
  numeros = [],
  voieNames,
  toponymesHref,
}: {
  balId: string;
  toponyme?: ExtentedToponymeDto;
  // Numéros actuellement associés au toponyme
  numeros?: NumeroOption[];
  // Nom des voies de la BAL, pour étiqueter les numéros trouvés par contour
  voieNames: Record<string, string>;
  // Liste des toponymes de la BAL (/{codeCommune}/adresses/{balId}/toponymes)
  toponymesHref: string;
}) {
  const isEdit = toponyme !== undefined;
  // Annuler : retour au toponyme modifié, ou à la liste en création
  const cancelHref = isEdit ? `${toponymesHref}/${toponyme.id}` : toponymesHref;
  const { contour: communeContour } = useCommune();
  const router = useRouter();
  // Recharge la carte et le compteur des modifications à publier
  const notifyBalChanged = useBalChanged();
  const { setMapOverlayChildren } = useContext(MapContext);
  const showCadastre = useShowCadastre();
  const [pending, startTransition] = useTransition();

  const [nom, setNom] = useState(toponyme?.nom ?? "");
  const [langues, setLangues] = useState(() =>
    toLangueRows(toponyme?.nomAlt ?? null),
  );
  const [positions, setPositions] = useState<FormPosition[]>(() => {
    if (toponyme) return toFormPositions(toponyme.positions ?? []);
    // Création : un premier point au centre de la commune, à déplacer
    const start = boundsCenter(communeContour?.geometry);
    if (!start) return [];
    const [longitude, latitude] = start;
    return [
      { key: 0, type: DEFAULT_TOPONYME_POSITION_TYPE, longitude, latitude },
    ];
  });
  const [parcelles, setParcelles] = useState<string[]>(
    toponyme?.parcelles ?? [],
  );

  // Association des numéros : retirés parmi les actuels, ajoutés par contour
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [addedNumeros, setAddedNumeros] = useState<NumeroOption[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<number[][] | null>(null);
  const [searching, setSearching] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const keptNumeros = numeros.filter(({ id }) => !removedIds.includes(id));

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

  // Contour fermé : recherche des numéros qu'il contient (côté API)
  const handlePolygon = useCallback(
    async (ring: number[][]) => {
      setDrawing(false);
      setPolygon(ring);
      setSearching(true);
      setFieldErrors((errors) => ({ ...errors, numeros: undefined }));

      const { data, error } = await searchNumerosInPolygon({
        client: createBalClient(balId),
        path: { baseLocaleId: balId },
        body: { polygon: ring },
      });
      setSearching(false);

      if (error || !data) {
        setFieldErrors((errors) => ({
          ...errors,
          numeros:
            parseApiFieldErrors(error, API_FIELDS)?.numeros ??
            "La recherche des numéros a échoué. Réessayez.",
        }));
        return;
      }

      // Un numéro peut revenir plusieurs fois (une fois par position)
      const found = new Map(data.map((numero) => [numero.id, numero]));
      const alreadyAssociated = new Set(numeros.map(({ id }) => id));

      // Un numéro déjà associé mais retiré redevient simplement associé
      setRemovedIds((ids) => ids.filter((id) => !found.has(id)));
      setAddedNumeros((current) => {
        const known = new Set(current.map(({ id }) => id));
        const added = [...found.values()]
          .filter(({ id }) => !alreadyAssociated.has(id) && !known.has(id))
          .map((numero) => ({
            id: numero.id,
            label: [numero.numeroComplet, voieNames[numero.voieId]]
              .filter(Boolean)
              .join(" "),
          }));
        return [...current, ...added];
      });
    },
    [balId, numeros, voieNames],
  );

  usePolygonDraw(drawing, handlePolygon);

  // Marqueurs, parcelles, contour et numéros à associer sur la carte
  useEffect(() => {
    setMapOverlayChildren(
      <AddressFormMap
        label={nom.trim() || "Toponyme"}
        positions={positions}
        onMovePosition={movePosition}
        parcelles={parcelles}
        onToggleParcelle={toggleParcelle}
        parcellesSelectable={showCadastre && !pending && !drawing}
        polygon={drawing ? null : polygon}
        highlightedNumeroIds={addedNumeros.map(({ id }) => id)}
      />,
    );
  }, [
    setMapOverlayChildren,
    nom,
    positions,
    movePosition,
    parcelles,
    toggleParcelle,
    showCadastre,
    pending,
    drawing,
    polygon,
    addedNumeros,
  ]);
  useEffect(() => () => setMapOverlayChildren(null), [setMapOverlayChildren]);

  function submit() {
    setFormError(null);
    if (!nom.trim()) {
      setFieldErrors({ nom: "Le nom du toponyme est obligatoire." });
      return;
    }
    setFieldErrors({});

    const body = {
      nom: nom.trim(),
      nomAlt: toNomAlt(langues),
      // Tableau complet : les positions absentes sont supprimées par l'API
      positions: toApiPositions(positions),
      parcelles,
    };
    const addedIds = addedNumeros.map(({ id }) => id);

    startTransition(async () => {
      const client = createBalClient(balId);
      const { data, error, response } = isEdit
        ? await updateToponyme({
            client,
            path: { toponymeId: toponyme.id },
            body,
          })
        : await createToponyme({
            client,
            path: { baseLocaleId: balId },
            body,
          });

      if (error || !data || !response?.ok) {
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
              ? "Le toponyme n'a pas pu être enregistré. Réessayez."
              : "Le toponyme n'a pas pu être créé. Réessayez.",
          );
        }
        return;
      }

      // Association / dissociation des numéros en une requête chacune
      const batches = [
        addedIds.length > 0 &&
          updateNumeros({
            client,
            path: { baseLocaleId: balId },
            body: {
              numerosIds: addedIds,
              changes: { toponymeId: data.id },
            },
          }),
        removedIds.length > 0 &&
          updateNumeros({
            client,
            path: { baseLocaleId: balId },
            body: { numerosIds: removedIds, changes: { toponymeId: null } },
          }),
      ].filter((batch) => batch !== false);
      const results = await Promise.all(batches);

      notifyBalChanged();
      const toponymeHref = `${toponymesHref}/${data.id}`;
      // En création, on quitte le formulaire même si l'association échoue :
      // le renvoyer créerait un second toponyme. La page du toponyme montre
      // les numéros réellement associés.
      if (isEdit && results.some(({ error: batchError }) => batchError)) {
        setFormError(
          "Le toponyme a été enregistré, mais la mise à jour des numéros associés a échoué. Réessayez.",
        );
        router.refresh();
        return;
      }

      router.push(toponymeHref);
      router.refresh();
    });
  }

  const busy = pending || searching;

  return (
    <form
      className={styles.form}
      aria-label={isEdit ? "Modification du toponyme" : "Nouveau toponyme"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className={styles.title}>
        {isEdit ? "Modifier le toponyme" : "Nouveau toponyme"}
      </h2>

      <Input
        label="Nom du toponyme"
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

      <PositionsField
        positions={positions}
        onChange={setPositions}
        defaultType={DEFAULT_TOPONYME_POSITION_TYPE}
        minPositions={0}
        addLabel="Ajouter une position"
        error={fieldErrors.positions}
        disabled={pending}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Numéros associés</legend>
        {keptNumeros.length > 0 ? (
          <NumeroChips
            numeros={keptNumeros}
            onRemove={(id) => setRemovedIds((ids) => [...ids, id])}
            disabled={busy}
          />
        ) : (
          <p className={styles.hint}>Aucun numéro associé.</p>
        )}
        {removedIds.length > 0 && (
          <p className={styles.hint}>
            {removedIds.length} numéro{removedIds.length > 1 ? "s" : ""} sera
            {removedIds.length > 1 ? "ont" : ""} dissocié
            {removedIds.length > 1 ? "s" : ""} à l&apos;enregistrement.
          </p>
        )}

        {addedNumeros.length > 0 && (
          <>
            <p className={styles.hint}>
              À associer ({addedNumeros.length}), en rouge sur la carte :
            </p>
            <NumeroChips
              numeros={addedNumeros}
              onRemove={(id) =>
                setAddedNumeros((list) => list.filter((n) => n.id !== id))
              }
              disabled={busy}
            />
          </>
        )}

        {drawing ? (
          <p className={styles.hint}>
            Dessinez le contour sur la carte pour sélectionner des numéros.
          </p>
        ) : searching ? (
          <p className={styles.hint}>Recherche des numéros…</p>
        ) : null}
        {fieldErrors.numeros && (
          <p className={styles.fieldError}>{fieldErrors.numeros}</p>
        )}

        <div>
          {drawing ? (
            <Button
              type="button"
              variant="secondary"
              color="neutral"
              size="small"
              icon={<span className="material-icons">close</span>}
              onClick={() => setDrawing(false)}
            >
              Annuler le contour
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              color="neutral"
              size="small"
              icon={<span className="material-icons">polyline</span>}
              onClick={() => {
                setPolygon(null);
                setDrawing(true);
              }}
              disabled={busy}
            >
              {polygon
                ? "Dessiner un autre contour"
                : "Associer des numéros en dessinant un contour"}
            </Button>
          )}
        </div>
      </fieldset>

      <ParcellesField
        parcelles={parcelles}
        onRemove={toggleParcelle}
        showCadastre={showCadastre}
        error={fieldErrors.parcelles}
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
        <Button type="submit" color="brand" disabled={busy || drawing}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
