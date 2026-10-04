import { Tooltip } from "../../../components/primitives/Tooltip";
import { getInitials } from "../../../utils/format";

interface AuthorBadgeProps {
  name: string;
  tooltipLabel?: string;
}

export function AuthorBadge({ name, tooltipLabel }: AuthorBadgeProps) {
  return (
    <Tooltip label={tooltipLabel ?? `Created by ${name}`} placement="bottom">
      <span className="wpn-epicflow-card__author">
        <span className="wpn-epicflow-card__avatar" aria-hidden="true">
          {getInitials(name)}
        </span>
        <span className="wpn-epicflow-card__author-name">{name}</span>
      </span>
    </Tooltip>
  );
}
