import type { UserStory, UserStoryStatus } from "../../types/epicFlow.types";
import { Tooltip } from "../primitives";

const STATUS_LABEL: Record<UserStoryStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

interface UserStoryColumnProps {
  stories: UserStory[];
  epicSelected: boolean;
  onCreate: () => void;
}

export function UserStoryColumn({ stories, epicSelected, onCreate }: UserStoryColumnProps) {
  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">
          User Stories
          <span className="wpn-epicflow-column__count">{stories.length}</span>
        </span>
        <Tooltip label="Create user story" placement="left">
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
        </Tooltip>
      </div>
      <div className="wpn-epicflow-column__body">
        {!epicSelected ? (
          <p className="wpn-epicflow-empty">Select an Epic to view User Stories</p>
        ) : stories.length === 0 ? (
          <p className="wpn-epicflow-empty">No user stories match your search.</p>
        ) : (
          stories.map((story) => (
            <article key={story.id} className="wpn-epicflow-card wpn-epicflow-card--static">
              <span className="wpn-epicflow-card__title">{story.title}</span>
              {story.description ? (
                <span className="wpn-epicflow-card__desc">{story.description}</span>
              ) : null}
              <span className="wpn-epicflow-card__meta-row">
                <span className={`wpn-epicflow-status wpn-epicflow-status--${story.status}`}>
                  {STATUS_LABEL[story.status]}
                </span>
                {story.assignee ? (
                  <span className="wpn-epicflow-card__assignee">{story.assignee}</span>
                ) : null}
              </span>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
