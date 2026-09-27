import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  useAnnotationAuth,
  useAnnotationData,
  useAnnotationUi,
} from "../context/AnnotationContext";
import { useAnnotationPositions, type PositionedItem } from "../hooks/useAnnotationPosition";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationListPanel } from "./AnnotationListPanel";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { AnnotationPin } from "./AnnotationPin";
import { AnnotationThreadPanel } from "./AnnotationThreadPanel";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { TagPicker, TagPin } from "./TagPin";
import { FlowPinPanel, FlowPinPicker, FlowPinPin } from "./FlowPin";
import { ConfirmDialog } from "./UserManagement/ConfirmDialog";
import { canDeleteBoardItem } from "../utils/boardPermissions";
import type { AnnotationTag, UpdateAnnotationTagInput } from "../types/annotationTag.types";

const EpicFlowPanel = lazy(() =>
  import("./EpicFlow").then((module) => ({ default: module.EpicFlowPanel })),
);
const WecFlowPanel = lazy(() =>
  import("./WecFlow").then((module) => ({ default: module.WecFlowPanel })),
);
const SettingsPanel = lazy(() =>
  import("./Settings").then((module) => ({ default: module.SettingsPanel })),
);

function positionItemsKey(items: PositionedItem[]): string {
  return items.map((item) => `${item.id}:${item.anchor.selector}`).join("|");
}

interface TagPinListItemProps {
  id: string;
  tagId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  resolvedTarget: boolean;
  canEdit: boolean;
  onRemove?: (id: string) => void;
  onGeometryChange: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number },
  ) => void;
  onGeometryCommit: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number },
  ) => void;
  onTagChange: (id: string, tag: { id: string; name: string; color: string }) => void;
}

const TagPinListItem = memo(function TagPinListItem({
  id,
  tagId,
  name,
  color,
  x,
  y,
  width,
  height,
  resolvedTarget,
  canEdit,
  onRemove,
  onGeometryChange,
  onGeometryCommit,
  onTagChange,
}: TagPinListItemProps) {
  return (
    <TagPin
      tagId={tagId}
      name={name}
      color={color}
      x={x}
      y={y}
      width={width}
      height={height}
      resolvedTarget={resolvedTarget}
      canEdit={canEdit}
      onRemove={onRemove ? () => onRemove(id) : undefined}
      onGeometryChange={(geometry) => onGeometryChange(id, geometry)}
      onGeometryCommit={(geometry) => onGeometryCommit(id, geometry)}
      onTagChange={(tag) => onTagChange(id, tag)}
    />
  );
});

interface FlowPinPinListItemProps {
  id: string;
  name: string;
  x: number;
  y: number;
  resolvedTarget: boolean;
  active: boolean;
  onSelect: (id: string) => void;
}

const FlowPinPinListItem = memo(function FlowPinPinListItem({
  id,
  name,
  x,
  y,
  resolvedTarget,
  active,
  onSelect,
}: FlowPinPinListItemProps) {
  return (
    <FlowPinPin
      name={name}
      x={x}
      y={y}
      resolvedTarget={resolvedTarget}
      active={active}
      onSelect={() => onSelect(id)}
    />
  );
});

export function AnnotationLayer() {
  const {
    annotations,
    config,
    annotationTags,
    removeAnnotationTag,
    applyAnnotationTagLocal,
    commitAnnotationTagUpdate,
    flowPins,
    actionError,
    clearActionError,
  } = useAnnotationData();
  const {
    modeEnabled,
    selectedId,
    selectAnnotation,
    draft,
    pinsVisible,
    tagsVisible,
    tagDraft,
    flowPinsVisible,
    flowPinDraft,
    selectedFlowPinId,
    selectFlowPin,
    removeFlowPin,
    listOpen,
    epicFlowOpen,
    flowOpen,
    userManagementOpen,
    discardPrompt,
    confirmDiscard,
    cancelDiscardPrompt,
  } = useAnnotationUi();
  const { authenticated } = useAnnotationAuth();
  const [layerError, setLayerError] = useState<string | null>(null);

  const [pendingTagRemoval, setPendingTagRemoval] = useState<AnnotationTag | null>(null);
  const [removingTag, setRemovingTag] = useState(false);

  const requestRemoveTag = useCallback(
    (id: string) => {
      setPendingTagRemoval(annotationTags.find((tag) => tag.id === id) ?? null);
    },
    [annotationTags],
  );

  const cancelRemoveTag = useCallback(() => setPendingTagRemoval(null), []);

  const confirmRemoveTag = useCallback(() => {
    if (!pendingTagRemoval) {
      return;
    }
    setLayerError(null);
    setRemovingTag(true);
    removeAnnotationTag(pendingTagRemoval.id)
      .catch((err: unknown) => {
        setLayerError(
          err instanceof Error && err.message ? err.message : "Could not remove that tag",
        );
      })
      .finally(() => {
        setRemovingTag(false);
        setPendingTagRemoval(null);
      });
  }, [pendingTagRemoval, removeAnnotationTag]);

  const handleRemoveFlowPin = useCallback(
    (id: string) => {
      setLayerError(null);
      removeFlowPin(id).catch((err: unknown) => {
        setLayerError(
          err instanceof Error && err.message ? err.message : "Could not delete this flow",
        );
      });
    },
    [removeFlowPin],
  );

  const handleSelectFlowPin = useCallback(
    (id: string) => {
      selectFlowPin(id);
    },
    [selectFlowPin],
  );

  const handleTagGeometryChange = useCallback(
    (id: string, geometry: { x: number; y: number; width: number; height: number }) => {
      applyAnnotationTagLocal(id, {
        fallbackX: geometry.x,
        fallbackY: geometry.y,
        width: geometry.width,
        height: geometry.height,
      });
    },
    [applyAnnotationTagLocal],
  );

  const handleTagGeometryCommit = useCallback(
    (id: string, geometry: { x: number; y: number; width: number; height: number }) => {
      const input: UpdateAnnotationTagInput = {
        fallbackX: geometry.x,
        fallbackY: geometry.y,
        width: geometry.width,
        height: geometry.height,
      };
      commitAnnotationTagUpdate(id, input).catch((err: unknown) => {
        setLayerError(
          err instanceof Error && err.message ? err.message : "Could not move this tag",
        );
      });
    },
    [commitAnnotationTagUpdate],
  );

  const handleTagReassign = useCallback(
    (id: string, tag: { id: string; name: string; color: string }) => {
      applyAnnotationTagLocal(id, { tagId: tag.id, tagName: tag.name, tagColor: tag.color });
      commitAnnotationTagUpdate(id, { tagId: tag.id }).catch((err: unknown) => {
        setLayerError(
          err instanceof Error && err.message ? err.message : "Could not update this tag",
        );
      });
    },
    [applyAnnotationTagLocal, commitAnnotationTagUpdate],
  );

  const interactionActive = Boolean(
    draft || tagDraft || flowPinDraft || selectedId || selectedFlowPinId,
  );

  const visible = useMemo(() => {
    if (!authenticated || !pinsVisible || (!modeEnabled && !config.showPinsWhenIdle)) {
      return [];
    }
    const candidates = annotations.filter(
      (item) => config.showResolved || (item.status !== "completed" && item.status !== "closed"),
    );
    if (!interactionActive) {
      return candidates;
    }
    return candidates.filter((item) => item.id === selectedId);
  }, [
    authenticated,
    annotations,
    config.showPinsWhenIdle,
    config.showResolved,
    interactionActive,
    modeEnabled,
    pinsVisible,
    selectedId,
  ]);

  const visibleTags = useMemo(() => {
    if (!authenticated || !tagsVisible) {
      return [];
    }
    return interactionActive ? [] : annotationTags;
  }, [authenticated, annotationTags, interactionActive, tagsVisible]);

  const visibleFlowPins = useMemo(() => {
    if (!authenticated || !flowPinsVisible) {
      return [];
    }
    if (!interactionActive) {
      return flowPins;
    }
    return flowPins.filter((item) => item.id === selectedFlowPinId);
  }, [authenticated, flowPins, flowPinsVisible, interactionActive, selectedFlowPinId]);

  const selected = authenticated ? annotations.find((item) => item.id === selectedId) : undefined;

  const rawPositionItems = useMemo(() => {
    const items = visible.map((item) => ({ id: item.id, anchor: item.anchor }));
    if (selected && !items.some((item) => item.id === selected.id)) {
      items.push({ id: selected.id, anchor: selected.anchor });
    }
    if (draft) {
      items.push({ id: draft.id, anchor: draft.anchor });
    }
    for (const tag of visibleTags) {
      items.push({ id: tag.id, anchor: tag });
    }
    if (tagDraft) {
      items.push({ id: tagDraft.id, anchor: tagDraft.anchor });
    }
    for (const flowPin of visibleFlowPins) {
      items.push({ id: flowPin.id, anchor: flowPin.anchor });
    }
    if (flowPinDraft) {
      items.push({ id: flowPinDraft.id, anchor: flowPinDraft.anchor });
    }
    return items;
  }, [draft, flowPinDraft, selected, tagDraft, visible, visibleFlowPins, visibleTags]);

  const nextItemsKey = positionItemsKey(rawPositionItems);
  const positionItemsRef = useRef(rawPositionItems);
  const previousKeyRef = useRef(nextItemsKey);
  if (previousKeyRef.current !== nextItemsKey) {
    previousKeyRef.current = nextItemsKey;
    positionItemsRef.current = rawPositionItems;
  }
  const positionItems = positionItemsRef.current;

  const positions = useAnnotationPositions(positionItems);
  const selectedPosition = selected ? positions.get(selected.id) : undefined;
  const tagDraftPosition = tagDraft
    ? (positions.get(tagDraft.id) ?? {
        x: tagDraft.anchor.fallbackX,
        y: tagDraft.anchor.fallbackY,
        resolved: true,
      })
    : undefined;
  const flowPinDraftPosition = flowPinDraft
    ? (positions.get(flowPinDraft.id) ?? {
        x: flowPinDraft.anchor.fallbackX,
        y: flowPinDraft.anchor.fallbackY,
        resolved: true,
      })
    : undefined;
  const selectedFlowPin = selectedFlowPinId
    ? flowPins.find((item) => item.id === selectedFlowPinId)
    : undefined;
  const selectedFlowPinOrigin = selectedFlowPin
    ? (positions.get(selectedFlowPin.id) ?? {
        x: selectedFlowPin.anchor.fallbackX,
        y: selectedFlowPin.anchor.fallbackY,
      })
    : undefined;
  const draftPosition = draft
    ? (positions.get(draft.id) ?? {
        x: draft.anchor.fallbackX,
        y: draft.anchor.fallbackY,
        resolved: true,
      })
    : undefined;

  return (
    <div className="wpn-root" style={{ zIndex: config.zIndex }}>
      {config.showToggleButton ? <AnnotationToolbar /> : null}
      <AnnotationOverlay />
      {visible.map((annotation) => {
        const position = positions.get(annotation.id);
        if (!position) {
          return null;
        }
        return (
          <AnnotationPin
            key={annotation.id}
            id={annotation.id}
            number={annotation.number}
            status={annotation.status}
            elementIdentifier={annotation.anchor.elementIdentifier}
            commentsCount={annotation.comments.length}
            x={position.x}
            y={position.y}
            resolvedTarget={position.resolved}
            selected={selectedId === annotation.id}
            onSelect={selectAnnotation}
          />
        );
      })}
      {visibleTags.map((tag) => {
        const position = positions.get(tag.id);
        if (!position) {
          return null;
        }
        const canEditTag = canDeleteBoardItem(tag.createdById, config.currentUser);
        return (
          <TagPinListItem
            key={tag.id}
            id={tag.id}
            tagId={tag.tagId}
            name={tag.tagName}
            color={tag.tagColor}
            x={position.x}
            y={position.y}
            width={tag.width}
            height={tag.height}
            resolvedTarget={position.resolved}
            canEdit={canEditTag}
            onRemove={canEditTag ? requestRemoveTag : undefined}
            onGeometryChange={handleTagGeometryChange}
            onGeometryCommit={handleTagGeometryCommit}
            onTagChange={handleTagReassign}
          />
        );
      })}
      {tagDraft && tagDraftPosition ? (
        <TagPicker x={tagDraftPosition.x} y={tagDraftPosition.y} />
      ) : null}
      {visibleFlowPins.map((flowPin) => {
        const position = positions.get(flowPin.id);
        if (!position) {
          return null;
        }
        return (
          <FlowPinPinListItem
            key={flowPin.id}
            id={flowPin.id}
            name={flowPin.name}
            x={position.x}
            y={position.y}
            resolvedTarget={position.resolved}
            active={flowPin.id === selectedFlowPinId}
            onSelect={handleSelectFlowPin}
          />
        );
      })}
      {flowPinDraft && flowPinDraftPosition ? (
        <FlowPinPicker x={flowPinDraftPosition.x} y={flowPinDraftPosition.y} />
      ) : null}
      {selectedFlowPin && selectedFlowPinOrigin ? (
        <FlowPinPanel
          key={selectedFlowPin.id}
          flowPin={selectedFlowPin}
          originX={selectedFlowPinOrigin.x}
          originY={selectedFlowPinOrigin.y}
          onDelete={handleRemoveFlowPin}
        />
      ) : null}
      {draft && draftPosition ? (
        <>
          {pinsVisible ? (
            <AnnotationPin
              id={draft.id}
              number={draft.number}
              status="open"
              elementIdentifier={draft.label}
              x={draftPosition.x}
              y={draftPosition.y}
              resolvedTarget={draftPosition.resolved}
              selected
              onSelect={() => undefined}
            />
          ) : null}
          <AnnotationComposer x={draftPosition.x} y={draftPosition.y} />
        </>
      ) : null}
      {selected && selectedPosition ? (
        <AnnotationThreadPanel
          key={selected.id}
          annotationId={selected.id}
          x={selectedPosition.x}
          y={selectedPosition.y}
          orphaned={!selectedPosition.resolved}
        />
      ) : null}
      {listOpen && authenticated ? <AnnotationListPanel /> : null}
      {epicFlowOpen && authenticated ? (
        <Suspense fallback={null}>
          <EpicFlowPanel />
        </Suspense>
      ) : null}
      {flowOpen && authenticated ? (
        <Suspense fallback={null}>
          <WecFlowPanel />
        </Suspense>
      ) : null}
      {userManagementOpen ? (
        <Suspense fallback={null}>
          <SettingsPanel />
        </Suspense>
      ) : null}
      {discardPrompt ? (
        <ConfirmDialog
          title="Discard comment?"
          description="Your comment text hasn't been saved yet. Discarding it cannot be undone."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          destructive
          onCancel={cancelDiscardPrompt}
          onConfirm={confirmDiscard}
        />
      ) : null}
      {pendingTagRemoval ? (
        <ConfirmDialog
          title="Remove tag?"
          description={`Remove the "${pendingTagRemoval.tagName}" tag from this element? This cannot be undone.`}
          confirmLabel="Remove"
          destructive
          busy={removingTag}
          onCancel={cancelRemoveTag}
          onConfirm={confirmRemoveTag}
        />
      ) : null}
      {actionError || layerError ? (
        <div className="wpn-toast" role="alert">
          <span>{actionError ?? layerError}</span>
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={() => {
              clearActionError();
              setLayerError(null);
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
