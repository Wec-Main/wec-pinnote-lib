import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  useAnnotationAuth,
  useAnnotationData,
  useAnnotationUi,
} from "../../context/AnnotationContext";
import { AnnotationModeButton, AnnotationVisibilityToggle } from "../AnnotationToggleButton";
import { ToolbarAuthControl } from "../Auth";
import { Icons } from "../../assets/icons";
import { Icon, LiveStatus, Tooltip } from "../primitives";
import { LauncherButton, type LauncherDragHandlers } from "./LauncherButton";
import { PublishVersionButton } from "./PublishVersionButton";
import { isBoolean, usePersistentState } from "../../hooks/usePersistentState";

const EDGE = 8;

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
    loading,
    error,
    retry,
    connectionState,
    allAnnotations,
    allAnnotationsLoading,
    reloadAllAnnotations,
    reloadFlowPins,
    reloadAnnotationTags,
  } = useAnnotationData();
  const {
    listOpen,
    setListOpen,
    epicFlowOpen,
    setEpicFlowOpen,
    flowOpen,
    setFlowOpen,
    userManagementOpen,
    setUserManagementOpen,
    setAuditHistoryOpen,
    setModeEnabled,
    setFlowPinModeEnabled,
    setTagModeEnabled,
    selectAnnotation,
    requestCancelDraft,
  } = useAnnotationUi();
  const { activeAccount } = useAnnotationAuth();
  // Guarantees the refresh icon visibly spins for at least one rotation on
  // every click, even when the reload resolves before the CSS animation
  // (tied to `loading`) would otherwise have a chance to show.
  const [spinning, setSpinning] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    },
    [],
  );
  const refreshPage = () => {
    retry();
    reloadAllAnnotations();
    reloadFlowPins();
    reloadAnnotationTags();
    setSpinning(true);
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }
    spinTimeoutRef.current = setTimeout(() => setSpinning(false), 800);
  };
  const toolbarRef = useRef<HTMLElement | null>(null);
  const setToolbarRef = (node: HTMLElement | null) => {
    toolbarRef.current = node;
  };
  const launcherRef = useRef<HTMLElement | null>(null);
  const setLauncherRef = (node: HTMLElement | null) => {
    launcherRef.current = node;
  };
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragTarget = useRef<{
    element: HTMLElement;
    commit: (next: ToolbarPosition) => void;
  } | null>(null);
  const [position, setPosition] = usePersistentState<ToolbarPosition | null>(
    `wpn-ui:${config.projectId}:toolbarPosition`,
    null,
    isToolbarPosition,
  );
  const [launcherPosition, setLauncherPosition] = usePersistentState<ToolbarPosition | null>(
    `wpn-ui:${config.projectId}:launcherPosition`,
    null,
    isToolbarPosition,
  );
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
      const bar = toolbarRef.current;
      if (bar && position) {
        setPosition(clampPosition(position.x, position.y, bar.offsetWidth, bar.offsetHeight));
      }
      const launcher = launcherRef.current;
      if (launcher && launcherPosition) {
        setLauncherPosition(
          clampPosition(
            launcherPosition.x,
            launcherPosition.y,
            launcher.offsetWidth,
            launcher.offsetHeight,
          ),
        );
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, setPosition, launcherPosition, setLauncherPosition]);

  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || !position || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const next = clampPosition(position.x, position.y, bar.offsetWidth, bar.offsetHeight);
      if (next.x !== position.x || next.y !== position.y) {
        setPosition(next);
      }
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [barOpen, position, setPosition]);

  const startDragFor =
    (elementRef: typeof toolbarRef, commit: (next: ToolbarPosition) => void) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      const el = elementRef.current;
      if (!el) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rect = el.getBoundingClientRect();
      dragging.current = true;
      didDrag.current = false;
      dragTarget.current = { element: el, commit };
      dragOrigin.current = { x: event.clientX, y: event.clientY };
      dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      commit({ x: rect.left, y: rect.top });
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const onDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const target = dragTarget.current;
    if (!dragging.current || !target) {
      return;
    }
    if (
      Math.abs(event.clientX - dragOrigin.current.x) > 4 ||
      Math.abs(event.clientY - dragOrigin.current.y) > 4
    ) {
      didDrag.current = true;
    }
    target.commit(
      clampPosition(
        event.clientX - dragOffset.current.x,
        event.clientY - dragOffset.current.y,
        target.element.offsetWidth,
        target.element.offsetHeight,
      ),
    );
  };

  const onDragEnd = () => {
    dragging.current = false;
    dragTarget.current = null;
  };

  const onDragStart = startDragFor(toolbarRef, setPosition);
  const onLauncherDragStart = startDragFor(launcherRef, setLauncherPosition);

  const toggleBar = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setBarExpanded(!barExpanded);
  };

  const guardedClick = (action: () => void) => () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    action();
  };

  const loggedOut = !activeAccount;

  const launcherDragHandlers: LauncherDragHandlers = {
    onPointerDown: onLauncherDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };

  const launcherShortcuts = (
    <>
      <LauncherButton
        label={epicFlowOpen ? "Close Draft Board" : "Draft Board"}
        active={epicFlowOpen}
        blocked={loggedOut}
        dragHandlers={launcherDragHandlers}
        onActivate={guardedClick(() => {
          if (!loggedOut) {
            setEpicFlowOpen(!epicFlowOpen);
          }
        })}
      >
        <img src={Icons.epic} alt="" className="wpn-launcher-item__icon" />
      </LauncherButton>
      <LauncherButton
        label={flowOpen ? "Close All Flows" : "All Flows"}
        active={flowOpen}
        blocked={loggedOut}
        dragHandlers={launcherDragHandlers}
        onActivate={guardedClick(() => {
          if (!loggedOut) {
            setFlowOpen(!flowOpen);
          }
        })}
      >
        <Icon name="flow" className="wpn-launcher-item__glyph" />
      </LauncherButton>
      <LauncherButton
        label={userManagementOpen ? "Close settings" : "Settings"}
        active={userManagementOpen}
        blocked={loggedOut}
        dragHandlers={launcherDragHandlers}
        onActivate={guardedClick(() => {
          if (!loggedOut) {
            setUserManagementOpen(!userManagementOpen);
          }
        })}
      >
        <img src={Icons.settings} alt="" className="wpn-launcher-item__icon" />
      </LauncherButton>
    </>
  );

  const closeBar = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setPosition(null);
    setModeEnabled(false);
    setFlowPinModeEnabled(false);
    setTagModeEnabled(false);
    setListOpen(false);
    setUserManagementOpen(false);
    setAuditHistoryOpen(false);
    selectAnnotation(null);
    requestCancelDraft();
    setBarOpen(false);
  };

  const openToolbar = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setPosition(null);
    setBarOpen(true);
  };

  const toggleLauncher = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setLauncherExpanded(!launcherExpanded);
  };

  const openToolbarButton = (
    <LauncherButton
      label={barOpen ? "Close toolbar" : "Open toolbar"}
      active={barOpen}
      dragHandlers={launcherDragHandlers}
      onActivate={barOpen ? closeBar : openToolbar}
    >
      <img src={Icons.pen} alt="" className="wpn-launcher-item__icon" />
    </LauncherButton>
  );

  const launcher = (
    <div
      ref={setLauncherRef}
      className={[
        "wpn-toolbar",
        "wpn-toolbar--launcher",
        launcherExpanded ? "" : "wpn-toolbar--launcher-collapsed",
        launcherPosition ? "wpn-toolbar--placed" : "wpn-toolbar--launcher-docked",
      ]
        .filter(Boolean)
        .join(" ")}
      style={launcherPosition ? { left: launcherPosition.x, top: launcherPosition.y } : undefined}
    >
      <Tooltip label={launcherExpanded ? "Collapse launcher" : "Expand launcher"} placement="right">
        <button
          type="button"
          className="wpn-launcher-item__logo-wrap"
          aria-label={launcherExpanded ? "Collapse launcher" : "Expand launcher"}
          aria-expanded={launcherExpanded}
          onPointerDown={onLauncherDragStart}
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
              aria-label="Drag annotation launcher"
              onPointerDown={onLauncherDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <Icon name="drag" className="wpn-toolbar__drag-icon" />
            </button>
          </Tooltip>
          {openToolbarButton}
          {launcherShortcuts}
        </>
      ) : null}
    </div>
  );

  if (!barOpen) {
    return launcher;
  }

  return (
    <>
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
            <ToolbarAuthControl />
            <span className="wpn-toolbar__divider" aria-hidden="true" />
            <Tooltip
              label={loggedOut ? "Log in first" : listOpen ? "Close comments" : "Open comments"}
              placement="bottom"
            >
              <button
                type="button"
                className={[
                  "wpn-toolbar__list",
                  listOpen ? "wpn-toolbar__list--active" : "",
                  loggedOut ? "wpn-toolbar__list--blocked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={listOpen}
                aria-disabled={loggedOut}
                aria-label={`${listOpen ? "Close" : "Open"} comments, ${allAnnotations.length} total`}
                onClick={() => {
                  if (!loggedOut) {
                    setListOpen(!listOpen);
                  }
                }}
              >
                <Icon name="comment" className="wpn-toolbar__list-icon" />
                {allAnnotationsLoading && allAnnotations.length === 0 ? null : (
                  <span className="wpn-toolbar__count">{allAnnotations.length}</span>
                )}
              </button>
            </Tooltip>
            <span className="wpn-toolbar__divider" aria-hidden="true" />
            <AnnotationModeButton />
            <AnnotationVisibilityToggle />
            <PublishVersionButton />
            {/* Comments only load for a signed-in actor, so refreshing and the
                failure it would report are meaningless while logged out. */}
            {loggedOut ? null : (
              <>
                <span className="wpn-toolbar__divider" aria-hidden="true" />
                <Tooltip
                  label={loading ? "Refreshing…" : "Refresh comments and flows"}
                  placement="bottom"
                >
                  <button
                    type="button"
                    className={[
                      "wpn-toolbar__refresh",
                      spinning || loading ? "wpn-toolbar__refresh--spinning" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label="Refresh comments and flows"
                    disabled={loading}
                    onClick={refreshPage}
                  >
                    <Icon name="refresh" className="wpn-toolbar__refresh-icon" />
                  </button>
                </Tooltip>
              </>
            )}
            {loggedOut ? null : error ? (
              <Tooltip label={error} placement="bottom">
                <button
                  type="button"
                  className="wpn-toolbar__retry"
                  aria-label={`Comments failed to load: ${error}. Retry`}
                  onClick={() => retry()}
                >
                  <Icon name="alert" className="wpn-toolbar__retry-icon" />
                  Retry
                </button>
              </Tooltip>
            ) : connectionState === "open" ? null : (
              <LiveStatus state={connectionState} />
            )}
            <span className="wpn-toolbar__divider" aria-hidden="true" />
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
          </>
        ) : null}
      </div>
      {launcher}
    </>
  );
}
