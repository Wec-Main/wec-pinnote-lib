import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { FlowEngine, FlowEngineOptions } from "../../utils/flowchart/flowEngine";
import { FlowContext, useFlowEngine } from "../../context/FlowContext";
import { useKeyboardShortcuts } from "../../hooks/flowchart/useKeyboardShortcuts";
import type { FlowJSON } from "../../types/flowchart.types";
import { cx } from "../../utils/flowchart/shallow";
import { FlowCanvas } from "./FlowCanvas";
import type { BackgroundVariant } from "./Background";
import { FlowProvider } from "./FlowProvider";
import { Icon } from "./FlowIcons";
import { PropertiesPanel } from "./PropertiesPanel";
import { Sidebar } from "./Sidebar";
import { Toolbar, type FlowCommitHandler, type NoticeKind } from "./Toolbar";
import { ValidationPanel } from "./ValidationPanel";

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
  /** Shows a Save button in the toolbar; called after the user confirms. */
  onSave?: FlowCommitHandler;
  /** Shows a Publish button in the toolbar; called after the user confirms. */
  onPublish?: FlowCommitHandler;
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
  onSave,
  onPublish,
  className,
  style,
}: FlowEditorProps) {
  const engine = useFlowEngine();
  const onKeyDown = useKeyboardShortcuts();
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);

  // Keep the engine's read-only flag in sync with the prop (when controlled).
  useEffect(() => {
    if (readOnly !== undefined) engine.setReadOnly(readOnly);
  }, [engine, readOnly]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    let frame = 0;
    const off = engine.on("change", () => {
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
    setTimeout(
      () => setNotices((n) => n.filter((x) => x.id !== id)),
      kind === "error" ? 6000 : 3000,
    );
  }, []);

  return (
    <div
      className={cx("wpn-flowchart-editor__editor", className)}
      style={style}
      onKeyDown={onKeyDown}
    >
      {showToolbar && (
        <Toolbar
          brand={brand}
          onNotify={notify}
          onSave={onSave}
          onPublish={onPublish}
          extraActions={toolbarActions}
        />
      )}
      <div className="wpn-flowchart-editor__body">
        {showSidebar && <Sidebar />}
        <main className="wpn-flowchart-editor__main">
          <FlowCanvas keyboardShortcuts={false} showMiniMap={showMiniMap} background={background}>
            <ValidationPanel />
          </FlowCanvas>
          <div className="wpn-flowchart-editor__notices" aria-live="polite">
            {notices.map((n) => (
              <div
                key={n.id}
                className={cx("wpn-flowchart-editor__notice", `wpn-flowchart-editor__${n.kind}`)}
              >
                <Icon
                  name={n.kind === "error" ? "alert" : n.kind === "success" ? "success" : "info"}
                  size={15}
                />
                {n.message}
              </div>
            ))}
          </div>
          {showProperties && !propertiesOpen && (
            <button
              type="button"
              className="wpn-flowchart-editor__reopen-properties"
              title="Show properties panel"
              aria-label="Show properties panel"
              onClick={() => setPropertiesOpen(true)}
            >
              <Icon name="chevron" size={14} />
            </button>
          )}
        </main>
        {showProperties && propertiesOpen && (
          <PropertiesPanel
            onClose={() => setPropertiesOpen(false)}
            expanded={propertiesExpanded}
            onToggleExpand={() => setPropertiesExpanded((v) => !v)}
          />
        )}
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
