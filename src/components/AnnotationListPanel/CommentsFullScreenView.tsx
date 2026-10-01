import { useState } from "react";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { CommentsListTable } from "./CommentsListTable";
import { CommentSummaryCard } from "./CommentSummaryCard";
import { CommentsSidebar } from "./CommentsSidebar";
import { PageTabsRow } from "./PageTabsRow";
import { ThreadDetailPane } from "./ThreadDetailPane";
import type { CommentFilters, CommentThread, CommentsViewMode, PageGroup } from "./commentFilters";
import type { SelectOption } from "../primitives";

interface CommentsFullScreenViewProps {
  totalCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
  filters: CommentFilters;
  update: <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) => void;
  setFilters: (filters: CommentFilters) => void;
  authors: SelectOption[];
  statuses: SelectOption[];
  allThreads: CommentThread[];
  pageGroups: PageGroup[];
  viewMode: CommentsViewMode;
  onViewModeChange: (mode: CommentsViewMode) => void;
  onRevealOnPage: (annotationId: string) => void;
  onCollapse: () => void;
  onCloseList: () => void;
}

export function CommentsFullScreenView({
  totalCount,
  loading,
  error,
  retry,
  filters,
  update,
  setFilters,
  authors,
  statuses,
  allThreads,
  pageGroups,
  viewMode,
  onViewModeChange,
  onRevealOnPage,
  onCollapse,
  onCloseList,
}: CommentsFullScreenViewProps) {
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  // Full Screen's selection lives in context (not the app's global
  // selectedId — picking a card here renders the detail pane inline instead
  // of opening the floating AnnotationThreadPanel that Minimize mode and
  // on-page pins use) so it survives this view briefly unmounting, e.g.
  // while "open on page" temporarily hides the list to reveal a pin.
  const {
    commentsFullScreenSelectedThreadId: selectedThreadId,
    setCommentsFullScreenSelectedThreadId: setSelectedThreadId,
  } = useAnnotationUi();

  const effectiveActivePageKey =
    (activePageKey && pageGroups.some((group) => group.pageKey === activePageKey)
      ? activePageKey
      : null) ??
    pageGroups.find((group) => group.current)?.pageKey ??
    pageGroups[0]?.pageKey ??
    null;

  const activeGroup = pageGroups.find((group) => group.pageKey === effectiveActivePageKey) ?? null;
  const visibleThreads = activeGroup?.threads ?? [];

  return (
    <>
      <div className="wpn-panel__header">
        <span className="wpn-panel__title">
          Comments
          <span className="wpn-list__count">{totalCount}</span>
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
          <Tooltip label="Restore size" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Restore panel size"
              aria-pressed
              onClick={onCollapse}
            >
              <Icon name="collapse" />
            </button>
          </Tooltip>
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close list"
              onClick={onCloseList}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-comments-full">
        <CommentsSidebar
          allThreads={allThreads}
          filters={filters}
          update={update}
          setFilters={setFilters}
          authors={authors}
          statuses={statuses}
        />

        <div className="wpn-comments-full__main">
          <div className="wpn-comments-full__scroll">
            <PageTabsRow
              pageGroups={pageGroups}
              activePageKey={effectiveActivePageKey}
              onSelect={setActivePageKey}
            />

            <section className="wpn-comments-full__section">
              <div className="wpn-comments-full__section-head">
                <h3 className="wpn-comments-full__section-title">
                  Comments ({visibleThreads.length})
                </h3>
                <div className="wpn-view-toggle" role="group" aria-label="Comments layout">
                  <Tooltip label="Grid view" placement="bottom">
                    <button
                      type="button"
                      className={
                        viewMode === "grid"
                          ? "wpn-view-toggle__btn wpn-view-toggle__btn--active"
                          : "wpn-view-toggle__btn"
                      }
                      aria-pressed={viewMode === "grid"}
                      aria-label="Grid view"
                      onClick={() => onViewModeChange("grid")}
                    >
                      <Icon name="grid" />
                    </button>
                  </Tooltip>
                  <Tooltip label="List view" placement="bottom">
                    <button
                      type="button"
                      className={
                        viewMode === "list"
                          ? "wpn-view-toggle__btn wpn-view-toggle__btn--active"
                          : "wpn-view-toggle__btn"
                      }
                      aria-pressed={viewMode === "list"}
                      aria-label="List view"
                      onClick={() => onViewModeChange("list")}
                    >
                      <Icon name="list" />
                    </button>
                  </Tooltip>
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
              {!loading && !error && visibleThreads.length === 0 ? (
                <p className="wpn-muted">No comments match these filters.</p>
              ) : null}
              {error || visibleThreads.length === 0 ? null : viewMode === "grid" ? (
                <ul className="wpn-comments-full__grid">
                  {visibleThreads.map((thread) => (
                    <CommentSummaryCard
                      key={thread.annotation.id}
                      thread={thread}
                      active={thread.annotation.id === selectedThreadId}
                      onSelect={setSelectedThreadId}
                      onRevealOnPage={onRevealOnPage}
                    />
                  ))}
                </ul>
              ) : (
                <CommentsListTable
                  threads={visibleThreads}
                  selectedId={selectedThreadId}
                  onSelect={setSelectedThreadId}
                  onRevealOnPage={onRevealOnPage}
                />
              )}
            </section>
          </div>
        </div>

        <ThreadDetailPane annotationId={selectedThreadId} />
      </div>
    </>
  );
}
