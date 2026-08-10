"use client";

import { redirect } from "next/navigation";
import { useCallback, useContext, useMemo, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  LaGaufreV2,
  MainLayout,
  UserMenu,
} from "@gouvfr-lasuite/ui-components";
import { MapView } from "@/components/Map/MapView";
import { FeatureList } from "@/components/Map/FeatureList";
import { useCommune } from "@/contexts/CommuneContext";
import type { GeometryKind, PluginLayerStyle } from "@/plugins/types";
import styles from "./PluginWorkspace.module.css";
import ThemeContext from "@/contexts/ThemeContext";
import { PluginSelectionDropDown } from "./PluginSelectionDropDown";
import { CommuneSettings } from "./CommuneSettings";
import Image from "next/image";

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

  const handleLogout = useCallback(() => {
    // Navigation plein-page requise : un fetch suivrait la redirection vers
    // ProConnect en arrière-plan sans effacer le cookie SSO du navigateur.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/logout";
    document.body.appendChild(form);
    form.submit();
  }, []);

  return (
    <MainLayout
      icon={
        <span className="headerLogo">
          <Image
            src={`/images/logo.svg`}
            alt="Logo Mes données géo"
            width={32}
            height={32}
          />
          <b>Mes données géo</b>
        </span>
      }
      rightHeaderContent={
        <>
          <UserMenu
            logout={handleLogout}
            user={{
              email: user.email,
              full_name: user.fullName,
            }}
          />
          <LaGaufreV2
            apiUrl="https://lasuite.numerique.gouv.fr/api/services"
            widgetPath="https://static.suite.anct.gouv.fr/widgets/lagaufre.js"
          />
        </>
      }
      isLeftPanelOpen={isLeftPanelOpen}
      leftPanelContent={
        <div
          className={styles.sidebar}
          id={`plugin-panel-${pluginId}`}
          role="tabpanel"
          aria-labelledby={`plugin-tab-${pluginId}`}
        >
          <header className={styles.header}>
            <CommuneSettings />
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
    >
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
    </MainLayout>
  );
}
