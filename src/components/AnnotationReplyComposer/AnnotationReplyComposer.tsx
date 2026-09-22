import { useState, type FormEvent } from "react";
import { Tooltip } from "../primitives";

interface AnnotationReplyComposerProps {
  onSubmit: (message: string) => Promise<void>;
}

export function AnnotationReplyComposer({ onSubmit }: AnnotationReplyComposerProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="wpn-reply" onSubmit={handleSubmit}>
      <textarea
        className="wpn-reply__field"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Reply"
        rows={1}
      />
      <Tooltip label="Send reply" placement="top">
        <button
          type="submit"
          className="wpn-reply__send"
          aria-label="Send reply"
          disabled={!message.trim() || submitting}
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
    </form>
  );
}
