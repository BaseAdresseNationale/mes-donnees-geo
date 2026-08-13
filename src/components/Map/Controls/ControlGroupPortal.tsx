import { useState } from "react";
import { createPortal } from "react-dom";
import {
  ControlPosition,
  IControl,
  MapInstance,
  useControl,
} from "react-map-gl/maplibre";

export class ControlGroupPortalWrapper implements IControl {
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
    this.controlContainer.classList.add("maplibregl-ctrl");
    this.controlContainer.style.display = "flex";
    this.controlContainer.style.gap = "0.5rem";
    this.onContainerReady(this.controlContainer);

    return this.controlContainer;
  }

  public onRemove(): void {
    this.controlContainer?.parentNode?.removeChild(this.controlContainer);
    this.controlContainer = undefined;
    this.map = undefined;
    this.onContainerReady(null);
  }
}

export type ControlGroupPortalProps = {
  position?: ControlPosition;
  children: React.ReactNode;
};

export function ControlGroupPortal({
  position,
  children,
}: ControlGroupPortalProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useControl<ControlGroupPortalWrapper>(
    () => new ControlGroupPortalWrapper(setContainer),
    { position },
  );

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}
