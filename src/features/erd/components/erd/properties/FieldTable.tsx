import { useEffect, useRef, useState } from "react";
import { useErdEngine, useErdState } from "../../../ErdContext";
import type { ErdEntity } from "../../../../../types/dataModel.types";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { FieldEditor } from "./FieldEditor";

export function FieldTable({ entity }: { entity: ErdEntity }) {
  const engine = useErdEngine();
  const storeReadOnly = useErdState((s) => s.readOnly);
  const disabled = storeReadOnly || (entity.locked ?? false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeFieldId = useErdState((s) => s.activeFieldId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeFieldId || !entity.fields.some((field) => field.id === activeFieldId)) return;
    setExpandedId(activeFieldId);
    containerRef.current
      ?.querySelector(`[data-field-id="${activeFieldId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeFieldId, entity.fields]);

  return (
    <div className="wpn-erd__field-table" ref={containerRef}>
      {entity.fields.length === 0 && <p className="wpn-flowchart-ui__muted">No fields yet.</p>}
      {entity.fields.map((field, index) => (
        <FieldEditor
          key={field.id}
          entity={entity}
          field={field}
          index={index}
          expanded={expandedId === field.id}
          onToggleExpanded={() => setExpandedId(expandedId === field.id ? null : field.id)}
        />
      ))}
      {!disabled && (
        <button
          type="button"
          className="wpn-flowchart-ui__btn wpn-flowchart-ui__block"
          onClick={() => {
            const added = engine.addField(entity.id);
            if (added) setExpandedId(added.id);
          }}
        >
          <Icon name="plus" size={14} /> Add field
        </button>
      )}
    </div>
  );
}
