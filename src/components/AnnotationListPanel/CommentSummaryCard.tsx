import { useState } from "react";
import { useAnnotationData } from "../../context/AnnotationContext";
import { formatRelativeTime, getInitials } from "../../utils/format";
import { mentionsToPlainText } from "../../utils/mentions";
import { isDoneStatus, statusLabel } from "../../utils/status";
import { Icon } from "../primitives";
import type { CommentThread } from "./commentFilters";

interface CommentSummaryCardProps {
  thread: CommentThread;
  active: boolean;
  onSelect: (annotationId: string) => void;
}

export function CommentSummaryCard({ thread, active, onSelect }: CommentSummaryCardProps) {
  const { setStatus } = useAnnotationData();
  const { annotation, label, root, replies, lastActivityAt } = thread;
  const [menuOpen, setMenuOpen] = useState(false);
  const resolved = isDoneStatus(annotation.status);

  const changeStatus = (status: "completed" | "re-open") => {
    setMenuOpen(false);
    setStatus(annotation.id, status).catch(() => undefined);
  };

  return (
    <li className="wpn-comment-summary-wrap">
      <button
        type="button"
        className={
          active ? "wpn-comment-summary wpn-comment-summary--active" : "wpn-comment-summary"
        }
        onClick={() => onSelect(annotation.id)}
      >
        <span className="wpn-comment-summary__content">
          <span className="wpn-comment-summary__head">
            <span className="wpn-comment-summary__number">#{annotation.number}</span>
            <span className="wpn-comment-summary__page" title={annotation.pageKey}>
              {annotation.pageKey}
            </span>
            <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
              {statusLabel(annotation.status)}
            </span>
          </span>
          <span className="wpn-comment-summary__title">{label}</span>
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
        <span className="wpn-comment-summary__footer">
          <span>
            <Icon name="reply" className="wpn-comment-summary__footer-icon" />
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
          <span>
            <Icon name="comment" className="wpn-comment-summary__footer-icon" />
            {annotation.comments.length}
          </span>
        </span>
      </button>

      <span
        className="wpn-comment-summary__menu"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setMenuOpen(false);
          }
        }}
      >
        <button
          type="button"
          className="wpn-comment-summary__menu-trigger"
          aria-label="Comment actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ⋮
        </button>
        {menuOpen ? (
          <div className="wpn-comment-summary__menu-popover" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => changeStatus(resolved ? "re-open" : "completed")}
            >
              {resolved ? "Reopen" : "Mark resolved"}
            </button>
          </div>
        ) : null}
      </span>
    </li>
  );
}
