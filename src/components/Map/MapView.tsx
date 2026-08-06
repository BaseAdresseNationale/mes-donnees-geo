"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  Point,
  LineString,
  Polygon,
  MultiPolygon,
} from "geojson";
import { v4 as uuidv4 } from "uuid";
import type { GeometryKind, PluginLayerStyle } from "@/plugins/types";
import styles from "./MapView.module.css";

const SOURCE_ID = "plugin-source";
const LAYER_POINT = "plugin-points";
const LAYER_LINE = "plugin-lines";
const LAYER_POLY = "plugin-polygons";
const LAYER_POLY_OUTLINE = "plugin-polygons-outline";
const HIGHLIGHT_ID = "plugin-highlight";
const COMMUNE_SOURCE = "commune-contour";
const COMMUNE_OUTLINE = "commune-contour-outline";
const COMMUNE_MASK = "commune-contour-mask";

const IGN_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "ign-plan": {
      type: "raster",
      tiles: [
        "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
      ],
      tileSize: 256,
      attribution: "© IGN — Géoplateforme",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "ign-plan-layer", type: "raster", source: "ign-plan" },
  ],
};

type DrawMode = "select" | "point" | "line" | "polygon";

interface MapViewProps {
  pluginId: string;
  layerStyle: PluginLayerStyle;
  geometryTypes: GeometryKind[];
  data: FeatureCollection;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (feature: Feature<Geometry>) => void;
  communeContour?: Feature<Polygon | MultiPolygon> | null;
}

export function MapView({
  pluginId,
  layerStyle,
  geometryTypes,
  data,
  selectedId,
  onSelect,
  onCreate,
  communeContour,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<DrawMode>("select");
  const [pendingCoords, setPendingCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: IGN_STYLE,
      center: [2.5, 46.5],
      zoom: 5.5,
      attributionControl: { compact: false },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }));

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(HIGHLIGHT_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(COMMUNE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: COMMUNE_MASK,
        type: "fill",
        source: COMMUNE_SOURCE,
        paint: {
          "fill-color": "#000091",
          "fill-opacity": 0.04,
        },
      });
      map.addLayer({
        id: COMMUNE_OUTLINE,
        type: "line",
        source: COMMUNE_SOURCE,
        paint: {
          "line-color": "#000091",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });

      map.addLayer({
        id: LAYER_POLY,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": layerStyle.color,
          "fill-opacity": layerStyle.fillOpacity ?? 0.3,
        },
      });
      map.addLayer({
        id: LAYER_POLY_OUTLINE,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": layerStyle.outlineColor ?? layerStyle.color,
          "line-width": 2,
        },
      });
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": layerStyle.color,
          "line-width": layerStyle.lineWidth ?? 3,
        },
      });
      map.addLayer({
        id: LAYER_POINT,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": layerStyle.color,
          "circle-radius": layerStyle.circleRadius ?? 6,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "highlight-line",
        type: "line",
        source: HIGHLIGHT_ID,
        paint: {
          "line-color": "#ffb703",
          "line-width": 4,
        },
      });
      map.addLayer({
        id: "highlight-point",
        type: "circle",
        source: HIGHLIGHT_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#ffb703",
          "circle-radius": 10,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 2,
        },
      });

      setReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [layerStyle]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource(SOURCE_ID);
    if (src && "setData" in src) {
      (src as maplibregl.GeoJSONSource).setData(data);
    }
  }, [ready, data]);

  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (!ready || !mapRef.current || !communeContour) return;
    const map = mapRef.current;
    const src = map.getSource(COMMUNE_SOURCE);
    if (src && "setData" in src) {
      (src as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [communeContour],
      });
    }
    if (!initialFitDoneRef.current) {
      const bounds = geometryBounds(communeContour.geometry);
      if (bounds) {
        map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 16 });
        initialFitDoneRef.current = true;
      }
    }
  }, [ready, communeContour]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const highlight = mapRef.current.getSource(HIGHLIGHT_ID);
    if (!highlight || !("setData" in highlight)) return;
    const selected = data.features.find((f) => String(f.id) === selectedId);
    (highlight as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: selected ? [selected] : [],
    });
  }, [ready, data, selectedId]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (mode === "select") {
        const feats = map.queryRenderedFeatures(e.point, {
          layers: [LAYER_POINT, LAYER_LINE, LAYER_POLY],
        });
        if (feats.length > 0) {
          const id = feats[0].id ?? feats[0].properties?.id;
          if (id != null) onSelect(String(id));
        } else {
          onSelect(null);
        }
        return;
      }

      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (mode === "point") {
        const point: Point = { type: "Point", coordinates: coord };
        const feat: Feature<Point> = {
          type: "Feature",
          id: uuidv4(),
          geometry: point,
          properties: {},
        };
        onCreate(feat);
        setMode("select");
        return;
      }

      setPendingCoords((prev) => [...prev, coord]);
    };

    map.getCanvas().style.cursor = mode === "select" ? "" : "crosshair";
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [ready, mode, onSelect, onCreate]);

  const finishDrawing = useCallback(() => {
    if (mode === "line" && pendingCoords.length >= 2) {
      const geom: LineString = { type: "LineString", coordinates: pendingCoords };
      onCreate({ type: "Feature", id: uuidv4(), geometry: geom, properties: {} });
    } else if (mode === "polygon" && pendingCoords.length >= 3) {
      const ring = [...pendingCoords, pendingCoords[0]];
      const geom: Polygon = { type: "Polygon", coordinates: [ring] };
      onCreate({ type: "Feature", id: uuidv4(), geometry: geom, properties: {} });
    }
    setPendingCoords([]);
    setMode("select");
  }, [mode, pendingCoords, onCreate]);

  const cancelDrawing = useCallback(() => {
    setPendingCoords([]);
    setMode("select");
  }, []);

  useEffect(() => {
    if (!selectedId || !ready || !mapRef.current) return;
    const feat = data.features.find((f) => String(f.id) === selectedId);
    if (!feat) return;
    const bounds = geometryBounds(feat.geometry);
    if (bounds) mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 500 });
  }, [selectedId, data, ready]);

  return (
    <div className={styles.mapWrapper}>
      <div className={styles.toolbar} role="toolbar" aria-label="Outils d'édition">
        <button
          type="button"
          onClick={() => {
            setMode("select");
            setPendingCoords([]);
          }}
          aria-pressed={mode === "select"}
          className={mode === "select" ? styles.toolActive : styles.tool}
        >
          Sélection
        </button>
        {geometryTypes.includes("Point") && (
          <button
            type="button"
            onClick={() => {
              setMode("point");
              setPendingCoords([]);
            }}
            aria-pressed={mode === "point"}
            className={mode === "point" ? styles.toolActive : styles.tool}
          >
            Ajouter un point
          </button>
        )}
        {geometryTypes.includes("LineString") && (
          <button
            type="button"
            onClick={() => {
              setMode("line");
              setPendingCoords([]);
            }}
            aria-pressed={mode === "line"}
            className={mode === "line" ? styles.toolActive : styles.tool}
          >
            Tracer une ligne
          </button>
        )}
        {geometryTypes.includes("Polygon") && (
          <button
            type="button"
            onClick={() => {
              setMode("polygon");
              setPendingCoords([]);
            }}
            aria-pressed={mode === "polygon"}
            className={mode === "polygon" ? styles.toolActive : styles.tool}
          >
            Tracer un polygone
          </button>
        )}
        {(mode === "line" || mode === "polygon") && (
          <>
            <span className={styles.hint} aria-live="polite">
              {pendingCoords.length} point{pendingCoords.length > 1 ? "s" : ""} placé
              {pendingCoords.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={finishDrawing}
              disabled={
                (mode === "line" && pendingCoords.length < 2) ||
                (mode === "polygon" && pendingCoords.length < 3)
              }
              className={styles.tool}
            >
              Terminer
            </button>
            <button type="button" onClick={cancelDrawing} className={styles.tool}>
              Annuler
            </button>
          </>
        )}
      </div>
      <div
        ref={containerRef}
        className={styles.map}
        role="application"
        aria-label={`Carte interactive pour le module ${pluginId}. Utiliser la liste des entités à gauche pour une navigation clavier complète.`}
        tabIndex={0}
      />
    </div>
  );
}

function geometryBounds(geom: Geometry): [[number, number], [number, number]] | null {
  const coords: [number, number][] = [];
  const push = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push([c[0], c[1]]);
    } else if (Array.isArray(c)) {
      c.forEach(push);
    }
  };
  push(geom.type === "GeometryCollection" ? [] : (geom as { coordinates: unknown }).coordinates);
  if (coords.length === 0) return null;
  let [minX, minY] = coords[0];
  let [maxX, maxY] = coords[0];
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}
