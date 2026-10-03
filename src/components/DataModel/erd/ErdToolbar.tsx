import { memo, useState, type ReactNode } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import { cx } from "../../../utils/flowchart/shallow";
import { ConfirmDialog } from "../../UserManagement/ConfirmDialog";
import { Icon } from "../../WecFlow/FlowIcons";

export type NoticeKind = "info" | "success" | "error";

export type ErdCommitHandler = (document: ErdDocumentJSON) => void | Promise<void>;

export interface ErdToolbarProps {
  onNotify: (message: string, kind: NoticeKind) => void;
  onExportSql: () => void;
  onSave?: ErdCommitHandler;
  onPublish?: ErdCommitHandler;
  onNameCommit?: (name: string) => void;
  saveIndicator?: ReactNode;
  toolbarActions?: ReactNode;
}

const GHOST_ICON_BUTTON = cx(
  "wpn-flowchart-ui__btn",
  "wpn-flowchart-ui__btn-ghost",
  "wpn-flowchart-ui__icon-btn",
);

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const ErdToolbar = memo(function ErdToolbar({
  onNotify,
  onExportSql,
  onSave,
  onPublish,
  onNameCommit,
  saveIndicator,
  toolbarActions,
}: ErdToolbarProps) {
  const engine = useErdEngine();
  const canUndo = useErdState((s) => s.canUndo);
  const canRedo = useErdState((s) => s.canRedo);
  const readOnly = useErdState((s) => s.readOnly);
  const name = useErdState((s) => s.name);
  const validation = useErdState((s) => s.validation);
  const validating = validation !== null;
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!onSave || busy) return;
    setBusy(true);
    try {
      await onSave(engine.toJSON());
      onNotify(`"${name}" saved`, "success");
    } catch (error) {
      onNotify(errorMessage(error, "Could not save the data model"), "error");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!onPublish || busy) return;
    setBusy(true);
    try {
      await onPublish(engine.toJSON());
      engine.setReadOnly(true);
      onNotify(`"${name}" published`, "success");
      setConfirmingPublish(false);
    } catch (error) {
      onNotify(errorMessage(error, "Could not publish the data model"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="wpn-flowchart-toolbar__toolbar wpn-erd__toolbar">
      <div className="wpn-flowchart-toolbar__start">
        <span className="wpn-erd__toolbar-label">Data Model Name</span>
        <input
          className="wpn-flowchart-toolbar__name"
          value={name}
          aria-label="Data model name"
          disabled={readOnly}
          onChange={(e) => engine.setName(e.target.value)}
          onBlur={(e) => onNameCommit?.(e.target.value)}
        />
        <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        <button
          type="button"
          className={GHOST_ICON_BUTTON}
          disabled={readOnly || !canUndo}
          onClick={() => engine.undo()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className={GHOST_ICON_BUTTON}
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
          className={cx("wpn-flowchart-ui__btn", validating && "wpn-flowchart-ui__btn-active")}
          aria-pressed={validating}
          onClick={() => (validating ? engine.clearValidation() : engine.validate())}
          title="Check the data model against all rules"
        >
          <Icon name="check" /> Validate
          {validation ? (
            <span
              className={cx(
                "wpn-erd-validate-badge",
                validation.errorCount > 0
                  ? "wpn-erd-validate-badge--error"
                  : validation.warningCount > 0
                    ? "wpn-erd-validate-badge--warning"
                    : "wpn-erd-validate-badge--ok",
              )}
              aria-label={`${validation.errorCount} errors, ${validation.warningCount} warnings`}
            >
              {validation.errorCount > 0
                ? validation.errorCount
                : validation.warningCount > 0
                  ? validation.warningCount
                  : "✓"}
            </span>
          ) : null}
        </button>
      </div>
      <div className="wpn-flowchart-toolbar__actions">
        {toolbarActions}
        {saveIndicator}
        <button
          type="button"
          className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
          onClick={onExportSql}
          title="Generate SQL for this data model"
        >
          <Icon name="download" /> Export SQL
        </button>
        {(onSave || onPublish) && (
          <span className="wpn-flowchart-toolbar__divider" aria-hidden="true" />
        )}
        {onSave && (
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
            disabled={readOnly || busy}
            onClick={() => void save()}
            title="Save the current data model"
          >
            <Icon name="save" /> Save
          </button>
        )}
        {onPublish && (
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-primary")}
            disabled={readOnly}
            onClick={() => setConfirmingPublish(true)}
            title="Publish this data model"
          >
            <Icon name="publish" /> Publish
          </button>
        )}
      </div>
      {confirmingPublish && (
        <ConfirmDialog
          title="Publish data model?"
          description={`Publishing creates a new version of "${name}" from the current state. The data model becomes read-only once published.`}
          confirmLabel="Publish"
          confirmIcon="upload"
          busy={busy}
          onConfirm={() => void publish()}
          onCancel={() => setConfirmingPublish(false)}
        />
      )}
    </header>
  );
});
