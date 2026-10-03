import { useCallback, useEffect, useState } from "react";
import {
  COMMENT_MAX_LENGTH,
  type Annotation,
  type AnnotationComment,
  type AnnotationUser,
} from "../../types/annotation.types";
import { formatTimestamp, getInitials } from "../../utils/format";
import {
  canDeleteAnnotation,
  canDeleteComment,
  canEditComment,
} from "../../utils/boardPermissions";
import {
  encodeMentions,
  mentionsToPlainText,
  referencesInMessage,
  splitMentions,
  type MentionCandidate,
} from "../../utils/mentions";
import { useMentionCandidates } from "../../hooks/useMentionCandidates";
import {
  useReferenceCandidates,
  type ReferenceCandidatesResult,
} from "../../hooks/useReferenceCandidates";
import { AddToContextCheckbox } from "../AddToContextCheckbox";
import { CommentMessage } from "../CommentMessage";
import { CommentQuote } from "../CommentQuote";
import { MentionTextarea } from "../MentionTextarea";
import { Icon, Tooltip } from "../primitives";

interface AnnotationThreadProps {
  annotation: Annotation;
  currentUser: AnnotationUser;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onToggleContext?: (commentId: string, addToContext: boolean) => Promise<void>;
  onDelete: (comment: AnnotationComment) => void;
  onReply: (comment: AnnotationComment) => void;
  onEditingChange?: (editing: boolean) => void;
  separateReplies?: boolean;
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
  references,
  currentUser,
  deletesAnnotation,
  canDeleteAnnotation,
  onEdit,
  onToggleContext,
  onDelete,
  onReply,
  onEditingChange,
}: {
  comment: AnnotationComment;
  quoted: AnnotationComment | undefined;
  candidates: MentionCandidate[];
  references: ReferenceCandidatesResult;
  currentUser: AnnotationUser;
  deletesAnnotation: boolean;
  canDeleteAnnotation: boolean;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onToggleContext?: (commentId: string, addToContext: boolean) => Promise<void>;
  onDelete: (comment: AnnotationComment) => void;
  onReply: (comment: AnnotationComment) => void;
  onEditingChange?: (commentId: string, editing: boolean) => void;
}) {
  const canEdit = canEditComment(comment, currentUser);
  const canDelete =
    canDeleteComment(comment, currentUser) && (!deletesAnnotation || canDeleteAnnotation);
  const [editing, setEditing] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const plainMessage = mentionsToPlainText(comment.message);
  const [value, setValue] = useState(plainMessage);

  useEffect(() => {
    onEditingChange?.(comment.id, editing && value.trim() !== plainMessage.trim());
    return () => onEditingChange?.(comment.id, false);
  }, [comment.id, plainMessage, editing, onEditingChange, value]);

  const discardEdit = () => {
    setConfirmingDiscard(false);
    setEditing(false);
    setValue(plainMessage);
  };

  const cancelEdit = () => {
    if (value.trim() !== plainMessage.trim()) {
      setConfirmingDiscard(true);
      return;
    }
    discardEdit();
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
    const previouslyReferenced = referencesInMessage(comment.message);
    onEdit(
      comment.id,
      encodeMentions(
        trimmed,
        [...candidates, ...previouslyMentioned],
        [...references.references, ...previouslyReferenced],
      ),
    ).catch(() => {
      setValue(trimmed);
      setEditing(true);
    });
  };

  return (
    <article className="wpn-comment">
      <Avatar user={comment.createdBy} />
      <div className="wpn-comment__body">
        <div className="wpn-comment__meta">
          <strong>{comment.createdBy.name}</strong>
          <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
          {editing ? (
            <span
              className={
                value.length >= COMMENT_MAX_LENGTH
                  ? "wpn-comment__word-count wpn-comment__word-count--limit"
                  : value.length >= COMMENT_MAX_LENGTH * 0.9
                    ? "wpn-comment__word-count wpn-comment__word-count--warn"
                    : "wpn-comment__word-count"
              }
            >
              {value.length}/{COMMENT_MAX_LENGTH}
            </span>
          ) : (
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
                <Tooltip label="Edit comment" placement="top">
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
                </Tooltip>
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
              references={references.references}
              referencesLoading={references.loading}
              onReferenceTrigger={references.request}
              ariaLabel="Edit comment"
              rows={2}
              maxLength={COMMENT_MAX_LENGTH}
              autoFocus
              onEnter={saveEdit}
              onEscape={cancelEdit}
            />
            {confirmingDiscard ? (
              <div className="wpn-comment__discard" role="alert">
                <span>Discard your changes?</span>
                <span className="wpn-comment__discard-actions">
                  <button
                    type="button"
                    className="wpn-link wpn-link--chip"
                    onClick={() => setConfirmingDiscard(false)}
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    className="wpn-link wpn-link--chip wpn-link--danger"
                    onClick={discardEdit}
                  >
                    Discard
                  </button>
                </span>
              </div>
            ) : (
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
            )}
          </div>
        ) : (
          <>
            {comment.replyToId ? <CommentQuote comment={quoted} /> : null}
            <p className="wpn-comment__message">
              <CommentMessage message={comment.message} currentUserId={currentUser.id} />
            </p>
            <AddToContextCheckbox
              className="wpn-context-check--comment"
              checked={comment.addToContext === true}
              disabled={!canEdit || !onToggleContext}
              onChange={(next) => {
                onToggleContext?.(comment.id, next).catch(() => undefined);
              }}
            />
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
  onToggleContext,
  onDelete,
  onReply,
  onEditingChange,
  separateReplies = false,
}: AnnotationThreadProps) {
  const [dirtyEditIds, setDirtyEditIds] = useState<Set<string>>(new Set());
  const candidates = useMentionCandidates();
  const references = useReferenceCandidates();

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

  const deletesAnnotation = annotation.comments.length === 1;
  const canDelete = canDeleteAnnotation(annotation, currentUser);

  const renderComment = (comment: AnnotationComment) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      quoted={annotation.comments.find((item) => item.id === comment.replyToId)}
      candidates={candidates}
      references={references}
      currentUser={currentUser}
      deletesAnnotation={deletesAnnotation}
      canDeleteAnnotation={canDelete}
      onEdit={onEdit}
      onToggleContext={onToggleContext}
      onDelete={onDelete}
      onReply={onReply}
      onEditingChange={setCommentEditing}
    />
  );

  if (!separateReplies) {
    return (
      <div className="wpn-thread" aria-live="polite" aria-relevant="additions">
        {annotation.comments.map(renderComment)}
      </div>
    );
  }

  const [root, ...replies] = annotation.comments;

  return (
    <div className="wpn-thread wpn-thread--separated" aria-live="polite" aria-relevant="additions">
      {root ? <div className="wpn-thread__root">{renderComment(root)}</div> : null}
      {replies.length > 0 ? (
        <>
          <div className="wpn-thread__replies-label">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </div>
          <div className="wpn-thread__replies">{replies.map(renderComment)}</div>
        </>
      ) : null}
    </div>
  );
}
