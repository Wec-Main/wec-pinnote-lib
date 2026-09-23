import { useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { FlowEditor, parseFlow } from "../WecFlow/flowchart";
import type { FlowPin } from "../../types/flowPin.types";

interface FlowPinPanelProps {
  flowPin: FlowPin;
}

export function FlowPinPanel({ flowPin }: FlowPinPanelProps) {
  const { updateFlowPinFlow, removeFlowPin, selectFlowPin } = useAnnotationContext();
  const [minimized, setMinimized] = useState(false);
  const [initialFlow] = useState(() => parseFlow(flowPin.flow));

  return (
    <div
      className={["wpn-flow-panel", minimized ? "wpn-flow-panel--minimized" : ""].filter(Boolean).join(" ")}
    >
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="flow" />
          </span>
          <span className="wpn-panel__title">{flowPin.name}</span>
        </span>
        <div className="wpn-flow-panel__header-actions">
          <Tooltip label="Delete this flow" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Delete flow"
              onClick={() => removeFlowPin(flowPin.id)}
            >
              <Icon name="trash" />
            </button>
          </Tooltip>
          <Tooltip label={minimized ? "Maximize" : "Minimize"} placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label={minimized ? "Maximize Flow" : "Minimize Flow"}
              onClick={() => setMinimized((current) => !current)}
            >
              <Icon name={minimized ? "expand" : "windowMinimize"} />
            </button>
          </Tooltip>
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close Flow"
              onClick={() => selectFlowPin(null)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-flow-panel__body">
        <FlowEditor
          initialFlow={initialFlow}
          defaultEdgeType="step"
          onChange={(next) => updateFlowPinFlow(flowPin.id, next)}
          brand={<></>}
        />
      </div>
    </div>
  );
}
