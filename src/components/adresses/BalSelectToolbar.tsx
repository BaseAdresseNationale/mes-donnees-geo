"use client";

import { useContext, useEffect } from "react";
import { useParams } from "next/navigation";
import ThemeContext from "@/contexts/ThemeContext";
import type { BaseLocale } from "@/lib/api-bal/generated/types.gen";
import { BalSelect } from "./BalSelect";
import { BalPublishButton } from "./publish/BalPublishButton";
import { useBalChangesVersion } from "./bal-changes";
import styles from "./BalSelectToolbar.module.css";

// Barre d'outils au-dessus de la carte, tant que le plugin adresses est
// affiché : choix de la BAL à gauche, bouton « Publier » à droite.
// La barre est rendue par MapLayout, hors des contextes du plugin : le bouton
// reçoit donc la version des modifications par props, depuis ce composant.
export function BalSelectToolbar({ bals }: { bals: BaseLocale[] | null }) {
  const { setToolbarChildren } = useContext(ThemeContext);
  const { balId } = useParams<{ balId?: string }>();
  const changesVersion = useBalChangesVersion();

  useEffect(() => {
    setToolbarChildren(
      <div className={styles.toolbar}>
        <BalSelect bals={bals} />
        {balId && (
          <div className={styles.actions}>
            <BalPublishButton balId={balId} changesVersion={changesVersion} />
          </div>
        )}
      </div>,
    );
  }, [bals, balId, changesVersion, setToolbarChildren]);

  // Barre vidée en quittant le plugin
  useEffect(() => () => setToolbarChildren(null), [setToolbarChildren]);

  return null;
}
