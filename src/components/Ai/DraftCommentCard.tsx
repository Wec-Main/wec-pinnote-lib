import { useEffect, useRef, useState } from "react";
import type { AiCommentDraft } from "../../types/ai.types";
import { Icon, Spinner } from "../primitives";

interface DraftCommentCardProps {
  draft: AiCommentDraft;
  onPost: (draft: AiCommentDraft, message: string) => Promise<void>;
  onDiscard: (draft: AiCommentDraft) => Promise<void>;
  onOpenAnnotation?: (annotationId: string) => void;
}

export function DraftCommentCard({
  draft,
  onPost,
  onDiscard,
  onOpenAnnotation,
}: DraftCommentCardProps) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(draft.message);
  const [busy, setBusy] = useState<"post" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;

  useEffect(() => {
    if (!editingRef.current) setMessage(draft.message);
  }, [draft.message, draft.updatedAt]);

  const label = draft.annotationNumber !== null ? `#${draft.annotationNumber}` : "comment";
  const open = draft.status === "draft";

  const run = async (kind: "post" | "discard") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "post") await onPost(draft, message.trim());
      else await onDiscard(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className={`wpn-ai-card wpn-ai-draft wpn-ai-draft--${draft.status}`}>
      <header className="wpn-ai-card__head">
        <Icon name="reply" />
        <span className="wpn-ai-card__title">
          Draft reply to{" "}
          {onOpenAnnotation ? (
            <button
              type="button"
              className="wpn-ai-link"
              onClick={() => onOpenAnnotation(draft.annotationId)}
            >
              {label}
            </button>
          ) : (
            label
          )}
        </span>
        <span className={`wpn-ai-chip wpn-ai-chip--${draft.status}`}>
          {draft.status === "draft" ? "Draft" : draft.status === "posted" ? "Posted" : "Discarded"}
        </span>
      </header>
      {editing ? (
        <textarea
          className="wpn-ai-input wpn-ai-draft__editor"
          aria-label="Edit draft reply"
          value={message}
          rows={4}
          onChange={(event) => setMessage(event.target.value)}
        />
      ) : (
        <p className="wpn-ai-card__body wpn-ai-draft__message">{message}</p>
      )}
      {error ? (
        <p className="wpn-ai-card__warn" role="alert">
          {error}
        </p>
      ) : null}
      {open ? (
        <div className="wpn-ai-card__actions">
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={busy !== null || !message.trim()}
            onClick={() => void run("post")}
          >
            {busy === "post" ? <Spinner /> : null}
            Post
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={busy !== null}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={busy !== null}
            onClick={() => void run("discard")}
          >
            Discard
          </button>
        </div>
      ) : null}
    </article>
  );
}
