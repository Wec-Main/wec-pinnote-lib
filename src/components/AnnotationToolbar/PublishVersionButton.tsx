import { useState } from "react";
import { createPortal } from "react-dom";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { useProjectVersionList } from "../../hooks/useProjectVersionList";
import { errorMessage } from "../../hooks/useAnnotations";
import { createProjectVersionsApi } from "../../services/projectVersionsApi";
import type { ProjectVersion } from "../../types/projectVersion.types";
import { canPublishVersions } from "../../utils/permissions";
import { projectVersionLabel } from "../../utils/projectVersionLabel";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { PublishSummary } from "./PublishSummary";
import { Icon, Spinner, Tooltip } from "../primitives";

function publishTooltip(version: ProjectVersion | undefined, loadFailed: boolean): string {
  if (loadFailed) {
    return "Versions unavailable";
  }
  if (!version) {
    return "Loading version…";
  }
  if (version.status === "draft") {
    return `Publish ${projectVersionLabel(version)}`;
  }
  return `${projectVersionLabel(version)} is ${version.status}. Start a new draft to keep working.`;
}

const STATUS_LABELS: Record<ProjectVersion["status"], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function ViewedVersionBadge({ version }: { version: ProjectVersion | undefined }) {
  const status = version ? STATUS_LABELS[version.status] : "Previous version";
  const label = version
    ? `Viewing ${projectVersionLabel(version)} (${status.toLowerCase()}). Switch to the current version in Layers to publish.`
    : "Viewing a previous version. Switch to the current version in Layers to publish.";
  return (
    <Tooltip label={label} placement="bottom">
      <span
        className="wpn-toolbar__publish wpn-toolbar__publish--done wpn-toolbar__publish--badge"
        role="status"
        aria-label={label}
      >
        <Icon name="check" className="wpn-toolbar__publish-icon" />
        {status}
      </span>
    </Tooltip>
  );
}

export function PublishVersionButton() {
  const {
    config,
    activeAccount,
    project,
    commentsVersionId,
    flowsVersionId,
    reloadCurrentProjectVersion,
  } = useAnnotationContext();
  const allowed = Boolean(activeAccount?.roleId && canPublishVersions(activeAccount.roleId));
  const currentVersionId = project?.currentProjectVersionId;
  const viewedVersionId = [commentsVersionId, flowsVersionId].find(
    (versionId) => versionId !== undefined && versionId !== currentVersionId,
  );
  const { versions, error, reload } = useProjectVersionList(
    (allowed && currentVersionId !== undefined) || viewedVersionId !== undefined,
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  if (currentVersionId && viewedVersionId) {
    return (
      <ViewedVersionBadge version={versions?.find((version) => version.id === viewedVersionId)} />
    );
  }

  if (!allowed || !currentVersionId) {
    return null;
  }

  const currentVersion = versions?.find((version) => version.id === currentVersionId);
  const publishable = currentVersion?.status === "draft";
  const needsDraft = currentVersion !== undefined && !publishable;
  const label = publishTooltip(currentVersion, Boolean(error));

  const cancel = () => {
    setConfirming(false);
    setPublishError(null);
  };

  const confirmAction = async () => {
    setBusy(true);
    setPublishError(null);
    try {
      const versionsApi = createProjectVersionsApi(config);
      if (needsDraft) {
        await versionsApi.createProjectVersion(config.projectId, {});
      } else {
        await versionsApi.updateProjectVersion(config.projectId, currentVersionId, {
          status: "published",
        });
      }
      setConfirming(false);
      reload();
      reloadCurrentProjectVersion();
    } catch (err) {
      setPublishError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip label={label} placement="bottom">
        <button
          type="button"
          className="wpn-toolbar__publish"
          aria-label={label}
          disabled={!currentVersion || busy}
          onClick={() => setConfirming(true)}
        >
          {busy ? (
            <Spinner />
          ) : (
            <Icon name={needsDraft ? "plus" : "upload"} className="wpn-toolbar__publish-icon" />
          )}
          {needsDraft ? "New draft" : "Publish"}
        </button>
      </Tooltip>
      {confirming && currentVersion
        ? createPortal(
            <div className="wpn-root wpn-login-portal" style={{ zIndex: config.zIndex }}>
              {needsDraft ? (
                <ConfirmDialog
                  title="Start a new draft"
                  description={`${projectVersionLabel(currentVersion)} is already ${currentVersion.status}. A new draft version will be created and become current for everyone on this project. It starts with no comments or flows.`}
                  detail={
                    publishError ? (
                      <p className="wpn-toolbar__publish-error">{publishError}</p>
                    ) : null
                  }
                  confirmLabel="Create draft"
                  confirmIcon="plus"
                  busy={busy}
                  onCancel={cancel}
                  onConfirm={() => void confirmAction()}
                />
              ) : (
                <ConfirmDialog
                  title={`Publish ${projectVersionLabel(currentVersion)}`}
                  description={`${projectVersionLabel(currentVersion)} will be marked as published and a new draft version becomes current. Published comments and flows stay available from Layers. Publishing can't be undone.`}
                  detail={
                    <>
                      <PublishSummary projectVersionId={currentVersion.id} />
                      {publishError ? (
                        <p className="wpn-toolbar__publish-error">{publishError}</p>
                      ) : null}
                    </>
                  }
                  confirmLabel="Publish"
                  confirmIcon="upload"
                  busy={busy}
                  onCancel={cancel}
                  onConfirm={() => void confirmAction()}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
