import { useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import { AnnotationReplyComposer } from "../AnnotationReplyComposer";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { AnnotationThread } from "../AnnotationThread";
import { Icons } from "../../assets/icons";
import { Icon, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { mentionsToPlainText } from "../../utils/mentions";
import type { AnnotationComment } from "../../types/annotation.types";

interface AnnotationThreadPanelProps {
  annotationId: string;
  x: number;
  y: number;
  orphaned: boolean;
}

export function AnnotationThreadPanel({
  annotationId,
  x,
  y,
  orphaned,
}: AnnotationThreadPanelProps) {
  const { annotations, config, addComment, editComment, removeComment, setStatus } =
    useAnnotationData();
  const { selectAnnotation } = useAnnotationUi();
  const annotation = annotations.find((item) => item.id === annotationId);
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(Boolean(annotation), x, y, panelRef);
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AnnotationComment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnotationComment | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);

  if (!annotation) {
    return null;
  }

  const defaultTitle = annotation.anchor.elementIdentifier.replace(/[-_]/g, " ");
  const title = titleOverride ?? defaultTitle;

  const startEditingTitle = () => {
    setTitleValue(title);
    setEditingTitle(true);
  };

  const commitTitle = () => {
    const trimmed = titleValue.trim();
    setTitleOverride(trimmed || defaultTitle);
    setEditingTitle(false);
  };

  const requestClose = () => {
    if (hasUnsavedEdit) {
      setConfirmClose(true);
      return;
    }
    selectAnnotation(null);
  };

  const confirmDelete = (comment: AnnotationComment) => {
    setPendingDelete(null);
    removeComment(annotation.id, comment.id).catch(() => undefined);
  };

  const sendReply = async (message: string) => {
    const target = replyTarget;
    setReplyTarget(null);
    try {
      await addComment(annotation.id, message, target?.id);
    } catch (err) {
      setReplyTarget(target);
      throw err;
    }
  };

  return (
    <>
      <div
        ref={panelRef}
        className="wpn-panel wpn-thread-panel"
        style={{ left: placement.left, top: placement.top }}
      >
        <div className="wpn-panel__header">
          <span className="wpn-panel__title-group">
            {editingTitle ? (
              <input
                className="wpn-panel__title-input"
                value={titleValue}
                onChange={(event) => setTitleValue(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTitle();
                  } else if (event.key === "Escape") {
                    setEditingTitle(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <span className="wpn-panel__title">{title}</span>
            )}
            <button
              type="button"
              className="wpn-link wpn-link--icon"
              aria-label={editingTitle ? "Save title" : "Edit title"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={editingTitle ? commitTitle : startEditingTitle}
            >
              <Icon name={editingTitle ? "check" : "edit"} className="wpn-action-icon" />
            </button>
            <span
              className="wpn-thread-panel__info"
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
            >
              <button
                type="button"
                className="wpn-link wpn-link--icon"
                aria-label="Thread info"
                onFocus={() => setInfoOpen(true)}
                onBlur={() => setInfoOpen(false)}
              >
                <Icon name="info" className="wpn-action-icon" />
              </button>
              {infoOpen ? (
                <span className="wpn-thread-panel__info-popover" role="tooltip">
                  <span>
                    <kbd>Enter</kbd> to send
                  </span>
                  <span>
                    <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
                  </span>
                  <span>
                    <kbd>@</kbd> to mention
                  </span>
                </span>
              ) : null}
            </span>
          </span>
          {confirmClose ? (
            <span className="wpn-panel__title-group">
              <span className="wpn-muted">Discard unsaved edit?</span>
              <button
                type="button"
                className="wpn-link wpn-link--chip"
                onClick={() => setConfirmClose(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wpn-link wpn-link--chip wpn-link--danger"
                onClick={() => {
                  setConfirmClose(false);
                  selectAnnotation(null);
                }}
              >
                Discard
              </button>
            </span>
          ) : (
            <Tooltip label="Close" placement="left">
              <button
                type="button"
                className="wpn-icon-btn"
                aria-label="Close thread"
                onClick={requestClose}
              >
                ×
              </button>
            </Tooltip>
          )}
        </div>
        {orphaned ? (
          <div className="wpn-orphaned">
            Original element is not on screen. Showing fallback position.
          </div>
        ) : null}
        <AnnotationThread
          annotation={annotation}
          currentUser={config.currentUser}
          onEdit={(commentId, message) => editComment(annotation.id, commentId, message)}
          onDelete={setPendingDelete}
          onReply={setReplyTarget}
          onEditingChange={setHasUnsavedEdit}
        />
        <div className="wpn-panel__composer">
          <AnnotationReplyComposer
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            onSubmit={sendReply}
          />
          <div className="wpn-panel__toolbar">
            <div className="wpn-thread-panel__brand">
              <span>Powered by</span>
              <img src={Icons.wecLogo} alt="" />
              <span className="wpn-thread-panel__brand-name">Wec.ai</span>
            </div>
            <div className="wpn-panel__toolbar-end">
              <AnnotationStatusSelect
                value={annotation.status}
                onChange={(status) => setStatus(annotation.id, status).catch(() => undefined)}
              />
            </div>
          </div>
        </div>
      </div>
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this comment?"
          description="It will be removed from the thread for everyone. This cannot be undone."
          detail={
            <p>
              <strong>{pendingDelete.createdBy.name}:</strong>{" "}
              {mentionsToPlainText(pendingDelete.message)}
            </p>
          }
          confirmLabel="Delete comment"
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => confirmDelete(pendingDelete)}
        />
      ) : null}
    </>
  );
}
