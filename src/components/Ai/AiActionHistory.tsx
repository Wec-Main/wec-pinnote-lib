import type { AiMessage } from "../../types/ai.types";
import { formatAgo } from "./aiHelpers";
import { AiMarkdown } from "./AiMarkdown";

function MessageBody({ message }: { message: AiMessage }) {
  const { content } = message;
  if (content.type === "text") {
    return message.role === "user" ? (
      <p className="wpn-ai-history__text">{content.text}</p>
    ) : (
      <AiMarkdown text={content.text} />
    );
  }
  if (content.type === "op_batch") {
    return <p className="wpn-ai-muted">Proposed changes to this document.</p>;
  }
  if (content.type === "comment_draft") {
    return <p className="wpn-ai-muted">Drafted a reply.</p>;
  }
  if (content.type === "notice") {
    return <p className="wpn-ai-card__warn">{content.text}</p>;
  }
  return null;
}

export function AiActionHistory({
  messages,
  className,
}: {
  messages: readonly AiMessage[];
  className?: string;
}) {
  if (messages.length === 0) return null;
  return (
    <ol
      className={["wpn-ai-history", className].filter(Boolean).join(" ")}
      aria-label="Earlier AI activity"
    >
      {messages.map((message) => (
        <li
          key={message.aiMessageId}
          className={`wpn-ai-history__item wpn-ai-history__item--${message.role}`}
        >
          <span className="wpn-ai-history__meta">
            {message.role === "user" ? (message.authorName ?? "You") : "AI"} ·{" "}
            {formatAgo(message.createdAt)}
          </span>
          <MessageBody message={message} />
        </li>
      ))}
    </ol>
  );
}
