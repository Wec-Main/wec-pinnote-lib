import { useCallback, useEffect, useState } from "react";
import { AiWorkSlotContext } from "../Ai/AiWorkSlot";
import { useAnnotationAuth, useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { useFlowDocument } from "../../hooks/useFlowDocument";
import { useFlowStream } from "../../hooks/useFlowStream";
import type { StreamEvent } from "../../types/stream.types";
import { FlowDocumentEditor } from "./FlowDocumentEditor";
import { FlowListPanel } from "./FlowListPanel";

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

interface FlowEditorPaneProps {
  flowId: string;
}

function remoteRevision(event: StreamEvent, flowId: string): number | null {
  if (event.eventType !== "flow_document.saved" || event.payload.flowId !== flowId) {
    return null;
  }
  return event.payload.revision;
}

function FlowEditorPane({ flowId }: FlowEditorPaneProps) {
  const { config } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const signedIn = Boolean(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const flowDocument = useFlowDocument({
    apiBaseUrl: config.apiBaseUrl,
    getAuthToken: config.getAuthToken,
    sessionKey,
    flowId,
  });
  const { applyRemoteRevision, reload } = flowDocument;
  const currentUserId = activeAccount?.id;

  const onStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.eventType === "flow.deleted" && event.payload.flowId === flowId) {
        reload();
        return;
      }
      const revision = remoteRevision(event, flowId);
      if (revision !== null && event.actorUserId !== currentUserId) {
        applyRemoteRevision(revision);
      }
    },
    [applyRemoteRevision, currentUserId, flowId, reload],
  );

  const reloadIfIdle = useCallback(
    () => applyRemoteRevision(Number.POSITIVE_INFINITY),
    [applyRemoteRevision],
  );

  useFlowStream({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    getAuthToken: config.getAuthToken,
    sessionKey,
    enabled: Boolean(sessionKey),
    onEvent: onStreamEvent,
    onResync: reloadIfIdle,
  });

  return (
    <FlowDocumentEditor
      flowDocument={flowDocument}
      flowId={flowId}
      source="panel"
      signedIn={signedIn}
      resolveError={errorMessage(flowDocument.error)}
    />
  );
}

export function WecFlowPanel() {
  const { setFlowOpen, referenceRequest, consumeReferenceRequest, guardFlowLeave } =
    useAnnotationContext();
  const [openFlowId, setOpenFlowId] = useState<string | null>(null);

  useEffect(() => {
    if (referenceRequest?.kind === "flow") {
      const flowId = referenceRequest.id;
      consumeReferenceRequest();
      guardFlowLeave("panel", () => setOpenFlowId(flowId));
    }
  }, [consumeReferenceRequest, guardFlowLeave, referenceRequest]);

  const [aiWorkSlot, setAiWorkSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="wpn-flow-panel">
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="flow" />
          </span>
          <span className="wpn-panel__title">Flow</span>
          {openFlowId ? (
            <button
              type="button"
              className="wpn-flow-panel__back"
              onClick={() => guardFlowLeave("panel", () => setOpenFlowId(null))}
            >
              <Icon name="chevronLeft" className="wpn-flow-panel__back-icon" />
              Back to flows
            </button>
          ) : null}
        </span>
        <div className="wpn-flow-panel__status" ref={setAiWorkSlot} />
        <div className="wpn-flow-panel__header-actions">
          {openFlowId ? (
            <Tooltip label={shortcutList} placement="bottom">
              <button type="button" className="wpn-icon-btn" aria-label="Keyboard shortcuts">
                <Icon name="info" />
              </button>
            </Tooltip>
          ) : null}
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
        <AiWorkSlotContext.Provider value={aiWorkSlot}>
          {openFlowId ? (
            <FlowEditorPane flowId={openFlowId} />
          ) : (
            <FlowListPanel onOpen={setOpenFlowId} />
          )}
        </AiWorkSlotContext.Provider>
      </div>
    </div>
  );
}
