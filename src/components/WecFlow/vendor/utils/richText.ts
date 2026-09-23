import type { RichText, RichTextAlign, RichTextRun, RichTextTransform } from "../types/richText.types";

export type RichTextRunToggle = "bold" | "italic" | "underline" | "strike";

export const RICH_TEXT_FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Comic Sans MS",
] as const;

export function plainTextToRichText(text: string): RichText {
  return { runs: [{ text }] };
}

export function richTextToPlainText(rt: RichText): string {
  return rt.runs.map((run) => run.text).join("");
}

function isRichTextRun(value: unknown): value is RichTextRun {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string") return false;
  if (record.bold !== undefined && typeof record.bold !== "boolean") return false;
  if (record.italic !== undefined && typeof record.italic !== "boolean") return false;
  if (record.underline !== undefined && typeof record.underline !== "boolean") return false;
  if (record.strike !== undefined && typeof record.strike !== "boolean") return false;
  if (record.color !== undefined && typeof record.color !== "string") return false;
  if (record.fontFamily !== undefined && typeof record.fontFamily !== "string") return false;
  if (record.fontSize !== undefined && typeof record.fontSize !== "number") return false;
  return true;
}

export function isRichText(value: unknown): value is RichText {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.runs) || !record.runs.every(isRichTextRun)) return false;
  if (
    record.align !== undefined &&
    record.align !== "left" &&
    record.align !== "center" &&
    record.align !== "right"
  ) {
    return false;
  }
  if (record.lineHeight !== undefined && typeof record.lineHeight !== "number") return false;
  if (record.letterSpacing !== undefined && typeof record.letterSpacing !== "number") return false;
  if (
    record.transform !== undefined &&
    record.transform !== "none" &&
    record.transform !== "uppercase" &&
    record.transform !== "lowercase" &&
    record.transform !== "capitalize"
  ) {
    return false;
  }
  if (record.spacing !== undefined && typeof record.spacing !== "number") return false;
  return true;
}

interface TextRange {
  start: number;
  end: number;
}

function splitRunsAtRange(rt: RichText, range: TextRange): RichTextRun[] {
  const result: RichTextRun[] = [];
  let cursor = 0;
  for (const run of rt.runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    const overlapStart = Math.max(runStart, range.start);
    const overlapEnd = Math.min(runEnd, range.end);

    if (overlapStart >= overlapEnd) {
      result.push(run);
      continue;
    }

    if (runStart < overlapStart) {
      result.push({ ...run, text: run.text.slice(0, overlapStart - runStart) });
    }
    result.push({ ...run, text: run.text.slice(overlapStart - runStart, overlapEnd - runStart) });
    if (overlapEnd < runEnd) {
      result.push({ ...run, text: run.text.slice(overlapEnd - runStart) });
    }
  }
  return result.filter((run) => run.text.length > 0);
}

function mergeAdjacentRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && sameFormatting(previous, run)) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function sameFormatting(a: RichTextRun, b: RichTextRun): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike &&
    a.color === b.color &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize
  );
}

function mapRunsInRange(
  rt: RichText,
  range: TextRange,
  transform: (run: RichTextRun) => RichTextRun,
): RichText {
  const split = splitRunsAtRange(rt, range);
  let cursor = 0;
  const mapped = split.map((run) => {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;
    const inRange = runStart >= range.start && runEnd <= range.end;
    return inRange ? transform(run) : run;
  });
  return { ...rt, runs: mergeAdjacentRuns(mapped) };
}

export function toggleRunProperty(
  rt: RichText,
  range: TextRange,
  property: RichTextRunToggle,
): RichText {
  const plain = richTextToPlainText(rt);
  const start = Math.max(0, Math.min(range.start, plain.length));
  const end = Math.max(start, Math.min(range.end, plain.length));
  if (start === end) return rt;

  const targetRuns = splitRunsAtRange(rt, { start, end });
  let cursor = 0;
  const nextValue = !targetRuns.some((run) => {
    const runStart = cursor;
    cursor += run.text.length;
    const inRange = runStart >= start && cursor <= end;
    return inRange && run[property];
  });

  return mapRunsInRange(rt, { start, end }, (run) => ({ ...run, [property]: nextValue }));
}

export function setRunColor(rt: RichText, range: TextRange, color: string | undefined): RichText {
  return mapRunsInRange(rt, range, (run) => ({ ...run, color }));
}

export function setRunFontFamily(
  rt: RichText,
  range: TextRange,
  fontFamily: string | undefined,
): RichText {
  return mapRunsInRange(rt, range, (run) => ({ ...run, fontFamily }));
}

export function setRunFontSize(
  rt: RichText,
  range: TextRange,
  fontSize: number | undefined,
): RichText {
  return mapRunsInRange(rt, range, (run) => ({ ...run, fontSize }));
}

export function setRichTextAlign(rt: RichText, align: RichTextAlign | undefined): RichText {
  return { ...rt, align };
}

export function setRichTextLineHeight(rt: RichText, lineHeight: number | undefined): RichText {
  return { ...rt, lineHeight };
}

export function setRichTextLetterSpacing(
  rt: RichText,
  letterSpacing: number | undefined,
): RichText {
  return { ...rt, letterSpacing };
}

export function setRichTextTransform(
  rt: RichText,
  transform: RichTextTransform | undefined,
): RichText {
  return { ...rt, transform };
}

export function setRichTextSpacing(rt: RichText, spacing: number | undefined): RichText {
  return { ...rt, spacing };
}

export function fullRange(rt: RichText): TextRange {
  return { start: 0, end: richTextToPlainText(rt).length };
}
