import { useCallback, useContext, useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import PanoramaxContext from "@/contexts/PanoramaxContext";
import {
  PANORAMAX_LAYERS_SOURCE,
  PANORAMAX_SOURCE_ID,
} from "./panoramax.layers";
import cssStyles from "./PanoramaxToggle.module.css";

const ENABLED_TITLE = "Masquer Panoramax";
const DISABLED_TITLE = "Afficher Panoramax";
const UNAVAILABLE_TITLE =
  "Aucune photographie Panoramax disponible sur cette zone";
const SCAN_TITLE = "Fermer le mode scan Panoramax";

export function PanoramaxToggle() {
  const { showPanoramax } = useContext(PanoramaxContext);
  const map = useMap();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Refs mirror props/state for use inside long-lived event handlers.
  const showPanoramaxRef = useRef(showPanoramax);

  const updateButtonAppearance = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const isDisabled = button.hasAttribute("data-unavailable");
    const isScanMode = button.classList.contains("scan-mode");

    if (isDisabled) {
      button.title = UNAVAILABLE_TITLE;
      button.ariaLabel = UNAVAILABLE_TITLE;
      button.classList.add("disabled");
      button.classList.remove("active");
      return;
    }
    button.classList.remove("disabled");
    const title = isScanMode
      ? SCAN_TITLE
      : showPanoramaxRef.current
        ? ENABLED_TITLE
        : DISABLED_TITLE;
    button.title = title;
    button.ariaLabel = title;
    if (showPanoramaxRef.current) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  }, []);

  // Create the button imperatively so PanoramaxLensDrag can freely mutate its
  // classes (scan-mode, active…) and the inner <img> src without React
  // overwriting them on re-renders. Click semantics are owned by
  // <PanoramaxLensDrag />, which delegates via #panoramax-toggle.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const button = document.createElement("button");
    buttonRef.current = button;
    button.id = "panoramax-toggle";
    button.type = "button";
    button.className = `panoramax-draggable ${cssStyles.control}`;
    button.setAttribute("data-unavailable", "");
    // Prevent the browser from interpreting touch gestures on the button as
    // scroll/pinch (which would fire pointercancel and break the drag flow).
    button.style.touchAction = "none";

    const img = document.createElement("img");
    img.src = "/icons/panoramax.svg";
    img.alt = "Panoramax";
    img.width = 24;
    img.height = 24;
    button.appendChild(img);
    container.appendChild(button);
    updateButtonAppearance();

    return () => {
      button.remove();
      buttonRef.current = null;
    };
  }, [updateButtonAppearance]);

  useEffect(() => {
    showPanoramaxRef.current = showPanoramax;
    updateButtonAppearance();
  }, [showPanoramax, updateButtonAppearance]);

  // Availability check: the button is enabled as soon as a Panoramax sequence
  // is present in the viewport. The picture-level dive target is resolved
  // later, after the dive zoom finishes (see PanoramaxMap / PanoramaxLensDrag).
  useEffect(() => {
    const m = map.current?.getMap();
    if (!m) return;

    const refreshAvailability = () => {
      const button = buttonRef.current;
      if (!button) return;
      const sequences = m.querySourceFeatures(PANORAMAX_SOURCE_ID, {
        sourceLayer: PANORAMAX_LAYERS_SOURCE.SEQUENCES,
      });
      const available = !!(sequences && sequences.length > 0);
      if (available) {
        button.removeAttribute("data-unavailable");
      } else {
        button.setAttribute("data-unavailable", "");
      }
      updateButtonAppearance();
    };

    const onSourceData = (e: any) => {
      if (e.sourceId === PANORAMAX_SOURCE_ID && e.isSourceLoaded) {
        refreshAvailability();
      }
    };
    m.on("sourcedata", onSourceData);
    m.on("moveend", refreshAvailability);
    refreshAvailability();

    return () => {
      m.off("sourcedata", onSourceData);
      m.off("moveend", refreshAvailability);
    };
  }, [map, updateButtonAppearance]);

  return <div ref={containerRef} className={cssStyles.controlContainer} />;
}
