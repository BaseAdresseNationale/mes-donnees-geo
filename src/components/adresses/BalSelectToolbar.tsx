"use client";

import { useContext, useEffect } from "react";
import ThemeContext from "@/contexts/ThemeContext";
import type { BaseLocale } from "@/lib/api-bal/generated/types.gen";
import { BalSelect } from "./BalSelect";

// Place le choix de la BAL dans la barre d'outils au-dessus de la carte,
// tant que le plugin adresses est affiché.
export function BalSelectToolbar({ bals }: { bals: BaseLocale[] | null }) {
  const { setToolbarChildren } = useContext(ThemeContext);

  useEffect(() => {
    setToolbarChildren(<BalSelect bals={bals} />);

    return () => {
      setToolbarChildren(null);
    };
  }, [bals, setToolbarChildren]);

  return null;
}
