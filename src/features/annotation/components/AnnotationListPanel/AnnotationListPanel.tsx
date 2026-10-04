import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../../../../context/AnnotationContext";
import { Icons } from "../../../../assets/icons";
import { Icon } from "../../../../components/primitives/Icon";
import { RefreshingIndicator } from "../../../../components/primitives/Skeleton";
import { SearchableSelect } from "../../../../components/primitives/SearchableSelect";
import { Switch } from "../../../../components/primitives/Switch";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import { AnnotationListSkeleton } from "../../../../components/Loading/ScreenSkeletons";
import { useSkeletonGate } from "../../../../hooks/useSkeletonGate";
import { usePersistentState } from "../../../../hooks/usePersistentState";
import { useAnnotationPresence } from "../../../../hooks/useAnnotationPresence";
import { isBoolean, isNumber } from "../../../../utils/valueGuards";
import {
  DEFAULT_COMMENT_FILTERS,
  RESOLUTION_OPTIONS,
  SORT_OPTIONS,
  authorOptions,
  filterThreads,
  groupThreadsByPage,
  isCommentsViewMode,
  statusOptions,
  toThreads,
  type CommentFilters,
  type CommentResolution,
  type CommentSort,
} from "./commentFilters";
import { PageGroupSection } from "./PageGroupSection";
import { CommentsFullScreenView } from "./CommentsFullScreenView";

const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 760;

function clampPanelWidth(value: number): number {
  const ceiling = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32);
  return Math.max(PANEL_MIN_WIDTH, Math.min(ceiling, Math.round(value)));
}

export function AnnotationListPanel() {
  const {
    config,
    pageKey,
    allAnnotations,
    allAnnotationsLoading: loading,
    allAnnotationsError: error,
    reloadAllAnnotations: retry,
  } = useAnnotationData();
  const {
    selectedId,
    revealAnnotation,
    revealAnnotationAndHideList,
    setListOpen,
    setCommentsFullScreenOpen,
  } = useAnnotationUi();
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
  const [viewMode, setViewMode] = usePersistentState(
    `wpn-ui:${config.projectId}:commentsViewMode`,
    "list",
    isCommentsViewMode,
  );
  useEffect(() => {
    setCommentsFullScreenOpen(expanded);
    return () => setCommentsFullScreenOpen(false);
  }, [expanded, setCommentsFullScreenOpen]);

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

  const presentIds = useAnnotationPresence(allAnnotations);
  const allThreads = useMemo(() => toThreads(allAnnotations), [allAnnotations]);
  const threads = useMemo(
    () => filterThreads(allThreads, filters, currentUserId, pageKey),
    [allThreads, filters, currentUserId, pageKey],
  );
  const pageGroups = useMemo(() => groupThreadsByPage(threads, pageKey), [threads, pageKey]);
  const [pageExpansion, setPageExpansion] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const isPageExpanded = (groupPageKey: string) =>
    pageExpansion.get(groupPageKey) ?? groupPageKey === pageKey;
  const allCollapsed =
    pageGroups.length > 0 && pageGroups.every((group) => !isPageExpanded(group.pageKey));
  const togglePage = useCallback(
    (groupPageKey: string) =>
      setPageExpansion((current) =>
        new Map(current).set(
          groupPageKey,
          !(current.get(groupPageKey) ?? groupPageKey === pageKey),
        ),
      ),
    [pageKey],
  );
  const toggleAllPages = () =>
    setPageExpansion(new Map(pageGroups.map((group) => [group.pageKey, allCollapsed])));
  const authors = useMemo(() => authorOptions(allThreads), [allThreads]);
  const statuses = useMemo(() => statusOptions(allThreads), [allThreads]);

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

  const showSkeleton = useSkeletonGate(loading && allThreads.length === 0);

  if (expanded) {
    return (
      <div className="wpn-panel wpn-list-panel wpn-list-panel--expanded">
        <CommentsFullScreenView
          totalCount={threads.length}
          loading={loading}
          error={error}
          retry={retry}
          filters={filters}
          update={update}
          setFilters={setFilters}
          authors={authors}
          statuses={statuses}
          allThreads={allThreads}
          pageGroups={pageGroups}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRevealOnPage={revealAnnotationAndHideList}
          onCollapse={() => setExpanded(false)}
          onCloseList={() => setListOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={["wpn-panel", "wpn-list-panel", resizing ? "wpn-list-panel--resizing" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ width }}
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
            clearable
            clearValue="all"
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
            clearable
            clearValue="newest"
          />
        </div>
        <div className="wpn-list-panel__filter-actions">
          <span className="wpn-filter-switch">
            <Switch
              label="Only mine"
              checked={filters.mineOnly}
              onChange={(next) => update("mineOnly", next)}
            />
            <span className="wpn-filter-switch__text">Only mine</span>
          </span>
          <span className="wpn-filter-switch">
            <Switch
              label="This page only"
              checked={filters.thisPageOnly}
              onChange={(next) => update("thisPageOnly", next)}
            />
            <span className="wpn-filter-switch__text">This page only</span>
          </span>
          <button
            type="button"
            className="wpn-chip-toggle wpn-chip-toggle--clear"
            onClick={() => setFilters(DEFAULT_COMMENT_FILTERS)}
          >
            <Icon name="reset" className="wpn-chip-toggle__icon" />
            Clear
          </button>
        </div>
      </div>

      <div className="wpn-list-panel__content">
        {showSkeleton ? <AnnotationListSkeleton /> : null}
        <RefreshingIndicator
          active={loading && allThreads.length > 0}
          label="Refreshing comments"
        />
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
              ? "No comments in this project yet."
              : "No comments match these filters."}
          </p>
        ) : null}

        {error || pageGroups.length === 0 ? null : (
          <>
            <div className="wpn-page-groups__summary">
              <span>
                {pageGroups.length} {pageGroups.length === 1 ? "page" : "pages"}
              </span>
              <button
                type="button"
                className="wpn-page-groups__toggle-all"
                onClick={toggleAllPages}
              >
                <Icon name={allCollapsed ? "chevronDown" : "chevronUp"} />
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            </div>
            <div className="wpn-list wpn-page-groups">
              {pageGroups.map((group) => (
                <PageGroupSection
                  key={group.pageKey}
                  group={group}
                  collapsed={!isPageExpanded(group.pageKey)}
                  selectedId={selectedId}
                  currentUserId={currentUserId}
                  openReplies={openReplies}
                  presentIds={presentIds}
                  onToggle={togglePage}
                  onToggleReplies={toggleReplies}
                  onSelect={openAnnotation}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="wpn-list-panel__brand">
        <span>Powered by</span>
        <img src={Icons.wecLogo} alt="" />
        <span className="wpn-list-panel__brand-name">Wec.ai</span>
      </div>
    </div>
  );
}
