import { useEffect, useRef, useState, type FormEvent } from "react";
import { COMMENT_MAX_LENGTH, type AnnotationComment } from "../../types/annotation.types";
import { useMentionCandidates } from "../../hooks/useMentionCandidates";
import { useReferenceCandidates } from "../../hooks/useReferenceCandidates";
import { encodeMentions } from "../../utils/mentions";
import { CommentQuote } from "../CommentQuote";
import { ComposerHint } from "../ComposerHint";
import { MentionTextarea, type MentionTextareaHandle } from "../MentionTextarea";
import { AddToContextCheckbox } from "../AddToContextCheckbox";
import { Tooltip } from "../primitives";
import { AiImproveButton } from "../Ai/AiImproveButton";

interface AnnotationReplyComposerProps {
  onSubmit: (message: string, addToContext: boolean) => Promise<void>;
  replyTarget: AnnotationComment | null;
  onCancelReply: () => void;
  onDraftChange?: (hasDraft: boolean) => void;
  seed?: { text: string; key: number } | null;
  annotationId?: string;
}

export function AnnotationReplyComposer({
  onSubmit,
  replyTarget,
  onCancelReply,
  onDraftChange,
  seed,
  annotationId,
}: AnnotationReplyComposerProps) {
  const [message, setMessage] = useState("");
  const [pendingSeed, setPendingSeed] = useState<string | null>(null);
  const messageRef = useRef(message);
  messageRef.current = message;
  const [addToContext, setAddToContext] = useState(false);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const fieldRef = useRef<MentionTextareaHandle>(null);
  const candidates = useMentionCandidates();
  const references = useReferenceCandidates();

  useEffect(() => {
    if (replyTarget) {
      fieldRef.current?.focus();
    }
  }, [replyTarget]);

  const seedKey = seed?.key;
  const seedText = seed?.text;
  useEffect(() => {
    if (seedKey === undefined || seedText === undefined) {
      return;
    }
    if (messageRef.current.trim()) {
      setPendingSeed(seedText);
      return;
    }
    setPendingSeed(null);
    setMessage(seedText);
    fieldRef.current?.focus();
  }, [seedKey, seedText]);

  const resolveSeed = (choice: "replace" | "append" | "dismiss") => {
    const text = pendingSeed;
    setPendingSeed(null);
    if (text === null || choice === "dismiss") return;
    setMessage((current) =>
      choice === "replace" || !current.trim() ? text : `${current.replace(/\s+$/, "")}\n\n${text}`,
    );
    fieldRef.current?.focus();
  };

  useEffect(() => {
    onDraftChange?.(message.trim().length > 0);
    return () => onDraftChange?.(false);
  }, [message, onDraftChange]);

  const send = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }
    setSending(true);
    setMessage("");
    const flagged = addToContext;
    setAddToContext(false);
    fieldRef.current?.focus();
    try {
      await onSubmit(encodeMentions(trimmed, candidates, references.references), flagged);
    } catch {
      setMessage((current) => (current.trim() ? `${trimmed}\n${current}` : trimmed));
      setAddToContext((current) => current || flagged);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <div className={focused ? "wpn-reply-box wpn-reply-box--focused" : "wpn-reply-box"}>
      {replyTarget ? (
        <div className="wpn-reply-box__target">
          <CommentQuote comment={replyTarget} />
          <Tooltip label="Cancel reply" placement="top">
            <button
              type="button"
              className="wpn-reply-box__cancel"
              aria-label="Cancel reply"
              onClick={onCancelReply}
            >
              ×
            </button>
          </Tooltip>
        </div>
      ) : null}
      {pendingSeed !== null ? (
        <div className="wpn-reply-box__seed" role="group" aria-label="AI drafted a reply">
          <span className="wpn-reply-box__seed-text">
            AI drafted a reply. You already typed something.
          </span>
          <button
            type="button"
            className="wpn-link wpn-link--chip"
            onClick={() => resolveSeed("replace")}
          >
            Replace
          </button>
          <button
            type="button"
            className="wpn-link wpn-link--chip"
            onClick={() => resolveSeed("append")}
          >
            Append
          </button>
          <button
            type="button"
            className="wpn-link wpn-link--chip"
            onClick={() => resolveSeed("dismiss")}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <form className="wpn-reply" onSubmit={handleSubmit}>
        <MentionTextarea
          ref={fieldRef}
          className="wpn-reply__field"
          value={message}
          onChange={setMessage}
          candidates={candidates}
          references={references.references}
          referencesLoading={references.loading}
          onReferenceTrigger={references.request}
          placeholder={replyTarget ? `Reply to ${replyTarget.createdBy.name}` : "Reply"}
          ariaLabel="Reply"
          maxLength={COMMENT_MAX_LENGTH}
          onEnter={() => void send()}
          onEscape={replyTarget ? onCancelReply : undefined}
          onFocusChange={setFocused}
        />
        <div className="wpn-reply__tools">
          <Tooltip label="Mention someone" placement="top">
            <button
              type="button"
              className="wpn-reply__tool"
              aria-label="Mention someone"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fieldRef.current?.startMention()}
            >
              @
            </button>
          </Tooltip>
          <Tooltip label="Tag an epic, flow or data model" placement="top">
            <button
              type="button"
              className="wpn-reply__tool"
              aria-label="Tag an epic, flow or data model"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fieldRef.current?.startReference()}
            >
              #
            </button>
          </Tooltip>
          {annotationId ? (
            <AiImproveButton
              annotationId={annotationId}
              draft={message}
              disabled={sending}
              onImproved={(text) => {
                setMessage(text);
                fieldRef.current?.focus();
              }}
            />
          ) : null}
          <Tooltip label="Send reply" placement="top">
            <button
              type="submit"
              className="wpn-reply__send"
              aria-label="Send reply"
              disabled={!message.trim() || sending}
            >
              <svg viewBox="0 0 20 20" className="wpn-reply__arrow" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M10 14.5V5.5M6.2 8.8 10 5l3.8 3.8"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      </form>
      <div className="wpn-composer-context-row">
        <AddToContextCheckbox
          checked={addToContext}
          onChange={setAddToContext}
          disabled={sending}
        />
        {focused || message ? <ComposerHint length={message.length} /> : null}
      </div>
    </div>
  );
}
