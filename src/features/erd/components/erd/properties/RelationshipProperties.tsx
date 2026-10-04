import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import { AI_ERD_LIMITS } from "../../../../ai/ops/limits";
import type { ErdCardinality, ErdReferentialAction } from "../../../../../types/dataModel.types";
import { Switch } from "../../../../../components/primitives/Switch";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { PanelHeader, SelectField, optionalText } from "./PanelParts";

const CARDINALITIES: { value: ErdCardinality; label: string }[] = [
  { value: "one-to-one", label: "One to one" },
  { value: "one-to-many", label: "One to many" },
  { value: "many-to-many", label: "Many to many" },
];

const ACTIONS: { value: ErdReferentialAction; label: string }[] = [
  { value: "no-action", label: "No action" },
  { value: "cascade", label: "Cascade" },
  { value: "restrict", label: "Restrict" },
  { value: "set-null", label: "Set null" },
];

const MAX_COMPOSITE_FIELDS = AI_ERD_LIMITS.maxCompositeKeyFields;

export function RelationshipProperties({ relationshipId }: { relationshipId: string }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const rel = useErdState((s) => s.relationshipLookup.get(relationshipId));
  const entities = useErdState((s) => s.entities);
  const readOnly = useErdState((s) => s.readOnly);
  if (!rel) return <p className="wpn-flowchart-ui__muted">This relationship no longer exists.</p>;

  const entityOptions = entities.map((entity) => ({ value: entity.id, label: entity.name }));
  const sourceFields = entities.find((entity) => entity.id === rel.sourceEntityId)?.fields ?? [];
  const targetFields = entities.find((entity) => entity.id === rel.targetEntityId)?.fields ?? [];
  const sourceFieldOptions = sourceFields.map((field) => ({ value: field.id, label: field.name }));
  const targetFieldOptions = targetFields.map((field) => ({ value: field.id, label: field.name }));

  const compositeSource = rel.sourceFieldIds ?? [];
  const compositeTarget = rel.targetFieldIds ?? [];
  const isComposite = compositeSource.length > 0 || compositeTarget.length > 0;
  const pairs = isComposite
    ? compositeSource.map((sourceFieldId, i) => ({
        sourceFieldId,
        targetFieldId: compositeTarget[i],
      }))
    : [{ sourceFieldId: rel.sourceFieldId, targetFieldId: rel.targetFieldId }];

  const addPair = () => {
    const baseSource =
      compositeSource.length > 0 ? compositeSource : rel.sourceFieldId ? [rel.sourceFieldId] : [];
    const baseTarget =
      compositeTarget.length > 0 ? compositeTarget : rel.targetFieldId ? [rel.targetFieldId] : [];
    const nextSourceField =
      sourceFields.find((field) => !baseSource.includes(field.id))?.id ?? sourceFields[0]?.id ?? "";
    const nextTargetField =
      targetFields.find((field) => !baseTarget.includes(field.id))?.id ?? targetFields[0]?.id ?? "";
    engine.updateRelationship(relationshipId, {
      sourceFieldIds: [...baseSource, nextSourceField],
      targetFieldIds: [...baseTarget, nextTargetField],
    });
  };

  const updatePair = (index: number, side: "source" | "target", fieldId: string) => {
    if (!isComposite) {
      engine.updateRelationship(
        relationshipId,
        side === "source" ? { sourceFieldId: fieldId } : { targetFieldId: fieldId },
      );
      return;
    }
    if (side === "source") {
      const next = [...compositeSource];
      next[index] = fieldId;
      engine.updateRelationship(relationshipId, { sourceFieldIds: next });
    } else {
      const next = [...compositeTarget];
      next[index] = fieldId;
      engine.updateRelationship(relationshipId, { targetFieldIds: next });
    }
  };

  const removePair = (index: number) => {
    const nextSource = compositeSource.filter((_, i) => i !== index);
    const nextTarget = compositeTarget.filter((_, i) => i !== index);
    engine.updateRelationship(relationshipId, {
      sourceFieldIds: nextSource.length > 0 ? nextSource : undefined,
      targetFieldIds: nextTarget.length > 0 ? nextTarget : undefined,
    });
  };

  const materialize = () => {
    const result = engine.materializeJoinTable(relationshipId);
    if (result) engine.select("entity", result.id);
  };

  return (
    <>
      <PanelHeader title="Relationship" icon={<Icon name="curve" size={14} />} />
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={rel.name ?? ""}
            placeholder="Optional label"
            disabled={readOnly}
            onChange={(e) =>
              engine.updateRelationship(relationshipId, { name: optionalText(e.target.value) })
            }
            {...session}
          />
        </label>
        <SelectField
          label="Source entity"
          value={rel.sourceEntityId}
          options={entityOptions}
          disabled={readOnly}
          onChange={(sourceEntityId) =>
            engine.updateRelationship(relationshipId, { sourceEntityId })
          }
        />
        <SelectField
          label="Target entity"
          value={rel.targetEntityId}
          options={entityOptions}
          disabled={readOnly}
          onChange={(targetEntityId) =>
            engine.updateRelationship(relationshipId, { targetEntityId })
          }
        />
      </section>
      <section className="wpn-flowchart-ui__section">
        <SelectField
          label="Cardinality"
          value={rel.cardinality}
          options={CARDINALITIES}
          disabled={readOnly}
          onChange={(value) =>
            engine.updateRelationship(relationshipId, { cardinality: value as ErdCardinality })
          }
        />
        <div className="wpn-flowchart-ui__switch-row">
          <span>Source optional</span>
          <Switch
            label="Source optional"
            checked={rel.sourceOptional}
            disabled={readOnly}
            onChange={(sourceOptional) =>
              engine.updateRelationship(relationshipId, { sourceOptional })
            }
          />
        </div>
        <div className="wpn-flowchart-ui__switch-row">
          <span>Target optional</span>
          <Switch
            label="Target optional"
            checked={rel.targetOptional}
            disabled={readOnly}
            onChange={(targetOptional) =>
              engine.updateRelationship(relationshipId, { targetOptional })
            }
          />
        </div>
        <SelectField
          label="On delete"
          value={rel.onDelete}
          options={ACTIONS}
          disabled={readOnly}
          onChange={(value) =>
            engine.updateRelationship(relationshipId, { onDelete: value as ErdReferentialAction })
          }
        />
        <SelectField
          label="On update"
          value={rel.onUpdate}
          options={ACTIONS}
          disabled={readOnly}
          onChange={(value) =>
            engine.updateRelationship(relationshipId, { onUpdate: value as ErdReferentialAction })
          }
        />
      </section>
      {rel.cardinality !== "many-to-many" && (
        <section className="wpn-flowchart-ui__section">
          <span className="wpn-flowchart-ui__field-label">Foreign key fields</span>
          {pairs.map((pair, index) => (
            <div key={index} className="wpn-erd__value-row">
              <SelectField
                label="Source field"
                value={pair.sourceFieldId ?? ""}
                options={[{ value: "", label: "None" }, ...sourceFieldOptions]}
                disabled={readOnly}
                onChange={(value) => updatePair(index, "source", value)}
              />
              <SelectField
                label="Target field"
                value={pair.targetFieldId ?? ""}
                options={[{ value: "", label: "None" }, ...targetFieldOptions]}
                disabled={readOnly}
                onChange={(value) => updatePair(index, "target", value)}
              />
              {!readOnly && isComposite && (
                <button
                  type="button"
                  className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
                  aria-label={`Remove field pair ${index + 1}`}
                  onClick={() => removePair(index)}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
              disabled={pairs.length >= MAX_COMPOSITE_FIELDS}
              onClick={addPair}
            >
              <Icon name="plus" size={14} /> Add field pair
            </button>
          )}
        </section>
      )}
      {rel.cardinality === "many-to-many" && !readOnly && (
        <section className="wpn-flowchart-ui__section">
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
            onClick={materialize}
          >
            <Icon name="database" size={14} /> Materialize join table
          </button>
        </section>
      )}
      {!readOnly && (
        <section className="wpn-flowchart-ui__section wpn-flowchart-properties__actions">
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger wpn-flowchart-ui__block"
            onClick={() => engine.removeRelationships([relationshipId])}
          >
            <Icon name="trash" size={14} /> Delete relationship
          </button>
        </section>
      )}
    </>
  );
}
