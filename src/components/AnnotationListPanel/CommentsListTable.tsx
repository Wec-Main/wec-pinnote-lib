import { formatRelativeTime, getInitials } from "../../utils/format";
import { statusLabel } from "../../utils/status";
import { Icon, Tooltip } from "../primitives";
import type { CommentThread } from "./commentFilters";

interface CommentsListTableProps {
  threads: CommentThread[];
  selectedId: string | null;
  onSelect: (annotationId: string) => void;
  // Reveals the thread's pin — on the current page if it's there, centered
  // with a "Not in this view" chip otherwise (same as Minimize mode).
  onRevealOnPage: (annotationId: string) => void;
}

export function CommentsListTable({
  threads,
  selectedId,
  onSelect,
  onRevealOnPage,
}: CommentsListTableProps) {
  return (
    <div className="wpn-users-table-wrap">
      <table className="wpn-users-table wpn-comments-list-table">
        <colgroup>
          <col className="wpn-comments-list-table__col-comment" />
          <col />
          <col className="wpn-comments-list-table__col-status" />
          <col className="wpn-comments-list-table__col-replies" />
          <col className="wpn-comments-list-table__col-updated" />
          <col className="wpn-users-table__col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Comment</th>
            <th scope="col">Author</th>
            <th scope="col">Status</th>
            <th scope="col">Replies</th>
            <th scope="col">Updated</th>
            <th scope="col" className="wpn-users-table__actions-head">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => {
            const { annotation, label, root, replies, lastActivityAt } = thread;
            return (
              <tr
                key={annotation.id}
                className={
                  annotation.id === selectedId ? "wpn-comments-list-table__row--active" : undefined
                }
                tabIndex={0}
                onClick={() => onSelect(annotation.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(annotation.id);
                  }
                }}
              >
                <td>
                  <span className="wpn-comments-list-table__open wpn-users-identity">
                    <span className="wpn-avatar wpn-avatar--fallback">
                      {getInitials(root.createdBy.name)}
                    </span>
                    <span className="wpn-users-identity__name">{label}</span>
                  </span>
                </td>
                <td className="wpn-users-table__muted">{root.createdBy.name}</td>
                <td>
                  <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
                    {statusLabel(annotation.status)}
                  </span>
                </td>
                <td className="wpn-users-table__muted">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </td>
                <td className="wpn-users-table__muted">{formatRelativeTime(lastActivityAt)}</td>
                <td>
                  <Tooltip label="Open on page" placement="left">
                    <button
                      type="button"
                      className="wpn-comments-list-table__reveal"
                      aria-label={`Open "${label}" on the page`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRevealOnPage(annotation.id);
                      }}
                    >
                      <Icon name="arrowUpRight" />
                    </button>
                  </Tooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
