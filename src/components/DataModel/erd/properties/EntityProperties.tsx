import { useErdEngine, useErdState } from "../../../../context/ErdContext";
import { useErdEditSession } from "../../../../hooks/erd/useErdEditSession";
import { Switch } from "../../../primitives";
import { Icon } from "../../../WecFlow/FlowIcons";
import { FieldTable } from "./FieldTable";
import { IndexEditor } from "./IndexEditor";
import { CollapsibleSection, PanelHeader, optionalText } from "./PanelParts";

export function EntityProperties({ entityId }: { entityId: string }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const entity = useErdState((s) => s.entityLookup.get(entityId));
  const readOnly = useErdState((s) => s.readOnly);
  const relationships = useErdState((s) => s.relationships);
  const issues = useErdState((s) =>
    s.validation?.issues
      .filter((issue) => issue.entityId === entityId)
      .map((i) => i.message)
      .join("\n"),
  );
  if (!entity) return <p className="wpn-flowchart-ui__muted">This entity no longer exists.</p>;

  const related = relationships.filter(
    (rel) => rel.sourceEntityId === entityId || rel.targetEntityId === entityId,
  );
  const describe = (entId: string, fieldId?: string) => {
    const owner = engine.getEntity(entId);
    const fieldName = fieldId ? owner?.fields.find((f) => f.id === fieldId)?.name : undefined;
    return fieldName ? `${owner?.name ?? "?"}.${fieldName}` : (owner?.name ?? "?");
  };

  return (
    <>
      <PanelHeader title="Entity" icon={<Icon name="database" size={14} />} />
      {issues && (
        <div className="wpn-flowchart-properties__issues">
          {issues.split("\n").map((message) => (
            <div key={message} className="wpn-flowchart-properties__issue">
              <Icon name="alert" size={13} /> {message}
            </div>
          ))}
        </div>
      )}
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={entity.name}
            disabled={readOnly}
            onChange={(e) => engine.updateEntity(entityId, { name: e.target.value })}
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Schema</span>
          <input
            className="wpn-flowchart-ui__input"
            value={entity.schema ?? "public"}
            disabled={readOnly}
            onChange={(e) => engine.updateEntity(entityId, { schema: e.target.value })}
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Comment</span>
          <textarea
            className="wpn-flowchart-ui__input wpn-erd__textarea"
            value={entity.comment ?? ""}
            disabled={readOnly}
            onChange={(e) =>
              engine.updateEntity(entityId, { comment: optionalText(e.target.value) })
            }
            {...session}
          />
        </label>
        <div className="wpn-flowchart-ui__switch-row">
          <span>Collapsed</span>
          <Switch
            label="Collapsed"
            checked={entity.collapsed ?? false}
            disabled={readOnly}
            onChange={(collapsed) => engine.updateEntity(entityId, { collapsed })}
          />
        </div>
      </section>
      <CollapsibleSection title={`Fields (${entity.fields.length})`}>
        <FieldTable entity={entity} />
      </CollapsibleSection>
      <CollapsibleSection title={`Indexes (${entity.indexes.length})`}>
        <IndexEditor entity={entity} />
      </CollapsibleSection>
      <CollapsibleSection title={`Relationships (${related.length})`}>
        {related.length === 0 && <p className="wpn-flowchart-ui__muted">No relationships.</p>}
        {related.map((rel) => (
          <button
            key={rel.id}
            type="button"
            className="wpn-flowchart-properties__endpoint"
            onClick={() => engine.select("relationship", rel.id)}
          >
            <strong>{describe(rel.sourceEntityId, rel.sourceFieldId)}</strong>
            <span>→</span>
            <strong>{describe(rel.targetEntityId, rel.targetFieldId)}</strong>
          </button>
        ))}
      </CollapsibleSection>
      {!readOnly && (
        <section className="wpn-flowchart-ui__section wpn-flowchart-properties__actions">
          <button
            type="button"
            className="wpn-flowchart-ui__btn"
            onClick={() => engine.duplicateEntities([entityId])}
          >
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger"
            onClick={() => engine.removeEntities([entityId])}
          >
            <Icon name="trash" size={14} /> Delete entity
          </button>
        </section>
      )}
    </>
  );
}
