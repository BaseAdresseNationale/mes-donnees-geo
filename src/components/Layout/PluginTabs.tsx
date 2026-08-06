"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import styles from "./PluginTabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

interface PluginTabsProps {
  items: readonly TabItem[];
}

export function PluginTabs({ items }: PluginTabsProps) {
  const currentSegment = useSelectedLayoutSegment();

  return (
    <nav
      className={styles.tabs}
      aria-label="Modules de données géographiques"
      role="tablist"
    >
      {items.map((item) => {
        const isActive = currentSegment === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            aria-controls={`plugin-panel-${item.id}`}
            id={`plugin-tab-${item.id}`}
            className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
