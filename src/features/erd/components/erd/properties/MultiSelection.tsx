import { useErdEngine, useErdState } from "../../../ErdContext";
import { Icon } from "../../../../flowchart/components/FlowIcons";
import { PanelHeader } from "./PanelParts";

export function MultiSelection({
  entityCount,
  noteCount,
  relationshipCount,
}: {
  entityCount: number;
  noteCount: number;
  relationshipCount: number;
}) {
  const engine = useErdEngine();
  const readOnly = useErdState((s) => s.readOnly);
  return (
    <>
      <PanelHeader
        title={`${entityCount} entities · ${relationshipCount} relationships · ${noteCount} notes`}
        icon={<Icon name="select" size={14} />}
      />
      <section className="wpn-flowchart-ui__section">
        <p className="wpn-flowchart-ui__muted">
          Drag any selected entity to move the group. Hold Shift and click to add or remove items.
        </p>
      </section>
      {!readOnly && (
        <section className="wpn-flowchart-ui__section wpn-flowchart-properties__actions">
          {entityCount > 0 && (
            <button
              type="button"
              className="wpn-flowchart-ui__btn"
              onClick={() => engine.duplicateEntities([...engine.getState().selection.entityIds])}
            >
              <Icon name="copy" size={14} /> Duplicate
            </button>
          )}
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger"
            onClick={() => engine.deleteSelection()}
          >
            <Icon name="trash" size={14} /> Delete selected
          </button>
        </section>
      )}
    </>
  );
}
