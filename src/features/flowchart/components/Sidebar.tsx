import { memo, useMemo, useRef, useState, type CSSProperties } from "react";
import { useFlowEngine, useFlowState } from "../FlowContext";
import type { NodeTypeDefinition } from "../../../utils/flowchart/nodeTypes";
import { cx } from "../../../utils/flowchart/shallow";
import { NODE_DRAG_MIME } from "../../../utils/flowchart/constants";
import { NodeIcon } from "./FlowIcons";
import { hasShapePreview, ShapePreview } from "./ShapePreview";

const ROW_CATEGORIES = new Set(["Flow control"]);

const PALETTE_ORDER = [
  "start",
  "process",
  "decision",
  "subprocess",
  "integration",
  "end",
  "rectangle",
  "roundedRectangle",
  "text",
  "actor",
  "swimlane",
  "swimlaneVertical",
  "ellipse",
  "circle",
  "cylinder",
  "square",
  "hexagon",
  "triangle",
];

const paletteRank = (type: string) => {
  const index = PALETTE_ORDER.indexOf(type);
  return index === -1 ? PALETTE_ORDER.length : index;
};

interface HoverTip {
  label: string;
  top: number;
  left: number;
}

export interface SidebarProps {
  nodeTypes?: string[];
  className?: string;
  style?: CSSProperties;
}

export const Sidebar = memo(function Sidebar({ nodeTypes, className, style }: SidebarProps) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  const registryVersion = useFlowState((s) => s.registryVersion);
  const asideRef = useRef<HTMLElement>(null);
  const [tip, setTip] = useState<HoverTip | null>(null);

  const showTip = (def: NodeTypeDefinition, target: HTMLElement) => {
    const aside = asideRef.current?.getBoundingClientRect();
    if (!aside) return;
    const rect = target.getBoundingClientRect();
    setTip({
      label: readOnly ? `${def.label} (read-only)` : def.label,
      top: rect.top + rect.height / 2 - aside.top,
      left: rect.right - aside.left + 8,
    });
  };

  const groups = useMemo(() => {
    void registryVersion;
    const all = nodeTypes
      ? nodeTypes.map((t) => engine.registry.get(t)).filter((d) => engine.registry.has(d.type))
      : engine.registry.list();
    const map = new Map<string, NodeTypeDefinition[]>();
    for (const d of all) {
      const key = d.category ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    for (const defs of map.values()) {
      defs.sort((a, b) => paletteRank(a.type) - paletteRank(b.type));
    }
    return [...map.entries()];
  }, [engine, nodeTypes, registryVersion]);

  const addAtCenter = (def: NodeTypeDefinition) => {
    const { canvasSize } = engine.getState();
    const c = engine.screenToFlow({ x: canvasSize.width / 2, y: canvasSize.height / 2 });

    const jitter = (engine.getNodes().length % 5) * 16;
    const node = engine.addNode({
      type: def.type,
      position: engine.snap({
        x: c.x - def.defaultSize.width / 2 + jitter,
        y: c.y - def.defaultSize.height / 2 + jitter,
      }),
    });
    engine.selectNode(node.id);
  };

  const renderItem = (def: NodeTypeDefinition, tile: boolean) => (
    <div
      key={def.type}
      className={cx(
        "wpn-flowchart-sidebar__item",
        tile && "wpn-flowchart-sidebar__tile",
        readOnly && "wpn-flowchart-sidebar__item-disabled",
      )}
      style={{ "--node-color": def.color } as CSSProperties}
      draggable={!readOnly}
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-disabled={readOnly}
      aria-label={`Add ${def.label}`}
      onPointerEnter={(e) => showTip(def, e.currentTarget)}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => showTip(def, e.currentTarget)}
      onBlur={() => setTip(null)}
      onDragStart={(e) => {
        setTip(null);
        e.dataTransfer.setData(NODE_DRAG_MIME, def.type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => !readOnly && addAtCenter(def)}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          return;
        }
        if (!readOnly && e.key === "Enter") {
          e.preventDefault();
          addAtCenter(def);
        }
      }}
      onKeyUp={(e) => {
        if (!readOnly && e.key === " ") {
          e.preventDefault();
          addAtCenter(def);
        }
      }}
    >
      {tile && hasShapePreview(def.shape) ? (
        <ShapePreview shape={def.shape} />
      ) : (
        <span
          className={cx("wpn-flowchart-sidebar__icon", `wpn-flowchart-sidebar__icon-${def.shape}`)}
        >
          <NodeIcon icon={def.icon} size={tile ? 22 : 15} />
        </span>
      )}
      {!tile && (
        <>
          <span className="wpn-flowchart-sidebar__item-text">
            <span className="wpn-flowchart-sidebar__item-label">{def.label}</span>
            {def.description && (
              <span className="wpn-flowchart-sidebar__item-desc">{def.description}</span>
            )}
          </span>
          <span className="wpn-flowchart-sidebar__grip" aria-hidden="true">
            ⋮⋮
          </span>
        </>
      )}
    </div>
  );

  return (
    <aside
      ref={asideRef}
      className={cx("wpn-flowchart-sidebar__sidebar", "wpn-flowchart-sidebar__palette", className)}
      style={style}
    >
      <div className="wpn-flowchart-sidebar__list">
        {groups.map(([category, defs]) => {
          const rows = ROW_CATEGORIES.has(category);
          return (
            <div key={category} className="wpn-flowchart-sidebar__group">
              <div className="wpn-flowchart-ui__section-title">{category}</div>
              {rows ? (
                defs.map((def) => renderItem(def, false))
              ) : (
                <div className="wpn-flowchart-sidebar__grid" role="group" aria-label={category}>
                  {defs.map((def) => renderItem(def, true))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {tip && (
        <div
          className="wpn-flowchart-sidebar__tip"
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
        >
          <span className="wpn-flowchart-sidebar__tip-label">{tip.label}</span>
        </div>
      )}
    </aside>
  );
});
