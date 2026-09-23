import type { FC } from "react";
import { ColorPicker } from "../../../../primitives";
import type { FlowEdge, FlowNode, RichText, RichTextAlign, RichTextTransform } from "../../types/flow.types";
import {
  RICH_TEXT_FONT_FAMILIES,
  fullRange,
  setRichTextAlign,
  setRichTextLetterSpacing,
  setRichTextLineHeight,
  setRichTextSpacing,
  setRichTextTransform,
  setRunColor,
  setRunFontFamily,
  setRunFontSize,
  toggleRunProperty,
} from "../../utils/richText";

export interface TextTabProps {
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  onUpdateNodeLabel: (nodeId: string, label: RichText) => void;
  onUpdateEdgeLabel: (edgeId: string, label: RichText) => void;
  readonly?: boolean;
}

const FONT_FAMILIES = RICH_TEXT_FONT_FAMILIES;
const ALIGNMENTS: RichTextAlign[] = ["left", "center", "right"];
const TRANSFORMS: { value: RichTextTransform; label: string }[] = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "capitalize", label: "Capitalize" },
];

export const TextTab: FC<TextTabProps> = ({
  selectedNode,
  selectedEdge,
  onUpdateNodeLabel,
  onUpdateEdgeLabel,
  readonly = false,
}) => {
  const label = selectedNode?.data.label ?? selectedEdge?.label;
  if (!label) {
    return <div className="wec-flow-properties__empty">Select a node or connection to format its text.</div>;
  }

  const apply = (next: RichText): void => {
    if (selectedNode) onUpdateNodeLabel(selectedNode.id, next);
    else if (selectedEdge) onUpdateEdgeLabel(selectedEdge.id, next);
  };

  const range = fullRange(label);
  const firstRun = label.runs[0];

  return (
    <div className="wec-flow-properties__form">
      <div className="wec-flow-properties__field wec-flow-properties__field--row">
        <button
          type="button"
          className="wec-flow-properties__action"
          disabled={readonly}
          aria-pressed={Boolean(firstRun?.bold)}
          onClick={() => apply(toggleRunProperty(label, range, "bold"))}
        >
          B
        </button>
        <button
          type="button"
          className="wec-flow-properties__action"
          disabled={readonly}
          aria-pressed={Boolean(firstRun?.italic)}
          onClick={() => apply(toggleRunProperty(label, range, "italic"))}
        >
          I
        </button>
        <button
          type="button"
          className="wec-flow-properties__action"
          disabled={readonly}
          aria-pressed={Boolean(firstRun?.underline)}
          onClick={() => apply(toggleRunProperty(label, range, "underline"))}
        >
          U
        </button>
        <button
          type="button"
          className="wec-flow-properties__action"
          disabled={readonly}
          aria-pressed={Boolean(firstRun?.strike)}
          onClick={() => apply(toggleRunProperty(label, range, "strike"))}
        >
          S
        </button>
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Font</label>
        <select
          className="wec-flow-properties__input"
          value={firstRun?.fontFamily ?? ""}
          disabled={readonly}
          onChange={(event) =>
            apply(setRunFontFamily(label, range, event.target.value || undefined))
          }
        >
          <option value="">Default</option>
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Size</label>
        <input
          type="number"
          className="wec-flow-properties__input"
          min={8}
          max={96}
          value={firstRun?.fontSize ?? ""}
          disabled={readonly}
          onChange={(event) =>
            apply(
              setRunFontSize(label, range, event.target.value ? Number(event.target.value) : undefined),
            )
          }
        />
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Color</label>
        <ColorPicker
          value={firstRun?.color ?? null}
          onChange={(value) => apply(setRunColor(label, range, value ?? undefined))}
          allowNone
          ariaLabel="Text color"
          showValue
        />
      </div>
      <div className="wec-flow-properties__field wec-flow-properties__field--row">
        {ALIGNMENTS.map((align) => (
          <button
            key={align}
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly}
            aria-pressed={label.align === align}
            onClick={() => apply(setRichTextAlign(label, align))}
          >
            {align}
          </button>
        ))}
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Line height</label>
        <input
          type="number"
          className="wec-flow-properties__input"
          min={0.5}
          max={4}
          step={0.1}
          value={label.lineHeight ?? ""}
          placeholder="Default"
          disabled={readonly}
          onChange={(event) =>
            apply(
              setRichTextLineHeight(
                label,
                event.target.value ? Number(event.target.value) : undefined,
              ),
            )
          }
        />
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Letter spacing (px)</label>
        <input
          type="number"
          className="wec-flow-properties__input"
          min={-5}
          max={20}
          step={0.5}
          value={label.letterSpacing ?? ""}
          placeholder="Default"
          disabled={readonly}
          onChange={(event) =>
            apply(
              setRichTextLetterSpacing(
                label,
                event.target.value ? Number(event.target.value) : undefined,
              ),
            )
          }
        />
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Text transform</label>
        <select
          className="wec-flow-properties__input"
          value={label.transform ?? "none"}
          disabled={readonly}
          onChange={(event) =>
            apply(setRichTextTransform(label, event.target.value as RichTextTransform))
          }
        >
          {TRANSFORMS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Paragraph spacing (px)</label>
        <input
          type="number"
          className="wec-flow-properties__input"
          min={0}
          max={40}
          value={label.spacing ?? ""}
          placeholder="Default"
          disabled={readonly}
          onChange={(event) =>
            apply(
              setRichTextSpacing(label, event.target.value ? Number(event.target.value) : undefined),
            )
          }
        />
      </div>
    </div>
  );
};

export default TextTab;
