import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useAnnotationAuth,
  useAnnotationData,
  useAnnotationUi,
} from "../../context/AnnotationContext";
import { AnnotationModeButton, AnnotationVisibilityToggle } from "../AnnotationToggleButton";
import { ToolbarAuthControl } from "../Auth";
import { Icons } from "../../assets/icons";
import { Icon, LiveStatus, Tooltip } from "../primitives";
import { LauncherPill } from "./LauncherButton";
import { PublishVersionButton } from "./PublishVersionButton";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { prefetchAiMe } from "../../ai/prefetch";
import { ExportDialogButton } from "./ExportDialogButton";
import { useAiUi } from "../Ai/AiUiContext";
import { useAiAvailable } from "../Ai/IntegrationsButton";
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
    dataModelOpen,
    setDataModelOpen,
    userManagementOpen,
    setUserManagementOpen,
    setAuditHistoryOpen,
    commentsFullScreenOpen,
    setModeEnabled,
    setFlowPinModeEnabled,
    setTagModeEnabled,
    selectAnnotation,
    requestCancelDraft,
  } = useAnnotationUi();
  const { activeAccount } = useAnnotationAuth();
  const aiRuntime = useOptionalAiRuntime();
  const warmSettings = () => {
    if (!activeAccount || !aiRuntime || !aiRuntime.enabled) return;
    void prefetchAiMe({
      apiBaseUrl: aiRuntime.apiBaseUrl,
      projectId: aiRuntime.projectId,
      getToken: aiRuntime.getToken,
    });
  };
  const aiUi = useAiUi();
  const aiPanelOpen = aiUi?.panelOpen ?? false;
  const aiAvailable = useAiAvailable();
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
  const [launcherOpen, setLauncherOpen] = useState(false);
  const launcherSuppressed = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  const hoverIn = () => {
    if (launcherSuppressed.current) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setLauncherOpen(true);
  };
  const hoverOut = () => {
    launcherSuppressed.current = false;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setLauncherOpen(false), 160);
  };
  const closeLauncher = () => {
    launcherSuppressed.current = true;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setLauncherOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const launcherExpanded = launcherOpen;
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

  const menuUp =
    !launcherPosition ||
    typeof window === "undefined" ||
    launcherPosition.y > window.innerHeight / 2;

  const closeBarForLauncher = () => {
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

  const pillActions: {
    key: string;
    label: string;
    active: boolean;
    blocked: boolean;
    accent?: boolean;
    tone?: string;
    icon: JSX.Element;
    run: () => void;
    intent?: () => void;
  }[] = [
    {
      key: "toolbar",
      tone: "139 92 246",
      label: barOpen ? "Close toolbar" : "Open toolbar",
      active: barOpen,
      blocked: false,
      icon: <img src={Icons.pen} alt="" className="wpn-launcher-item__icon" />,
      run: () => {
        if (barOpen) closeBarForLauncher();
        else {
          setPosition(null);
          setBarOpen(true);
        }
      },
    },
    {
      key: "draft",
      tone: "244 114 182",
      label: epicFlowOpen ? "Close Draft Board" : "Draft Board",
      active: epicFlowOpen,
      blocked: loggedOut,
      icon: <img src={Icons.epic} alt="" className="wpn-launcher-item__icon" />,
      run: () => setEpicFlowOpen(!epicFlowOpen),
    },
    {
      key: "flows",
      tone: "52 211 153",
      label: flowOpen ? "Close All Flows" : "All Flows",
      active: flowOpen,
      blocked: loggedOut,
      icon: <Icon name="flow" className="wpn-launcher-item__glyph" />,
      run: () => setFlowOpen(!flowOpen),
    },
    {
      key: "models",
      tone: "251 191 36",
      label: dataModelOpen ? "Close Data Models" : "Data Models",
      active: dataModelOpen,
      blocked: loggedOut,
      icon: <Icon name="dataModel" className="wpn-launcher-item__glyph" />,
      run: () => setDataModelOpen(!dataModelOpen),
    },
    {
      key: "settings",
      tone: "148 163 184",
      label: userManagementOpen ? "Close settings" : "Settings",
      active: userManagementOpen,
      blocked: loggedOut,
      icon: <img src={Icons.settings} alt="" className="wpn-launcher-item__icon" />,
      run: () => setUserManagementOpen(!userManagementOpen),
      intent: warmSettings,
    },
    ...(aiUi && aiAvailable
      ? [
          {
            key: "ai",
            label: aiPanelOpen ? "Close AI" : "Ask AI",
            active: aiPanelOpen,
            blocked: loggedOut,
            accent: true,
            icon: <Icon name="sparkles" className="wpn-launcher-item__glyph" />,
            run: () => (aiPanelOpen ? aiUi.closePanel() : aiUi.openPanel({ newSession: true })),
          },
        ]
      : []),
  ];

  const mainPills = pillActions.filter((item) => !item.accent);
  const aiPills = pillActions.filter((item) => item.accent);
  const renderPill = (item: (typeof pillActions)[number], order: number) => (
    <LauncherPill
      key={item.key}
      label={item.label}
      active={item.active}
      blocked={item.blocked}
      accent={item.accent}
      tone={item.tone}
      order={order}
      onIntent={item.intent}
      onActivate={guardedClick(() => {
        if (!item.blocked) {
          item.run();
          closeLauncher();
        }
      })}
    >
      {item.icon}
    </LauncherPill>
  );
  const ordered = menuUp ? [...mainPills, ...aiPills] : [...aiPills, ...mainPills];
  const dividerAt = menuUp ? mainPills.length : aiPills.length;

  const launcherShortcuts = (
    <div
      className="wpn-launcher__menu"
      role="menu"
      aria-label="Pinnote launcher"
      aria-hidden={!launcherExpanded}
    >
      <div className="wpn-launcher__panel">
        {ordered.map((item, index) => (
          <Fragment key={item.key}>
            {aiPills.length > 0 && index === dividerAt ? (
              <div className="wpn-launcher__divider" role="separator" />
            ) : null}
            {renderPill(item, menuUp ? ordered.length - 1 - index : index)}
          </Fragment>
        ))}
      </div>
    </div>
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

  const toggleLauncher = () => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (launcherOpen) closeLauncher();
    else {
      launcherSuppressed.current = false;
      setLauncherOpen(true);
    }
  };

  const launcher = (
    <div
      ref={setLauncherRef}
      className={[
        "wpn-launcher",
        launcherExpanded ? "wpn-launcher--open" : "",
        menuUp ? "wpn-launcher--up" : "wpn-launcher--down",
        launcherPosition ? "wpn-launcher--placed" : "wpn-launcher--docked",
      ]
        .filter(Boolean)
        .join(" ")}
      style={launcherPosition ? { left: launcherPosition.x, top: launcherPosition.y } : undefined}
      onPointerEnter={hoverIn}
      onPointerLeave={hoverOut}
      onFocus={hoverIn}
      onBlur={hoverOut}
    >
      <button
        type="button"
        className="wpn-launcher__fab"
        aria-label={launcherOpen ? "Close launcher" : "Open launcher"}
        aria-expanded={launcherExpanded}
        aria-haspopup="menu"
        title="Drag to move"
        onPointerDown={onLauncherDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onClick={toggleLauncher}
      >
        <span className="wpn-launcher__ring" aria-hidden="true" />
        <img src={Icons.wecLogo} alt="" className="wpn-launcher__logo" />
      </button>
      {launcherShortcuts}
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
          commentsFullScreenOpen ||
          epicFlowOpen ||
          flowOpen ||
          dataModelOpen ||
          userManagementOpen ||
          aiPanelOpen
            ? "wpn-toolbar--hidden"
            : "",
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
            <ExportDialogButton />
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
