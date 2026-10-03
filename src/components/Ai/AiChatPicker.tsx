import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { AiSession } from "../../types/ai.types";
import { Icon } from "../primitives";
import { formatAgo, isActiveTurn } from "./aiHelpers";
import { InlineRename, sessionTitle } from "./AiSessionList";

export interface AiChatPickerProps {
  chats: readonly AiSession[];
  activeId: string | null;
  isNew: boolean;
  disabled?: boolean;
  onSelect: (aiSessionId: string) => void;
  onNew: () => void;
  onRename: (aiSessionId: string, title: string) => Promise<unknown> | void;
  onArchive: (aiSessionId: string) => Promise<unknown> | void;
}

const SEARCH_FROM = 6;
const MENU_WIDTH = 320;
const MENU_GAP = 8;
const MENU_EDGE = 12;

function position(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - MENU_EDGE;
  const above = rect.top - MENU_EDGE;
  const left = Math.max(MENU_EDGE, Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_EDGE));
  if (below >= 280 || below >= above) {
    return { left, top: rect.bottom + MENU_GAP, maxHeight: Math.max(180, Math.min(420, below)) };
  }
  return {
    left,
    bottom: window.innerHeight - rect.top + MENU_GAP,
    maxHeight: Math.max(180, Math.min(420, above)),
  };
}

export function AiChatPicker({
  chats,
  activeId,
  isNew,
  disabled = false,
  onSelect,
  onNew,
  onRename,
  onArchive,
}: AiChatPickerProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = chats.find((chat) => chat.aiSessionId === activeId) ?? null;
  const label = isNew ? "New chat" : active ? sessionTitle(active) : "New chat";

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setRenaming(null);
    setConfirming(null);
  }, []);

  useEscapeKey(close, open);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const reposition = () => {
      if (triggerRef.current) setStyle(position(triggerRef.current));
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, close]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? chats.filter((chat) => sessionTitle(chat).toLowerCase().includes(needle))
      : chats;
  }, [chats, search]);

  const toggle = () => {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    if (triggerRef.current) setStyle(position(triggerRef.current));
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="wpn-ai-chats__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? "Wait for the AI to finish to switch chats" : "Switch chat"}
        onClick={toggle}
      >
        <Icon name="history" className="wpn-ai-chats__trigger-icon" />
        <span className="wpn-ai-chats__trigger-label">{label}</span>
        <Icon name="chevronDown" className="wpn-ai-chats__trigger-caret" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="wpn-ai-scope wpn-ai-chats__portal" data-theme="dark">
              <div
                ref={menuRef}
                className="wpn-ai-chats__menu"
                role="dialog"
                aria-label="Chats"
                style={style}
              >
                <div className="wpn-ai-chats__head">
                  <span className="wpn-ai-chats__title">Chats</span>
                  <button
                    type="button"
                    className="wpn-ai-chats__new"
                    onClick={() => {
                      onNew();
                      close();
                    }}
                  >
                    <Icon name="plus" />
                    New chat
                  </button>
                </div>
                {chats.length >= SEARCH_FROM ? (
                  <label className="wpn-ai-chats__search">
                    <Icon name="search" />
                    <input
                      type="search"
                      aria-label="Search chats"
                      placeholder="Search chats"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                ) : null}
                <ul className="wpn-ai-chats__list">
                  {isNew ? (
                    <li className="wpn-ai-chats__row wpn-ai-chats__row--active">
                      <span className="wpn-ai-chats__text">
                        <span className="wpn-ai-chats__name">New chat</span>
                        <span className="wpn-ai-chats__meta">Starts with your next request</span>
                      </span>
                      <Icon name="check" className="wpn-ai-chats__check" />
                    </li>
                  ) : null}
                  {visible.length === 0 && !isNew ? (
                    <li className="wpn-ai-chats__empty">
                      {search ? "No chats match." : "No earlier chats for this document yet."}
                    </li>
                  ) : null}
                  {visible.map((chat) => {
                    const selected = !isNew && chat.aiSessionId === activeId;
                    return (
                      <li
                        key={chat.aiSessionId}
                        className={[
                          "wpn-ai-chats__row",
                          selected ? "wpn-ai-chats__row--active" : "",
                        ].join(" ")}
                      >
                        {renaming === chat.aiSessionId ? (
                          <InlineRename
                            value={sessionTitle(chat)}
                            onSave={(title) => onRename(chat.aiSessionId, title)}
                            onCancel={() => setRenaming(null)}
                          />
                        ) : confirming === chat.aiSessionId ? (
                          <span className="wpn-ai-chats__confirm">
                            <span>Delete this chat?</span>
                            <button
                              type="button"
                              className="wpn-ai-chats__danger"
                              onClick={() => {
                                void Promise.resolve(onArchive(chat.aiSessionId)).finally(() =>
                                  setConfirming(null),
                                );
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="wpn-ai-chats__plain"
                              onClick={() => setConfirming(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="wpn-ai-chats__pick"
                              aria-current={selected ? "true" : undefined}
                              onClick={() => {
                                onSelect(chat.aiSessionId);
                                close();
                              }}
                            >
                              <span className="wpn-ai-chats__text">
                                <span className="wpn-ai-chats__name">
                                  {isActiveTurn(chat.activeTurn) ? (
                                    <span className="wpn-ai-session__live" aria-label="Running" />
                                  ) : null}
                                  {sessionTitle(chat)}
                                </span>
                                <span className="wpn-ai-chats__meta">
                                  {formatAgo(chat.lastMessageAt ?? chat.updatedAt)}
                                </span>
                              </span>
                              {selected ? (
                                <Icon name="check" className="wpn-ai-chats__check" />
                              ) : null}
                            </button>
                            <span className="wpn-ai-chats__actions">
                              <button
                                type="button"
                                aria-label={`Rename ${sessionTitle(chat)}`}
                                title="Rename"
                                onClick={() => setRenaming(chat.aiSessionId)}
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${sessionTitle(chat)}`}
                                title="Delete"
                                onClick={() => setConfirming(chat.aiSessionId)}
                              >
                                <Icon name="trash" />
                              </button>
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
