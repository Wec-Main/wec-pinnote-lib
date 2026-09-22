import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { AnnotationToggleButton } from "../AnnotationToggleButton";
import { ToolbarAuthControl } from "../Auth";
import { PAGE_STATUS_OPTIONS, pageStatusLabel } from "../../utils/status";
import { Icons } from "../../assets/icons";
import { Icon, Tooltip } from "../primitives";
import { isBoolean, usePersistentState } from "../../hooks/usePersistentState";

const EDGE = 8;
const LAUNCHER_SIZE = 36;

interface ToolbarPosition {
  x: number;
  y: number;
}

function isToolbarPosition(value: unknown): value is ToolbarPosition | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ToolbarPosition>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
}

function clampPosition(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)),
    y: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE)),
  };
}

export function AnnotationToolbar() {
  const {
    config,
    listOpen,
    setListOpen,
    epicFlowOpen,
    setEpicFlowOpen,
    userManagementOpen,
    setUserManagementOpen,
    setAuditHistoryOpen,
    annotations,
    loading,
    error,
    retry,
    connectionState,
    activeAccount,
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
  const [position, setPosition] = usePersistentState<ToolbarPosition | null>(
    `wpn-ui:${config.projectId}:toolbarPosition`,
    null,
    isToolbarPosition,
  );
  const [screenStatusOpen, setScreenStatusOpen] = useState(false);
  const [barOpen, setBarOpen] = usePersistentState(
    `wpn-ui:${config.projectId}:toolbarOpen`,
    true,
    isBoolean,
  );
  const [launcherExpanded, setLauncherExpanded] = usePersistentState(
    `wpn-ui:${config.projectId}:launcherExpanded`,
    true,
    isBoolean,
  );
  const [barExpanded, setBarExpanded] = usePersistentState(
    `wpn-ui:${config.projectId}:toolbarExpanded`,
    true,
    isBoolean,
  );

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
  }, [position, setPosition]);

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) {
      return;
    }
    if (!position) {
      return;
    }
    const next = clampPosition(position.x, position.y, el.offsetWidth, el.offsetHeight);
    if (next.x !== position.x || next.y !== position.y) {
      setPosition(next);
    }
  }, [activeAccount, barOpen, barExpanded, launcherExpanded, position, setPosition]);

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

  const toggleBar = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setBarExpanded(!barExpanded);
  };

  const closeBar = () => {
    setPosition(
      clampPosition(EDGE, window.innerHeight - LAUNCHER_SIZE - EDGE, LAUNCHER_SIZE, LAUNCHER_SIZE),
    );
    setModeEnabled(false);
    setListOpen(false);
    setUserManagementOpen(false);
    setAuditHistoryOpen(false);
    selectAnnotation(null);
    cancelDraft();
    setBarOpen(false);
  };

  if (!barOpen) {
    const openToolbar = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setPosition(null);
      setBarOpen(true);
    };
    const openEpicFlow = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setEpicFlowOpen(true);
    };
    const openUserManagement = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setUserManagementOpen(true);
    };
    const toggleLauncher = () => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      setLauncherExpanded(!launcherExpanded);
    };

    return (
      <div
        ref={setToolbarRef}
        className={[
          "wpn-toolbar",
          "wpn-toolbar--launcher",
          launcherExpanded ? "" : "wpn-toolbar--launcher-collapsed",
          position ? "wpn-toolbar--placed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={position ? { left: position.x, top: position.y } : undefined}
      >
        <Tooltip
          label={launcherExpanded ? "Collapse launcher" : "Expand launcher"}
          placement="right"
        >
          <button
            type="button"
            className="wpn-launcher-item__logo-wrap"
            aria-label={launcherExpanded ? "Collapse launcher" : "Expand launcher"}
            aria-expanded={launcherExpanded}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onClick={toggleLauncher}
          >
            <img src={Icons.wecLogo} alt="" className="wpn-launcher-item__logo" />
          </button>
        </Tooltip>
        {launcherExpanded ? (
          <>
            <Tooltip label="Drag to move" placement="right">
              <button
                type="button"
                className="wpn-toolbar__drag"
                aria-label="Drag annotation toolbar"
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <Icon name="drag" className="wpn-toolbar__drag-icon" />
              </button>
            </Tooltip>
            <Tooltip label="Open toolbar" placement="right">
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
            </Tooltip>
            <Tooltip label="EpicFlow" placement="right">
              <button
                type="button"
                className={[
                  "wpn-launcher-item",
                  epicFlowOpen ? "wpn-launcher-item--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label="Open EpicFlow"
                aria-pressed={epicFlowOpen}
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
            </Tooltip>
            {activeAccount ? (
              <Tooltip label="Settings" placement="right">
                <button
                  type="button"
                  className={[
                    "wpn-launcher-item",
                    userManagementOpen ? "wpn-launcher-item--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label="Open settings"
                  aria-pressed={userManagementOpen}
                  onPointerDown={onDragStart}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                  onClick={openUserManagement}
                >
                  <span className="wpn-launcher-item__icon-wrap">
                    <img src={Icons.settings} alt="" className="wpn-launcher-item__icon" />
                  </span>
                </button>
              </Tooltip>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={setToolbarRef}
      className={[
        "wpn-toolbar",
        barExpanded ? "" : "wpn-toolbar--collapsed",
        position ? "wpn-toolbar--placed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <Tooltip label={barExpanded ? "Collapse toolbar" : "Expand toolbar"} placement="bottom">
        <button
          type="button"
          className="wpn-launcher-item__logo-wrap"
          aria-label={barExpanded ? "Collapse toolbar" : "Expand toolbar"}
          aria-expanded={barExpanded}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={toggleBar}
        >
          <img src={Icons.wecLogo} alt="Wec.ai" className="wpn-launcher-item__logo" />
        </button>
      </Tooltip>
      {barExpanded ? (
        <>
          <Tooltip label="Drag to move" placement="bottom">
            <button
              type="button"
              className="wpn-toolbar__drag"
              aria-label="Drag annotation toolbar"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <Icon name="drag" className="wpn-toolbar__drag-icon" />
            </button>
          </Tooltip>
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
          <ToolbarAuthControl />
          <span className="wpn-toolbar__divider" aria-hidden="true" />
          <AnnotationToggleButton />
          <Tooltip label={pinsVisible ? "Hide pins" : "Show pins"} placement="bottom">
            <button
              type="button"
              className={["wpn-toolbar__eye", pinsVisible ? "" : "wpn-toolbar__eye--hidden"]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={!pinsVisible}
              aria-label={pinsVisible ? "Hide pins" : "Show pins"}
              onClick={() => setPinsVisible(!pinsVisible)}
            >
              <Icon name={pinsVisible ? "eye" : "eyeOff"} className="wpn-toggle__icon" />
            </button>
          </Tooltip>
          <span className="wpn-toolbar__divider" aria-hidden="true" />
          <Tooltip label="Comments" placement="bottom">
            <button
              type="button"
              className={["wpn-toolbar__list", listOpen ? "wpn-toolbar__list--active" : ""]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={listOpen}
              aria-label="Toggle comments"
              onClick={() => setListOpen(!listOpen)}
            >
              <Icon name="comment" className="wpn-toolbar__list-icon" />
              <span className="wpn-toolbar__count">{annotations.length}</span>
            </button>
          </Tooltip>
          <span className="wpn-toolbar__divider" aria-hidden="true" />
          <Tooltip label={loading ? "Refreshing..." : "Refresh comments"} placement="bottom">
            <button
              type="button"
              className={["wpn-toolbar__refresh", loading ? "wpn-toolbar__refresh--spinning" : ""]
                .filter(Boolean)
                .join(" ")}
              aria-label="Refresh comments"
              disabled={loading}
              onClick={() => retry()}
            >
              <Icon name="refresh" className="wpn-toolbar__refresh-icon" />
            </button>
          </Tooltip>
          <Tooltip label="Close toolbar" placement="bottom">
            <button
              type="button"
              className="wpn-toolbar__close"
              aria-label="Close annotation toolbar"
              onClick={closeBar}
            >
              <Icon name="close" className="wpn-toolbar__close-icon" />
            </button>
          </Tooltip>
          {connectionState === "reconnecting" ? (
            <Tooltip label="Reconnecting to live updates" placement="bottom">
              <span
                className="wpn-toolbar__live wpn-toolbar__live--reconnecting"
                aria-live="polite"
              >
                <span className="wpn-toolbar__live-dot" />
                Reconnecting
              </span>
            </Tooltip>
          ) : null}
          {loading ? <span className="wpn-toolbar__status">Loading</span> : null}
          {error ? (
            <button type="button" className="wpn-toolbar__retry" onClick={retry}>
              Retry
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
