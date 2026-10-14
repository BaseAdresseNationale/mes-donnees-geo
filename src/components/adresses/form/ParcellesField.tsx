"use client";

import styles from "./form.module.css";

// Parcelles cadastrales sélectionnées (la sélection se fait au clic sur la
// carte, cf. AddressFormMap)
export function ParcellesField({
  parcelles,
  onRemove,
  showCadastre,
  error,
  disabled,
}: {
  parcelles: string[];
  onRemove: (id: string) => void;
  showCadastre: boolean;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Parcelles cadastrales</legend>
      <p className={styles.hint}>
        {showCadastre
          ? "Cliquez sur les parcelles de la carte pour les sélectionner ou les retirer (à partir du zoom 14)."
          : "Affichez le cadastre pour sélectionner des parcelles sur la carte."}
      </p>
      {parcelles.length > 0 ? (
        <ul className={styles.chips}>
          {parcelles.map((id) => (
            <li key={id} className={styles.chip}>
              <span>{id}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Retirer la parcelle ${id}`}
                title="Retirer"
                onClick={() => onRemove(id)}
                disabled={disabled}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>Aucune parcelle sélectionnée.</p>
      )}
      {error && <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  );
}
