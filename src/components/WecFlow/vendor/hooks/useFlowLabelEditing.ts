import { createContext, useContext } from "react";
import type { RichText } from "../types/flow.types";

export type FlowLabelEditTarget = { kind: "node"; id: string } | { kind: "edge"; id: string };

export interface FlowLabelEditingContextValue {
  editingTarget: FlowLabelEditTarget | null;
  startEdit: (target: FlowLabelEditTarget) => void;
  commitEdit: (label: RichText) => void;
  readonly: boolean;
  resizeNode: (nodeId: string, width: number, height: number) => void;
  rotateNode: (nodeId: string, degrees: number) => void;
}

export const FlowLabelEditingContext = createContext<FlowLabelEditingContextValue>({
  editingTarget: null,
  startEdit: () => {},
  commitEdit: () => {},
  readonly: false,
  resizeNode: () => {},
  rotateNode: () => {},
});

export function useFlowLabelEditing(): FlowLabelEditingContextValue {
  return useContext(FlowLabelEditingContext);
}
