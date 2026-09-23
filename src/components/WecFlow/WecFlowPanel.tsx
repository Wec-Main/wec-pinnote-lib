import { useCallback, useRef, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  FlowBuilder,
  exportFlow,
  importFlow,
  validateFlow,
  FlowImportError,
  type FlowBuilderRef,
  type FlowDefinition,
  type FlowValidationResult,
} from "./vendor";

function isFlowDefinition(value: unknown): value is FlowDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
}

function emptyFlow(): FlowDefinition {
  return { id: "flow", name: "Untitled Flow", nodes: [], edges: [] };
}

function dispatchShortcut(key: string, options: { shiftKey?: boolean } = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      ctrlKey: true,
      shiftKey: options.shiftKey ?? false,
      bubbles: true,
    }),
  );
}

type JsonPanelMode = "none" | "export" | "import";

export function WecFlowPanel() {
  const { setFlowOpen, config } = useAnnotationContext();
  const [minimized, setMinimized] = useState(false);
  const [flow, setFlow] = usePersistentState<FlowDefinition>(
    `wpn-ui:${config.projectId}:wecFlow`,
    emptyFlow(),
    isFlowDefinition,
  );
  const flowRef = useRef<FlowBuilderRef>(null);
  const [readonly, setReadonly] = useState(false);
  const [jsonPanelMode, setJsonPanelMode] = useState<JsonPanelMode>("none");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [validation, setValidation] = useState<FlowValidationResult | null>(null);

  const handleNewFlow = useCallback(() => {
    setFlow(emptyFlow());
    setValidation(null);
    setJsonPanelMode("none");
  }, [setFlow]);

  const handleValidate = useCallback(() => {
    setValidation(validateFlow(flow));
    setJsonPanelMode("none");
  }, [flow]);

  const handleExportOpen = useCallback(() => {
    setJsonPanelMode("export");
    setValidation(null);
  }, []);

  const handleImportOpen = useCallback(() => {
    setImportText(exportFlow(flow));
    setImportError(null);
    setJsonPanelMode("import");
    setValidation(null);
  }, [flow]);

  const handleImportApply = useCallback(() => {
    try {
      const next = importFlow(importText);
      setFlow(next);
      setImportError(null);
      setJsonPanelMode("none");
    } catch (error) {
      setImportError(error instanceof FlowImportError ? error.message : "Failed to import flow.");
    }
  }, [importText, setFlow]);

  return (
    <div
      className={["wpn-flow-panel", minimized ? "wpn-flow-panel--minimized" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <Icon name="flow" />
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

      <div className="wpn-flow-panel__toolbar" role="toolbar" aria-label="Flow editor toolbar">
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={handleNewFlow}
          title="Start a new empty flow"
        >
          <Icon name="plus" className="wpn-btn__icon" />
          New Flow
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={() => dispatchShortcut("z")}
          title="Undo (Ctrl+Z)"
        >
          <Icon name="reset" className="wpn-btn__icon" />
          Undo
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={() => dispatchShortcut("z", { shiftKey: true })}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Icon name="redo" className="wpn-btn__icon" />
          Redo
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={() => flowRef.current?.fitView()}
          title="Fit the flow to the viewport"
        >
          <Icon name="expand" className="wpn-btn__icon" />
          Fit View
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={handleValidate}
          title="Validate the current flow"
        >
          <Icon name="check" className="wpn-btn__icon" />
          Validate
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={handleExportOpen}
          title="View the flow as JSON"
        >
          <Icon name="download" className="wpn-btn__icon" />
          Export JSON
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          onClick={handleImportOpen}
          title="Load a flow from JSON"
        >
          <Icon name="upload" className="wpn-btn__icon" />
          Import JSON
        </button>
        <label className="wpn-flow-panel__toggle" title="Toggle read-only mode">
          <input
            type="checkbox"
            checked={readonly}
            onChange={(event) => setReadonly(event.target.checked)}
          />
          Read-only
        </label>
      </div>

      {validation ? (
        <div
          className={[
            "wpn-flow-panel__banner",
            validation.valid ? "wpn-flow-panel__banner--ok" : "wpn-flow-panel__banner--error",
          ].join(" ")}
        >
          {validation.valid ? (
            <span>Flow is valid — no issues found.</span>
          ) : (
            <ul>
              {validation.errors.map((error, index) => (
                <li key={`${error.code}-${index}`}>{error.message}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={() => setValidation(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {jsonPanelMode === "export" ? (
        <div className="wpn-flow-panel__json-panel">
          <div className="wpn-flow-panel__json-panel-header">
            <span>Exported Flow JSON</span>
            <button
              type="button"
              className="wpn-icon-btn"
              onClick={() => setJsonPanelMode("none")}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <textarea
            className="wpn-flow-panel__json-textarea"
            readOnly
            value={exportFlow(flow)}
            aria-label="Exported flow JSON"
          />
        </div>
      ) : null}

      {jsonPanelMode === "import" ? (
        <div className="wpn-flow-panel__json-panel">
          <div className="wpn-flow-panel__json-panel-header">
            <span>Import Flow JSON</span>
            <button
              type="button"
              className="wpn-icon-btn"
              onClick={() => setJsonPanelMode("none")}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <textarea
            className="wpn-flow-panel__json-textarea"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            aria-label="Flow JSON to import"
          />
          {importError ? <p className="wpn-flow-panel__json-error">{importError}</p> : null}
          <button type="button" className="wpn-btn wpn-btn--primary" onClick={handleImportApply}>
            Apply
          </button>
        </div>
      ) : null}

      <div className="wpn-flow-panel__body">
        <FlowBuilder
          ref={flowRef}
          value={flow}
          onChange={setFlow}
          readonly={readonly}
          showMiniMap
          height="100%"
        />
      </div>
    </div>
  );
}
