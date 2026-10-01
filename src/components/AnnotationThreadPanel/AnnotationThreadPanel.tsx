import { useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { annotationLabel } from "../../utils/annotationLabel";
import { AnnotationReplyComposer } from "../AnnotationReplyComposer";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { AnnotationThread } from "../AnnotationThread";
import { Icons } from "../../assets/icons";
import { Icon, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { canDeleteAnnotation } from "../../utils/boardPermissions";
import { mentionsToPlainText } from "../../utils/mentions";
import type { AnnotationComment } from "../../types/annotation.types";

function fitTitleInputHeight(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function focusTitleInputAtEnd(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  fitTitleInputHeight(element);
  element.focus();
  element.setSelectionRange(element.value.length, element.value.length);
}

// The displayed title is the last " > " segment of the stored path
// (see annotationLabel()); renaming it means replacing just that last
// segment while keeping whatever page-name prefix it had.
export function buildRenamedPath(currentPath: string | null | undefined, newTitle: string): string {
  if (!currentPath) {
    return newTitle;
  }
  const segments = currentPath.split(" > ");
  segments[segments.length - 1] = newTitle;
  return segments.join(" > ");
}

interface AnnotationThreadPanelProps {
  annotationId: string;
  x: number;
  y: number;
  orphaned: boolean;
  // True when opened from a thread that isn't on the current page (e.g. from
  // the "Not in this view" comments-list row for a different page) — there's
  // no real on-page position to anchor to, so the panel is centered on the
  // viewport instead of placed relative to x/y.
  centered?: boolean;
}

export function AnnotationThreadPanel({
  annotationId,
  x,
  y,
  orphaned,
  centered = false,
}: AnnotationThreadPanelProps) {
  const {
    annotations,
    allAnnotations,
    config,
    addComment,
    editComment,
    removeComment,
    setStatus,
    renameAnnotation,
  } = useAnnotationData();
  const { selectAnnotation } = useAnnotationUi();
  const annotation =
    annotations.find((item) => item.id === annotationId) ??
    allAnnotations.find((item) => item.id === annotationId);
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(!centered && Boolean(annotation), x, y, panelRef);
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false);
  const [hasUnsentReply, setHasUnsentReply] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AnnotationComment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnotationComment | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);

  const closeRequestedRef = useRef<() => void>(() => undefined);
  useEscapeKey(
    () => closeRequestedRef.current(),
    Boolean(annotation) && !editingTitle && !pendingDelete,
  );

  if (!annotation) {
    return null;
  }

  const title = annotationLabel(annotation);

  const startEditingTitle = () => {
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

  const requestClose = () => {
    if (hasUnsavedEdit || hasUnsentReply) {
      setConfirmClose(true);
      return;
    }
    selectAnnotation(null);
  };
  closeRequestedRef.current = requestClose;

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
        className={[
          "wpn-panel",
          "wpn-thread-panel",
          centered ? "wpn-thread-panel--centered" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          centered
            ? undefined
            : {
                left: placement?.left ?? 0,
                top: placement?.top ?? 0,
                visibility: placement ? "visible" : "hidden",
              }
        }
        role="dialog"
        aria-label={`Comment thread: ${title}`}
      >
        <div className="wpn-panel__header">
          <div className="wpn-panel__header-row">
          <span className="wpn-panel__title-group">
            {editingTitle ? (
              <textarea
                ref={focusTitleInputAtEnd}
                className="wpn-panel__title-input"
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
              <span className="wpn-panel__title" title={title}>
                {title}
              </span>
            )}
            <Tooltip label={editingTitle ? "Save title" : "Edit title"} placement="bottom">
              <button
                type="button"
                className="wpn-link wpn-link--icon"
                aria-label={editingTitle ? "Save title" : "Edit title"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={editingTitle ? commitTitle : startEditingTitle}
              >
                <Icon name={editingTitle ? "check" : "edit"} className="wpn-action-icon" />
              </button>
            </Tooltip>
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
          </div>
          {annotation.path ? (
            <div className="wpn-thread-panel__path" title={annotation.path}>
              <span className="wpn-thread-panel__path-label">PATH: </span>
              {annotation.path}
            </div>
          ) : null}
          {centered ? <span className="wpn-thread-panel__chip">Not in this view</span> : null}
        </div>
        {confirmClose ? (
          <div className="wpn-thread-panel__discard" role="alert">
            <span>{hasUnsavedEdit ? "Discard unsaved edit?" : "Discard unsent reply?"}</span>
            <span className="wpn-thread-panel__discard-actions">
              <button
                type="button"
                className="wpn-link wpn-link--chip"
                onClick={() => setConfirmClose(false)}
              >
                Keep editing
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
          </div>
        ) : null}
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
            onDraftChange={setHasUnsentReply}
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
                disabled={!canDeleteAnnotation(annotation, config.currentUser)}
                onChange={(status) => setStatus(annotation.id, status).catch(() => undefined)}
              />
            </div>
          </div>
        </div>
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
    </>
  );
}
