export interface MentionCandidate {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface TextPart {
  text: string;
  highlighted: boolean;
}

export const REFERENCE_KINDS = ["epic", "flow", "dataModel"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = {
  epic: "Epic",
  flow: "Flow",
  dataModel: "Data model",
};

export interface ReferenceCandidate {
  kind: ReferenceKind;
  id: string;
  name: string;
  description?: string;
}

export interface ReferenceTarget {
  kind: ReferenceKind;
  id: string;
}

export type MessageSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; userId: string; name: string }
  | { kind: "reference"; refKind: ReferenceKind; refId: string; name: string };

export type MentionTrigger = "@" | "#";

export interface MentionQuery {
  start: number;
  query: string;
  trigger: MentionTrigger;
}

const MESSAGE_TOKEN =
  /@\[([^\]\n]+)\]\(([^)\s]+)\)|#\[([^\]\n]+)\]\((epic|flow|dataModel):([^)\s]+)\)/g;
const MAX_QUERY_LENGTH = 32;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

export function splitMentions(message: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const match of message.matchAll(MESSAGE_TOKEN)) {
    const [token, mentionName, userId, refName, refKind, refId] = match;
    const index = match.index;
    if (index > cursor) {
      segments.push({ kind: "text", value: message.slice(cursor, index) });
    }
    if (mentionName !== undefined && userId !== undefined) {
      segments.push({ kind: "mention", name: mentionName, userId });
    } else if (refName !== undefined && refId !== undefined) {
      segments.push({
        kind: "reference",
        refKind: refKind as ReferenceKind,
        refId,
        name: refName,
      });
    }
    cursor = index + token.length;
  }
  if (cursor < message.length) {
    segments.push({ kind: "text", value: message.slice(cursor) });
  }
  return segments;
}

export function mentionsToPlainText(message: string): string {
  return message.replace(
    MESSAGE_TOKEN,
    (_token, mentionName: string | undefined, _userId, refName: string | undefined) =>
      mentionName !== undefined ? `@${mentionName}` : `#${refName ?? ""}`,
  );
}

export function referencesInMessage(message: string): ReferenceCandidate[] {
  const seen = new Set<string>();
  return splitMentions(message).flatMap((segment) => {
    if (segment.kind !== "reference") {
      return [];
    }
    const key = `${segment.refKind}:${segment.refId}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ kind: segment.refKind, id: segment.refId, name: segment.name }];
  });
}

interface TypedToken<T> {
  start: number;
  end: number;
  candidate: T;
}

function findTyped<T extends { name: string }>(
  text: string,
  trigger: MentionTrigger,
  candidates: T[],
): TypedToken<T>[] {
  const byLongestName = candidates
    .filter((candidate) => candidate.name.trim() !== "")
    .sort((a, b) => b.name.length - a.name.length);
  const found: TypedToken<T>[] = [];
  let at = text.indexOf(trigger);
  while (at !== -1 && byLongestName.length > 0) {
    const rest = text.slice(at + 1).toLowerCase();
    const candidate = isWordChar(text[at - 1])
      ? undefined
      : byLongestName.find(
          (option) =>
            rest.startsWith(option.name.toLowerCase()) && !isWordChar(rest[option.name.length]),
        );
    const end = candidate ? at + 1 + candidate.name.length : at + 1;
    if (candidate) {
      found.push({ start: at, end, candidate });
    }
    at = text.indexOf(trigger, end);
  }
  return found;
}

function findTypedTokens(
  text: string,
  candidates: MentionCandidate[],
  references: ReferenceCandidate[],
): TypedToken<string>[] {
  const spans = [
    ...findTyped(text, "@", candidates).map(({ start, end, candidate }) => ({
      start,
      end,
      candidate: `@[${candidate.name}](${candidate.id})`,
    })),
    ...findTyped(text, "#", references).map(({ start, end, candidate }) => ({
      start,
      end,
      candidate: `#[${candidate.name}](${candidate.kind}:${candidate.id})`,
    })),
  ].sort((a, b) => a.start - b.start);
  const kept: TypedToken<string>[] = [];
  for (const span of spans) {
    const previous = kept[kept.length - 1];
    if (!previous || span.start >= previous.end) {
      kept.push(span);
    }
  }
  return kept;
}

export function encodeMentions(
  text: string,
  candidates: MentionCandidate[],
  references: ReferenceCandidate[] = [],
): string {
  let result = "";
  let cursor = 0;
  for (const { start, end, candidate } of findTypedTokens(text, candidates, references)) {
    result += text.slice(cursor, start) + candidate;
    cursor = end;
  }
  return result + text.slice(cursor);
}

export function highlightTypedMentions(text: string, candidates: MentionCandidate[]): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const { start, end } of findTyped(text, "@", candidates)) {
    parts.push({ text: text.slice(cursor, start), highlighted: false });
    parts.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  parts.push({ text: text.slice(cursor), highlighted: false });
  return parts.filter((part) => part.text !== "");
}

export function highlightQuery(name: string, query: string): TextPart[] {
  const index = query ? name.toLowerCase().indexOf(query.trim().toLowerCase()) : -1;
  if (index === -1) {
    return [{ text: name, highlighted: false }];
  }
  const end = index + query.trim().length;
  return [
    { text: name.slice(0, index), highlighted: false },
    { text: name.slice(index, end), highlighted: true },
    { text: name.slice(end), highlighted: false },
  ].filter((part) => part.text !== "");
}

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const at = Math.max(before.lastIndexOf("@"), before.lastIndexOf("#"));
  if (at === -1 || isWordChar(before[at - 1])) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY_LENGTH || query.includes("\n") || query.startsWith(" ")) {
    return null;
  }
  return { start: at, query, trigger: before[at] as MentionTrigger };
}

export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return candidates;
  }
  const words = (name: string) => name.toLowerCase().split(/\s+/);
  return candidates
    .filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(normalized) ||
        Boolean(candidate.email?.toLowerCase().startsWith(normalized)),
    )
    .sort((a, b) => {
      const aPrefix = words(a.name).some((word) => word.startsWith(normalized)) ? 0 : 1;
      const bPrefix = words(b.name).some((word) => word.startsWith(normalized)) ? 0 : 1;
      return aPrefix - bPrefix || a.name.localeCompare(b.name);
    });
}

const REFERENCES_PER_KIND = 4;

export function filterReferenceCandidates(
  references: ReferenceCandidate[],
  query: string,
): ReferenceCandidate[] {
  const normalized = query.trim().toLowerCase();
  const rank = (name: string) =>
    name
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(normalized))
      ? 0
      : 1;
  const matching = references.filter((reference) =>
    reference.name.toLowerCase().includes(normalized),
  );
  return REFERENCE_KINDS.flatMap((kind) =>
    matching
      .filter((reference) => reference.kind === kind)
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
      .slice(0, REFERENCES_PER_KIND),
  );
}
