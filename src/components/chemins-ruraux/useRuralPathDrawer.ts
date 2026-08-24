"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Feature, Position, LineString as GeoLineString } from "geojson";
import {
  RuralPathDomanialite,
  RuralPathEtat,
  RuralPathSurface,
} from "@/generated/prisma/browser";
import type { RuralPathSegment } from "./types";
import DrawContext from "@/contexts/DrawContext";

type CartesianPoint = { x: number; y: number };

type SnappableContext = {
  currentCoordinate?: number;
  project: (lng: number, lat: number) => CartesianPoint;
};

type TerraDrawMouseEvent = {
  lng: number;
  lat: number;
  containerX: number;
  containerY: number;
};

type TerraDrawInstance = {
  start: () => void;
  stop: () => void;
  setMode: (mode: string) => void;
  addFeatures: (features: Feature[]) => unknown;
  removeFeatures: (ids: (string | number)[]) => void;
  getSnapshot: () => Feature[];
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off: (event: string, cb: (...args: unknown[]) => void) => void;
};

export interface SegmentAttributes {
  surface: RuralPathSurface;
  largeurMoyenne: number | null;
  etatEntretien: RuralPathEtat | null;
  etatConservation: RuralPathEtat | null;
  domanialite: RuralPathDomanialite | null;
}

export interface Segment extends SegmentAttributes {
  id: string;
  coordinates: Position[];
}

export interface SegmentInput {
  path: GeoJSON.LineString;
  surface: RuralPathSurface;
  largeurMoyenne: number | null;
  etatEntretien: RuralPathEtat | null;
  etatConservation: RuralPathEtat | null;
  domanialite: RuralPathDomanialite | null;
}

export type DrawMode = "draw" | "select";

export interface UseRuralPathDrawerResult {
  segments: Segment[];
  previewCoordinates: Position[] | null;
  mode: DrawMode;
  setMode: (m: DrawMode) => void;
  updateSegmentAttributes: (
    id: string,
    patch: Partial<SegmentAttributes>,
  ) => void;
  removeSegment: (id: string) => void;
  toSegmentsInput: () => SegmentInput[];
  isReady: boolean;
}

const DEFAULT_ATTRIBUTES: SegmentAttributes = {
  surface: RuralPathSurface.EARTH,
  largeurMoyenne: null,
  etatEntretien: null,
  etatConservation: null,
  domanialite: null,
};

// Distance, en pixels écran, en dessous de laquelle le premier point d'un
// nouveau segment est aimanté à une extrémité du chemin existant.
const SNAP_PIXEL_DISTANCE = 25;
// Tolérance, en mètres, pour considérer que deux points coïncident.
const SNAP_TOLERANCE_METERS = 2;

const MSG_DRAW_START =
  "Cliquez sur la carte pour commencer à tracer le chemin, double-cliquez pour terminer le segment.";
const MSG_DRAW_CONTINUE =
  "Reprenez le tracé depuis une extrémité du chemin (surlignée), double-cliquez pour terminer le segment.";
const MSG_SELECT = "Cliquez-glissez un point du tracé pour ajuster le chemin.";
const MSG_INVALID_SEGMENT =
  "Le nouveau segment doit partir d'une extrémité du chemin existant.";
const MSG_INVALID_DELETE =
  "Seuls le premier et le dernier segment du chemin peuvent être supprimés.";
const ERROR_MESSAGE_DURATION_MS = 3500;

function metersBetween(a: Position, b: Position): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const latRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lng2 - lng1) * 111320 * Math.cos(latRad);
  const dy = (lat2 - lat1) * 110540;
  return Math.sqrt(dx * dx + dy * dy);
}

function isSamePoint(a: Position, b: Position): boolean {
  return metersBetween(a, b) <= SNAP_TOLERANCE_METERS;
}

function toLineStringFeature(
  id: string,
  coordinates: Position[],
): Feature<GeoLineString> {
  return {
    id,
    type: "Feature",
    properties: { mode: "linestring" },
    geometry: { type: "LineString", coordinates },
  };
}

export function useRuralPathDrawer(
  mapRef: MapRef | null,
  setMapMessage: (message: string | null) => void,
  initial: {
    segments: RuralPathSegment[];
  } | null,
): UseRuralPathDrawerResult {
  const drawRef = useRef<TerraDrawInstance | null>(null);
  const initialAppliedRef = useRef(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [previewCoordinates, setPreviewCoordinates] = useState<
    Position[] | null
  >(null);
  const [mode, setModeState] = useState<DrawMode>("draw");
  const [isReady, setIsReady] = useState(false);
  const { setIsDrawing } = useContext(DrawContext);

  const segmentsRef = useRef<Segment[]>([]);
  const modeRef = useRef<DrawMode>("draw");
  const setMapMessageRef = useRef(setMapMessage);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    setMapMessageRef.current = setMapMessage;
  }, [setMapMessage]);

  useEffect(() => {
    setIsDrawing(true);

    return () => setIsDrawing(false);
  }, [setIsDrawing]);

  const guidanceMessage = useCallback(() => {
    if (modeRef.current === "select") return MSG_SELECT;
    return segmentsRef.current.length === 0
      ? MSG_DRAW_START
      : MSG_DRAW_CONTINUE;
  }, []);

  const showTemporaryError = useCallback(
    (message: string) => {
      setMapMessageRef.current(message);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        setMapMessageRef.current(guidanceMessage());
      }, ERROR_MESSAGE_DURATION_MS);
    },
    [guidanceMessage],
  );

  const setMode = useCallback(
    (m: DrawMode) => {
      setModeState(m);
      drawRef.current?.setMode(m === "draw" ? "linestring" : "select");
      modeRef.current = m;
      setPreviewCoordinates(null);
      setMapMessageRef.current(guidanceMessage());
    },
    [guidanceMessage],
  );

  const updateSegmentsFromIds = useCallback((ids: (string | number)[]) => {
    const draw = drawRef.current;
    if (!draw) return;
    const changedIds = new Set(ids.map(String));
    const snap = draw.getSnapshot();
    setSegments((prev) =>
      prev.map((seg) => {
        if (!changedIds.has(seg.id)) return seg;
        const f = snap.find((f) => String(f.id) === seg.id);
        if (!f || f.geometry?.type !== "LineString") return seg;
        const coords = (f.geometry as GeoLineString).coordinates;
        if (!coords || coords.length < 2) return seg;
        return { ...seg, coordinates: coords };
      }),
    );
  }, []);

  // Aperçu en direct du segment en cours de tracé (pas encore finalisé).
  // Annule immédiatement le tracé si son premier point n'est pas (ou plus,
  // une fois aimanté) sur une extrémité du chemin existant, plutôt que
  // d'attendre la fin du tracé pour le rejeter.
  const updatePreviewFromSnapshot = useCallback(
    (initial: { segments: RuralPathSegment[] } | null) => {
      const draw = drawRef.current;
      if (!draw) return;

      const knownIds = new Set([
        ...segmentsRef.current.map((s) => s.id),
        ...(initial?.segments.map((s) => s.id) || []),
      ]);
      const wip = draw.getSnapshot().find((f) => {
        return f.geometry?.type === "LineString" && !knownIds.has(String(f.id));
      });
      if (!wip) {
        setPreviewCoordinates(null);
        return;
      }
      const coords = (wip.geometry as GeoLineString).coordinates;
      if (!coords || coords.length === 0) {
        setPreviewCoordinates(null);
        return;
      }

      const chain = segmentsRef.current;
      if (chain.length > 0) {
        const chainStart = chain[0].coordinates[0];
        const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
        const firstPoint = coords[0];
        if (
          !isSamePoint(firstPoint, chainStart) &&
          !isSamePoint(firstPoint, chainEnd)
        ) {
          setPreviewCoordinates(null);
          showTemporaryError(MSG_INVALID_SEGMENT);
          // Différé : on est encore dans la pile d'appel du clic qui vient de
          // créer ce tracé ; annuler ici casserait l'état interne du mode.
          setTimeout(() => drawRef.current?.setMode("linestring"), 0);
          return;
        }
      }

      setPreviewCoordinates(coords.length >= 2 ? coords : null);
    },
    [showTemporaryError],
  );

  const handleFinish = useCallback(
    (id: string) => {
      const draw = drawRef.current;
      if (!draw) return;
      setPreviewCoordinates(null);
      const snap = draw.getSnapshot();
      const f = snap.find((f) => String(f.id) === id);
      if (!f || f.geometry?.type !== "LineString") return;
      const coords = (f.geometry as GeoLineString).coordinates;
      if (!coords || coords.length < 2) {
        draw.removeFeatures([id]);
        return;
      }

      const chain = segmentsRef.current;
      if (chain.length === 0) {
        setSegments([{ id, ...DEFAULT_ATTRIBUTES, coordinates: coords }]);
        setMapMessageRef.current(MSG_DRAW_CONTINUE);
        return;
      }

      const chainStart = chain[0].coordinates[0];
      const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
      const newStart = coords[0];

      let next: Segment[] | null = null;
      if (isSamePoint(newStart, chainEnd)) {
        next = [...chain, { id, ...DEFAULT_ATTRIBUTES, coordinates: coords }];
      } else if (isSamePoint(newStart, chainStart)) {
        next = [
          {
            id,
            ...DEFAULT_ATTRIBUTES,
            coordinates: [...coords].reverse(),
          },
          ...chain,
        ];
      }

      if (next) {
        setSegments(next);
        setMapMessageRef.current(MSG_DRAW_CONTINUE);
      } else {
        draw.removeFeatures([id]);
        showTemporaryError(MSG_INVALID_SEGMENT);
      }
    },
    [showTemporaryError],
  );

  // Cycle de vie Terra Draw.
  useEffect(() => {
    if (!mapRef) return;
    let cancelled = false;
    let draw: TerraDrawInstance | null = null;
    let removeContextMenuListener: (() => void) | null = null;

    (async () => {
      const [
        { TerraDraw, TerraDrawLineStringMode, TerraDrawSelectMode },
        adapterMod,
      ] = await Promise.all([
        import("terra-draw"),
        import("terra-draw-maplibre-gl-adapter"),
      ]);
      if (cancelled) return;

      const nativeMap = mapRef.getMap();
      // Ligne invisible : le tracé "réel" (halo blanc + couleur par
      // revêtement, y compris l'aperçu en cours de dessin) est entièrement
      // pris en charge par CheminsRurauxMap, sans risque de conflit d'ordre
      // d'empilement avec les couches internes de l'adaptateur MapLibre.
      const neutralLineStyle = {
        lineStringColor: "#3f97e0" as const,
        lineStringWidth: 2,
        lineStringOpacity: 0,
      };
      // Points de manipulation (sommets, points de fermeture/aimantation) :
      // blanc à contour noir, quel que soit le mode.
      const pointStyle = {
        color: "#ffffff" as const,
        outlineColor: "#1a1a1a" as const,
        outlineWidth: 2,
        width: 6,
      };
      const instance = new TerraDraw({
        adapter: new adapterMod.TerraDrawMapLibreGLAdapter({
          map: nativeMap,
        }),
        modes: [
          new TerraDrawLineStringMode({
            styles: {
              ...neutralLineStyle,
              closingPointColor: pointStyle.color,
              closingPointOutlineColor: pointStyle.outlineColor,
              closingPointOutlineWidth: pointStyle.outlineWidth,
              closingPointWidth: pointStyle.width,
              snappingPointColor: pointStyle.color,
              snappingPointOutlineColor: pointStyle.outlineColor,
              snappingPointOutlineWidth: pointStyle.outlineWidth,
              snappingPointWidth: pointStyle.width,
              coordinatePointColor: pointStyle.color,
              coordinatePointOutlineColor: pointStyle.outlineColor,
              coordinatePointOutlineWidth: pointStyle.outlineWidth,
              coordinatePointWidth: pointStyle.width,
            },
            snapping: {
              // N'aimante que le premier point d'un nouveau segment, vers
              // l'une des deux extrémités du chemin déjà tracé.
              toCustom: (
                event: TerraDrawMouseEvent,
                context: SnappableContext,
              ) => {
                if (context.currentCoordinate !== 0) return undefined;
                const chain = segmentsRef.current;
                if (chain.length === 0) return undefined;
                const candidates: Position[] = [
                  chain[0].coordinates[0],
                  chain[chain.length - 1].coordinates.at(-1)!,
                ];
                let best: Position | undefined;
                let bestDist = Infinity;
                for (const c of candidates) {
                  const p = context.project(c[0], c[1]);
                  const dx = p.x - event.containerX;
                  const dy = p.y - event.containerY;
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d < bestDist) {
                    bestDist = d;
                    best = c;
                  }
                }
                return bestDist <= SNAP_PIXEL_DISTANCE ? best : undefined;
              },
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              linestring: {
                feature: {
                  draggable: false,
                  coordinates: {
                    midpoints: false,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            },
            styles: {
              selectedLineStringColor: neutralLineStyle.lineStringColor,
              selectedLineStringWidth: neutralLineStyle.lineStringWidth,
              selectedLineStringOpacity: neutralLineStyle.lineStringOpacity,
              selectionPointColor: pointStyle.color,
              selectionPointOutlineColor: pointStyle.outlineColor,
              selectionPointOutlineWidth: pointStyle.outlineWidth,
              selectionPointWidth: pointStyle.width,
              midPointColor: pointStyle.color,
              midPointOutlineColor: pointStyle.outlineColor,
              midPointOutlineWidth: pointStyle.outlineWidth,
              midPointWidth: pointStyle.width,
            },
          }),
        ],
      }) as unknown as TerraDrawInstance;
      draw = instance;
      drawRef.current = instance;

      instance.on("change", (...args: unknown[]) => {
        const [ids, type] = args as [(string | number)[], string];
        if (modeRef.current === "select" && type === "update") {
          updateSegmentsFromIds(ids);
        } else if (modeRef.current === "draw") {
          updatePreviewFromSnapshot(initial);
        }
      });
      instance.on("finish", (...args: unknown[]) => {
        // Le mode select émet aussi "finish" après un glisser de sommet
        // (dragCoordinate/dragCoordinateResize/dragFeature) : ce n'est pas
        // un nouveau segment tracé, sinon il serait dupliqué dans la chaîne.
        if (modeRef.current !== "draw") return;
        const [id] = args as [string | number];
        handleFinish(String(id));
      });

      // Clic droit = annuler le segment en cours de tracé (comme la touche
      // Echap), sans changer de mode ni le menu contextuel du navigateur.
      const onContextMenu = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (modeRef.current !== "draw") return;
        setPreviewCoordinates(null);
        // Différé : re-déclencher le même mode force terra-draw à nettoyer
        // (stop+cleanup+start) le tracé en cours sans casser son état interne.
        setTimeout(() => drawRef.current?.setMode("linestring"), 0);
      };
      nativeMap.on("contextmenu", onContextMenu);
      removeContextMenuListener = () =>
        nativeMap.off("contextmenu", onContextMenu);

      instance.start();
      instance.setMode("linestring");
      setIsReady(true);

      // Chargement de l'état initial (edit mode). Les id des segments DB
      // sont réutilisés comme id de feature terra-draw (mêmes UUID).
      let hasInitialSegments = false;
      if (initial?.segments.length && !initialAppliedRef.current) {
        initialAppliedRef.current = true;
        const initSegments: Segment[] = initial.segments.map((s) => ({
          id: s.id,
          coordinates: s.path.coordinates,
          surface: s.surface,
          largeurMoyenne: s.largeurMoyenne ?? null,
          etatEntretien: s.etatEntretien ?? null,
          etatConservation: s.etatConservation ?? null,
          domanialite: s.domanialite ?? null,
        }));
        if (initSegments.length > 0) {
          instance.addFeatures(
            initSegments.map((s) => toLineStringFeature(s.id, s.coordinates)),
          );
          setSegments(initSegments);
          hasInitialSegments = true;
        }
      }
      // `segmentsRef` n'est pas encore synchronisé (le setSegments ci-dessus
      // n'a pas encore re-rendu) : on calcule le message directement.
      setMapMessageRef.current(
        hasInitialSegments ? MSG_DRAW_CONTINUE : MSG_DRAW_START,
      );
    })().catch((err) => {
      console.error("Terra Draw init failed", err);
    });

    return () => {
      cancelled = true;
      try {
        draw?.stop();
      } catch {
        // ignore
      }
      removeContextMenuListener?.();
      drawRef.current = null;
      setIsReady(false);
      // React StrictMode invoque cet effet deux fois au montage (dev) : sans
      // cette remise à zéro, la 2e invocation (celle qui survit) trouverait le
      // flag déjà à `true` et ne rechargerait jamais le tracé existant.
      initialAppliedRef.current = false;
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setMapMessageRef.current(null);
    };
    // On veut initialiser une seule fois par mapRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef]);

  const updateSegmentAttributes = useCallback(
    (id: string, patch: Partial<SegmentAttributes>) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const removeSegment = useCallback(
    (id: string) => {
      const chain = segmentsRef.current;
      const idx = chain.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const isOuterSegment = idx === 0 || idx === chain.length - 1;
      if (!isOuterSegment) {
        showTemporaryError(MSG_INVALID_DELETE);
        return;
      }
      drawRef.current?.removeFeatures([id]);
      setSegments((prev) => prev.filter((s) => s.id !== id));
    },
    [showTemporaryError],
  );

  const toSegmentsInput = useCallback(
    (): SegmentInput[] =>
      segments.map((s) => ({
        path: { type: "LineString", coordinates: s.coordinates },
        surface: s.surface,
        largeurMoyenne: s.largeurMoyenne,
        etatEntretien: s.etatEntretien,
        etatConservation: s.etatConservation,
        domanialite: s.domanialite,
      })),
    [segments],
  );

  return useMemo(
    () => ({
      segments,
      previewCoordinates,
      mode,
      setMode,
      updateSegmentAttributes,
      removeSegment,
      toSegmentsInput,
      isReady,
    }),
    [
      segments,
      previewCoordinates,
      mode,
      setMode,
      updateSegmentAttributes,
      removeSegment,
      toSegmentsInput,
      isReady,
    ],
  );
}
