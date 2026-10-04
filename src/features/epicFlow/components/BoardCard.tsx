import { memo, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";

const TITLE_CLAMP_LINES = 2;
const TITLE_CHAR_THRESHOLD = 80;

export interface BoardCardAction {
  key: string;
  icon: IconName;
  label: string;
  title?: string;
  danger?: boolean;
  onClick: (id: string) => void;
}

interface BoardCardProps {
  id: string;
  title: string;
  selected: boolean;
  onSelect: (id: string) => void;
  actions: BoardCardAction[];
}

function BoardCardComponent({ id, title, selected, onSelect, actions }: BoardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = title.length > TITLE_CHAR_THRESHOLD;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={["wpn-epicflow-card", selected ? "wpn-epicflow-card--selected" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}
    >
      <div className="wpn-epicflow-card__row">
        <div className="wpn-epicflow-card__title-wrap">
          <span
            className="wpn-epicflow-card__title"
            style={
              !expanded && isLong
                ? ({ "--title-clamp": TITLE_CLAMP_LINES } as CSSProperties)
                : undefined
            }
          >
            {title}
          </span>
          {isLong && (
            <button
              type="button"
              className="wpn-comments-list-table__toggle"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
        <div className="wpn-epicflow-card__actions">
          {actions.map((action) => (
            <Tooltip key={action.key} label={action.label} placement="bottom">
              <button
                type="button"
                className={[
                  "wpn-epicflow-card__action-btn",
                  action.danger ? "wpn-epicflow-card__action-btn--danger" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={action.label}
                title={action.title}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick(id);
                }}
              >
                <Icon name={action.icon} />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

export const BoardCard = memo(BoardCardComponent);
