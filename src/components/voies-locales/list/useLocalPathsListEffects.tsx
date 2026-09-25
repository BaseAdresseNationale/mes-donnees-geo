import { useCommune } from "@/contexts/CommuneContext";
import MapContext from "@/contexts/MapContext";
import ThemeContext from "@/contexts/ThemeContext";
import { useContext, useEffect, useRef, useState } from "react";
import { LocalPathToolbar } from "./LocalPathsToolbar";
import { VoiesLocalesListMap } from "./LocalPathsListMap";
import { LocalPath } from "../types";

export function useLocalPathsListEffects({
  localPaths,
}: {
  localPaths: LocalPath[];
}) {
  const { setMapChildren, flyToBounds } = useContext(MapContext);
  const { setToolbarChildren } = useContext(ThemeContext);
  const { contour: communeContour, codeInsee: codeCommune } = useCommune();

  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);

  const initialFlyToDoneRef = useRef(false);

  useEffect(() => {
    setToolbarChildren(<LocalPathToolbar codeCommune={codeCommune} />);

    return () => {
      setToolbarChildren(null);
    };
  }, [codeCommune, setToolbarChildren]);

  useEffect(() => {
    setMapChildren(
      <VoiesLocalesListMap
        codeCommune={codeCommune}
        localPaths={localPaths}
        hoveredPathId={hoveredPathId}
      />,
    );

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, localPaths, codeCommune, hoveredPathId]);

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
