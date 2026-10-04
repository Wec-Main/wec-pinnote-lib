import { Icon } from "../../features/flowchart/components/FlowIcons";
import type { VersionRecordBase } from "../../hooks/useVersionHistory";
import { formatRelativeTime, formatTimestamp } from "../../utils/format";

interface VersionsButtonProps {
  open: boolean;
  hasVersions: boolean;
  onToggle: () => void;
}

export function VersionsButton({ open, hasVersions, onToggle }: VersionsButtonProps) {
  return (
    <button
      type="button"
      className={[
        "wpn-flowchart-ui__btn",
        open ? "wpn-flowchart-ui__btn-active" : "wpn-flowchart-ui__btn-ghost",
      ].join(" ")}
      disabled={!hasVersions}
      aria-pressed={open}
      title={hasVersions ? "View published version history" : "No published versions yet"}
      onClick={onToggle}
    >
      <Icon name="clock" /> Versions
    </button>
  );
}

interface VersionPreviewBannerProps {
  version: VersionRecordBase;
  onExit: () => void;
}

export function VersionPreviewBanner({ version, onExit }: VersionPreviewBannerProps) {
  return (
    <div className="wpn-flow-stage__preview-banner" role="status">
      <span className="wpn-flow-stage__preview-info">
        <Icon name="clock" size={14} />
        Viewing Version {version.version}
        {version.publishedByUser ? ` · Published by ${version.publishedByUser}` : ""}
        {" · "}
        {formatTimestamp(version.publishedAt)}
      </span>
      <button type="button" className="wpn-flow-stage__preview-exit" onClick={onExit}>
        <Icon name="x" size={14} /> Back to draft
      </button>
    </div>
  );
}

interface VersionPreviewErrorProps {
  message: string;
  onDismiss: () => void;
}

export function VersionPreviewError({ message, onDismiss }: VersionPreviewErrorProps) {
  return (
    <div className="wpn-flow-panel__notice" role="alert">
      <span>{message}</span>
      <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

interface VersionsPanelProps<TRecord extends VersionRecordBase> {
  versions: TRecord[];
  loading: boolean;
  error?: string | null;
  previewVersionId: string | null;
  previewLoading: boolean;
  onPreview: (version: TRecord) => void;
  onExitPreview: () => void;
  onClose: () => void;
}

export function VersionsPanel<TRecord extends VersionRecordBase>({
  versions,
  loading,
  error,
  previewVersionId,
  previewLoading,
  onPreview,
  onExitPreview,
  onClose,
}: VersionsPanelProps<TRecord>) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const isDraft = previewVersionId === null;

  return (
    <div className="wpn-flow-versions-panel">
      <div className="wpn-flow-versions-panel__header">
        <span className="wpn-flow-versions-panel__title">
          <Icon name="clock" size={14} />
          Version History
        </span>
        <button
          type="button"
          className="wpn-icon-btn"
          aria-label="Close version history"
          onClick={onClose}
        >
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className="wpn-flow-versions-panel__list">
        <div className="wpn-flow-versions-panel__section-label">Working copy</div>

        <button
          type="button"
          className={[
            "wpn-flow-version-item",
            isDraft ? "wpn-flow-version-item--draft-active" : "wpn-flow-version-item--draft",
          ].join(" ")}
          onClick={onExitPreview}
          disabled={previewLoading}
          title="Return to the live draft"
        >
          <span className="wpn-flow-version-item__avatar wpn-flow-version-item__avatar--draft">
            <Icon name="file" size={14} />
          </span>
          <span className="wpn-flow-version-item__info">
            <span className="wpn-flow-version-item__name">Current draft</span>
            <span className="wpn-flow-version-item__sub">Editable · auto-saved</span>
          </span>
          {isDraft && <span className="wpn-flow-version-item__indicator" aria-hidden="true" />}
        </button>

        {(error || loading || sorted.length > 0) && (
          <div className="wpn-flow-versions-panel__section-label wpn-flow-versions-panel__section-label--gap">
            Published
            {sorted.length > 0 && (
              <span className="wpn-flow-versions-panel__count">{sorted.length}</span>
            )}
          </div>
        )}

        {error ? (
          <div className="wpn-flow-versions-panel__error">
            <Icon name="alert" size={13} />
            <span>{error}</span>
          </div>
        ) : loading && sorted.length === 0 ? (
          <div className="wpn-flow-versions-panel__skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="wpn-flow-version-skeleton" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="wpn-flow-versions-panel__empty">
            <Icon name="clock" size={22} />
            <p>No published versions yet</p>
            <p className="wpn-flow-versions-panel__empty-hint">
              Click <strong>Publish</strong> to save a snapshot you can return to anytime.
            </p>
          </div>
        ) : (
          sorted.map((v, index) => {
            const isActive = v.id === previewVersionId;
            const isLatest = index === 0;
            const loadingThis = isActive && previewLoading;
            return (
              <button
                key={v.id}
                type="button"
                className={[
                  "wpn-flow-version-item",
                  isActive ? "wpn-flow-version-item--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onPreview(v)}
                disabled={previewLoading}
                title={`Version ${v.version} — ${formatTimestamp(v.publishedAt)}`}
              >
                <span
                  className={[
                    "wpn-flow-version-item__avatar",
                    isActive ? "wpn-flow-version-item__avatar--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  v{v.version}
                </span>
                <span className="wpn-flow-version-item__info">
                  <span className="wpn-flow-version-item__name">
                    Version {v.version}
                    {isLatest && <span className="wpn-flow-version-item__chip">Latest</span>}
                  </span>
                  <span className="wpn-flow-version-item__sub">
                    {loadingThis ? (
                      "Loading…"
                    ) : (
                      <>
                        {v.publishedByUser ? `${v.publishedByUser} · ` : ""}
                        {formatRelativeTime(v.publishedAt)}
                      </>
                    )}
                  </span>
                </span>
                {isActive && !loadingThis && (
                  <span className="wpn-flow-version-item__indicator" aria-hidden="true" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
