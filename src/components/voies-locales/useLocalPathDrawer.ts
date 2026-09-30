"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type { MapRef } from "react-map-gl/maplibre";
import type { Feature, Position, LineString as GeoLineString } from "geojson";
import {
  LocalPathBornage,
  LocalPathEtat,
  LocalPathRevetement,
  LocalPathServitude,
  LocalPathType,
} from "@/generated/prisma/browser";
import type { LocalPath, LocalPathSegment } from "./types";
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
  selectFeature: (id: string | number, selectMode?: string) => void;
  deselectFeature: (id: string | number) => void;
  updateFeatureGeometry: (id: string | number, geometry: GeoLineString) => void;
  addFeatures: (features: Feature[]) => unknown;
  removeFeatures: (ids: (string | number)[]) => void;
  getSnapshot: () => Feature[];
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off: (event: string, cb: (...args: unknown[]) => void) => void;
};

export interface SegmentAttributes {
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
  etat: LocalPathEtat;
  fermeALaCirculation: boolean | null;
  servitudes: LocalPathServitude[];
  bornage: LocalPathBornage | null;
}

export interface Segment extends SegmentAttributes {
  id: string;
  coordinates: Position[];
}

export interface SegmentInput {
  path: GeoJSON.LineString;
  type: LocalPathType;
  revetement: LocalPathRevetement;
  largeurMoyenne: number | null;
  etat: LocalPathEtat;
  fermeALaCirculation: boolean | null;
  servitudes: LocalPathServitude[];
  bornage: LocalPathBornage | null;
}

export type DrawMode = "draw" | "select";

export interface UseLocalPathDrawerResult {
  segments: Segment[];
  previewCoordinates: Position[] | null;
  mode: DrawMode;
  setMode: (m: DrawMode) => void;
  selectedSegmentId: string | null;
  selectSegment: (id: string | null) => void;
  updateSegmentAttributes: (
    id: string,
    patch: Partial<SegmentAttributes>,
  ) => void;
  removeSegment: (id: string) => void;
  commitDrawSegment: () => boolean;
  toSegmentsInput: () => SegmentInput[];
  isReady: boolean;
  mergedPathIds: string[];
  mergePath: (otherPath: LocalPath) => void;
}

const DEFAULT_ATTRIBUTES: SegmentAttributes = {
  type: LocalPathType.TRONCON,
  revetement: LocalPathRevetement.NON_REVETU,
  largeurMoyenne: null,
  etat: LocalPathEtat.BON,
  fermeALaCirculation: null,
  servitudes: [],
  bornage: null,
};

// Distance, en pixels écran, en dessous de laquelle le premier point d'un
// nouveau segment est aimanté à une extrémité du chemin existant.
const SNAP_PIXEL_DISTANCE = 25;
// Distance, en pixels écran, en dessous de laquelle un clic sur un segment
// (hors extrémité) bascule automatiquement en mode sélection.
const HIT_PIXEL_DISTANCE = 12;
// Tolérance, en mètres, pour considérer que deux points coïncident.
const SNAP_TOLERANCE_METERS = 2;
// Distance max, en mètres, entre deux extrémités pour autoriser la fusion de
// deux chemins (plus tolérant que SNAP_TOLERANCE_METERS : les tronçons importés
// ne se touchent pas toujours exactement).
export const MERGE_TOLERANCE_METERS = 15;

const MSG_DRAW_START =
  "Cliquez sur la carte pour commencer à tracer le chemin, double-cliquez pour terminer le segment.";
const MSG_DRAW_CONTINUE =
  "Reprenez le tracé depuis une extrémité du chemin (surlignée), double-cliquez pour terminer le segment.";
const MSG_SELECT = "Cliquez-glissez un point du tracé pour ajuster le chemin.";
const MSG_INVALID_SEGMENT =
  "Le nouveau segment doit partir d'une extrémité du chemin existant.";
const MSG_INVALID_DELETE =
  "Seuls le premier et le dernier segment du chemin peuvent être supprimés.";
const MSG_MERGE_TOO_FAR = `Ce chemin est trop éloigné (> ${MERGE_TOLERANCE_METERS} m) pour être fusionné.`;
const MSG_MERGE_SUCCESS =
  "Chemin fusionné : enregistrez pour valider la fusion.";
const ERROR_MESSAGE_DURATION_MS = 3500;

export function metersBetween(a: Position, b: Position): number {
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

// Égalité stricte de coordonnées (mêmes nombres) : sert à détecter qu'un
// sommet partagé a bougé pour le répercuter sur le segment voisin.
function samePointExact(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

// terra-draw REJETTE (à `addFeatures`) toute feature dont une coordonnée
// dépasse sa précision (9 décimales : `Math.round(v*1e9)/1e9`) — les segments
// venus de la base (coordonnées double précision) ne seraient alors pas ajoutés
// au store, donc ni sélectionnables ni éditables. On arrondit à l'identique et
// on laisse tomber une éventuelle 3e composante (Z) avant de les fournir.
const COORD_PRECISION_FACTOR = 1e9;
function roundCoordinate(coord: Position): Position {
  return [
    Math.round(coord[0] * COORD_PRECISION_FACTOR) / COORD_PRECISION_FACTOR,
    Math.round(coord[1] * COORD_PRECISION_FACTOR) / COORD_PRECISION_FACTOR,
  ];
}
function roundCoordinates(coords: Position[]): Position[] {
  return coords.map(roundCoordinate);
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

// Calcule la chaîne obtenue en ajoutant un nouveau segment (fini ou en cours
// de tracé) à l'une des deux extrémités de la chaîne existante — `null` si son
// premier point ne correspond à aucune des deux (segment non contigu).
function computeChainAfterAppend(
  chain: Segment[],
  id: string,
  coords: Position[],
): Segment[] | null {
  if (chain.length === 0) {
    return [{ id, ...DEFAULT_ATTRIBUTES, coordinates: coords }];
  }
  const chainStart = chain[0].coordinates[0];
  const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
  const newStart = coords[0];
  if (isSamePoint(newStart, chainEnd)) {
    return [...chain, { id, ...DEFAULT_ATTRIBUTES, coordinates: coords }];
  }
  if (isSamePoint(newStart, chainStart)) {
    return [
      { id, ...DEFAULT_ATTRIBUTES, coordinates: [...coords].reverse() },
      ...chain,
    ];
  }
  return null;
}

export function useLocalPathDrawer(
  mapRef: MapRef | null,
  setMapMessage: (message: string | null) => void,
  initial: {
    segments: LocalPathSegment[];
  } | null,
): UseLocalPathDrawerResult {
  const drawRef = useRef<TerraDrawInstance | null>(null);
  const initialAppliedRef = useRef(false);
  // Un tracé WIP (premier point placé, pas encore terminé par double-clic)
  // ne doit jamais être interrompu par le changement de mode automatique.
  const wipFeatureRef = useRef(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [previewCoordinates, setPreviewCoordinates] = useState<
    Position[] | null
  >(null);
  const [mode, setModeState] = useState<DrawMode>("draw");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);
  const [mergedPathIds, setMergedPathIds] = useState<string[]>([]);
  const { setIsDrawing } = useContext(DrawContext);

  const segmentsRef = useRef<Segment[]>([]);
  const modeRef = useRef<DrawMode>("draw");
  const selectedIdRef = useRef<string | null>(null);
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

  // Met à jour l'état React (mode/message) sans toucher à terra-draw : utile
  // quand terra-draw a déjà changé de mode lui-même (ex. `instance.selectFeature`).
  const applyModeState = useCallback(
    (m: DrawMode) => {
      setModeState(m);
      modeRef.current = m;
      setPreviewCoordinates(null);
      setMapMessageRef.current(guidanceMessage());
    },
    [guidanceMessage],
  );

  const setMode = useCallback(
    (m: DrawMode) => {
      drawRef.current?.setMode(m === "draw" ? "linestring" : "select");
      applyModeState(m);
    },
    [applyModeState],
  );

  const applySelected = useCallback((id: string | null) => {
    selectedIdRef.current = id;
    setSelectedSegmentId(id);
  }, []);

  // Sélectionne un segment (mode select, ses points de tracé apparaissent) ou,
  // avec `null`, désélectionne et repasse en mode dessin. Appelé par
  // l'accordéon (action programmatique) ; la sélection déclenchée par un clic
  // carte est gérée nativement par terra-draw (events `select`/`deselect`).
  const selectSegment = useCallback(
    (id: string | null) => {
      const draw = drawRef.current;
      if (!draw) return;
      const prev = selectedIdRef.current;
      if (id === null) {
        // Désélection simple : terra-draw reste en mode select (au repos),
        // on ne bascule PAS en dessin (cohérent avec la désélection native).
        if (prev != null) {
          try {
            draw.deselectFeature(prev);
          } catch {
            // ignore
          }
        }
        applySelected(null);
        return;
      }
      if (prev === id) return;
      if (prev != null) {
        try {
          draw.deselectFeature(prev);
        } catch {
          // ignore
        }
      }
      try {
        draw.selectFeature(id);
      } catch {
        // ignore
      }
      applySelected(id);
      applyModeState("select");
    },
    [applyModeState, applySelected],
  );

  const updateSegmentsFromIds = useCallback((ids: (string | number)[]) => {
    const draw = drawRef.current;
    if (!draw) return;
    const changedIds = new Set(ids.map(String));
    const snap = draw.getSnapshot();

    const next = segmentsRef.current.map((seg) => {
      if (!changedIds.has(seg.id)) return seg;
      const f = snap.find((f) => String(f.id) === seg.id);
      if (!f || f.geometry?.type !== "LineString") return seg;
      const coords = (f.geometry as GeoLineString).coordinates;
      if (!coords || coords.length < 2) return seg;
      return { ...seg, coordinates: coords };
    });

    // Un sommet aux extrémités d'un segment est partagé avec le segment voisin
    // (chaîne contiguë) : on y propage le déplacement pour ne jamais créer de
    // trou dans le chemin, même si le voisin n'est pas sélectionné.
    const neighborUpdates: { id: string; coordinates: Position[] }[] = [];
    for (let k = 0; k < next.length; k++) {
      if (!changedIds.has(next[k].id)) continue;
      const newStart = next[k].coordinates[0];
      const newEnd = next[k].coordinates.at(-1)!;
      if (k > 0) {
        const left = next[k - 1];
        if (!samePointExact(left.coordinates.at(-1)!, newStart)) {
          const coords = [...left.coordinates];
          coords[coords.length - 1] = newStart;
          next[k - 1] = { ...left, coordinates: coords };
          neighborUpdates.push({ id: left.id, coordinates: coords });
        }
      }
      if (k < next.length - 1) {
        const right = next[k + 1];
        if (!samePointExact(right.coordinates[0], newEnd)) {
          const coords = [...right.coordinates];
          coords[0] = newEnd;
          next[k + 1] = { ...right, coordinates: coords };
          neighborUpdates.push({ id: right.id, coordinates: coords });
        }
      }
    }

    // `flushSync` : ce handler est déclenché par les évènements natifs bruts
    // de terra-draw (pointermove) pendant un glisser, en dehors du système
    // d'évènements React — sans ça, React peut différer/regrouper la mise à
    // jour tant que le flux de pointermove continue, et la ligne éditée
    // (`EDIT_LINE_LAYER_ID`, qui dépend de ce state via plusieurs composants)
    // ne se met visuellement à jour qu'à l'arrêt du geste (désélection).
    flushSync(() => setSegments(next));

    for (const u of neighborUpdates) {
      try {
        draw.updateFeatureGeometry(u.id, {
          type: "LineString",
          coordinates: u.coordinates,
        });
      } catch {
        // ignore
      }
    }
  }, []);

  // Aperçu en direct du segment en cours de tracé (pas encore finalisé).
  // Annule immédiatement le tracé si son premier point n'est pas (ou plus,
  // une fois aimanté) sur une extrémité du chemin existant, plutôt que
  // d'attendre la fin du tracé pour le rejeter.
  const updatePreviewFromSnapshot = useCallback(
    (initial: { segments: LocalPathSegment[] } | null) => {
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
        wipFeatureRef.current = false;
        setPreviewCoordinates(null);
        return;
      }
      const coords = (wip.geometry as GeoLineString).coordinates;
      if (!coords || coords.length === 0) {
        wipFeatureRef.current = false;
        setPreviewCoordinates(null);
        return;
      }
      wipFeatureRef.current = true;

      const chain = segmentsRef.current;
      if (chain.length > 0) {
        const chainStart = chain[0].coordinates[0];
        const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
        const firstPoint = coords[0];
        if (
          !isSamePoint(firstPoint, chainStart) &&
          !isSamePoint(firstPoint, chainEnd)
        ) {
          wipFeatureRef.current = false;
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
      wipFeatureRef.current = false;
      setPreviewCoordinates(null);
      const snap = draw.getSnapshot();
      const f = snap.find((f) => String(f.id) === id);
      if (!f || f.geometry?.type !== "LineString") return;
      const coords = (f.geometry as GeoLineString).coordinates;
      if (!coords || coords.length < 2) {
        draw.removeFeatures([id]);
        return;
      }

      const next = computeChainAfterAppend(segmentsRef.current, id, coords);
      if (next) {
        segmentsRef.current = next;
        setSegments(next);
        setMapMessageRef.current(MSG_DRAW_CONTINUE);
      } else {
        draw.removeFeatures([id]);
        showTemporaryError(MSG_INVALID_SEGMENT);
      }
    },
    [showTemporaryError],
  );

  // Termine immédiatement le segment en cours de tracé (sans attendre un
  // double-clic) pour l'insérer dans la chaîne : utilisé quand un clic en
  // cours de tracé tombe sur un chemin fusionnable, avant de proposer la
  // fusion (avec ou sans fusion ensuite, ce segment reste acquis).
  const commitDrawSegment = useCallback((): boolean => {
    const draw = drawRef.current;
    if (!draw) return false;
    const knownIds = new Set(segmentsRef.current.map((s) => s.id));
    const wip = draw
      .getSnapshot()
      .find(
        (f) => f.geometry?.type === "LineString" && !knownIds.has(String(f.id)),
      );
    if (!wip) return false;
    const wipId = String(wip.id);
    const coords = (wip.geometry as GeoLineString).coordinates;
    wipFeatureRef.current = false;
    setPreviewCoordinates(null);
    if (!coords || coords.length < 2) {
      draw.removeFeatures([wipId]);
      return false;
    }
    const next = computeChainAfterAppend(segmentsRef.current, wipId, coords);
    if (!next) {
      draw.removeFeatures([wipId]);
      showTemporaryError(MSG_INVALID_SEGMENT);
      return false;
    }
    const finalCoords = next.find((s) => s.id === wipId)!.coordinates;
    draw.removeFeatures([wipId]);
    // Reset propre du mode dessin (vide currentId/closingPoint internes), puis
    // réinsertion comme segment ordinaire (même id) : n'est plus "en cours"
    // pour terra-draw, comme un segment fusionné.
    draw.setMode("linestring");
    draw.addFeatures([toLineStringFeature(wipId, finalCoords)]);
    segmentsRef.current = next;
    setSegments(next);
    setMapMessageRef.current(MSG_DRAW_CONTINUE);
    return true;
  }, [showTemporaryError]);

  // Cycle de vie Terra Draw.
  useEffect(() => {
    if (!mapRef) return;
    let cancelled = false;
    let draw: TerraDrawInstance | null = null;
    let removeContextMenuListener: (() => void) | null = null;
    let removeMouseDownListener: (() => void) | null = null;

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
      // pris en charge par VoiesLocalesMap, sans risque de conflit d'ordre
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
            // Raccourcis clavier natifs désactivés : la suppression est gérée
            // par nous (`removeSegment`, extrémités uniquement + sync voisin).
            keyEvents: {
              deselect: null,
              delete: null,
              rotate: null,
              scale: null,
            },
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
      instance.on("select", (...args: unknown[]) => {
        // terra-draw a sélectionné un segment (clic natif ou `selectFeature`) :
        // on synchronise l'état React (accordéon + mode select).
        const [id] = args as [string | number];
        applySelected(String(id));
        applyModeState("select");
      });
      instance.on("deselect", () => {
        // Désélection (clic hors trait, ou avant de sélectionner un autre
        // segment) : on referme l'accordéon. On NE touche PAS au mode — terra-
        // draw reste en select (mode au repos) ; changer `modeRef` ici sans
        // rebasculer terra-draw le désynchroniserait (le clic sur une poignée
        // d'extrémité ne repasserait alors plus en dessin).
        applySelected(null);
      });

      // Clic droit = annuler le segment en cours de tracé (comme la touche
      // Echap), sans changer de mode ni le menu contextuel du navigateur.
      const onContextMenu = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (modeRef.current !== "draw") return;
        wipFeatureRef.current = false;
        setPreviewCoordinates(null);
        // Différé : re-déclencher le même mode force terra-draw à nettoyer
        // (stop+cleanup+start) le tracé en cours sans casser son état interne.
        setTimeout(() => drawRef.current?.setMode("linestring"), 0);
      };
      nativeMap.on("contextmenu", onContextMenu);
      removeContextMenuListener = () =>
        nativeMap.off("contextmenu", onContextMenu);

      // Choix automatique du mode selon l'endroit PRESSÉ (plus de boutons
      // Dessiner/Sélectionner) : près d'une extrémité → dessin (relance le
      // tracé), sur un segment → sélection (terra-draw sélectionne nativement
      // au `pointerup`). On agit au `mousedown` (avant que terra-draw ne traite
      // le clic/relâchement) et on ne change le mode QUE s'il diffère, pour ne
      // pas interrompre un glisser de sommet en cours.
      const projectToPixel = (coord: Position) => {
        const p = nativeMap.project(coord as [number, number]);
        return { x: p.x, y: p.y };
      };
      const pixelDistance = (
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => Math.hypot(a.x - b.x, a.y - b.y);
      const distanceToSegmentPx = (
        p: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return pixelDistance(p, a);
        const t = Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq),
        );
        return pixelDistance(p, { x: a.x + t * dx, y: a.y + t * dy });
      };
      const minDistanceToLinePx = (
        coordinates: Position[],
        point: { x: number; y: number },
      ) => {
        const projected = coordinates.map(projectToPixel);
        let min = Infinity;
        for (let i = 0; i < projected.length - 1; i++) {
          min = Math.min(
            min,
            distanceToSegmentPx(point, projected[i], projected[i + 1]),
          );
        }
        return min;
      };
      const onModeDecideMouseDown = (e: {
        point: { x: number; y: number };
      }) => {
        // Ne jamais interrompre un tracé en cours (premier point déjà posé).
        if (wipFeatureRef.current) return;
        const chain = segmentsRef.current;
        if (chain.length === 0) return;
        const chainStart = chain[0].coordinates[0];
        const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
        const endpointDist = Math.min(
          pixelDistance(projectToPixel(chainStart), e.point),
          pixelDistance(projectToPixel(chainEnd), e.point),
        );
        let target: DrawMode | null = null;
        if (endpointDist <= SNAP_PIXEL_DISTANCE) {
          target = "draw";
        } else if (
          chain.some(
            (seg) =>
              minDistanceToLinePx(seg.coordinates, e.point) <=
              HIT_PIXEL_DISTANCE,
          )
        ) {
          target = "select";
        }
        // Ne rien faire sur un clic dans le vide (laisse terra-draw
        // désélectionner de lui-même) ni si le mode est déjà le bon (sinon on
        // couperait un glisser de sommet qui démarre au même `pointerdown`).
        if (target && target !== modeRef.current) setMode(target);
      };
      nativeMap.on("mousedown", onModeDecideMouseDown);
      removeMouseDownListener = () =>
        nativeMap.off("mousedown", onModeDecideMouseDown);

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
          coordinates: roundCoordinates(s.path.coordinates),
          type: s.type,
          revetement: s.revetement,
          largeurMoyenne: s.largeurMoyenne ?? null,
          etat: s.etat,
          fermeALaCirculation: s.fermeALaCirculation ?? null,
          servitudes: s.servitudes ?? [],
          bornage: s.bornage ?? null,
        }));
        if (initSegments.length > 0) {
          instance.addFeatures(
            initSegments.map((s) => toLineStringFeature(s.id, s.coordinates)),
          );
          setSegments(initSegments);
          hasInitialSegments = true;
        }
      }
      // Chemin existant : on part en mode sélection (rien de sélectionné) —
      // presser un segment le sélectionne, presser une extrémité relance le
      // dessin. Chemin vide : on reste en dessin pour tracer le 1er segment.
      if (hasInitialSegments) {
        instance.setMode("select");
        modeRef.current = "select";
        setModeState("select");
      }
      // `segmentsRef` n'est pas encore synchronisé (le setSegments ci-dessus
      // n'a pas encore re-rendu) : on calcule le message directement.
      setMapMessageRef.current(
        hasInitialSegments ? MSG_SELECT : MSG_DRAW_START,
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
      removeMouseDownListener?.();
      drawRef.current = null;
      setIsReady(false);
      // React StrictMode invoque cet effet deux fois au montage (dev) : sans
      // cette remise à zéro, la 2e invocation (celle qui survit) trouverait le
      // flag déjà à `true` et ne rechargerait jamais le tracé existant.
      initialAppliedRef.current = false;
      wipFeatureRef.current = false;
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
      if (selectedIdRef.current === id) {
        selectSegment(null);
      }
      drawRef.current?.removeFeatures([id]);
      setSegments((prev) => prev.filter((s) => s.id !== id));
    },
    [showTemporaryError, selectSegment],
  );

  // Fusionne un autre chemin (LocalPath) dans la chaîne en cours : ses segments
  // deviennent des segments du chemin édité, accolés à l'extrémité la plus
  // proche. Un éventuel petit écart entre les deux tracés est comblé en
  // amenant le point de jonction exactement au contact (pas de trou).
  const mergePath = useCallback(
    (otherPath: LocalPath) => {
      const chain = segmentsRef.current;
      if (chain.length === 0 || otherPath.segments.length === 0) return;

      const chainStart = chain[0].coordinates[0];
      const chainEnd = chain[chain.length - 1].coordinates.at(-1)!;
      const otherStart = otherPath.segments[0].path.coordinates[0];
      const otherEnd = otherPath.segments.at(-1)!.path.coordinates.at(-1)!;

      const candidates = [
        {
          dist: metersBetween(chainEnd, otherStart),
          place: "append" as const,
          reverse: false,
        },
        {
          dist: metersBetween(chainEnd, otherEnd),
          place: "append" as const,
          reverse: true,
        },
        {
          dist: metersBetween(chainStart, otherEnd),
          place: "prepend" as const,
          reverse: false,
        },
        {
          dist: metersBetween(chainStart, otherStart),
          place: "prepend" as const,
          reverse: true,
        },
      ];
      const best = candidates.reduce((a, b) => (b.dist < a.dist ? b : a));

      if (best.dist > MERGE_TOLERANCE_METERS) {
        showTemporaryError(MSG_MERGE_TOO_FAR);
        return;
      }

      let toAdd: Segment[] = otherPath.segments.map((s) => ({
        id: s.id,
        coordinates: roundCoordinates(s.path.coordinates),
        type: s.type,
        revetement: s.revetement,
        largeurMoyenne: s.largeurMoyenne ?? null,
        etat: s.etat,
        fermeALaCirculation: s.fermeALaCirculation ?? null,
        servitudes: s.servitudes ?? [],
        bornage: s.bornage ?? null,
      }));
      if (best.reverse) {
        toAdd = [...toAdd]
          .reverse()
          .map((s) => ({ ...s, coordinates: [...s.coordinates].reverse() }));
      }

      // Snap : remplace le point de jonction pour supprimer tout écart résiduel.
      if (best.place === "append") {
        toAdd[0] = {
          ...toAdd[0],
          coordinates: [chainEnd, ...toAdd[0].coordinates.slice(1)],
        };
      } else {
        const lastIdx = toAdd.length - 1;
        toAdd[lastIdx] = {
          ...toAdd[lastIdx],
          coordinates: [...toAdd[lastIdx].coordinates.slice(0, -1), chainStart],
        };
      }

      drawRef.current?.addFeatures(
        toAdd.map((s) => toLineStringFeature(s.id, s.coordinates)),
      );
      setSegments((prev) =>
        best.place === "append" ? [...prev, ...toAdd] : [...toAdd, ...prev],
      );
      setMergedPathIds((prev) => [...prev, otherPath.id]);
      showTemporaryError(MSG_MERGE_SUCCESS);
    },
    [showTemporaryError],
  );

  const toSegmentsInput = useCallback(
    (): SegmentInput[] =>
      segments.map((s) => ({
        path: { type: "LineString", coordinates: s.coordinates },
        type: s.type,
        revetement: s.revetement,
        largeurMoyenne: s.largeurMoyenne,
        etat: s.etat,
        fermeALaCirculation: s.fermeALaCirculation,
        servitudes: s.servitudes,
        bornage: s.bornage,
      })),
    [segments],
  );

  return useMemo(
    () => ({
      segments,
      previewCoordinates,
      mode,
      setMode,
      selectedSegmentId,
      selectSegment,
      updateSegmentAttributes,
      removeSegment,
      commitDrawSegment,
      toSegmentsInput,
      isReady,
      mergedPathIds,
      mergePath,
    }),
    [
      segments,
      previewCoordinates,
      mode,
      setMode,
      selectedSegmentId,
      selectSegment,
      updateSegmentAttributes,
      removeSegment,
      commitDrawSegment,
      toSegmentsInput,
      isReady,
      mergedPathIds,
      mergePath,
    ],
  );
}
