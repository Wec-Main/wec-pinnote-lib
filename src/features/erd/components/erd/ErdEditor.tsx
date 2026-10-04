import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useErdEngine } from "../../ErdContext";
import type { ErdDocumentJSON, ErdEngineName } from "../../../../types/dataModel.types";
import { cx } from "../../../../utils/flowchart/shallow";
import "../../../../styles/datamodel-editor.css";
import { Icon } from "../../../flowchart/components/FlowIcons";
import { PanelResizeHandle } from "../../../flowchart/components/PanelResizeHandle";
import { downloadDataUrl } from "../../../../utils/downloadDataUrl";
import { downloadTextFile } from "../../../../utils/downloadTextFile";
import {
  generateDiagramPngDataUrl,
  generateDiagramSvg,
} from "../../../../utils/erd/export/exportDiagram";
import { ErdCanvas } from "./ErdCanvas";
import { ErdPalette } from "./ErdPalette";
import { ErdProvider } from "./ErdProvider";
import { ErdToolbar, type ErdCommitHandler, type NoticeKind } from "./ErdToolbar";
import { ErdValidationPanel } from "./ErdValidationPanel";
import { ExportCodeDialog } from "./ExportCodeDialog";
import { ExportSqlDialog } from "./ExportSqlDialog";
import { ErdPropertiesPanel } from "./properties/ErdPropertiesPanel";

export interface ErdEditorProps {
  initialDocument: ErdDocumentJSON;
  name: string;
  readOnly?: boolean;
  onChange?: (document: ErdDocumentJSON) => void;
  onSave?: ErdCommitHandler;
  onPublish?: ErdCommitHandler;
  description?: string;
  onMetaChange?: (patch: { name?: string; description?: string; engine?: ErdEngineName }) => void;
  saveIndicator?: ReactNode;
  toolbarActions?: ReactNode;
  overlay?: ReactNode;
  onAskAi?: () => void;
}

interface Notice {
  id: number;
  message: string;
  kind: NoticeKind;
}

const PALETTE_DEFAULT_WIDTH = 240;
const PROPERTIES_DEFAULT_WIDTH = 380;
const PALETTE_MIN_WIDTH = 180;
const PALETTE_MAX_WIDTH = 400;
const PROPERTIES_MIN_WIDTH = 280;
const PROPERTIES_MAX_WIDTH = 560;
const ERROR_NOTICE_MS = 6000;
const NOTICE_MS = 3000;
const MAX_NOTICES = 3;

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "data-model";

function EditorLayout({
  name,
  readOnly,
  onChange,
  onSave,
  onPublish,
  description,
  onMetaChange,
  saveIndicator,
  toolbarActions,
  overlay,
  onAskAi,
}: Omit<ErdEditorProps, "initialDocument">) {
  const engine = useErdEngine();
  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);
  const noticeTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCodeOpen, setExportCodeOpen] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(PALETTE_DEFAULT_WIDTH);
  const [propertiesWidth, setPropertiesWidth] = useState(PROPERTIES_DEFAULT_WIDTH);

  useEffect(() => {
    engine.setName(name);
  }, [engine, name]);

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

  useEffect(() => {
    const timers = noticeTimers.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const notify = useCallback((message: string, kind: NoticeKind) => {
    const id = ++noticeId.current;
    setNotices((current) => [...current.slice(-(MAX_NOTICES - 1)), { id, message, kind }]);
    const timer = setTimeout(
      () => {
        noticeTimers.current.delete(timer);
        setNotices((current) => current.filter((notice) => notice.id !== id));
      },
      kind === "error" ? ERROR_NOTICE_MS : NOTICE_MS,
    );
    noticeTimers.current.add(timer);
  }, []);

  const openExport = useCallback(() => setExportOpen(true), []);
  const openExportCode = useCallback(() => setExportCodeOpen(true), []);
  const validateButtonRef = useRef<HTMLButtonElement>(null);

  const exportDiagramSvg = useCallback(() => {
    const doc = engine.toJSON();
    const svg = generateDiagramSvg(doc);
    downloadTextFile(`${slug(doc.meta.name ?? "")}.svg`, svg, "image/svg+xml");
    notify("Diagram downloaded as SVG", "success");
  }, [engine, notify]);

  const exportDiagramPng = useCallback(() => {
    const doc = engine.toJSON();
    void (async () => {
      try {
        const svg = generateDiagramSvg(doc);
        const dataUrl = await generateDiagramPngDataUrl(svg);
        await downloadDataUrl(`${slug(doc.meta.name ?? "")}.png`, dataUrl);
        notify("Diagram downloaded as PNG", "success");
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Could not export the diagram as PNG",
          "error",
        );
      }
    })();
  }, [engine, notify]);

  return (
    <div className="wpn-flowchart-editor__editor wpn-erd">
      <ErdToolbar
        onNotify={notify}
        onExportSql={openExport}
        onExportCode={openExportCode}
        onExportDiagramSvg={exportDiagramSvg}
        onExportDiagramPng={exportDiagramPng}
        onSave={onSave}
        onPublish={onPublish}
        onNameCommit={(committed) => onMetaChange?.({ name: committed })}
        saveIndicator={saveIndicator}
        toolbarActions={toolbarActions}
        validateButtonRef={validateButtonRef}
      />
      <ErdValidationPanel anchorRef={validateButtonRef} />
      <div className="wpn-flowchart-editor__body">
        <ErdPalette style={{ width: paletteWidth }} />
        <PanelResizeHandle
          side="left"
          width={paletteWidth}
          minWidth={PALETTE_MIN_WIDTH}
          maxWidth={PALETTE_MAX_WIDTH}
          ariaLabel="Resize palette"
          onResize={setPaletteWidth}
        />
        <main className="wpn-flowchart-editor__main">
          <ErdCanvas onAskAi={onAskAi} />
          <div className="wpn-flowchart-editor__notices" aria-live="polite">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className={cx(
                  "wpn-flowchart-editor__notice",
                  `wpn-flowchart-editor__${notice.kind}`,
                )}
              >
                <Icon
                  name={
                    notice.kind === "error"
                      ? "alert"
                      : notice.kind === "success"
                        ? "success"
                        : "info"
                  }
                  size={15}
                />
                {notice.message}
              </div>
            ))}
          </div>
          {!propertiesOpen && (
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
          {overlay}
        </main>
        {propertiesOpen && (
          <>
            <PanelResizeHandle
              side="right"
              width={propertiesWidth}
              minWidth={PROPERTIES_MIN_WIDTH}
              maxWidth={PROPERTIES_MAX_WIDTH}
              ariaLabel="Resize properties panel"
              onResize={setPropertiesWidth}
            />
            <ErdPropertiesPanel
              style={{ width: propertiesWidth }}
              onClose={() => setPropertiesOpen(false)}
              description={description}
              onMetaChange={onMetaChange}
            />
          </>
        )}
      </div>
      {exportOpen && <ExportSqlDialog onClose={() => setExportOpen(false)} onNotify={notify} />}
      {exportCodeOpen && (
        <ExportCodeDialog onClose={() => setExportCodeOpen(false)} onNotify={notify} />
      )}
    </div>
  );
}

export function ErdEditor({ initialDocument, ...props }: ErdEditorProps) {
  const [seed] = useState(() => ({
    ...initialDocument,
    meta: { ...initialDocument.meta, name: props.name },
  }));
  return (
    <ErdProvider initialDocument={seed} readOnly={props.readOnly}>
      <EditorLayout {...props} />
    </ErdProvider>
  );
}
