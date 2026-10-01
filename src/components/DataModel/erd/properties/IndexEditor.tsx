import { useErdEngine, useErdState } from "../../../../context/ErdContext";
import { useErdEditSession } from "../../../../hooks/erd/useErdEditSession";
import type { ErdEntity } from "../../../../types/dataModel.types";
import { MultiSelect, Switch } from "../../../primitives";
import { Icon } from "../../../WecFlow/FlowIcons";

export function IndexEditor({ entity }: { entity: ErdEntity }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const readOnly = useErdState((s) => s.readOnly);
  const fieldOptions = entity.fields.map((field) => ({ value: field.id, label: field.name }));

  return (
    <div className="wpn-erd__indexes">
      {entity.indexes.length === 0 && <p className="wpn-flowchart-ui__muted">No indexes yet.</p>}
      {entity.indexes.map((index) => (
        <div key={index.id} className="wpn-erd__index">
          <div className="wpn-erd__value-row">
            <input
              className="wpn-flowchart-ui__input"
              aria-label="Index name"
              value={index.name}
              disabled={readOnly}
              onChange={(e) => engine.updateIndex(entity.id, index.id, { name: e.target.value })}
              {...session}
            />
            {!readOnly && (
              <button
                type="button"
                className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
                aria-label={`Delete index ${index.name}`}
                onClick={() => engine.removeIndex(entity.id, index.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
          <MultiSelect
            size="sm"
            ariaLabel={`Fields of ${index.name}`}
            options={fieldOptions}
            values={index.fieldIds}
            placeholder="Select fields"
            onChange={(fieldIds) => engine.updateIndex(entity.id, index.id, { fieldIds })}
          />
          <div className="wpn-flowchart-ui__switch-row">
            <span>Unique</span>
            <Switch
              label={`Unique index ${index.name}`}
              checked={index.unique}
              disabled={readOnly}
              onChange={(unique) => engine.updateIndex(entity.id, index.id, { unique })}
            />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
          onClick={() => engine.addIndex(entity.id)}
        >
          <Icon name="plus" size={14} /> Add index
        </button>
      )}
    </div>
  );
}
