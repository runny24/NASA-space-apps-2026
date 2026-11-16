// The maths behind LineChart, kept apart from React so it can be unit-tested.
// x is real time (dates are placed by their day number, so uneven gaps look uneven) and a null
// value breaks the line: a missing value is drawn as a gap, never joined across or set to 0.

import type { ClippedSide } from '../contract/encoding';
import { dayNumber } from '../state/timeline';

export interface ChartPoint {
  date: string;
  value: number | null;
  /** The value is a bound: the true value is this or less ('below') or this or more ('above'). */
  clipped?: ClippedSide;
}

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartGeometry {
  /** One SVG path per unbroken run of values. */
  paths: string[];
  dots: { x: number; y: number; date: string; value: number; clipped?: ClippedSide }[];
  xTicks: { x: number; label: string }[];
  yTicks: { y: number; value: number }[];
  hasData: boolean;
}

/** About `count` round tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export function chartGeometry(points: ChartPoint[], box: ChartBox): ChartGeometry {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const empty: ChartGeometry = { paths: [], dots: [], xTicks: [], yTicks: [], hasData: false };
  if (points.length === 0 || values.length === 0) return empty;

  const days = points.map((p) => dayNumber(p.date));
  const d0 = Math.min(...days);
  const d1 = Math.max(...days);
  let v0 = Math.min(...values);
  let v1 = Math.max(...values);
  if (v0 === v1) {
    v0 -= 1;
    v1 += 1;
  }
  const yTicksRaw = niceTicks(v0, v1);
  // Stretch the axis to the outer ticks so every tick label sits inside the plot.
  v0 = Math.min(v0, yTicksRaw[0] ?? v0);
  v1 = Math.max(v1, yTicksRaw[yTicksRaw.length - 1] ?? v1);

  const plotW = box.width - box.left - box.right;
  const plotH = box.height - box.top - box.bottom;
  const x = (day: number) => box.left + (d1 === d0 ? plotW / 2 : ((day - d0) / (d1 - d0)) * plotW);
  const y = (v: number) => box.top + (1 - (v - v0) / (v1 - v0)) * plotH;

  const paths: string[] = [];
  let run: string[] = [];
  const dots: ChartGeometry['dots'] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length > 1) paths.push(run.join(' '));
      run = [];
      return;
    }
    const px = x(days[i] ?? d0);
    const py = y(p.value);
    run.push(`${run.length === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
    dots.push(p.clipped ? { x: px, y: py, date: p.date, value: p.value, clipped: p.clipped } : { x: px, y: py, date: p.date, value: p.value });
  });
  if (run.length > 1) paths.push(run.join(' '));

  // Label the first and last date, plus the middle one when there is room.
  const labelled = new Set([0, points.length - 1]);
  if (points.length > 4) labelled.add(Math.floor((points.length - 1) / 2));
  const xTicks = [...labelled].sort((a, b) => a - b).map((i) => ({ x: x(days[i] ?? d0), label: points[i]?.date ?? '' }));
  const yTicks = yTicksRaw.map((v) => ({ y: y(v), value: v }));
  return { paths, dots, xTicks, yTicks, hasData: true };
}
