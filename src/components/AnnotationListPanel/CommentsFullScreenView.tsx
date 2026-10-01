import { useState } from "react";
import { Icon, Tooltip } from "../primitives";
import { CommentSummaryCard } from "./CommentSummaryCard";
import { CommentsSidebar } from "./CommentsSidebar";
import { PageTabsRow } from "./PageTabsRow";
import { ThreadDetailPane } from "./ThreadDetailPane";
import type { CommentFilters, CommentThread, PageGroup } from "./commentFilters";
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
  onCollapse,
  onCloseList,
}: CommentsFullScreenViewProps) {
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  // Full Screen's selection is local, not the app's global selectedId: picking
  // a card here renders the detail pane inline, instead of opening the
  // floating AnnotationThreadPanel that Minimize mode and on-page pins use.
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

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
              <Icon name="refresh" className={loading ? "wpn-icon-btn__icon--spinning" : undefined} />
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
              <h3 className="wpn-comments-full__section-title">
                Comments ({visibleThreads.length})
              </h3>
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
              {error ? null : (
                <ul className="wpn-comments-full__grid">
                  {visibleThreads.map((thread) => (
                    <CommentSummaryCard
                      key={thread.annotation.id}
                      thread={thread}
                      active={thread.annotation.id === selectedThreadId}
                      onSelect={setSelectedThreadId}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <ThreadDetailPane annotationId={selectedThreadId} />
      </div>
    </>
  );
}
