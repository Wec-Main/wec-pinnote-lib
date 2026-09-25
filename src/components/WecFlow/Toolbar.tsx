import { memo, useRef, useState, type ReactNode } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import type { FlowJSON } from "../../types/flowchart.types";
import { FlowParseError, parseFlow, stringifyFlow } from "../../utils/flowchart/serialization";
import { cx, shallowEqual } from "../../utils/flowchart/shallow";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./FlowIcons";

export type NoticeKind = "info" | "success" | "error";

export type FlowCommitHandler = (flow: FlowJSON) => void | Promise<void>;

export interface ToolbarProps {
  /** Brand / title area on the left. */
  brand?: ReactNode;
  /** Called with user-facing feedback (import results, errors…). */
  onNotify?: (message: string, kind: NoticeKind) => void;
  /** Override the default "download a .json file" export behaviour. */
  onExport?: (json: string) => void;
  /** Shows a Save button; called after the user confirms. */
  onSave?: FlowCommitHandler;
  /** Shows a Publish button; called after the user confirms. */
  onPublish?: FlowCommitHandler;
  /** Extra buttons rendered before Save and Publish. */
  extraActions?: ReactNode;
  className?: string;
}

type PendingCommit = "save" | "publish";

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "flow";

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Top toolbar: name, mode and history on the left; validation, files, save and publish on the right. */
export const Toolbar = memo(function Toolbar({
  brand,
  onNotify,
  onExport,
  onSave,
  onPublish,
  extraActions,
  className,
}: ToolbarProps) {
  const engine = useFlowEngine();
  const canUndo = useFlowState((s) => s.canUndo);
  const canRedo = useFlowState((s) => s.canRedo);
  const readOnly = useFlowState((s) => s.readOnly);
  const flowName = useFlowState((s) => s.flowName);
  const errorCount = useFlowState((s) => s.validation?.errorCount ?? null);
  const [nodeCount, edgeCount] = useFlowState(
    (s) => [s.nodes.length, s.edges.length] as const,
    shallowEqual,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingCommit | null>(null);
  const [publishErrors, setPublishErrors] = useState(0);
  const notify = (m: string, k: NoticeKind) => onNotify?.(m, k);

  const exportJson = () => {
    const json = stringifyFlow(engine.toJSON());
    if (onExport) onExport(json);
    else download(`${slug(flowName)}.json`, json);
    notify("Flow exported as JSON", "success");
  };

  const importFile = async (file: File) => {
    try {
      const flow = parseFlow(await file.text());
      engine.loadFlow(flow);
      notify(
        `Imported "${flow.meta?.name ?? file.name}" — ${flow.nodes.length} nodes, ${flow.edges.length} connections`,
        "success",
      );
    } catch (e) {
      notify(
        e instanceof FlowParseError
          ? `Import failed: ${e.message}`
          : "Import failed: could not read file",
        "error",
      );
    }
  };

  const validate = () => {
    const r = engine.validate();
    if (r.valid && r.warningCount === 0) notify("Flow is valid", "success");
  };

  const requestPublish = () => {
    setPublishErrors(engine.validate().errorCount);
    setPending("publish");
  };

  const commit = async () => {
    const action = pending;
    const handler = action === "publish" ? onPublish : onSave;
    if (!action || !handler) return;
    setPending(null);
    try {
      await handler(engine.toJSON());
      notify(action === "publish" ? `"${flowName}" published` : `"${flowName}" saved`, "success");
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : `Could not ${action} the flow`, "error");
      setPending(action);
    }
  };

  return (
    <header className={cx("wpn-flowchart-toolbar__toolbar", className)}>
      <div className="wpn-flowchart-toolbar__start">
        {brand ?? (
          <span className="wpn-flowchart-toolbar__logo">
            <Icon name="flow" size={18} />
          </span>
        )}
        <span className="wpn-flowchart-toolbar__name-label">Flow Name</span>
        <input
          className="wpn-flowchart-toolbar__name"
          value={flowName}
          aria-label="Flow name"
          disabled={readOnly}
          onChange={(e) => engine.setFlowName(e.target.value)}
        />
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          disabled={readOnly}
          onClick={() => engine.newFlow()}
          title="Start a new, empty flow (can be undone)"
        >
          <Icon name="file" /> New Flow
        </button>
        <button
          type="button"
          className={cx(
            "wpn-flowchart-ui__btn",
            "wpn-flowchart-ui__btn-ghost",
            "wpn-flowchart-ui__icon-btn",
          )}
          disabled={readOnly || !canUndo}
          onClick={() => engine.undo()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className={cx(
            "wpn-flowchart-ui__btn",
            "wpn-flowchart-ui__btn-ghost",
            "wpn-flowchart-ui__icon-btn",
          )}
          disabled={readOnly || !canRedo}
          onClick={() => engine.redo()}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Icon name="redo" />
        </button>
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", readOnly && "wpn-flowchart-ui__btn-active")}
          aria-pressed={readOnly}
          onClick={() => engine.setReadOnly(!readOnly)}
          title={readOnly ? "Switch to edit mode" : "Switch to read-only mode"}
        >
          <Icon name={readOnly ? "lock" : "unlock"} /> {readOnly ? "Read-only" : "Editing"}
        </button>
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
      </div>

      <div className="wpn-flowchart-toolbar__actions">
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          onClick={validate}
          title="Check the flow for problems"
        >
          <Icon name="check" /> Validate
          {errorCount !== null && errorCount > 0 && (
            <span className="wpn-flowchart-toolbar__badge">{errorCount}</span>
          )}
        </button>
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          disabled={readOnly}
          onClick={() => fileRef.current?.click()}
          title="Load a flow from a JSON file"
        >
          <Icon name="upload" /> Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          onClick={exportJson}
          title="Download the flow as JSON"
        >
          <Icon name="download" /> Export JSON
        </button>
        {extraActions}
        {(onSave || onPublish) && (
          <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        )}
        {onSave && (
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
            disabled={readOnly}
            onClick={() => setPending("save")}
            title="Save the current flow"
          >
            <Icon name="save" /> Save
          </button>
        )}
        {onPublish && (
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-primary")}
            disabled={readOnly}
            onClick={requestPublish}
            title="Publish this flow"
          >
            <Icon name="publish" /> Publish
          </button>
        )}
      </div>

      {pending === "save" && (
        <ConfirmDialog
          title="Save flow?"
          icon="save"
          confirmLabel="Save"
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        >
          <p>
            Save the current changes to <strong>{flowName}</strong> ({plural(nodeCount, "node")},{" "}
            {plural(edgeCount, "connection")})?
          </p>
        </ConfirmDialog>
      )}
      {pending === "publish" && (
        <ConfirmDialog
          title="Publish flow?"
          icon="publish"
          confirmLabel="Publish"
          warning={
            publishErrors > 0
              ? `Validation found ${plural(publishErrors, "error")}. You can still publish, or cancel and fix them first.`
              : undefined
          }
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        >
          <p>
            Publishing replaces the live version of <strong>{flowName}</strong> with this one (
            {plural(nodeCount, "node")}, {plural(edgeCount, "connection")}).
          </p>
        </ConfirmDialog>
      )}
    </header>
  );
});
