import { memo, type CSSProperties } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { useEditSession } from '../../hooks/useEditSession';
import type { EdgePathType } from '../../models/FlowTypes';
import { cx, shallowEqual } from '../../utils/shallow';
import { Icon, NodeIcon, type IconName } from '../icons';
import { lineStyleOptions } from '../lineStyles';
import ui from '../ui/ui.module.css';
import styles from './PropertiesPanel.module.css';

export interface PropertiesPanelProps {
  className?: string;
  onClose?: () => void;
  /** Whether the panel currently fills the whole editor area. */
  expanded?: boolean;
  /** Toggles `expanded`. Omit to hide the expand control. */
  onToggleExpand?: () => void;
}

/** Right-hand inspector: edits whatever is selected (node, edge, multi-selection or the flow itself). */
export const PropertiesPanel = memo(function PropertiesPanel({ className, onClose, expanded = false, onToggleExpand }: PropertiesPanelProps) {
  const [nodeIds, edgeIds] = useFlowState((s) => [[...s.selectedNodeIds], [...s.selectedEdgeIds]] as const, (a, b) =>
    shallowEqual(a[0], b[0]) && shallowEqual(a[1], b[1]),
  );
  let content;
  const [onlyNodeId] = nodeIds;
  const [onlyEdgeId] = edgeIds;
  if (onlyNodeId !== undefined && nodeIds.length === 1 && edgeIds.length === 0) content = <NodeProperties key={onlyNodeId} nodeId={onlyNodeId} />;
  else if (onlyEdgeId !== undefined && edgeIds.length === 1 && nodeIds.length === 0) content = <EdgeProperties key={onlyEdgeId} edgeId={onlyEdgeId} />;
  else if (nodeIds.length + edgeIds.length > 1) content = <MultiSelection nodeIds={nodeIds} edgeIds={edgeIds} />;
  else content = <FlowOverview />;
  return (
    <aside className={cx(styles.panel, expanded && styles.panelExpanded, className)}>
      {onToggleExpand && (
        <button
          type="button"
          className={styles.expand}
          aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
          aria-pressed={expanded}
          title={expanded ? 'Collapse panel' : 'Expand panel'}
          onClick={onToggleExpand}
        >
          <Icon name={expanded ? 'collapse' : 'expand'} size={14} />
        </button>
      )}
      {onClose && (
        <button type="button" className={styles.close} aria-label="Close panel" title="Close panel" onClick={onClose}>
          <Icon name="x" size={14} />
        </button>
      )}
      {content}
    </aside>
  );
});

function PanelHeader({ title, subtitle, color, icon }: { title: string; subtitle?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div className={styles.header} style={color ? ({ '--node-color': color } as CSSProperties) : undefined}>
      <span className={styles.headerIcon}>{icon}</span>
      <div className={styles.headerText}>
        <div className={styles.headerTitle}>{title}</div>
        {subtitle && <div className={styles.headerSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- node

function NodeProperties({ nodeId }: { nodeId: string }) {
  const engine = useFlowEngine();
  const node = useFlowState((s) => s.nodeLookup.get(nodeId));
  const readOnly = useFlowState((s) => s.readOnly);
  const issues = useFlowState((s) => s.validation?.issues.filter((i) => i.nodeIds?.includes(nodeId)), shallowEqual);
  const session = useEditSession();
  if (!node) return null;
  const def = engine.getDefinition(node.type);

  return (
    <>
      <PanelHeader title={def.label} subtitle={def.description} color={def.color} icon={<NodeIcon icon={def.icon} size={16} />} />

      {!!issues?.length && (
        <div className={styles.issues}>
          {issues.map((i) => (
            <div key={i.id} className={cx(styles.issue, styles[i.severity])}>
              <Icon name="alert" size={13} /> {i.message}
            </div>
          ))}
        </div>
      )}

      <section className={ui.section}>
        <h3 className={ui.sectionTitle}>General</h3>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Label</span>
          <input
            className={ui.input}
            value={node.data.label}
            disabled={readOnly}
            onChange={(e) => engine.updateNodeData(nodeId, { label: e.target.value })}
            {...session}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Description</span>
          <textarea
            className={ui.input}
            style={{ minHeight: 220 }}
            value={node.data.description ?? ''}
            placeholder="What does this step do?"
            disabled={readOnly}
            onChange={(e) => engine.updateNodeData(nodeId, { description: e.target.value })}
            {...session}
          />
        </label>
      </section>
    </>
  );
}

// ------------------------------------------------------------------- edge

const edgeTypes: { value: EdgePathType | 'default'; label: string; icon: IconName }[] = [
  { value: 'default', label: 'Default', icon: 'flow' },
  ...lineStyleOptions,
];

function EdgeProperties({ edgeId }: { edgeId: string }) {
  const engine = useFlowEngine();
  const edge = useFlowState((s) => s.edgeLookup.get(edgeId));
  const source = useFlowState((s) => (edge ? s.nodeLookup.get(edge.source) : undefined));
  const target = useFlowState((s) => (edge ? s.nodeLookup.get(edge.target) : undefined));
  const readOnly = useFlowState((s) => s.readOnly);
  const issues = useFlowState((s) => s.validation?.issues.filter((i) => i.edgeIds?.includes(edgeId)), shallowEqual);
  const session = useEditSession();
  if (!edge) return null;
  const current = edge.type ?? 'default';
  return (
    <>
      <PanelHeader title="Connection" subtitle={`${source?.data.label ?? edge.source} → ${target?.data.label ?? edge.target}`} icon={<Icon name="curve" size={16} />} />
      {!!issues?.length && (
        <div className={styles.issues}>
          {issues.map((i) => (
            <div key={i.id} className={cx(styles.issue, styles[i.severity])}>
              <Icon name="alert" size={13} /> {i.message}
            </div>
          ))}
        </div>
      )}
      <section className={ui.section}>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Label</span>
          <input
            className={ui.input}
            value={edge.label ?? ''}
            placeholder="e.g. Yes / No"
            disabled={readOnly}
            onChange={(e) => engine.updateEdge(edgeId, { label: e.target.value || undefined })}
            {...session}
          />
        </label>
        <div className={ui.field}>
          <span className={ui.fieldLabel}>Line style</span>
          <div className={ui.segmented}>
            {edgeTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={readOnly}
                className={cx(ui.segment, current === t.value && ui.segmentActive)}
                onClick={() => engine.updateEdge(edgeId, { type: t.value === 'default' ? undefined : t.value })}
                title={t.value === 'default' ? 'Use the editor default line style' : `${t.label} line`}
              >
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className={ui.switchRow}>
          <span>Animated</span>
          <input type="checkbox" className={ui.switch} checked={!!edge.animated} disabled={readOnly} onChange={(e) => engine.updateEdge(edgeId, { animated: e.target.checked })} />
        </label>
      </section>
      <section className={ui.section}>
        <h3 className={ui.sectionTitle}>Endpoints</h3>
        <button type="button" className={styles.endpoint} onClick={() => source && engine.selectNode(source.id)}>
          <span>From</span>
          <strong>{source?.data.label ?? `Missing node (${edge.source})`}</strong>
          <code>{edge.sourceHandle}</code>
        </button>
        <button type="button" className={styles.endpoint} onClick={() => target && engine.selectNode(target.id)}>
          <span>To</span>
          <strong>{target?.data.label ?? `Missing node (${edge.target})`}</strong>
          <code>{edge.targetHandle}</code>
        </button>
      </section>
      {!readOnly && (
        <section className={cx(ui.section, styles.actions)}>
          <button type="button" className={cx(ui.btn, ui.btnDanger, ui.block)} onClick={() => engine.removeEdges([edgeId])}>
            <Icon name="trash" size={14} /> Delete connection
          </button>
        </section>
      )}
    </>
  );
}

// -------------------------------------------------------- multi / overview

function MultiSelection({ nodeIds, edgeIds }: { nodeIds: readonly string[]; edgeIds: readonly string[] }) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  return (
    <>
      <PanelHeader title="Multiple selection" subtitle={`${nodeIds.length} nodes · ${edgeIds.length} connections`} icon={<Icon name="select" size={16} />} />
      <section className={ui.section}>
        <p className={ui.muted}>Drag any selected node to move the whole group. Hold Shift and click to add or remove items.</p>
      </section>
      {!readOnly && (
        <section className={cx(ui.section, styles.actions)}>
          {nodeIds.length > 0 && (
            <button type="button" className={ui.btn} onClick={() => engine.duplicateNodes([...nodeIds])}>
              <Icon name="copy" size={14} /> Duplicate
            </button>
          )}
          <button type="button" className={cx(ui.btn, ui.btnDanger)} onClick={() => engine.deleteSelection()}>
            <Icon name="trash" size={14} /> Delete selected
          </button>
        </section>
      )}
    </>
  );
}

function FlowOverview() {
  const engine = useFlowEngine();
  const name = useFlowState((s) => s.flowName);
  const notes = useFlowState((s) => s.flowNotes);
  const readOnly = useFlowState((s) => s.readOnly);
  return (
    <>
      <PanelHeader title="Flow settings" subtitle="Select a node or connection to edit it" icon={<Icon name="flow" size={16} />} />
      <section className={ui.section}>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Flow name</span>
          <input className={ui.input} value={name} disabled={readOnly} onChange={(e) => engine.setFlowName(e.target.value)} />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Notes</span>
          <textarea
            className={ui.input}
            style={{ minHeight: 220 }}
            value={notes}
            placeholder="Notes about this flow as a whole..."
            disabled={readOnly}
            onChange={(e) => engine.setFlowNotes(e.target.value)}
          />
        </label>
      </section>
    </>
  );
}
