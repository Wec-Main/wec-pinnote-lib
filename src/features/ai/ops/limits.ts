export const AI_ERD_LIMITS = {
  maxOpsPerBatch: 200,
  maxEntities: 500,
  maxFieldsPerEntity: 200,
  maxRelationships: 2000,
  maxCompositeKeyFields: 8,
} as const;

export const AI_FLOW_LIMITS = {
  maxOpsPerBatch: 300,
  maxNodes: 2000,
  maxEdges: 4000,
} as const;

export const FLOW_NODE_GAP = 80;
