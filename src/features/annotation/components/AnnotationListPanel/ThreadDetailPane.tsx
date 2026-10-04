import { useState } from "react";
import { useAnnotationData } from "../../../../context/AnnotationContext";
import { annotationLabel } from "../../../../utils/annotation/annotationLabel";
import { canDeleteAnnotation } from "../../../../utils/epicFlow/boardPermissions";
import { mentionsToPlainText } from "../../../../utils/mentions";
import { AnnotationReplyComposer } from "../AnnotationReplyComposer";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { AnnotationThread } from "../AnnotationThread";
import { buildRenamedPath } from "../AnnotationThreadPanel";
import { ConfirmDialog } from "../../../userManagement/components/ConfirmDialog";
import { Icon } from "../../../../components/primitives/Icon";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import type { AnnotationComment } from "../../../../types/annotation.types";
import { fitTitleInputHeight, focusTitleInputAtEnd } from "../../../../utils/titleInput";

const MENU_GLYPH = "⋮";

interface ThreadDetailPaneProps {
  annotationId: string | null;
  onClose: () => void;
}

export function ThreadDetailPane({ annotationId, onClose }: ThreadDetailPaneProps) {
  const {
    annotations,
    allAnnotations,
    config,
    addComment,
    editComment,
    setCommentAddToContext,
    removeComment,
    setStatus,
    renameAnnotation,
  } = useAnnotationData();
  const annotation = annotationId
    ? (annotations.find((item) => item.id === annotationId) ??
      allAnnotations.find((item) => item.id === annotationId))
    : undefined;

  const [replyTarget, setReplyTarget] = useState<AnnotationComment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnotationComment | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  if (!annotation) {
    return null;
  }

  const title = annotationLabel(annotation);

  const startEditingTitle = () => {
    setMenuOpen(false);
    setTitleValue(title);
    setEditingTitle(true);
  };

  const commitTitle = () => {
    const trimmed = titleValue.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === title) {
      return;
    }
    renameAnnotation(annotation.id, buildRenamedPath(annotation.path, trimmed)).catch(
      () => undefined,
    );
  };

  const confirmDelete = (comment: AnnotationComment) => {
    setPendingDelete(null);
    removeComment(annotation.id, comment.id).catch(() => undefined);
  };

  const sendReply = async (message: string, addToContext: boolean) => {
    const target = replyTarget;
    setReplyTarget(null);
    try {
      await addComment(annotation.id, message, target?.id, addToContext);
    } catch (err) {
      setReplyTarget(target);
      throw err;
    }
  };

  return (
    <div className="wpn-thread-detail">
      <div className="wpn-thread-detail__header">
        {editingTitle ? (
          <textarea
            ref={focusTitleInputAtEnd}
            className="wpn-thread-detail__title-input"
            rows={1}
            value={titleValue}
            onChange={(event) => {
              setTitleValue(event.target.value);
              fitTitleInputHeight(event.target);
            }}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTitle();
              } else if (event.key === "Escape") {
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <span className="wpn-thread-detail__title" title={title}>
            {title}
          </span>
        )}
        <AnnotationStatusSelect
          value={annotation.status}
          disabled={!canDeleteAnnotation(annotation, config.currentUser)}
          onChange={(status) => setStatus(annotation.id, status).catch(() => undefined)}
        />
        <span
          className="wpn-thread-detail__menu"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            className="wpn-thread-detail__menu-trigger"
            aria-label="Thread actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {MENU_GLYPH}
          </button>
          {menuOpen ? (
            <div className="wpn-thread-detail__menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={startEditingTitle}>
                Rename
              </button>
              {annotation.comments.length === 1 &&
              canDeleteAnnotation(annotation, config.currentUser) ? (
                <button
                  type="button"
                  role="menuitem"
                  className="wpn-thread-detail__menu-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setPendingDelete(annotation.comments[0] ?? null);
                  }}
                >
                  Delete thread
                </button>
              ) : null}
            </div>
          ) : null}
        </span>
        <Tooltip label="Close preview" placement="bottom">
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label="Close preview"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </Tooltip>
      </div>

      <div className="wpn-thread-detail__scroll">
        <AnnotationThread
          annotation={annotation}
          currentUser={config.currentUser}
          onEdit={(commentId, message) => editComment(annotation.id, commentId, message)}
          onToggleContext={(commentId, value) =>
            setCommentAddToContext(annotation.id, commentId, value)
          }
          onDelete={setPendingDelete}
          onReply={setReplyTarget}
          separateReplies
        />
      </div>

      <div className="wpn-thread-detail__composer">
        <AnnotationReplyComposer
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          onSubmit={sendReply}
        />
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title={annotation.comments.length === 1 ? "Delete this thread?" : "Delete this comment?"}
          description={
            annotation.comments.length === 1
              ? "This is the only comment, so the pin will be removed from the page for everyone. This cannot be undone."
              : "It will be removed from the thread for everyone. This cannot be undone."
          }
          detail={
            <p>
              <strong>{pendingDelete.createdBy.name}:</strong>{" "}
              {mentionsToPlainText(pendingDelete.message)}
            </p>
          }
          confirmLabel={annotation.comments.length === 1 ? "Delete thread" : "Delete comment"}
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => confirmDelete(pendingDelete)}
        />
      ) : null}
    </div>
  );
}
