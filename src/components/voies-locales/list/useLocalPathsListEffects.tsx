import { useCommune } from "@/contexts/CommuneContext";
import MapContext from "@/contexts/MapContext";
import ThemeContext from "@/contexts/ThemeContext";
import { useContext, useEffect } from "react";
import { LocalPathToolbar } from "./LocalPathsToolbar";
import { VoiesLocalesListMap } from "./LocalPathsListMap";
import { LocalPath } from "../types";

export function useLocalPathsListEffects({
  localPaths,
  hoveredPathId,
}: {
  localPaths: LocalPath[];
  hoveredPathId: string | null;
}) {
  const { setMapChildren } = useContext(MapContext);
  const { setToolbarChildren } = useContext(ThemeContext);
  const { codeInsee: codeCommune } = useCommune();

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
}
