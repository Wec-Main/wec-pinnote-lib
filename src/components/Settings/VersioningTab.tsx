import { useMemo } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import type { ProjectVersion } from "../../types/projectVersion.types";
import { Icon, RefreshButton, TableSkeleton, Tooltip } from "../primitives";
import { useProjectVersioning } from "./useProjectVersioning";

function versionLabel(version: ProjectVersion): string {
  return version.name && version.name.trim().length > 0
    ? version.name
    : `Version ${version.versionNumber}`;
}

export function VersioningTab() {
  const { config, activeAccount, reloadCurrentProjectVersion } = useAnnotationContext();
  const authToken = activeAccount?.token;

  const {
    project,
    versions,
    loading,
    loaded,
    error,
    busy,
    notice,
    dismissNotice,
    reload,
    addVersion,
    publishVersion,
    setActiveVersion,
  } = useProjectVersioning(
    config.apiBaseUrl,
    authToken,
    config.projectId,
    reloadCurrentProjectVersion,
  );

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === project?.currentProjectVersionId) ?? null,
    [versions, project?.currentProjectVersionId],
  );

  const canAddVersion = activeVersion?.status === "published";

  return (
    <div className="wpn-settings-tab">
      <div className="wpn-versioning-header">
        <div className="wpn-versioning-header__copy">
          <span className="wpn-versioning-header__label">Project</span>
          <span className="wpn-versioning-header__name">{project?.name ?? config.projectId}</span>
        </div>
        <div className="wpn-versioning-header__actions">
          <RefreshButton label="Refresh versions" loading={loading} onRefresh={reload} />
          <Tooltip
            label={
              canAddVersion
                ? "Branch a new version from the active version"
                : "Publish the active version before adding a new one"
            }
            placement="bottom"
          >
            <button
              type="button"
              className="wpn-users-create"
              disabled={!canAddVersion || busy}
              onClick={() => void addVersion()}
            >
              <Icon name="plus" className="wpn-users-create__icon" />
              Add version
            </button>
          </Tooltip>
        </div>
      </div>

      {notice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="wpn-icon-btn" onClick={dismissNotice}>
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      <div className="wpn-users-table-wrap">
        <table
          className={["wpn-users-table", loading && loaded ? "wpn-users-table--refetching" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Active</th>
              <th className="wpn-users-table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={3}
                columns={["identity", "pill", "pill", "actions"]}
                label="Loading versions"
              />
            ) : error && versions.length === 0 ? (
              <tr>
                <td colSpan={4} className="wpn-users-table__empty">
                  <Icon name="alert" className="wpn-users-table__empty-icon" />
                  <span>{error}</span>
                  <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : versions.length === 0 ? (
              <tr>
                <td colSpan={4} className="wpn-users-table__empty">
                  <Icon name="copy" className="wpn-users-table__empty-icon" />
                  <span>No versions yet.</span>
                </td>
              </tr>
            ) : (
              versions.map((version) => {
                const isActive = version.id === project?.currentProjectVersionId;
                return (
                  <tr key={version.id}>
                    <td>
                      <div className="wpn-users-identity">
                        <div className="wpn-users-identity__copy">
                          <span className="wpn-users-identity__name">{versionLabel(version)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`wpn-users-pill wpn-users-pill--status-${version.status}`}>
                        {version.status}
                      </span>
                    </td>
                    <td>
                      {isActive ? (
                        <span className="wpn-users-pill wpn-users-pill--status-active">Active</span>
                      ) : (
                        <button
                          type="button"
                          className="wpn-users-pill wpn-users-pill--status-inactive wpn-versioning-active-btn"
                          disabled={busy}
                          onClick={() => void setActiveVersion(version.id)}
                        >
                          Inactive
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="wpn-users-actions">
                        {version.status === "draft" ? (
                          <Tooltip label="Publish" placement="left">
                            <button
                              type="button"
                              className="wpn-users-action"
                              aria-label={`Publish ${versionLabel(version)}`}
                              disabled={busy}
                              onClick={() => void publishVersion(version.id)}
                            >
                              <Icon name="check" />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
