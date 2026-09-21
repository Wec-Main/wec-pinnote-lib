import { useMemo } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { formatTimestamp, getInitials } from "../../utils/format";
import { isDoneStatus, statusLabel } from "../../utils/status";
import { Icons } from "../../assets/icons";

export function AnnotationListPanel() {
  const { annotations, selectedId, selectAnnotation, setListOpen, loading, error, retry } =
    useAnnotationContext();

  const entries = useMemo(
    () =>
      annotations
        .flatMap((annotation) =>
          annotation.comments.map((comment) => ({
            annotation,
            comment,
            label: annotation.anchor.elementIdentifier.replace(/[-_]/g, " "),
          })),
        )
        .sort((left, right) => right.comment.createdAt.localeCompare(left.comment.createdAt)),
    [annotations],
  );

  return (
    <div className="wpn-panel wpn-list-panel">
      <div className="wpn-panel__header">
        <span className="wpn-panel__title">Comments</span>
        <button
          type="button"
          className="wpn-icon-btn"
          aria-label="Close list"
          onClick={() => setListOpen(false)}
        >
          ×
        </button>
      </div>
      {loading ? <p className="wpn-muted">Loading annotations...</p> : null}
      {error ? (
        <div className="wpn-inline-error">
          <span>{error}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      {entries.length === 0 && !loading ? <p className="wpn-muted">No comments on this page.</p> : null}
      <ul className="wpn-list">
        {entries.map(({ annotation, comment, label }) => (
          <li key={`${annotation.id}:${comment.id}`}>
            <button
              type="button"
              className={[
                "wpn-list__item",
                selectedId === annotation.id ? "wpn-list__item--active" : "",
                isDoneStatus(annotation.status) ? "wpn-list__item--resolved" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectAnnotation(annotation.id)}
            >
              {comment.createdBy.avatarUrl ? (
                <img className="wpn-avatar" src={comment.createdBy.avatarUrl} alt="" />
              ) : (
                <span className="wpn-avatar wpn-avatar--fallback">
                  {getInitials(comment.createdBy.name)}
                </span>
              )}
              <span className="wpn-list__copy">
                <span className="wpn-list__row">
                  <strong>{label}</strong>
                  <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
                    {statusLabel(annotation.status)}
                  </span>
                </span>
                <span className="wpn-list__meta">
                  {comment.createdBy.name}
                  <span className="wpn-list__dot" aria-hidden="true">
                    ·
                  </span>
                  <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
                </span>
                <span className="wpn-list__message">{comment.message}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="wpn-list-panel__brand">
        <span>Powered by</span>
        <img src={Icons.wecLogo} alt="" />
        <span className="wpn-list-panel__brand-name">Wec.ai</span>
      </div>
    </div>
  );
}
