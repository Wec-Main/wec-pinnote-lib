import { memo, useMemo, useState, type CSSProperties } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import type { NodeTypeDefinition } from '../../models/NodeTypes';
import { cx } from '../../utils/shallow';
import { NODE_DRAG_MIME } from '../../utils/constants';
import { NodeIcon, Icon } from '../icons';
import ui from '../ui/ui.module.css';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  title?: string;
  /** Restrict / order the palette. Defaults to every registered node type. */
  nodeTypes?: string[];
  className?: string;
}

/** Node palette: drag an item onto the canvas, or click it to add at the viewport center. */
export const Sidebar = memo(function Sidebar({ title = 'Nodes', nodeTypes, className }: SidebarProps) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  const registryVersion = useFlowState((s) => s.registryVersion);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    void registryVersion;
    const all = nodeTypes ? nodeTypes.map((t) => engine.registry.get(t)).filter((d) => engine.registry.has(d.type)) : engine.registry.list();
    const q = query.trim().toLowerCase();
    const matches = all.filter((d) => !q || d.label.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q));
    const map = new Map<string, NodeTypeDefinition[]>();
    for (const d of matches) {
      const key = d.category ?? 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()];
  }, [engine, nodeTypes, query, registryVersion]);

  const addAtCenter = (def: NodeTypeDefinition) => {
    const { canvasSize } = engine.getState();
    const c = engine.screenToFlow({ x: canvasSize.width / 2, y: canvasSize.height / 2 });
    // Small jitter so repeated clicks don't stack nodes exactly on top of each other.
    const jitter = (engine.getNodes().length % 5) * 16;
    const node = engine.addNode({
      type: def.type,
      position: engine.snap({ x: c.x - def.defaultSize.width / 2 + jitter, y: c.y - def.defaultSize.height / 2 + jitter }),
    });
    engine.selectNode(node.id);
  };

  return (
    <aside className={cx(styles.sidebar, className)}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.search}>
          <Icon name="search" size={14} />
          <input className={styles.searchInput} placeholder="Search nodes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className={styles.list}>
        {groups.map(([category, defs]) => (
          <div key={category} className={styles.group}>
            <div className={ui.sectionTitle}>{category}</div>
            {defs.map((def) => (
              <div
                key={def.type}
                className={cx(styles.item, readOnly && styles.itemDisabled)}
                style={{ '--node-color': def.color } as CSSProperties}
                draggable={!readOnly}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-disabled={readOnly}
                title={readOnly ? 'Read-only mode' : `Drag onto the canvas or click to add a ${def.label} node`}
                onDragStart={(e) => {
                  e.dataTransfer.setData(NODE_DRAG_MIME, def.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => !readOnly && addAtCenter(def)}
                onKeyDown={(e) => {
                  if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    addAtCenter(def);
                  }
                }}
              >
                <span className={cx(styles.icon, styles[`icon-${def.shape}`])}>
                  <NodeIcon icon={def.icon} size={15} />
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{def.label}</span>
                  {def.description && <span className={styles.itemDesc}>{def.description}</span>}
                </span>
                <span className={styles.grip} aria-hidden="true">
                  ⋮⋮
                </span>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className={cx(ui.muted, styles.none)}>No node types match “{query}”.</div>}
      </div>
      <div className={styles.footer}>
        {readOnly ? (
          <span className={ui.muted}>
            <Icon name="lock" size={12} /> Read-only mode — editing is disabled.
          </span>
        ) : (
          <span className={ui.muted}>Drag nodes onto the canvas. Connect them by dragging from a handle.</span>
        )}
      </div>
    </aside>
  );
});
