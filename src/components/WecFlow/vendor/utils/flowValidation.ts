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

  for (const page of flow.pages) {
    const layerIds = new Set((page.layers ?? []).map((layer) => layer.id));
    for (const node of page.nodes) {
      if (node.layerId !== undefined && layerIds.size > 0 && !layerIds.has(node.layerId)) {
        errors.push({
          code: "NODE_LAYER_NOT_FOUND",
          message: `Node "${node.id}" references a layer "${node.layerId}" that does not exist.`,
          nodeId: node.id,
        });
      }
    }
    for (const edge of page.edges) {
      if (edge.layerId !== undefined && layerIds.size > 0 && !layerIds.has(edge.layerId)) {
        errors.push({
          code: "EDGE_LAYER_NOT_FOUND",
          message: `Edge "${edge.id}" references a layer "${edge.layerId}" that does not exist.`,
          edgeId: edge.id,
        });
      }
    }

    const seenNodeIds = new Set<string>();
    for (const node of page.nodes) {
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
    for (const edge of page.edges) {
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

    const nodeIds = new Set(page.nodes.map((node) => node.id));

    for (const edge of page.edges) {
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

    const targetedNodeIds = new Set(page.edges.map((edge) => edge.target));
    const sourcedNodeIds = new Set(page.edges.map((edge) => edge.source));

    for (const node of page.nodes) {
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
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
