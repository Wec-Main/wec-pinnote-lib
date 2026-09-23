import { useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { usePersistentState } from "../../hooks/usePersistentState";
import { FlowEditor, parseFlow, type FlowJSON } from "./flowchart";

function isFlowJSON(value: unknown): value is FlowJSON {
  try {
    parseFlow(value);
    return true;
  } catch {
    return false;
  }
}

const EMPTY_FLOW: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "Untitled Flow" } };

export function WecFlowPanel() {
  const { setFlowOpen, config } = useAnnotationContext();
  const [minimized, setMinimized] = useState(false);
  const [flow, setFlow] = usePersistentState<FlowJSON>(
    `wpn-ui:${config.projectId}:wecFlowchart`,
    EMPTY_FLOW,
    isFlowJSON,
  );
  const [initialFlow] = useState(() => parseFlow(flow));

  return (
    <div
      className={["wpn-flow-panel", minimized ? "wpn-flow-panel--minimized" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="flow" />
          </span>
          <span className="wpn-panel__title">Flow</span>
        </span>
        <div className="wpn-flow-panel__header-actions">
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
              onClick={() => setFlowOpen(false)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-flow-panel__body">
        <FlowEditor initialFlow={initialFlow} onChange={setFlow} brand={<></>} />
      </div>
    </div>
  );
}
