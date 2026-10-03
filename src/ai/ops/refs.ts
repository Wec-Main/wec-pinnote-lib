import type { OpErrorCode } from "./types";

export type RefKind =
  "entity" | "field" | "relationship" | "index" | "enum" | "note" | "node" | "edge";

export interface RefCandidate {
  id: string;
  name: string | undefined;
}

export type RefResult =
  | { ok: true; id: string }
  | { ok: false; code: Extract<OpErrorCode, "not_found" | "ambiguous_ref">; message: string };

interface TempEntry {
  kind: RefKind;
  id: string | null;
  scope: string | null;
  failedAt: number | null;
}

export const normalizeTempId = (tempId: string): string =>
  tempId.trim().startsWith("$") ? tempId.trim() : `$${tempId.trim()}`;

export class TempIds {
  private readonly entries = new Map<string, TempEntry>();

  has(tempId: string): boolean {
    return this.entries.has(normalizeTempId(tempId));
  }

  declare(tempId: string, kind: RefKind, id: string, scope: string | null = null): void {
    this.entries.set(normalizeTempId(tempId), { kind, id, scope, failedAt: null });
  }

  poison(tempId: string, kind: RefKind, opIndex: number): void {
    const key = normalizeTempId(tempId);
    if (!this.entries.has(key)) {
      this.entries.set(key, { kind, id: null, scope: null, failedAt: opIndex });
    }
  }

  get(ref: string): TempEntry | undefined {
    return this.entries.get(ref.trim());
  }

  toIdMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [key, entry] of this.entries) {
      if (entry.id !== null) map[key] = entry.id;
    }
    return map;
  }
}

export function resolveRef(
  ref: string,
  kind: RefKind,
  candidates: readonly RefCandidate[],
  temps: TempIds,
  scope: string | null = null,
): RefResult {
  const wanted = ref.trim();
  const label = `${kind} "${ref}"`;
  if (wanted === "") return { ok: false, code: "not_found", message: `Empty ${kind} reference` };
  const byId = candidates.find((candidate) => candidate.id === ref || candidate.id === wanted);
  if (byId) return { ok: true, id: byId.id };
  if (wanted.startsWith("$")) {
    const temp = temps.get(wanted);
    if (temp) {
      if (temp.failedAt !== null) {
        return {
          ok: false,
          code: "not_found",
          message: `${label} was not created because op #${temp.failedAt} failed`,
        };
      }
      if (temp.kind !== kind) {
        return {
          ok: false,
          code: "not_found",
          message: `${wanted} is a ${temp.kind}, not a ${kind}`,
        };
      }
      if (scope !== null && temp.scope !== scope) {
        return {
          ok: false,
          code: "not_found",
          message: `${wanted} belongs to a different entity`,
        };
      }
      if (candidates.some((candidate) => candidate.id === temp.id)) {
        return { ok: true, id: temp.id as string };
      }
      return { ok: false, code: "not_found", message: `${label} was removed earlier in the batch` };
    }
  }
  const named = candidates.filter((candidate) => candidate.name?.trim() === wanted);
  if (named.length === 1) return { ok: true, id: (named[0] as RefCandidate).id };
  if (named.length > 1) {
    return {
      ok: false,
      code: "ambiguous_ref",
      message: `${label} matches ${named.length} objects (${named.map((c) => c.id).join(", ")}); use an id`,
    };
  }
  return {
    ok: false,
    code: "not_found",
    message: wanted.startsWith("$") ? `Unknown temp id ${wanted}` : `Unknown ${label}`,
  };
}

export class IdFactory {
  private readonly used: Set<string>;

  constructor(
    private readonly create: (prefix: string) => string,
    used: Iterable<string>,
  ) {
    this.used = new Set(used);
  }

  next(prefix: string): string {
    let id = this.create(prefix);
    while (this.used.has(id)) id = this.create(prefix);
    this.used.add(id);
    return id;
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  const left = Object.entries(a as Record<string, unknown>).filter(([, v]) => v !== undefined);
  const right = b as Record<string, unknown>;
  const rightCount = Object.values(right).filter((v) => v !== undefined).length;
  return left.length === rightCount && left.every(([key, value]) => jsonEqual(value, right[key]));
}
