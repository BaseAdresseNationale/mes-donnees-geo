"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layer,
  LayerProps,
  MapLayerMouseEvent,
  Popup,
  Source,
  useMap,
} from "react-map-gl/maplibre";
import { useModals } from "@gouvfr-lasuite/ui-components";
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import {
  REVETEMENT_COLORS,
  CLASSEMENT_COLORS,
} from "@/components/voies-locales/types";
import type { LocalPath } from "@/components/voies-locales/types";
import { Segment } from "../useLocalPathDrawer";
import styles from "./LocalPathFormMap.module.css";

const EDIT_SOURCE_ID = "voies-locales-edit";
const EDIT_CASING_LAYER_ID = "voies-locales-edit-casing";
const EDIT_HOVER_HALO_LAYER_ID = "voies-locales-edit-hover-halo";
const EDIT_LINE_LAYER_ID = "voies-locales-edit-line";
const EDIT_HITAREA_LAYER_ID = "voies-locales-edit-hitarea";
const ENDPOINT_SOURCE_ID = "voies-locales-endpoints";
const ENDPOINT_LAYER_ID = "voies-locales-endpoints-circle";
const ENDPOINT_PLUS_LAYER_ID = "voies-locales-endpoints-plus";
const OTHER_SOURCE_ID = "voies-locales-other";
const OTHER_LINE_LAYER_ID = "voies-locales-other-line";
const OTHER_HITAREA_LAYER_ID = "voies-locales-other-hitarea";

// Poignées d'extrémité (apparaissent au survol du chemin) : plus grosses et
// d'une couleur distincte des points de manipulation blancs ; cliquer dessus
// relance le mode dessin.
const ENDPOINT_COLOR = "#ff7a00";

// Couches internes ajoutées par terra-draw-maplibre-gl-adapter (préfixe "td"
// par défaut) : les points de manipulation doivent rester au-dessus.
const TERRA_DRAW_POINT_LAYER_ID = "td-point";
const TERRA_DRAW_POINT_MARKER_LAYER_ID = "td-point-marker";

const REVETEMENT_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "revetement"],
  ...Object.entries(REVETEMENT_COLORS).flatMap(([revetement, color]) => [
    revetement,
    color,
  ]),
  "#4b4bcb",
] as unknown as ExpressionSpecification;

const CLASSEMENT_COLOR_MATCH: ExpressionSpecification = [
  "match",
  ["get", "classement"],
  ...Object.entries(CLASSEMENT_COLORS).flatMap(([classement, color]) => [
    classement,
    color,
  ]),
  "#4b4bcb",
] as unknown as ExpressionSpecification;

export function VoiesLocalesFormMap({
  drawSegments,
  hoveredSegmentId,
  onHoverSegment,
  selectedSegmentId,
  otherPaths,
  mergeablePaths,
  onMergePath,
  onCommitDrawSegment,
}: {
  drawSegments: Segment[];
  hoveredSegmentId?: string | null;
  onHoverSegment?: (id: string | null) => void;
  selectedSegmentId?: string | null;
  otherPaths?: LocalPath[];
  mergeablePaths?: LocalPath[];
  onMergePath?: (path: LocalPath) => void;
  onCommitDrawSegment?: () => boolean;
}) {
  const map = useMap();
  const modals = useModals();
  const [hoveredMergeable, setHoveredMergeable] = useState<{
    pathId: string;
    lng: number;
    lat: number;
  } | null>(null);
  // Coordonne le curseur "pointer" entre le survol d'un segment et celui d'une
  // poignée d'extrémité (zones qui se chevauchent aux extrémités).
  const overSegmentRef = useRef(false);
  const overHandleRef = useRef(false);
  // Un tracé (aperçu "__preview__") est en cours : un clic sur un chemin
  // fusionnable doit d'abord le terminer, avant de proposer la fusion.
  const isDrawingRef = useRef(false);
  useEffect(() => {
    isDrawingRef.current = drawSegments.some((s) => s.id === "__preview__");
  }, [drawSegments]);

  // Aperçu du tracé en cours d'édition (halo blanc + couleur par revêtement).
  const editFeatureCollection = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: drawSegments.map(
        (seg): Feature<LineString> => ({
          type: "Feature",
          id: seg.id,
          properties: { id: seg.id, revetement: seg.revetement },
          geometry: { type: "LineString", coordinates: seg.coordinates },
        }),
      ),
    }),
    [drawSegments],
  );

  // Tous les autres chemins de la commune, affichés en transparence avec le
  // code couleur du classement (vert = chemin rural, bleu = voie communale).
  const otherFeatureCollection = useMemo<
    FeatureCollection<LineString, { pathId: string; classement: string }>
  >(
    () => ({
      type: "FeatureCollection",
      features: (otherPaths ?? []).flatMap((p) =>
        p.segments.map(
          (
            seg,
          ): Feature<LineString, { pathId: string; classement: string }> => ({
            type: "Feature",
            properties: { pathId: p.id, classement: p.classement },
            geometry: seg.path,
          }),
        ),
      ),
    }),
    [otherPaths],
  );

  // Sous-ensemble des autres chemins dont une extrémité est assez proche
  // pour être fusionnée : seuls ceux-ci réagissent au survol/clic.
  const mergeablePathIds = useMemo(
    () => (mergeablePaths ?? []).map((p) => p.id),
    [mergeablePaths],
  );

  // Poignées aux deux extrémités du chemin (hors segment d'aperçu en cours de
  // tracé) : un point à chaque bout de la chaîne contiguë. On MASQUE la poignée
  // à l'extrémité du segment sélectionné (segment externe) pour laisser
  // apparaître le point blanc éditable de terra-draw.
  const endpointFeatureCollection = useMemo<FeatureCollection<Point>>(() => {
    const real = drawSegments.filter((s) => s.id !== "__preview__");
    const first = real[0];
    const last = real.at(-1);
    const start = first?.coordinates[0];
    const end = last?.coordinates.at(-1);
    const features: Feature<Point>[] = [];
    if (start && first && first.id !== selectedSegmentId)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: start },
      });
    if (end && last && last.id !== selectedSegmentId)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: end },
      });
    return { type: "FeatureCollection", features };
  }, [drawSegments, selectedSegmentId]);

  useEffect(() => {
    const m = map.current?.getMap();
    if (!m || !onMergePath) return;

    const onClick = async (e: MapLayerMouseEvent) => {
      const pathId = (e.features?.[0]?.properties as { pathId?: string } | null)
        ?.pathId;
      const path = mergeablePaths?.find((p) => p.id === pathId);
      if (!path) return;
      if (isDrawingRef.current) {
        // Laisse terra-draw terminer le traitement de CE clic (ajout du
        // point exact cliqué) avant de "finir" le segment en cours.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (!onCommitDrawSegment?.()) return;
      }
      const decision = await modals.confirmationModal({
        title: "Fusionner ce chemin ?",
        children: `Fusionner « ${path.nom || "chemin sans nom"} » dans ce chemin ?`,
      });
      if (decision !== "yes") return;
      onMergePath(path);
    };
    const onMove = (e: MapLayerMouseEvent) => {
      const pathId = (e.features?.[0]?.properties as { pathId?: string } | null)
        ?.pathId;
      if (!pathId) return;
      m.getCanvas().style.cursor = "pointer";
      setHoveredMergeable({ pathId, lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    const onLeave = () => {
      m.getCanvas().style.cursor = "";
      setHoveredMergeable(null);
    };

    m.on("click", OTHER_HITAREA_LAYER_ID, onClick);
    m.on("mousemove", OTHER_HITAREA_LAYER_ID, onMove);
    m.on("mouseleave", OTHER_HITAREA_LAYER_ID, onLeave);
    return () => {
      m.off("click", OTHER_HITAREA_LAYER_ID, onClick);
      m.off("mousemove", OTHER_HITAREA_LAYER_ID, onMove);
      m.off("mouseleave", OTHER_HITAREA_LAYER_ID, onLeave);
    };
  }, [map, mergeablePaths, onMergePath, onCommitDrawSegment, modals]);

  // Le survol est masqué si le chemin n'est plus proposé à la fusion (fusionné, retiré...).
  const visibleHoveredMergeable =
    hoveredMergeable && mergeablePathIds.includes(hoveredMergeable.pathId)
      ? hoveredMergeable
      : null;

  // Survol du chemin édité : surligne le segment survolé (même effet que le
  // survol de la liste) et gère le curseur "pointer" sur segments et poignées.
  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const onSegmentMove = (e: MapLayerMouseEvent) => {
      const id = (e.features?.[0]?.properties as { id?: string } | null)?.id;
      overSegmentRef.current = true;
      m.getCanvas().style.cursor = "pointer";
      onHoverSegment?.(id ?? null);
    };
    const onSegmentLeave = () => {
      overSegmentRef.current = false;
      if (!overHandleRef.current) m.getCanvas().style.cursor = "";
      onHoverSegment?.(null);
    };
    const onHandleEnter = () => {
      overHandleRef.current = true;
      m.getCanvas().style.cursor = "pointer";
    };
    const onHandleLeave = () => {
      overHandleRef.current = false;
      if (!overSegmentRef.current) m.getCanvas().style.cursor = "";
    };

    m.on("mousemove", EDIT_HITAREA_LAYER_ID, onSegmentMove);
    m.on("mouseleave", EDIT_HITAREA_LAYER_ID, onSegmentLeave);
    m.on("mouseenter", ENDPOINT_LAYER_ID, onHandleEnter);
    m.on("mouseleave", ENDPOINT_LAYER_ID, onHandleLeave);
    return () => {
      m.off("mousemove", EDIT_HITAREA_LAYER_ID, onSegmentMove);
      m.off("mouseleave", EDIT_HITAREA_LAYER_ID, onSegmentLeave);
      m.off("mouseenter", ENDPOINT_LAYER_ID, onHandleEnter);
      m.off("mouseleave", ENDPOINT_LAYER_ID, onHandleLeave);
    };
  }, [map, onHoverSegment]);

  // Les couches de terra-draw sont ajoutées de façon asynchrone et
  // indépendante des nôtres : on repasse ses points de manipulation
  // au-dessus à chaque mise à jour du tracé, puis les poignées d'extrémité
  // encore au-dessus pour rester visibles/cliquables au survol.
  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;
    const bringPointsToFront = () => {
      if (m.getLayer(TERRA_DRAW_POINT_MARKER_LAYER_ID)) {
        m.moveLayer(TERRA_DRAW_POINT_MARKER_LAYER_ID);
      }
      if (m.getLayer(TERRA_DRAW_POINT_LAYER_ID)) {
        m.moveLayer(TERRA_DRAW_POINT_LAYER_ID);
      }
      if (m.getLayer(ENDPOINT_LAYER_ID)) {
        m.moveLayer(ENDPOINT_LAYER_ID);
      }
      if (m.getLayer(ENDPOINT_PLUS_LAYER_ID)) {
        m.moveLayer(ENDPOINT_PLUS_LAYER_ID);
      }
    };
    bringPointsToFront();
    const timeout = setTimeout(bringPointsToFront, 50);
    return () => clearTimeout(timeout);
  }, [map, editFeatureCollection]);

  return (
    <>
      <Source id={OTHER_SOURCE_ID} type="geojson" data={otherFeatureCollection}>
        <Layer
          {...({
            id: OTHER_LINE_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": CLASSEMENT_COLOR_MATCH,
              "line-width": [
                "case",
                [
                  "==",
                  ["get", "pathId"],
                  visibleHoveredMergeable?.pathId ?? "",
                ],
                6,
                3,
              ],
              "line-opacity": [
                "case",
                [
                  "==",
                  ["get", "pathId"],
                  visibleHoveredMergeable?.pathId ?? "",
                ],
                0.85,
                0.4,
              ],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: OTHER_HITAREA_LAYER_ID,
            type: "line",
            filter: [
              "in",
              ["get", "pathId"],
              ["literal", mergeablePathIds],
            ] as unknown as FilterSpecification,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#000000",
              "line-width": 24,
              "line-opacity": 0,
            },
          } as LayerProps)}
        />
      </Source>
      {visibleHoveredMergeable && (
        <Popup
          longitude={visibleHoveredMergeable.lng}
          latitude={visibleHoveredMergeable.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          offset={14}
          className={styles.mergePopup}
        >
          Chemin contigu, souhaitez-vous le fusionner&nbsp;?
        </Popup>
      )}
      <Source id={EDIT_SOURCE_ID} type="geojson" data={editFeatureCollection}>
        <Layer
          {...({
            id: EDIT_CASING_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#ffffff",
              "line-width": 7,
              "line-opacity": 0.9,
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: EDIT_HOVER_HALO_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": REVETEMENT_COLOR_MATCH,
              "line-blur": 4,
              "line-width": [
                "case",
                ["==", ["get", "id"], hoveredSegmentId ?? ""],
                16,
                0,
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "id"], hoveredSegmentId ?? ""],
                0.5,
                0,
              ],
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: EDIT_LINE_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": REVETEMENT_COLOR_MATCH,
              "line-width": 4,
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: EDIT_HITAREA_LAYER_ID,
            type: "line",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#000000",
              "line-width": 20,
              "line-opacity": 0,
            },
          } as LayerProps)}
        />
      </Source>
      <Source
        id={ENDPOINT_SOURCE_ID}
        type="geojson"
        data={endpointFeatureCollection}
      >
        <Layer
          {...({
            id: ENDPOINT_LAYER_ID,
            type: "circle",
            paint: {
              "circle-radius": 9,
              "circle-color": ENDPOINT_COLOR,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          } as LayerProps)}
        />
        <Layer
          {...({
            id: ENDPOINT_PLUS_LAYER_ID,
            type: "symbol",
            layout: {
              "text-field": "+",
              "text-font": ["Noto Sans Bold"],
              "text-size": 16,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#ffffff",
            },
          } as LayerProps)}
        />
      </Source>
    </>
  );
}
