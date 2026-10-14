"use client";

import { useContext, useEffect, useRef } from "react";
import type { Feature } from "geojson";
import MapContext from "@/contexts/MapContext";
import DrawContext from "@/contexts/DrawContext";

const DRAW_COLOR = "#e1000f";
const MSG_DRAW_POLYGON =
  "Cliquez pour placer les sommets du contour, cliquez sur le premier point pour le fermer. Échap pour annuler.";

// Sous-ensemble de l'API terra-draw utilisé ici (cf. useRuralPathDrawer)
type TerraDrawInstance = {
  start: () => void;
  stop: () => void;
  setMode: (mode: string) => void;
  getSnapshot: () => Feature[];
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

// Dessin d'un polygone sur la carte avec terra-draw, actif tant que `active`
// est vrai. À la fermeture du contour, `onPolygon` reçoit son anneau
// extérieur [[lon, lat], …] (fermé : premier point = dernier point).
export function usePolygonDraw(
  active: boolean,
  onPolygon: (ring: number[][]) => void,
) {
  const { mapRef, setMapMessage } = useContext(MapContext);
  const { setIsDrawing } = useContext(DrawContext);

  // Dernier callback, sans relancer terra-draw à chaque rendu
  const onPolygonRef = useRef(onPolygon);
  useEffect(() => {
    onPolygonRef.current = onPolygon;
  }, [onPolygon]);

  useEffect(() => {
    if (!active || !mapRef) return;
    let cancelled = false;
    let draw: TerraDrawInstance | null = null;

    // Coupe les interactions concurrentes (survol des tuiles, parcelles…)
    setIsDrawing(true);
    setMapMessage(MSG_DRAW_POLYGON);

    (async () => {
      const [{ TerraDraw, TerraDrawPolygonMode }, adapterMod] =
        await Promise.all([
          import("terra-draw"),
          import("terra-draw-maplibre-gl-adapter"),
        ]);
      if (cancelled) return;

      const instance = new TerraDraw({
        adapter: new adapterMod.TerraDrawMapLibreGLAdapter({
          map: mapRef.getMap(),
        }),
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: DRAW_COLOR,
              fillOpacity: 0.1,
              outlineColor: DRAW_COLOR,
              outlineWidth: 2,
              closingPointColor: "#ffffff",
              closingPointOutlineColor: DRAW_COLOR,
              closingPointOutlineWidth: 2,
              closingPointWidth: 6,
              coordinatePointColor: "#ffffff",
              coordinatePointOutlineColor: DRAW_COLOR,
              coordinatePointOutlineWidth: 2,
              coordinatePointWidth: 5,
            },
          }),
        ],
      }) as unknown as TerraDrawInstance;
      draw = instance;

      instance.on("finish", (...args: unknown[]) => {
        const [id] = args as [string | number];
        const feature = instance
          .getSnapshot()
          .find((f) => String(f.id) === String(id));
        if (feature?.geometry.type === "Polygon") {
          onPolygonRef.current(feature.geometry.coordinates[0]);
        }
      });

      instance.start();
      instance.setMode("polygon");
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
      setIsDrawing(false);
      setMapMessage(null);
    };
  }, [active, mapRef, setIsDrawing, setMapMessage]);
}
