import { memo, useRef, type ReactNode } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { FlowParseError, parseFlow, stringifyFlow } from '../../utils/serialization';
import { cx } from '../../utils/shallow';
import { Icon } from '../icons';
import ui from '../ui/ui.module.css';
import styles from './Toolbar.module.css';

export type NoticeKind = 'info' | 'success' | 'error';

export interface ToolbarProps {
  /** Brand / title area on the left. */
  brand?: ReactNode;
  /** Called with user-facing feedback (import results, errors…). */
  onNotify?: (message: string, kind: NoticeKind) => void;
  /** Override the default "download a .json file" export behaviour. */
  onExport?: (json: string) => void;
  /** Extra buttons rendered before the read-only toggle. */
  extraActions?: ReactNode;
  className?: string;
}

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

/** Top toolbar: file actions, history, view, validation and read-only toggle. */
export const Toolbar = memo(function Toolbar({ brand, onNotify, onExport, extraActions, className }: ToolbarProps) {
  const engine = useFlowEngine();
  const canUndo = useFlowState((s) => s.canUndo);
  const canRedo = useFlowState((s) => s.canRedo);
  const readOnly = useFlowState((s) => s.readOnly);
  const flowName = useFlowState((s) => s.flowName);
  const errorCount = useFlowState((s) => s.validation?.errorCount ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  return (
    <header className={cx(styles.toolbar, className)}>
      <div className={styles.brand}>
        {brand ?? (
          <span className={styles.logo}>
            <Icon name="flow" size={18} />
          </span>
        )}
        <input
          className={styles.name}
          value={flowName}
          aria-label="Flow name"
          disabled={readOnly}
          onChange={(e) => engine.setFlowName(e.target.value)}
          size={Math.max(10, flowName.length + 1)}
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.group}>
          <button type="button" className={cx(ui.btn, ui.btnGhost)} disabled={readOnly} onClick={() => engine.newFlow()} title="Start a new, empty flow (can be undone)">
            <Icon name="file" /> New Flow
          </button>
        </div>
        <div className={styles.group}>
          <button type="button" className={cx(ui.btn, ui.btnGhost, ui.iconBtn)} disabled={readOnly || !canUndo} onClick={() => engine.undo()} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button type="button" className={cx(ui.btn, ui.btnGhost, ui.iconBtn)} disabled={readOnly || !canRedo} onClick={() => engine.redo()} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Icon name="redo" />
          </button>
        </div>
        <div className={styles.group}>
          <button type="button" className={cx(ui.btn, ui.btnGhost)} onClick={() => engine.fitView()} title="Fit all nodes into view">
            <Icon name="fit" /> Fit View
          </button>
          <button type="button" className={cx(ui.btn, ui.btnGhost)} onClick={validate} title="Check the flow for problems">
            <Icon name="check" /> Validate
            {errorCount !== null && errorCount > 0 && <span className={styles.badge}>{errorCount}</span>}
          </button>
        </div>
        <div className={styles.group}>
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
          <button type="button" className={cx(ui.btn, ui.btnPrimary)} onClick={exportJson} title="Download the flow as JSON">
            <Icon name="download" /> Export JSON
          </button>
        </div>
        {extraActions}
        <button
          type="button"
          className={cx(ui.btn, readOnly && ui.btnActive)}
          aria-pressed={readOnly}
          onClick={() => engine.setReadOnly(!readOnly)}
          title={readOnly ? 'Switch to edit mode' : 'Switch to read-only mode'}
        >
          <Icon name={readOnly ? 'lock' : 'unlock'} /> {readOnly ? 'Read-only' : 'Editing'}
        </button>
      </div>
    </header>
  );
});
