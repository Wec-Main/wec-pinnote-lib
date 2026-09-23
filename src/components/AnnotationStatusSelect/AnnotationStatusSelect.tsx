import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AnnotationStatus } from "../../types/annotation.types";
import { ANNOTATION_STATUS_OPTIONS, statusLabel } from "../../utils/status";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface AnnotationStatusSelectProps {
  value: AnnotationStatus;
  onChange: (status: AnnotationStatus) => void;
  disabled?: boolean;
}

export function AnnotationStatusSelect({ value, onChange, disabled }: AnnotationStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    ANNOTATION_STATUS_OPTIONS.findIndex((option) => option.value === value),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionIdPrefix = useId();

  const close = () => setOpen(false);

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

  useEscapeKey(() => {
    close();
    triggerRef.current?.focus();
  }, open);

  const openMenu = () => {
    setActiveIndex(ANNOTATION_STATUS_OPTIONS.findIndex((option) => option.value === value));
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = ANNOTATION_STATUS_OPTIONS[index];
    if (option) {
      onChange(option.value);
    }
    close();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % ANNOTATION_STATUS_OPTIONS.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + ANNOTATION_STATUS_OPTIONS.length) % ANNOTATION_STATUS_OPTIONS.length,
      );
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(ANNOTATION_STATUS_OPTIONS.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  const activeOption = ANNOTATION_STATUS_OPTIONS[activeIndex];

  return (
    <div className="wpn-status" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`wpn-status__trigger wpn-tone--${value}`}
        disabled={disabled}
        aria-label={`Status: ${statusLabel(value)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="wpn-status__dot" />
        {statusLabel(value)}
        <svg viewBox="0 0 16 16" className="wpn-status__chevron" aria-hidden="true">
          <path fill="currentColor" d="M4.2 6.2 8 10l3.8-3.8L13 7.4 8 12.4 3 7.4z" />
        </svg>
      </button>
      {open ? (
        <div
          className="wpn-status__menu"
          role="listbox"
          tabIndex={0}
          aria-activedescendant={activeOption ? `${optionIdPrefix}-${activeOption.value}` : undefined}
          onKeyDown={handleListKeyDown}
          ref={(element) => element?.focus()}
        >
          {ANNOTATION_STATUS_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              id={`${optionIdPrefix}-${option.value}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className={`wpn-status__option wpn-tone--${option.value} ${
                option.value === value ? "wpn-status__option--active" : ""
              } ${index === activeIndex ? "wpn-status__option--focused" : ""}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span className="wpn-status__dot" />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
