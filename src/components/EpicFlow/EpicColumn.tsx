import type { Epic } from "../../types/epicFlow.types";
import { formatTimestamp } from "../../utils/format";

interface EpicColumnProps {
  epics: Epic[];
  hasAnyEpics: boolean;
  selectedEpicId: string | null;
  storyCounts: Record<string, number>;
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
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: EpicColumnProps) {
  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">
          Epic
          <span className="wpn-epicflow-column__count">{epics.length}</span>
        </span>
        <button
          type="button"
          className="wpn-epicflow-column__add"
          aria-label="Create epic"
          onClick={onCreate}
        >
          <svg viewBox="0 0 24 24" className="wpn-epicflow-column__add-icon" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M12 5v14M5 12h14"
            />
          </svg>
        </button>
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
              className={[
                "wpn-epicflow-card",
                selectedEpicId === epic.id ? "wpn-epicflow-card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="wpn-epicflow-card__surface"
                aria-pressed={selectedEpicId === epic.id}
                onClick={() => onSelect(epic.id)}
              >
                <span className="wpn-epicflow-card__title">{epic.title}</span>
              </button>
              <div className="wpn-epicflow-card__footer">
                <span className="wpn-epicflow-card__meta">
                  By {epic.createdByUser} · {formatTimestamp(epic.createdAt)} ·{" "}
                  {storyCounts[epic.id] ?? 0} user {(storyCounts[epic.id] ?? 0) === 1 ? "story" : "stories"}
                </span>
                <div className="wpn-epicflow-card__actions">
                  <button
                    type="button"
                    className="wpn-epicflow-card__action-btn"
                    aria-label="Edit epic"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(epic);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="wpn-epicflow-card__action-btn wpn-epicflow-card__action-btn--danger"
                    aria-label="Delete epic"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(epic);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
