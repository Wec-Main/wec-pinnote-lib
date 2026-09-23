import { memo, type CSSProperties } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { useNodeDrag } from '../../hooks/useNodeDrag';
import { getNodeSize } from '../../utils/geometry';
import { cx, shallowEqual } from '../../utils/shallow';
import { DefaultNodeContent } from './DefaultNodeContent';
import { Handle } from './Handle';
import { NodeShape } from './NodeShape';
import { ResizeHandles } from './ResizeHandles';
import styles from './NodeRenderer.module.css';

/**
 * Renders one node. Subscribes only to its own node object, selection flag and
 * validation state, so unrelated changes never re-render it.
 */
export const NodeItem = memo(function NodeItem({ id }: { id: string }) {
  const engine = useFlowEngine();
  const node = useFlowState((s) => s.nodeLookup.get(id));
  const selected = useFlowState((s) => s.selectedNodeIds.has(id));
  const issue = useFlowState((s) => s.issueNodeIds.get(id));
  const readOnly = useFlowState((s) => s.readOnly);
  useFlowState((s) => s.registryVersion);
  const onPointerDown = useNodeDrag(id);

  if (!node) return null;
  const def = engine.getDefinition(node.type);
  const { width, height } = getNodeSize(node, def);
  const Content = def.component ?? DefaultNodeContent;

  return (
    <div
      className={cx(
        styles.node,
        styles[`shape-${def.shape}`],
        selected && styles.selected,
        issue && styles[`issue-${issue}`],
        readOnly && styles.readOnly,
      )}
      style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)`, width, height, '--node-color': def.color } as CSSProperties}
      data-node-id={id}
      data-node-type={node.type}
      onPointerDown={onPointerDown}
    >
      <NodeShape shape={def.shape} width={width} height={height} />
      <div className={styles.content}>
        <Content node={node} definition={def} selected={selected} width={width} height={height} />
      </div>
      {!readOnly && def.handles.map((h) => <Handle key={h.id} nodeId={id} handle={h} definition={def} width={width} height={height} />)}
      {selected && !readOnly && def.resizable !== false && <ResizeHandles nodeId={id} definition={def} />}
    </div>
  );
});

/** Node layer: re-renders only when nodes are added, removed or reordered. */
export const NodeRenderer = memo(function NodeRenderer() {
  const ids = useFlowState((s) => s.nodes.map((n) => n.id), shallowEqual);
  return (
    <div className={styles.layer}>
      {ids.map((id) => (
        <NodeItem key={id} id={id} />
      ))}
    </div>
  );
});
