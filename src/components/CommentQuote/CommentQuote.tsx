import type { AnnotationComment } from "../../types/annotation.types";
import { formatRelativeTime } from "../../utils/format";
import { mentionsToPlainText } from "../../utils/mentions";

interface CommentQuoteProps {
  comment: AnnotationComment | undefined;
}

export function CommentQuote({ comment }: CommentQuoteProps) {
  if (!comment) {
    return (
      <span className="wpn-quote wpn-quote--missing">
        <span className="wpn-quote__message">Original message was deleted</span>
      </span>
    );
  }
  return (
    <span className="wpn-quote">
      <span className="wpn-quote__meta">
        <strong>{comment.createdBy.name}</strong>
        <time dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</time>
      </span>
      <span className="wpn-quote__message">{mentionsToPlainText(comment.message)}</span>
    </span>
  );
}
