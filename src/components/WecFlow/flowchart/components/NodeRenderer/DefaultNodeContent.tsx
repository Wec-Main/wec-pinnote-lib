import { useEffect, useRef, useState } from 'react';
import { useFlowEngine } from '../../hooks/FlowContext';
import type { NodeComponentProps } from '../../models/NodeTypes';
import { cx } from '../../utils/shallow';
import { NodeIcon } from '../icons';
import styles from './NodeRenderer.module.css';

/** Default body: icon badge, label and description, laid out according to the node shape. */
export function DefaultNodeContent({ node, definition, height, editing, onEditDone }: NodeComponentProps) {
  const engine = useFlowEngine();
  const compact = definition.shape === 'diamond' || definition.shape === 'pill';
  const showDescription = !!node.data.description && (definition.shape === 'diamond' ? height >= 140 : height >= 64);
  const [draft, setDraft] = useState(node.data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setDraft(node.data.label);
  }, [editing, node.data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    const commit = () => {
      const value = draft.trim();
      if (value !== node.data.label) engine.updateNodeData(node.id, { label: value });
      onEditDone?.();
    };
    return (
      <div className={cx(styles.body, compact && styles.bodyCentered)}>
        <input
          ref={inputRef}
          autoFocus
          className={styles.labelEdit}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') onEditDone?.();
          }}
        />
      </div>
    );
  }

  const showIcon = definition.icon !== undefined && (definition.role === 'start' || definition.role === 'end');

  return (
    <div className={cx(styles.body, compact && styles.bodyCentered, definition.shape === 'diamond' && styles.bodyDiamond)}>
      {showIcon && (
        <span className={cx(styles.badge, compact && styles.badgeSmall)}>
          <NodeIcon icon={definition.icon} size={compact ? 13 : 16} />
        </span>
      )}
      <div className={styles.text}>
        <div className={styles.label} title={node.data.label}>
          {node.data.label || <span className={styles.placeholder}>Untitled</span>}
        </div>
        {showDescription && <div className={styles.description}>{node.data.description}</div>}
      </div>
    </div>
  );
}
