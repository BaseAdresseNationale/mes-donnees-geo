"use client";

import { CommuneSettings } from "@/components/PluginWorkspace/CommuneSettings";
import styles from "./PluginLayout.module.css";
import { PluginSelectionDropDown } from "@/components/PluginWorkspace/PluginSelectionDropDown";

interface PluginLayoutProps {
  pluginId: string;
  pluginLabel: string;
}

export function PluginLayout({
  pluginId,
  pluginLabel,
  children,
}: PluginLayoutProps & { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
