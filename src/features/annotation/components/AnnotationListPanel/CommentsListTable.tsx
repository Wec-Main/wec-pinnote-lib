import { memo, useCallback, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { formatRelativeTime, getInitials } from "../../../../utils/format";
import { mentionsToPlainText } from "../../../../utils/mentions";
import { statusLabel } from "../../../../utils/status";
import { Icon } from "../../../../components/primitives/Icon";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import type { CommentThread } from "./commentFilters";

const COMMENT_CLAMP_LINES = 3;
const COMMENT_CHAR_THRESHOLD = 160;

interface CommentsListTableProps {
  threads: CommentThread[];
  selectedId: string | null;
  onSelect: (annotationId: string) => void;
  onClosePreview: () => void;
  onRevealOnPage: (annotationId: string) => void;
}

interface CommentCellProps {
  label: string;
  message: string;
  previewOpen: boolean;
  onTogglePreview: () => void;
}

function CommentCell({ label, message, previewOpen, onTogglePreview }: CommentCellProps) {
  const plainText = mentionsToPlainText(message);
  const isLong = plainText.length > COMMENT_CHAR_THRESHOLD;

  return (
    <div className="wpn-comments-list-table__cell">
      <span className="wpn-comments-list-table__open wpn-users-identity__name">{label}</span>
      {plainText && (
        <div className="wpn-comments-list-table__message-wrap">
          <p
            className="wpn-comments-list-table__message"
            style={{ "--clamp": COMMENT_CLAMP_LINES } as CSSProperties}
          >
            {plainText}
          </p>
          {isLong && (
            <button
              type="button"
              className="wpn-comments-list-table__toggle"
              aria-expanded={previewOpen}
              aria-label={
                previewOpen
                  ? `Close the preview of the comment on "${label}"`
                  : `Show the full comment on "${label}" in the preview`
              }
              onClick={(event) => {
                event.stopPropagation();
                onTogglePreview();
              }}
            >
              {previewOpen ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface CommentRowProps {
  thread: CommentThread;
  selected: boolean;
  onSelect: (annotationId: string) => void;
  onClosePreview: () => void;
  onRevealOnPage: (annotationId: string) => void;
}

const CommentRow = memo(function CommentRow({
  thread,
  selected,
  onSelect,
  onClosePreview,
  onRevealOnPage,
}: CommentRowProps) {
  const { annotation, label, root, replies, lastActivityAt } = thread;
  const annotationId = annotation.id;

  const handleRowClick = useCallback(() => onSelect(annotationId), [onSelect, annotationId]);

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(annotationId);
      }
    },
    [onSelect, annotationId],
  );

  const handleTogglePreview = useCallback(() => {
    if (selected) {
      onClosePreview();
    } else {
      onSelect(annotationId);
    }
  }, [selected, onClosePreview, onSelect, annotationId]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onSelect(annotationId);
    },
    [onSelect, annotationId],
  );

  const handleOpenClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onRevealOnPage(annotationId);
    },
    [onRevealOnPage, annotationId],
  );

  return (
    <tr
      className={selected ? "wpn-comments-list-table__row--active" : undefined}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      <td>
        <CommentCell
          label={label}
          message={root.message}
          previewOpen={selected}
          onTogglePreview={handleTogglePreview}
        />
      </td>
      <td className="wpn-users-table__muted">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </td>
      <td className="wpn-users-table__muted">
        <Tooltip label={new Date(lastActivityAt).toLocaleString()} placement="bottom">
          <span className="wpn-table-date">
            <Icon name="calendar" className="wpn-table-date__icon" />
            {formatRelativeTime(lastActivityAt)}
          </span>
        </Tooltip>
      </td>
      <td>
        <span className="wpn-users-identity">
          {root.createdBy.avatarUrl ? (
            <img className="wpn-avatar" src={root.createdBy.avatarUrl} alt="" />
          ) : (
            <span className="wpn-avatar wpn-avatar--fallback">
              {getInitials(root.createdBy.name)}
            </span>
          )}
          <span className="wpn-users-identity__name">{root.createdBy.name}</span>
        </span>
      </td>
      <td>
        <span className={`wpn-status-chip wpn-status-chip--sm wpn-tone--${annotation.status}`}>
          {statusLabel(annotation.status)}
        </span>
      </td>
      <td>
        <div className="wpn-users-actions">
          <Tooltip label="Preview conversation" placement="left">
            <button
              type="button"
              className="wpn-users-action wpn-users-action--labeled"
              aria-label={`Preview "${label}"`}
              aria-pressed={selected}
              onClick={handlePreviewClick}
            >
              <Icon name="eye" />
              <span>Preview</span>
            </button>
          </Tooltip>
          <Tooltip label="Open on page" placement="left">
            <button
              type="button"
              className="wpn-users-action wpn-users-action--primary wpn-users-action--labeled"
              aria-label={`Open "${label}" on the page`}
              onClick={handleOpenClick}
            >
              <Icon name="arrowUpRight" />
              <span>Open</span>
            </button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
});

export function CommentsListTable({
  threads,
  selectedId,
  onSelect,
  onClosePreview,
  onRevealOnPage,
}: CommentsListTableProps) {
  return (
    <div className="wpn-users-table-wrap">
      <table className="wpn-users-table wpn-comments-list-table">
        <colgroup>
          <col className="wpn-comments-list-table__col-comment" />
          <col className="wpn-comments-list-table__col-replies" />
          <col className="wpn-comments-list-table__col-updated" />
          <col />
          <col className="wpn-comments-list-table__col-status" />
          <col className="wpn-comments-list-table__col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Comment</th>
            <th scope="col">Replies</th>
            <th scope="col">Updated</th>
            <th scope="col">Author</th>
            <th scope="col">Status</th>
            <th scope="col" className="wpn-users-table__actions-head">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => (
            <CommentRow
              key={thread.annotation.id}
              thread={thread}
              selected={thread.annotation.id === selectedId}
              onSelect={onSelect}
              onClosePreview={onClosePreview}
              onRevealOnPage={onRevealOnPage}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
