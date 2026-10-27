"use client";
import { useContext, useEffect } from "react";
import styles from "./PluginLayout.module.css";
import { PluginSelectionDropDown } from "@/components/plugin-workspace/PluginSelectionDropDown";
import MapContext from "@/contexts/MapContext";
import { CommuneSettings } from "@/components/plugin-workspace/CommuneSettings";

interface PluginLayoutProps {
  pluginId: string;
  pluginLabel: string;
  communeFlagUrl: string;
  children: React.ReactNode;
  mapToolChildren?: React.ReactNode;
}

export function PluginLayout({
  pluginId,
  pluginLabel,
  communeFlagUrl,
  children,
  mapToolChildren,
}: PluginLayoutProps) {
  const { setMapToolChildren } = useContext(MapContext);

  useEffect(() => {
    setMapToolChildren(mapToolChildren || null);
  }, [mapToolChildren, setMapToolChildren]);

  return (
    <div
      className={styles.sidebar}
      id={`plugin-panel-${pluginId}`}
      role="tabpanel"
      aria-labelledby={`plugin-tab-${pluginId}`}
    >
      <div className={styles.sidebarHeader}>
        <CommuneSettings
          currentPluginId={pluginId}
          communeFlagUrl={communeFlagUrl}
        />
        <PluginSelectionDropDown
          pluginId={pluginId}
          pluginLabel={pluginLabel}
        />
      </div>
      {children}
    </div>
  );
}
