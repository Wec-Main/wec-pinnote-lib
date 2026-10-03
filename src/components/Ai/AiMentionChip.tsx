import type { AiMention } from "../../types/ai.types";
import { getInitials } from "../../utils/format";
import { Icon } from "../primitives";
import { MENTION_ICONS } from "./useMentionPicker";

const OPEN_LABELS: Record<AiMention["kind"], string> = {
  flow: "Open flow",
  data_model: "Open data model",
  epic: "Open epic",
  user_story: "Open user story",
  annotation: "Open comment",
  user: "",
};

export function AiMentionChip({
  mention,
  onRemove,
  onOpen,
}: {
  mention: AiMention;
  onRemove?: () => void;
  onOpen?: (mention: AiMention) => void;
}) {
  const body = (
    <>
      {mention.kind === "user" ? (
        <span className="wpn-ai-mention__badge">{getInitials(mention.label)}</span>
      ) : (
        <Icon name={MENTION_ICONS[mention.kind]} className="wpn-ai-mention__icon" />
      )}
      <span className="wpn-ai-mention__label">
        {mention.kind === "user" ? `@${mention.label}` : mention.label}
      </span>
    </>
  );
  const openable = onOpen !== undefined && mention.kind !== "user";
  return (
    <span className={`wpn-ai-mention wpn-ai-mention--${mention.kind}`}>
      {openable ? (
        <button
          type="button"
          className="wpn-ai-mention__open"
          title={`${OPEN_LABELS[mention.kind]}: ${mention.label}`}
          aria-label={`${OPEN_LABELS[mention.kind]}: ${mention.label}`}
          onClick={() => onOpen(mention)}
        >
          {body}
        </button>
      ) : (
        body
      )}
      {onRemove ? (
        <button
          type="button"
          className="wpn-ai-mention__remove"
          aria-label={`Remove ${mention.label}`}
          onClick={onRemove}
        >
          <Icon name="x" />
        </button>
      ) : null}
    </span>
  );
}
