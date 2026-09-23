import { Icon, Tooltip } from "../primitives";
import { AuthorBadge } from "./AuthorBadge";
import { EPICFLOW_PAGE_SIZE, ShowMoreButton } from "./ShowMoreButton";
import { useIncrementalList } from "../../hooks/useIncrementalList";
import type { UserStory } from "../../types/epicFlow.types";
import type { AnnotationUser } from "../../types/annotation.types";
import { formatTimestamp } from "../../utils/format";
import { canDeleteBoardItem } from "../../utils/boardPermissions";

interface UserStoryColumnProps {
  stories: UserStory[];
  hasStoriesForEpic: boolean;
  epicSelected: boolean;
  selectedUserStoryId: string | null;
  currentUser: AnnotationUser;
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
  currentUser,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: UserStoryColumnProps) {
  const { visible, remaining, showMore } = useIncrementalList(
    stories,
    EPICFLOW_PAGE_SIZE,
    stories.findIndex((story) => story.id === selectedUserStoryId),
  );

  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header wpn-epicflow-column__header--story">
        <span className="wpn-epicflow-column__title">
          <span className="wpn-epicflow-column__badge wpn-epicflow-column__badge--story">
            <Icon name="users" />
          </span>
          User Stories
          <span className="wpn-epicflow-column__count">{stories.length}</span>
        </span>
        <Tooltip label="Create user story" placement="bottom">
          <button
            type="button"
            className="wpn-epicflow-column__add"
            aria-label="Create user story"
            disabled={!epicSelected}
            onClick={onCreate}
          >
            <Icon name="plus" className="wpn-epicflow-column__add-icon" />
          </button>
        </Tooltip>
      </div>
      <div className="wpn-epicflow-column__body">
        {!epicSelected ? (
          <p className="wpn-epicflow-empty">Select an Epic to view User Stories</p>
        ) : stories.length === 0 ? (
          <p className="wpn-epicflow-empty">
            {hasStoriesForEpic
              ? "No user stories match your search."
              : "No User Stories available for this Epic"}
          </p>
        ) : (
          <>
            {visible.map((story) => (
              <div
                key={story.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedUserStoryId === story.id}
                className={[
                  "wpn-epicflow-card",
                  selectedUserStoryId === story.id ? "wpn-epicflow-card--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelect(story.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(story.id);
                  }
                }}
              >
                <span className="wpn-epicflow-card__title">{story.title}</span>
                <div className="wpn-epicflow-card__footer">
                  <div className="wpn-epicflow-card__meta">
                    <AuthorBadge name={story.createdByUser} />
                    <span
                      className="wpn-epicflow-card__stat"
                      title={`Created ${formatTimestamp(story.createdAt)}`}
                    >
                      <Icon name="calendar" className="wpn-epicflow-card__stat-icon" />
                      {formatTimestamp(story.createdAt)}
                    </span>
                  </div>
                  <div className="wpn-epicflow-card__actions">
                    <Tooltip label="Edit user story" placement="bottom">
                      <button
                        type="button"
                        className="wpn-epicflow-card__action-btn"
                        aria-label="Edit user story"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(story);
                        }}
                      >
                        <Icon name="edit" />
                      </button>
                    </Tooltip>
                    {canDeleteBoardItem(story.createdById, currentUser) ? (
                      <Tooltip label="Delete user story" placement="bottom">
                        <button
                          type="button"
                          className="wpn-epicflow-card__action-btn wpn-epicflow-card__action-btn--danger"
                          aria-label="Delete user story"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(story);
                          }}
                        >
                          <Icon name="trash" />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            <ShowMoreButton remaining={remaining} onClick={showMore} />
          </>
        )}
      </div>
    </div>
  );
}
