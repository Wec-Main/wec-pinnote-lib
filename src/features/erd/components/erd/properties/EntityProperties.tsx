import { useState } from "react";
import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import { Switch } from "../../../../../components/primitives/Switch";
import { Tabs } from "../../../../../components/primitives/Tabs";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { FieldTable } from "./FieldTable";
import { IndexEditor } from "./IndexEditor";
import { CollapsibleSection, PanelHeader, optionalText } from "./PanelParts";

export function EntityProperties({ entityId }: { entityId: string }) {
  const [tab, setTab] = useState("general");
  const [auditTimestamps, setAuditTimestamps] = useState(true);
  const [auditSoftDelete, setAuditSoftDelete] = useState(true);
  const [auditActorTracking, setAuditActorTracking] = useState(false);
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

  const locked = entity.locked ?? false;
  const fieldsDisabled = readOnly || locked;

  const related = relationships.filter(
    (rel) => rel.sourceEntityId === entityId || rel.targetEntityId === entityId,
  );
  const describe = (entId: string, fieldId?: string) => {
    const owner = engine.getEntity(entId);
    const fieldName = fieldId ? owner?.fields.find((f) => f.id === fieldId)?.name : undefined;
    return fieldName ? `${owner?.name ?? "?"}.${fieldName}` : (owner?.name ?? "?");
  };

  const tabs = [
    { id: "general", label: "General" },
    { id: "fields", label: `Fields (${entity.fields.length})` },
  ];

  let tabContent: JSX.Element;
  if (tab === "general") {
    tabContent = (
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={entity.name}
            disabled={fieldsDisabled}
            onChange={(e) => engine.updateEntity(entityId, { name: e.target.value })}
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Schema</span>
          <input
            className="wpn-flowchart-ui__input"
            value={entity.schema ?? "public"}
            disabled={fieldsDisabled}
            onChange={(e) => engine.updateEntity(entityId, { schema: e.target.value })}
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field wpn-flowchart-ui__field-grow">
          <span className="wpn-flowchart-ui__field-label">Comments</span>
          <textarea
            className="wpn-flowchart-ui__input wpn-flowchart-ui__input-grow"
            style={{ minHeight: 240 }}
            placeholder="What does this entity store? Rules, ownership, notes…"
            value={entity.comment ?? ""}
            disabled={fieldsDisabled}
            onChange={(e) =>
              engine.updateEntity(entityId, { comment: optionalText(e.target.value) })
            }
            {...session}
          />
        </label>
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Group / subject area</span>
          <input
            className="wpn-flowchart-ui__input"
            placeholder="e.g. Billing"
            value={entity.group ?? ""}
            disabled={readOnly}
            onChange={(e) => engine.updateEntity(entityId, { group: optionalText(e.target.value) })}
            {...session}
          />
        </label>
        <div className="wpn-flowchart-ui__switch-row">
          <span>Collapsed</span>
          <Switch
            label="Collapsed"
            checked={entity.collapsed ?? false}
            disabled={fieldsDisabled}
            onChange={(collapsed) => engine.updateEntity(entityId, { collapsed })}
          />
        </div>
        <div className="wpn-flowchart-ui__switch-row">
          <span>Locked — prevents edits</span>
          <Switch
            label="Locked — prevents edits"
            checked={locked}
            disabled={readOnly}
            onChange={(nextLocked) => engine.updateEntity(entityId, { locked: nextLocked })}
          />
        </div>
      </section>
    );
  } else {
    tabContent = (
      <>
        <CollapsibleSection title="Fields">
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
        <CollapsibleSection title="Add audit columns">
          <label className="wpn-flowchart-ui__switch-row">
            <span>Timestamps</span>
            <input
              type="checkbox"
              checked={auditTimestamps}
              disabled={fieldsDisabled}
              onChange={(e) => setAuditTimestamps(e.target.checked)}
            />
          </label>
          <label className="wpn-flowchart-ui__switch-row">
            <span>Soft delete</span>
            <input
              type="checkbox"
              checked={auditSoftDelete}
              disabled={fieldsDisabled}
              onChange={(e) => setAuditSoftDelete(e.target.checked)}
            />
          </label>
          <label className="wpn-flowchart-ui__switch-row">
            <span>Actor tracking</span>
            <input
              type="checkbox"
              checked={auditActorTracking}
              disabled={fieldsDisabled}
              onChange={(e) => setAuditActorTracking(e.target.checked)}
            />
          </label>
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
            disabled={fieldsDisabled}
            onClick={() =>
              engine.addAuditColumns(entityId, {
                timestamps: auditTimestamps,
                softDelete: auditSoftDelete,
                actorTracking: auditActorTracking,
              })
            }
          >
            <Icon name="plus" size={14} /> Add fields
          </button>
        </CollapsibleSection>
      </>
    );
  }

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
      <Tabs tabs={tabs} activeTabId={tab} onChange={setTab} ariaLabel="Entity sections" />
      {tabContent}
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
