import { forwardRef, useEffect, useRef } from "react";

const WARN_RATIO = 0.9;

interface CharCounterFieldProps {
  label: string;
  required?: boolean;
  value: string;
  maxLength: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  error?: string | null;
  onChange: (value: string) => void;
}

export const CharCounterField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  CharCounterFieldProps
>(function CharCounterField(
  {
    label,
    required = false,
    value,
    maxLength,
    multiline = false,
    rows = 4,
    placeholder,
    error,
    onChange,
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!multiline) {
      return;
    }
    const el = localRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, multiline]);

  const setRefs = (node: HTMLInputElement | HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const counterClassName =
    value.length >= maxLength
      ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--limit"
      : value.length >= maxLength * WARN_RATIO
        ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--warn"
        : "wpn-epicflow-modal__counter";

  return (
    <label className="wpn-epicflow-modal__field">
      <span className="wpn-epicflow-modal__label">
        {label} {required ? <span className="wpn-epicflow-modal__required">*</span> : null}
      </span>
      {multiline ? (
        <textarea
          ref={setRefs as (node: HTMLTextAreaElement | null) => void}
          className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
          value={value}
          maxLength={maxLength}
          rows={rows}
          style={{ overflowY: "hidden" }}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          ref={setRefs as (node: HTMLInputElement | null) => void}
          className="wpn-epicflow-modal__input"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      <span className={counterClassName}>
        {value.length}/{maxLength}
      </span>
      {error ? <span className="wpn-users-modal__error">{error}</span> : null}
    </label>
  );
});
