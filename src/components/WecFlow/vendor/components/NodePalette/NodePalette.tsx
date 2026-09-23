import { useMemo, useState, type DragEvent, type FC } from "react";
import "../../styles/palette.css";
import type { FlowNodeType } from "../../types/flow.types";

export interface NodePaletteProps {
  readonly?: boolean;
  className?: string;
  onNodeDragStart?: (type: FlowNodeType) => void;
  onNodeDragEnd?: () => void;
}

interface PaletteItemDefinition {
  type: FlowNodeType;
  label: string;
}

interface PaletteCategoryDefinition {
  id: string;
  label: string;
  items: PaletteItemDefinition[];
}

/**
 * Arrows has no members: connectors between shapes are xyflow edges, drawn
 * by dragging from a handle, not draggable palette nodes in this data
 * model. The category is kept (empty) so the categorized layout mirrors
 * draw.io's shape panel structure; it renders a note instead of an empty
 * list.
 */
const PALETTE_CATEGORIES: PaletteCategoryDefinition[] = [
  {
    id: "flowchart",
    label: "Flowchart",
    items: [
      { type: "start", label: "Start" },
      { type: "end", label: "End" },
      { type: "process", label: "Process" },
      { type: "decision", label: "Decision" },
      { type: "input", label: "Input" },
      { type: "output", label: "Output" },
    ],
  },
  {
    id: "basic-shapes",
    label: "Basic Shapes",
    items: [
      { type: "rectangle", label: "Rectangle" },
      { type: "roundedRectangle", label: "Rounded Rectangle" },
      { type: "ellipse", label: "Ellipse" },
      { type: "diamond", label: "Diamond" },
      { type: "parallelogram", label: "Parallelogram" },
      { type: "triangle", label: "Triangle" },
      { type: "hexagon", label: "Hexagon" },
      { type: "cylinder", label: "Cylinder" },
      { type: "cloud", label: "Cloud" },
      { type: "document", label: "Document" },
      { type: "text", label: "Text" },
      { type: "container", label: "Container" },
    ],
  },
  {
    id: "arrows",
    label: "Arrows",
    items: [],
  },
  {
    id: "uml",
    label: "UML",
    items: [
      { type: "actor", label: "Actor" },
      { type: "package", label: "Package" },
      { type: "note", label: "Note" },
    ],
  },
];

const TOTAL_ITEM_COUNT = PALETTE_CATEGORIES.reduce(
  (total, category) => total + category.items.length,
  0,
);

export const NODE_PALETTE_DATA_TRANSFER_TYPE = "application/wec-flow-node";

function filterCategories(query: string): PaletteCategoryDefinition[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return PALETTE_CATEGORIES;
  return PALETTE_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => item.label.toLowerCase().includes(trimmed)),
  }));
}

export const NodePalette: FC<NodePaletteProps> = ({
  readonly = false,
  className,
  onNodeDragStart,
  onNodeDragEnd,
}) => {
  const [query, setQuery] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleCategories = useMemo(() => filterCategories(query), [query]);

  const rootClassName = className
    ? `wec-flow-palette ${className}`
    : "wec-flow-palette";

  const toggleCategory = (categoryId: string): void => {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    nodeType: FlowNodeType,
  ): void => {
    if (readonly) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(NODE_PALETTE_DATA_TRANSFER_TYPE, nodeType);
    event.dataTransfer.effectAllowed = "move";
    onNodeDragStart?.(nodeType);
  };

  return (
    <div className={rootClassName}>
      <div className="wec-flow-palette__header">
        <span className="wec-flow-palette__header-title">
          <span className="wec-flow-palette__header-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13">
              <circle cx="6" cy="5.5" r="2.2" />
              <circle cx="6" cy="18.5" r="2.2" />
              <circle cx="18" cy="12" r="2.2" />
              <path d="M6 7.7v8.6M8 6.2l7.3 4.6M8 17.8l7.3-4.6" />
            </svg>
          </span>
          Nodes
          <span className="wec-flow-palette__header-count">{TOTAL_ITEM_COUNT}</span>
        </span>
      </div>
      <div className="wec-flow-palette__search">
        <input
          type="search"
          className="wec-flow-palette__search-input"
          placeholder="Search shapes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search shapes"
        />
      </div>
      <div className="wec-flow-palette__body">
        {readonly ? (
          <p className="wec-flow-palette__note">Read-only mode</p>
        ) : null}
        {visibleCategories.map((category) => {
          const isCollapsed = collapsedCategoryIds.has(category.id);
          return (
            <div key={category.id} className="wec-flow-palette__category">
              <button
                type="button"
                className="wec-flow-palette__category-header"
                onClick={() => toggleCategory(category.id)}
                aria-expanded={!isCollapsed}
              >
                <span
                  className={[
                    "wec-flow-palette__category-caret",
                    isCollapsed ? "wec-flow-palette__category-caret--collapsed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <span className="wec-flow-palette__category-label">{category.label}</span>
                <span className="wec-flow-palette__category-count">{category.items.length}</span>
              </button>
              {!isCollapsed && category.items.length === 0 ? (
                <p className="wec-flow-palette__note wec-flow-palette__note--category">
                  Connectors are drawn from a shape's handles, not dragged from here.
                </p>
              ) : null}
              {!isCollapsed && category.items.length > 0 ? (
                <div className="wec-flow-palette__list">
                  {category.items.map((item) => {
                    const itemClassName = readonly
                      ? "wec-flow-palette__item wec-flow-palette__item--disabled"
                      : "wec-flow-palette__item";

                    return (
                      <div
                        key={item.type}
                        role="button"
                        tabIndex={readonly ? -1 : 0}
                        className={itemClassName}
                        draggable={!readonly}
                        aria-disabled={readonly ? "true" : undefined}
                        title={`Drag to add a ${item.label} node`}
                        onDragStart={(event) => handleDragStart(event, item.type)}
                        onDragEnd={() => onNodeDragEnd?.()}
                      >
                        <span
                          className={`wec-flow-palette__shape wec-flow-palette__shape--${item.type}`}
                          aria-hidden="true"
                        />
                        <span className="wec-flow-palette__label">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodePalette;
