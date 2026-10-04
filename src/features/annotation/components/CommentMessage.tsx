import { useContext } from "react";
import { AnnotationUiContext } from "../../../context/AnnotationContext";
import { REFERENCE_KIND_LABELS, splitMentions, type ReferenceKind } from "../../../utils/mentions";
import { Icon } from "../../../components/primitives/Icon";

interface CommentMessageProps {
  message: string;
  currentUserId: string;
  interactive?: boolean;
}

export function ReferenceIcon({ kind }: { kind: ReferenceKind }) {
  return (
    <span className={`wpn-ref-icon wpn-ref-icon--${kind}`} aria-hidden="true">
      <Icon name={kind} />
    </span>
  );
}

interface ReferenceChipProps {
  kind: ReferenceKind;
  id: string;
  name: string;
  interactive?: boolean;
}

export function ReferenceChip({ kind, id, name, interactive = true }: ReferenceChipProps) {
  const ui = useContext(AnnotationUiContext);
  const label = REFERENCE_KIND_LABELS[kind];
  const content = (
    <>
      <Icon name={kind} className="wpn-ref-chip__icon" />
      <span className="wpn-ref-chip__type">{label}</span>
      <span className="wpn-ref-chip__name">{name}</span>
    </>
  );
  if (!interactive || !ui) {
    return (
      <span className={`wpn-ref-chip wpn-ref-chip--${kind}`} title={`${label}: ${name}`}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`wpn-ref-chip wpn-ref-chip--${kind} wpn-ref-chip--link`}
      title={`Open ${label.toLowerCase()} “${name}”`}
      onClick={(event) => {
        event.stopPropagation();
        ui.openReference({ kind, id });
      }}
    >
      {content}
    </button>
  );
}

export function CommentMessage({ message, currentUserId, interactive }: CommentMessageProps) {
  return (
    <>
      {splitMentions(message).map((segment, index) => {
        if (segment.kind === "text") {
          return segment.value;
        }
        if (segment.kind === "reference") {
          return (
            <ReferenceChip
              key={index}
              kind={segment.refKind}
              id={segment.refId}
              name={segment.name}
              interactive={interactive}
            />
          );
        }
        return (
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
        );
      })}
    </>
  );
}
