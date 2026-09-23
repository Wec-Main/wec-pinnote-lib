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
  name: string;
  color: string;
  x: number;
  y: number;
  resolvedTarget: boolean;
  onRemove: (id: string) => void;
}

const TagPinListItem = memo(function TagPinListItem({
  id,
  name,
  color,
  x,
  y,
  resolvedTarget,
  onRemove,
}: TagPinListItemProps) {
  return (
    <TagPin
      name={name}
      color={color}
      x={x}
      y={y}
      resolvedTarget={resolvedTarget}
      onRemove={() => onRemove(id)}
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
    listOpen,
    epicFlowOpen,
    flowOpen,
    userManagementOpen,
    discardPrompt,
    confirmDiscard,
    cancelDiscardPrompt,
  } = useAnnotationUi();
  const { authenticated } = useAnnotationAuth();
  const [tagError, setTagError] = useState<string | null>(null);

  const handleRemoveTag = useCallback(
    (id: string) => {
      setTagError(null);
      removeAnnotationTag(id).catch((err: unknown) => {
        setTagError(err instanceof Error && err.message ? err.message : "Could not remove that tag");
      });
    },
    [removeAnnotationTag],
  );

  const handleSelectFlowPin = useCallback(
    (id: string) => {
      selectFlowPin(id);
    },
    [selectFlowPin],
  );

  const visible = useMemo(() => {
    if (!authenticated || !pinsVisible || (!modeEnabled && !config.showPinsWhenIdle)) {
      return [];
    }
    return annotations.filter(
      (item) => config.showResolved || (item.status !== "completed" && item.status !== "closed"),
    );
  }, [
    authenticated,
    annotations,
    config.showPinsWhenIdle,
    config.showResolved,
    modeEnabled,
    pinsVisible,
  ]);

  const visibleTags = useMemo(
    () => (authenticated && tagsVisible ? annotationTags : []),
    [authenticated, annotationTags, tagsVisible],
  );

  const visibleFlowPins = useMemo(
    () => (authenticated && flowPinsVisible ? flowPins : []),
    [authenticated, flowPins, flowPinsVisible],
  );

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
        return (
          <TagPinListItem
            key={tag.id}
            id={tag.id}
            name={tag.tagName}
            color={tag.tagColor}
            x={position.x}
            y={position.y}
            resolvedTarget={position.resolved}
            onRemove={handleRemoveTag}
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
      {actionError || tagError ? (
        <div className="wpn-toast" role="alert">
          <span>{actionError ?? tagError}</span>
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={() => {
              clearActionError();
              setTagError(null);
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
