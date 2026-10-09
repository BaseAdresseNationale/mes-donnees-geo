"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
} from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./LocalPathsToolbar.module.css";
import {
  LocalPathPublishButton,
  type PublishHighlightRequest,
} from "./LocalPathPublishButton";
import type { PublicationChange } from "@/lib/publication/types";

interface LocalPathToolbarProps {
  codeCommune: string;
  changes: PublicationChange[];
  onHighlight: (request: PublishHighlightRequest | null) => void;
}

function downloadFile(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function LocalPathToolbar({
  codeCommune,
  changes,
  onHighlight,
}: LocalPathToolbarProps) {
  const router = useRouter();
  const [isExportOpen, setIsExportOpen] = useState(false);

  const exportOptions = useMemo<DropdownMenuOption[]>(
    () => [
      {
        id: "csv",
        label: "CSV",
        icon: <span className="material-icons">table_chart</span>,
        callback: () => downloadFile("/api/voies-locales/export/csv"),
      },
      {
        id: "geojson",
        label: "GeoJSON",
        icon: <span className="material-icons">map</span>,
        callback: () => downloadFile("/api/voies-locales/export/geojson"),
      },
    ],
    [],
  );

  return (
    <div className={styles.toolbar}>
      <Button
        color="brand"
        icon={<span className="material-icons">add</span>}
        aria-label="Créer une nouvelle voie"
        size="small"
        onClick={() => router.push(`/${codeCommune}/voies-locales/new`)}
      >
        Nouvelle voie
      </Button>
      <Button
        color="neutral"
        icon={<span className="material-icons">cloud_download</span>}
        aria-label="Importer des voies depuis la BD TOPO"
        size="small"
        onClick={() => router.push(`/${codeCommune}/voies-locales/import`)}
      >
        Importer des voies
      </Button>
      <div className={styles.actions}>
        <DropdownMenu
          options={exportOptions}
          isOpen={isExportOpen}
          onOpenChange={setIsExportOpen}
        >
          <Button
            color="neutral"
            size="small"
            icon={
              <Icon name={isExportOpen ? "arrow_drop_up" : "arrow_drop_down"} />
            }
            iconPosition="right"
            aria-label="Exporter les voies qualifiées"
            aria-haspopup="menu"
            aria-expanded={isExportOpen}
            onClick={() => setIsExportOpen((open) => !open)}
          >
            Exporter
          </Button>
        </DropdownMenu>
        <LocalPathPublishButton changes={changes} onHighlight={onHighlight} />
      </div>
    </div>
  );
}
