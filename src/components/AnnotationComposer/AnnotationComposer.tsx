import { useRef, useState, type FormEvent } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import type { AnnotationStatus, DraftAnnotation } from "../../types/annotation.types";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";
import { Icons } from "../../assets/icons";
import { Tooltip } from "../primitives";

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
  const { requestCancelDraft, updateDraftLabel, updateDraftMessage } = useAnnotationUi();
  const { submitDraft } = useAnnotationData();
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(true, x, y, panelRef);
  const [message, setMessage] = useState(draft.message);
  const [status, setStatus] = useState<AnnotationStatus>("open");
  const [submitting, setSubmitting] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState("");

  const changeMessage = (next: string) => {
    setMessage(next);
    updateDraftMessage(next);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await submitDraft(trimmed, status);
    } catch {
      setSubmitting(false);
    }
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
      style={{ left: placement.left, top: placement.top }}
    >
      <div className="wpn-panel__header">
        <span className="wpn-panel__title-group">
          {editingLabel ? (
            <input
              className="wpn-panel__title-input"
              value={labelValue}
              onChange={(event) => setLabelValue(event.target.value)}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitLabel();
                } else if (event.key === "Escape") {
                  setEditingLabel(false);
                }
              }}
              autoFocus
            />
          ) : (
            <span className="wpn-panel__title">{draft.label}</span>
          )}
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
            onClick={requestCancelDraft}
          >
            ×
          </button>
        </Tooltip>
      </div>
      <form onSubmit={onSubmit}>
        <textarea
          className="wpn-input"
          value={message}
          onChange={(event) => changeMessage(event.target.value)}
          placeholder="Add your comment..."
          aria-label="Comment"
          rows={3}
          autoFocus
        />
        <div className="wpn-panel__composer">
          <div className="wpn-panel__toolbar">
            <div className="wpn-thread-panel__brand">
              <span>Powered by</span>
              <img src={Icons.wecLogo} alt="" />
              <span className="wpn-thread-panel__brand-name">Wec.ai</span>
            </div>
            <AnnotationStatusSelect value={status} onChange={setStatus} disabled={submitting} />
            <div className="wpn-panel__actions">
              <button type="button" className="wpn-btn wpn-btn--ghost" onClick={requestCancelDraft}>
                Cancel
              </button>
              <button
                type="submit"
                className="wpn-btn wpn-btn--primary"
                disabled={!message.trim() || submitting}
              >
                Add comment
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
