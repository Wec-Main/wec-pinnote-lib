import { splitMentions } from "../../utils/mentions";

interface CommentMessageProps {
  message: string;
  currentUserId: string;
}

export function CommentMessage({ message, currentUserId }: CommentMessageProps) {
  return (
    <>
      {splitMentions(message).map((segment, index) =>
        segment.kind === "text" ? (
          segment.value
        ) : (
          <span
            key={index}
            className={
              segment.userId === currentUserId
                ? "wpn-mention-chip wpn-mention-chip--self"
                : "wpn-mention-chip"
            }
          >
            @{segment.name}
          </span>
        ),
      )}
    </>
  );
}
