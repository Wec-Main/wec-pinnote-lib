export const NODE_DRAG_MIME = "application/x-flow-node-type";

export const FIT_VIEW_TOP_OFFSET = 32;

/**
 * Generous upper bound (flow-space units) on how far a handle position, a
 * bent edge midpoint, or a node's own body can extend beyond its stored
 * `position`. Default node sizes top out around 220x120 (see
 * nodeTypes.ts), so this leaves ample headroom for that plus any explicit
 * resize not accounted for separately. Used as a spatial prefilter margin to
 * cheaply skip far-away nodes/edges before doing per-candidate geometry
 * work (registry lookups, rect/handle computation) during drags.
 */
export const NODE_SPATIAL_PREFILTER_MARGIN = 600;

/**
 * Only cull off-screen nodes/edges once a document has more than this many
 * nodes. Below the threshold, everything renders exactly as before (zero
 * behavior change) — this keeps typical, small diagrams unaffected and
 * limits the viewport-culling behavior to documents large enough that it
 * actually matters.
 */
export const VIEWPORT_CULL_NODE_THRESHOLD = 150;

/** Screen-pixel margin added around the visible viewport before culling. */
export const VIEWPORT_CULL_MARGIN_PX = 300;
