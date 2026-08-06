"use client";

import type { Feature, Geometry } from "geojson";
import styles from "./FeatureList.module.css";

interface FeatureListProps {
  features: Feature<Geometry>[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

function describeFeature(feature: Feature<Geometry>): string {
  const props = feature.properties ?? {};
  const name = (props as Record<string, unknown>).nom ?? (props as Record<string, unknown>).name;
  if (typeof name === "string" && name.trim().length > 0) return name;
  return `Entité ${String(feature.id).slice(0, 8)}`;
}

export function FeatureList({ features, selectedId, onSelect, onDelete }: FeatureListProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.head}>
        <h2 className={styles.title}>Entités ({features.length})</h2>
        <p className={styles.hint}>
          Alternative textuelle à la carte. Sélectionner une entité la met en évidence sur la carte.
        </p>
      </div>
      {features.length === 0 ? (
        <p className={styles.empty}>
          Aucune entité pour ce module. Utilisez les outils de dessin sur la carte pour en créer.
        </p>
      ) : (
        <ul className={styles.list} role="list">
          {features.map((f) => {
            const id = String(f.id);
            const isSelected = selectedId === id;
            return (
              <li
                key={id}
                className={isSelected ? `${styles.item} ${styles.itemSelected}` : styles.item}
              >
                <button
                  type="button"
                  className={styles.selectBtn}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(isSelected ? null : id)}
                >
                  <span className={styles.name}>{describeFeature(f)}</span>
                  <span className={styles.geoType}>{f.geometry.type}</span>
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDelete(id)}
                  aria-label={`Supprimer ${describeFeature(f)}`}
                >
                  Supprimer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
