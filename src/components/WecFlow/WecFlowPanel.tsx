import { useState } from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { useSharedFetch } from "../../hooks/useSharedFetch";
import { useFlowDocument } from "../../hooks/useFlowDocument";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { resolveDefaultFlow } from "../../services/flowApi";
import { FlowDocumentEditor } from "./FlowDocumentEditor";

const SHORTCUTS: [string, string][] = [
  ["Delete", "Delete selection"],
  ["Ctrl Z", "Undo"],
  ["Ctrl Shift Z", "Redo"],
  ["Ctrl C", "Copy"],
  ["Ctrl X", "Cut"],
  ["Ctrl V", "Paste"],
  ["Ctrl D", "Duplicate"],
  ["Ctrl A", "Select all"],
  ["Shift drag", "Box select"],
  ["Space drag", "Pan"],
  ["Wheel", "Zoom"],
  ["F", "Fit view"],
  ["1", "Zoom to 100%"],
  ["Arrows", "Nudge nodes"],
  ["Alt drag", "Move without guides"],
  ["Right click", "Context menu"],
  ["Double click", "Add node"],
  ["Shift click +", "Add connected Process"],
  ["Double click bend", "Reset route"],
];

const shortcutList = (
  <dl className="wpn-flow-panel__shortcuts">
    {SHORTCUTS.map(([keys, action]) => (
      <div key={keys}>
        <dt>
          {keys.split(" ").map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </dt>
        <dd>{action}</dd>
      </div>
    ))}
  </dl>
);

function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  return error instanceof Error && error.message ? error.message : "Could not load the flow";
}

export function WecFlowPanel() {
  const { setFlowOpen, config } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const [minimized, setMinimized] = useState(false);
  const getToken = useTokenGetter(config.getAuthToken);
  const signedIn = Boolean(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const flowKey = sessionKey
    ? `default-flow:${config.apiBaseUrl}:${sessionKey}:${config.projectId}`
    : null;
  const {
    data: flow,
    error: flowError,
    reload: reloadFlow,
  } = useSharedFetch(flowKey, (signal) =>
    getToken().then((authToken) =>
      resolveDefaultFlow(config.apiBaseUrl, authToken, config.projectId, signal),
    ),
  );
  const flowDocument = useFlowDocument({
    apiBaseUrl: config.apiBaseUrl,
    getAuthToken: config.getAuthToken,
    sessionKey,
    flowId: flow?.id ?? null,
  });

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
          <Tooltip label={shortcutList} placement="bottom">
            <button type="button" className="wpn-icon-btn" aria-label="Keyboard shortcuts">
              <Icon name="info" />
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
              onClick={() => setFlowOpen(false)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-flow-panel__body">
        <FlowDocumentEditor
          flowDocument={flowDocument}
          signedIn={signedIn}
          resolveError={errorMessage(flowError)}
          onRetry={flowError ? reloadFlow : undefined}
        />
      </div>
    </div>
  );
}
