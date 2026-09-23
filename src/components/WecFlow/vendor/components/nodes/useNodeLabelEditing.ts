import { useFlowLabelEditing } from "../../hooks/useFlowLabelEditing";
import type { RichText } from "../../types/flow.types";

export interface NodeLabelEditing {
  editing: boolean;
  onStartEdit: () => void;
  onCommitEdit: (label: RichText) => void;
  readonly: boolean;
  onResizeEnd: (width: number, height: number) => void;
  onRotate: (degrees: number) => void;
}

export function useNodeLabelEditing(nodeId: string): NodeLabelEditing {
  const { editingTarget, startEdit, commitEdit, readonly, resizeNode, rotateNode } =
    useFlowLabelEditing();
  const editing = editingTarget?.kind === "node" && editingTarget.id === nodeId;

  return {
    editing,
    onStartEdit: () => startEdit({ kind: "node", id: nodeId }),
    onCommitEdit: (label) => commitEdit(label),
    readonly,
    onResizeEnd: (width, height) => resizeNode(nodeId, width, height),
    onRotate: (degrees) => rotateNode(nodeId, degrees),
  };
}
