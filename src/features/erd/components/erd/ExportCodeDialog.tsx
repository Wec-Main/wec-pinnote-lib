import { useMemo, useState } from "react";
import { useErdEngine } from "../../ErdContext";
import { downloadTextFile } from "../../../../utils/downloadTextFile";
import {
  CODE_FILE_SUFFIX,
  CODE_MIME_TYPE,
  CODE_TARGETS,
  CODE_TARGET_LABELS,
  generateCode,
  type CodeTarget,
} from "../../../../utils/erd/codegen/codeExport";
import type { ErdDocumentJSON } from "../../../../types/dataModel.types";
import { Icon } from "../../../../components/primitives/Icon";
import { ModalShell } from "../../../../components/primitives/ModalShell";
import { Tabs } from "../../../../components/primitives/Tabs";

const CODE_TABS = CODE_TARGETS.map((id) => ({ id, label: CODE_TARGET_LABELS[id] }));

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "data-model";

const render = (target: CodeTarget, document: ErdDocumentJSON) => {
  try {
    return { code: generateCode(target, document), error: null };
  } catch (error) {
    return { code: "", error: error instanceof Error ? error.message : "Could not generate code" };
  }
};

export function ExportCodeDialog({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify?: (message: string, kind: "success" | "error") => void;
}) {
  const engine = useErdEngine();
  const [document] = useState(() => engine.toJSON());
  const [target, setTarget] = useState<CodeTarget>("typescript");
  const { code, error } = useMemo(() => render(target, document), [target, document]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      onNotify?.("Code copied to clipboard", "success");
    } catch {
      onNotify?.("Could not copy to the clipboard", "error");
    }
  };

  const download = () => {
    downloadTextFile(
      `${slug(document.meta.name ?? "")}${CODE_FILE_SUFFIX[target]}`,
      code,
      CODE_MIME_TYPE[target],
    );
    onNotify?.("Code downloaded", "success");
  };

  return (
    <ModalShell
      title="Export Code"
      subtitle="Generated from the current data model"
      className="wpn-erd__export-dialog"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            <Icon name="close" className="wpn-btn__icon" />
            Close
          </button>
          <button type="button" className="wpn-btn" disabled={!code} onClick={() => void copy()}>
            <Icon name="copy" className="wpn-btn__icon" />
            Copy
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={!code}
            onClick={download}
          >
            <Icon name="download" className="wpn-btn__icon" />
            Download
          </button>
        </>
      }
    >
      <Tabs
        tabs={CODE_TABS}
        activeTabId={target}
        ariaLabel="Code target"
        onChange={(id) => setTarget(id as CodeTarget)}
      />
      {error ? (
        <p className="wpn-erd__export-error" role="alert">
          {error}
        </p>
      ) : (
        <textarea
          className="wpn-erd__export-preview"
          aria-label="Generated code"
          readOnly
          spellCheck={false}
          value={code}
        />
      )}
    </ModalShell>
  );
}
