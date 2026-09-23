import type { NodeTypes } from "@xyflow/react";
import type { FlowNodeType } from "../../types/flow.types";

// Single side-effect import for all node styling.
import "../../styles/nodes.css";

import { StartNode } from "./StartNode";
import { EndNode } from "./EndNode";
import { ProcessNode } from "./ProcessNode";
import { DecisionNode } from "./DecisionNode";
import { InputNode } from "./InputNode";
import { OutputNode } from "./OutputNode";
import { createBasicShapeNode } from "./BasicShapeNode";

export { StartNode } from "./StartNode";
export { EndNode } from "./EndNode";
export { ProcessNode } from "./ProcessNode";
export { DecisionNode } from "./DecisionNode";
export { InputNode } from "./InputNode";
export { OutputNode } from "./OutputNode";
export { createBasicShapeNode } from "./BasicShapeNode";
export type { BasicShapeVariant } from "./BasicShapeNode";

/**
 * Map of FlowNodeType -> component, keyed and checked against the shared
 * FlowNodeType union so a missing/renamed node type fails to compile.
 */
const typedNodeTypes: Record<FlowNodeType, NodeTypes[string]> = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  input: InputNode,
  output: OutputNode,
  rectangle: createBasicShapeNode("rectangle"),
  roundedRectangle: createBasicShapeNode("roundedRectangle"),
  ellipse: createBasicShapeNode("ellipse"),
  diamond: createBasicShapeNode("diamond"),
  parallelogram: createBasicShapeNode("parallelogram"),
  triangle: createBasicShapeNode("triangle"),
  hexagon: createBasicShapeNode("hexagon"),
  cylinder: createBasicShapeNode("cylinder"),
  cloud: createBasicShapeNode("cloud"),
  document: createBasicShapeNode("document"),
  text: createBasicShapeNode("text"),
  container: createBasicShapeNode("container"),
  actor: createBasicShapeNode("actor"),
  package: createBasicShapeNode("package"),
  note: createBasicShapeNode("note"),
};

export const nodeTypes: NodeTypes = typedNodeTypes;
