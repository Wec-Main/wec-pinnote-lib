import type { RefObject } from "react";
import { Icon } from "./Icon";

interface SelectTriggerProps {
  triggerRef: RefObject<HTMLButtonElement>;
  id?: string;
  open: boolean;
  label: string;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  listboxId?: string;
  activeDescendant?: string;
  onToggle: () => void;
}

export function SelectTrigger({
  triggerRef,
  id,
  open,
  label,
  placeholder,
  ariaLabel,
  disabled = false,
  listboxId,
  activeDescendant,
  onToggle,
}: SelectTriggerProps) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className={["wpn-select__trigger", open ? "wpn-select__trigger--open" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeDescendant}
      disabled={disabled}
      onClick={onToggle}
    >
      <span
        className={["wpn-select__value", label ? "" : "wpn-select__value--placeholder"]
          .filter(Boolean)
          .join(" ")}
      >
        {label || placeholder}
      </span>
      <span className="wpn-select__indicators">
        <Icon name="chevronDown" className="wpn-select__chevron" />
      </span>
    </button>
  );
}

interface SelectSearchFieldProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  placeholder: string;
  ariaLabel: string;
  listboxId: string;
  activeDescendant?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function SelectSearchField({
  inputRef,
  value,
  placeholder,
  ariaLabel,
  listboxId,
  activeDescendant,
  disabled = false,
  onChange,
}: SelectSearchFieldProps) {
  return (
    <div className="wpn-select__search">
      <Icon name="search" className="wpn-select__search-icon" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className="wpn-select__search-input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
