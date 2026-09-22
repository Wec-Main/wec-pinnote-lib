import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../context/AnnotationContext";
import { formatRelativeTime, formatTimestamp, getInitials } from "../../utils/format";
import { isDoneStatus, statusLabel } from "../../utils/status";
import { Icons } from "../../assets/icons";
import { Icon, SearchableSelect, Tooltip } from "../primitives";
import { isBoolean, isNumber, usePersistentState } from "../../hooks/usePersistentState";
import {
  DEFAULT_COMMENT_FILTERS,
  RESOLUTION_OPTIONS,
  SORT_OPTIONS,
  authorOptions,
  filterEntries,
  filtersActive,
  groupByAnnotation,
  statusOptions,
  toEntries,
  type CommentEntry,
  type CommentFilters,
  type CommentResolution,
  type CommentSort,
} from "./commentFilters";

const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 760;

function clampPanelWidth(value: number): number {
  const ceiling = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32);
  return Math.max(PANEL_MIN_WIDTH, Math.min(ceiling, Math.round(value)));
}

function CommentRow({
  entry,
  active,
  onSelect,
}: {
  entry: CommentEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const { comment, annotation } = entry;

  return (
    <li>
      <button
        type="button"
        className={[
          "wpn-list__item",
          active ? "wpn-list__item--active" : "",
          isDoneStatus(annotation.status) ? "wpn-list__item--resolved" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onSelect}
      >
        {comment.createdBy.avatarUrl ? (
          <img className="wpn-avatar" src={comment.createdBy.avatarUrl} alt="" />
        ) : (
          <span className="wpn-avatar wpn-avatar--fallback">
            {getInitials(comment.createdBy.name)}
          </span>
        )}
        <span className="wpn-list__copy">
          <span className="wpn-list__row">
            <strong>{comment.createdBy.name}</strong>
            {entry.replyIndex === 0 ? (
              <span
                className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}
              >
                {statusLabel(annotation.status)}
              </span>
            ) : (
              <span className="wpn-list__reply-tag">Reply</span>
            )}
          </span>
          <span className="wpn-list__meta">
            <time dateTime={comment.createdAt} title={formatTimestamp(comment.createdAt)}>
              {formatRelativeTime(comment.createdAt)}
            </time>
            {comment.updatedAt !== comment.createdAt ? (
              <>
                <span className="wpn-list__dot" aria-hidden="true">
                  ·
                </span>
                <span>edited</span>
              </>
            ) : null}
          </span>
          <span className="wpn-list__message">{comment.message}</span>
        </span>
      </button>
    </li>
  );
}

function AnnotationGroup({
  entries,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
}: {
  entries: CommentEntry[];
  selectedId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (annotationId: string) => void;
}) {
  const head = entries[0];
  if (!head) {
    return null;
  }
  const { annotation, label } = head;

  return (
    <li className="wpn-list__group">
      <div className="wpn-list__group-head">
        <button
          type="button"
          className="wpn-list__group-toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <Icon
            name="chevronDown"
            className={
              collapsed ? "wpn-list__chevron wpn-list__chevron--closed" : "wpn-list__chevron"
            }
          />
          <span className="wpn-list__pin">#{annotation.number}</span>
          <span className="wpn-list__group-label">{label}</span>
        </button>
        <span className="wpn-list__group-count">{entries.length}</span>
      </div>
      {collapsed ? null : (
        <ul className="wpn-list__group-items">
          {entries.map((entry) => (
            <CommentRow
              key={entry.comment.id}
              entry={entry}
              active={selectedId === entry.annotation.id}
              onSelect={() => onSelect(entry.annotation.id)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AnnotationListPanel() {
  const { annotations, config, loading, error, retry } = useAnnotationData();
  const { selectedId, revealAnnotation, setListOpen } = useAnnotationUi();

  const [filters, setFilters] = useState<CommentFilters>(DEFAULT_COMMENT_FILTERS);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [grouped, setGrouped] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsGrouped`,
    true,
    isBoolean,
  );
  const [expanded, setExpanded] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsExpanded`,
    false,
    isBoolean,
  );
  const [width, setWidth] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsWidth`,
    PANEL_DEFAULT_WIDTH,
    isNumber,
  );
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
        setWidth(next);
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setWidth],
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

  const allEntries = useMemo(() => toEntries(annotations), [annotations]);
  const entries = useMemo(
    () => filterEntries(allEntries, filters, config.currentUser.id),
    [allEntries, filters, config.currentUser.id],
  );
  const groups = useMemo(() => groupByAnnotation(entries), [entries]);
  const authors = useMemo(() => authorOptions(allEntries), [allEntries]);
  const statuses = useMemo(() => statusOptions(allEntries), [allEntries]);
  const active = filtersActive(filters);

  const update = <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleGroup = (annotationId: string) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(annotationId)) {
        next.delete(annotationId);
      } else {
        next.add(annotationId);
      }
      return next;
    });

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
          <span className="wpn-list__count">{entries.length}</span>
        </span>
        <div className="wpn-list-panel__header-actions">
          <Tooltip label={grouped ? "Show as flat list" : "Group by pin"} placement="bottom">
            <button
              type="button"
              className={grouped ? "wpn-icon-btn wpn-icon-btn--on" : "wpn-icon-btn"}
              aria-label={grouped ? "Show as flat list" : "Group by pin"}
              aria-pressed={grouped}
              onClick={() => setGrouped(!grouped)}
            >
              <Icon name="epic" />
            </button>
          </Tooltip>
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
      {entries.length === 0 && !loading && !error ? (
        <p className="wpn-muted">
          {allEntries.length === 0
            ? "No comments on this page."
            : "No comments match these filters."}
        </p>
      ) : null}

      {error ? null : (
        <ul className="wpn-list">
          {grouped
            ? [...groups.entries()].map(([annotationId, groupEntries]) => (
                <AnnotationGroup
                  key={annotationId}
                  entries={groupEntries}
                  selectedId={selectedId}
                  collapsed={collapsedGroups.has(annotationId)}
                  onToggle={() => toggleGroup(annotationId)}
                  onSelect={revealAnnotation}
                />
              ))
            : entries.map((entry) => (
                <CommentRow
                  key={`${entry.annotation.id}:${entry.comment.id}`}
                  entry={entry}
                  active={selectedId === entry.annotation.id}
                  onSelect={() => revealAnnotation(entry.annotation.id)}
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
