import { useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import { AnnotationReplyComposer } from "../AnnotationReplyComposer";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { AnnotationThread } from "../AnnotationThread";
import { Icons } from "../../assets/icons";
import { Tooltip } from "../primitives";
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

  if (!annotation) {
    return null;
  }

  const title = annotation.anchor.elementIdentifier.replace(/[-_]/g, " ");

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
          <span className="wpn-panel__title">{title}</span>
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
