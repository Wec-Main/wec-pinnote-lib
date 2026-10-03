import { useEffect, useState } from "react";
import { AiWorkSlotContext } from "../Ai/AiWorkSlot";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { DataModelEditorPane } from "./DataModelEditorPane";
import { DataModelListPanel } from "./DataModelListPanel";
import { useDataModelLeaveGuardHost } from "./DataModelLeaveGuard";

export function DataModelPanel() {
  const { setDataModelOpen, referenceRequest, consumeReferenceRequest } = useAnnotationContext();
  const [openDataModelId, setOpenDataModelId] = useState<string | null>(null);
  const leaveGuard = useDataModelLeaveGuardHost();
  const { guard } = leaveGuard;

  useEffect(() => {
    if (referenceRequest?.kind === "dataModel") {
      const id = referenceRequest.id;
      consumeReferenceRequest();
      if (id !== openDataModelId) guard(() => setOpenDataModelId(id));
    }
  }, [consumeReferenceRequest, guard, openDataModelId, referenceRequest]);

  const [aiWorkSlot, setAiWorkSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="wpn-flow-panel wpn-datamodel-panel">
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          <span className="wpn-flow-panel__brand-icon wpn-flow-panel__brand-icon--model">
            <Icon name="dataModel" />
          </span>
          <span className="wpn-panel__title">Data Models</span>
          {openDataModelId ? (
            <button
              type="button"
              className="wpn-flow-panel__back"
              onClick={() => guard(() => setOpenDataModelId(null))}
            >
              <Icon name="chevronLeft" className="wpn-flow-panel__back-icon" />
              Back to data models
            </button>
          ) : null}
        </span>
        <div className="wpn-flow-panel__status" ref={setAiWorkSlot} />
        <div className="wpn-flow-panel__header-actions">
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close Data Models"
              onClick={() => guard(() => setDataModelOpen(false))}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="wpn-flow-panel__body">
        <AiWorkSlotContext.Provider value={aiWorkSlot}>
          {openDataModelId ? (
            leaveGuard.provider(<DataModelEditorPane dataModelId={openDataModelId} />)
          ) : (
            <DataModelListPanel onOpen={setOpenDataModelId} />
          )}
        </AiWorkSlotContext.Provider>
      </div>
      {leaveGuard.dialog}
    </div>
  );
}
