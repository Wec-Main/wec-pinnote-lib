import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  FlowBuilder,
  MenuBar,
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
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
    return false;
  }
  return (
    Array.isArray(candidate.pages) ||
    (Array.isArray(candidate.nodes) && Array.isArray(candidate.edges))
  );
}

function emptyFlow(): FlowDefinition {
  const pageId = "page-1";
  return {
    id: "flow",
    name: "Untitled Flow",
    pages: [{ id: pageId, name: "Page 1", nodes: [], edges: [] }],
    activePageId: pageId,
  };
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

  useEffect(() => {
    if (Array.isArray(flow.pages)) return;
    setFlow(importFlow(JSON.stringify(flow)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flowRef = useRef<FlowBuilderRef>(null);
  const [readonly, setReadonly] = useState(false);
  const [jsonPanelMode, setJsonPanelMode] = useState<JsonPanelMode>("none");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [validation, setValidation] = useState<FlowValidationResult | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [rulersVisible, setRulersVisible] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, forceMenuBarUpdate] = useState(0);

  const handleFlowChange = useCallback(
    (next: FlowDefinition) => {
      setFlow(next);
      forceMenuBarUpdate((tick) => tick + 1);
    },
    [setFlow],
  );

  const handleToggleGrid = useCallback((visible: boolean) => {
    setGridVisible(visible);
    flowRef.current?.setGridVisible(visible);
  }, []);

  const handleToggleRulers = useCallback((visible: boolean) => {
    setRulersVisible(visible);
    flowRef.current?.setRulersVisible(visible);
  }, []);

  const handleToggleOutline = useCallback((visible: boolean) => {
    setOutlineVisible(visible);
    flowRef.current?.setOutlineVisible(visible);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    flowRef.current?.toggleFullscreen();
    setIsFullscreen(flowRef.current?.isFullscreen() ?? false);
  }, []);

  const handleNewFlow = useCallback(() => {
    setFlow(emptyFlow());
    setValidation(null);
    setJsonPanelMode("none");
    forceMenuBarUpdate((tick) => tick + 1);
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
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="flow" />
          </span>
          <span className="wpn-panel__title">{flow.name || "Untitled Flow"}</span>
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

      <MenuBar
        flowRef={flowRef}
        readonly={readonly}
        gridVisible={gridVisible}
        onToggleGrid={handleToggleGrid}
        rulersVisible={rulersVisible}
        onToggleRulers={handleToggleRulers}
        outlineVisible={outlineVisible}
        onToggleOutline={handleToggleOutline}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onNewFlow={handleNewFlow}
        onExportOpen={handleExportOpen}
        onImportOpen={handleImportOpen}
        onValidate={handleValidate}
        onToggleReadonly={setReadonly}
      />

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
            <Icon name="close" />
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
              <Icon name="close" />
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
              <Icon name="close" />
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
          value={Array.isArray(flow.pages) ? flow : importFlow(JSON.stringify(flow))}
          onChange={handleFlowChange}
          readonly={readonly}
          showMiniMap
          height="100%"
        />
      </div>
    </div>
  );
}
