import { useMemo } from "react";
import { useAnnotationContext } from "../context/AnnotationContext";
import { useAnnotationPositions } from "../hooks/useAnnotationPosition";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationListPanel } from "./AnnotationListPanel";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { AnnotationPin } from "./AnnotationPin";
import { AnnotationThreadPanel } from "./AnnotationThreadPanel";
import { AnnotationToolbar } from "./AnnotationToolbar";

export function AnnotationLayer() {
  const {
    annotations,
    config,
    modeEnabled,
    selectedId,
    selectAnnotation,
    draft,
    pinsVisible,
    listOpen,
    actionError,
    clearActionError,
  } = useAnnotationContext();

  const visible = useMemo(() => {
    if (!pinsVisible || (!modeEnabled && !config.showPinsWhenIdle)) {
      return [];
    }
    return annotations.filter(
      (item) => config.showResolved || (item.status !== "completed" && item.status !== "closed"),
    );
  }, [annotations, config.showPinsWhenIdle, config.showResolved, modeEnabled, pinsVisible]);

  const positionItems = useMemo(() => {
    const items = visible.map((item) => ({ id: item.id, anchor: item.anchor }));
    if (draft) {
      items.push({ id: draft.id, anchor: draft.anchor });
    }
    return items;
  }, [draft, visible]);

  const positions = useAnnotationPositions(positionItems);
  const selected = visible.find((item) => item.id === selectedId);
  const selectedPosition = selected ? positions.get(selected.id) : undefined;
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
            annotation={annotation}
            x={position.x}
            y={position.y}
            resolvedTarget={position.resolved}
            selected={selectedId === annotation.id}
            onSelect={selectAnnotation}
          />
        );
      })}
      {draft && draftPosition ? (
        <>
          {pinsVisible ? (
            <AnnotationPin
              annotation={{ id: draft.id, number: draft.number, status: "open" }}
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
          annotationId={selected.id}
          x={selectedPosition.x}
          y={selectedPosition.y}
          orphaned={!selectedPosition.resolved}
        />
      ) : null}
      {listOpen ? <AnnotationListPanel /> : null}
      {actionError ? (
        <div className="wpn-toast" role="alert">
          <span>{actionError}</span>
          <button type="button" className="wpn-icon-btn" onClick={clearActionError} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
