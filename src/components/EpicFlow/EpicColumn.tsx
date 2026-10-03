import { useState, type CSSProperties } from "react";
import { Icon, Tooltip } from "../primitives";
import { EPICFLOW_PAGE_SIZE, ShowMoreButton } from "./ShowMoreButton";
import { useIncrementalList } from "../../hooks/useIncrementalList";
import type { Epic } from "../../types/epicFlow.types";
import type { AnnotationUser } from "../../types/annotation.types";
import { canDeleteBoardItem } from "../../utils/boardPermissions";

const TITLE_CLAMP_LINES = 2;
const TITLE_CHAR_THRESHOLD = 80;

interface EpicColumnProps {
  epics: Epic[];
  hasAnyEpics: boolean;
  selectedEpicId: string | null;
  currentUser: AnnotationUser;
  onSelect: (epicId: string) => void;
  onCreate: () => void;
  onExport: (epic: Epic) => void;
  onEdit: (epic: Epic) => void;
  onDelete: (epic: Epic) => void;
}

export function EpicColumn({
  epics,
  hasAnyEpics,
  selectedEpicId,
  currentUser,
  onSelect,
  onCreate,
  onExport,
  onEdit,
  onDelete,
}: EpicColumnProps) {
  const { visible, remaining, showMore } = useIncrementalList(
    epics,
    EPICFLOW_PAGE_SIZE,
    epics.findIndex((epic) => epic.id === selectedEpicId),
  );
  const [expandedTitleId, setExpandedTitleId] = useState<string | null>(null);

  const toggleTitle = (epicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTitleId((prev) => (prev === epicId ? null : epicId));
  };

  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header wpn-epicflow-column__header--epic">
        <span className="wpn-epicflow-column__title">
          <span className="wpn-epicflow-column__badge wpn-epicflow-column__badge--epic">
            <Icon name="epic" />
          </span>
          Epic
          <span className="wpn-epicflow-column__count">{epics.length}</span>
        </span>
        <Tooltip label="Create epic" placement="bottom">
          <button
            type="button"
            className="wpn-epicflow-column__add"
            aria-label="Create epic"
            onClick={onCreate}
          >
            <Icon name="plus" className="wpn-epicflow-column__add-icon" />
          </button>
        </Tooltip>
      </div>
      <div className="wpn-epicflow-column__body">
        {epics.length === 0 ? (
          <p className="wpn-epicflow-empty">
            {hasAnyEpics ? "No epics match your search." : "No Epics available"}
          </p>
        ) : (
          <>
            {visible.map((epic) => {
              const isExpanded = expandedTitleId === epic.id;
              const isLong = epic.title.length > TITLE_CHAR_THRESHOLD;
              return (
                <div
                  key={epic.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedEpicId === epic.id}
                  className={[
                    "wpn-epicflow-card",
                    selectedEpicId === epic.id ? "wpn-epicflow-card--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelect(epic.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(epic.id);
                    }
                  }}
                >
                  <div className="wpn-epicflow-card__row">
                    <div className="wpn-epicflow-card__title-wrap">
                      <span
                        className="wpn-epicflow-card__title"
                        style={
                          !isExpanded && isLong
                            ? ({ "--title-clamp": TITLE_CLAMP_LINES } as CSSProperties)
                            : undefined
                        }
                      >
                        {epic.title}
                      </span>
                      {isLong && (
                        <button
                          type="button"
                          className="wpn-comments-list-table__toggle"
                          onClick={(e) => toggleTitle(epic.id, e)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                    <div className="wpn-epicflow-card__actions">
                      <Tooltip label="Export epic" placement="bottom">
                        <button
                          type="button"
                          className="wpn-epicflow-card__action-btn"
                          aria-label="Export epic as JSON"
                          title="Export epic as JSON"
                          onClick={(event) => {
                            event.stopPropagation();
                            onExport(epic);
                          }}
                        >
                          <Icon name="download" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Edit epic" placement="bottom">
                        <button
                          type="button"
                          className="wpn-epicflow-card__action-btn"
                          aria-label="Edit epic"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(epic);
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                      </Tooltip>
                      {canDeleteBoardItem(epic.createdById, currentUser) ? (
                        <Tooltip label="Delete epic" placement="bottom">
                          <button
                            type="button"
                            className="wpn-epicflow-card__action-btn wpn-epicflow-card__action-btn--danger"
                            aria-label="Delete epic"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(epic);
                            }}
                          >
                            <Icon name="trash" />
                          </button>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <ShowMoreButton remaining={remaining} onClick={showMore} />
          </>
        )}
      </div>
    </div>
  );
}
