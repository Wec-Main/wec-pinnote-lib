import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { AnnotationToggleButton } from "../AnnotationToggleButton";
import { PAGE_STATUS_OPTIONS, pageStatusLabel } from "../../utils/status";
import { Icons } from "../../assets/icons";

const EDGE = 8;
const LAUNCHER_SIZE = 36;

function clampPosition(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)),
    y: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE)),
  };
}

export function AnnotationToolbar() {
  const {
    listOpen,
    setListOpen,
    epicFlowOpen,
    setEpicFlowOpen,
    annotations,
    loading,
    error,
    retry,
    authorName,
    setAuthorName,
    pinsVisible,
    setPinsVisible,
    setModeEnabled,
    selectAnnotation,
    cancelDraft,
    pageStatus,
    setPageStatus,
  } = useAnnotationContext();
  const toolbarRef = useRef<HTMLElement | null>(null);
  const setToolbarRef = (node: HTMLElement | null) => {
    toolbarRef.current = node;
  };
  const screenStatusRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [screenStatusOpen, setScreenStatusOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(true);

  useEffect(() => {
    const onResize = () => {
      const el = toolbarRef.current;
      if (!el || !position) {
        return;
      }
      setPosition(clampPosition(position.x, position.y, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position]);

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) {
      return;
    }
    setPosition((current) => {
      if (!current) {
        return current;
      }
      const next = clampPosition(current.x, current.y, el.offsetWidth, el.offsetHeight);
      if (next.x === current.x && next.y === current.y) {
        return current;
      }
      return next;
    });
  }, [authorName, barOpen]);

  useEffect(() => {
    if (!screenStatusOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!screenStatusRef.current?.contains(event.target as Node)) {
        setScreenStatusOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [screenStatusOpen]);

  const onDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    const el = toolbarRef.current;
    if (!el) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = el.getBoundingClientRect();
    dragging.current = true;
    didDrag.current = false;
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const el = toolbarRef.current;
    if (!dragging.current || !el) {
      return;
    }
    if (
      Math.abs(event.clientX - dragOrigin.current.x) > 4 ||
      Math.abs(event.clientY - dragOrigin.current.y) > 4
    ) {
      didDrag.current = true;
    }
    setPosition(
      clampPosition(
        event.clientX - dragOffset.current.x,
        event.clientY - dragOffset.current.y,
        el.offsetWidth,
        el.offsetHeight,
      ),
    );
  };

  const onDragEnd = () => {
    dragging.current = false;
  };

  const closeBar = () => {
    setPosition(
      clampPosition(
        EDGE,
        window.innerHeight - LAUNCHER_SIZE - EDGE,
        LAUNCHER_SIZE,
        LAUNCHER_SIZE,
      ),
    );
    setModeEnabled(false);
    setListOpen(false);
    selectAnnotation(null);
    cancelDraft();
    setBarOpen(false);
  };

  if (!barOpen && epicFlowOpen) {
    return null;
  }

  if (!barOpen) {
    const openToolbar = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setPosition(null);
      setBarOpen(true);
    };
    const ignoreDrag = () => {
      didDrag.current = false;
    };
    const openEpicFlow = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setEpicFlowOpen(true);
    };

    return (
      <div
        ref={setToolbarRef}
        className={["wpn-toolbar", "wpn-toolbar--launcher", position ? "wpn-toolbar--placed" : ""]
          .filter(Boolean)
          .join(" ")}
        style={position ? { left: position.x, top: position.y } : undefined}
      >
        <span
          className="wpn-launcher-item__logo-wrap"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <img src={Icons.wecLogo} alt="" className="wpn-launcher-item__logo" />
        </span>
        <button
          type="button"
          className="wpn-toolbar__drag"
          aria-label="Drag annotation toolbar"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="wpn-toolbar__drag-icon">
            <circle cx="5" cy="3" r="1.3" fill="currentColor" />
            <circle cx="11" cy="3" r="1.3" fill="currentColor" />
            <circle cx="5" cy="8" r="1.3" fill="currentColor" />
            <circle cx="11" cy="8" r="1.3" fill="currentColor" />
            <circle cx="5" cy="13" r="1.3" fill="currentColor" />
            <circle cx="11" cy="13" r="1.3" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="wpn-launcher-item wpn-launcher-item--active"
          aria-label="Open annotation toolbar"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={openToolbar}
        >
          <span className="wpn-launcher-item__icon-wrap">
            <img src={Icons.pen} alt="" className="wpn-launcher-item__icon" />
          </span>
        </button>
        <button
          type="button"
          className="wpn-launcher-item"
          aria-label="Open EpicFlow"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={openEpicFlow}
        >
          <span className="wpn-launcher-item__icon-wrap">
            <img src={Icons.epic} alt="" className="wpn-launcher-item__icon" />
          </span>
        </button>
        <button
          type="button"
          className="wpn-launcher-item"
          aria-label="Settings (coming soon)"
          aria-disabled="true"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={ignoreDrag}
        >
          <span className="wpn-launcher-item__icon-wrap">
            <img src={Icons.settings} alt="" className="wpn-launcher-item__icon" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setToolbarRef}
      className={["wpn-toolbar", position ? "wpn-toolbar--placed" : ""].filter(Boolean).join(" ")}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <span
        className="wpn-launcher-item__logo-wrap"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <img src={Icons.wecLogo} alt="" className="wpn-launcher-item__logo" />
      </span>
      <button
        type="button"
        className="wpn-toolbar__drag"
        aria-label="Drag annotation toolbar"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="wpn-toolbar__drag-icon">
          <circle cx="5" cy="3" r="1.3" fill="currentColor" />
          <circle cx="11" cy="3" r="1.3" fill="currentColor" />
          <circle cx="5" cy="8" r="1.3" fill="currentColor" />
          <circle cx="11" cy="8" r="1.3" fill="currentColor" />
          <circle cx="5" cy="13" r="1.3" fill="currentColor" />
          <circle cx="11" cy="13" r="1.3" fill="currentColor" />
        </svg>
      </button>
      <div className="wpn-toolbar__screen" ref={screenStatusRef}>
        <button
          type="button"
          className="wpn-toolbar__screen-trigger"
          aria-haspopup="listbox"
          aria-expanded={screenStatusOpen}
          aria-label="Screen status"
          onClick={() => setScreenStatusOpen((open) => !open)}
        >
          {pageStatusLabel(pageStatus)}
          <svg viewBox="0 0 16 16" className="wpn-toolbar__screen-chevron" aria-hidden="true">
            <path fill="currentColor" d="M4.2 6.2 8 10l3.8-3.8L13 7.4 8 12.4 3 7.4z" />
          </svg>
        </button>
        {screenStatusOpen ? (
          <div className="wpn-toolbar__screen-menu" role="listbox">
            {PAGE_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === pageStatus}
                className={[
                  "wpn-toolbar__screen-option",
                  option.value === pageStatus ? "wpn-toolbar__screen-option--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  void setPageStatus(option.value);
                  setScreenStatusOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className="wpn-toolbar__name-wrap">
        <span className="wpn-toolbar__name-sizer" aria-hidden="true">
          {authorName || "Your name"}
        </span>
        <input
          className={["wpn-toolbar__name", !authorName.trim() ? "wpn-toolbar__name--invalid" : ""]
            .filter(Boolean)
            .join(" ")}
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="Your name"
          aria-label="Comment user name"
        />
      </span>
      <AnnotationToggleButton />
      <button
        type="button"
        className={["wpn-toolbar__eye", pinsVisible ? "" : "wpn-toolbar__eye--hidden"]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={!pinsVisible}
        aria-label={pinsVisible ? "Hide pins" : "Show pins"}
        onClick={() => setPinsVisible(!pinsVisible)}
      >
        <img
          src={pinsVisible ? Icons.eyeEnabled : Icons.eyeDisable}
          alt=""
          className="wpn-toggle__icon"
        />
      </button>
      <button
        type="button"
        className={["wpn-toolbar__list", listOpen ? "wpn-toolbar__list--active" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={listOpen}
        aria-label="Toggle annotation list"
        onClick={() => setListOpen(!listOpen)}
      >
        <img src={Icons.comment} alt="" className="wpn-toolbar__list-icon" />
        <span className="wpn-toolbar__count">{annotations.length}</span>
      </button>
      <button
        type="button"
        className={["wpn-toolbar__refresh", loading ? "wpn-toolbar__refresh--spinning" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label="Refresh comments"
        disabled={loading}
        onClick={() => retry()}
      >
        <img src={Icons.refresh} alt="" className="wpn-toolbar__refresh-icon" />
      </button>
      <button
        type="button"
        className="wpn-toolbar__close"
        aria-label="Close annotation toolbar"
        onClick={closeBar}
      >
        <span
          aria-hidden="true"
          className="wpn-toolbar__close-icon"
          style={{
            WebkitMaskImage: `url(${Icons.close})`,
            maskImage: `url(${Icons.close})`,
          }}
        />
      </button>
      {loading ? <span className="wpn-toolbar__status">Loading</span> : null}
      {error ? (
        <button type="button" className="wpn-toolbar__retry" onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
