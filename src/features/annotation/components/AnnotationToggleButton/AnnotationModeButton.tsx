import { useEffect, useRef, useState } from "react";
import { useAnnotationContext } from "../../../../context/AnnotationContext";
import { useEscapeKey } from "../../../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../../../hooks/useOutsidePointerDown";
import { Icon, type IconName } from "../../../../components/primitives/Icon";
import { MenuPanel, type MenuItemDefinition } from "../../../../components/primitives/Menu";
import { Tooltip } from "../../../../components/primitives/Tooltip";

type AnnotationMode = "annotate" | "tag" | "flow";

const MODE_CYCLE: (AnnotationMode | null)[] = [null, "annotate", "flow"];

const MODE_ICON: Record<AnnotationMode, IconName> = {
  annotate: "annotateCursor",
  tag: "tag",
  flow: "flow",
};

const MODE_LABEL: Record<AnnotationMode, string> = {
  annotate: "Comments",
  tag: "Tags",
  flow: "Flows",
};

const MODE_STOP_LABEL: Record<AnnotationMode, string> = {
  annotate: "annotating",
  tag: "tagging an element",
  flow: "placing a flow",
};

export function AnnotationModeButton() {
  const {
    modeEnabled,
    setModeEnabled,
    draft,
    tagModeEnabled,
    setTagModeEnabled,
    tagDraft,
    flowPinModeEnabled,
    setFlowPinModeEnabled,
    flowPinDraft,
    activeAccount,
  } = useAnnotationContext();
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loggedOut = !activeAccount;

  const close = () => setOpen(false);
  useOutsidePointerDown(rootRef, close, open);
  useEscapeKey(close, open);

  useEffect(() => {
    if (open) {
      setCountdownPaused(false);
    }
  }, [open]);

  const pauseCountdown = () => setCountdownPaused(true);

  useEffect(() => {
    if (!loggedOut) {
      setNudge(false);
    }
  }, [loggedOut]);

  useEffect(() => {
    if (!nudge) {
      return;
    }
    const timer = window.setTimeout(() => setNudge(false), 400);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  const activeMode: AnnotationMode | null = flowPinModeEnabled
    ? "flow"
    : tagModeEnabled
      ? "tag"
      : modeEnabled
        ? "annotate"
        : null;
  const isActive = activeMode !== null && !draft && !tagDraft && !flowPinDraft;

  const setMode = (mode: AnnotationMode) => {
    if (mode === "annotate") {
      setModeEnabled(true);
    } else if (mode === "tag") {
      setTagModeEnabled(true);
    } else {
      setFlowPinModeEnabled(true);
    }
  };

  const stopMode = () => {
    if (activeMode === "annotate") {
      setModeEnabled(false);
    } else if (activeMode === "tag") {
      setTagModeEnabled(false);
    } else if (activeMode === "flow") {
      setFlowPinModeEnabled(false);
    }
  };

  const cycleMode = (direction: 1 | -1) => {
    const currentIndex = MODE_CYCLE.indexOf(activeMode);
    const nextIndex = (currentIndex === -1 ? 0 : currentIndex) + direction + MODE_CYCLE.length;
    const nextMode = MODE_CYCLE[nextIndex % MODE_CYCLE.length];
    if (nextMode) {
      setMode(nextMode);
    } else {
      stopMode();
    }
  };
  const cycleModeRef = useRef(cycleMode);
  cycleModeRef.current = cycleMode;
  const loggedOutRef = useRef(loggedOut);
  loggedOutRef.current = loggedOut;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.key !== "Tab" || loggedOutRef.current) {
        return;
      }
      event.preventDefault();
      setOpen(false);
      cycleModeRef.current(event.shiftKey ? -1 : 1);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const items: MenuItemDefinition[] = (["annotate", "flow"] as const).map((mode) => ({
    type: "action",
    id: mode,
    label: MODE_LABEL[mode],
    icon: MODE_ICON[mode],
    onSelect: () => setMode(mode),
  }));

  const label = loggedOut
    ? "Select your name to start annotating"
    : isActive && activeMode
      ? `Stop ${MODE_STOP_LABEL[activeMode]}`
      : "Annotate or place a flow";

  return (
    <div className="wpn-menu" ref={rootRef}>
      <Tooltip label={label} placement="bottom">
        <button
          ref={triggerRef}
          type="button"
          className={[
            "wpn-toggle",
            isActive ? "wpn-toggle--active" : "",
            loggedOut ? "wpn-toggle--blocked" : "",
            nudge ? "wpn-toggle--nudge" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-pressed={isActive}
          aria-disabled={loggedOut}
          aria-label={label}
          onClick={() => {
            if (loggedOut) {
              setNudge(true);
              return;
            }
            if (isActive) {
              stopMode();
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <Icon
            name={activeMode ? MODE_ICON[activeMode] : "annotateCursor"}
            className="wpn-toggle__icon"
          />
        </button>
      </Tooltip>
      {isActive ? (
        <Tooltip label="Switch mode" placement="bottom">
          <button
            type="button"
            className="wpn-toggle wpn-toggle--caret"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Switch annotation mode"
            onClick={() => setOpen((current) => !current)}
          >
            <Icon name="chevronDown" className="wpn-toggle__icon wpn-toggle__icon--sm" />
          </button>
        </Tooltip>
      ) : null}
      {open ? (
        <MenuPanel
          items={items}
          placement="bottom-start"
          anchorRef={triggerRef}
          onRequestClose={close}
          onInteract={pauseCountdown}
          className={[
            "wpn-menu__panel--countdown",
            countdownPaused ? "wpn-menu__panel--countdown-paused" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}
    </div>
  );
}
