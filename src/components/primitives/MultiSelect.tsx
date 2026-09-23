import { useMemo } from "react";
import { useComboboxList, type ComboboxOption } from "../../hooks/useComboboxList";
import { Icon } from "./Icon";
import { SelectSearchField, SelectTrigger } from "./SelectParts";
import type { SelectOption } from "./SearchableSelect";

interface MultiSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  size?: "md" | "sm";
  id?: string;
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  ariaLabel,
  size = "md",
  id,
}: MultiSelectProps) {
  const {
    open,
    query,
    activeIndex,
    setActiveIndex,
    filtered,
    rootRef,
    inputRef,
    triggerRef,
    listboxId,
    optionId,
    activeDescendant,
    openMenu,
    closeMenu,
    onInputChange,
    onRootKeyDown,
  } = useComboboxList({ options, activeValue: null });

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selected = options.filter((option) => selectedSet.has(option.value));

  const toggle = (optionValue: string) => {
    onChange(
      selectedSet.has(optionValue)
        ? values.filter((value) => value !== optionValue)
        : [...values, optionValue],
    );
  };

  const summary = () => {
    if (selected.length === 0) {
      return "";
    }
    if (selected.length <= 2) {
      return selected.map((option) => option.label).join(", ");
    }
    return `${selected.length} selected`;
  };

  const commit = (option: ComboboxOption) => toggle(option.value);

  return (
    <div
      className={["wpn-select", size === "sm" ? "wpn-select--sm" : ""].filter(Boolean).join(" ")}
      ref={rootRef}
      onKeyDown={(event) => onRootKeyDown(event, commit)}
    >
      <SelectTrigger
        triggerRef={triggerRef}
        id={id}
        open={open}
        label={summary()}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        onToggle={() => (open ? closeMenu() : openMenu())}
      />
      {selected.length > 0 ? (
        <button
          type="button"
          aria-label="Clear"
          className="wpn-select__clear"
          onClick={() => onChange([])}
        >
          <Icon name="close" className="wpn-select__clear-icon" />
        </button>
      ) : null}

      {open ? (
        <div className="wpn-select__menu">
          <SelectSearchField
            inputRef={inputRef}
            value={query}
            placeholder={searchPlaceholder}
            ariaLabel={`Search ${ariaLabel}`}
            listboxId={listboxId}
            activeDescendant={activeDescendant}
            onChange={onInputChange}
          />
          <ul
            className="wpn-select__list"
            role="listbox"
            aria-multiselectable="true"
            id={listboxId}
            aria-label={ariaLabel}
          >
            {filtered.length === 0 ? (
              <li className="wpn-select__empty">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    id={optionId(index)}
                    role="option"
                    aria-selected={selectedSet.has(option.value)}
                    className={[
                      "wpn-select__option",
                      index === activeIndex ? "wpn-select__option--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => toggle(option.value)}
                  >
                    <span className="wpn-select__option-copy">
                      <span className="wpn-select__option-label">{option.label}</span>
                      {option.description ? (
                        <span className="wpn-select__option-description">{option.description}</span>
                      ) : null}
                    </span>
                    {selectedSet.has(option.value) ? (
                      <Icon name="check" className="wpn-select__option-check" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
