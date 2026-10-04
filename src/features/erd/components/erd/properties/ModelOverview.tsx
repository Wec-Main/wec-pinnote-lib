import { useEffect, useState } from "react";
import { useErdEngine, useErdState } from "../../../ErdContext";
import { DATA_MODEL_ENGINES, type ErdEngineName } from "../../../../../types/dataModel.types";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { PanelHeader, SelectField } from "./PanelParts";

const ENGINE_LABELS: Record<ErdEngineName, string> = {
  na: "N/A",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

const ENGINE_OPTIONS = DATA_MODEL_ENGINES.map((value) => ({ value, label: ENGINE_LABELS[value] }));

export interface ModelMetaPatch {
  name?: string;
  description?: string;
  engine?: ErdEngineName;
}

export function ModelOverview({
  description = "",
  onMetaChange,
}: {
  description?: string;
  onMetaChange?: (patch: ModelMetaPatch) => void;
}) {
  const engine = useErdEngine();
  const name = useErdState((s) => s.name);
  const modelEngine = useErdState((s) => s.engine);
  const readOnly = useErdState((s) => s.readOnly);
  const [descriptionDraft, setDescriptionDraft] = useState(description);

  useEffect(() => {
    setDescriptionDraft(description);
  }, [description]);

  return (
    <>
      <PanelHeader title="Data model" icon={<Icon name="database" size={14} />} />
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Name</span>
          <input
            className="wpn-flowchart-ui__input"
            value={name}
            disabled={readOnly}
            onChange={(e) => engine.setName(e.target.value)}
            onBlur={(e) => onMetaChange?.({ name: e.target.value })}
          />
        </label>
        <SelectField
          label="Engine"
          value={modelEngine}
          options={ENGINE_OPTIONS}
          disabled={readOnly}
          onChange={(value) => {
            const next = value as ErdEngineName;
            engine.setEngine(next);
            onMetaChange?.({ engine: next });
          }}
        />
        <label className="wpn-flowchart-ui__field wpn-flowchart-ui__field-grow">
          <span className="wpn-flowchart-ui__field-label">Description</span>
          <textarea
            className="wpn-flowchart-ui__input wpn-flowchart-ui__input-grow"
            style={{ minHeight: 320 }}
            placeholder="What is this data model for? Context, assumptions, open questions…"
            value={descriptionDraft}
            disabled={readOnly}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onBlur={() => {
              if (descriptionDraft !== description)
                onMetaChange?.({ description: descriptionDraft });
            }}
          />
        </label>
      </section>
    </>
  );
}
