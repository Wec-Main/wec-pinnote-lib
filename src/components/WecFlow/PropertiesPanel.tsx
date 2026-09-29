import { memo, useState, type CSSProperties } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import { useEditSession } from "../../hooks/flowchart/useEditSession";
import type { EdgePathType } from "../../types/flowchart.types";
import { cx, shallowEqual } from "../../utils/flowchart/shallow";
import { Icon, NodeIcon, type IconName } from "./FlowIcons";
import { lineStyleOptions } from "./lineStyles";

export interface PropertiesPanelProps {
  className?: string;
  style?: CSSProperties;
  onClose?: () => void;
}

export const PropertiesPanel = memo(function PropertiesPanel({
  className,
  style,
  onClose,
}: PropertiesPanelProps) {
  const [nodeIds, edgeIds] = useFlowState(
    (s) => [[...s.selectedNodeIds], [...s.selectedEdgeIds]] as const,
    (a, b) => shallowEqual(a[0], b[0]) && shallowEqual(a[1], b[1]),
  );
  let content;
  const [onlyNodeId] = nodeIds;
  const [onlyEdgeId] = edgeIds;
  if (onlyNodeId !== undefined && nodeIds.length === 1 && edgeIds.length === 0)
    content = <NodeProperties key={onlyNodeId} nodeId={onlyNodeId} />;
  else if (onlyEdgeId !== undefined && edgeIds.length === 1 && nodeIds.length === 0)
    content = <EdgeProperties key={onlyEdgeId} edgeId={onlyEdgeId} />;
  else if (nodeIds.length + edgeIds.length > 1)
    content = <MultiSelection nodeIds={nodeIds} edgeIds={edgeIds} />;
  else content = <FlowOverview />;
  return (
    <aside
      className={cx("wpn-flowchart-properties__panel", className)}
      style={style}
    >
      <div className="wpn-flowchart-properties__header-controls">
        {onClose && (
          <button
            type="button"
            className="wpn-flowchart-properties__close"
            aria-label="Close panel"
            title="Close panel"
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      {content}
    </aside>
  );
});

function PanelHeader({
  title,
  color,
  icon,
}: {
  title: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="wpn-flowchart-properties__header"
      style={color ? ({ "--node-color": color } as CSSProperties) : undefined}
    >
      <span className="wpn-flowchart-properties__header-icon">{icon}</span>
      <div className="wpn-flowchart-properties__header-text">
        <div className="wpn-flowchart-properties__header-title">{title}</div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="wpn-flowchart-ui__section">
      <h3 className="wpn-flowchart-ui__section-title">
        <button
          type="button"
          className="wpn-flowchart-ui__section-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {title}
        </button>
      </h3>
      {open && <div className="wpn-flowchart-ui__section-content">{children}</div>}
    </section>
  );
}

function NodeProperties({ nodeId }: { nodeId: string }) {
  const engine = useFlowEngine();
  const node = useFlowState((s) => s.nodeLookup.get(nodeId));
  const readOnly = useFlowState((s) => s.readOnly);
  const issues = useFlowState(
    (s) => s.validation?.issues.filter((i) => i.nodeIds?.includes(nodeId)),
    shallowEqual,
  );
  const session = useEditSession();
  if (!node) {
    return <p className="wpn-flowchart-ui__empty">This item no longer exists.</p>;
  }
  const def = engine.getDefinition(node.type);

  return (
    <>
      <PanelHeader
        title={def.label}
        color={def.color}
        icon={<NodeIcon icon={def.icon} size={14} />}
      />

      {!!issues?.length && (
        <div className="wpn-flowchart-properties__issues">
          {issues.map((i) => (
            <div
              key={i.id}
              className={cx(
                "wpn-flowchart-properties__issue",
                `wpn-flowchart-properties__${i.severity}`,
              )}
            >
              <Icon name="alert" size={13} /> {i.message}
            </div>
          ))}
        </div>
      )}

      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Label</span>
          <input
            className="wpn-flowchart-ui__input"
            value={node.data.label}
            disabled={readOnly}
            onChange={(e) => engine.updateNodeData(nodeId, { label: e.target.value })}
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field wpn-flowchart-ui__field-grow">
          <span className="wpn-flowchart-ui__field-label">Notes</span>
          <textarea
            className="wpn-flowchart-ui__input wpn-flowchart-ui__input-grow"
            style={{ minHeight: 320 }}
            value={node.data.description ?? ""}
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

const edgeTypes: { value: EdgePathType | "default"; label: string; icon: IconName }[] = [
  { value: "default", label: "Default", icon: "flow" },
  ...lineStyleOptions,
];

function EdgeProperties({ edgeId }: { edgeId: string }) {
  const engine = useFlowEngine();
  const edge = useFlowState((s) => s.edgeLookup.get(edgeId));
  const source = useFlowState((s) => (edge ? s.nodeLookup.get(edge.source) : undefined));
  const target = useFlowState((s) => (edge ? s.nodeLookup.get(edge.target) : undefined));
  const readOnly = useFlowState((s) => s.readOnly);
  const issues = useFlowState(
    (s) => s.validation?.issues.filter((i) => i.edgeIds?.includes(edgeId)),
    shallowEqual,
  );
  const session = useEditSession();
  if (!edge) return null;
  const current = edge.type ?? "default";
  return (
    <>
      <PanelHeader
        title="Connection"
        icon={<Icon name="curve" size={14} />}
      />
      {!!issues?.length && (
        <div className="wpn-flowchart-properties__issues">
          {issues.map((i) => (
            <div
              key={i.id}
              className={cx(
                "wpn-flowchart-properties__issue",
                `wpn-flowchart-properties__${i.severity}`,
              )}
            >
              <Icon name="alert" size={13} /> {i.message}
            </div>
          ))}
        </div>
      )}
      <CollapsibleSection title="Styling">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Label</span>
          <input
            className="wpn-flowchart-ui__input"
            value={edge.label ?? ""}
            placeholder="e.g. Yes / No"
            disabled={readOnly}
            onChange={(e) => engine.updateEdge(edgeId, { label: e.target.value || undefined })}
            {...session}
          />
        </label>
        <div className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Line style</span>
          <div className="wpn-flowchart-ui__segmented">
            {edgeTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={readOnly}
                className={cx(
                  "wpn-flowchart-ui__segment",
                  current === t.value && "wpn-flowchart-ui__segment-active",
                )}
                onClick={() =>
                  engine.updateEdge(edgeId, { type: t.value === "default" ? undefined : t.value })
                }
                title={
                  t.value === "default" ? "Use the editor default line style" : `${t.label} line`
                }
              >
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="wpn-flowchart-ui__switch-row">
          <span>Animated</span>
          <input
            type="checkbox"
            className="wpn-flowchart-ui__switch"
            checked={!!edge.animated}
            disabled={readOnly}
            onChange={(e) => engine.updateEdge(edgeId, { animated: e.target.checked })}
          />
        </label>
      </CollapsibleSection>
      <CollapsibleSection title="Endpoints">
        <button
          type="button"
          className="wpn-flowchart-properties__endpoint"
          onClick={() => source && engine.selectNode(source.id)}
        >
          <span>From</span>
          <strong>{source?.data.label ?? `Missing node (${edge.source})`}</strong>
          <code>{edge.sourceHandle}</code>
        </button>
        <button
          type="button"
          className="wpn-flowchart-properties__endpoint"
          onClick={() => target && engine.selectNode(target.id)}
        >
          <span>To</span>
          <strong>{target?.data.label ?? `Missing node (${edge.target})`}</strong>
          <code>{edge.targetHandle}</code>
        </button>
      </CollapsibleSection>
      {!readOnly && (
        <section className={cx("wpn-flowchart-ui__section", "wpn-flowchart-properties__actions")}>
          <button
            type="button"
            className={cx(
              "wpn-flowchart-ui__btn",
              "wpn-flowchart-ui__btn-danger",
              "wpn-flowchart-ui__block",
            )}
            onClick={() => engine.removeEdges([edgeId])}
          >
            <Icon name="trash" size={14} /> Delete connection
          </button>
        </section>
      )}
    </>
  );
}

function MultiSelection({
  nodeIds,
  edgeIds,
}: {
  nodeIds: readonly string[];
  edgeIds: readonly string[];
}) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  return (
    <>
      <PanelHeader
        title={`${nodeIds.length} nodes · ${edgeIds.length} connections`}
        icon={<Icon name="select" size={14} />}
      />
      <section className="wpn-flowchart-ui__section">
        <p className="wpn-flowchart-ui__muted">
          Drag any selected node to move the whole group. Hold Shift and click to add or remove
          items.
        </p>
      </section>
      {!readOnly && (
        <section className={cx("wpn-flowchart-ui__section", "wpn-flowchart-properties__actions")}>
          {nodeIds.length > 0 && (
            <button
              type="button"
              className="wpn-flowchart-ui__btn"
              onClick={() => engine.duplicateNodes([...nodeIds])}
            >
              <Icon name="copy" size={14} /> Duplicate
            </button>
          )}
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-danger")}
            onClick={() => engine.deleteSelection()}
          >
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
  const readOnly = useFlowState((s) => s.readOnly);
  return (
    <>
      <PanelHeader
        title="Flow settings"
        icon={<Icon name="flow" size={14} />}
      />
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Flow name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={name}
            disabled={readOnly}
            onChange={(e) => engine.setFlowName(e.target.value)}
          />
        </label>
      </section>
    </>
  );
}
