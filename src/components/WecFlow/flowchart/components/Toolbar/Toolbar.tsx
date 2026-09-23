import { memo, useRef, useState, type ReactNode } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import type { FlowJSON } from '../../models/FlowTypes';
import { FlowParseError, parseFlow, stringifyFlow } from '../../utils/serialization';
import { cx, shallowEqual } from '../../utils/shallow';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { Icon } from '../icons';
import ui from '../ui/ui.module.css';
import styles from './Toolbar.module.css';

export type NoticeKind = 'info' | 'success' | 'error';

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

type PendingCommit = 'save' | 'publish';

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Top toolbar: name, mode and history on the left; validation, files, save and publish on the right. */
export const Toolbar = memo(function Toolbar({ brand, onNotify, onExport, onSave, onPublish, extraActions, className }: ToolbarProps) {
  const engine = useFlowEngine();
  const canUndo = useFlowState((s) => s.canUndo);
  const canRedo = useFlowState((s) => s.canRedo);
  const readOnly = useFlowState((s) => s.readOnly);
  const flowName = useFlowState((s) => s.flowName);
  const errorCount = useFlowState((s) => s.validation?.errorCount ?? null);
  const [nodeCount, edgeCount] = useFlowState((s) => [s.nodes.length, s.edges.length] as const, shallowEqual);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingCommit | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishErrors, setPublishErrors] = useState(0);
  const notify = (m: string, k: NoticeKind) => onNotify?.(m, k);

  const exportJson = () => {
    const json = stringifyFlow(engine.toJSON());
    if (onExport) onExport(json);
    else download(`${slug(flowName)}.json`, json);
    notify('Flow exported as JSON', 'success');
  };

  const importFile = async (file: File) => {
    try {
      const flow = parseFlow(await file.text());
      engine.loadFlow(flow);
      notify(`Imported "${flow.meta?.name ?? file.name}" — ${flow.nodes.length} nodes, ${flow.edges.length} connections`, 'success');
    } catch (e) {
      notify(e instanceof FlowParseError ? `Import failed: ${e.message}` : 'Import failed: could not read file', 'error');
    }
  };

  const validate = () => {
    const r = engine.validate();
    if (r.valid && r.warningCount === 0) notify('Flow is valid', 'success');
  };

  const requestPublish = () => {
    setPublishErrors(engine.validate().errorCount);
    setPending('publish');
  };

  const commit = async () => {
    const handler = pending === 'publish' ? onPublish : onSave;
    if (!pending || !handler) return;
    setBusy(true);
    try {
      await handler(engine.toJSON());
      notify(pending === 'publish' ? `"${flowName}" published` : `"${flowName}" saved`, 'success');
      setPending(null);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : `Could not ${pending} the flow`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className={cx(styles.toolbar, className)}>
      <div className={styles.start}>
        {brand ?? (
          <span className={styles.logo}>
            <Icon name="flow" size={18} />
          </span>
        )}
        <span className={styles.nameLabel}>Flow Name</span>
        <input className={styles.name} value={flowName} aria-label="Flow name" disabled={readOnly} onChange={(e) => engine.setFlowName(e.target.value)} />
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={cx(ui.btn, ui.btnGhost)} disabled={readOnly} onClick={() => engine.newFlow()} title="Start a new, empty flow (can be undone)">
          <Icon name="file" /> New Flow
        </button>
        <button type="button" className={cx(ui.btn, ui.btnGhost, ui.iconBtn)} disabled={readOnly || !canUndo} onClick={() => engine.undo()} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button type="button" className={cx(ui.btn, ui.btnGhost, ui.iconBtn)} disabled={readOnly || !canRedo} onClick={() => engine.redo()} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Icon name="redo" />
        </button>
        <button
          type="button"
          className={cx(ui.btn, readOnly && ui.btnActive)}
          aria-pressed={readOnly}
          onClick={() => engine.setReadOnly(!readOnly)}
          title={readOnly ? 'Switch to edit mode' : 'Switch to read-only mode'}
        >
          <Icon name={readOnly ? 'lock' : 'unlock'} /> {readOnly ? 'Read-only' : 'Editing'}
        </button>
        <span className={styles.divider} aria-hidden="true" />
      </div>

      <div className={styles.actions}>
        <button type="button" className={cx(ui.btn, ui.btnGhost)} onClick={validate} title="Check the flow for problems">
          <Icon name="check" /> Validate
          {errorCount !== null && errorCount > 0 && <span className={styles.badge}>{errorCount}</span>}
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={cx(ui.btn, ui.btnGhost)} disabled={readOnly} onClick={() => fileRef.current?.click()} title="Load a flow from a JSON file">
          <Icon name="upload" /> Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
        <button type="button" className={cx(ui.btn, ui.btnGhost)} onClick={exportJson} title="Download the flow as JSON">
          <Icon name="download" /> Export JSON
        </button>
        {extraActions}
        {(onSave || onPublish) && <span className={styles.divider} aria-hidden="true" />}
        {onSave && (
          <button type="button" className={cx(ui.btn, ui.btnGhost)} disabled={readOnly} onClick={() => setPending('save')} title="Save the current flow">
            <Icon name="save" /> Save
          </button>
        )}
        {onPublish && (
          <button type="button" className={cx(ui.btn, ui.btnPrimary)} disabled={readOnly} onClick={requestPublish} title="Publish this flow">
            <Icon name="publish" /> Publish
          </button>
        )}
      </div>

      {pending === 'save' && (
        <ConfirmDialog title="Save flow?" icon="save" confirmLabel="Save" busy={busy} onConfirm={() => void commit()} onCancel={() => setPending(null)}>
          <p>
            Save the current changes to <strong>{flowName}</strong> ({plural(nodeCount, 'node')}, {plural(edgeCount, 'connection')})?
          </p>
        </ConfirmDialog>
      )}
      {pending === 'publish' && (
        <ConfirmDialog
          title="Publish flow?"
          icon="publish"
          confirmLabel="Publish"
          busy={busy}
          warning={publishErrors > 0 ? `Validation found ${plural(publishErrors, 'error')}. You can still publish, or cancel and fix them first.` : undefined}
          onConfirm={() => void commit()}
          onCancel={() => setPending(null)}
        >
          <p>
            Publishing replaces the live version of <strong>{flowName}</strong> with this one ({plural(nodeCount, 'node')}, {plural(edgeCount, 'connection')}).
          </p>
        </ConfirmDialog>
      )}
    </header>
  );
});
