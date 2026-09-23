import type { DragEvent, FC } from "react";
import "../../styles/palette.css";
import type { FlowNodeType } from "../../types/flow.types";

export interface NodePaletteProps {
  readonly?: boolean;
  className?: string;
  onNodeDragStart?: (type: FlowNodeType) => void;
  onNodeDragEnd?: () => void;
}

interface PaletteItemDefinition {
  type: FlowNodeType;
  label: string;
}

const PALETTE_ITEMS: PaletteItemDefinition[] = [
  { type: "start", label: "Start" },
  { type: "process", label: "Process" },
  { type: "decision", label: "Decision" },
  { type: "input", label: "Input" },
  { type: "output", label: "Output" },
  { type: "end", label: "End" },
];

export const NODE_PALETTE_DATA_TRANSFER_TYPE = "application/wec-flow-node";

export const NodePalette: FC<NodePaletteProps> = ({
  readonly = false,
  className,
  onNodeDragStart,
  onNodeDragEnd,
}) => {
  const rootClassName = className
    ? `wec-flow-palette ${className}`
    : "wec-flow-palette";

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    nodeType: FlowNodeType,
  ): void => {
    if (readonly) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(NODE_PALETTE_DATA_TRANSFER_TYPE, nodeType);
    event.dataTransfer.effectAllowed = "move";
    onNodeDragStart?.(nodeType);
  };

  return (
    <div className={rootClassName}>
      <div className="wec-flow-palette__header">
        <span className="wec-flow-palette__header-title">
          <span className="wec-flow-palette__header-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13">
              <circle cx="6" cy="5.5" r="2.2" />
              <circle cx="6" cy="18.5" r="2.2" />
              <circle cx="18" cy="12" r="2.2" />
              <path d="M6 7.7v8.6M8 6.2l7.3 4.6M8 17.8l7.3-4.6" />
            </svg>
          </span>
          Nodes
          <span className="wec-flow-palette__header-count">{PALETTE_ITEMS.length}</span>
        </span>
      </div>
      <div className="wec-flow-palette__body">
        {readonly ? (
          <p className="wec-flow-palette__note">Read-only mode</p>
        ) : null}
        <div className="wec-flow-palette__list">
          {PALETTE_ITEMS.map((item) => {
            const itemClassName = readonly
              ? "wec-flow-palette__item wec-flow-palette__item--disabled"
              : "wec-flow-palette__item";

            return (
              <div
                key={item.type}
                role="button"
                tabIndex={readonly ? -1 : 0}
                className={itemClassName}
                draggable={!readonly}
                aria-disabled={readonly ? "true" : undefined}
                title={`Drag to add a ${item.label} node`}
                onDragStart={(event) => handleDragStart(event, item.type)}
                onDragEnd={() => onNodeDragEnd?.()}
              >
                <span
                  className={`wec-flow-palette__shape wec-flow-palette__shape--${item.type}`}
                  aria-hidden="true"
                />
                <span className="wec-flow-palette__label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NodePalette;
