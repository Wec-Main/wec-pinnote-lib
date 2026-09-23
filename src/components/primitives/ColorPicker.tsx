import { useRef, useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFloatingPosition } from "../../hooks/useFloatingPosition";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import { Icon } from "./Icon";

const DEFAULT_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#64748b",
  "#1e293b",
  "#ffffff",
];

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface ColorPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  palette?: string[];
  allowNone?: boolean;
  noneLabel?: string;
  ariaLabel: string;
  showValue?: boolean;
}

export function ColorPicker({
  value,
  onChange,
  palette = DEFAULT_PALETTE,
  allowNone = false,
  noneLabel = "None",
  ariaLabel,
  showValue = false,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value ?? "");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(rootRef, panelRef, open, "bottom-start");

  const close = () => setOpen(false);

  useOutsidePointerDown(rootRef, close, open);
  useEscapeKey(close, open);

  const openPicker = () => {
    setHexDraft(value ?? "");
    setOpen(true);
  };

  const commitHex = (candidate: string) => {
    const normalized = candidate.trim();
    if (HEX_PATTERN.test(normalized)) {
      onChange(normalized);
    }
  };

  return (
    <div
      className={showValue ? "wpn-color-picker wpn-color-picker--with-value" : "wpn-color-picker"}
      ref={rootRef}
    >
      <button
        type="button"
        className="wpn-color-picker__trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
      >
        <span
          className={[
            "wpn-color-picker__swatch",
            value ? "" : "wpn-color-picker__swatch--none",
          ]
            .filter(Boolean)
            .join(" ")}
          style={value ? { backgroundColor: value } : undefined}
        />
      </button>
      {showValue ? (
        <span className="wpn-color-picker__value">{value ? value.toUpperCase() : noneLabel}</span>
      ) : null}
      {open ? (
        <div
          ref={panelRef}
          className="wpn-color-picker__panel"
          role="dialog"
          aria-label={ariaLabel}
          style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
        >
          <div className="wpn-color-picker__grid">
            {allowNone ? (
              <button
                type="button"
                className={[
                  "wpn-color-picker__cell",
                  "wpn-color-picker__cell--none",
                  value === null ? "wpn-color-picker__cell--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={noneLabel}
                aria-pressed={value === null}
                onClick={() => onChange(null)}
              >
                {value === null ? <Icon name="check" /> : null}
              </button>
            ) : null}
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={[
                  "wpn-color-picker__cell",
                  value === swatch ? "wpn-color-picker__cell--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ backgroundColor: swatch }}
                aria-label={swatch}
                aria-pressed={value === swatch}
                onClick={() => onChange(swatch)}
              >
                {value === swatch ? <Icon name="check" /> : null}
              </button>
            ))}
          </div>
          <div className="wpn-color-picker__hex-row">
            <span
              className="wpn-color-picker__hex-preview"
              style={HEX_PATTERN.test(hexDraft) ? { backgroundColor: hexDraft } : undefined}
            />
            <input
              type="text"
              className="wpn-color-picker__hex-input"
              value={hexDraft}
              placeholder="#000000"
              aria-label="Hex color"
              onChange={(event) => {
                setHexDraft(event.target.value);
                commitHex(event.target.value);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
