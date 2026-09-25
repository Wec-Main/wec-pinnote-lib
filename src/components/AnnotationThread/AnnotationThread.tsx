import { useCallback, useEffect, useState } from "react";
import {
  COMMENT_MAX_LENGTH,
  type Annotation,
  type AnnotationComment,
  type AnnotationUser,
} from "../../types/annotation.types";
import { formatTimestamp, getInitials } from "../../utils/format";
import { canDeleteComment, canEditComment } from "../../utils/boardPermissions";
import {
  encodeMentions,
  mentionsToPlainText,
  splitMentions,
  type MentionCandidate,
} from "../../utils/mentions";
import { useMentionCandidates } from "../../hooks/useMentionCandidates";
import { CommentMessage } from "../CommentMessage";
import { CommentQuote } from "../CommentQuote";
import { MentionTextarea } from "../MentionTextarea";
import { Icon } from "../primitives";

interface AnnotationThreadProps {
  annotation: Annotation;
  currentUser: AnnotationUser;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onDelete: (comment: AnnotationComment) => void;
  onReply: (comment: AnnotationComment) => void;
  onEditingChange?: (editing: boolean) => void;
}

function Avatar({ user }: { user: AnnotationUser }) {
  if (user.avatarUrl) {
    return <img className="wpn-avatar" src={user.avatarUrl} alt="" />;
  }
  return <span className="wpn-avatar wpn-avatar--fallback">{getInitials(user.name)}</span>;
}

function CommentItem({
  comment,
  quoted,
  candidates,
  currentUser,
  onEdit,
  onDelete,
  onReply,
  onEditingChange,
}: {
  comment: AnnotationComment;
  quoted: AnnotationComment | undefined;
  candidates: MentionCandidate[];
  currentUser: AnnotationUser;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onDelete: (comment: AnnotationComment) => void;
  onReply: (comment: AnnotationComment) => void;
  onEditingChange?: (commentId: string, editing: boolean) => void;
}) {
  const canEdit = canEditComment(comment, currentUser);
  const canDelete = canDeleteComment(comment, currentUser);
  const [editing, setEditing] = useState(false);
  const plainMessage = mentionsToPlainText(comment.message);
  const [value, setValue] = useState(plainMessage);

  useEffect(() => {
    onEditingChange?.(comment.id, editing && value.trim() !== plainMessage.trim());
    return () => onEditingChange?.(comment.id, false);
  }, [comment.id, plainMessage, editing, onEditingChange, value]);

  const cancelEdit = () => {
    setEditing(false);
    setValue(plainMessage);
  };

  const saveEdit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const previouslyMentioned = splitMentions(comment.message).flatMap((segment) =>
      segment.kind === "mention" ? [{ id: segment.userId, name: segment.name }] : [],
    );
    setEditing(false);
    onEdit(comment.id, encodeMentions(trimmed, [...candidates, ...previouslyMentioned])).catch(
      () => {
        setValue(trimmed);
        setEditing(true);
      },
    );
  };

  return (
    <article className="wpn-comment">
      <Avatar user={comment.createdBy} />
      <div className="wpn-comment__body">
        <div className="wpn-comment__meta">
          <strong>{comment.createdBy.name}</strong>
          <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
          {editing ? null : (
            <div className="wpn-comment__actions wpn-comment__actions--inline">
              <button
                type="button"
                className="wpn-link wpn-link--icon"
                aria-label="Reply"
                onClick={() => onReply(comment)}
              >
                <Icon name="reply" className="wpn-action-icon" />
              </button>
              {canEdit ? (
                <button
                  type="button"
                  className="wpn-link wpn-link--icon"
                  aria-label="Edit"
                  onClick={() => setEditing(true)}
                >
                  <svg viewBox="0 0 24 24" className="wpn-action-icon" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M13.2 6.2 17.8 10.8M4 20l.9-4.5L14.6 6a1.5 1.5 0 0 1 2.1 0l1.3 1.3a1.5 1.5 0 0 1 0 2.1L8.5 19.1 4 20Z"
                    />
                  </svg>
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="wpn-link wpn-link--icon wpn-link--danger"
                  aria-label="Delete"
                  onClick={() => onDelete(comment)}
                >
                  <svg viewBox="0 0 16 16" className="wpn-action-icon" aria-hidden="true">
                    <path
                      d="M3 4h10M6.2 4V2.8h3.6V4M5 6.2v6M8 6.2v6M11 6.2v6M4.2 4l.5 9.2h6.6L11.8 4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          )}
        </div>
        {editing ? (
          <div className="wpn-comment__edit">
            <MentionTextarea
              className="wpn-input"
              value={value}
              onChange={setValue}
              candidates={candidates}
              ariaLabel="Edit comment"
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              autoFocus
              onEnter={saveEdit}
              onEscape={cancelEdit}
            />
            <div className="wpn-comment__actions">
              <button type="button" className="wpn-link wpn-link--chip" onClick={cancelEdit}>
                <Icon name="close" className="wpn-link__icon" />
                Cancel
              </button>
              <button
                type="button"
                className="wpn-link wpn-link--chip wpn-link--save"
                disabled={!value.trim()}
                onClick={saveEdit}
              >
                <Icon name="check" className="wpn-link__icon" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {comment.replyToId ? <CommentQuote comment={quoted} /> : null}
            <p className="wpn-comment__message">
              <CommentMessage message={comment.message} currentUserId={currentUser.id} />
            </p>
          </>
        )}
      </div>
    </article>
  );
}

export function AnnotationThread({
  annotation,
  currentUser,
  onEdit,
  onDelete,
  onReply,
  onEditingChange,
}: AnnotationThreadProps) {
  const [dirtyEditIds, setDirtyEditIds] = useState<Set<string>>(new Set());
  const candidates = useMentionCandidates();

  useEffect(() => {
    onEditingChange?.(dirtyEditIds.size > 0);
  }, [dirtyEditIds, onEditingChange]);

  const setCommentEditing = useCallback((commentId: string, editing: boolean) => {
    setDirtyEditIds((current) => {
      const isEditing = current.has(commentId);
      if (isEditing === editing) {
        return current;
      }
      const next = new Set(current);
      if (editing) {
        next.add(commentId);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  }, []);

  return (
    <div className="wpn-thread">
      {annotation.comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          quoted={annotation.comments.find((item) => item.id === comment.replyToId)}
          candidates={candidates}
          currentUser={currentUser}
          onEdit={onEdit}
          onDelete={onDelete}
          onReply={onReply}
          onEditingChange={setCommentEditing}
        />
      ))}
    </div>
  );
}
