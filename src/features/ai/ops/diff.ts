import type { ErdDocumentJSON, ErdEntity } from "../../../types/dataModel.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import { jsonEqual } from "./refs";
import type { DocDiff } from "./types";

export const DOC_DIFF_DOCUMENT_ID = "document";

export const fieldDiffId = (entityId: string, fieldId: string): string => `${entityId}.${fieldId}`;

function diffById<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
  diff: DocDiff,
  equal: (a: T, b: T) => boolean = jsonEqual,
): void {
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Set(after.map((item) => item.id));
  for (const item of after) {
    const old = previous.get(item.id);
    if (!old) diff.added.push(item.id);
    else if (old !== item && !equal(old, item)) diff.changed.push(item.id);
  }
  for (const item of before) {
    if (!next.has(item.id)) diff.removed.push(item.id);
  }
}

const entityShell = ({ fields: _fields, ...rest }: ErdEntity) => rest;

export function diffErd(before: ErdDocumentJSON, after: ErdDocumentJSON): DocDiff {
  const diff: DocDiff = { added: [], changed: [], removed: [] };
  diffById(before.entities, after.entities, diff, (a, b) =>
    jsonEqual(entityShell(a), entityShell(b)),
  );
  const previous = new Map(before.entities.map((entity) => [entity.id, entity]));
  for (const entity of after.entities) {
    const old = previous.get(entity.id);
    if (!old || old === entity) continue;
    const fields: DocDiff = { added: [], changed: [], removed: [] };
    diffById(old.fields, entity.fields, fields);
    diff.added.push(...fields.added.map((id) => fieldDiffId(entity.id, id)));
    diff.changed.push(...fields.changed.map((id) => fieldDiffId(entity.id, id)));
    diff.removed.push(...fields.removed.map((id) => fieldDiffId(entity.id, id)));
    const reordered =
      fields.added.length === 0 &&
      fields.removed.length === 0 &&
      old.fields.some((field, i) => entity.fields[i]?.id !== field.id);
    if (reordered && !diff.changed.includes(entity.id)) diff.changed.push(entity.id);
  }
  diffById(before.relationships, after.relationships, diff);
  diffById(before.enums, after.enums, diff);
  diffById(before.notes, after.notes, diff);
  if (before.engine !== after.engine || before.meta.name !== after.meta.name) {
    diff.changed.push(DOC_DIFF_DOCUMENT_ID);
  }
  return diff;
}

export function diffFlow(before: FlowJSON, after: FlowJSON): DocDiff {
  const diff: DocDiff = { added: [], changed: [], removed: [] };
  diffById(before.nodes, after.nodes, diff);
  diffById(before.edges, after.edges, diff);
  if (
    before.meta?.name !== after.meta?.name ||
    (before.meta?.notes ?? "") !== (after.meta?.notes ?? "")
  ) {
    diff.changed.push(DOC_DIFF_DOCUMENT_ID);
  }
  return diff;
}

export function isEmptyDiff(diff: DocDiff): boolean {
  return diff.added.length + diff.changed.length + diff.removed.length === 0;
}
