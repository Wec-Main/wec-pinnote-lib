import { useComboboxList, type ComboboxOption } from "../../hooks/useComboboxList";
import { Icon } from "./Icon";

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
    listboxId,
    optionId,
    activeDescendant,
    openMenu,
    onInputChange,
    onRootKeyDown,
  } = useComboboxList({ options, activeValue: value });

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
      <div
        className={["wpn-select__trigger", open ? "wpn-select__trigger--open" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          className="wpn-select__search-input wpn-select__search-input--trigger"
          value={open ? query : (selected?.label ?? "")}
          placeholder={open ? searchPlaceholder : placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          onFocus={() => {
            if (!open) {
              openMenu();
            }
          }}
          onClick={() => {
            if (!open) {
              openMenu();
            }
          }}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <span className="wpn-select__indicators">
          <Icon name="chevronDown" className="wpn-select__chevron" />
        </span>
      </div>
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
        <div className="wpn-select__menu">
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
