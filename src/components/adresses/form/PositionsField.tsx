"use client";

import { useContext } from "react";
import { Button, Select } from "@gouvfr-lasuite/ui-components";
import MapContext from "@/contexts/MapContext";
import { POSITION_TYPES, type PositionType } from "@/lib/api-bal/positions";
import type { FormPosition } from "./positions";
import styles from "./form.module.css";

// Positions d'un numéro ou d'un toponyme : type + coordonnées par ligne.
// Les points se déplacent sur la carte (AddressFormMap).
export function PositionsField({
  positions,
  onChange,
  defaultType,
  minPositions,
  addLabel,
  error,
  disabled,
}: {
  positions: FormPosition[];
  onChange: (positions: FormPosition[]) => void;
  // Type d'une position ajoutée
  defaultType: PositionType;
  // Nombre minimal de positions (bouton supprimer désactivé en dessous)
  minPositions: number;
  addLabel: string;
  error?: string;
  disabled?: boolean;
}) {
  const { mapRef } = useContext(MapContext);

  // Nouvelle position au centre de la carte
  function add() {
    const center = mapRef?.getCenter();
    if (!center) return;
    const key = Math.max(-1, ...positions.map((p) => p.key)) + 1;
    onChange([
      ...positions,
      {
        key,
        type: defaultType,
        longitude: center.lng,
        latitude: center.lat,
      },
    ]);
  }

  return (
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
              onChange={(e) => {
                const type = e.target.value;
                if (typeof type !== "string") return;
                onChange(
                  positions.map((p) =>
                    p.key === position.key ? { ...p, type } : p,
                  ),
                );
              }}
              clearable={false}
              fullWidth
              disabled={disabled}
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
              onChange(positions.filter((p) => p.key !== position.key))
            }
            disabled={disabled || positions.length <= minPositions}
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
          icon={<span className="material-icons">add_location_alt</span>}
          onClick={add}
          disabled={disabled}
        >
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
