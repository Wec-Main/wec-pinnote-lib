import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { PanelHeader } from "./PanelParts";

export function EnumProperties({ enumId }: { enumId: string }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const entry = useErdState((s) => s.enumLookup.get(enumId));
  const readOnly = useErdState((s) => s.readOnly);
  const entities = useErdState((s) => s.entities);
  if (!entry) return <p className="wpn-flowchart-ui__muted">This enum no longer exists.</p>;

  const usedBy = entities.flatMap((entity) =>
    entity.fields
      .filter((field) => field.enumId === enumId)
      .map((field) => `${entity.name}.${field.name}`),
  );
  const setValues = (values: string[]) => engine.updateEnum(enumId, { values });

  const renameValue = (index: number, next: string) => {
    const previous = entry.values[index];
    const values = entry.values.map((value, i) => (i === index ? next : value));
    const descriptions = { ...entry.descriptions };
    if (previous !== undefined && previous in descriptions) {
      const existing = descriptions[previous];
      delete descriptions[previous];
      if (existing !== undefined) descriptions[next] = existing;
    }
    engine.updateEnum(enumId, { values, descriptions });
  };

  const setDescription = (value: string, description: string) => {
    engine.updateEnum(enumId, { descriptions: { ...entry.descriptions, [value]: description } });
  };

  const swapValues = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= entry.values.length) return;
    const values = [...entry.values];
    const temp = values[index] as string;
    values[index] = values[target] as string;
    values[target] = temp;
    setValues(values);
  };

  const convertToTable = () => {
    const result = engine.convertEnumToTable(enumId);
    if (result) engine.select("entity", result.id);
  };

  return (
    <>
      <PanelHeader title="Enum" icon={<Icon name="puzzle" size={14} />} />
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={entry.name}
            disabled={readOnly}
            onChange={(e) => engine.updateEnum(enumId, { name: e.target.value })}
            {...session}
          />
        </label>
        <div className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Values ({entry.values.length})</span>
          {entry.values.length === 0 && <p className="wpn-flowchart-ui__muted">No values yet.</p>}
          {entry.values.map((value, index) => (
            <div key={index} className="wpn-erd__value-row">
              <input
                className="wpn-flowchart-ui__input"
                aria-label={`Value ${index + 1}`}
                value={value}
                disabled={readOnly}
                onChange={(e) => renameValue(index, e.target.value)}
                {...session}
              />
              <input
                className="wpn-flowchart-ui__input"
                aria-label={`Description for value ${index + 1}`}
                placeholder="Description (optional)"
                value={entry.descriptions?.[value] ?? ""}
                disabled={readOnly}
                onChange={(e) => setDescription(value, e.target.value)}
                {...session}
              />
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
                    aria-label={`Move value ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => swapValues(index, -1)}
                  >
                    <Icon name="chevron" size={14} className="wpn-erd__chevron-up" />
                  </button>
                  <button
                    type="button"
                    className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
                    aria-label={`Move value ${index + 1} down`}
                    disabled={index === entry.values.length - 1}
                    onClick={() => swapValues(index, 1)}
                  >
                    <Icon name="chevron" size={14} className="wpn-erd__chevron-open" />
                  </button>
                  <button
                    type="button"
                    className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-flowchart-ui__icon-btn"
                    aria-label={`Remove value ${index + 1}`}
                    onClick={() => setValues(entry.values.filter((_, i) => i !== index))}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
              onClick={() => setValues([...entry.values, `value_${entry.values.length + 1}`])}
            >
              <Icon name="plus" size={14} /> Add value
            </button>
          )}
        </div>
        <div className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Used by</span>
          {usedBy.length === 0 ? (
            <p className="wpn-flowchart-ui__muted">
              Not used. Pick this enum on a field to use it.
            </p>
          ) : (
            usedBy.map((label) => (
              <span key={label} className="wpn-flowchart-ui__muted">
                {label}
              </span>
            ))
          )}
        </div>
      </section>
      {!readOnly && (
        <section className="wpn-flowchart-ui__section wpn-flowchart-properties__actions">
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
            onClick={convertToTable}
          >
            <Icon name="database" size={14} /> Convert to table
          </button>
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger wpn-flowchart-ui__block"
            onClick={() => engine.removeEnum(enumId)}
          >
            <Icon name="trash" size={14} /> Delete enum
          </button>
        </section>
      )}
    </>
  );
}
