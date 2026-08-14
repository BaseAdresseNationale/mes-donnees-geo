import { Button, Icon } from "@gouvfr-lasuite/ui-components";
import { useEffect } from "react";
import styles from "./PanoramaxViewer.module.css";

interface PanoramaxViewerProps {
  src: string;
  onClose: () => void;
}

export function PanoramaxViewer({
  src,
  onClose,
}: Readonly<PanoramaxViewerProps>) {
  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.panoramaxViewer}>
      <button
        type="button"
        title="Fermer Panoramax"
        aria-label="Fermer Panoramax"
        onClick={onClose}
        className={styles.closeButton}
      >
        <Icon aria-hidden="true" name="close" />
      </button>

      <iframe
        src={src}
        title="Visionneuse Panoramax"
        allow="fullscreen; geolocation; xr-spatial-tracking"
        allowFullScreen
      />
    </div>
  );
}
