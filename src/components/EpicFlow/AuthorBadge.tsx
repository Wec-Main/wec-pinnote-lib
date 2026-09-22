import { Tooltip } from "../primitives";
import { getInitials } from "../../utils/format";

interface AuthorBadgeProps {
  name: string;
}

export function AuthorBadge({ name }: AuthorBadgeProps) {
  return (
    <Tooltip label={`Created by ${name}`} placement="bottom">
      <span className="wpn-epicflow-card__author">
        <span className="wpn-epicflow-card__avatar" aria-hidden="true">
          {getInitials(name)}
        </span>
        <span className="wpn-epicflow-card__author-name">{name}</span>
      </span>
    </Tooltip>
  );
}
