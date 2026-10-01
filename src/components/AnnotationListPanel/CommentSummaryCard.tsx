import { formatRelativeTime, getInitials } from "../../utils/format";
import { mentionsToPlainText } from "../../utils/mentions";
import { statusLabel } from "../../utils/status";
import { Icon, Tooltip } from "../primitives";
import type { CommentThread } from "./commentFilters";

interface CommentSummaryCardProps {
  thread: CommentThread;
  active: boolean;
  onSelect: (annotationId: string) => void;
  // Reveals the thread's pin — on the current page if it's there, centered
  // with a "Not in this view" chip otherwise (same as Minimize mode).
  onRevealOnPage: (annotationId: string) => void;
}

export function CommentSummaryCard({
  thread,
  active,
  onSelect,
  onRevealOnPage,
}: CommentSummaryCardProps) {
  const { annotation, label, root, replies, lastActivityAt } = thread;

  return (
    <li
      className={
        active
          ? "wpn-comment-summary-wrap wpn-comment-summary-wrap--active"
          : "wpn-comment-summary-wrap"
      }
    >
      <button type="button" className="wpn-comment-summary" onClick={() => onSelect(annotation.id)}>
        <span className="wpn-comment-summary__content">
          <span className="wpn-comment-summary__head">
            <span className="wpn-comment-summary__title">{label}</span>
            <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
              {statusLabel(annotation.status)}
            </span>
          </span>
          <span className="wpn-comment-summary__author-row">
            {root.createdBy.avatarUrl ? (
              <img className="wpn-avatar" src={root.createdBy.avatarUrl} alt="" />
            ) : (
              <span className="wpn-avatar wpn-avatar--fallback">
                {getInitials(root.createdBy.name)}
              </span>
            )}
            <span className="wpn-comment-summary__author">{root.createdBy.name}</span>
            <span aria-hidden="true">·</span>
            <span className="wpn-comment-summary__time">{formatRelativeTime(lastActivityAt)}</span>
          </span>
          <span className="wpn-comment-summary__snippet">{mentionsToPlainText(root.message)}</span>
        </span>
      </button>

      <span className="wpn-comment-summary__footer">
        <span>
          <Icon name="reply" className="wpn-comment-summary__footer-icon" />
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </span>
        <span className="wpn-comment-summary__footer-actions">
          <span>
            <Icon name="comment" className="wpn-comment-summary__footer-icon" />
            {annotation.comments.length}
          </span>
          <Tooltip label="Open on page" placement="left">
            <button
              type="button"
              className="wpn-comments-list-table__reveal"
              aria-label={`Open "${label}" on the page`}
              onClick={() => onRevealOnPage(annotation.id)}
            >
              <Icon name="arrowUpRight" />
            </button>
          </Tooltip>
        </span>
      </span>
    </li>
  );
}
