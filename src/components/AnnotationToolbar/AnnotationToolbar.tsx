import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  useAnnotationAuth,
  useAnnotationData,
  useAnnotationUi,
} from "../../context/AnnotationContext";
import { AnnotationToggleButton } from "../AnnotationToggleButton";
import { ToolbarAuthControl } from "../Auth";
import { Icons } from "../../assets/icons";
import { Icon, Tooltip } from "../primitives";
import { isBoolean, usePersistentState } from "../../hooks/usePersistentState";

const EDGE = 8;
// Temporarily hidden from the launcher per product request; keep the Flow
// feature (state, panel, API) intact so this can be flipped back on.
const SHOW_FLOW_LAUNCHER_ICON = false;

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
  const { config, annotations, loading, error, retry, connectionState } = useAnnotationData();
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
    pinsVisible,
    setPinsVisible,
    tagModeEnabled,
    setTagModeEnabled,
    tagsVisible,
    setTagsVisible,
    flowPinModeEnabled,
    setFlowPinModeEnabled,
    flowPinsVisible,
    setFlowPinsVisible,
    setModeEnabled,
    selectAnnotation,
    requestCancelDraft,
  } = useAnnotationUi();
  const { activeAccount } = useAnnotationAuth();
  const toolbarRef = useRef<HTMLElement | null>(null);
  const setToolbarRef = (node: HTMLElement | null) => {
    toolbarRef.current = node;
  };
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const [position, setPosition] = usePersistentState<ToolbarPosition | null>(
    `wpn-ui:${config.projectId}:toolbarPosition`,
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
      const el = toolbarRef.current;
      if (!el || !position) {
        return;
      }
      setPosition(clampPosition(position.x, position.y, el.offsetWidth, el.offsetHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, setPosition]);

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

  const guardedClick = (action: () => void) => () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    action();
  };

  // Every panel behind these icons needs a signed-in actor, so a logged-out
  // visitor keeps the icon but cannot open the panel.
  const loggedOut = !activeAccount;

  const launcherShortcuts = (
    <>
      <Tooltip label={loggedOut ? "Log in first" : "EpicFlow"} placement="right">
        <button
          type="button"
          className={[
            "wpn-launcher-item",
            epicFlowOpen ? "wpn-launcher-item--active" : "",
            loggedOut ? "wpn-launcher-item--blocked" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Open EpicFlow"
          aria-pressed={epicFlowOpen}
          aria-disabled={loggedOut}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={guardedClick(() => {
            if (!loggedOut) {
              setEpicFlowOpen(true);
            }
          })}
        >
          <span className="wpn-launcher-item__icon-wrap">
            <img src={Icons.epic} alt="" className="wpn-launcher-item__icon" />
          </span>
        </button>
      </Tooltip>
      {SHOW_FLOW_LAUNCHER_ICON ? (
        <Tooltip label={loggedOut ? "Log in first" : "Flow"} placement="right">
          <button
            type="button"
            className={[
              "wpn-launcher-item",
              flowOpen ? "wpn-launcher-item--active" : "",
              loggedOut ? "wpn-launcher-item--blocked" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Open Flow"
            aria-pressed={flowOpen}
            aria-disabled={loggedOut}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onClick={guardedClick(() => {
              if (!loggedOut) {
                setFlowOpen(true);
              }
            })}
          >
            <span className="wpn-launcher-item__icon-wrap">
              <Icon name="flow" />
            </span>
          </button>
        </Tooltip>
      ) : null}
      <Tooltip
        label={loggedOut ? "Log in first" : userManagementOpen ? "Close settings" : "Settings"}
        placement="right"
      >
        <button
          type="button"
          className={[
            "wpn-launcher-item",
            userManagementOpen ? "wpn-launcher-item--active" : "",
            loggedOut ? "wpn-launcher-item--blocked" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={userManagementOpen ? "Close settings" : "Open settings"}
          aria-pressed={userManagementOpen}
          aria-disabled={loggedOut}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onClick={guardedClick(() => {
            if (!loggedOut) {
              setUserManagementOpen(!userManagementOpen);
            }
          })}
        >
          <span className="wpn-launcher-item__icon-wrap">
            <img src={Icons.settings} alt="" className="wpn-launcher-item__icon" />
          </span>
        </button>
      </Tooltip>
    </>
  );

  const closeBar = () => {
    // Drop back to the default bottom-left dock instead of computing a pixel
    // position: the launcher's real size doesn't match a hardcoded guess, and
    // computing it wrong is what made the launcher appear to "jump" on close.
    setPosition(null);
    setModeEnabled(false);
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
    <Tooltip label={barOpen ? "Close toolbar" : "Open toolbar"} placement="right">
      <button
        type="button"
        className={["wpn-launcher-item", barOpen ? "wpn-launcher-item--active" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={barOpen ? "Close annotation toolbar" : "Open annotation toolbar"}
        aria-pressed={barOpen}
        onPointerDown={barOpen ? undefined : onDragStart}
        onPointerMove={barOpen ? undefined : onDragMove}
        onPointerUp={barOpen ? undefined : onDragEnd}
        onPointerCancel={barOpen ? undefined : onDragEnd}
        onClick={barOpen ? closeBar : openToolbar}
      >
        <span className="wpn-launcher-item__icon-wrap">
          <img src={Icons.pen} alt="" className="wpn-launcher-item__icon" />
        </span>
      </button>
    </Tooltip>
  );

  // The launcher only follows a dragged `position` when it is the sole,
  // explicitly-placed element (toolbar closed and the user has dragged it).
  // Otherwise — toolbar open, or never dragged — it stays docked to its
  // default bottom-left corner via CSS rather than a computed inline position.
  const launcherPlaced = !barOpen && position;
  const launcher = (
    <div
      ref={barOpen ? undefined : setToolbarRef}
      className={[
        "wpn-toolbar",
        "wpn-toolbar--launcher",
        launcherExpanded ? "" : "wpn-toolbar--launcher-collapsed",
        launcherPlaced ? "wpn-toolbar--placed" : "wpn-toolbar--launcher-docked",
        barOpen ? "wpn-toolbar--launcher-locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={launcherPlaced ? { left: position.x, top: position.y } : undefined}
    >
      <Tooltip label={launcherExpanded ? "Collapse launcher" : "Expand launcher"} placement="right">
        <button
          type="button"
          className="wpn-launcher-item__logo-wrap"
          aria-label={launcherExpanded ? "Collapse launcher" : "Expand launcher"}
          aria-expanded={launcherExpanded}
          onPointerDown={barOpen ? undefined : onDragStart}
          onPointerMove={barOpen ? undefined : onDragMove}
          onPointerUp={barOpen ? undefined : onDragEnd}
          onPointerCancel={barOpen ? undefined : onDragEnd}
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
              onPointerDown={barOpen ? undefined : onDragStart}
              onPointerMove={barOpen ? undefined : onDragMove}
              onPointerUp={barOpen ? undefined : onDragEnd}
              onPointerCancel={barOpen ? undefined : onDragEnd}
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
            <Tooltip label={loggedOut ? "Log in first" : "Comments"} placement="bottom">
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
                aria-label="Toggle comments"
                onClick={() => {
                  if (!loggedOut) {
                    setListOpen(!listOpen);
                  }
                }}
              >
                <Icon name="comment" className="wpn-toolbar__list-icon" />
                <span className="wpn-toolbar__count">{annotations.length}</span>
              </button>
            </Tooltip>
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
            <Tooltip
              label={
                loggedOut ? "Log in first" : tagModeEnabled ? "Stop tagging" : "Tag an element"
              }
              placement="bottom"
            >
              <button
                type="button"
                className={[
                  "wpn-toggle",
                  tagModeEnabled ? "wpn-toggle--active" : "",
                  loggedOut ? "wpn-toggle--blocked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={tagModeEnabled}
                aria-disabled={loggedOut}
                aria-label={tagModeEnabled ? "Stop tagging" : "Tag an element"}
                onClick={() => setTagModeEnabled(!tagModeEnabled)}
              >
                <Icon name="tag" className="wpn-toggle__icon" />
              </button>
            </Tooltip>
            <Tooltip label={tagsVisible ? "Hide tags" : "Show tags"} placement="bottom">
              <button
                type="button"
                className={["wpn-toolbar__eye", tagsVisible ? "" : "wpn-toolbar__eye--hidden"]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={!tagsVisible}
                aria-label={tagsVisible ? "Hide tags" : "Show tags"}
                onClick={() => setTagsVisible(!tagsVisible)}
              >
                <Icon name={tagsVisible ? "eye" : "eyeOff"} className="wpn-toggle__icon" />
              </button>
            </Tooltip>
            {/* Comments only load for a signed-in actor, so refreshing and the
                failure it would report are meaningless while logged out. */}
            {loggedOut ? null : (
              <>
                <span className="wpn-toolbar__divider" aria-hidden="true" />
                <Tooltip
                  label={
                    loggedOut
                      ? "Log in first"
                      : flowPinModeEnabled
                        ? "Stop placing flows"
                        : "Place a flow"
                  }
                  placement="bottom"
                >
                  <button
                    type="button"
                    className={[
                      "wpn-toggle",
                      flowPinModeEnabled ? "wpn-toggle--active" : "",
                      loggedOut ? "wpn-toggle--blocked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={flowPinModeEnabled}
                    aria-disabled={loggedOut}
                    aria-label={flowPinModeEnabled ? "Stop placing flows" : "Place a flow"}
                    onClick={() => setFlowPinModeEnabled(!flowPinModeEnabled)}
                  >
                    <Icon name="flow" className="wpn-toggle__icon" />
                  </button>
                </Tooltip>
                <Tooltip label={flowPinsVisible ? "Hide flows" : "Show flows"} placement="bottom">
                  <button
                    type="button"
                    className={[
                      "wpn-toolbar__eye",
                      flowPinsVisible ? "" : "wpn-toolbar__eye--hidden",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={!flowPinsVisible}
                    aria-label={flowPinsVisible ? "Hide flows" : "Show flows"}
                    onClick={() => setFlowPinsVisible(!flowPinsVisible)}
                  >
                    <Icon name={flowPinsVisible ? "eye" : "eyeOff"} className="wpn-toggle__icon" />
                  </button>
                </Tooltip>
                <span className="wpn-toolbar__divider" aria-hidden="true" />
                <Tooltip label={loading ? "Refreshing..." : "Refresh comments"} placement="bottom">
                  <button
                    type="button"
                    className={[
                      "wpn-toolbar__refresh",
                      loading ? "wpn-toolbar__refresh--spinning" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label="Refresh comments"
                    disabled={loading}
                    onClick={() => retry()}
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
            ) : connectionState === "reconnecting" ? (
              <Tooltip label="Reconnecting to live updates" placement="bottom">
                <span
                  className="wpn-toolbar__live wpn-toolbar__live--reconnecting"
                  role="status"
                  aria-label="Reconnecting to live updates"
                >
                  <span className="wpn-toolbar__live-dot" />
                </span>
              </Tooltip>
            ) : connectionState === "unauthenticated" ? (
              <Tooltip label="Live updates paused, sign in again" placement="bottom">
                <span
                  className="wpn-toolbar__live wpn-toolbar__live--unauthenticated"
                  role="status"
                  aria-label="Live updates paused, sign in again"
                >
                  <span className="wpn-toolbar__live-dot" />
                </span>
              </Tooltip>
            ) : null}
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
