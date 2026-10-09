import { useCommune } from "@/contexts/CommuneContext";
import MapContext from "@/contexts/MapContext";
import ThemeContext from "@/contexts/ThemeContext";
import { useContext, useEffect, useMemo, useState } from "react";
import { LocalPathToolbar } from "./LocalPathsToolbar";
import {
  VoiesLocalesListMap,
  type PublishHighlight,
} from "./LocalPathsListMap";
import type { PublishHighlightRequest } from "./LocalPathPublishButton";
import { LocalPath } from "../types";
import type { PublicationChange } from "@/lib/publication/types";

export function useLocalPathsListEffects({
  localPaths,
  allLocalPaths,
  hoveredPathId,
  changes,
}: {
  localPaths: LocalPath[];
  allLocalPaths: LocalPath[];
  hoveredPathId: string | null;
  changes: PublicationChange[];
}) {
  const { setMapChildren } = useContext(MapContext);
  const { setToolbarChildren } = useContext(ThemeContext);
  const { codeInsee: codeCommune } = useCommune();
  const [highlightRequest, setHighlightRequest] =
    useState<PublishHighlightRequest | null>(null);

  const highlight = useMemo<PublishHighlight | null>(() => {
    if (!highlightRequest) return null;
    const change = changes.find((c) => c.id === highlightRequest.id);
    if (!change) return null;
    const geometry =
      change.geometry ??
      ({
        type: "MultiLineString",
        coordinates:
          allLocalPaths
            .find((p) => p.id === change.id)
            ?.segments.map((s) => s.path.coordinates) ?? [],
      } satisfies GeoJSON.MultiLineString);
    if (geometry.coordinates.length === 0) return null;
    return { kind: change.kind, geometry, fit: highlightRequest.fit };
  }, [highlightRequest, changes, allLocalPaths]);

  useEffect(() => {
    setToolbarChildren(
      <LocalPathToolbar
        codeCommune={codeCommune}
        changes={changes}
        onHighlight={setHighlightRequest}
      />,
    );

    return () => {
      setToolbarChildren(null);
    };
  }, [codeCommune, setToolbarChildren, changes]);

  useEffect(() => {
    setMapChildren(
      <VoiesLocalesListMap
        codeCommune={codeCommune}
        localPaths={localPaths}
        hoveredPathId={hoveredPathId}
        highlight={highlight}
      />,
    );

    return () => {
      setMapChildren(null);
    };
  }, [setMapChildren, localPaths, codeCommune, hoveredPathId, highlight]);
}
