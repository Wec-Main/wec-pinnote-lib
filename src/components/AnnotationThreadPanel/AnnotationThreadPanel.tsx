import { useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import { AnnotationReplyComposer } from "../AnnotationReplyComposer";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { AnnotationThread } from "../AnnotationThread";
import { Icons } from "../../assets/icons";
import { Icon, Tooltip } from "../primitives";
import { canDeleteAnnotation } from "../../utils/boardPermissions";

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
  const {
    annotations,
    config,
    addComment,
    editComment,
    removeComment,
    setStatus,
    removeAnnotation,
  } = useAnnotationData();
  const { selectAnnotation } = useAnnotationUi();
  const annotation = annotations.find((item) => item.id === annotationId);
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(Boolean(annotation), x, y, panelRef);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!annotation) {
    return null;
  }

  const title = annotation.anchor.elementIdentifier.replace(/[-_]/g, " ");
  const canDelete = canDeleteAnnotation(annotation, config.currentUser);

  const requestClose = () => {
    if (hasUnsavedEdit) {
      setConfirmClose(true);
      return;
    }
    selectAnnotation(null);
  };

  return (
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
        onDelete={(commentId) => removeComment(annotation.id, commentId)}
        onEditingChange={setHasUnsavedEdit}
      />
      <div className="wpn-panel__composer">
        <AnnotationReplyComposer onSubmit={(message) => addComment(annotation.id, message)} />
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
            {canDelete ? (
              confirmDelete ? (
                <>
                  <button
                    type="button"
                    className="wpn-btn wpn-btn--ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="wpn-btn-delete"
                    onClick={() => {
                      removeAnnotation(annotation.id).then(
                        () => selectAnnotation(null),
                        () => undefined,
                      );
                    }}
                  >
                    <Icon name="trash" className="wpn-btn__icon" />
                    Confirm delete
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="wpn-btn-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" className="wpn-btn__icon" />
                  Delete
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
