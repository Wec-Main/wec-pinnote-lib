import type { UserStory } from "../../types/epicFlow.types";
import { formatTimestamp } from "../../utils/format";

interface UserStoryColumnProps {
  stories: UserStory[];
  hasStoriesForEpic: boolean;
  epicSelected: boolean;
  selectedUserStoryId: string | null;
  onSelect: (storyId: string) => void;
  onCreate: () => void;
  onEdit: (story: UserStory) => void;
  onDelete: (story: UserStory) => void;
}

export function UserStoryColumn({
  stories,
  hasStoriesForEpic,
  epicSelected,
  selectedUserStoryId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: UserStoryColumnProps) {
  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">
          User Stories
          <span className="wpn-epicflow-column__count">{stories.length}</span>
        </span>
        <button
          type="button"
          className="wpn-epicflow-column__add"
          aria-label="Create user story"
          disabled={!epicSelected}
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
        {!epicSelected ? (
          <p className="wpn-epicflow-empty">Select an Epic to view User Stories</p>
        ) : stories.length === 0 ? (
          <p className="wpn-epicflow-empty">
            {hasStoriesForEpic ? "No user stories match your search." : "No User Stories available for this Epic"}
          </p>
        ) : (
          stories.map((story) => (
            <div
              key={story.id}
              className={[
                "wpn-epicflow-card",
                selectedUserStoryId === story.id ? "wpn-epicflow-card--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="wpn-epicflow-card__surface"
                aria-pressed={selectedUserStoryId === story.id}
                onClick={() => onSelect(story.id)}
              >
                <span className="wpn-epicflow-card__title">{story.title}</span>
              </button>
              <div className="wpn-epicflow-card__footer">
                <span className="wpn-epicflow-card__meta">
                  By {story.createdByUser} · {formatTimestamp(story.createdAt)}
                </span>
                <div className="wpn-epicflow-card__actions">
                  <button
                    type="button"
                    className="wpn-epicflow-card__action-btn"
                    aria-label="Edit user story"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(story);
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
                    aria-label="Delete user story"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(story);
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
