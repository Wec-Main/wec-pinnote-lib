import { useMemo, useState } from "react";
import { useErdEngine } from "../../ErdContext";
import { downloadTextFile } from "../../../../utils/downloadTextFile";
import {
  DDL_DIALECTS,
  DDL_DIALECT_LABELS,
  ddlWarnings,
  generateDdl,
  type DdlDialect,
} from "../../../../utils/erd/ddl/generateDdl";
import { Icon } from "../../../../components/primitives/Icon";
import { ModalShell } from "../../../../components/primitives/ModalShell";
import { Tabs } from "../../../../components/primitives/Tabs";

const TABS = DDL_DIALECTS.map((id) => ({ id, label: DDL_DIALECT_LABELS[id] }));

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
  const warnings = useMemo(() => {
    try {
      return ddlWarnings(document);
    } catch {
      return [];
    }
  }, [document]);

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
            <Icon name="close" className="wpn-btn__icon" />
            Close
          </button>
          <button type="button" className="wpn-btn" disabled={!sql} onClick={() => void copy()}>
            <Icon name="copy" className="wpn-btn__icon" />
            Copy
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={!sql}
            onClick={download}
          >
            <Icon name="download" className="wpn-btn__icon" />
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
      {!error && warnings.length > 0 ? (
        <div className="wpn-erd__export-warning" role="status">
          <Icon name="alert" className="wpn-erd__export-warning-icon" />
          <div>
            <strong>
              {warnings.length === 1
                ? "1 relationship isn't in the SQL"
                : `${warnings.length} relationships aren't in the SQL`}
            </strong>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
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
