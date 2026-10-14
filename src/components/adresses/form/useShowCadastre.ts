"use client";

import { useContext, useEffect } from "react";
import { CadastreContext } from "@/contexts/CadastreContext";

// Affiche le cadastre tant que le formulaire est ouvert, puis le remet dans
// son état initial. Renvoie l'état d'affichage courant.
export function useShowCadastre(): boolean {
  const { showCadastre, setShowCadastre } = useContext(CadastreContext);

  useEffect(() => {
    const wasShown = showCadastre;
    setShowCadastre(true);
    return () => setShowCadastre(wasShown);
    // Seulement à l'ouverture / fermeture du formulaire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return showCadastre;
}
