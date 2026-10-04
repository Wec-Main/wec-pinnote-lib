import { Fragment, memo, useMemo, useRef, type ReactNode } from "react";
import { Icon } from "../../../components/primitives/Icon";
import { useCopy } from "./useAiPreferences";

export type TableAlign = "left" | "center" | "right" | null;

export interface ListItem {
  text: string;
  children: Block[];
}

export type Block =
  | { kind: "code"; lang: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start?: number; items: ListItem[] }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "hr" }
  | { kind: "table"; align: TableAlign[]; header: string[]; rows: string[][] }
  | { kind: "paragraph"; text: string };

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (line: string) => line.replace(/\t/g, "    ").search(/\S/);

export function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  for (let index = 0; index < row.length; index++) {
    const char = row[index] as string;
    if (char === "\\" && row[index + 1] === "|") {
      cell += "|";
      index++;
    } else if (char === "`") {
      inCode = !inCode;
      cell += char;
    } else if (char === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function tableAlign(cell: string): TableAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function isTableStart(lines: string[], index: number): boolean {
  const head = lines[index] ?? "";
  const delimiter = lines[index + 1] ?? "";
  return (
    head.includes("|") &&
    delimiter.includes("-") &&
    TABLE_DELIMITER.test(delimiter) &&
    (delimiter.includes("|") || head.trim().startsWith("|"))
  );
}

interface ListEntry {
  indent: number;
  ordered: boolean;
  start: number;
  text: string;
}

function buildLists(entries: ListEntry[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < entries.length) {
    const first = entries[index] as ListEntry;
    const base = first.indent;
    const list: Extract<Block, { kind: "list" }> = {
      kind: "list",
      ordered: first.ordered,
      items: [],
    };
    if (first.ordered && first.start !== 1) list.start = first.start;
    while (index < entries.length) {
      const entry = entries[index] as ListEntry;
      if (entry.indent < base) break;
      if (entry.indent === base || list.items.length === 0) {
        if (entry.ordered !== list.ordered) break;
        list.items.push({ text: entry.text, children: [] });
        index++;
        continue;
      }
      const children: ListEntry[] = [];
      while (index < entries.length && (entries[index] as ListEntry).indent > base) {
        children.push(entries[index] as ListEntry);
        index++;
      }
      const parent = list.items[list.items.length - 1] as ListItem;
      parent.children.push(...buildLists(children));
    }
    blocks.push(list);
  }
  return blocks;
}

export function parseMarkdownBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listEntries: ListEntry[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (listEntries.length) blocks.push(...buildLists(listEntries));
    listEntries = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as string;
    const fence = FENCE.exec(line);
    if (fence) {
      flushAll();
      const body: string[] = [];
      index++;
      while (index < lines.length && !FENCE.test(lines[index] as string)) {
        body.push(lines[index] as string);
        index++;
      }
      blocks.push({ kind: "code", lang: fence[1] ?? "", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      if (listEntries.length) {
        const next = lines[index + 1] ?? "";
        if (LIST_ITEM.test(next) || (next.trim() && indentOf(next) >= 2)) continue;
      }
      flushAll();
      continue;
    }
    if (HR.test(line)) {
      flushAll();
      blocks.push({ kind: "hr" });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        kind: "heading",
        level: Math.min(4, (heading[1] ?? "#").length),
        text: heading[2] ?? "",
      });
      continue;
    }
    if (QUOTE.test(line)) {
      flushAll();
      const body: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] as string)) {
        body.push(QUOTE.exec(lines[index] as string)?.[1] ?? "");
        index++;
      }
      index--;
      blocks.push({ kind: "quote", blocks: parseMarkdownBlocks(body.join("\n")) });
      continue;
    }
    if (isTableStart(lines, index)) {
      flushAll();
      const header = splitTableRow(line);
      const align = splitTableRow(lines[index + 1] as string).map(tableAlign);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = lines[index] as string;
        if (!row.trim() || !row.includes("|")) break;
        const cells = splitTableRow(row);
        rows.push(header.map((_, column) => cells[column] ?? ""));
        index++;
      }
      index--;
      blocks.push({
        kind: "table",
        header,
        align: header.map((_, column) => align[column] ?? null),
        rows,
      });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const marker = item[2] ?? "-";
      const ordered = /\d/.test(marker);
      listEntries.push({
        indent: indentOf(line),
        ordered,
        start: ordered ? parseInt(marker, 10) : 1,
        text: (item[3] ?? "").trim(),
      });
      continue;
    }
    if (listEntries.length) {
      const last = listEntries[listEntries.length - 1] as ListEntry;
      last.text = `${last.text} ${line.trim()}`;
      continue;
    }
    paragraph.push(line);
  }
  flushAll();
  return blocks;
}

export interface MarkdownSegment {
  start: number;
  source: string;
  blocks: Block[];
}

const isSegmentStart = (line: string) =>
  line.trim() !== "" && !LIST_ITEM.test(line) && indentOf(line) < 2;

function segmentCuts(source: string, from: number): number[] {
  const cuts: number[] = [];
  let inFence = false;
  let previousBlank = false;
  let start = from;
  let end = source.indexOf("\n", start);
  while (end !== -1) {
    const line = source.slice(start, end);
    if (!inFence && previousBlank && isSegmentStart(line)) cuts.push(start);
    if (FENCE.test(line)) inFence = !inFence;
    previousBlank = !inFence && !line.trim();
    start = end + 1;
    end = source.indexOf("\n", start);
  }
  return cuts;
}

function keepsCut(source: string, offset: number): boolean {
  const end = source.indexOf("\n", offset);
  return end !== -1 && isSegmentStart(source.slice(offset, end));
}

export function parseMarkdownSegments(
  text: string,
  previous: readonly MarkdownSegment[] = [],
): MarkdownSegment[] {
  const source = text.replace(/\r\n?/g, "\n");
  const segments: MarkdownSegment[] = [];
  let offset = 0;
  while (segments.length < previous.length - 1) {
    const segment = previous[segments.length] as MarkdownSegment;
    if (segment.start !== offset || !source.startsWith(segment.source, offset)) break;
    const next = offset + segment.source.length;
    if (!keepsCut(source, next)) break;
    segments.push(segment);
    offset = next;
  }
  let reuse = segments.length;
  const bounds = [offset, ...segmentCuts(source, offset), source.length];
  for (let index = 0; index < bounds.length - 1; index++) {
    const start = bounds[index] as number;
    const slice = source.slice(start, bounds[index + 1]);
    while (reuse < previous.length && (previous[reuse] as MarkdownSegment).start < start) reuse++;
    const candidate = previous[reuse];
    segments.push(
      candidate && candidate.start === start && candidate.source === slice
        ? candidate
        : { start, source: slice, blocks: parseMarkdownBlocks(slice) },
    );
  }
  return segments;
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|<((?:https?:\/\/|mailto:)[^>\s]+)>|\b(https?:\/\/[^\s<>]*[^\s<>.,;:!?'")\]])|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|\*([^*\n]+)\*|\b_([^_\n]+)_\b/g;

function link(key: string, href: string, label: ReactNode): ReactNode {
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));
    const key = `${keyPrefix}-${index++}`;
    const [whole, code, linkText, linkUrl, angle, bare, bold, strike, italic, underscored] = match;
    if (code !== undefined) {
      out.push(
        <code key={key} className="wpn-ai-md__code">
          {code}
        </code>,
      );
    } else if (linkText !== undefined && linkUrl !== undefined) {
      const href = safeHref(linkUrl);
      out.push(href ? link(key, href, linkText) : <Fragment key={key}>{whole}</Fragment>);
    } else if (angle !== undefined || bare !== undefined) {
      const url = (angle ?? bare) as string;
      const href = safeHref(url);
      out.push(href ? link(key, href, url) : <Fragment key={key}>{whole}</Fragment>);
    } else if (bold !== undefined) {
      out.push(<strong key={key}>{renderInline(bold, key)}</strong>);
    } else if (strike !== undefined) {
      out.push(<del key={key}>{renderInline(strike, key)}</del>);
    } else {
      out.push(<em key={key}>{italic ?? underscored}</em>);
    }
    cursor = start + whole.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function withBreaks(text: string, key: string): ReactNode[] {
  return text
    .split("\n")
    .flatMap((line, index) =>
      index === 0
        ? renderInline(line, `${key}-${index}`)
        : [<br key={`${key}-br-${index}`} />, ...renderInline(line, `${key}-${index}`)],
    );
}

const CodeBlock = memo(function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, copy] = useCopy();
  return (
    <div className="wpn-ai-md__codeblock">
      <div className="wpn-ai-md__codebar">
        <span className="wpn-ai-md__lang">{lang || "code"}</span>
        <button
          type="button"
          className="wpn-ai-md__copy"
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={() => copy(text)}
        >
          <Icon name={copied ? "check" : "copy"} />
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="wpn-ai-md__pre" data-lang={lang || undefined}>
        <code>{text}</code>
      </pre>
    </div>
  );
});

const HEADING_TAGS = ["h1", "h2", "h3", "h4"] as const;

function renderBlocks(blocks: Block[], prefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${prefix}${index}`;
    switch (block.kind) {
      case "code":
        return <CodeBlock key={key} lang={block.lang} text={block.text} />;
      case "heading": {
        const Tag = HEADING_TAGS[Math.min(4, Math.max(1, block.level)) - 1] ?? "h4";
        return (
          <Tag key={key} className={`wpn-ai-md__heading wpn-ai-md__heading--${block.level}`}>
            {renderInline(block.text, key)}
          </Tag>
        );
      }
      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            {renderInline(item.text, `${key}-${itemIndex}`)}
            {item.children.length > 0 ? renderBlocks(item.children, `${key}-${itemIndex}-`) : null}
          </li>
        ));
        return block.ordered ? (
          <ol key={key} start={block.start}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        );
      }
      case "quote":
        return (
          <blockquote key={key} className="wpn-ai-md__quote">
            {renderBlocks(block.blocks, `${key}-`)}
          </blockquote>
        );
      case "hr":
        return <hr key={key} className="wpn-ai-md__hr" />;
      case "table":
        return (
          <div key={key} className="wpn-ai-md__table-wrap">
            <table className="wpn-ai-md__table">
              <thead>
                <tr>
                  {block.header.map((cell, column) => (
                    <th
                      key={column}
                      style={
                        block.align[column]
                          ? { textAlign: block.align[column] ?? undefined }
                          : undefined
                      }
                    >
                      {renderInline(cell, `${key}-h${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, column) => (
                      <td
                        key={column}
                        style={
                          block.align[column]
                            ? { textAlign: block.align[column] ?? undefined }
                            : undefined
                        }
                      >
                        {renderInline(cell, `${key}-${rowIndex}-${column}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <p key={key}>{withBreaks(block.text, key)}</p>;
    }
  });
}

const BlockView = memo(function BlockView({ block, id }: { block: Block; id: string }) {
  return <>{renderBlocks([block], `${id}-`)}</>;
});

export const AiMarkdown = memo(function AiMarkdown({
  text,
  className,
  streaming = false,
}: {
  text: string;
  className?: string;
  streaming?: boolean;
}) {
  const segmentsRef = useRef<MarkdownSegment[]>([]);
  const segments = useMemo(() => {
    const next = parseMarkdownSegments(text, segmentsRef.current);
    segmentsRef.current = next;
    return next;
  }, [text]);
  return (
    <div
      className={["wpn-ai-md", streaming ? "wpn-ai-md--streaming" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {segments.flatMap((segment) =>
        segment.blocks.map((block, index) => (
          <BlockView
            key={`${segment.start}-${index}`}
            block={block}
            id={`b${segment.start}-${index}`}
          />
        )),
      )}
    </div>
  );
});
