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

export type MessageSegment =
  { kind: "text"; value: string } | { kind: "mention"; userId: string; name: string };

export interface MentionQuery {
  start: number;
  query: string;
}

const MENTION_TOKEN = /@\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const MAX_QUERY_LENGTH = 32;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

export function splitMentions(message: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;
  for (const [token, name = "", userId = ""] of message.matchAll(MENTION_TOKEN)) {
    const index = message.indexOf(token, cursor);
    if (index > cursor) {
      segments.push({ kind: "text", value: message.slice(cursor, index) });
    }
    segments.push({ kind: "mention", name, userId });
    cursor = index + token.length;
  }
  if (cursor < message.length) {
    segments.push({ kind: "text", value: message.slice(cursor) });
  }
  return segments;
}

export function mentionsToPlainText(message: string): string {
  return message.replace(MENTION_TOKEN, (_token, name: string) => `@${name}`);
}

interface TypedMention {
  start: number;
  end: number;
  candidate: MentionCandidate;
}

function findTypedMentions(text: string, candidates: MentionCandidate[]): TypedMention[] {
  const byLongestName = candidates
    .filter((candidate) => candidate.name.trim() !== "")
    .sort((a, b) => b.name.length - a.name.length);
  const found: TypedMention[] = [];
  let at = text.indexOf("@");
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
    at = text.indexOf("@", end);
  }
  return found;
}

export function encodeMentions(text: string, candidates: MentionCandidate[]): string {
  let result = "";
  let cursor = 0;
  for (const { start, end, candidate } of findTypedMentions(text, candidates)) {
    result += `${text.slice(cursor, start)}@[${candidate.name}](${candidate.id})`;
    cursor = end;
  }
  return result + text.slice(cursor);
}

export function highlightTypedMentions(text: string, candidates: MentionCandidate[]): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const { start, end } of findTypedMentions(text, candidates)) {
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
  const at = before.lastIndexOf("@");
  if (at === -1 || isWordChar(before[at - 1])) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY_LENGTH || query.includes("\n") || query.startsWith(" ")) {
    return null;
  }
  return { start: at, query };
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
