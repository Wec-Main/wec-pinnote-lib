import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { FlowEngine, FlowEngineOptions } from '../../core/FlowEngine';
import { FlowContext, useFlowEngine } from '../../hooks/FlowContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { FlowJSON } from '../../models/FlowTypes';
import { cx } from '../../utils/shallow';
import { FlowCanvas } from '../FlowCanvas/FlowCanvas';
import type { BackgroundVariant } from '../FlowCanvas/Background';
import { FlowProvider } from '../FlowProvider';
import { Icon } from '../icons';
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel';
import { Sidebar } from '../Sidebar/Sidebar';
import { Toolbar, type NoticeKind } from '../Toolbar/Toolbar';
import { ValidationPanel } from '../ValidationPanel/ValidationPanel';
import styles from './FlowEditor.module.css';

export interface FlowEditorProps extends FlowEngineOptions {
  /** Use an existing engine. Otherwise one is created from the options (or taken from a surrounding FlowProvider). */
  engine?: FlowEngine;
  /** Called (debounced to one call per frame) whenever nodes or edges change. */
  onChange?: (flow: FlowJSON) => void;
  showToolbar?: boolean;
  showSidebar?: boolean;
  showProperties?: boolean;
  showMiniMap?: boolean;
  background?: BackgroundVariant;
  /** Custom brand element for the toolbar. */
  brand?: ReactNode;
  toolbarActions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface Notice {
  id: number;
  message: string;
  kind: NoticeKind;
}

function EditorLayout({
  onChange,
  readOnly,
  showToolbar = true,
  showSidebar = true,
  showProperties = true,
  showMiniMap = true,
  background,
  brand,
  toolbarActions,
  className,
  style,
}: FlowEditorProps) {
  const engine = useFlowEngine();
  const onKeyDown = useKeyboardShortcuts();
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);

  // Keep the engine's read-only flag in sync with the prop (when controlled).
  useEffect(() => {
    if (readOnly !== undefined) engine.setReadOnly(readOnly);
  }, [engine, readOnly]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    let frame = 0;
    const off = engine.on('change', () => {
      if (!onChangeRef.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onChangeRef.current?.(engine.toJSON());
      });
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [engine]);

  const notify = useCallback((message: string, kind: NoticeKind) => {
    const id = ++noticeId.current;
    setNotices((n) => [...n.slice(-2), { id, message, kind }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  return (
    <div className={cx(styles.editor, className)} style={style} onKeyDown={onKeyDown}>
      {showToolbar && <Toolbar brand={brand} onNotify={notify} extraActions={toolbarActions} />}
      <div className={styles.body}>
        {showSidebar && <Sidebar />}
        <main className={styles.main}>
          <FlowCanvas keyboardShortcuts={false} showMiniMap={showMiniMap} background={background}>
            <ValidationPanel />
          </FlowCanvas>
          <div className={styles.notices} aria-live="polite">
            {notices.map((n) => (
              <div key={n.id} className={cx(styles.notice, styles[n.kind])}>
                <Icon name={n.kind === 'error' ? 'alert' : n.kind === 'success' ? 'success' : 'info'} size={15} />
                {n.message}
              </div>
            ))}
          </div>
        </main>
        {showProperties && <PropertiesPanel />}
      </div>
    </div>
  );
}

/**
 * Complete flowchart editor: toolbar, node palette, canvas, minimap,
 * validation and properties panel. Drop it in a sized container.
 *
 * ```tsx
 * <div style={{ height: 600 }}>
 *   <FlowEditor initialFlow={flow} onChange={save} />
 * </div>
 * ```
 */
export function FlowEditor(props: FlowEditorProps) {
  const outer = useContext(FlowContext);
  if (outer && !props.engine) return <EditorLayout {...props} />;
  const { engine, onChange: _onChange, ...options } = props;
  return (
    <FlowProvider engine={engine} {...options}>
      <EditorLayout {...props} />
    </FlowProvider>
  );
}
