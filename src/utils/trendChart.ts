export interface TrendChartDimensions {
  width: number;
  height: number;
  padding: number;
}

export interface TrendChartXLabel {
  index: number;
  x: number;
  label: string;
}

export interface TrendChartGeometry {
  yTicks: number[];
  yMax: number;
  xLabels: TrendChartXLabel[];
  series: Record<string, { points: string; coordinates: { x: number; y: number }[] }>;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
}

const MAX_X_LABELS = 8;
const NICE_STEP_FACTORS: readonly [1, 2, 5] = [1, 2, 5];
const FALLBACK_STEP_FACTOR = 10;

export function niceTopTick(maxValue: number): number {
  const safeMax = Math.max(0, maxValue);
  if (safeMax === 0) {
    return 1;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(safeMax)));
  for (const factor of NICE_STEP_FACTORS) {
    const step = factor * magnitude;
    const candidate = Math.ceil(safeMax / step) * step;
    if (candidate >= safeMax) {
      return roundToStepPrecision(candidate);
    }
  }

  const step = FALLBACK_STEP_FACTOR * magnitude;
  return roundToStepPrecision(Math.ceil(safeMax / step) * step);
}

function roundToStepPrecision(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function yAxisTicks(maxValue: number, tickCount = 5): number[] {
  const top = niceTopTick(maxValue);
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i += 1) {
    ticks.push(roundToStepPrecision((top * i) / (tickCount - 1)));
  }
  return ticks;
}

export function thinXLabels<T>(labels: T[], maxLabels = MAX_X_LABELS): number[] {
  const total = labels.length;
  if (total <= maxLabels) {
    return labels.map((_, index) => index);
  }

  const lastIndex = total - 1;
  const step = lastIndex / (maxLabels - 1);
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i += 1) {
    indices.add(Math.round(step * i));
  }
  indices.add(lastIndex);
  return Array.from(indices).sort((a, b) => a - b);
}

export function trendChartGeometry<T extends { date: string }>(
  days: T[],
  seriesKeys: (keyof T)[],
  { width, height, padding }: TrendChartDimensions,
): TrendChartGeometry {
  const plotLeft = padding;
  const plotRight = width - padding;
  const plotTop = padding;
  const plotBottom = height - padding;

  const values = days.flatMap((day) =>
    seriesKeys.map((key) => {
      const value = day[key];
      return typeof value === "number" ? value : 0;
    }),
  );
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const yMax = niceTopTick(maxValue);
  const yTicks = yAxisTicks(maxValue);

  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const stepX = days.length > 1 ? plotWidth / (days.length - 1) : 0;

  const xForIndex = (index: number): number =>
    days.length > 1 ? plotLeft + stepX * index : plotLeft + plotWidth / 2;

  const yForValue = (value: number): number =>
    yMax > 0 ? plotBottom - (value / yMax) * plotHeight : plotBottom;

  const labelIndices = thinXLabels(days);
  const xLabels: TrendChartXLabel[] = [];
  for (const index of labelIndices) {
    const day = days[index];
    if (day) {
      xLabels.push({ index, x: xForIndex(index), label: day.date });
    }
  }

  const series: TrendChartGeometry["series"] = {};
  for (const key of seriesKeys) {
    const coordinates = days.map((day, index) => {
      const rawValue = day[key];
      const value = typeof rawValue === "number" ? rawValue : 0;
      return { x: xForIndex(index), y: yForValue(value) };
    });
    series[String(key)] = {
      coordinates,
      points: coordinates.map((point) => `${point.x},${point.y}`).join(" "),
    };
  }

  return { yTicks, yMax, xLabels, series, plotLeft, plotRight, plotTop, plotBottom };
}
