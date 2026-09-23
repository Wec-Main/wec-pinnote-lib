import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Icon } from "../../../../primitives";
import type { FlowPage } from "../../types/flow.types";
import "./page-tabs.css";

export interface PageTabsProps {
  pages: FlowPage[];
  activePageId: string;
  readonly?: boolean;
  onSelect: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onAdd: () => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function PageTabs({
  pages,
  activePageId,
  readonly = false,
  onSelect,
  onRename,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
}: PageTabsProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const dragIndexRef = useRef<number | null>(null);

  const startRename = (page: FlowPage) => {
    if (readonly) return;
    setEditingPageId(page.id);
    setEditingName(page.name);
  };

  const commitRename = () => {
    if (editingPageId && editingName.trim().length > 0) {
      onRename(editingPageId, editingName.trim());
    }
    setEditingPageId(null);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingPageId(null);
    }
  };

  const handleDragStart = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (readonly) return;
    dragIndexRef.current = index;
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = () => (event: DragEvent<HTMLDivElement>) => {
    if (readonly || dragIndexRef.current === null) return;
    event.preventDefault();
  };

  const handleDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (readonly) return;
    event.preventDefault();
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null || fromIndex === index) return;
    onReorder(fromIndex, index);
  };

  return (
    <div className="wec-flow-page-tabs" role="tablist" aria-label="Pages">
      {pages.map((page, index) => (
        <div
          key={page.id}
          role="tab"
          aria-selected={page.id === activePageId}
          className={[
            "wec-flow-page-tabs__tab",
            page.id === activePageId ? "wec-flow-page-tabs__tab--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          draggable={!readonly}
          onDragStart={handleDragStart(index)}
          onDragOver={handleDragOver()}
          onDrop={handleDrop(index)}
          onClick={() => onSelect(page.id)}
          onDoubleClick={() => startRename(page)}
        >
          {editingPageId === page.id ? (
            <input
              autoFocus
              className="wec-flow-page-tabs__rename-input"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span className="wec-flow-page-tabs__label">{page.name}</span>
          )}
          {!readonly && (
            <div className="wec-flow-page-tabs__actions">
              <button
                type="button"
                className="wec-flow-page-tabs__action"
                aria-label={`Duplicate ${page.name}`}
                title="Duplicate page"
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate(page.id);
                }}
              >
                <Icon name="copy" />
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  className="wec-flow-page-tabs__action wec-flow-page-tabs__action--danger"
                  aria-label={`Delete ${page.name}`}
                  title="Delete page"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(page.id);
                  }}
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {!readonly && (
        <button
          type="button"
          className="wec-flow-page-tabs__add"
          aria-label="Add page"
          title="Add page"
          onClick={onAdd}
        >
          <Icon name="plus" />
        </button>
      )}
    </div>
  );
}
