import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  createElementAnchor,
  findAnnotatableElement,
  isAnnotatableTarget,
} from "../../utils/elementAnchor";
import { getElementLabel, isLibraryElement } from "../../utils/elementResolver";

function hitElement(clientX: number, clientY: number, overlay: HTMLElement): Element | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  return stack.find((element) => element !== overlay && !overlay.contains(element)) ?? null;
}

function rectsEqual(left: DOMRect | null, right: DOMRect | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function AnnotationOverlay() {
  const {
    modeEnabled,
    setModeEnabled,
    draft,
    startDraft,
    tagModeEnabled,
    setTagModeEnabled,
    tagDraft,
    startTagDraft,
    flowPinModeEnabled,
    setFlowPinModeEnabled,
    flowPinDraft,
    startFlowPinDraft,
  } = useAnnotationUi();
  const placing = modeEnabled || tagModeEnabled || flowPinModeEnabled;
  const pendingDraft = draft ?? tagDraft ?? flowPinDraft;
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const draftLock = useRef(false);
  const frameRef = useRef(0);
  const highlightRef = useRef<DOMRect | null>(null);

  useEscapeKey(() => {
    if (!placing) {
      return;
    }
    if (modeEnabled) {
      setModeEnabled(false);
    }
    if (tagModeEnabled) {
      setTagModeEnabled(false);
    }
    if (flowPinModeEnabled) {
      setFlowPinModeEnabled(false);
    }
  });

  useEffect(() => {
    if (placing) {
      setAnnouncement(
        flowPinModeEnabled
          ? "Flow placement mode enabled"
          : tagModeEnabled
            ? "Tagging mode enabled"
            : "Annotation mode enabled",
      );
    } else {
      setAnnouncement((current) => (current ? "Annotation mode disabled" : current));
    }
  }, [flowPinModeEnabled, placing, tagModeEnabled]);

  useEffect(() => {
    if (!pendingDraft) {
      draftLock.current = false;
    }
  }, [pendingDraft]);

  const createFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const overlay = overlayRef.current;
      if (!overlay || pendingDraft || draftLock.current) {
        return;
      }
      const hit = hitElement(clientX, clientY, overlay);
      if (!hit || isLibraryElement(hit) || !isAnnotatableTarget(hit)) {
        return;
      }
      const target = findAnnotatableElement(hit);
      draftLock.current = true;
      const anchor = createElementAnchor(target, clientX, clientY);
      const label = getElementLabel(target);
      if (flowPinModeEnabled) {
        startFlowPinDraft(anchor, label);
      } else if (tagModeEnabled) {
        startTagDraft(anchor, label);
      } else {
        startDraft(anchor, label);
      }
    },
    [
      flowPinModeEnabled,
      pendingDraft,
      startDraft,
      startFlowPinDraft,
      startTagDraft,
      tagModeEnabled,
    ],
  );

  useEffect(() => {
    if (!placing) {
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
  }, [createFromPoint, placing]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (frameRef.current) {
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      const overlay = overlayRef.current;
      if (!overlay) {
        return;
      }
      const hit = hitElement(clientX, clientY, overlay);
      const nextRect =
        hit && !isLibraryElement(hit) && isAnnotatableTarget(hit)
          ? findAnnotatableElement(hit).getBoundingClientRect()
          : null;
      if (rectsEqual(highlightRef.current, nextRect)) {
        return;
      }
      highlightRef.current = nextRect;
      setHighlight(nextRect);
    });
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!placing || !overlay) {
      return;
    }
    const onNativePointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      createFromPoint(event.clientX, event.clientY);
    };
    overlay.addEventListener("pointerdown", onNativePointerDown);
    return () => overlay.removeEventListener("pointerdown", onNativePointerDown);
  }, [createFromPoint, placing]);

  const liveRegion = (
    <span className="wpn-sr-only" role="status" aria-live="polite">
      {announcement}
    </span>
  );

  if (!placing) {
    return liveRegion;
  }

  return (
    <>
      {liveRegion}
      <div
        ref={overlayRef}
        className={[
          "wpn-overlay",
          tagModeEnabled ? "wpn-overlay--tag" : "",
          flowPinModeEnabled ? "wpn-overlay--flow" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerMove={onPointerMove}
      >
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
    </>
  );
}
