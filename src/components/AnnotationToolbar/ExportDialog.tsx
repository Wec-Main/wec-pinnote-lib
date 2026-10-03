import { useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { errorMessage } from "../../hooks/useAnnotations";
import { useEpicFlowApi } from "../../hooks/useEpicFlowApi";
import { useProjectVersionList } from "../../hooks/useProjectVersionList";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { fetchDataModelDocument, listDataModels } from "../../services/dataModelApi";
import { fetchFlowDocument, listFlows } from "../../services/flowApi";
import { downloadJson } from "../../utils/downloadJson";
import { buildExportFiles } from "../../utils/exportBundle";
import { projectVersionLabel } from "../../utils/projectVersionLabel";
import { Icon, SearchableSelect, Spinner } from "../primitives";
import type { IconName } from "../primitives/Icon";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";

interface ExportTarget {
  value: string;
  label: string;
  icon: IconName;
}

const EXPORT_TARGET_OPTIONS: ExportTarget[] = [
  { value: "comments", label: "Comments", icon: "comment" },
  { value: "flows", label: "Flows", icon: "flow" },
  { value: "draftBoard", label: "Draft Board", icon: "epic" },
  { value: "dataModel", label: "Data Model", icon: "dataModel" },
];

const EXPORT_FILE_PREFIX: Record<string, string> = {
  comments: "comments_",
  flows: "flow_",
  draftBoard: "draft_board",
  dataModel: "datamodel",
};

const DOWNLOAD_DELAY_MS = 400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ExportDialogProps {
  currentVersionId: string | undefined;
  onClose: () => void;
}

export function ExportDialog({ currentVersionId, onClose }: ExportDialogProps) {
  const { api, config } = useAnnotationContext();
  const epicFlowApi = useEpicFlowApi(config);
  const getToken = useTokenGetter(config.getAuthToken);
  const { versions, error: versionsError } = useProjectVersionList(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>(EXPORT_TARGET_OPTIONS.map((o) => o.value));
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const sorted = versions ? [...versions].sort((a, b) => b.versionNumber - a.versionNumber) : [];
  const selected = sorted.find((v) => v.id === picked) ?? sorted[0];

  const runExport = async () => {
    if (!selected || targets.length === 0) {
      return;
    }
    setBusy(true);
    setExportError(null);
    try {
      const authToken = await getToken();
      const [annotations, flowList, epics, userStories, modelList] = await Promise.all([
        api.listAnnotations({ projectId: config.projectId, projectVersionId: selected.id }),
        listFlows(config.apiBaseUrl, authToken, config.projectId, selected.id),
        epicFlowApi.getEpics(config.projectId),
        epicFlowApi.getUserStoriesByProject(config.projectId),
        listDataModels(config.apiBaseUrl, authToken, config.projectId),
      ]);
      const [flows, dataModels] = await Promise.all([
        Promise.all(flowList.map((f) => fetchFlowDocument(config.apiBaseUrl, authToken, f.id))),
        Promise.all(
          modelList.map((m) => fetchDataModelDocument(config.apiBaseUrl, authToken, m.id)),
        ),
      ]);
      const allFiles = buildExportFiles({
        version: selected,
        annotations,
        flows,
        epics,
        userStories,
        dataModels,
        addToContextOnly: true,
      });
      const files = allFiles.filter((file) =>
        targets.some((target) => file.filename.startsWith(EXPORT_FILE_PREFIX[target] ?? "")),
      );
      for (const [index, file] of files.entries()) {
        if (index > 0) {
          await sleep(DOWNLOAD_DELAY_MS);
        }
        downloadJson(file.filename, file.data);
      }
      onClose();
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const allSelected = targets.length === EXPORT_TARGET_OPTIONS.length;
  let body;
  if (versionsError) {
    body = <p className="wpn-toolbar__publish-error">Couldn't load versions.</p>;
  } else if (!versions) {
    body = (
      <p className="wpn-publish-summary__status">
        <Spinner />
        Loading versions…
      </p>
    );
  } else if (sorted.length === 0) {
    body = <p className="wpn-publish-summary__status">No versions to export yet.</p>;
  } else {
    body = (
      <>
        <div className="wpn-export-dialog__version">
          <span className="wpn-epicflow-modal__label">Version</span>
          <SearchableSelect
            options={sorted.map((version) => ({
              value: version.id,
              label: `${projectVersionLabel(version)}${
                version.id === currentVersionId ? " (current)" : ""
              } - ${version.status}`,
            }))}
            value={selected?.id ?? ""}
            onChange={setPicked}
            ariaLabel="Version"
            searchPlaceholder="Search versions"
          />
        </div>
        <fieldset className="wpn-export-dialog__targets" disabled={busy}>
          <div className="wpn-export-dialog__legend">
            <span className="wpn-epicflow-modal__label">Include</span>
            <button
              type="button"
              className="wpn-export-dialog__toggle-all"
              onClick={() =>
                setTargets(allSelected ? [] : EXPORT_TARGET_OPTIONS.map((option) => option.value))
              }
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          {EXPORT_TARGET_OPTIONS.map((option) => {
            const checked = targets.includes(option.value);
            return (
              <label
                key={option.value}
                className={[
                  "wpn-export-dialog__target",
                  checked ? "wpn-export-dialog__target--checked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    setTargets((current) =>
                      event.target.checked
                        ? [...current, option.value]
                        : current.filter((value) => value !== option.value),
                    )
                  }
                />
                <Icon name={option.icon} className="wpn-export-dialog__target-icon" />
                <span className="wpn-export-dialog__target-label">{option.label}</span>
              </label>
            );
          })}
        </fieldset>
        {exportError ? <p className="wpn-toolbar__publish-error">{exportError}</p> : null}
      </>
    );
  }

  return (
    <ConfirmDialog
      title="Export"
      className="wpn-confirm--export"
      description="Choose what to download for the selected version."
      detail={body}
      confirmLabel={
        exportError
          ? "Retry"
          : targets.length > 0
            ? `Export ${targets.length} ${targets.length === 1 ? "file" : "files"}`
            : "Export"
      }
      confirmIcon="download"
      busy={busy}
      confirmDisabled={!selected || targets.length === 0}
      onCancel={onClose}
      onConfirm={() => void runExport()}
    />
  );
}
