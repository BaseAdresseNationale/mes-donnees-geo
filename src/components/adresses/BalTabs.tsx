"use client";

import { Button } from "@gouvfr-lasuite/ui-components";
import { useParams, usePathname, useRouter } from "next/navigation";
import styles from "./BalTabs.module.css";
import { getBalTab } from "./bal-tab";

// Onglets d'une BAL : chacun correspond à une route sous /adresses/{balId}
// Chaque onglet est habillé en panneau de signalisation : entrée
// d'agglomération pour la commune, plaque de rue bleue pour les voies,
// flèche marron de lieu-dit pour les toponymes.
const TABS = [
  {
    id: "commune",
    label: "Commune",
    suffix: "",
    className: styles.communeSign,
  },
  { id: "voies", label: "Voies", suffix: "/voies", className: styles.voieSign },
  {
    id: "toponymes",
    label: "Toponymes",
    suffix: "/toponymes",
    className: styles.toponymeSign,
  },
] as const;

export function BalTabs() {
  const { codeCommune, balId } = useParams<{
    codeCommune: string;
    balId: string;
  }>();
  const pathname = usePathname();
  const router = useRouter();

  const activeTabId = getBalTab(pathname);

  return (
    <nav className={styles.tabs} aria-label="Navigation de la BAL">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTabId;
        const href = `/${codeCommune}/adresses/${balId}${tab.suffix}`;
        return (
          <Button
            key={tab.id}
            variant="tertiary"
            color="neutral"
            size="small"
            fullWidth
            active={isActive}
            className={tab.className}
            aria-current={isActive ? "page" : undefined}
            // Navigue aussi depuis une sous-page de l'onglet actif
            // (ex. /voies/{voieId} → liste des voies)
            onClick={() => {
              if (pathname !== href) {
                router.push(href);
              }
            }}
          >
            {tab.label}
          </Button>
        );
      })}
    </nav>
  );
}
