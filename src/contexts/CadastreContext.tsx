"use client";

import { CadastreService } from "@/lib/geo/cadastre";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCommune } from "./CommuneContext";
import Fuse from "fuse.js";
import { SearchItemType } from "@/components/common/autocomplete";

interface CadastreContextValue {
  showCadastre: boolean;
  setShowCadastre: (show: boolean) => void;
  editParcelles: boolean;
  setEditParcelles: React.Dispatch<React.SetStateAction<boolean>>;
  communeParcellesIds: string[];
  communeParcelles: ParcelleType[];
}

export type ParcelleType = {
  id: string;
  label: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type ParcelleFeature = Omit<ParcelleType, "label">;

export const CadastreContext = createContext<CadastreContextValue>({
  showCadastre: false,
  setShowCadastre: () => {},
  editParcelles: false,
  setEditParcelles: () => {},
  communeParcellesIds: [],
  communeParcelles: [],
});

interface CadastreContextProviderProps {
  children: React.ReactNode;
}

export function CadastreContextProvider({
  children,
}: CadastreContextProviderProps) {
  const { codeInsee } = useCommune();
  const [showCadastre, setShowCadastreState] = useState(false);
  const [editParcelles, setEditParcelles] = useState(false);
  const [communeParcellesIds, setcommuneParcellesIds] = useState<string[]>([]);
  const [communeParcelles, setCommuneParcelles] = useState<ParcelleType[]>([]);

  // Hiding the cadastre also exits edit mode, so both are updated together here.
  const setShowCadastre = useCallback((show: boolean) => {
    setShowCadastreState(show);
    if (!show) {
      setEditParcelles(false);
    }
  }, []);

  useEffect(() => {
    async function fetchCommuneParcelles() {
      try {
        const featureCollection =
          await CadastreService.findCadastreCommune(codeInsee);
        const parcellesIds = featureCollection.features?.map(
          ({ id }) => id,
        ) as string[];
        setcommuneParcellesIds(parcellesIds);

        const parcelles: ParcelleType[] = featureCollection.features?.map(
          (feature) =>
            ({
              id: feature.id,
              label: feature.id,
              geometry: feature.geometry,
            }) as ParcelleType,
        );
        setCommuneParcelles(parcelles);
      } catch (e) {
        console.error("ERROR lors fetch du cadastre", e);
        setCommuneParcelles([]);
      }
    }

    fetchCommuneParcelles();
  }, [codeInsee]);

  const value = useMemo(
    () => ({
      showCadastre,
      setShowCadastre,
      editParcelles,
      setEditParcelles,
      communeParcellesIds,
      communeParcelles,
    }),
    [
      showCadastre,
      setShowCadastre,
      editParcelles,
      setEditParcelles,
      communeParcellesIds,
      communeParcelles,
    ],
  );

  return (
    <CadastreContext.Provider value={value}>
      {children}
    </CadastreContext.Provider>
  );
}

export function useCadastreSearch() {
  const { communeParcelles } = useContext(CadastreContext);
  const fuseRef = useRef<Fuse<SearchItemType<ParcelleType>> | null>(null);

  useEffect(() => {
    if (communeParcelles !== null) {
      fuseRef.current = new Fuse(communeParcelles, {
        keys: ["id"],
        threshold: 0.1,
      });
    }
  }, [communeParcelles]);

  const handleSearchParcelle = async (inputValue: string) => {
    if (!inputValue || !fuseRef.current) {
      return [];
    }

    const fuse = fuseRef.current;
    const results = fuse.search(inputValue, {
      limit: 10,
    });

    return results.map((result) => result.item);
  };

  return {
    handleSearchParcelle,
  };
}

export default CadastreContext;
