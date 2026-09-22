import { useCallback, useEffect, useState } from "react";
import type { Annotation, AnnotationComment, AnnotationUser } from "../../types/annotation.types";
import { formatTimestamp, getInitials } from "../../utils/format";
import { canDeleteComment, canEditComment } from "../../utils/commentPermissions";

interface AnnotationThreadProps {
  annotation: Annotation;
  currentUser: AnnotationUser;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
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
  currentUser,
  onEdit,
  onDelete,
  onEditingChange,
}: {
  comment: AnnotationComment;
  currentUser: AnnotationUser;
  onEdit: (commentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onEditingChange?: (commentId: string, editing: boolean) => void;
}) {
  const canEdit = canEditComment();
  const canDelete = canDeleteComment(comment, currentUser);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.message);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    onEditingChange?.(comment.id, editing && value.trim() !== comment.message.trim());
    return () => onEditingChange?.(comment.id, false);
  }, [comment.id, comment.message, editing, onEditingChange, value]);

  return (
    <article className="wpn-comment">
      <Avatar user={comment.createdBy} />
      <div className="wpn-comment__body">
        <div className="wpn-comment__meta">
          <strong>{comment.createdBy.name}</strong>
          <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
        </div>
        {editing ? (
          <div className="wpn-comment__edit">
            <textarea
              className="wpn-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-label="Edit comment"
              rows={2}
            />
            <div className="wpn-comment__actions">
              <button
                type="button"
                className="wpn-link wpn-link--chip"
                onClick={() => {
                  setEditing(false);
                  setValue(comment.message);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wpn-link wpn-link--chip wpn-link--save"
                disabled={!value.trim()}
                onClick={async () => {
                  await onEdit(comment.id, value.trim());
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="wpn-comment__message">{comment.message}</p>
        )}
        {(canEdit || canDelete) && !editing ? (
          <div className="wpn-comment__actions">
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
            {!canDelete ? null : confirmDelete ? (
              <>
                <button
                  type="button"
                  className="wpn-link wpn-link--chip wpn-link--danger"
                  onClick={() => onDelete(comment.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="wpn-link wpn-link--chip"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="wpn-link wpn-link--icon"
                aria-label="Delete"
                onClick={() => setConfirmDelete(true)}
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
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AnnotationThread({
  annotation,
  currentUser,
  onEdit,
  onDelete,
  onEditingChange,
}: AnnotationThreadProps) {
  const [dirtyEditIds, setDirtyEditIds] = useState<Set<string>>(new Set());

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
          currentUser={currentUser}
          onEdit={onEdit}
          onDelete={onDelete}
          onEditingChange={setCommentEditing}
        />
      ))}
    </div>
  );
}
