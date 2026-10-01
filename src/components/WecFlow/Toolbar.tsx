import { memo, useState, type ReactNode } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import type { FlowJSON } from "../../types/flowchart.types";
import { stringifyFlow } from "../../utils/flowchart/serialization";
import { cx, shallowEqual } from "../../utils/flowchart/shallow";
import { downloadTextFile } from "../../utils/downloadTextFile";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./FlowIcons";

export type NoticeKind = "info" | "success" | "error";

export type FlowCommitHandler = (flow: FlowJSON) => void | Promise<void>;

export interface ToolbarProps {
  brand?: ReactNode;

  onNotify?: (message: string, kind: NoticeKind) => void;

  onExport?: (json: string) => void;

  onSave?: FlowCommitHandler;

  onPublish?: FlowCommitHandler;

  extraActions?: ReactNode;

  onDelete?: () => void;
  className?: string;
}

type PendingCommit = "save" | "publish" | "delete";

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "flow";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const Toolbar = memo(function Toolbar({
  brand,
  onNotify,
  onExport,
  onSave,
  onPublish,
  extraActions,
  onDelete,
  className,
}: ToolbarProps) {
  const engine = useFlowEngine();
  const canUndo = useFlowState((s) => s.canUndo);
  const canRedo = useFlowState((s) => s.canRedo);
  const readOnly = useFlowState((s) => s.readOnly);
  const flowName = useFlowState((s) => s.flowName);
  const [nodeCount, edgeCount] = useFlowState(
    (s) => [s.nodes.length, s.edges.length] as const,
    shallowEqual,
  );
  const [pending, setPending] = useState<PendingCommit | null>(null);
  const [committing, setCommitting] = useState(false);
  const notify = (m: string, k: NoticeKind) => onNotify?.(m, k);

  const exportJson = () => {
    const json = stringifyFlow(engine.toJSON());
    if (onExport) onExport(json);
    else downloadTextFile(`${slug(flowName)}.json`, json);
    notify("Flow exported as JSON", "success");
  };

  const requestPublish = () => {
    setPending("publish");
  };

  const commit = async () => {
    const action = pending;
    if (!action || committing) return;
    if (action === "delete") {
      if (!onDelete) return;
      setCommitting(true);
      try {
        await onDelete();
        setPending(null);
      } catch (e) {
        notify(e instanceof Error && e.message ? e.message : "Could not delete the flow", "error");
      } finally {
        setCommitting(false);
      }
      return;
    }
    const handler = action === "publish" ? onPublish : onSave;
    if (!handler) return;
    setCommitting(true);
    try {
      await handler(engine.toJSON());
      if (action === "publish") {
        engine.setReadOnly(true);
      }
      notify(action === "publish" ? `"${flowName}" published` : `"${flowName}" saved`, "success");
      setPending(null);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : `Could not ${action} the flow`, "error");
    } finally {
      setCommitting(false);
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
        {onDelete && (
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-danger")}
            onClick={() => setPending("delete")}
            title="Delete this flow"
          >
            <Icon name="trash" /> Delete
          </button>
        )}
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
      </div>

      <div className="wpn-flowchart-toolbar__actions">
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          onClick={exportJson}
          title="Download the flow as JSON"
        >
          <Icon name="download" /> Export
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
          busy={committing}
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
          busy={committing}
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        >
          <p>
            Publishing replaces the live version of <strong>{flowName}</strong> with this one (
            {plural(nodeCount, "node")}, {plural(edgeCount, "connection")}). The flow becomes
            read-only once published.
          </p>
        </ConfirmDialog>
      )}
      {pending === "delete" && (
        <ConfirmDialog
          title="Delete flow?"
          icon="trash"
          confirmLabel="Delete"
          busy={committing}
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        >
          <p>
            Delete <strong>{flowName}</strong> ({plural(nodeCount, "node")},{" "}
            {plural(edgeCount, "connection")})? This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </header>
  );
});
