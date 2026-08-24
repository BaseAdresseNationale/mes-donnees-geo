"use client";

import { Button, DropdownMenu, Icon } from "@gouvfr-lasuite/ui-components";
import { useContext, useState } from "react";
import cssStyles from "./LayersSwitch.module.css";
import Image from "next/image";
import MapContext, {
  availableDataLayerOptions,
  AvailableDataLayer,
} from "@/contexts/MapContext";

export function LayersSwitch() {
  const [isOpen, setIsOpen] = useState(false);
  const { activeDataLayers, setActiveDataLayers } = useContext(MapContext);

  return (
    <div className={cssStyles.controlWrapper}>
      <DropdownMenu
        options={availableDataLayerOptions}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        selectedValues={activeDataLayers}
        onSelectValue={(value) => {
          setActiveDataLayers((prevValues) => {
            if (prevValues.includes(value as AvailableDataLayer)) {
              return prevValues.filter((v) => v !== value);
            }
            return [...prevValues, value as AvailableDataLayer];
          });
        }}
        topMessage="Couche de données"
      >
        <Button
          className={cssStyles.control}
          onClick={() => setIsOpen((open) => !open)}
          color="neutral"
          variant="tertiary"
          icon={<Icon name={isOpen ? "arrow_drop_up" : "arrow_drop_down"} />}
          iconPosition="right"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Activer des couches de données"
          {...(isOpen && {
            style: {
              backgroundColor: "var(--color-primary)",
              color: "#fff",
            },
          })}
        >
          <Image
            alt=""
            height={24}
            width={24}
            src="/icons/layers.svg"
            aria-hidden="true"
            style={isOpen ? { filter: "invert(1)" } : undefined}
          />
        </Button>
      </DropdownMenu>
    </div>
  );
}
