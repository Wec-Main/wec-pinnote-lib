import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { fitTitleInputHeight, focusTitleInputAtEnd } from "../../utils/titleInput";
import { THREAD_STATUS_OPTIONS } from "../../utils/status";
import { AnnotationAiActions } from "../Ai/AnnotationAiActions";

const DRAG_EDGE_MARGIN = 8;

const NON_DRAG_TARGET = "button, a, input, textarea, select, label, [role='tooltip']";

export function buildRenamedPath(currentPath: string | null | undefined, newTitle: string): string {
  if (!currentPath) {
    return newTitle;
  }
  const segments = currentPath.split(" > ");
  segments[segments.length - 1] = newTitle;
  return segments.join(" > ");
}

function pathPrefix(path: string | null | undefined): string {
  return path ? path.split(" > ").slice(0, -1).join(" > ") : "";
}

function buildEditedPath(prefix: string, title: string): string {
  const segments = prefix
    .split(">")
    .map((segment) => segment.trim())
    .filter(Boolean);
  return [...segments, title].join(" > ");
}

interface AnnotationThreadPanelProps {
  annotationId: string;
  x: number;
  y: number;
  orphaned: boolean;
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
    setCommentAddToContext,
    removeComment,
    setStatus,
    renameAnnotation,
  } = useAnnotationData();
  const { closeThread } = useAnnotationUi();
  const annotation =
    annotations.find((item) => item.id === annotationId) ??
    allAnnotations.find((item) => item.id === annotationId);
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(!centered && Boolean(annotation), x, y, panelRef);
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false);
  const [hasUnsentReply, setHasUnsentReply] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AnnotationComment | null>(null);
  const [replySeed, setReplySeed] = useState<{ text: string; key: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnotationComment | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [pathValue, setPathValue] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!centered) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [centered]);

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
    setPathValue(pathPrefix(annotation.path));
    setEditingTitle(true);
  };

  const commitTitle = () => {
    const trimmed = titleValue.trim();
    setEditingTitle(false);
    if (!trimmed) {
      return;
    }
    const nextPath = buildEditedPath(pathValue, trimmed);
    if (nextPath === (annotation.path ?? title)) {
      return;
    }
    renameAnnotation(annotation.id, nextPath).catch(() => undefined);
  };

  const commitOnBlurOutside = (event: FocusEvent<HTMLTextAreaElement>) => {
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && next.dataset.wpnTitleEdit !== undefined) {
      return;
    }
    commitTitle();
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitle();
    } else if (event.key === "Escape") {
      setEditingTitle(false);
    }
  };

  const requestClose = () => {
    if (hasUnsavedEdit || hasUnsentReply) {
      setConfirmClose(true);
      return;
    }
    closeThread();
  };
  closeRequestedRef.current = requestClose;

  const confirmDelete = (comment: AnnotationComment) => {
    setPendingDelete(null);
    removeComment(annotation.id, comment.id).catch(() => undefined);
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (
      !centered ||
      !panel ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest(NON_DRAG_TARGET)
    ) {
      return;
    }
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffset = dragOffset;
    const clamp = (value: number, min: number, max: number) =>
      max < min ? min : Math.min(Math.max(value, min), max);

    const onMove = (moveEvent: PointerEvent) => {
      const dx = clamp(
        moveEvent.clientX - startX,
        DRAG_EDGE_MARGIN - rect.left,
        window.innerWidth - DRAG_EDGE_MARGIN - rect.right,
      );
      const dy = clamp(
        moveEvent.clientY - startY,
        DRAG_EDGE_MARGIN - rect.top,
        window.innerHeight - DRAG_EDGE_MARGIN - rect.bottom,
      );
      setDragOffset({ x: startOffset.x + dx, y: startOffset.y + dy });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    setDragging(true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
    <>
      <div
        ref={panelRef}
        className={[
          "wpn-panel",
          "wpn-thread-panel",
          centered ? "wpn-thread-panel--centered" : "",
          dragging ? "wpn-thread-panel--dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          centered
            ? {
                transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`,
              }
            : {
                left: placement?.left ?? 0,
                top: placement?.top ?? 0,
                visibility: placement ? "visible" : "hidden",
              }
        }
        role="dialog"
        aria-label={`Comment thread: ${title}`}
      >
        <div className="wpn-panel__header" onPointerDown={startDrag}>
          <div className="wpn-panel__header-row">
            <span className="wpn-panel__title-group">
              {editingTitle ? (
                <textarea
                  ref={focusTitleInputAtEnd}
                  data-wpn-title-edit=""
                  className="wpn-panel__title-input"
                  rows={1}
                  aria-label="Title"
                  value={titleValue}
                  onChange={(event) => {
                    setTitleValue(event.target.value);
                    fitTitleInputHeight(event.target);
                  }}
                  onBlur={commitOnBlurOutside}
                  onKeyDown={onEditKeyDown}
                />
              ) : (
                <span className="wpn-panel__title" title={title}>
                  {title}
                </span>
              )}
              {centered && !editingTitle ? (
                <span className="wpn-thread-panel__chip">Not in this view</span>
              ) : null}
              <Tooltip
                label={editingTitle ? "Save title and path" : "Edit title and path"}
                placement="bottom"
              >
                <button
                  type="button"
                  className="wpn-link wpn-link--icon"
                  aria-label={editingTitle ? "Save title and path" : "Edit title and path"}
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
          {editingTitle ? (
            <label className="wpn-thread-panel__path wpn-thread-panel__path--editing">
              <span className="wpn-thread-panel__path-label">PATH: </span>
              <textarea
                ref={fitTitleInputHeight}
                data-wpn-title-edit=""
                className="wpn-thread-panel__path-input"
                rows={1}
                value={pathValue}
                placeholder="Page > Section"
                onChange={(event) => {
                  setPathValue(event.target.value);
                  fitTitleInputHeight(event.target);
                }}
                onBlur={commitOnBlurOutside}
                onKeyDown={onEditKeyDown}
              />
            </label>
          ) : annotation.path ? (
            <div className="wpn-thread-panel__path" title={annotation.path}>
              <span className="wpn-thread-panel__path-label">PATH: </span>
              {annotation.path}
            </div>
          ) : null}
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
                  closeThread();
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
          onToggleContext={(commentId, value) =>
            setCommentAddToContext(annotation.id, commentId, value)
          }
          onDelete={setPendingDelete}
          onReply={setReplyTarget}
          onEditingChange={setHasUnsavedEdit}
        />
        <div className="wpn-panel__composer">
          <AnnotationAiActions
            annotation={annotation}
            onDraftReply={(text) =>
              setReplySeed((current) => ({ text, key: (current?.key ?? 0) + 1 }))
            }
          />
          <AnnotationReplyComposer
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            onDraftChange={setHasUnsentReply}
            onSubmit={sendReply}
            seed={replySeed}
            annotationId={annotation.id}
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
                options={THREAD_STATUS_OPTIONS}
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
