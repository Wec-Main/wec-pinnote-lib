import { useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { DataModelEditorPane } from "./DataModelEditorPane";
import { DataModelListPanel } from "./DataModelListPanel";

export function DataModelPanel() {
  const { setDataModelOpen } = useAnnotationContext();
  const [openDataModelId, setOpenDataModelId] = useState<string | null>(null);

  return (
    <div className="wpn-flow-panel wpn-datamodel-panel">
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="dataModel" />
          </span>
          <span className="wpn-panel__title">Data Models</span>
          {openDataModelId ? (
            <button
              type="button"
              className="wpn-flow-panel__back"
              onClick={() => setOpenDataModelId(null)}
            >
              <Icon name="chevronLeft" className="wpn-flow-panel__back-icon" />
              Back to data models
            </button>
          ) : null}
        </span>
        <div className="wpn-flow-panel__header-actions">
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close Data Models"
              onClick={() => setDataModelOpen(false)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-flow-panel__body">
        {openDataModelId ? (
          <DataModelEditorPane dataModelId={openDataModelId} />
        ) : (
          <DataModelListPanel onOpen={setOpenDataModelId} />
        )}
      </div>
    </div>
  );
}
