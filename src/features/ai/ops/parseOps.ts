import { checkShape, type ShapeIssue } from "./shape";
import type { OpSpec } from "./schemas";
import type { OpError, ParseOpsResult } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseOps<O>(
  raw: unknown,
  specs: Readonly<Record<string, OpSpec>>,
  maxOps: number,
): ParseOpsResult<O> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ index: -1, op: "", code: "invalid_shape", message: "ops must be an array" }],
    };
  }
  const errors: OpError[] = [];
  if (raw.length > maxOps) {
    errors.push({
      index: -1,
      op: "",
      code: "limit_exceeded",
      message: `A batch may contain at most ${maxOps} ops (got ${raw.length})`,
    });
  }
  const ops: O[] = [];
  raw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push({
        index,
        op: "",
        code: "invalid_shape",
        message: `ops[${index}] must be an object`,
      });
      return;
    }
    const opName = entry.op;
    if (typeof opName !== "string") {
      errors.push({
        index,
        op: "",
        code: "invalid_shape",
        message: `ops[${index}].op must be a string`,
      });
      return;
    }
    const spec = Object.prototype.hasOwnProperty.call(specs, opName) ? specs[opName] : undefined;
    if (!spec) {
      errors.push({
        index,
        op: opName,
        code: "unknown_op",
        message: `Unknown op "${opName}". Valid ops: ${Object.keys(specs).join(", ")}`,
      });
      return;
    }
    const { op: _op, ...payload } = entry;
    const issues: ShapeIssue[] = [];
    const cleaned = checkShape(
      payload,
      { type: "object", properties: spec.properties, required: spec.required },
      `ops[${index}]`,
      issues,
    );
    for (const issue of issues) {
      errors.push({ index, op: opName, code: issue.code, message: issue.message });
    }
    if (issues.length === 0) ops.push({ op: opName, ...(cleaned as object) } as O);
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, ops };
}
