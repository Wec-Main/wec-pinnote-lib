import { useEffect, useRef, useState } from "react";
import type { AnnotationStatus } from "../../types/annotation.types";
import { ANNOTATION_STATUS_OPTIONS, statusLabel } from "../../utils/status";

interface AnnotationStatusSelectProps {
  value: AnnotationStatus;
  onChange: (status: AnnotationStatus) => void;
  disabled?: boolean;
}

export function AnnotationStatusSelect({ value, onChange, disabled }: AnnotationStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="wpn-status" ref={rootRef}>
      <button
        type="button"
        className={`wpn-status__trigger wpn-tone--${value}`}
        disabled={disabled}
        aria-label={`Status: ${statusLabel(value)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="wpn-status__dot" />
        {statusLabel(value)}
        <svg viewBox="0 0 16 16" className="wpn-status__chevron" aria-hidden="true">
          <path fill="currentColor" d="M4.2 6.2 8 10l3.8-3.8L13 7.4 8 12.4 3 7.4z" />
        </svg>
      </button>
      {open ? (
        <div className="wpn-status__menu" role="listbox">
          {ANNOTATION_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`wpn-status__option wpn-tone--${option.value} ${
                option.value === value ? "wpn-status__option--active" : ""
              }`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
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
