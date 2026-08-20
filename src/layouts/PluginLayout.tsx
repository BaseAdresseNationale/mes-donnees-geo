"use client";
import { useContext, useEffect } from "react";
import ThemeContext from "@/contexts/ThemeContext";
import styles from "./PluginLayout.module.css";
import { PluginSelectionDropDown } from "@/components/plugin-workspace/PluginSelectionDropDown";

interface PluginLayoutProps {
  pluginId: string;
  pluginLabel: string;
  toolbarChildren: React.ReactNode | null;
  rightHeaderContentChildren: React.ReactNode | null;
  children: React.ReactNode;
}

export function PluginLayout({
  pluginId,
  pluginLabel,
  children,
  toolbarChildren,
  rightHeaderContentChildren,
}: PluginLayoutProps) {
  const { setToolbarChildren, setRightHeaderContentChildren } =
    useContext(ThemeContext);

  useEffect(() => {
    setToolbarChildren(toolbarChildren);
    setRightHeaderContentChildren(rightHeaderContentChildren);
  }, [
    toolbarChildren,
    rightHeaderContentChildren,
    setToolbarChildren,
    setRightHeaderContentChildren,
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
