import { useCallback, useState } from "react";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { mentionsToPlainText } from "../../utils/mentions";
import { Icon, ListSearchBar, RefreshButton, TablePagination, Tooltip } from "../primitives";
import { AnnotationListSkeleton } from "../loading/ScreenSkeletons";
import { useSkeletonGate } from "../../hooks/useSkeletonGate";
import { CommentsListTable } from "./CommentsListTable";
import { CommentSummaryCard } from "./CommentSummaryCard";
import { CommentsSidebar } from "./CommentsSidebar";
import { PageTabsRow } from "./PageTabsRow";
import { ThreadDetailPane } from "./ThreadDetailPane";
import type { CommentFilters, CommentThread, CommentsViewMode, PageGroup } from "./commentFilters";
import type { SelectOption } from "../primitives";

const DEFAULT_PAGE_SIZE = 10;

function matchesSearch(thread: CommentThread, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [
    thread.label,
    mentionsToPlainText(thread.root.message),
    thread.root.createdBy.name,
    ...thread.replies.map((reply) => reply.createdBy.name),
  ].some((value) => value.toLowerCase().includes(needle));
}

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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const {
    commentsFullScreenSelectedThreadId: selectedThreadId,
    setCommentsFullScreenSelectedThreadId: setSelectedThreadId,
  } = useAnnotationUi();

  const closeThreadPreview = useCallback(
    () => setSelectedThreadId(null),
    [setSelectedThreadId],
  );

  const effectiveActivePageKey =
    (activePageKey && pageGroups.some((group) => group.pageKey === activePageKey)
      ? activePageKey
      : null) ??
    pageGroups.find((group) => group.current)?.pageKey ??
    pageGroups[0]?.pageKey ??
    null;

  const activeGroup = pageGroups.find((group) => group.pageKey === effectiveActivePageKey) ?? null;
  const visibleThreads = (activeGroup?.threads ?? []).filter((thread) =>
    matchesSearch(thread, searchQuery),
  );
  const lastPage = Math.max(1, Math.ceil(visibleThreads.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const pagedThreads = visibleThreads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const showSkeleton = useSkeletonGate(loading && allThreads.length === 0);

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  return (
    <>
      <div className="wpn-panel__header">
        <span className="wpn-panel__title">
          Comments
          <span className="wpn-list__count">{totalCount}</span>
        </span>
        <div className="wpn-list-panel__header-actions">
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
          <div className="wpn-comments-full__section-head">
            <h3 className="wpn-comments-full__section-title">
              <Icon name="comment" className="wpn-comments-full__section-icon" />
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
          <div className="wpn-comments-full__scroll">
            <PageTabsRow
              pageGroups={pageGroups}
              activePageKey={effectiveActivePageKey}
              onSelect={(pageKey) => {
                setActivePageKey(pageKey);
                setPage(1);
              }}
            />

            <section className="wpn-comments-full__section">
              <ListSearchBar
                value={searchInput}
                onValueChange={setSearchInput}
                onSubmit={() => {
                  setSearchQuery(searchInput);
                  setPage(1);
                }}
                onClear={clearSearch}
                placeholder="Search comment, element or author"
                trailing={
                  <RefreshButton label="Refresh comments" loading={loading} onRefresh={retry} />
                }
              />
              <div className="wpn-table-card">
                {showSkeleton ? <AnnotationListSkeleton /> : null}
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
                    {pagedThreads.map((thread) => (
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
                    threads={pagedThreads}
                    selectedId={selectedThreadId}
                    onSelect={setSelectedThreadId}
                    onClosePreview={closeThreadPreview}
                    onRevealOnPage={onRevealOnPage}
                  />
                )}
                {error ? null : (
                  <TablePagination
                    page={currentPage}
                    pageSize={pageSize}
                    totalItems={visibleThreads.length}
                    itemLabel="comments"
                    onPageChange={setPage}
                    onPageSizeChange={(next) => {
                      setPageSize(next);
                      setPage(1);
                    }}
                  />
                )}
              </div>
            </section>
          </div>
        </div>

        <ThreadDetailPane
          annotationId={selectedThreadId}
          onClose={() => setSelectedThreadId(null)}
        />
      </div>
    </>
  );
}
