import PanoramaxContext from "@/contexts/PanoramaxContext";
import { useCallback, useContext, useEffect, useRef } from "react";
import {
  Layer,
  LayerProps,
  MapLayerMouseEvent,
  Source,
} from "react-map-gl/maplibre";
import {
  PANORAMAX_LAYERS_SOURCE,
  PANORAMAX_SEQUENCE_LAYER_ID,
  PANORAMAX_SOURCE_ID,
  PANORAMAX_TILE_URL,
  panoramaxPictureLayer,
  panoramaxSequenceLayer,
  resolveNearestPictureAfterDive,
  snapPointToSequenceGeometry,
} from "../layers/panoramax.layers";
import { useRouter } from "next/navigation";
import MapContext from "@/contexts/MapContext";
import { useCommune } from "@/contexts/CommuneContext";

const DIVE_TARGET_ZOOM = 20;
const DIVE_DURATION_MS = 900;

export function PanoramaxMap() {
  const router = useRouter();

  const { codeInsee: codeCommune } = useCommune();
  const { showPanoramax, isDiving, setIsDiving } = useContext(PanoramaxContext);
  const { setSavedFlyToBounds, mapRef } = useContext(MapContext);
  const hoveredSequenceIdRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (
        !feature ||
        feature.sourceLayer !== PANORAMAX_LAYERS_SOURCE.SEQUENCES
      ) {
        return;
      }
      const sequenceId =
        (feature.properties?.id as string | undefined) ??
        (feature.id != null ? String(feature.id) : undefined);
      if (!sequenceId) return;

      if (!mapRef) return;

      // Snap the click to the nearest point on the sequence polyline so the
      // dive lands on the line itself — guaranteeing that picture features
      // from that sequence are queryable around the viewport center after
      // the zoom-in completes.
      const target = snapPointToSequenceGeometry(mapRef, feature, [
        e.lngLat.lng,
        e.lngLat.lat,
      ]);

      // Save current view to restore later (from the viewer page)
      setSavedFlyToBounds(
        mapRef.getBounds().toArray() as [[number, number], [number, number]],
      );

      setIsDiving(true);

      const onMoveEnd = async () => {
        mapRef.off("moveend", onMoveEnd);
        const resolved = await resolveNearestPictureAfterDive(
          mapRef,
          target,
          sequenceId,
        );
        const pictureId = resolved?.id ?? null;
        setIsDiving(false);
        if (pictureId) {
          router.push(
            `/${codeCommune}/panoramax-viewer?pictureID=${encodeURIComponent(pictureId)}`,
          );
        }
      };
      mapRef.on("moveend", onMoveEnd);

      // "Plunge" effect: rapid zoom-in to the target location
      mapRef.easeTo({
        center: target,
        zoom: DIVE_TARGET_ZOOM,
        duration: DIVE_DURATION_MS,
        essential: true,
      });
    },
    [mapRef, router, codeCommune, setIsDiving, setSavedFlyToBounds],
  );

  useEffect(() => {
    if (!mapRef || !showPanoramax) {
      return;
    }

    const setHover = (id: string | null) => {
      const prev = hoveredSequenceIdRef.current;
      if (prev === id) return;
      if (prev) {
        mapRef.setFeatureState(
          {
            source: PANORAMAX_SOURCE_ID,
            sourceLayer: PANORAMAX_LAYERS_SOURCE.SEQUENCES,
            id: prev,
          },
          { hover: false },
        );
      }
      if (id) {
        mapRef.setFeatureState(
          {
            source: PANORAMAX_SOURCE_ID,
            sourceLayer: PANORAMAX_LAYERS_SOURCE.SEQUENCES,
            id,
          },
          { hover: true },
        );
      }
      hoveredSequenceIdRef.current = id;
    };

    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id =
        (f?.properties?.id as string | undefined) ??
        (f?.id != null ? String(f.id) : undefined);
      if (!id) return;
      setHover(id);
      mapRef.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      setHover(null);
      mapRef.getCanvas().style.cursor = "";
    };

    mapRef.on("click", PANORAMAX_SEQUENCE_LAYER_ID, handleClick);
    mapRef.on("mousemove", PANORAMAX_SEQUENCE_LAYER_ID, onMove);
    mapRef.on("mouseleave", PANORAMAX_SEQUENCE_LAYER_ID, onLeave);

    return () => {
      mapRef.off("click", PANORAMAX_SEQUENCE_LAYER_ID, handleClick);
      mapRef.off("mousemove", PANORAMAX_SEQUENCE_LAYER_ID, onMove);
      mapRef.off("mouseleave", PANORAMAX_SEQUENCE_LAYER_ID, onLeave);
      mapRef.getCanvas().style.cursor = "";
      setHover(null);
    };
  }, [mapRef, showPanoramax, handleClick]);

  // Force a re-render when toggled on, so tiles refresh
  useEffect(() => {
    if (mapRef && showPanoramax) {
      mapRef.zoomTo(mapRef.getZoom(), { duration: 0 });
    }
  }, [mapRef, showPanoramax]);

  if (!process.env.NEXT_PUBLIC_PANORAMAX_API_URL) {
    return null;
  }

  return (
    <>
      <Source
        id={PANORAMAX_SOURCE_ID}
        type="vector"
        tiles={[PANORAMAX_TILE_URL]}
        promoteId={{
          [PANORAMAX_LAYERS_SOURCE.SEQUENCES]: "id",
          [PANORAMAX_LAYERS_SOURCE.PICTURES]: "id",
        }}
      >
        {/* Soft blue halo rendered underneath the base line, only on hover. */}
        <Layer
          {...({
            id: "panoramax-sequences-halo",
            "source-layer": PANORAMAX_LAYERS_SOURCE.SEQUENCES,
            type: "line",
            minzoom: panoramaxSequenceLayer.minzoom,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#4845f4",
              "line-blur": 6,
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                18,
                0,
              ],
              "line-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                showPanoramax ? 0.4 : 0,
                0,
              ],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            ...panoramaxSequenceLayer,
            paint: {
              ...panoramaxSequenceLayer.paint,
              "line-color": "#4845f4",
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                7,
                4,
              ],
              "line-opacity": showPanoramax ? 1 : 0,
            },
          } as LayerProps)}
        />
        {/* The picture layer is kept mounted at all times (and visually
            invisible via circle-opacity: 0) so that `queryRenderedFeatures`
            can still resolve the picture nearest to a dive target, even
            after the toggle has been turned off at the end of a drag. */}
        <Layer {...(panoramaxPictureLayer as LayerProps)} />
      </Source>
      {isDiving && <div className="panoramax-overlay" aria-hidden="true" />}
    </>
  );
}
