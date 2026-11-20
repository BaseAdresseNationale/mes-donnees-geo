"use client";

import { ControlGroupPortal } from "@/components/map/controls/ControlGroupPortal";
import {
  CLASSEMENT_COLORS,
  CLASSEMENT_LABELS,
  REVETEMENT_COLORS,
  REVETEMENT_LABELS,
  type LocalPathClassement,
  type LocalPathRevetement,
} from "./types";
import styles from "./MapLegend.module.css";

export function NoEntryIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        fill="#ce0500"
        stroke="#fff"
        strokeWidth="2"
      />
      <rect x="4.5" y="8.25" width="11" height="3.5" rx="0.5" fill="#fff" />
    </svg>
  );
}

// `belowToolbar` : décale la légende sous la barre d'outils (page liste).
export function ClassementLegend({
  belowToolbar = false,
}: {
  belowToolbar?: boolean;
}) {
  return (
    <MapLegend
      belowToolbar={belowToolbar}
      items={(Object.keys(CLASSEMENT_COLORS) as LocalPathClassement[]).map(
        (key) => ({
          key,
          label: CLASSEMENT_LABELS[key],
          swatch: <LineSwatch color={CLASSEMENT_COLORS[key]} />,
        }),
      )}
    />
  );
}

export function RevetementLegend() {
  return (
    <MapLegend
      items={[
        ...(Object.keys(REVETEMENT_COLORS) as LocalPathRevetement[]).map(
          (key) => ({
            key,
            label: REVETEMENT_LABELS[key],
            swatch: <LineSwatch color={REVETEMENT_COLORS[key]} />,
          }),
        ),
        {
          key: "ferme-a-la-circulation",
          label: "Fermé à la circulation",
          swatch: <NoEntryIcon />,
        },
      ]}
    />
  );
}

function LineSwatch({ color }: { color: string }) {
  return (
    <span
      className={styles.lineSwatch}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function MapLegend({
  items,
  belowToolbar = false,
}: {
  belowToolbar?: boolean;
  items: { key: string; label: string; swatch: React.ReactNode }[];
}) {
  return (
    <ControlGroupPortal position="top-right">
      <section
        className={`${styles.legend} ${belowToolbar ? styles.belowToolbar : ""}`}
        aria-label="Légende"
      >
        <ul className={styles.list}>
          {items.map(({ key, label, swatch }) => (
            <li key={key} className={styles.item}>
              <span className={styles.swatch}>{swatch}</span>
              {label}
            </li>
          ))}
        </ul>
      </section>
    </ControlGroupPortal>
  );
}
