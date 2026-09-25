const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RangePreset = "7d" | "30d" | "90d";

const PRESET_DAYS: Record<RangePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface DateRange {
  from: string;
  to: string;
}

function toUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function rangeForPreset(preset: RangePreset, now: Date): DateRange {
  const toMs = Date.parse(`${toUtcDay(now.getTime())}T00:00:00Z`);
  const fromMs = toMs - (PRESET_DAYS[preset] - 1) * DAY_MS;
  return { from: toUtcDay(fromMs), to: toUtcDay(toMs) };
}

export function validateCustomRange(from: string, to: string): boolean {
  if (!ISO_DAY_PATTERN.test(from) || !ISO_DAY_PATTERN.test(to)) {
    return false;
  }
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return false;
  }
  if (fromMs > toMs) {
    return false;
  }
  const spanDays = (toMs - fromMs) / DAY_MS + 1;
  return spanDays <= MAX_RANGE_DAYS;
}
