import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { useOptionalAiRuntime } from "../AiRuntimeContext";
import { useAnnotationAuth, useAnnotationUi } from "../../../context/AnnotationContext";
import { useAiSession } from "../../../hooks/useAiSession";
import { useAiSessions } from "../../../hooks/useAiSessions";
import { prefetchAiMe, prefetchAiSession, prefetchAiSessions } from "../prefetch";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { usePersistentState } from "../../../hooks/usePersistentState";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { AiChatView, useChatRoute, type AiSuggestion } from "./AiChatView";
import { AiSessionSwitcher } from "./AiSessionSwitcher";
import { aiReady, isActiveTurn } from "./aiHelpers";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";

interface FabPosition {
  x: number;
  y: number;
}

export interface DialogRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type AiFabState = "idle" | "running" | "done";

const FAB_SIZE = 52;
const EDGE = 12;
const GAP = 12;
const DRAG_THRESHOLD = 4;
const DONE_PULSE_MS = 4000;
export const AI_DIALOG_WIDTH = 420;
export const AI_DIALOG_HEIGHT = 640;
export const AI_SHEET_BREAKPOINT = 480;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const COMMENT_SUGGESTIONS: AiSuggestion[] = [
  {
    title: "Summarize open comments",
    prompt: "Summarize the open comments in this project and group them by theme.",
    icon: "comment",
  },
  {
    title: "What needs my attention?",
    prompt: "Which comments are waiting on me, blocked, or overdue?",
    icon: "alert",
  },
  {
    title: "Draft replies",
    prompt: "Suggest short replies for the unresolved comment threads.",
    icon: "reply",
  },
];

export const ERD_SUGGESTIONS: AiSuggestion[] = [
  {
    title: "Review this data model",
    prompt: "Review the open data model for naming, normalization and missing constraints.",
    icon: "dataModel",
  },
  {
    title: "Suggest missing fields",
    prompt: "Which entities in the open data model are missing common fields or relations?",
    icon: "plus",
  },
  {
    title: "Explain the relationships",
    prompt: "Explain how the entities in the open data model relate to each other.",
    icon: "info",
  },
];

export const FLOW_SUGGESTIONS: AiSuggestion[] = [
  {
    title: "Explain this flow",
    prompt: "Explain the open flow step by step in plain language.",
    icon: "flow",
  },
  {
    title: "Find gaps",
    prompt: "Find missing steps, dead ends or unclear branches in the open flow.",
    icon: "search",
  },
  {
    title: "Suggest edge cases",
    prompt: "List edge cases and error paths the open flow should handle.",
    icon: "alert",
  },
];

export function suggestionsFor(context: "comments" | "erd" | "flow"): AiSuggestion[] {
  if (context === "erd") return ERD_SUGGESTIONS;
  if (context === "flow") return FLOW_SUGGESTIONS;
  return COMMENT_SUGGESTIONS;
}

function isFabPosition(value: unknown): value is FabPosition | null {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const candidate = value as Partial<FabPosition>;
  return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
}

function clampFab(position: FabPosition): FabPosition {
  if (typeof window === "undefined") return position;
  return {
    x: Math.max(EDGE, Math.min(position.x, window.innerWidth - FAB_SIZE - EDGE)),
    y: Math.max(EDGE, Math.min(position.y, window.innerHeight - FAB_SIZE - EDGE)),
  };
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

export function anchorDialog(
  fab: { x: number; y: number; size: number },
  viewport: { width: number; height: number },
): DialogRect {
  const width = Math.min(AI_DIALOG_WIDTH, viewport.width - EDGE * 2);
  const height = Math.min(AI_DIALOG_HEIGHT, viewport.height - EDGE * 2);
  const left = clampRange(fab.x + fab.size - width, EDGE, viewport.width - width - EDGE);
  const above = fab.y - GAP - height;
  const below = fab.y + fab.size + GAP;
  const top =
    above >= EDGE
      ? above
      : below + height <= viewport.height - EDGE
        ? below
        : clampRange(above, EDGE, viewport.height - height - EDGE);
  return { left, top, width, height };
}

export function clampDialog(
  rect: DialogRect,
  viewport: { width: number; height: number },
): DialogRect {
  const width = Math.min(rect.width, viewport.width - EDGE * 2);
  const height = Math.min(rect.height, viewport.height - EDGE * 2);
  return {
    width,
    height,
    left: clampRange(rect.left, EDGE, viewport.width - width - EDGE),
    top: clampRange(rect.top, EDGE, viewport.height - height - EDGE),
  };
}

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.closest("[hidden]") && element.getAttribute("aria-hidden") !== "true",
  );
}

export function trapTab(container: HTMLElement, event: KeyboardEvent | ReactKeyboardEvent): void {
  if (event.key !== "Tab") return;
  const elements = focusables(container);
  if (elements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = elements[0] as HTMLElement;
  const last = elements[elements.length - 1] as HTMLElement;
  const active = document.activeElement;
  if (!container.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function useViewport(active: boolean): { width: number; height: number } {
  const read = () =>
    typeof window === "undefined"
      ? { width: 1024, height: 768 }
      : { width: window.innerWidth, height: window.innerHeight };
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    const onResize = () => setViewport(read());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);
  return viewport;
}

function useFabState(running: number, open: boolean): AiFabState {
  const previous = useRef(running);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (previous.current > 0 && running === 0 && !open) setDone(true);
    previous.current = running;
  }, [open, running]);
  useEffect(() => {
    if (open) setDone(false);
  }, [open]);
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => setDone(false), DONE_PULSE_MS);
    return () => clearTimeout(timer);
  }, [done]);
  if (running > 0) return "running";
  return done ? "done" : "idle";
}

export function AiFloatingButton() {
  const runtime = useOptionalAiRuntime();
  const { authenticated } = useAnnotationAuth();
  const available = useAiAvailable();
  const ai = useAiUi();
  const projectId = runtime?.projectId ?? "";
  const [stored, setStored] = usePersistentState<FabPosition | null>(
    `wpn-ui:${projectId}:aiFabPos`,
    null,
    isFabPosition,
  );
  const [dragPos, setDragPos] = useState<FabPosition | null>(null);
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setResizeTick((tick) => tick + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [open, setOpen] = useState(false);
  const justDragged = useRef(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visible = authenticated && available && aiReady(runtime?.me ?? null) && !ai?.panelOpen;
  const sessionsState = useAiSessions({ mine: true, limit: 20, enabled: visible });
  const running = sessionsState.sessions.filter((session) =>
    isActiveTurn(session.activeTurn),
  ).length;
  const fabState = useFabState(running, open);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  if (!visible) return null;

  const position = dragPos ?? (stored ? clampFab(stored) : null);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    state.moved = true;
    setDragPos(clampFab({ x: state.originX + dx, y: state.originY + dy }));
  };
  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    if (state?.moved) {
      justDragged.current = true;
      if (dragPos) setStored(dragPos);
      setDragPos(null);
    }
  };
  const warm = () => {
    if (!runtime || !runtime.enabled) return;
    const target = {
      apiBaseUrl: runtime.apiBaseUrl,
      projectId: runtime.projectId,
      getToken: runtime.getToken,
    };
    void prefetchAiMe(target);
    void prefetchAiSessions(target, { mine: true, limit: 20 });
    void prefetchAiSession(target, sessionsState.sessions[0]?.aiSessionId);
  };

  const onClick = () => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (open) close();
    else setOpen(true);
  };

  const fabStyle = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;
  const label =
    fabState === "running"
      ? `Ask AI, ${running} running`
      : fabState === "done"
        ? "Ask AI, finished"
        : "Ask AI";

  return (
    <>
      <Tooltip label={label} placement="left">
        <button
          ref={buttonRef}
          type="button"
          className={["wpn-ai-fab", `wpn-ai-fab--${fabState}`, open ? "wpn-ai-fab--open" : ""].join(
            " ",
          )}
          style={fabStyle}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          data-state={fabState}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          onPointerEnter={warm}
          onFocus={warm}
        >
          {fabState === "running" ? (
            <span className="wpn-ai-fab__orbit" aria-hidden="true" />
          ) : null}
          <Icon name={fabState === "done" ? "check" : "sparkles"} />
          {fabState === "running" ? <span className="wpn-ai-fab__badge">{running}</span> : null}
        </button>
      </Tooltip>
      {open ? (
        <AiChatDialog buttonRef={buttonRef} sessionsState={sessionsState} onClose={close} />
      ) : null}
    </>
  );
}

interface AiChatDialogProps {
  buttonRef: RefObject<HTMLButtonElement | null>;
  sessionsState: ReturnType<typeof useAiSessions>;
  onClose: () => void;
}

export function AiChatDialog({ buttonRef, sessionsState, onClose }: AiChatDialogProps) {
  const runtime = useOptionalAiRuntime();
  const ai = useAiUi();
  const ui = useAnnotationUi();
  const me = runtime?.me ?? null;
  const viewport = useViewport(true);
  const sheet = viewport.width < AI_SHEET_BREAKPOINT;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [chatChoice, setChatChoice] = useState<{ id: string | null } | null>({ id: null });
  const [dragged, setDragged] = useState<DialogRect | null>(null);
  const dragRef = useRef<{ x: number; y: number; rect: DialogRect } | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const recentId = chatChoice ? chatChoice.id : (sessionsState.sessions[0]?.aiSessionId ?? null);
  const session = useAiSession(recentId);
  const [route, setRoute] = useChatRoute(me, session, recentId);
  const context: "comments" | "erd" | "flow" = ui.dataModelOpen
    ? "erd"
    : ui.flowOpen
      ? "flow"
      : "comments";
  const suggestions = useMemo(() => suggestionsFor(context), [context]);
  const reconnecting = runtime?.connection === "reconnecting";

  useLayoutEffect(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ x: rect.left, y: rect.top });
  }, [buttonRef, viewport.width, viewport.height]);

  useEffect(() => {
    setDragged((current) => (current ? clampDialog(current, viewport) : current));
  }, [viewport]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.contains(document.activeElement)) {
      const field = dialog.querySelector<HTMLElement>("textarea:not([disabled])");
      (field ?? focusables(dialog)[0] ?? dialog).focus();
    }
  }, []);

  useEscapeKey(onClose, true);

  const rect: DialogRect | null = sheet
    ? null
    : (dragged ??
      (anchor
        ? anchorDialog({ x: anchor.x, y: anchor.y, size: FAB_SIZE }, viewport)
        : anchorDialog(
            {
              x: viewport.width - 20 - FAB_SIZE,
              y: viewport.height - 20 - FAB_SIZE,
              size: FAB_SIZE,
            },
            viewport,
          )));

  const onHeadPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (sheet || !rect || event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest("button, input, select, textarea, [role='listbox']")
    ) {
      return;
    }
    dragRef.current = { x: event.clientX, y: event.clientY, rect };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onHeadPointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = dragRef.current;
    if (!state) return;
    setDragged(
      clampDialog(
        {
          ...state.rect,
          left: state.rect.left + event.clientX - state.x,
          top: state.rect.top + event.clientY - state.y,
        },
        viewport,
      ),
    );
  };
  const onHeadPointerUp = () => {
    dragRef.current = null;
  };

  const startNew = () => setChatChoice({ id: null });
  const expand = () => {
    onClose();
    ai?.openPanel(recentId ? { aiSessionId: recentId } : { newSession: true });
  };

  const style = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : undefined;

  return (
    <div
      ref={dialogRef}
      className={["wpn-ai-dialog", sheet ? "wpn-ai-dialog--sheet" : ""].join(" ")}
      role="dialog"
      aria-label="AI chat"
      tabIndex={-1}
      style={style}
      onKeyDown={(event) => {
        if (dialogRef.current) trapTab(dialogRef.current, event);
      }}
    >
      <header
        className="wpn-ai-dialog__head"
        onPointerDown={onHeadPointerDown}
        onPointerMove={onHeadPointerMove}
        onPointerUp={onHeadPointerUp}
        onPointerCancel={onHeadPointerUp}
      >
        <span className="wpn-ai-dialog__spark" aria-hidden="true">
          <Icon name="sparkles" />
        </span>
        <AiSessionSwitcher
          state={sessionsState}
          selectedId={recentId}
          current={session.detail?.session ?? null}
          onSelect={(id) => setChatChoice({ id })}
        />
        <div className="wpn-ai-dialog__actions">
          <Tooltip label="New chat" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="New chat"
              disabled={!recentId}
              onClick={startNew}
            >
              <Icon name="newChat" />
            </button>
          </Tooltip>
          <Tooltip label="Expand" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Expand AI chat"
              onClick={expand}
            >
              <Icon name="expand" />
            </button>
          </Tooltip>
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label="Close AI chat"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      {reconnecting ? (
        <div className="wpn-ai-reconnecting" role="status">
          <span className="wpn-ai-reconnecting__dot" aria-hidden="true" />
          Reconnecting…
        </div>
      ) : null}
      <AiChatView
        aiSessionId={recentId}
        session={session}
        onSessionCreated={(id) => setChatChoice({ id })}
        route={route}
        onRouteChange={setRoute}
        showRoutePicker
        suggestions={suggestions}
        compact
      />
    </div>
  );
}
