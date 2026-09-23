import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useFlowEngine } from '../../hooks/FlowContext';
import type { HandleSide } from '../../models/FlowTypes';
import type { NodeTypeDefinition } from '../../models/NodeTypes';
import { cx } from '../../utils/shallow';
import { Icon, NodeIcon } from '../icons';
import styles from './NodeRenderer.module.css';

const QUICK_ADD_OFFSET = 30;

const buttonPosition: Record<HandleSide, (w: number, h: number) => CSSProperties> = {
  top: (w) => ({ left: w / 2, top: -QUICK_ADD_OFFSET }),
  bottom: (w, h) => ({ left: w / 2, top: h + QUICK_ADD_OFFSET }),
  left: (_w, h) => ({ left: -QUICK_ADD_OFFSET, top: h / 2 }),
  right: (w, h) => ({ left: w + QUICK_ADD_OFFSET, top: h / 2 }),
};

function outgoingSides(def: NodeTypeDefinition): HandleSide[] {
  return [...new Set(def.handles.filter((h) => h.kind === 'source').map((h) => h.side))];
}

/** "+" buttons around a node that add and connect a new node on that side. */
export const QuickAdd = memo(function QuickAdd({ nodeId, definition, width, height }: { nodeId: string; definition: NodeTypeDefinition; width: number; height: number }) {
  const engine = useFlowEngine();
  const [openSide, setOpenSide] = useState<HandleSide | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openSide) return;
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !pickerRef.current?.contains(e.target)) setOpenSide(null);
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [openSide]);

  const add = (side: HandleSide, type: string) => {
    setOpenSide(null);
    engine.addConnectedNode(nodeId, side, type);
  };

  return (
    <>
      {outgoingSides(definition).map((side) => (
        <div key={side} className={cx(styles.quickAdd, openSide === side && styles.quickAddOpen)} style={buttonPosition[side](width, height)}>
          <button
            type="button"
            className={styles.quickAddButton}
            title="Add a connected node (Shift-click adds a Process)"
            aria-label={`Add connected node ${side}`}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              if (e.shiftKey) add(side, 'process');
              else setOpenSide((current) => (current === side ? null : side));
            }}
          >
            <Icon name="plus" size={11} />
          </button>
          {openSide === side && (
            <div ref={pickerRef} className={cx(styles.quickPicker, styles[`quickPicker-${side}`])} role="menu" onPointerDown={(e) => e.stopPropagation()}>
              {engine.registry.list().map((def) => (
                <button
                  key={def.type}
                  type="button"
                  role="menuitem"
                  className={styles.quickPickerItem}
                  style={{ '--node-color': def.color } as CSSProperties}
                  onClick={() => add(side, def.type)}
                >
                  <span className={styles.quickPickerIcon}>
                    <NodeIcon icon={def.icon} size={12} />
                  </span>
                  {def.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
});
