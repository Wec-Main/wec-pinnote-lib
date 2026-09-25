import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
} from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { FlowDocumentEditor } from "../WecFlow/FlowDocumentEditor";
import { useFlowDocument } from "../../hooks/useFlowDocument";
import type { FlowPin } from "../../types/flowPin.types";

const COLLAPSE_ANIMATION = "wpn-flow-collapse";
const COLLAPSE_FALLBACK_MS = 480;

interface FlowPinPanelProps {
  flowPin: FlowPin;
  originX: number;
  originY: number;
  onDelete: (flowPinId: string) => void;
}

export function FlowPinPanel({ flowPin, originX, originY, onDelete }: FlowPinPanelProps) {
  const { config, syncFlowPinName, selectFlowPin } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const [minimized, setMinimized] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const originRef = useRef({ x: originX, y: originY });
  originRef.current = { x: originX, y: originY };

  const anchorToPin = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--wpn-flow-origin-x", `${originRef.current.x - rect.left}px`);
    panel.style.setProperty("--wpn-flow-origin-y", `${originRef.current.y - rect.top}px`);
  }, []);

  useLayoutEffect(anchorToPin, [anchorToPin]);

  const close = () => {
    if (closing) {
      return;
    }
    anchorToPin();
    setClosing(true);
  };

  useEffect(() => {
    if (!closing) {
      return;
    }
    const fallback = setTimeout(() => selectFlowPin(null), COLLAPSE_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [closing, selectFlowPin]);

  const finishAnimation = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.animationName === COLLAPSE_ANIMATION) {
      selectFlowPin(null);
    }
  };

  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const signedIn = Boolean(config.getAuthToken);
  const flowDocument = useFlowDocument({
    apiBaseUrl: config.apiBaseUrl,
    getAuthToken: config.getAuthToken,
    sessionKey,
    flowId: flowPin.flowId,
    onSaved: (name) => syncFlowPinName(flowPin.id, name),
  });

  return (
    <>
      <div
        ref={panelRef}
        className={[
          "wpn-flow-panel",
          "wpn-flow-panel--from-pin",
          minimized ? "wpn-flow-panel--minimized" : "",
          closing ? "wpn-flow-panel--closing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onAnimationEnd={finishAnimation}
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
                onClick={() => setConfirmingDelete(true)}
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
                onClick={close}
              >
                <Icon name="close" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="wpn-flow-panel__body">
          <FlowDocumentEditor flowDocument={flowDocument} signedIn={signedIn} />
        </div>
      </div>
      {confirmingDelete ? (
        <ConfirmDialog
          title="Delete this flow?"
          description={`"${flowPin.name}" and its pin will be removed for everyone. This cannot be undone.`}
          confirmLabel="Delete flow"
          destructive
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete(flowPin.id);
          }}
        />
      ) : null}
    </>
  );
}
