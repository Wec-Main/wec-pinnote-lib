import type { NodeComponentProps } from '../../models/NodeTypes';
import { cx } from '../../utils/shallow';
import { NodeIcon } from '../icons';
import styles from './NodeRenderer.module.css';

/** Default body: icon badge, label and description, laid out according to the node shape. */
export function DefaultNodeContent({ node, definition, height }: NodeComponentProps) {
  const compact = definition.shape === 'diamond' || definition.shape === 'pill';
  const showDescription = !!node.data.description && (definition.shape === 'diamond' ? height >= 140 : height >= 64);
  return (
    <div className={cx(styles.body, compact && styles.bodyCentered, definition.shape === 'diamond' && styles.bodyDiamond)}>
      {definition.icon !== undefined && (
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
