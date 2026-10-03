import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useSkeletonGate } from "../../hooks/useSkeletonGate";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import type { AiSessionsState } from "../../hooks/useAiSessions";
import type { AiSession } from "../../types/ai.types";
import { Icon } from "../primitives";
import { SessionListSkeleton } from "../loading/ScreenSkeletons";
import { formatAgo, isActiveTurn } from "./aiHelpers";
import { InlineRename, filterSessions, sessionTitle } from "./AiSessionList";
import { pinnedFirst, useAiPinnedSessions } from "./useAiPinnedSessions";

export interface AiSessionSwitcherProps {
  state: AiSessionsState;
  selectedId: string | null;
  current: AiSession | null;
  onSelect: (aiSessionId: string) => void;
}

export function AiSessionSwitcher({
  state,
  selectedId,
  current,
  onSelect,
}: AiSessionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const known = state.sessions.find((session) => session.aiSessionId === selectedId) ?? current;
  const label = selectedId ? sessionTitle(known) : "New chat";
  const showSkeleton = useSkeletonGate(Boolean(state.loading) && state.sessions.length === 0);
  const pins = useAiPinnedSessions();
  const visible = useMemo(
    () => pinnedFirst(filterSessions(state.sessions, search), pins.pinned),
    [pins.pinned, search, state.sessions],
  );

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setRenaming(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  const closeQuietly = useCallback(() => close(false), [close]);

  useEscapeKey(() => close(true), open && renaming === null);
  useOutsidePointerDown(wrapperRef, closeQuietly, open);

  return (
    <div ref={wrapperRef} className="wpn-ai-switch">
      <button
        ref={triggerRef}
        type="button"
        className="wpn-ai-switch__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className="wpn-ai-switch__label">{label}</span>
        <Icon name="chevronDown" className="wpn-ai-switch__chevron" />
      </button>
      {selectedId && !open ? (
        <button
          type="button"
          className="wpn-icon-btn wpn-ai-switch__rename"
          aria-label="Rename chat"
          onClick={() => {
            setOpen(true);
            setRenaming(selectedId);
          }}
        >
          <Icon name="edit" />
        </button>
      ) : null}
      {open ? (
        <div id={menuId} className="wpn-ai-switch__menu" role="group" aria-label="Recent chats">
          <input
            className="wpn-ai-input wpn-ai-switch__search"
            type="search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={search}
            autoFocus={renaming === null}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="wpn-ai-switch__list">
            {showSkeleton ? <SessionListSkeleton rows={4} /> : null}
            {!state.loading && visible.length === 0 ? (
              <li className="wpn-ai-switch__empty wpn-ai-muted">
                {search ? "No chats match." : "No chats yet."}
              </li>
            ) : null}
            {(showSkeleton ? [] : visible).map((session) => {
              const selected = session.aiSessionId === selectedId;
              return (
                <li
                  key={session.aiSessionId}
                  className={[
                    "wpn-ai-switch__item",
                    selected ? "wpn-ai-switch__item--on" : "",
                  ].join(" ")}
                >
                  {renaming === session.aiSessionId ? (
                    <InlineRename
                      value={sessionTitle(session)}
                      onSave={(title) => state.rename(session.aiSessionId, title)}
                      onCancel={() => setRenaming(null)}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="wpn-ai-switch__option"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => {
                          onSelect(session.aiSessionId);
                          close(true);
                        }}
                      >
                        <span className="wpn-ai-switch__option-title">
                          {pins.isPinned(session.aiSessionId) ? (
                            <Icon name="mapPin" className="wpn-ai-session__pin" />
                          ) : null}
                          {isActiveTurn(session.activeTurn) ? (
                            <span className="wpn-ai-session__live" aria-label="Running" />
                          ) : null}
                          {sessionTitle(session)}
                        </span>
                        <span className="wpn-ai-switch__option-meta">
                          {formatAgo(session.lastMessageAt ?? session.createdAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="wpn-icon-btn"
                        aria-label={`${pins.isPinned(session.aiSessionId) ? "Unpin" : "Pin"} ${sessionTitle(session)}`}
                        aria-pressed={pins.isPinned(session.aiSessionId)}
                        onClick={() => pins.toggle(session.aiSessionId)}
                      >
                        <Icon name="mapPin" />
                      </button>
                      <button
                        type="button"
                        className="wpn-icon-btn"
                        aria-label={`Rename ${sessionTitle(session)}`}
                        onClick={() => setRenaming(session.aiSessionId)}
                      >
                        <Icon name="edit" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
            {state.hasMore ? (
              <li className="wpn-ai-switch__more">
                <button type="button" className="wpn-ai-link" onClick={state.loadMore}>
                  Load more
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
