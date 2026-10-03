import { useMemo, useRef, useState, type FormEvent } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import {
  COMMENT_MAX_LENGTH,
  type AnnotationStatus,
  type DraftAnnotation,
} from "../../types/annotation.types";
import { useMentionCandidates } from "../../hooks/useMentionCandidates";
import { useReferenceCandidates } from "../../hooks/useReferenceCandidates";
import { encodeMentions, referencesInMessage } from "../../utils/mentions";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { ComposerHint, ComposerHintInfo } from "../ComposerHint";
import { AddToContextCheckbox } from "../AddToContextCheckbox";
import { MentionTextarea } from "../MentionTextarea";
import { ReferenceChip } from "../CommentMessage";
import { Icons } from "../../assets/icons";
import { Tooltip } from "../primitives";
import { fitTitleInputHeight, focusTitleInputAtEnd } from "../../utils/titleInput";

const DEFAULT_COMPOSER_WIDTH = 460;
const MIN_COMPOSER_WIDTH = 320;
const MAX_COMPOSER_WIDTH_MARGIN = 32;

interface AnnotationComposerProps {
  x: number;
  y: number;
}

interface DraftComposerProps extends AnnotationComposerProps {
  draft: DraftAnnotation;
}

export function AnnotationComposer({ x, y }: AnnotationComposerProps) {
  const { draft } = useAnnotationUi();
  if (!draft) {
    return null;
  }
  return <DraftComposer key={draft.id} draft={draft} x={x} y={y} />;
}

function DraftComposer({ draft, x, y }: DraftComposerProps) {
  const { requestCancelDraft, updateDraftLabel, updateDraftPath, updateDraftMessage } =
    useAnnotationUi();
  const { submitDraft } = useAnnotationData();
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(true, x, y, panelRef);
  const [message, setMessage] = useState(draft.message);
  const [status, setStatus] = useState<AnnotationStatus>("open");
  const [addToContext, setAddToContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const startDrag = usePointerDrag();
  const candidates = useMentionCandidates();
  const references = useReferenceCandidates();
  const linked = useMemo(
    () => referencesInMessage(encodeMentions(message, [], references.references)),
    [message, references.references],
  );

  const startWidthDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const startWidth = panelRef.current?.offsetWidth ?? DEFAULT_COMPOSER_WIDTH;
    const maxWidth = window.innerWidth - MAX_COMPOSER_WIDTH_MARGIN;
    startDrag(event, {
      onMove: (_ev, delta) => {
        setWidth(Math.min(maxWidth, Math.max(MIN_COMPOSER_WIDTH, startWidth + delta.x)));
      },
    });
  };

  const changeMessage = (next: string) => {
    setMessage(next);
    updateDraftMessage(next);
  };

  const send = async () => {
    const trimmed = message.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await submitDraft(
        encodeMentions(trimmed, candidates, references.references),
        status,
        addToContext,
      );
    } catch {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const startEditingLabel = () => {
    setLabelValue(draft.label);
    setEditingLabel(true);
  };

  const commitLabel = () => {
    updateDraftLabel(labelValue);
    setEditingLabel(false);
  };

  return (
    <div
      ref={panelRef}
      className="wpn-panel wpn-composer"
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        width: width ?? undefined,
        visibility: placement ? "visible" : "hidden",
      }}
    >
      <div className="wpn-composer__resize-e" role="presentation" onPointerDown={startWidthDrag} />
      <div className="wpn-panel__header">
        <span className="wpn-panel__title-group">
          {editingLabel ? (
            <textarea
              ref={focusTitleInputAtEnd}
              className="wpn-panel__title-input"
              rows={1}
              value={labelValue}
              onChange={(event) => {
                setLabelValue(event.target.value);
                fitTitleInputHeight(event.target);
              }}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitLabel();
                } else if (event.key === "Escape") {
                  setEditingLabel(false);
                }
              }}
            />
          ) : (
            <span className="wpn-panel__title">{draft.label}</span>
          )}
          <ComposerHintInfo />
          <button
            type="button"
            className="wpn-link wpn-link--icon"
            aria-label={editingLabel ? "Save name" : "Edit name"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={editingLabel ? commitLabel : startEditingLabel}
          >
            {editingLabel ? (
              <svg viewBox="0 0 24 24" className="wpn-action-icon" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M4.5 12.5 9.5 17.5 19.5 6.5"
                />
              </svg>
            ) : (
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
            )}
          </button>
        </span>
        <Tooltip label="Cancel" placement="top">
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label="Cancel comment"
            disabled={submitting}
            onClick={requestCancelDraft}
          >
            ×
          </button>
        </Tooltip>
      </div>
      <form
        onSubmit={onSubmit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="wpn-composer__path">
          <label className="wpn-composer__path-label" htmlFor="wpn-composer-path">
            Path
          </label>
          <input
            id="wpn-composer-path"
            type="text"
            className="wpn-input wpn-composer__path-value"
            value={draft.path}
            onChange={(event) => updateDraftPath(event.target.value)}
          />
        </div>
        <span className="wpn-composer__field-label">Comment</span>
        <MentionTextarea
          className="wpn-input wpn-composer__field"
          value={message}
          onChange={changeMessage}
          candidates={candidates}
          references={references.references}
          referencesLoading={references.loading}
          onReferenceTrigger={references.request}
          placeholder="Add your comment… @ to mention, # to tag an epic, flow or data model"
          ariaLabel="Comment"
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          autoFocus
          onEnter={() => void send()}
          onFocusChange={setFocused}
        />
        {linked.length > 0 ? (
          <div className="wpn-composer__linked" aria-label="Tagged items">
            <span className="wpn-composer__linked-label">Tagged</span>
            {linked.map((reference) => (
              <ReferenceChip
                key={`${reference.kind}:${reference.id}`}
                kind={reference.kind}
                id={reference.id}
                name={reference.name}
                interactive={false}
              />
            ))}
          </div>
        ) : null}
        <div className="wpn-composer-context-row">
          <AddToContextCheckbox
            className="wpn-context-check--composer"
            checked={addToContext}
            onChange={setAddToContext}
            disabled={submitting}
          />
          {focused || hovered ? <ComposerHint length={message.length} /> : null}
        </div>
        <div className="wpn-panel__composer">
          <div className="wpn-panel__toolbar">
            <div className="wpn-thread-panel__brand">
              <span>Powered by</span>
              <img src={Icons.wecLogo} alt="" />
              <span className="wpn-thread-panel__brand-name">Wec.ai</span>
            </div>
            <AnnotationStatusSelect value={status} onChange={setStatus} disabled={submitting} />
            <div className="wpn-panel__actions">
              <button
                type="button"
                className="wpn-btn wpn-btn--ghost"
                disabled={submitting}
                onClick={requestCancelDraft}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="wpn-btn wpn-btn--primary"
                disabled={!message.trim() || !draft.path.trim() || submitting}
                aria-busy={submitting || undefined}
              >
                {submitting ? "Saving…" : "Add comment"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
