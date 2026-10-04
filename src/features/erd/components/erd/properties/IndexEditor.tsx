import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import {
  ERD_INDEX_METHODS,
  type ErdEntity,
  type ErdIndexMethod,
} from "../../../../../types/dataModel.types";
import { MultiSelect } from "../../../../../components/primitives/MultiSelect";
import { Switch } from "../../../../../components/primitives/Switch";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { SelectField, optionalText } from "./PanelParts";

const METHOD_OPTIONS = [
  { value: "", label: "Default (btree)" },
  ...ERD_INDEX_METHODS.map((method) => ({ value: method, label: method })),
];

export function IndexEditor({ entity }: { entity: ErdEntity }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const storeReadOnly = useErdState((s) => s.readOnly);
  const modelEngine = useErdState((s) => s.engine);
  const disabled = storeReadOnly || (entity.locked ?? false);
  const showAdvanced = modelEngine === "postgres" || modelEngine === "na";
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
              disabled={disabled}
              onChange={(e) => engine.updateIndex(entity.id, index.id, { name: e.target.value })}
              {...session}
            />
            {!disabled && (
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
              disabled={disabled}
              onChange={(unique) => engine.updateIndex(entity.id, index.id, { unique })}
            />
          </div>
          {showAdvanced && (
            <>
              <SelectField
                label="Method"
                value={index.method ?? ""}
                options={METHOD_OPTIONS}
                disabled={disabled}
                onChange={(value) =>
                  engine.updateIndex(entity.id, index.id, {
                    method: value === "" ? undefined : (value as ErdIndexMethod),
                  })
                }
              />
              <label className="wpn-flowchart-ui__field">
                <span className="wpn-flowchart-ui__field-label">
                  Partial index condition (WHERE)
                </span>
                <input
                  className="wpn-flowchart-ui__input"
                  placeholder="deleted_at IS NULL"
                  value={index.where ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    engine.updateIndex(entity.id, index.id, { where: optionalText(e.target.value) })
                  }
                  {...session}
                />
              </label>
            </>
          )}
        </div>
      ))}
      {!disabled && (
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
