import { useCallback, useMemo } from "react";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { EPICFLOW_PAGE_SIZE, ShowMoreButton } from "./ShowMoreButton";
import { BoardCard, type BoardCardAction } from "./BoardCard";
import { useIncrementalList } from "../../../hooks/useIncrementalList";
import type { UserStory } from "../../../types/epicFlow.types";
import type { AnnotationUser } from "../../../types/annotation.types";
import { canDeleteBoardItem } from "../../../utils/epicFlow/boardPermissions";

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

  const storyById = useMemo(() => new Map(stories.map((story) => [story.id, story])), [stories]);

  const handleEdit = useCallback(
    (id: string) => {
      const story = storyById.get(id);
      if (story) {
        onEdit(story);
      }
    },
    [storyById, onEdit],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const story = storyById.get(id);
      if (story) {
        onDelete(story);
      }
    },
    [storyById, onDelete],
  );

  const actionsFor = useCallback(
    (story: UserStory): BoardCardAction[] => {
      const actions: BoardCardAction[] = [
        {
          key: "edit",
          icon: "edit",
          label: "Edit user story",
          onClick: handleEdit,
        },
      ];
      if (canDeleteBoardItem(story.createdById, currentUser)) {
        actions.push({
          key: "delete",
          icon: "trash",
          label: "Delete user story",
          danger: true,
          onClick: handleDelete,
        });
      }
      return actions;
    },
    [currentUser, handleDelete, handleEdit],
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
              <BoardCard
                key={story.id}
                id={story.id}
                title={story.title}
                selected={selectedUserStoryId === story.id}
                onSelect={onSelect}
                actions={actionsFor(story)}
              />
            ))}
            <ShowMoreButton remaining={remaining} onClick={showMore} />
          </>
        )}
      </div>
    </div>
  );
}
