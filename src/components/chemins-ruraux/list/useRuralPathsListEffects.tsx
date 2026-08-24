import { useCommune } from "@/contexts/CommuneContext";
import MapContext from "@/contexts/MapContext";
import ThemeContext from "@/contexts/ThemeContext";
import { useContext, useEffect, useRef, useState } from "react";
import { RuralPathToolbar } from "./RuralPathsToolbar";
import { CheminsRurauxListMap } from "./RuralPathsListMap";
import { RuralPath } from "../types";

export function useRuralPathsListEffects({
  ruralPaths,
}: {
  ruralPaths: RuralPath[];
}) {
  const { setMapChildren, flyToBounds } = useContext(MapContext);
  const { setToolbarChildren } = useContext(ThemeContext);
  const { contour: communeContour, codeInsee: codeCommune } = useCommune();

  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setToolbarChildren(<RuralPathToolbar codeCommune={codeCommune} />);

    return () => {
      setToolbarChildren(null);
    };
  }, [codeCommune, setToolbarChildren]);

  useEffect(() => {
    setMapChildren(
      <CheminsRurauxListMap
        codeCommune={codeCommune}
        ruralPaths={ruralPaths}
        hoveredPathId={hoveredPathId}
      />,
    );

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, ruralPaths, codeCommune, hoveredPathId]);

  useEffect(() => {
    if (!initialFlyToDoneRef.current) {
      if (flyToBounds()) {
        initialFlyToDoneRef.current = true;
      }
    }
  }, [communeContour, flyToBounds]);

  return {
    setHoveredPathId,
  };
}
