import { useCallback, useRef, useState } from "react";
import style from "./Autocomplete.module.css";
import {
  useCombobox,
  UseComboboxState,
  UseComboboxStateChangeOptions,
} from "downshift";
import { useDebouncedCallback } from "use-debounce";
import { Input, InputProps } from "@gouvfr-lasuite/ui-components";

export type SearchItemType<T> = T & {
  label: string;
  id: string;
  header?: string;
  details?: string;
};

type SearchInputProps<T> = Omit<InputProps, "onSelect"> & {
  onSearch: (
    inputValue: string,
    signal: AbortSignal,
  ) => Promise<SearchItemType<T>[]>;
  onSelect: (selectedItem?: SearchItemType<T> | null) => void;
  onError?: (error: Error) => void;
  itemToString?: (item?: SearchItemType<T> | null) => string;
  label?: string;
  noResultsMessage?: string;
  resultsListPosition?: "top" | "bottom";
  inputProps?: Omit<InputProps, "onChange">;
  initialValue?: string;
};

function AutocompleteInput<T>({
  onSearch,
  onSelect,
  onError,
  itemToString = (item) => (item ? item.label : ""),
  label,
  noResultsMessage = "Aucun résultat trouvé",
  resultsListPosition = "bottom",
  inputProps = {},
  initialValue,
}: SearchInputProps<T>) {
  const controller = useRef<AbortController | null>(null);
  const [items, setItems] = useState<SearchItemType<T>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const onSearchAsync = useCallback(
    async (...args: [string, AbortSignal]) => {
      setIsLoading(true);
      const results = await onSearch(...args);
      setIsLoading(false);
      return results;
    },
    [onSearch],
  );

  const onInputValueChange = useDebouncedCallback(
    async ({ inputValue }: { inputValue: string }) => {
      if (controller.current) {
        controller.current.abort();
      }

      controller.current = new AbortController();

      try {
        const results = await onSearchAsync(
          inputValue.trim(),
          controller.current.signal,
        );
        setItems(results);
      } catch (err: unknown) {
        if (onError) {
          onError(err as Error);
        }
      }
    },
    300,
  );

  const stateReducer = useCallback<
    (
      state: unknown,
      actionAndChanges: UseComboboxStateChangeOptions<SearchItemType<T>>,
    ) => Partial<UseComboboxState<SearchItemType<T>>>
  >(
    (state, actionAndChanges) => {
      const { type, changes } = actionAndChanges;
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          return {
            ...changes,
            inputValue: (changes.inputValue as string).trimStart(),
          };
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
          const selectedValue = changes.selectedItem;
          onSelect(selectedValue);
          return {
            ...changes,
            ...(selectedValue
              ? {
                  inputValue: itemToString(selectedValue),
                }
              : null),
          };
        default:
          return changes;
      }
    },
    [onSelect, itemToString],
  );

  const {
    highlightedIndex,
    selectedItem,
    getMenuProps,
    getInputProps,
    getItemProps,
    isOpen,
    getLabelProps,
    inputValue,
  } = useCombobox<SearchItemType<T>>({
    onInputValueChange,
    items,
    itemToString,
    stateReducer,
    ...(initialValue !== undefined && { initialInputValue: initialValue }),
  });

  const showResultsList = isOpen && inputValue && !isLoading;

  return (
    <div className={style.autocomplete}>
      <ul
        {...(resultsListPosition === "top"
          ? { top: 0, transform: "translateY(-100%)" }
          : { bottom: 0, transform: "translateY(100%)" })}
        {...(showResultsList
          ? { className: `${style.resultList} ${style.visible}` }
          : { className: style.resultList })}
        {...getMenuProps()}
      >
        {items.length === 0 ? (
          <li style={{ padding: 8 }}>
            <span style={{ fontSize: 12, color: "muted" }}>
              {noResultsMessage}
            </span>
          </li>
        ) : (
          items.map((item, index) => (
            <li
              key={item.id}
              className={`${style.itemBtn}  ${selectedItem?.id === item.id || highlightedIndex === index ? style.selected : ""}`}
              {...getItemProps({ item, index })}
            >
              <span style={{ fontSize: 12, color: "muted" }}>
                {itemToString(item)}
              </span>
            </li>
          ))
        )}
      </ul>
      <Input
        label={label}
        rightIcon={<span className="material-icons">search</span>}
        color="neutral"
        {...inputProps}
        {...getInputProps()}
      />
    </div>
  );
}

export default AutocompleteInput;
