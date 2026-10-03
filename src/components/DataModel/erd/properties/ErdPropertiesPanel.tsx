import { memo, type CSSProperties } from "react";
import { useErdState } from "../../../../context/ErdContext";
import type { ErdEngineName } from "../../../../types/dataModel.types";
import { cx } from "../../../../utils/flowchart/shallow";
import { Icon } from "../../../WecFlow/FlowIcons";
import { EntityProperties } from "./EntityProperties";
import { EnumProperties } from "./EnumProperties";
import { ModelOverview } from "./ModelOverview";
import { MultiSelection } from "./MultiSelection";
import { NoteProperties } from "./NoteProperties";
import { RelationshipProperties } from "./RelationshipProperties";

export interface ErdPropertiesPanelProps {
  className?: string;
  style?: CSSProperties;
  onClose?: () => void;
  description?: string;
  onMetaChange?: (patch: { name?: string; description?: string; engine?: ErdEngineName }) => void;
}

export const ErdPropertiesPanel = memo(function ErdPropertiesPanel({
  className,
  style,
  onClose,
  description,
  onMetaChange,
}: ErdPropertiesPanelProps) {
  const selection = useErdState((s) => s.selection);
  const entityIds = [...selection.entityIds];
  const noteIds = [...selection.noteIds];
  const relationshipIds = [...selection.relationshipIds];
  const enumId = selection.enumId;
  const total = entityIds.length + noteIds.length + relationshipIds.length;

  let content;
  if (total > 1) {
    content = (
      <MultiSelection
        entityCount={entityIds.length}
        noteCount={noteIds.length}
        relationshipCount={relationshipIds.length}
      />
    );
  } else if (entityIds[0] !== undefined) {
    content = <EntityProperties key={entityIds[0]} entityId={entityIds[0]} />;
  } else if (relationshipIds[0] !== undefined) {
    content = (
      <RelationshipProperties key={relationshipIds[0]} relationshipId={relationshipIds[0]} />
    );
  } else if (noteIds[0] !== undefined) {
    content = <NoteProperties key={noteIds[0]} noteId={noteIds[0]} />;
  } else if (enumId) {
    content = <EnumProperties key={enumId} enumId={enumId} />;
  } else {
    content = <ModelOverview description={description} onMetaChange={onMetaChange} />;
  }

  return (
    <aside className={cx("wpn-flowchart-properties__panel", className)} style={style}>
      <div className="wpn-flowchart-properties__header-controls">
        {onClose && (
          <button
            type="button"
            className="wpn-flowchart-properties__close"
            aria-label="Close panel"
            title="Close panel"
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      {content}
    </aside>
  );
});
