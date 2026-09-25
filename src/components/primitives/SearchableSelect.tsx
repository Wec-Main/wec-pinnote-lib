import { useRef } from "react";
import { useComboboxList, type ComboboxOption } from "../../hooks/useComboboxList";
import { useFloatingPosition } from "../../hooks/useFloatingPosition";
import { Icon } from "./Icon";
import { SelectSearchField, SelectTrigger } from "./SelectParts";

export type SelectOption = ComboboxOption;

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  clearable?: boolean;
  size?: "md" | "sm";
  id?: string;
  floating?: boolean;
  searchable?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  ariaLabel,
  clearable = false,
  size = "md",
  id,
  floating = false,
  searchable = true,
}: SearchableSelectProps) {
  const {
    open,
    setOpen,
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
    onInputChange,
    onRootKeyDown,
  } = useComboboxList({ options, activeValue: value });

  const menuRef = useRef<HTMLDivElement>(null);
  const floatingPosition = useFloatingPosition(rootRef, menuRef, floating && open, "bottom-start");

  const selected = options.find((option) => option.value === value) ?? null;

  const commit = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
  };

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
        label={selected?.label ?? ""}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        listboxId={searchable ? undefined : listboxId}
        activeDescendant={searchable ? undefined : activeDescendant}
        onToggle={() => (open ? setOpen(false) : openMenu())}
      />
      {clearable && selected ? (
        <button
          type="button"
          aria-label="Clear"
          className="wpn-select__clear"
          onClick={() => onChange("")}
        >
          <Icon name="close" className="wpn-select__clear-icon" />
        </button>
      ) : null}

      {open ? (
        <div
          ref={menuRef}
          className={[
            "wpn-select__menu",
            floating ? "wpn-select__menu--floating" : "",
            searchable ? "" : "wpn-select__menu--fit",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            floating
              ? floatingPosition
                ? { top: floatingPosition.top, left: floatingPosition.left }
                : { visibility: "hidden" }
              : undefined
          }
        >
          {searchable ? (
            <SelectSearchField
              inputRef={inputRef}
              value={query}
              placeholder={searchPlaceholder}
              ariaLabel={`Search ${ariaLabel}`}
              listboxId={listboxId}
              activeDescendant={activeDescendant}
              onChange={onInputChange}
            />
          ) : null}
          <ul className="wpn-select__list" role="listbox" id={listboxId} aria-label={ariaLabel}>
            {filtered.length === 0 ? (
              <li className="wpn-select__empty">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    id={optionId(index)}
                    role="option"
                    aria-selected={option.value === value}
                    className={[
                      "wpn-select__option",
                      index === activeIndex ? "wpn-select__option--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                  >
                    <span className="wpn-select__option-copy">
                      <span className="wpn-select__option-label">{option.label}</span>
                      {option.description ? (
                        <span className="wpn-select__option-description">{option.description}</span>
                      ) : null}
                    </span>
                    {option.value === value ? (
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
