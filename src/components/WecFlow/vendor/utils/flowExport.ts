import type { FlowDefinition } from "../types/flow.types";

/**
 * Serializes a {@link FlowDefinition} into a formatted JSON string.
 *
 * This is intentionally a thin wrapper around `JSON.stringify` today, but
 * having a dedicated function gives us a stable public API and a single
 * place to extend later (for example, stripping internal-only fields
 * before export) without changing call sites.
 */
export function exportFlow(flow: FlowDefinition): string {
  return JSON.stringify(flow, null, 2);
}
