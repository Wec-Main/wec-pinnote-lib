import { Icon, Tooltip } from "../primitives";
import { AuthorBadge } from "./AuthorBadge";
import type { Epic } from "../../types/epicFlow.types";
import type { AnnotationUser } from "../../types/annotation.types";
import { formatTimestamp } from "../../utils/format";
import { canDeleteBoardItem } from "../../utils/boardPermissions";

interface EpicColumnProps {
  epics: Epic[];
  hasAnyEpics: boolean;
  selectedEpicId: string | null;
  storyCounts: Record<string, number>;
  currentUser: AnnotationUser;
  onSelect: (epicId: string) => void;
  onCreate: () => void;
  onEdit: (epic: Epic) => void;
  onDelete: (epic: Epic) => void;
}

export function EpicColumn({
  epics,
  hasAnyEpics,
  selectedEpicId,
  storyCounts,
  currentUser,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: EpicColumnProps) {
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
          epics.map((epic) => (
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
              <span className="wpn-epicflow-card__title">{epic.title}</span>
              <div className="wpn-epicflow-card__footer">
                <div className="wpn-epicflow-card__meta">
                  <AuthorBadge name={epic.createdByUser} />
                  <span
                    className="wpn-epicflow-card__stat"
                    title={`Created ${formatTimestamp(epic.createdAt)}`}
                  >
                    <Icon name="calendar" className="wpn-epicflow-card__stat-icon" />
                    {formatTimestamp(epic.createdAt)}
                  </span>
                  <span
                    className="wpn-epicflow-card__stat"
                    title={`${storyCounts[epic.id] ?? 0} user ${
                      (storyCounts[epic.id] ?? 0) === 1 ? "story" : "stories"
                    }`}
                  >
                    <Icon name="users" className="wpn-epicflow-card__stat-icon" />
                    {storyCounts[epic.id] ?? 0} user{" "}
                    {(storyCounts[epic.id] ?? 0) === 1 ? "story" : "stories"}
                  </span>
                </div>
                <div className="wpn-epicflow-card__actions">
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
          ))
        )}
      </div>
    </div>
  );
}
