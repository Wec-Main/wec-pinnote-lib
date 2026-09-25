import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { Icons } from "../../assets/icons";
import { Icon, SearchableSelect, Tooltip } from "../primitives";
import { usePersistentState } from "../../hooks/usePersistentState";
import { isBoolean, isNumber } from "../../utils/valueGuards";
import {
  DEFAULT_COMMENT_FILTERS,
  RESOLUTION_OPTIONS,
  SORT_OPTIONS,
  authorOptions,
  filterThreads,
  filtersActive,
  statusOptions,
  toThreads,
  type CommentFilters,
  type CommentResolution,
  type CommentSort,
} from "./commentFilters";
import { ThreadCard } from "./ThreadCard";

const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 760;

function clampPanelWidth(value: number): number {
  const ceiling = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32);
  return Math.max(PANEL_MIN_WIDTH, Math.min(ceiling, Math.round(value)));
}

export function AnnotationListPanel() {
  const { annotations, config, loading, error, retry } = useAnnotationData();
  const { selectedId, revealAnnotation, setListOpen } = useAnnotationUi();
  const currentUserId = config.currentUser.id;

  const openAnnotation = useCallback(
    (annotationId: string) => {
      revealAnnotation(annotationId);
      setListOpen(false);
    },
    [revealAnnotation, setListOpen],
  );

  const [filters, setFilters] = useState<CommentFilters>(DEFAULT_COMMENT_FILTERS);
  const [expandedReplies, setExpandedReplies] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsExpanded`,
    false,
    isBoolean,
  );
  const [persistedWidth, setPersistedWidth] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsWidth`,
    PANEL_DEFAULT_WIDTH,
    isNumber,
  );
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const width = liveWidth ?? persistedWidth;
  const widthRef = useRef(width);
  widthRef.current = width;
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = widthRef.current;
      setResizing(true);

      const onMove = (move: PointerEvent) => {
        const next = clampPanelWidth(startWidth + (startX - move.clientX));
        widthRef.current = next;
        setLiveWidth(next);
      };
      const onUp = () => {
        setResizing(false);
        setPersistedWidth(widthRef.current);
        setLiveWidth(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setPersistedWidth],
  );

  useEffect(() => {
    if (!resizing) {
      return;
    }
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [resizing]);

  const allThreads = useMemo(() => toThreads(annotations), [annotations]);
  const threads = useMemo(
    () => filterThreads(allThreads, filters, currentUserId),
    [allThreads, filters, currentUserId],
  );
  const authors = useMemo(() => authorOptions(allThreads), [allThreads]);
  const statuses = useMemo(() => statusOptions(allThreads), [allThreads]);
  const active = filtersActive(filters);

  const update = <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const firstThreadId = threads[0]?.annotation.id;
  const openReplies = useMemo(
    () => expandedReplies ?? new Set(firstThreadId ? [firstThreadId] : []),
    [expandedReplies, firstThreadId],
  );

  const toggleReplies = useCallback(
    (annotationId: string) =>
      setExpandedReplies((current) => {
        const next = new Set(current ?? openReplies);
        if (next.has(annotationId)) {
          next.delete(annotationId);
        } else {
          next.add(annotationId);
        }
        return next;
      }),
    [openReplies],
  );

  return (
    <div
      className={[
        "wpn-panel",
        "wpn-list-panel",
        expanded ? "wpn-list-panel--expanded" : "",
        resizing ? "wpn-list-panel--resizing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={expanded ? undefined : { width }}
    >
      {expanded ? null : (
        <div
          className="wpn-list-panel__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize comments panel"
          onPointerDown={startResize}
        />
      )}
      <div className="wpn-panel__header">
        <span className="wpn-panel__title">
          Comments
          <span className="wpn-list__count">{threads.length}</span>
        </span>
        <div className="wpn-list-panel__header-actions">
          <Tooltip label={loading ? "Refreshing..." : "Refresh"} placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Refresh comments"
              aria-busy={loading}
              disabled={loading}
              onClick={retry}
            >
              <Icon
                name="refresh"
                className={loading ? "wpn-icon-btn__icon--spinning" : undefined}
              />
            </button>
          </Tooltip>
          <Tooltip label={expanded ? "Restore size" : "Expand panel"} placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label={expanded ? "Restore panel size" : "Expand panel"}
              aria-pressed={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <Icon name={expanded ? "collapse" : "expand"} />
            </button>
          </Tooltip>
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close list"
              onClick={() => setListOpen(false)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-list-panel__filters">
        <div className="wpn-list-panel__filter-grid">
          <SearchableSelect
            options={RESOLUTION_OPTIONS}
            value={filters.resolution}
            onChange={(next) => update("resolution", (next || "all") as CommentResolution)}
            placeholder="All comments"
            searchPlaceholder="Search"
            ariaLabel="Filter by resolution"
            size="sm"
          />
          <SearchableSelect
            options={statuses}
            value={filters.status}
            onChange={(next) => update("status", next)}
            placeholder="Any status"
            searchPlaceholder="Search status"
            ariaLabel="Filter by status"
            size="sm"
            clearable
          />
          <SearchableSelect
            options={authors}
            value={filters.author}
            onChange={(next) => update("author", next)}
            placeholder="Anyone"
            searchPlaceholder="Search people"
            ariaLabel="Filter by author"
            size="sm"
            clearable
          />
          <SearchableSelect
            options={SORT_OPTIONS}
            value={filters.sort}
            onChange={(next) => update("sort", (next || "newest") as CommentSort)}
            placeholder="Sort"
            searchPlaceholder="Search sort"
            ariaLabel="Sort comments"
            size="sm"
          />
        </div>
        <div className="wpn-list-panel__filter-actions">
          <button
            type="button"
            className={filters.mineOnly ? "wpn-chip-toggle wpn-chip-toggle--on" : "wpn-chip-toggle"}
            aria-pressed={filters.mineOnly}
            onClick={() => update("mineOnly", !filters.mineOnly)}
          >
            <Icon name="users" className="wpn-chip-toggle__icon" />
            Only mine
          </button>
          <button
            type="button"
            className="wpn-chip-toggle wpn-chip-toggle--clear"
            disabled={!active}
            onClick={() => setFilters(DEFAULT_COMMENT_FILTERS)}
          >
            <Icon name="reset" className="wpn-chip-toggle__icon" />
            Clear
          </button>
        </div>
      </div>

      {loading ? <p className="wpn-muted">Loading annotations...</p> : null}
      {error ? (
        <div className="wpn-inline-error">
          <span>{error}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={retry}>
            <Icon name="refresh" className="wpn-btn__icon" />
            Retry
          </button>
        </div>
      ) : null}
      {threads.length === 0 && !loading && !error ? (
        <p className="wpn-muted">
          {allThreads.length === 0
            ? "No comments on this page."
            : "No comments match these filters."}
        </p>
      ) : null}

      {error ? null : (
        <ul className="wpn-list wpn-thread-list">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.annotation.id}
              thread={thread}
              active={selectedId === thread.annotation.id}
              currentUserId={currentUserId}
              repliesCollapsed={!openReplies.has(thread.annotation.id)}
              onToggleReplies={toggleReplies}
              onSelect={openAnnotation}
            />
          ))}
        </ul>
      )}

      <div className="wpn-list-panel__brand">
        <span>Powered by</span>
        <img src={Icons.wecLogo} alt="" />
        <span className="wpn-list-panel__brand-name">Wec.ai</span>
      </div>
    </div>
  );
}
