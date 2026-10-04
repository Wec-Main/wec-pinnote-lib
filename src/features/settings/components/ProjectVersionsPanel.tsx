import { DataTable, resolveDataTableState } from "../../../components/primitives/DataTable";
import { Icon, type IconName } from "../../../components/primitives/Icon";
import { RefreshButton } from "../../../components/primitives/RefreshButton";
import { Switch } from "../../../components/primitives/Switch";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { useProjectVersioning } from "./useProjectVersioning";
import { projectVersionLabel } from "../../../utils/projectVersionLabel";
import { formatRelativeTime, formatTimestamp } from "../../../utils/format";
import type { ProjectVersionSettingsPatch } from "../../../services/settingsService";
import type { ProjectVersion } from "../../../types/projectVersion.types";

export interface ProjectVersionsPanelProps {
  apiBaseUrl: string;
  authToken: string | undefined;
  projectId: string;
  projectName?: string;
  onVersionChanged?: () => void;
  showVersionSettings?: boolean;
}

interface VersionTrackingOption {
  key: Extract<
    keyof ProjectVersionSettingsPatch,
    "annotationVersioningEnabled" | "flowVersioningEnabled"
  >;
  label: string;
  caption: string;
  icon: IconName;
}

const VERSION_TRACKING_OPTIONS: VersionTrackingOption[] = [
  {
    key: "annotationVersioningEnabled",
    label: "Annotations",
    caption: "Comments stay with the version they were made on.",
    icon: "comment",
  },
  {
    key: "flowVersioningEnabled",
    label: "Flows",
    caption: "Flows stay with the version they were built on.",
    icon: "flow",
  },
];

function versionTimeline(version: ProjectVersion): { label: string; at: string } {
  return version.status === "published" && version.publishedAt
    ? { label: "Published", at: version.publishedAt }
    : { label: "Created", at: version.createdAt };
}

export function ProjectVersionsPanel({
  apiBaseUrl,
  authToken,
  projectId,
  projectName,
  onVersionChanged,
  showVersionSettings = false,
}: ProjectVersionsPanelProps) {
  const {
    project,
    versions,
    loading,
    loaded,
    error,
    busy,
    progress,
    notice,
    dismissNotice,
    reload,
    addVersion,
    publishVersion,
    setActiveVersion,
    updateVersionSettings,
  } = useProjectVersioning(apiBaseUrl, authToken, projectId, onVersionChanged);

  const activeVersion = versions.find((version) => version.id === project?.currentProjectVersionId);
  const canAddVersion = activeVersion !== undefined && activeVersion.status !== "draft";

  const trackingOff =
    project !== null && VERSION_TRACKING_OPTIONS.every((option) => project[option.key] === false);
  const publishBlockedReason = trackingOff
    ? "Turn on version tracking for annotations or flows to publish"
    : null;

  return (
    <div className="wpn-settings-tab wpn-versioning">
      <div className="wpn-versioning-header">
        {projectName !== undefined ? (
          <div className="wpn-versioning-header__copy">
            <span className="wpn-versioning-header__label">Project</span>
            <span className="wpn-versioning-header__name">{project?.name ?? projectName}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="wpn-versioning-header__actions">
          <RefreshButton label="Refresh versions" loading={loading} onRefresh={reload} />
          <Tooltip
            label={
              canAddVersion
                ? "Create a new draft version and make it active"
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

      {showVersionSettings && project ? (
        <section
          className="wpn-versioning-settings"
          aria-labelledby="wpn-versioning-settings-title"
        >
          <div className="wpn-versioning-settings__head">
            <span id="wpn-versioning-settings-title" className="wpn-versioning-settings__title">
              Version tracking
            </span>
            <span className="wpn-versioning-settings__subtitle">
              Choose what each published version keeps separate.
            </span>
          </div>
          <div className="wpn-versioning-settings__grid">
            {VERSION_TRACKING_OPTIONS.map((option) => {
              const checked = project[option.key] ?? true;
              return (
                <div
                  key={option.key}
                  className={["wpn-versioning-option", checked ? "wpn-versioning-option--on" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="wpn-versioning-option__icon" aria-hidden="true">
                    <Icon name={option.icon} />
                  </span>
                  <span className="wpn-versioning-option__copy">
                    <span className="wpn-versioning-option__label">{option.label}</span>
                    <span className="wpn-versioning-option__caption">{option.caption}</span>
                  </span>
                  <Switch
                    label={`${option.label} version tracking`}
                    checked={checked}
                    disabled={busy}
                    onChange={(next) => void updateVersionSettings({ [option.key]: next })}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {trackingOff ? (
        <div className="wpn-versioning-warning" role="alert">
          <Icon name="alert" className="wpn-versioning-warning__icon" />
          <span className="wpn-versioning-warning__copy">
            <strong>Publishing is paused</strong>
            <span>
              {showVersionSettings
                ? "Version tracking is off for both annotations and flows, so a published version would hold nothing. Turn one on to publish."
                : "Version tracking is off for both annotations and flows. Ask a super admin to turn one on before publishing."}
            </span>
          </span>
        </div>
      ) : null}

      {progress ? (
        <div className="wpn-versioning-progress" role="status" aria-live="polite">
          <span className="wpn-versioning-progress__label">{progress}</span>
          <span
            className="wpn-versioning-progress__track"
            role="progressbar"
            aria-label={progress}
            aria-busy="true"
          >
            <span className="wpn-versioning-progress__bar" />
          </span>
        </div>
      ) : notice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="wpn-icon-btn" onClick={dismissNotice}>
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      <DataTable<ProjectVersion>
        state={resolveDataTableState({
          loading,
          loaded,
          error,
          isEmpty: versions.length === 0,
        })}
        items={versions}
        getRowKey={(version) => version.id}
        cardWrap={false}
        refetching={loading && loaded}
        skeleton={{
          rows: 3,
          columns: ["identity", "pill", "pill", "actions"],
          label: "Loading versions",
        }}
        head={
          <>
            <th>Version</th>
            <th>Status</th>
            <th>Active</th>
            <th className="wpn-users-table__actions-head">Actions</th>
          </>
        }
        errorRow={
          <tr>
            <td colSpan={4} className="wpn-users-table__empty">
              <Icon name="alert" className="wpn-users-table__empty-icon" />
              <span>{error}</span>
              <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                Retry
              </button>
            </td>
          </tr>
        }
        emptyRow={
          <tr>
            <td colSpan={4} className="wpn-users-table__empty">
              <Icon name="copy" className="wpn-users-table__empty-icon" />
              <span>No versions yet.</span>
            </td>
          </tr>
        }
        renderRow={(version) => {
          const isActive = version.id === project?.currentProjectVersionId;
          const timeline = versionTimeline(version);
          const label = projectVersionLabel(version);
          return (
            <tr className={isActive ? "wpn-versioning-row--active" : undefined}>
              <td>
                <div className="wpn-users-identity">
                  <div className="wpn-users-identity__copy">
                    <span className="wpn-users-identity__name">{label}</span>
                    <span
                      className="wpn-users-identity__email"
                      title={formatTimestamp(timeline.at)}
                    >
                      {timeline.label} {formatRelativeTime(timeline.at)}
                    </span>
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
                  <Tooltip label="Make this the active version" placement="top">
                    <button
                      type="button"
                      className="wpn-users-pill wpn-users-pill--status-inactive wpn-versioning-active-btn"
                      disabled={busy}
                      onClick={() => void setActiveVersion(version.id)}
                    >
                      Set active
                    </button>
                  </Tooltip>
                )}
              </td>
              <td>
                <div className="wpn-users-actions">
                  {version.status === "draft" ? (
                    <Tooltip label={publishBlockedReason ?? `Publish ${label}`} placement="left">
                      <button
                        type="button"
                        className="wpn-versioning-publish"
                        aria-label={`Publish ${label}`}
                        disabled={busy || trackingOff}
                        onClick={() => void publishVersion(version.id)}
                      >
                        <Icon name="upload" className="wpn-versioning-publish__icon" />
                        Publish
                      </button>
                    </Tooltip>
                  ) : (
                    <span className="wpn-versioning-published">
                      <Icon name="check" className="wpn-versioning-published__icon" />
                      Published
                    </span>
                  )}
                </div>
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
}
