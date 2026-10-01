import { useErdEngine, useErdState } from "../../../../context/ErdContext";
import { useErdEditSession } from "../../../../hooks/erd/useErdEditSession";
import type { ErdCardinality, ErdReferentialAction } from "../../../../types/dataModel.types";
import { Switch } from "../../../primitives";
import { Icon } from "../../../WecFlow/FlowIcons";
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

export function RelationshipProperties({ relationshipId }: { relationshipId: string }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const rel = useErdState((s) => s.relationshipLookup.get(relationshipId));
  const entities = useErdState((s) => s.entities);
  const readOnly = useErdState((s) => s.readOnly);
  if (!rel) return <p className="wpn-flowchart-ui__muted">This relationship no longer exists.</p>;

  const entityOptions = entities.map((entity) => ({ value: entity.id, label: entity.name }));
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
