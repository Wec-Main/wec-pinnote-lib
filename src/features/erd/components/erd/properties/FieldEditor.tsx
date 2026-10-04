import { useState } from "react";
import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import type { ErdEntity, ErdField } from "../../../../../types/dataModel.types";
import { cx } from "../../../../../utils/flowchart/shallow";
import { needsLength, needsPrecision, typeCatalogFor } from "../../../../../utils/erd/erdTypes";
import { Switch } from "../../../../../components/primitives/Switch";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { SelectField, optionalNumber, optionalText } from "./PanelParts";

const CUSTOM_TYPE = "__custom__";
const DEFAULT_LENGTH = 255;
const DEFAULT_PRECISION = 10;
const DEFAULT_SCALE = 2;

const FLAGS = [
  { key: "primaryKey", label: "PK", title: "Primary key" },
  { key: "notNull", label: "NN", title: "Not null" },
  { key: "unique", label: "UQ", title: "Unique" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

const flagValue = (field: ErdField, key: FlagKey): boolean =>
  key === "notNull" ? !field.nullable : field[key];

export function FieldEditor({
  entity,
  field,
  index,
  expanded,
  onToggleExpanded,
}: {
  entity: ErdEntity;
  field: ErdField;
  index: number;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const storeReadOnly = useErdState((s) => s.readOnly);
  const readOnly = storeReadOnly || (entity.locked ?? false);
  const modelEngine = useErdState((s) => s.engine);
  const enums = useErdState((s) => s.enums);
  const catalog = typeCatalogFor(modelEngine);
  const inCatalog = catalog.some((entry) => entry.value === field.type);
  const [customMode, setCustomMode] = useState(!inCatalog);

  const patch = (changes: Partial<Omit<ErdField, "id">>) =>
    engine.updateField(entity.id, field.id, changes);

  const toggleFlag = (key: FlagKey) => {
    const next = !flagValue(field, key);
    if (key === "notNull") patch({ nullable: !next });
    else if (key === "primaryKey")
      patch(next ? { primaryKey: true, nullable: false } : { primaryKey: false });
    else patch({ [key]: next });
  };

  const changeType = (type: string) => {
    patch({
      type,
      length: needsLength(type) ? (field.length ?? DEFAULT_LENGTH) : undefined,
      precision: needsPrecision(type) ? (field.precision ?? DEFAULT_PRECISION) : undefined,
      scale: needsPrecision(type) ? (field.scale ?? DEFAULT_SCALE) : undefined,
    });
  };

  const typeOptions = [
    ...catalog.map((entry) => ({ value: entry.value, label: entry.label, group: entry.group })),
    { value: CUSTOM_TYPE, label: "Custom type…" },
  ];

  return (
    <div
      className={cx("wpn-erd__field", expanded && "wpn-erd__field-expanded")}
      data-field-id={field.id}
    >
      <div className="wpn-erd__field-row">
        <input
          className="wpn-flowchart-ui__input wpn-erd__field-name"
          aria-label="Field name"
          value={field.name}
          disabled={readOnly}
          onChange={(e) => patch({ name: e.target.value })}
          {...session}
        />
        <div className="wpn-erd__flags">
          {FLAGS.map(({ key, label, title }) => (
            <button
              key={key}
              type="button"
              className={cx("wpn-erd__flag", flagValue(field, key) && "wpn-erd__flag-on")}
              aria-pressed={flagValue(field, key)}
              title={title}
              disabled={readOnly}
              onClick={() => toggleFlag(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse field" : "Edit field"}
          title={expanded ? "Collapse field" : "Edit field"}
          onClick={onToggleExpanded}
        >
          <span className={cx("wpn-erd__chevron", expanded && "wpn-erd__chevron-open")}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </div>
      {expanded && (
        <div className="wpn-erd__field-detail">
          <SelectField
            label="Type"
            value={customMode ? CUSTOM_TYPE : field.type}
            options={typeOptions}
            disabled={readOnly}
            onChange={(value) => {
              if (value === CUSTOM_TYPE) {
                setCustomMode(true);
                return;
              }
              setCustomMode(false);
              changeType(value);
            }}
          />
          {(enums.length > 0 || field.enumId) && (
            <SelectField
              label="Enum"
              value={field.enumId ?? ""}
              options={[
                { value: "", label: "None" },
                ...enums.map((entry) => ({ value: entry.id, label: entry.name })),
              ]}
              disabled={readOnly}
              onChange={(value) => patch({ enumId: value === "" ? undefined : value })}
            />
          )}
          {customMode && (
            <label className="wpn-flowchart-ui__field">
              <span className="wpn-flowchart-ui__field-label">Custom type</span>
              <input
                className="wpn-flowchart-ui__input"
                value={field.type}
                disabled={readOnly}
                onChange={(e) => patch({ type: e.target.value })}
                {...session}
              />
            </label>
          )}
          {needsLength(field.type) && (
            <label className="wpn-flowchart-ui__field">
              <span className="wpn-flowchart-ui__field-label">Length</span>
              <input
                type="number"
                min={1}
                className="wpn-flowchart-ui__input"
                value={field.length ?? ""}
                disabled={readOnly}
                onChange={(e) => patch({ length: optionalNumber(e.target.value) })}
                {...session}
              />
            </label>
          )}
          {needsPrecision(field.type) && (
            <div className="wpn-erd__pair">
              <label className="wpn-flowchart-ui__field">
                <span className="wpn-flowchart-ui__field-label">Precision</span>
                <input
                  type="number"
                  min={1}
                  className="wpn-flowchart-ui__input"
                  value={field.precision ?? ""}
                  disabled={readOnly}
                  onChange={(e) => patch({ precision: optionalNumber(e.target.value) })}
                  {...session}
                />
              </label>
              <label className="wpn-flowchart-ui__field">
                <span className="wpn-flowchart-ui__field-label">Scale</span>
                <input
                  type="number"
                  min={0}
                  className="wpn-flowchart-ui__input"
                  value={field.scale ?? ""}
                  disabled={readOnly}
                  onChange={(e) => patch({ scale: optionalNumber(e.target.value) })}
                  {...session}
                />
              </label>
            </div>
          )}
          <label className="wpn-flowchart-ui__field">
            <span className="wpn-flowchart-ui__field-label">Default</span>
            <input
              className="wpn-flowchart-ui__input"
              value={field.defaultValue ?? ""}
              disabled={readOnly || Boolean(field.generated)}
              onChange={(e) => patch({ defaultValue: optionalText(e.target.value) })}
              {...session}
            />
          </label>
          <label className="wpn-flowchart-ui__field">
            <span className="wpn-flowchart-ui__field-label">Comment</span>
            <input
              className="wpn-flowchart-ui__input"
              value={field.comment ?? ""}
              disabled={readOnly}
              onChange={(e) => patch({ comment: optionalText(e.target.value) })}
              {...session}
            />
          </label>
          <label className="wpn-flowchart-ui__field">
            <span className="wpn-flowchart-ui__field-label">Check constraint</span>
            <input
              className="wpn-flowchart-ui__input"
              placeholder="price > 0"
              value={field.check ?? ""}
              disabled={readOnly}
              onChange={(e) => patch({ check: optionalText(e.target.value) })}
              {...session}
            />
          </label>
          <div className="wpn-flowchart-ui__field">
            <span className="wpn-flowchart-ui__field-label">Generated column</span>
            <label className="wpn-flowchart-ui__switch-row">
              <span>Computed from an expression</span>
              <input
                type="checkbox"
                checked={Boolean(field.generated)}
                disabled={readOnly}
                onChange={(e) => {
                  if (e.target.checked) {
                    patch({ generated: { expression: "", stored: true }, defaultValue: undefined });
                  } else {
                    patch({ generated: undefined });
                  }
                }}
              />
            </label>
            {field.generated &&
              (() => {
                const generated = field.generated;
                return (
                  <>
                    <input
                      className="wpn-flowchart-ui__input"
                      placeholder="price * quantity"
                      value={generated.expression}
                      disabled={readOnly}
                      onChange={(e) =>
                        patch({ generated: { ...generated, expression: e.target.value } })
                      }
                      {...session}
                    />
                    <div className="wpn-flowchart-ui__switch-row">
                      <span>Stored</span>
                      <Switch
                        label="Stored"
                        checked={generated.stored ?? true}
                        disabled={readOnly}
                        onChange={(stored) => patch({ generated: { ...generated, stored } })}
                      />
                    </div>
                  </>
                );
              })()}
          </div>
          {!readOnly && (
            <div className="wpn-erd__field-actions">
              <button
                type="button"
                className="wpn-flowchart-ui__btn"
                disabled={index === 0}
                onClick={() => engine.moveField(entity.id, field.id, index - 1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="wpn-flowchart-ui__btn"
                disabled={index === entity.fields.length - 1}
                onClick={() => engine.moveField(entity.id, field.id, index + 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger"
                onClick={() => engine.removeField(entity.id, field.id)}
              >
                <Icon name="trash" size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
