"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface CadastreContextValue {
  showCadastre: boolean;
  setShowCadastre: (show: boolean) => void;
  editParcelles: boolean;
  setEditParcelles: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CadastreContext = createContext<CadastreContextValue>({
  showCadastre: false,
  setShowCadastre: () => {},
  editParcelles: false,
  setEditParcelles: () => {},
});

export function CadastreContextProvider(props: { children: React.ReactNode }) {
  const [showCadastre, setShowCadastreState] = useState(false);
  const [editParcelles, setEditParcelles] = useState(false);

  // Hiding the cadastre also exits edit mode, so both are updated together here.
  const setShowCadastre = useCallback((show: boolean) => {
    setShowCadastreState(show);
    if (!show) {
      setEditParcelles(false);
    }
  }, []);

  // Update cadastre toggle button
  useEffect(() => {
    const cadastreToggleBtn = document.getElementById("cadastre-toggle");
    if (cadastreToggleBtn) {
      cadastreToggleBtn.title = showCadastre
        ? "Masquer le cadastre"
        : "Afficher le cadastre";
      showCadastre
        ? cadastreToggleBtn.classList.add("active")
        : cadastreToggleBtn.classList.remove("active");
    }
  }, [showCadastre]);

  const value = useMemo(
    () => ({
      showCadastre,
      setShowCadastre,
      editParcelles,
      setEditParcelles,
    }),
    [showCadastre, setShowCadastre, editParcelles, setEditParcelles],
  );

  return <CadastreContext.Provider value={value} {...props} />;
}

export default CadastreContext;
