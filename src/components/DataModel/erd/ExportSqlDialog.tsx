import { useMemo, useState } from "react";
import { useErdEngine } from "../../../context/ErdContext";
import { downloadTextFile } from "../../../utils/downloadTextFile";
import { DDL_DIALECTS, generateDdl, type DdlDialect } from "../../../utils/erd/ddl/generateDdl";
import { ModalShell, Tabs } from "../../primitives";

const DIALECT_LABELS: Record<DdlDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
};

const TABS = DDL_DIALECTS.map((id) => ({ id, label: DIALECT_LABELS[id] }));

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "data-model";

const render = (
  dialect: DdlDialect,
  document: ReturnType<ReturnType<typeof useErdEngine>["toJSON"]>,
) => {
  try {
    return { sql: generateDdl(document, dialect), error: null };
  } catch (error) {
    return { sql: "", error: error instanceof Error ? error.message : "Could not generate SQL" };
  }
};

export function ExportSqlDialog({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify?: (message: string, kind: "success" | "error") => void;
}) {
  const engine = useErdEngine();
  const [document] = useState(() => engine.toJSON());
  const [dialect, setDialect] = useState<DdlDialect>(
    document.engine === "mysql" ? "mysql" : "postgres",
  );
  const { sql, error } = useMemo(() => render(dialect, document), [dialect, document]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      onNotify?.("SQL copied to clipboard", "success");
    } catch {
      onNotify?.("Could not copy to the clipboard", "error");
    }
  };

  const download = () => {
    downloadTextFile(`${slug(document.meta.name ?? "")}.${dialect}.sql`, sql, "application/sql");
    onNotify?.("SQL downloaded", "success");
  };

  return (
    <ModalShell
      title="Export SQL"
      subtitle="Generated from the current data model"
      className="wpn-erd__export-dialog"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="wpn-btn" disabled={!sql} onClick={() => void copy()}>
            Copy
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={!sql}
            onClick={download}
          >
            Download
          </button>
        </>
      }
    >
      <Tabs
        tabs={TABS}
        activeTabId={dialect}
        ariaLabel="SQL dialect"
        onChange={(id) => setDialect(id as DdlDialect)}
      />
      {error ? (
        <p className="wpn-erd__export-error" role="alert">
          {error}
        </p>
      ) : (
        <textarea
          className="wpn-erd__export-preview"
          aria-label="Generated SQL"
          readOnly
          spellCheck={false}
          value={sql}
        />
      )}
    </ModalShell>
  );
}
