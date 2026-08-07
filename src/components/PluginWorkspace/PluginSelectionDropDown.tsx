import { useCommune } from "@/contexts/CommuneContext";
import {
  Button,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
} from "@gouvfr-lasuite/ui-components";
import styles from "./PluginSelectionDropDown.module.css";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PluginSelectionDropDownProps = {
  pluginId: string;
  pluginLabel: string;
};

export function PluginSelectionDropDown({
  pluginId,
  pluginLabel,
}: PluginSelectionDropDownProps) {
  const router = useRouter();
  const commune = useCommune();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentPlugin = useMemo(
    () => commune.plugins.find((p) => p.id === pluginId),
    [commune.plugins, pluginId],
  );

  const pluginPickerOptions = useMemo<DropdownMenuOption[]>(
    () =>
      commune.plugins
        .filter((p) => p.enabled)
        .map((p) => ({
          id: p.id,
          value: p.id,
          label: p.label,
          icon: <span aria-hidden>{p.icon}</span>,
          isChecked: p.id === pluginId,
          callback: () => {
            if (p.id !== pluginId) {
              router.push(`/${commune.codeInsee}/${p.id}`);
            }
          },
        })),
    [commune.plugins, commune.codeInsee, pluginId, router],
  );

  return (
    <div className={styles.pluginSelectionDropDown}>
      <DropdownMenu
        options={pluginPickerOptions}
        selectedValues={[pluginId]}
        isOpen={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
        onSelectValue={(selectedId) => {
          if (selectedId && selectedId !== pluginId) {
            router.push(`/${commune.codeInsee}/${selectedId}`);
          }
        }}
      >
        <Button
          onClick={() => setIsDropdownOpen((open) => !open)}
          color="neutral"
          variant="tertiary"
          icon={
            <Icon name={isDropdownOpen ? "arrow_drop_up" : "arrow_drop_down"} />
          }
          iconPosition="right"
          aria-label={`Changer de module — module courant : ${pluginLabel}`}
          aria-haspopup="menu"
          aria-expanded={isDropdownOpen}
        >
          {currentPlugin?.icon ? (
            <span aria-hidden style={{ marginRight: "0.375rem" }}>
              {currentPlugin.icon}
            </span>
          ) : null}
          <span>{pluginLabel}</span>
        </Button>
      </DropdownMenu>
    </div>
  );
}
