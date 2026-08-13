"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { FeatureList } from "@/components/Map/FeatureList";
import { useCommune } from "@/contexts/CommuneContext";
import type { GeometryKind, PluginLayerStyle } from "@/plugins/types";
import styles from "./PluginWorkspace.module.css";
import ThemeContext from "@/contexts/ThemeContext";
import { PluginSelectionDropDown } from "./PluginSelectionDropDown";
import { CommuneSettings } from "./CommuneSettings";
import { MapLayout } from "@/layouts/MapLayout";

interface PluginWorkspaceProps {
  pluginId: string;
  pluginLabel: string;
  pluginDescription: string;
  geometryTypes: GeometryKind[];
  layerStyle: PluginLayerStyle;
  initialData: FeatureCollection;
  user: {
    email: string;
    fullName: string;
  };
}

export function PluginWorkspace({
  pluginId,
  pluginLabel,
  geometryTypes,
  layerStyle,
  initialData,
  user,
}: PluginWorkspaceProps) {
  const commune = useCommune();
  const [features, setFeatures] = useState<Feature<Geometry>[]>(
    initialData.features,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setFeatures(initialData.features);
    setSelectedId(null);
  }

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

  const { isLeftPanelOpen } = useContext(ThemeContext);

  return (
    <MapLayout
      user={user}
      isLeftPanelOpen={isLeftPanelOpen}
      leftPanelContent={
        <div
          className={styles.sidebar}
          id={`plugin-panel-${pluginId}`}
          role="tabpanel"
          aria-labelledby={`plugin-tab-${pluginId}`}
        >
          <header className={styles.header}>
            <CommuneSettings currentPluginId={pluginId} />
            <PluginSelectionDropDown
              pluginId={pluginId}
              pluginLabel={pluginLabel}
            />
          </header>
          <FeatureList
            features={features}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      }
    />
  );
}
