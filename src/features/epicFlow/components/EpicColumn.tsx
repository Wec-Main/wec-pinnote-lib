import { useCallback, useMemo } from "react";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { EPICFLOW_PAGE_SIZE, ShowMoreButton } from "./ShowMoreButton";
import { BoardCard, type BoardCardAction } from "./BoardCard";
import { useIncrementalList } from "../../../hooks/useIncrementalList";
import type { Epic } from "../../../types/epicFlow.types";
import type { AnnotationUser } from "../../../types/annotation.types";
import { canDeleteBoardItem } from "../../../utils/epicFlow/boardPermissions";

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

  const epicById = useMemo(() => new Map(epics.map((epic) => [epic.id, epic])), [epics]);

  const handleExport = useCallback(
    (id: string) => {
      const epic = epicById.get(id);
      if (epic) {
        onExport(epic);
      }
    },
    [epicById, onExport],
  );

  const handleEdit = useCallback(
    (id: string) => {
      const epic = epicById.get(id);
      if (epic) {
        onEdit(epic);
      }
    },
    [epicById, onEdit],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const epic = epicById.get(id);
      if (epic) {
        onDelete(epic);
      }
    },
    [epicById, onDelete],
  );

  const actionsFor = useCallback(
    (epic: Epic): BoardCardAction[] => {
      const actions: BoardCardAction[] = [
        {
          key: "export",
          icon: "download",
          label: "Export epic as JSON",
          title: "Export epic as JSON",
          onClick: handleExport,
        },
        {
          key: "edit",
          icon: "edit",
          label: "Edit epic",
          onClick: handleEdit,
        },
      ];
      if (canDeleteBoardItem(epic.createdById, currentUser)) {
        actions.push({
          key: "delete",
          icon: "trash",
          label: "Delete epic",
          danger: true,
          onClick: handleDelete,
        });
      }
      return actions;
    },
    [currentUser, handleDelete, handleEdit, handleExport],
  );

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
            {visible.map((epic) => (
              <BoardCard
                key={epic.id}
                id={epic.id}
                title={epic.title}
                selected={selectedEpicId === epic.id}
                onSelect={onSelect}
                actions={actionsFor(epic)}
              />
            ))}
            <ShowMoreButton remaining={remaining} onClick={showMore} />
          </>
        )}
      </div>
    </div>
  );
}
