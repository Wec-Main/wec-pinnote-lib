import { useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon } from "../primitives";

interface FlowPinPickerProps {
  x: number;
  y: number;
}

export function FlowPinPicker({ x, y }: FlowPinPickerProps) {
  const { flowPinDraft, submitFlowPinDraft, cancelFlowPinDraft } = useAnnotationContext();
  const [name, setName] = useState(flowPinDraft?.label ?? "");

  const create = () => {
    if (!name.trim()) {
      return;
    }
    submitFlowPinDraft(name);
  };

  return (
    <div
      className="wpn-flow-pin-picker"
      style={{ left: x, top: y }}
      role="dialog"
      aria-label="Name this flow"
    >
      <div className="wpn-flow-pin-picker__header">
        <span className="wpn-flow-pin-picker__title">New flow</span>
        <button type="button" className="wpn-icon-btn" aria-label="Cancel" onClick={cancelFlowPinDraft}>
          <Icon name="close" />
        </button>
      </div>

      <input
        type="text"
        className="wpn-flow-pin-picker__input"
        value={name}
        placeholder="Flow name"
        aria-label="Flow name"
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            create();
          }
          if (event.key === "Escape") {
            cancelFlowPinDraft();
          }
        }}
      />

      <div className="wpn-flow-pin-picker__footer">
        <button type="button" className="wpn-btn wpn-btn--ghost" onClick={cancelFlowPinDraft}>
          Cancel
        </button>
        <button type="button" className="wpn-btn wpn-btn--primary" disabled={!name.trim()} onClick={create}>
          Create
        </button>
      </div>
    </div>
  );
}
