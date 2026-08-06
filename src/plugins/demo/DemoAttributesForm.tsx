"use client";

import type { AttributesFormProps } from "@/plugins/types";
import type { DemoProps } from "./index";

export function DemoAttributesForm({ feature, onChange, disabled }: AttributesFormProps<DemoProps>) {
  const props = feature.properties ?? { nom: "", note: "" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Nom</span>
        <input
          type="text"
          value={props.nom}
          onChange={(e) => onChange({ ...props, nom: e.target.value })}
          disabled={disabled}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Note</span>
        <textarea
          value={props.note}
          rows={3}
          onChange={(e) => onChange({ ...props, note: e.target.value })}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
