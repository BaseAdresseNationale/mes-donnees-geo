"use client";

import type { AttributesFormProps } from "@/plugins/types";
import type { RuralPathProps } from "./index";

const REVETEMENT_OPTIONS: RuralPathProps["revetement"][] = [
  "terre",
  "gravier",
  "enrobe",
  "empierre",
  "herbe",
];

const STATUT_OPTIONS: RuralPathProps["statut"][] = ["ouvert", "ferme", "a_verifier"];

export function RuralPathAttributesForm({
  feature,
  onChange,
  disabled,
}: AttributesFormProps<RuralPathProps>) {
  const props = feature.properties;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Nom du chemin</span>
        <input
          type="text"
          value={props.nom}
          onChange={(e) => onChange({ ...props, nom: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Revêtement</span>
        <select
          value={props.revetement}
          onChange={(e) =>
            onChange({ ...props, revetement: e.target.value as RuralPathProps["revetement"] })
          }
          disabled={disabled}
        >
          {REVETEMENT_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Statut</span>
        <select
          value={props.statut}
          onChange={(e) =>
            onChange({ ...props, statut: e.target.value as RuralPathProps["statut"] })
          }
          disabled={disabled}
        >
          {STATUT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
