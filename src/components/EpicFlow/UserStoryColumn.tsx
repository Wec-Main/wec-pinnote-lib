import { useEffect, useState, type CSSProperties } from "react";
import { Icon, Tooltip } from "../primitives";
import { EPICFLOW_PAGE_SIZE, ShowMoreButton } from "./ShowMoreButton";
import { useIncrementalList } from "../../hooks/useIncrementalList";
import type { UserStory } from "../../types/epicFlow.types";
import type { AnnotationUser } from "../../types/annotation.types";
import { canDeleteBoardItem } from "../../utils/boardPermissions";

const TITLE_CLAMP_LINES = 2;
const TITLE_CHAR_THRESHOLD = 80;

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
  const [expandedTitleId, setExpandedTitleId] = useState<string | null>(null);

  const firstStoryId = stories[0]?.id ?? null;
  useEffect(() => {
    setExpandedTitleId(null);
  }, [firstStoryId]);

  const toggleTitle = (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTitleId((prev) => (prev === storyId ? null : storyId));
  };

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
            {visible.map((story) => {
              const isExpanded = expandedTitleId === story.id;
              const isLong = story.title.length > TITLE_CHAR_THRESHOLD;
              return (
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
                        {story.title}
                      </span>
                      {isLong && (
                        <button
                          type="button"
                          className="wpn-comments-list-table__toggle"
                          onClick={(e) => toggleTitle(story.id, e)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
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
              );
            })}
            <ShowMoreButton remaining={remaining} onClick={showMore} />
          </>
        )}
      </div>
    </div>
  );
}
