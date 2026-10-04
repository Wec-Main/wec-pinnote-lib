import { memo, useId } from "react";
import { Icon } from "../../../../components/primitives/Icon";
import { useIncrementalList } from "../../../../hooks/useIncrementalList";
import type { PageGroup } from "./commentFilters";
import { ThreadCard } from "./ThreadCard";

const THREAD_PAGE_SIZE = 20;

interface PageGroupSectionProps {
  group: PageGroup;
  collapsed: boolean;
  selectedId: string | null;
  currentUserId: string;
  openReplies: ReadonlySet<string>;
  presentIds: ReadonlySet<string>;
  onToggle: (pageKey: string) => void;
  onToggleReplies: (annotationId: string) => void;
  onSelect: (annotationId: string) => void;
}

export const PageGroupSection = memo(function PageGroupSection({
  group,
  collapsed,
  selectedId,
  currentUserId,
  openReplies,
  presentIds,
  onToggle,
  onToggleReplies,
  onSelect,
}: PageGroupSectionProps) {
  const listId = useId();
  const total = group.threads.length;
  const showLocation = group.location !== group.title;
  const selectedIndex = selectedId
    ? group.threads.findIndex((thread) => thread.annotation.id === selectedId)
    : -1;
  const { visible, remaining, showMore } = useIncrementalList(
    group.threads,
    THREAD_PAGE_SIZE,
    selectedIndex,
  );

  return (
    <section
      className={[
        "wpn-page-group",
        group.current ? "wpn-page-group--current" : "",
        collapsed ? "wpn-page-group--collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="wpn-page-group__header"
        aria-expanded={!collapsed}
        aria-controls={listId}
        onClick={() => onToggle(group.pageKey)}
      >
        <Icon name="chevronDown" className="wpn-page-group__chevron" />
        <span className="wpn-page-group__copy">
          <span className="wpn-page-group__title-row">
            <span className="wpn-page-group__title" title={group.title}>
              {group.title}
            </span>
            {group.current ? <span className="wpn-page-group__badge">This page</span> : null}
          </span>
          {showLocation ? (
            <span className="wpn-page-group__location" title={group.location}>
              {group.location}
            </span>
          ) : null}
        </span>
        <span
          className="wpn-page-group__total"
          title={`${total} ${total === 1 ? "comment" : "comments"}, ${group.openCount} unresolved`}
        >
          {total}
        </span>
      </button>
      {collapsed ? null : (
        <>
          <ul id={listId} className="wpn-thread-list wpn-page-group__list">
            {visible.map((thread) => (
              <ThreadCard
                key={thread.annotation.id}
                thread={thread}
                active={selectedId === thread.annotation.id}
                currentUserId={currentUserId}
                repliesCollapsed={!openReplies.has(thread.annotation.id)}
                inView={presentIds.has(thread.annotation.id)}
                onToggleReplies={onToggleReplies}
                onSelect={onSelect}
              />
            ))}
          </ul>
          {remaining > 0 ? (
            <button type="button" className="wpn-page-group__show-more" onClick={showMore}>
              <Icon name="chevronDown" className="wpn-page-group__show-more-icon" />
              Show {Math.min(remaining, THREAD_PAGE_SIZE)} more
            </button>
          ) : null}
        </>
      )}
    </section>
  );
});
