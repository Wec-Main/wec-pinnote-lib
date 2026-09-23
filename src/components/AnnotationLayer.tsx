import { lazy, Suspense, useMemo, useRef } from "react";
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

export function AnnotationLayer() {
  const {
    annotations,
    config,
    annotationTags,
    removeAnnotationTag,
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
    listOpen,
    epicFlowOpen,
    flowOpen,
    userManagementOpen,
    discardPrompt,
    confirmDiscard,
    cancelDiscardPrompt,
  } = useAnnotationUi();
  const { activeAccount } = useAnnotationAuth();

  const visible = useMemo(() => {
    if (!activeAccount || !pinsVisible || (!modeEnabled && !config.showPinsWhenIdle)) {
      return [];
    }
    return annotations.filter(
      (item) => config.showResolved || (item.status !== "completed" && item.status !== "closed"),
    );
  }, [
    activeAccount,
    annotations,
    config.showPinsWhenIdle,
    config.showResolved,
    modeEnabled,
    pinsVisible,
  ]);

  const visibleTags = useMemo(
    () => (activeAccount && tagsVisible ? annotationTags : []),
    [activeAccount, annotationTags, tagsVisible],
  );

  const selected = activeAccount ? annotations.find((item) => item.id === selectedId) : undefined;

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
    return items;
  }, [draft, selected, tagDraft, visible, visibleTags]);

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
          <TagPin
            key={tag.id}
            name={tag.tagName}
            color={tag.tagColor}
            x={position.x}
            y={position.y}
            resolvedTarget={position.resolved}
            onRemove={() => void removeAnnotationTag(tag.id)}
          />
        );
      })}
      {tagDraft && tagDraftPosition ? (
        <TagPicker x={tagDraftPosition.x} y={tagDraftPosition.y} />
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
      {listOpen && activeAccount ? <AnnotationListPanel /> : null}
      {epicFlowOpen && activeAccount ? (
        <Suspense fallback={null}>
          <EpicFlowPanel />
        </Suspense>
      ) : null}
      {flowOpen && activeAccount ? (
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
      {actionError ? (
        <div className="wpn-toast" role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className="wpn-icon-btn"
            onClick={clearActionError}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
