"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { MapView } from "@/components/Map/MapView";
import { FeatureList } from "@/components/Map/FeatureList";
import { useCommune } from "@/components/CommuneContext";
import type { GeometryKind, PluginLayerStyle } from "@/plugins/types";
import styles from "./PluginWorkspace.module.css";

interface PluginWorkspaceProps {
  pluginId: string;
  pluginLabel: string;
  pluginDescription: string;
  geometryTypes: GeometryKind[];
  layerStyle: PluginLayerStyle;
  initialData: FeatureCollection;
}

export function PluginWorkspace({
  pluginId,
  pluginLabel,
  pluginDescription,
  geometryTypes,
  layerStyle,
  initialData,
}: PluginWorkspaceProps) {
  const commune = useCommune();
  const [features, setFeatures] = useState<Feature<Geometry>[]>(initialData.features);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    setFeatures(initialData.features);
    setSelectedId(null);
  }, [initialData, pluginId]);

  const collection = useMemo<FeatureCollection>(
    () => ({ type: "FeatureCollection", features }),
    [features],
  );

  const handleCreate = useCallback(
    async (feature: Feature<Geometry>) => {
      const res = await fetch(`/api/plugins/${pluginId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feature),
      });
      if (!res.ok) {
        setAnnouncement("Erreur lors de la création de l'entité.");
        return;
      }
      const saved = (await res.json()) as Feature<Geometry>;
      setFeatures((prev) => [...prev, saved]);
      setSelectedId(String(saved.id));
      setAnnouncement("Nouvelle entité créée.");
    },
    [pluginId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/plugins/${pluginId}/features/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setAnnouncement("Erreur lors de la suppression.");
        return;
      }
      setFeatures((prev) => prev.filter((f) => String(f.id) !== id));
      if (selectedId === id) setSelectedId(null);
      setAnnouncement("Entité supprimée.");
    },
    [pluginId, selectedId],
  );

  return (
    <section
      className={styles.workspace}
      id={`plugin-panel-${pluginId}`}
      role="tabpanel"
      aria-labelledby={`plugin-tab-${pluginId}`}
    >
      <div className={styles.sidebar}>
        <header className={styles.header}>
          <h1 className={styles.title}>{pluginLabel}</h1>
          <p className={styles.description}>{pluginDescription}</p>
        </header>
        <FeatureList
          features={features}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDelete}
        />
      </div>
      <div className={styles.mapArea}>
        <MapView
          pluginId={pluginId}
          layerStyle={layerStyle}
          geometryTypes={geometryTypes}
          data={collection}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          communeContour={commune.contour}
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
