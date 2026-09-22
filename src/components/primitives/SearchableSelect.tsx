import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""} ${option.value}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const openMenu = () => {
    setQuery("");
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const commit = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) {
        commit(option.value);
      }
    }
  };

  return (
    <div
      className={["wpn-select", size === "sm" ? "wpn-select--sm" : ""].filter(Boolean).join(" ")}
      ref={rootRef}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        id={id}
        role="combobox"
        className={["wpn-select__trigger", open ? "wpn-select__trigger--open" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span
          className={["wpn-select__value", selected ? "" : "wpn-select__value--placeholder"]
            .filter(Boolean)
            .join(" ")}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span className="wpn-select__indicators">
          {clearable && selected ? (
            <span
              aria-hidden="true"
              className="wpn-select__clear"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange("");
              }}
            >
              <Icon name="close" className="wpn-select__clear-icon" />
            </span>
          ) : null}
          <Icon name="chevronDown" className="wpn-select__chevron" />
        </span>
      </button>

      {open ? (
        <div className="wpn-select__menu">
          <div className="wpn-select__search">
            <Icon name="search" className="wpn-select__search-icon" />
            <input
              ref={searchRef}
              className="wpn-select__search-input"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
            />
          </div>
          <ul className="wpn-select__list" role="listbox" id={listboxId} aria-label={ariaLabel}>
            {filtered.length === 0 ? (
              <li className="wpn-select__empty">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={[
                      "wpn-select__option",
                      index === activeIndex ? "wpn-select__option--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option.value)}
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
