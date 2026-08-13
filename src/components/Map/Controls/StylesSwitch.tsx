import { MaplibreStyleDefinition } from "@/types/maplibre.types";
import {
  Button,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
} from "@gouvfr-lasuite/ui-components";
import { useCallback, useMemo, useState } from "react";
import { useLocalStorageContext } from "@/contexts/LocalStorageContext";
import cssStyles from "./StylesSwitch.module.css";

export type StylesSwitchProps = {
  styles: MaplibreStyleDefinition[];
};

export function StylesSwitch({ styles }: StylesSwitchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { basemapId, setBasemapId } = useLocalStorageContext();
  const currentStyleId = basemapId ?? styles[0]?.id;

  const currentStyle = useMemo(
    () => styles.find((style) => style.id === currentStyleId) ?? styles[0],
    [styles, currentStyleId],
  );

  const handleSelectStyle = useCallback(
    (styleId: string) => {
      const style = styles.find((s) => s.id === styleId);
      if (!style || style.id === currentStyleId) return;
      setBasemapId(style.id);
    },
    [styles, currentStyleId, setBasemapId],
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

  return (
    <div className={cssStyles.controlWrapper}>
      <DropdownMenu
        options={options}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        selectedValues={currentStyle ? [currentStyle.id] : []}
        onSelectValue={handleSelectStyle}
        topMessage="Fond de carte"
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
          aria-label={`Changer de fond de carte — fond actuel : ${currentStyle?.title ?? ""}`}
        >
          <span
            aria-hidden
            className={cssStyles.triggerThumbnail}
            style={{ backgroundImage: `url("${currentStyle.previewImage}")` }}
          />
        </Button>
      </DropdownMenu>
    </div>
  );
}
