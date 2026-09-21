import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { createElementAnchor, findAnnotatableElement, isAnnotatableTarget } from "../../utils/elementAnchor";
import { getElementLabel, isLibraryElement } from "../../utils/elementResolver";

function hitElement(clientX: number, clientY: number, overlay: HTMLElement): Element | null {
  overlay.style.pointerEvents = "none";
  void overlay.offsetHeight;
  const hit = document.elementFromPoint(clientX, clientY);
  overlay.style.pointerEvents = "auto";
  return hit;
}

export function AnnotationOverlay() {
  const { modeEnabled, draft, startDraft } = useAnnotationContext();
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const draftLock = useRef(false);

  useEffect(() => {
    if (!draft) {
      draftLock.current = false;
    }
  }, [draft]);

  const createFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const overlay = overlayRef.current;
      if (!overlay || draft || draftLock.current) {
        return;
      }
      const hit = hitElement(clientX, clientY, overlay);
      if (!hit || isLibraryElement(hit) || !isAnnotatableTarget(hit)) {
        return;
      }
      const target = findAnnotatableElement(hit);
      draftLock.current = true;
      startDraft(createElementAnchor(target, clientX, clientY), getElementLabel(target));
    },
    [draft, startDraft],
  );

  useEffect(() => {
    if (!modeEnabled) {
      setHighlight(null);
      return;
    }

    const blockHostEvent = (event: Event) => {
      if (isLibraryElement(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onHostClick = (event: MouseEvent) => {
      if (isLibraryElement(event.target)) {
        return;
      }
      blockHostEvent(event);
      if (event.clientX === 0 && event.clientY === 0 && event.target instanceof Element) {
        const rect = event.target.getBoundingClientRect();
        createFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && !isLibraryElement(event.target)) {
        blockHostEvent(event);
      }
    };

    document.addEventListener("click", onHostClick, true);
    document.addEventListener("submit", blockHostEvent, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("click", onHostClick, true);
      document.removeEventListener("submit", blockHostEvent, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [createFromPoint, modeEnabled]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const hit = hitElement(event.clientX, event.clientY, overlay);
    if (!hit || isLibraryElement(hit) || !isAnnotatableTarget(hit)) {
      setHighlight(null);
      return;
    }
    setHighlight(findAnnotatableElement(hit).getBoundingClientRect());
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!modeEnabled || !overlay) {
      return;
    }
    const onNativePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      createFromPoint(event.clientX, event.clientY);
    };
    overlay.addEventListener("pointerdown", onNativePointerDown);
    return () => overlay.removeEventListener("pointerdown", onNativePointerDown);
  }, [createFromPoint, modeEnabled]);

  if (!modeEnabled) {
    return null;
  }

  return (
    <div ref={overlayRef} className="wpn-overlay" onPointerMove={onPointerMove}>
      {highlight ? (
        <div
          className="wpn-hover-highlight"
          style={{
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}
    </div>
  );
}
