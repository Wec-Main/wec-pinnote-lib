import { useLayoutEffect, useRef, useState, type FC } from "react";
import { useReactFlow, type XYPosition } from "@xyflow/react";
import { ColorPicker, Menu, type MenuDefinition } from "../../../../primitives";
import { useFloatingPosition } from "../../../../../hooks/useFloatingPosition";
import type { RichText, RichTextAlign } from "../../types/flow.types";
import {
  RICH_TEXT_FONT_FAMILIES,
  fullRange,
  setRichTextAlign,
  setRunColor,
  setRunFontFamily,
  setRunFontSize,
  toggleRunProperty,
} from "../../utils/richText";
import "./text-format-toolbar.css";

export interface TextFormatToolbarProps {
  label: RichText;
  anchorPosition: XYPosition;
  onChange: (next: RichText) => void;
  onClose: () => void;
}

const FONT_FAMILIES = RICH_TEXT_FONT_FAMILIES;
const ALIGNMENTS: RichTextAlign[] = ["left", "center", "right"];

export interface TextFormatControlsProps {
  label: RichText;
  onChange: (next: RichText) => void;
  disabled?: boolean;
}

export const TextFormatControls: FC<TextFormatControlsProps> = ({
  label,
  onChange,
  disabled = false,
}) => {
  const range = fullRange(label);
  const firstRun = label.runs[0];

  const fontFamilyMenu: MenuDefinition = {
    id: "font-family",
    label: firstRun?.fontFamily ?? "Default",
    disabled,
    items: [
      {
        type: "action",
        id: "default",
        label: "Default",
        onSelect: () => onChange(setRunFontFamily(label, range, undefined)),
      },
      ...FONT_FAMILIES.map((font) => ({
        type: "action" as const,
        id: font,
        label: font,
        onSelect: () => onChange(setRunFontFamily(label, range, font)),
      })),
    ],
  };

  return (
    <div
      className={["wec-flow-text-toolbar__controls", disabled ? "wec-flow-text-toolbar__controls--disabled" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-disabled={disabled}
    >
      <div className="wec-flow-text-toolbar__group wec-flow-text-toolbar__font-menu">
        <Menu menu={fontFamilyMenu} />
        <input
          type="number"
          className="wec-flow-text-toolbar__size-input"
          aria-label="Font size"
          min={8}
          max={96}
          disabled={disabled}
          value={firstRun?.fontSize ?? ""}
          onChange={(event) =>
            onChange(
              setRunFontSize(label, range, event.target.value ? Number(event.target.value) : undefined),
            )
          }
        />
      </div>
      <span className="wec-flow-text-toolbar__divider" aria-hidden="true" />
      <div className="wec-flow-text-toolbar__group">
        <button
          type="button"
          className="wec-flow-text-toolbar__button"
          aria-label="Bold"
          aria-pressed={Boolean(firstRun?.bold)}
          disabled={disabled}
          onClick={() => onChange(toggleRunProperty(label, range, "bold"))}
        >
          B
        </button>
        <button
          type="button"
          className="wec-flow-text-toolbar__button"
          aria-label="Italic"
          aria-pressed={Boolean(firstRun?.italic)}
          disabled={disabled}
          onClick={() => onChange(toggleRunProperty(label, range, "italic"))}
        >
          I
        </button>
        <button
          type="button"
          className="wec-flow-text-toolbar__button"
          aria-label="Underline"
          aria-pressed={Boolean(firstRun?.underline)}
          disabled={disabled}
          onClick={() => onChange(toggleRunProperty(label, range, "underline"))}
        >
          U
        </button>
        <button
          type="button"
          className="wec-flow-text-toolbar__button"
          aria-label="Strikethrough"
          aria-pressed={Boolean(firstRun?.strike)}
          disabled={disabled}
          onClick={() => onChange(toggleRunProperty(label, range, "strike"))}
        >
          S
        </button>
      </div>
      <span className="wec-flow-text-toolbar__divider" aria-hidden="true" />
      <div className="wec-flow-text-toolbar__group">
        <ColorPicker
          value={firstRun?.color ?? null}
          onChange={(value) => onChange(setRunColor(label, range, value ?? undefined))}
          allowNone
          ariaLabel="Text color"
        />
      </div>
      <span className="wec-flow-text-toolbar__divider" aria-hidden="true" />
      <div className="wec-flow-text-toolbar__group">
        {ALIGNMENTS.map((align) => (
          <button
            key={align}
            type="button"
            className="wec-flow-text-toolbar__button"
            aria-label={`Align ${align}`}
            aria-pressed={label.align === align}
            disabled={disabled}
            onClick={() => onChange(setRichTextAlign(label, align))}
          >
            {align.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

export const TextFormatToolbar: FC<TextFormatToolbarProps> = ({
  label,
  anchorPosition,
  onChange,
}) => {
  const { flowToScreenPosition } = useReactFlow();
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [screenPosition, setScreenPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const screen = flowToScreenPosition(anchorPosition);
    setScreenPosition({ left: screen.x, top: screen.y - 48 });
  }, [anchorPosition, flowToScreenPosition]);

  const position = useFloatingPosition(anchorRef, panelRef, screenPosition !== null, "bottom-start");

  if (!screenPosition) return null;

  return (
    <>
      <div
        ref={anchorRef}
        className="wec-flow-text-toolbar__anchor"
        style={{ left: screenPosition.left, top: screenPosition.top }}
      />
      <div
        ref={panelRef}
        className="wec-flow-text-toolbar"
        style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      >
        <TextFormatControls label={label} onChange={onChange} />
      </div>
    </>
  );
};

export default TextFormatToolbar;
