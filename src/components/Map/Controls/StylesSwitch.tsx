import { MaplibreStyleDefinition } from "@/types/maplibre.types";
import {
  Button,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
} from "@gouvfr-lasuite/ui-components";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ControlPosition,
  IControl,
  MapInstance,
  useControl,
} from "react-map-gl/maplibre";
import { useLocalStorageContext } from "@/contexts/LocalStorageContext";
import cssStyles from "./StylesSwitch.module.css";

export class MapboxStyleSwitcherControl implements IControl {
  private controlContainer: HTMLDivElement | undefined;
  private map: MapInstance | undefined;

  constructor(
    private onContainerReady: (container: HTMLDivElement | null) => void,
  ) {}

  public getDefaultPosition(): ControlPosition {
    return "top-right";
  }

  public onAdd(map: MapInstance): HTMLElement {
    this.map = map;
    this.controlContainer = document.createElement("div");
    this.controlContainer.classList.add(
      "maplibregl-ctrl",
      "maplibregl-style-switcher",
      cssStyles.control,
    );
    this.onContainerReady(this.controlContainer);

    return this.controlContainer;
  }

  public onRemove(): void {
    this.controlContainer?.parentNode?.removeChild(this.controlContainer);
    this.controlContainer = undefined;
    this.map = undefined;
    this.onContainerReady(null);
  }

  public setStyle(uri: string): void {
    this.map?.setStyle(uri);
  }
}

export type StylesSwitchProps = {
  styles: MaplibreStyleDefinition[];
  position?: ControlPosition;
};

export function StylesSwitch({ styles, position }: StylesSwitchProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { basemapId, setBasemapId } = useLocalStorageContext();
  const currentStyleId = basemapId ?? styles[0]?.id;

  const control = useControl<MapboxStyleSwitcherControl>(
    () => new MapboxStyleSwitcherControl(setContainer),
    { position },
  );

  // Restaure le fond de carte enregistré une fois le localStorage lu et la carte prête.
  useEffect(() => {
    if (!container || !basemapId) return;
    const style = styles.find((s) => s.id === basemapId);
    if (style) control.setStyle(style.uri);
  }, [basemapId, container, styles, control]);

  const currentStyle = useMemo(
    () => styles.find((style) => style.id === currentStyleId) ?? styles[0],
    [styles, currentStyleId],
  );

  const handleSelectStyle = useCallback(
    (styleId: string) => {
      const style = styles.find((s) => s.id === styleId);
      if (!style || style.id === currentStyleId) return;
      control.setStyle(style.uri);
      setBasemapId(style.id);
    },
    [styles, currentStyleId, control, setBasemapId],
  );

  const options = useMemo<DropdownMenuOption[]>(
    () =>
      styles.map((style) => ({
        id: style.id,
        value: style.id,
        label: style.title,
        icon: (
          <span
            aria-hidden
            className={cssStyles.optionThumbnail}
            style={{ backgroundImage: `url("${style.previewImage}")` }}
          />
        ),
        isChecked: style.id === currentStyle?.id,
        callback: () => handleSelectStyle(style.id),
      })),
    [styles, currentStyle, handleSelectStyle],
  );

  if (!container) {
    return null;
  }

  return createPortal(
    <DropdownMenu
      options={options}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      selectedValues={currentStyle ? [currentStyle.id] : []}
      onSelectValue={handleSelectStyle}
      topMessage="Fond de carte"
    >
      <Button
        onClick={() => setIsOpen((open) => !open)}
        color="neutral"
        variant="tertiary"
        icon={<Icon name={isOpen ? "arrow_drop_up" : "arrow_drop_down"} />}
        iconPosition="right"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Changer de fond de carte — fond actuel : ${currentStyle?.title ?? ""}`}
      >
        <span
          aria-hidden
          className={cssStyles.triggerThumbnail}
          style={{ backgroundImage: `url("${currentStyle.previewImage}")` }}
        />
      </Button>
    </DropdownMenu>,
    container,
  );
}
