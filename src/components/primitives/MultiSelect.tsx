import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selectedSet = useMemo(() => new Set(values), [values]);
  const selected = options.filter((option) => selectedSet.has(option.value));

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

  const toggle = (optionValue: string) => {
    onChange(
      selectedSet.has(optionValue)
        ? values.filter((value) => value !== optionValue)
        : [...values, optionValue],
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      setQuery("");
      setActiveIndex(0);
      setOpen(true);
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
        toggle(option.value);
      }
    }
  };

  const summary = () => {
    if (selected.length === 0) {
      return placeholder;
    }
    if (selected.length <= 2) {
      return selected.map((option) => option.label).join(", ");
    }
    return `${selected.length} selected`;
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
        onClick={() => {
          setQuery("");
          setActiveIndex(0);
          setOpen(!open);
        }}
      >
        <span
          className={[
            "wpn-select__value",
            selected.length === 0 ? "wpn-select__value--placeholder" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {summary()}
        </span>
        <span className="wpn-select__indicators">
          {selected.length > 0 ? (
            <span
              aria-hidden="true"
              className="wpn-select__clear"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange([]);
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
