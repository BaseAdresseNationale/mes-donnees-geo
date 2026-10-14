"use client";

import { useContext, useEffect, useRef, useState } from "react";
import type { Feature } from "geojson";
import MapContext from "@/contexts/MapContext";
import DrawContext from "@/contexts/DrawContext";

const LINE_COLOR = "#000091" as const;
const MSG_DRAW_LINE =
  "Cliquez sur la carte pour placer le début de la voie, puis ajoutez des points. Cliquez sur le dernier point pour terminer.";
const MSG_EDIT_LINE =
  "Déplacez les points pour modifier le tracé, ou cliquez sur un point intermédiaire pour en ajouter un.";

// Sous-ensemble de l'API terra-draw utilisé ici (cf. useRuralPathDrawer)
type TerraDrawInstance = {
  start: () => void;
  stop: () => void;
  setMode: (mode: string) => void;
  addFeatures: (features: Feature[]) => unknown;
  removeFeatures: (ids: (string | number)[]) => void;
  selectFeature: (id: string | number) => void;
  getSnapshot: () => Feature[];
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

function lineFeature(id: string, coordinates: number[][]): Feature {
  return {
    id,
    type: "Feature",
    properties: { mode: "linestring" },
    geometry: { type: "LineString", coordinates },
  };
}

// Dessin puis modification d'une ligne (tracé de voie) avec terra-draw, actif
// tant que `active` est vrai.
// - sans ligne : mode dessin ; à la fin du tracé, `onChange(coordinates)` ;
// - avec ligne : sommets déplaçables, chaque modification → `onChange` ;
// - `line` repassé à null (ex. « Effacer le tracé ») : retour au mode dessin.
export function useLineDraw(
  active: boolean,
  line: number[][] | null,
  onChange: (coordinates: number[][]) => void,
) {
  const { mapRef, setMapMessage } = useContext(MapContext);
  const { setIsDrawing } = useContext(DrawContext);

  const drawRef = useRef<TerraDrawInstance | null>(null);
  // Id terra-draw de la ligne en cours (null tant qu'aucune ligne)
  const featureIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // Derniers ligne / callback, sans relancer terra-draw à chaque rendu
  const lineRef = useRef(line);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    lineRef.current = line;
    onChangeRef.current = onChange;
  }, [line, onChange]);

  useEffect(() => {
    if (!active || !mapRef) return;
    let cancelled = false;
    let draw: TerraDrawInstance | null = null;

    // Coupe les interactions concurrentes (survol des tuiles, parcelles…)
    setIsDrawing(true);

    const lineCoordinates = (id: string) => {
      const feature = draw?.getSnapshot().find((f) => String(f.id) === id);
      return feature?.geometry.type === "LineString"
        ? feature.geometry.coordinates
        : null;
    };

    const editLine = (id: string) => {
      featureIdRef.current = id;
      draw?.setMode("select");
      draw?.selectFeature(id);
      setMapMessage(MSG_EDIT_LINE);
    };

    (async () => {
      const [
        { TerraDraw, TerraDrawLineStringMode, TerraDrawSelectMode },
        adapterMod,
      ] = await Promise.all([
        import("terra-draw"),
        import("terra-draw-maplibre-gl-adapter"),
      ]);
      if (cancelled) return;

      const pointStyle = {
        color: "#ffffff" as const,
        outlineColor: LINE_COLOR,
        outlineWidth: 2,
        width: 6,
      };
      const instance = new TerraDraw({
        adapter: new adapterMod.TerraDrawMapLibreGLAdapter({
          map: mapRef.getMap(),
        }),
        modes: [
          new TerraDrawLineStringMode({
            styles: {
              lineStringColor: LINE_COLOR,
              lineStringWidth: 4,
              closingPointColor: pointStyle.color,
              closingPointOutlineColor: pointStyle.outlineColor,
              closingPointOutlineWidth: pointStyle.outlineWidth,
              closingPointWidth: pointStyle.width,
              coordinatePointColor: pointStyle.color,
              coordinatePointOutlineColor: pointStyle.outlineColor,
              coordinatePointOutlineWidth: pointStyle.outlineWidth,
              coordinatePointWidth: pointStyle.width,
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              linestring: {
                feature: {
                  draggable: false,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            },
            styles: {
              selectedLineStringColor: LINE_COLOR,
              selectedLineStringWidth: 4,
              selectionPointColor: pointStyle.color,
              selectionPointOutlineColor: pointStyle.outlineColor,
              selectionPointOutlineWidth: pointStyle.outlineWidth,
              selectionPointWidth: pointStyle.width,
              midPointColor: pointStyle.color,
              midPointOutlineColor: pointStyle.outlineColor,
              midPointOutlineWidth: pointStyle.outlineWidth,
              midPointWidth: 4,
            },
          }),
        ],
      }) as unknown as TerraDrawInstance;
      draw = instance;
      drawRef.current = instance;

      // Fin du dessin : la ligne passe en modification
      instance.on("finish", (...args: unknown[]) => {
        const id = String((args as [string | number])[0]);
        if (featureIdRef.current) return; // fin d'un déplacement de sommet
        const coordinates = lineCoordinates(id);
        if (!coordinates || coordinates.length < 2) return;
        onChangeRef.current(coordinates);
        // Différé : changer de mode pendant l'événement casse terra-draw
        setTimeout(() => editLine(id), 0);
      });

      // Modification de la ligne (sommet déplacé, ajouté ou supprimé)
      instance.on("change", (...args: unknown[]) => {
        const [ids, type] = args as [(string | number)[], string];
        const id = featureIdRef.current;
        if (type !== "update" || !id || !ids.map(String).includes(id)) return;
        const coordinates = lineCoordinates(id);
        if (coordinates && coordinates.length >= 2) {
          onChangeRef.current(coordinates);
        }
      });

      instance.start();
      const initial = lineRef.current;
      if (initial && initial.length >= 2) {
        const id = crypto.randomUUID();
        instance.addFeatures([lineFeature(id, initial)]);
        editLine(id);
      } else {
        instance.setMode("linestring");
        setMapMessage(MSG_DRAW_LINE);
      }
      setReady(true);
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
      featureIdRef.current = null;
      setReady(false);
      setIsDrawing(false);
      setMapMessage(null);
    };
  }, [active, mapRef, setIsDrawing, setMapMessage]);

  // Ligne effacée depuis le formulaire : retour au mode dessin
  useEffect(() => {
    const draw = drawRef.current;
    const id = featureIdRef.current;
    if (!ready || !draw || line !== null || !id) return;
    featureIdRef.current = null;
    draw.setMode("linestring");
    draw.removeFeatures([id]);
    setMapMessage(MSG_DRAW_LINE);
  }, [ready, line, setMapMessage]);
}
