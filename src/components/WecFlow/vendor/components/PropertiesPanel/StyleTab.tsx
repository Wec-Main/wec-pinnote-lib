import { useState, type FC, type ReactElement } from "react";
import { ColorPicker } from "../../../../primitives";
import type {
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeArrowShape,
  FlowEdgeLineStyle,
  FlowEdgeRouting,
  FlowNode,
  FlowNodeStyle,
} from "../../types/flow.types";
import { commonEdgeStyle, commonNodeStyle } from "../../utils/selectionStyle";
import {
  readStyleClipboard,
  writeStyleClipboard,
  writeDefaultNodeStyle,
} from "../../utils/styleClipboard";

interface StyleActionRowProps {
  readonly: boolean;
  current: Partial<FlowNodeStyle>;
  onApply: (style: Partial<FlowNodeStyle>) => void;
}

function StyleActionRow({ readonly, current, onApply }: StyleActionRowProps): ReactElement {
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string): void => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 1500);
  };

  return (
    <div className="wec-flow-properties__field wec-flow-properties__style-action-row">
      <button
        type="button"
        className="wec-flow-properties__action"
        disabled={readonly}
        onClick={() => {
          const stored = readStyleClipboard();
          if (stored) {
            onApply(stored);
            flash("Style pasted");
          } else {
            writeStyleClipboard(current);
            flash("Style copied");
          }
        }}
      >
        Copy Style
      </button>
      <button
        type="button"
        className="wec-flow-properties__action"
        disabled={readonly}
        onClick={() => {
          writeDefaultNodeStyle(current);
          flash("Set as default");
        }}
      >
        Set as Default Style
      </button>
      {status && <span className="wec-flow-properties__style-action-status">{status}</span>}
    </div>
  );
}

export interface StyleTabProps {
  selectedNodes: FlowNode[];
  selectedEdges: FlowEdge[];
  onUpdateNodeStyle: (updates: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineStyle?: FlowEdgeLineStyle;
    opacity?: number;
    rotation?: number;
    perimeter?: number;
    shadow?: boolean;
    glow?: boolean;
    cornerRadius?: number;
  }) => void;
  onUpdateEdgeStyle: (updates: {
    stroke?: string;
    strokeWidth?: number;
    lineStyle?: FlowEdgeLineStyle;
    arrowStart?: FlowEdgeArrow;
    arrowEnd?: FlowEdgeArrow;
    arrowStartShape?: FlowEdgeArrowShape;
    arrowEndShape?: FlowEdgeArrowShape;
    routing?: FlowEdgeRouting;
  }) => void;
  readonly?: boolean;
}

interface StylePreset {
  label: string;
  fill: string;
  stroke: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { label: "Start", fill: "var(--wec-flow-accent-start, #16a34a)", stroke: "#16a34a" },
  { label: "Process", fill: "var(--wec-flow-accent-process, #64748b)", stroke: "#64748b" },
  { label: "Decision", fill: "var(--wec-flow-accent-decision, #d97706)", stroke: "#d97706" },
  { label: "Input", fill: "var(--wec-flow-accent-input, #0891b2)", stroke: "#0891b2" },
  { label: "Output", fill: "var(--wec-flow-accent-output, #7c3aed)", stroke: "#7c3aed" },
  { label: "Cloud", fill: "var(--wec-flow-accent-cloud, #38bdf8)", stroke: "#38bdf8" },
  { label: "Neutral", fill: "#64748b", stroke: "#334155" },
  { label: "No fill", fill: "transparent", stroke: "#94a3b8" },
];

function StylePresetGallery({
  onApply,
  readonly,
}: {
  onApply: (fill: string, stroke: string) => void;
  readonly: boolean;
}): ReactElement {
  return (
    <div className="wec-flow-properties__field">
      <label className="wec-flow-properties__label">Quick style</label>
      <div className="wec-flow-properties__style-presets">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="wec-flow-properties__style-preset"
            style={{ backgroundColor: preset.fill, borderColor: preset.stroke }}
            title={preset.label}
            aria-label={preset.label}
            disabled={readonly}
            onClick={() => onApply(preset.fill, preset.stroke)}
          />
        ))}
      </div>
    </div>
  );
}

export const StyleTab: FC<StyleTabProps> = ({
  selectedNodes,
  selectedEdges,
  onUpdateNodeStyle,
  onUpdateEdgeStyle,
  readonly = false,
}) => {
  if (selectedNodes.length > 0) {
    const common = commonNodeStyle(selectedNodes);
    return (
      <div className="wec-flow-properties__form">
        <StylePresetGallery
          readonly={readonly}
          onApply={(fill, stroke) => onUpdateNodeStyle({ fill, stroke })}
        />
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Fill</label>
          <ColorPicker
            value={common.fill.value ?? null}
            onChange={(value) => onUpdateNodeStyle({ fill: value ?? undefined })}
            allowNone
            noneLabel={common.fill.mixed ? "Mixed" : "None"}
            ariaLabel="Fill color"
            showValue
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Stroke</label>
          <ColorPicker
            value={common.stroke.value ?? null}
            onChange={(value) => onUpdateNodeStyle({ stroke: value ?? undefined })}
            allowNone
            noneLabel={common.stroke.mixed ? "Mixed" : "None"}
            ariaLabel="Stroke color"
            showValue
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Stroke width</label>
          <input
            type="number"
            className="wec-flow-properties__input"
            min={0}
            value={common.strokeWidth.value ?? ""}
            placeholder={common.strokeWidth.mixed ? "Mixed" : undefined}
            disabled={readonly}
            onChange={(event) =>
              onUpdateNodeStyle({ strokeWidth: Number(event.target.value) || 0 })
            }
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Line style</label>
          <select
            className="wec-flow-properties__input"
            value={common.lineStyle.value ?? ""}
            disabled={readonly}
            onChange={(event) =>
              onUpdateNodeStyle({ lineStyle: event.target.value as FlowEdgeLineStyle })
            }
          >
            {common.lineStyle.mixed && <option value="">Mixed</option>}
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Opacity</label>
          <input
            type="range"
            min={0}
            max={100}
            value={common.opacity.value ?? 100}
            disabled={readonly}
            onChange={(event) => onUpdateNodeStyle({ opacity: Number(event.target.value) })}
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Rotation (deg)</label>
          <input
            type="number"
            className="wec-flow-properties__input"
            value={common.rotation.value ?? ""}
            placeholder={common.rotation.mixed ? "Mixed" : undefined}
            disabled={readonly}
            onChange={(event) => onUpdateNodeStyle({ rotation: Number(event.target.value) || 0 })}
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Perimeter</label>
          <input
            type="number"
            className="wec-flow-properties__input"
            min={0}
            max={64}
            value={common.perimeter.value ?? 0}
            placeholder={common.perimeter.mixed ? "Mixed" : undefined}
            disabled={readonly}
            onChange={(event) =>
              onUpdateNodeStyle({ perimeter: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Corner radius</label>
          <input
            type="number"
            className="wec-flow-properties__input"
            min={0}
            max={100}
            value={common.cornerRadius.value ?? ""}
            placeholder={common.cornerRadius.mixed ? "Mixed" : "Default"}
            disabled={readonly}
            onChange={(event) =>
              onUpdateNodeStyle({
                cornerRadius: event.target.value ? Math.max(0, Number(event.target.value)) : undefined,
              })
            }
          />
        </div>
        <details className="wec-flow-properties__effects" open={common.shadow.value || common.glow.value}>
          <summary className="wec-flow-properties__label">Effects</summary>
          <label className="wec-flow-properties__checkbox-row">
            <input
              type="checkbox"
              checked={common.shadow.value ?? false}
              disabled={readonly}
              onChange={(event) => onUpdateNodeStyle({ shadow: event.target.checked })}
            />
            Shadow
          </label>
          <label className="wec-flow-properties__checkbox-row">
            <input
              type="checkbox"
              checked={common.glow.value ?? false}
              disabled={readonly}
              onChange={(event) => onUpdateNodeStyle({ glow: event.target.checked })}
            />
            Glow
          </label>
        </details>
        <StyleActionRow
          readonly={readonly}
          onApply={(preset) => onUpdateNodeStyle(preset)}
          current={{
            fill: common.fill.value,
            stroke: common.stroke.value,
            strokeWidth: common.strokeWidth.value,
            lineStyle: common.lineStyle.value,
            opacity: common.opacity.value,
            perimeter: common.perimeter.value,
            shadow: common.shadow.value,
            glow: common.glow.value,
            cornerRadius: common.cornerRadius.value,
          }}
        />
      </div>
    );
  }

  if (selectedEdges.length > 0) {
    const common = commonEdgeStyle(selectedEdges);
    return (
      <div className="wec-flow-properties__form">
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Stroke</label>
          <ColorPicker
            value={common.stroke.value ?? null}
            onChange={(value) => onUpdateEdgeStyle({ stroke: value ?? undefined })}
            allowNone
            noneLabel={common.stroke.mixed ? "Mixed" : "None"}
            ariaLabel="Edge stroke color"
            showValue
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Stroke width</label>
          <input
            type="number"
            className="wec-flow-properties__input"
            min={0}
            value={common.strokeWidth.value ?? ""}
            placeholder={common.strokeWidth.mixed ? "Mixed" : undefined}
            disabled={readonly}
            onChange={(event) =>
              onUpdateEdgeStyle({ strokeWidth: Number(event.target.value) || 0 })
            }
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Line style</label>
          <select
            className="wec-flow-properties__input"
            value={common.lineStyle.value ?? ""}
            disabled={readonly}
            onChange={(event) =>
              onUpdateEdgeStyle({ lineStyle: event.target.value as FlowEdgeLineStyle })
            }
          >
            {common.lineStyle.mixed && <option value="">Mixed</option>}
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div className="wec-flow-properties__field-group">
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Arrow start</label>
            <select
              className="wec-flow-properties__input"
              value={common.arrowStart.value ?? ""}
              disabled={readonly}
              onChange={(event) =>
                onUpdateEdgeStyle({ arrowStart: event.target.value as FlowEdgeArrow })
              }
            >
              {common.arrowStart.mixed && <option value="">Mixed</option>}
              <option value="none">None</option>
              <option value="forward">Arrowhead</option>
            </select>
          </div>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Start shape</label>
            <select
              className="wec-flow-properties__input"
              value={common.arrowStartShape.value ?? ""}
              disabled={readonly || common.arrowStart.value === "none"}
              onChange={(event) =>
                onUpdateEdgeStyle({ arrowStartShape: event.target.value as FlowEdgeArrowShape })
              }
            >
              {common.arrowStartShape.mixed && <option value="">Mixed</option>}
              <option value="triangle">Filled</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>
        <div className="wec-flow-properties__field-group">
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Arrow end</label>
            <select
              className="wec-flow-properties__input"
              value={common.arrowEnd.value ?? ""}
              disabled={readonly}
              onChange={(event) =>
                onUpdateEdgeStyle({ arrowEnd: event.target.value as FlowEdgeArrow })
              }
            >
              {common.arrowEnd.mixed && <option value="">Mixed</option>}
              <option value="none">None</option>
              <option value="forward">Arrowhead</option>
            </select>
          </div>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">End shape</label>
            <select
              className="wec-flow-properties__input"
              value={common.arrowEndShape.value ?? ""}
              disabled={readonly || common.arrowEnd.value === "none"}
              onChange={(event) =>
                onUpdateEdgeStyle({ arrowEndShape: event.target.value as FlowEdgeArrowShape })
              }
            >
              {common.arrowEndShape.mixed && <option value="">Mixed</option>}
              <option value="triangle">Filled</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>
        <label className="wec-flow-properties__checkbox-row">
          <input
            type="checkbox"
            checked={common.arrowStart.value === "forward" && common.arrowEnd.value === "forward"}
            disabled={readonly}
            onChange={(event) =>
              onUpdateEdgeStyle({
                arrowStart: event.target.checked ? "forward" : "none",
                arrowEnd: event.target.checked ? "forward" : "none",
              })
            }
          />
          Both ends
        </label>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">Connector style</label>
          <select
            className="wec-flow-properties__input"
            value={common.routing.value ?? ""}
            disabled={readonly}
            onChange={(event) =>
              onUpdateEdgeStyle({ routing: event.target.value as FlowEdgeRouting })
            }
          >
            {common.routing.mixed && <option value="">Mixed</option>}
            <option value="straight">Straight</option>
            <option value="orthogonal">Orthogonal</option>
            <option value="curved">Curved</option>
          </select>
        </div>
      </div>
    );
  }

  return <div className="wec-flow-properties__empty">Select a node or connection to style it.</div>;
};

export default StyleTab;
