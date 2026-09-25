import { memo, useMemo, type CSSProperties } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import type { NodeTypeDefinition } from "../../utils/flowchart/nodeTypes";
import { cx } from "../../utils/flowchart/shallow";
import { NODE_DRAG_MIME } from "../../utils/flowchart/constants";
import { NodeIcon } from "./FlowIcons";

export interface SidebarProps {
  title?: string;
  /** Restrict / order the palette. Defaults to every registered node type. */
  nodeTypes?: string[];
  className?: string;
}

/** Node palette: drag an item onto the canvas, or click it to add at the viewport center. */
export const Sidebar = memo(function Sidebar({
  title = "Nodes",
  nodeTypes,
  className,
}: SidebarProps) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  const registryVersion = useFlowState((s) => s.registryVersion);

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
    return [...map.entries()];
  }, [engine, nodeTypes, registryVersion]);

  const addAtCenter = (def: NodeTypeDefinition) => {
    const { canvasSize } = engine.getState();
    const c = engine.screenToFlow({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
    // Small jitter so repeated clicks don't stack nodes exactly on top of each other.
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

  return (
    <aside className={cx("wpn-flowchart-sidebar__sidebar", className)}>
      <div className="wpn-flowchart-sidebar__header">
        <h2 className="wpn-flowchart-sidebar__title">{title}</h2>
      </div>
      <div className="wpn-flowchart-sidebar__list">
        {groups.map(([category, defs]) => (
          <div key={category} className="wpn-flowchart-sidebar__group">
            <div className="wpn-flowchart-ui__section-title">{category}</div>
            {defs.map((def) => (
              <div
                key={def.type}
                className={cx(
                  "wpn-flowchart-sidebar__item",
                  readOnly && "wpn-flowchart-sidebar__item-disabled",
                )}
                style={{ "--node-color": def.color } as CSSProperties}
                draggable={!readOnly}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-disabled={readOnly}
                title={
                  readOnly
                    ? "Read-only mode"
                    : `Drag onto the canvas or click to add a ${def.label} node`
                }
                onDragStart={(e) => {
                  e.dataTransfer.setData(NODE_DRAG_MIME, def.type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => !readOnly && addAtCenter(def)}
                onKeyDown={(e) => {
                  if (!readOnly && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    addAtCenter(def);
                  }
                }}
              >
                <span
                  className={cx(
                    "wpn-flowchart-sidebar__icon",
                    `wpn-flowchart-sidebar__icon-${def.shape}`,
                  )}
                >
                  <NodeIcon icon={def.icon} size={15} />
                </span>
                <span className="wpn-flowchart-sidebar__item-text">
                  <span className="wpn-flowchart-sidebar__item-label">{def.label}</span>
                  {def.description && (
                    <span className="wpn-flowchart-sidebar__item-desc">{def.description}</span>
                  )}
                </span>
                <span className="wpn-flowchart-sidebar__grip" aria-hidden="true">
                  ⋮⋮
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
});
