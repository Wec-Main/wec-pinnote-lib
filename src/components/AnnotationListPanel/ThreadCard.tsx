import { memo } from "react";
import type { AnnotationComment } from "../../types/annotation.types";
import { formatRelativeTime, formatTimestamp, getInitials } from "../../utils/format";
import { isDoneStatus, statusLabel } from "../../utils/status";
import { CommentMessage } from "../CommentMessage";
import { CommentQuote } from "../CommentQuote";
import { Icon } from "../primitives";
import type { CommentThread } from "./commentFilters";

interface ThreadCardProps {
  thread: CommentThread;
  active: boolean;
  currentUserId: string;
  repliesCollapsed: boolean;
  onToggleReplies: (annotationId: string) => void;
  onSelect: (annotationId: string) => void;
}

function ThreadComment({
  comment,
  quoted,
  isReply,
  currentUserId,
  onSelect,
}: {
  comment: AnnotationComment;
  quoted: AnnotationComment | undefined;
  isReply: boolean;
  currentUserId: string;
  onSelect: () => void;
}) {
  const edited = comment.updatedAt !== comment.createdAt;
  return (
    <button
      type="button"
      className={
        isReply
          ? "wpn-thread-card__comment wpn-thread-card__comment--reply"
          : "wpn-thread-card__comment"
      }
      onClick={onSelect}
    >
      {comment.createdBy.avatarUrl ? (
        <img className="wpn-thread-card__avatar" src={comment.createdBy.avatarUrl} alt="" />
      ) : (
        <span className="wpn-thread-card__avatar wpn-thread-card__avatar--fallback">
          {getInitials(comment.createdBy.name)}
        </span>
      )}
      <span className="wpn-thread-card__body">
        <span className="wpn-thread-card__meta">
          <strong>{comment.createdBy.name}</strong>
          <time dateTime={comment.createdAt} title={formatTimestamp(comment.createdAt)}>
            {formatRelativeTime(comment.createdAt)}
          </time>
          {edited ? <span className="wpn-thread-card__edited">edited</span> : null}
        </span>
        {quoted ? <CommentQuote comment={quoted} /> : null}
        <span className="wpn-thread-card__message">
          <CommentMessage message={comment.message} currentUserId={currentUserId} />
        </span>
      </span>
    </button>
  );
}

export const ThreadCard = memo(function ThreadCard({
  thread,
  active,
  currentUserId,
  repliesCollapsed,
  onToggleReplies,
  onSelect,
}: ThreadCardProps) {
  const { annotation, root, replies, label } = thread;
  const select = () => onSelect(annotation.id);
  const findQuoted = (reply: AnnotationComment) =>
    reply.replyToId === root.id
      ? undefined
      : annotation.comments.find((comment) => comment.id === reply.replyToId);

  return (
    <li
      className={[
        "wpn-thread-card",
        active ? "wpn-thread-card--active" : "",
        isDoneStatus(annotation.status) ? "wpn-thread-card--resolved" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button type="button" className="wpn-thread-card__head" onClick={select}>
        <span className="wpn-thread-card__pin">#{annotation.number}</span>
        <span className="wpn-thread-card__label">{label}</span>
        <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
          {statusLabel(annotation.status)}
        </span>
      </button>
      <ThreadComment
        comment={root}
        quoted={undefined}
        isReply={false}
        currentUserId={currentUserId}
        onSelect={select}
      />
      {replies.length > 0 ? (
        <div className="wpn-thread-card__replies">
          <button
            type="button"
            className="wpn-thread-card__toggle"
            aria-expanded={!repliesCollapsed}
            onClick={() => onToggleReplies(annotation.id)}
          >
            <Icon
              name="chevronDown"
              className={
                repliesCollapsed
                  ? "wpn-thread-card__chevron wpn-thread-card__chevron--closed"
                  : "wpn-thread-card__chevron"
              }
            />
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </button>
          {repliesCollapsed
            ? null
            : replies.map((reply) => (
                <ThreadComment
                  key={reply.id}
                  comment={reply}
                  quoted={findQuoted(reply)}
                  isReply
                  currentUserId={currentUserId}
                  onSelect={select}
                />
              ))}
        </div>
      ) : null}
    </li>
  );
});
