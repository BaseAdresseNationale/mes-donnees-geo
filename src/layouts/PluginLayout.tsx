"use client";
import { useContext, useEffect } from "react";
import ThemeContext from "@/contexts/ThemeContext";
import styles from "./PluginLayout.module.css";
import { PluginSelectionDropDown } from "@/components/plugin-workspace/PluginSelectionDropDown";
import MapContext from "@/contexts/MapContext";

interface PluginLayoutProps {
  pluginId: string;
  pluginLabel: string;
  rightHeaderContentChildren: React.ReactNode | null;
  children: React.ReactNode;
  mapToolChildren?: React.ReactNode;
}

export function PluginLayout({
  pluginId,
  pluginLabel,
  children,
  rightHeaderContentChildren,
  mapToolChildren,
}: PluginLayoutProps) {
  const { setRightHeaderContentChildren } = useContext(ThemeContext);
  const { setMapToolChildren } = useContext(MapContext);

  useEffect(() => {
    setRightHeaderContentChildren(rightHeaderContentChildren);
    setMapToolChildren(mapToolChildren || null);
  }, [
    rightHeaderContentChildren,
    setRightHeaderContentChildren,
    mapToolChildren,
    setMapToolChildren,
  ]);

  return (
    <div
      className={styles.sidebar}
      id={`plugin-panel-${pluginId}`}
      role="tabpanel"
      aria-labelledby={`plugin-tab-${pluginId}`}
    >
      <div className={styles.sidebarHeader}>
        <PluginSelectionDropDown
          pluginId={pluginId}
          pluginLabel={pluginLabel}
        />
      </div>
      {children}
    </div>
  );
}
