import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useAiSessions, type AiSessionsState } from "../../hooks/useAiSessions";
import { useSkeletonGate } from "../../hooks/useSkeletonGate";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { AiScopeKind, AiSession } from "../../types/ai.types";
import { createPortal } from "react-dom";
import {
  Icon,
  MenuPanel,
  RefreshingIndicator,
  SearchableSelect,
  type IconName,
} from "../primitives";
import { SessionListSkeleton } from "../loading/ScreenSkeletons";
import { formatAgo, isActiveTurn, providerLabel } from "./aiHelpers";
import { pinnedFirst, useAiPinnedSessions } from "./useAiPinnedSessions";

const SCOPE_ALL = "all";
const SCOPE_EDITOR = "editor";

type SessionScopeFilter = AiScopeKind | typeof SCOPE_EDITOR | "";

const EDITOR_ICONS: Record<AiScopeKind, IconName> = {
  project: "sparkles",
  data_model: "dataModel",
  flow: "flow",
  annotation: "comment",
  workspace: "sparkles",
};
export const SLOW_LOAD_MS = 6000;

interface SessionMenuProps {
  title: string;
  pinned: boolean;
  onRename: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}

function SessionMenu({ title, pinned, onRename, onTogglePin, onArchive }: SessionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);
  useEscapeKey(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, open);
  return (
    <span
      ref={wrapRef}
      className={["wpn-ai-session__menu", open ? "wpn-ai-session__menu--open" : ""].join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        className="wpn-icon-btn wpn-ai-session__more"
        aria-label={`More options for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div ref={portalRef} className="wpn-ai-scope wpn-ai-session__portal" data-theme="dark">
              <MenuPanel
                className="wpn-ai-session__menu-panel"
                placement="bottom-start"
                anchorRef={triggerRef}
                onRequestClose={close}
                items={[
                  {
                    type: "action",
                    id: "rename",
                    label: "Rename",
                    icon: "edit",
                    onSelect: onRename,
                  },
                  {
                    type: "action",
                    id: "pin",
                    label: pinned ? "Unpin" : "Pin",
                    icon: "pin",
                    onSelect: onTogglePin,
                  },
                  { type: "separator", id: "sep" },
                  {
                    type: "action",
                    id: "archive",
                    label: "Archive",
                    icon: "archive",
                    onSelect: onArchive,
                  },
                ]}
              />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

export const SCOPE_LABELS: Record<AiScopeKind, string> = {
  project: "Project",
  data_model: "Data model",
  flow: "Flow",
  annotation: "Comment",
  workspace: "Workspace",
};

export function sessionTitle(session: Pick<AiSession, "title"> | null | undefined): string {
  return session?.title?.trim() || "Untitled chat";
}

export function filterSessions(
  sessions: readonly AiSession[],
  search: string,
  scope: SessionScopeFilter = "",
): AiSession[] {
  const needle = search.trim().toLowerCase();
  return sessions.filter((session) => {
    if (scope === SCOPE_EDITOR) {
      if (session.kind !== "actions") return false;
    } else if (scope && session.scopeKind !== scope) return false;
    if (needle && !sessionTitle(session).toLowerCase().includes(needle)) return false;
    return true;
  });
}

export function InlineRename({
  value,
  onSave,
  onCancel,
  label = "Chat title",
}: {
  value: string;
  onSave: (title: string) => Promise<unknown> | void;
  onCancel: () => void;
  label?: string;
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onCancel();
  };

  useEscapeKey(finish, true);

  const commit = async () => {
    if (doneRef.current || saving) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === value) {
      finish();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      finish();
    } catch {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  };

  return (
    <input
      ref={inputRef}
      className="wpn-ai-input wpn-ai-rename"
      aria-label={label}
      value={text}
      maxLength={200}
      disabled={saving}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => void commit()}
    />
  );
}

interface AiSessionListProps {
  selectedId: string | null;
  onSelect: (aiSessionId: string) => void;
  onNew: () => void;
  state?: AiSessionsState;
  className?: string;
  onClose?: () => void;
}

export function AiSessionList({
  selectedId,
  onSelect,
  onNew,
  state: stateFromParent,
  className,
  onClose,
}: AiSessionListProps) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<SessionScopeFilter>("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const ownState = useAiSessions({ limit: 50, includeActions: true, enabled: !stateFromParent });
  const { sessions, loading, refreshing, error, hasMore, loadMore, rename, archive, reload } =
    stateFromParent ?? ownState;
  const pendingFirstLoad = Boolean(loading) && sessions.length === 0;
  const showSkeleton = useSkeletonGate(pendingFirstLoad);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pendingFirstLoad) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [pendingFirstLoad]);

  const pins = useAiPinnedSessions();
  const visible = useMemo(
    () => pinnedFirst(filterSessions(sessions, search, scope), pins.pinned),
    [pins.pinned, scope, search, sessions],
  );

  return (
    <aside
      className={["wpn-ai-sessions", className].filter(Boolean).join(" ")}
      aria-label="AI chats"
    >
      <div className="wpn-ai-sessions__head">
        <button
          type="button"
          className="wpn-btn wpn-btn--primary wpn-ai-sessions__new"
          onClick={onNew}
        >
          <Icon name="newChat" className="wpn-btn__icon" />
          New chat
        </button>
        {onClose ? (
          <button
            type="button"
            className="wpn-icon-btn wpn-ai-drawer__close"
            aria-label="Close chats"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      <div className="wpn-ai-sessions__tools">
        <label className="wpn-ai-sessions__search">
          <Icon name="search" className="wpn-ai-sessions__search-icon" />
          <input
            type="search"
            aria-label="Search chats"
            placeholder="Search chats"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <SearchableSelect
          options={[
            { value: SCOPE_ALL, label: "All chats" },
            { value: SCOPE_EDITOR, label: "Editor AI" },
            ...(Object.keys(SCOPE_LABELS) as AiScopeKind[]).map((value) => ({
              value,
              label: SCOPE_LABELS[value],
            })),
          ]}
          value={scope || SCOPE_ALL}
          onChange={(value) => setScope(value === SCOPE_ALL ? "" : (value as SessionScopeFilter))}
          ariaLabel="Filter by scope"
          size="sm"
          searchable={false}
        />
      </div>
      <div className="wpn-ai-sessions__label">
        <span>Recent</span>
        <RefreshingIndicator active={Boolean(refreshing)} label="" />
      </div>
      <ul className="wpn-ai-sessions__list">
        {showSkeleton ? <SessionListSkeleton /> : null}
        {error ? (
          <li className="wpn-ai-sessions__empty wpn-ai-card__warn" role="alert">
            {error}{" "}
            <button type="button" className="wpn-ai-link" onClick={reload}>
              Retry
            </button>
          </li>
        ) : null}
        {slow && !error ? (
          <li className="wpn-ai-sessions__empty wpn-ai-muted" role="status">
            Still loading your chats…{" "}
            <button type="button" className="wpn-ai-link" onClick={reload}>
              Retry
            </button>
          </li>
        ) : null}
        {actionError ? (
          <li className="wpn-ai-sessions__empty wpn-ai-card__warn" role="alert">
            {actionError}
          </li>
        ) : null}
        {!loading && !error && visible.length === 0 ? (
          <li className="wpn-ai-sessions__empty wpn-ai-muted">
            {search ? "No chats match." : "No chats yet."}
          </li>
        ) : null}
        {(showSkeleton ? [] : visible).map((session) => {
          const selected = session.aiSessionId === selectedId;
          return (
            <li
              key={session.aiSessionId}
              className={[
                "wpn-ai-session-row wpn-reveal",
                selected ? "wpn-ai-session-row--selected" : "",
              ].join(" ")}
            >
              {renaming === session.aiSessionId ? (
                <InlineRename
                  value={sessionTitle(session)}
                  onSave={(title) => rename(session.aiSessionId, title)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className={["wpn-ai-session", selected ? "wpn-ai-session--selected" : ""].join(
                      " ",
                    )}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(session.aiSessionId)}
                    onDoubleClick={() => setRenaming(session.aiSessionId)}
                  >
                    <span className="wpn-ai-session__title">
                      {isActiveTurn(session.activeTurn) ? (
                        <span className="wpn-ai-session__live" aria-label="Running" />
                      ) : null}
                      {session.kind === "actions" ? (
                        <Icon
                          name={EDITOR_ICONS[session.scopeKind]}
                          className="wpn-ai-session__kind"
                          aria-label="Created in the editor"
                        />
                      ) : null}
                      <span className="wpn-ai-session__text">{sessionTitle(session)}</span>
                    </span>
                    <span className="wpn-ai-session__meta">
                      {SCOPE_LABELS[session.scopeKind]}
                      {session.kind === "actions" ? " editor" : ""} ·{" "}
                      {providerLabel(session.provider)} ·{" "}
                      {formatAgo(session.lastMessageAt ?? session.createdAt)}
                    </span>
                  </button>
                  {pins.isPinned(session.aiSessionId) ? (
                    <Icon name="pin" className="wpn-ai-session__pin" />
                  ) : null}
                  <SessionMenu
                    title={sessionTitle(session)}
                    pinned={pins.isPinned(session.aiSessionId)}
                    onRename={() => setRenaming(session.aiSessionId)}
                    onTogglePin={() => pins.toggle(session.aiSessionId)}
                    onArchive={() => {
                      setActionError(null);
                      void archive(session.aiSessionId).catch(() =>
                        setActionError("Couldn't archive that chat. Try again."),
                      );
                    }}
                  />
                </>
              )}
            </li>
          );
        })}
        {hasMore ? (
          <li className="wpn-ai-sessions__more">
            <button type="button" className="wpn-ai-link" disabled={loading} onClick={loadMore}>
              {loading ? "Loading…" : "Load more"}
            </button>
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
