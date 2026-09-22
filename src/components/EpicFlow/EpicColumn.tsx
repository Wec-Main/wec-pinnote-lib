import type { Epic } from "../../types/epicFlow.types";
import { Tooltip } from "../primitives";

interface EpicColumnProps {
  epics: Epic[];
  selectedEpicId: string | null;
  storyCounts: Record<string, number>;
  onSelect: (epicId: string) => void;
  onCreate: () => void;
}

export function EpicColumn({ epics, selectedEpicId, storyCounts, onSelect, onCreate }: EpicColumnProps) {
  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">
          Epic
          <span className="wpn-epicflow-column__count">{epics.length}</span>
        </span>
        <Tooltip label="Create epic" placement="left">
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
        </Tooltip>
      </div>
      <div className="wpn-epicflow-column__body">
        {epics.length === 0 ? (
          <p className="wpn-epicflow-empty">No epics match your search.</p>
        ) : (
          epics.map((epic) => (
            <button
              key={epic.id}
              type="button"
              className={[
                "wpn-epicflow-card",
                selectedEpicId === epic.id ? "wpn-epicflow-card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={selectedEpicId === epic.id}
              onClick={() => onSelect(epic.id)}
            >
              <span className="wpn-epicflow-card__title">{epic.title}</span>
              <span className="wpn-epicflow-card__desc">{epic.description}</span>
              <span className="wpn-epicflow-card__meta">
                {storyCounts[epic.id] ?? 0} user {(storyCounts[epic.id] ?? 0) === 1 ? "story" : "stories"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
