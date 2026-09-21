import { useRef, useState, type FormEvent } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { useFloatingPanel } from "../../hooks/useAnnotationPosition";
import type { AnnotationStatus } from "../../types/annotation.types";
import { AnnotationStatusSelect } from "../AnnotationStatusSelect";

interface AnnotationComposerProps {
  x: number;
  y: number;
}

export function AnnotationComposer({ x, y }: AnnotationComposerProps) {
  const { draft, cancelDraft, submitDraft } = useAnnotationContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const placement = useFloatingPanel(Boolean(draft), x, y, panelRef);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<AnnotationStatus>("open");
  const [submitting, setSubmitting] = useState(false);

  if (!draft) {
    return null;
  }

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

  return (
    <div
      ref={panelRef}
      className="wpn-panel wpn-composer"
      style={{ left: placement.left, top: placement.top }}
    >
      <div className="wpn-panel__header">
        <span className="wpn-panel__title">{draft.label}</span>
        <button
          type="button"
          className="wpn-icon-btn"
          aria-label="Cancel comment"
          onClick={cancelDraft}
        >
          ×
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <textarea
          className="wpn-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Add your comment..."
          rows={3}
          autoFocus
        />
        <div className="wpn-panel__composer">
          <AnnotationStatusSelect value={status} onChange={setStatus} disabled={submitting} />
          <div className="wpn-panel__actions">
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={cancelDraft}>
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
      </form>
    </div>
  );
}
