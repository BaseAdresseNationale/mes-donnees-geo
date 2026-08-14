"use client";

import { CommuneSettings } from "@/components/plugin-workspace/CommuneSettings";
import styles from "./PluginLayout.module.css";
import { PluginSelectionDropDown } from "@/components/plugin-workspace/PluginSelectionDropDown";

interface PluginLayoutProps {
  pluginId: string;
  pluginLabel: string;
  communeFlagUrl: string;
}

export function PluginLayout({
  pluginId,
  pluginLabel,
  communeFlagUrl,
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
        <CommuneSettings
          currentPluginId={pluginId}
          communeFlagUrl={communeFlagUrl}
        />
        <PluginSelectionDropDown
          pluginId={pluginId}
          pluginLabel={pluginLabel}
        />
      </header>
      {children}
    </div>
  );
}
