"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Feature, Position, LineString as GeoLineString } from "geojson";
import { RuralPathSurface } from "@/generated/prisma/browser";

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

export interface Segment {
  id: string;
  surface: RuralPathSurface;
  coordinates: Position[];
}

export type DrawMode = "draw" | "select";

export interface UseRuralPathDrawerResult {
  segments: Segment[];
  mode: DrawMode;
  setMode: (m: DrawMode) => void;
  setSurface: (id: string, surface: RuralPathSurface) => void;
  removeSegment: (id: string) => void;
  toMultiLineString: () => GeoJSON.MultiLineString | null;
  surfacesArray: () => RuralPathSurface[];
  isReady: boolean;
}

const DEFAULT_SURFACE = RuralPathSurface.EARTH;

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
  initial: {
    path?: GeoJSON.MultiLineString;
    surfaces: RuralPathSurface[];
  } | null,
): UseRuralPathDrawerResult {
  const drawRef = useRef<TerraDrawInstance | null>(null);
  const initialAppliedRef = useRef(false);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [mode, setModeState] = useState<DrawMode>("draw");
  const [isReady, setIsReady] = useState(false);

  const surfaceMapRef = useRef<Map<string, RuralPathSurface>>(new Map());

  const rebuildFromSnapshot = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const snap = draw.getSnapshot();
    const next: Segment[] = [];
    for (const f of snap) {
      if (!f || f.geometry?.type !== "LineString") continue;
      const id = String(f.id ?? "");
      if (!id) continue;
      const coords = (f.geometry as GeoLineString).coordinates;
      if (!coords || coords.length < 2) continue;
      const surface = surfaceMapRef.current.get(id) ?? DEFAULT_SURFACE;
      surfaceMapRef.current.set(id, surface);
      next.push({ id, surface, coordinates: coords });
    }
    setSegments(next);
  }, []);

  // Cycle de vie Terra Draw.
  useEffect(() => {
    if (!mapRef) return;
    let cancelled = false;
    let draw: TerraDrawInstance | null = null;

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
      const instance = new TerraDraw({
        adapter: new adapterMod.TerraDrawMapLibreGLAdapter({
          map: nativeMap,
        }),
        modes: [
          new TerraDrawLineStringMode(),
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
          }),
        ],
      }) as unknown as TerraDrawInstance;
      draw = instance;
      drawRef.current = instance;

      const onChange = () => rebuildFromSnapshot();
      instance.on("change", onChange);
      instance.on("finish", onChange);

      instance.start();
      instance.setMode("linestring");
      setIsReady(true);

      // Chargement de l'état initial (edit mode)
      if (initial?.path && !initialAppliedRef.current) {
        initialAppliedRef.current = true;
        const features = initial.path.coordinates.map((coords, i) => {
          const id = crypto.randomUUID();
          const surface = initial.surfaces[i] ?? DEFAULT_SURFACE;
          surfaceMapRef.current.set(id, surface);
          return toLineStringFeature(id, coords);
        });
        if (features.length > 0) instance.addFeatures(features);
      }
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
      drawRef.current = null;
      setIsReady(false);
    };
    // On veut initialiser une seule fois par mapRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef]);

  const setMode = useCallback((m: DrawMode) => {
    setModeState(m);
    drawRef.current?.setMode(m === "draw" ? "linestring" : "select");
  }, []);

  const setSurface = useCallback((id: string, surface: RuralPathSurface) => {
    surfaceMapRef.current.set(id, surface);
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, surface } : s)),
    );
  }, []);

  const removeSegment = useCallback((id: string) => {
    surfaceMapRef.current.delete(id);
    drawRef.current?.removeFeatures([id]);
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toMultiLineString = useCallback((): GeoJSON.MultiLineString | null => {
    if (segments.length === 0) return null;
    return {
      type: "MultiLineString",
      coordinates: segments.map((s) => s.coordinates),
    };
  }, [segments]);

  const surfacesArray = useCallback(
    () => segments.map((s) => s.surface),
    [segments],
  );

  return useMemo(
    () => ({
      segments,
      mode,
      setMode,
      setSurface,
      removeSegment,
      toMultiLineString,
      surfacesArray,
      isReady,
    }),
    [
      segments,
      mode,
      setMode,
      setSurface,
      removeSegment,
      toMultiLineString,
      surfacesArray,
      isReady,
    ],
  );
}
