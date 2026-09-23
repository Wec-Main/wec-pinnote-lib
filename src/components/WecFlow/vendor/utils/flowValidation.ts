import type {
  FlowDefinition,
  FlowValidationError,
  FlowValidationResult,
} from "../types/flow.types";

/**
 * Validates a {@link FlowDefinition}, collecting every violation found
 * rather than stopping at the first one.
 *
 * This function is pure and never throws for a structurally-valid
 * `FlowDefinition` (including edge cases like zero nodes/edges, multiple
 * start/end nodes, or disconnected nodes). Per product spec, validation
 * only reports problems — it never blocks editing of an incomplete flow.
 */
export function validateFlow(flow: FlowDefinition): FlowValidationResult {
  const errors: FlowValidationError[] = [];

  const seenNodeIds = new Set<string>();
  for (const node of flow.nodes) {
    if (seenNodeIds.has(node.id)) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node id: "${node.id}".`,
        nodeId: node.id,
      });
    } else {
      seenNodeIds.add(node.id);
    }
  }

  const seenEdgeIds = new Set<string>();
  for (const edge of flow.edges) {
    if (seenEdgeIds.has(edge.id)) {
      errors.push({
        code: "DUPLICATE_EDGE_ID",
        message: `Duplicate edge id: "${edge.id}".`,
        edgeId: edge.id,
      });
    } else {
      seenEdgeIds.add(edge.id);
    }
  }

  const nodeIds = new Set(flow.nodes.map((node) => node.id));

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: "EDGE_SOURCE_NOT_FOUND",
        message: `Edge "${edge.id}" references a source node "${edge.source}" that does not exist.`,
        edgeId: edge.id,
      });
    }

    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: "EDGE_TARGET_NOT_FOUND",
        message: `Edge "${edge.id}" references a target node "${edge.target}" that does not exist.`,
        edgeId: edge.id,
      });
    }
  }

  const targetedNodeIds = new Set(flow.edges.map((edge) => edge.target));
  const sourcedNodeIds = new Set(flow.edges.map((edge) => edge.source));

  for (const node of flow.nodes) {
    if (node.type === "start" && targetedNodeIds.has(node.id)) {
      errors.push({
        code: "START_HAS_INCOMING",
        message: `Start node "${node.id}" should not have incoming connections.`,
        nodeId: node.id,
      });
    }

    if (node.type === "end" && sourcedNodeIds.has(node.id)) {
      errors.push({
        code: "END_HAS_OUTGOING",
        message: `End node "${node.id}" should not have outgoing connections.`,
        nodeId: node.id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
