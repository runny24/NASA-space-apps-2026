// The maths and the words behind BarsFigure (an entry of `bars` in stats.json), kept apart from React
// so they can be unit-tested. Positions are fractions of a row's drawing (0 = its left edge, 1 = its
// right edge), on one scale shared by every row of the entry, and by every other entry of the panel
// with the same unit and layer (panelScales). A null value is missing: no bar, no whisker, "not
// available", never a zero. A value of 0 is a real zero and gets a mark on the zero line.

import type { Layer } from '../contract/manifest';
import type { BarsEntry, BarCategory } from '../contract/stats';
import { NOT_AVAILABLE } from '../state/overlayView';
import { formatNumber } from './numberText';

export interface BarScale {
  /** The scale's ends, in the entry's unit: min is 0 unless a drawn value or low is negative. */
  min: number;
  max: number;
  /** Where zero lies, as a fraction of the row. */
  zero: number;
  /** The values written on the scale (its ends and zero), each with its place. */
  ticks: { value: number; at: number }[];
}

export interface BarRowGeometry {
  /** From zero to the value; null when the value is null. For a value of 0, from === to. */
  bar: { from: number; to: number } | null;
  /** The value is exactly 0: drawn as a mark on the zero line, since a bar of no length is invisible. */
  atZero: boolean;
  /** From low to high, only when both are numbers and the value is not null. */
  whisker: { from: number; to: number } | null;
}

export interface BarsGeometry {
  /** null when no row has anything to draw (every value null). */
  scale: BarScale | null;
  rows: BarRowGeometry[];
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Both ends of the uncertainty interval, when the category has both. */
function interval(c: BarCategory): [number, number] | null {
  return isNumber(c.low) && isNumber(c.high) ? [c.low, c.high] : null;
}

/** Steps that read as round numbers, times a power of ten. */
const ROUND_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** The smallest round number (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten) at or above x > 0. */
export function niceCeiling(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return x;
  const magnitude = 10 ** Math.floor(Math.log10(x));
  const ratio = x / magnitude;
  // The tolerance keeps 0.3 at 0.3 when floating point makes the ratio 3.0000000000000004.
  const step = ROUND_STEPS.find((m) => m >= ratio * (1 - 1e-9)) ?? 10;
  return Number((step * magnitude).toPrecision(12));
}

/** The shared scale: from 0 (or a round number at or below the most negative value or low) to a round number at or above the largest value or high. */
export function barScale(categories: readonly BarCategory[]): BarScale | null {
  const drawn = categories.flatMap((c) => (isNumber(c.value) ? [c.value, ...(interval(c) ?? [])] : []));
  if (drawn.length === 0) return null;
  const top = Math.max(0, ...drawn);
  const bottom = Math.min(0, ...drawn);
  let max = top > 0 ? niceCeiling(top) : 0;
  const min = bottom < 0 ? -niceCeiling(-bottom) : 0;
  // Every drawn number is 0: give the scale a length so the zero line has somewhere to stand.
  if (max === min) max = 1;
  const at = (v: number) => (v - min) / (max - min);
  const values = [...new Set([min, 0, max])];
  return { min, max, zero: at(0), ticks: values.map((value) => ({ value, at: at(value) })) };
}

/** The scale a figure draws on, and how many figures of the panel draw on it. */
export interface PanelScale {
  /** null when the entry has nothing to draw (every value null). */
  scale: BarScale | null;
  /** How many figures of the panel draw on this scale, this one included: 1 is a scale of its own. */
  charts: number;
  /** How many figures of the panel draw anything at all. */
  figures: number;
}

/**
 * The scale of each entry of `bars`, in the file's order. The entries that share a unit and a layer
 * (the same quantity on the same classes, such as one entry per period) draw on one scale, computed
 * over all of their categories, so that a longer bar is a larger value from one figure to the next.
 * An entry with another unit or layer, or with no layer, keeps a scale of its own. An entry with
 * nothing to draw has no scale and is not counted.
 */
export function panelScales(entries: readonly Pick<BarsEntry, 'unit' | 'layer' | 'categories'>[]): PanelScale[] {
  const draws = entries.map((e) => barScale(e.categories) !== null);
  const key = (e: Pick<BarsEntry, 'unit' | 'layer'>, i: number) => (e.layer === undefined ? `own ${i}` : JSON.stringify([e.unit, e.layer]));
  const groups = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (draws[i]) groups.set(key(e, i), [...(groups.get(key(e, i)) ?? []), i]);
  });
  const figures = draws.filter(Boolean).length;
  return entries.map((e, i) => {
    if (!draws[i]) return { scale: null, charts: 0, figures };
    const members = groups.get(key(e, i))!;
    return { scale: barScale(members.flatMap((m) => entries[m]!.categories)), charts: members.length, figures };
  });
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * What a figure writes about its scale, as text that screen readers get too (the axis above the rows
 * is hidden from them): its ends with the unit, and whether other figures of the panel share it.
 * `layerName` names the entry's layer, for the case where only some of the figures share the scale.
 */
export function scaleText(scale: BarScale, unit: string, shared: Pick<PanelScale, 'charts' | 'figures'>, layerName?: string): string {
  const range = `Scale: ${formatNumber(scale.min)} to ${formatNumber(scale.max)}${unit ? ` ${unit}` : ''}`;
  if (shared.figures <= 1) return `${range}.`;
  if (shared.charts <= 1) return `${range}, for this chart only.`;
  const count = COUNT_WORDS[shared.charts] ?? String(shared.charts);
  if (shared.charts >= shared.figures) return shared.charts === 2 ? `${range}, the same in both charts.` : `${range}, the same in all ${count} charts.`;
  return `${range}, the same in the ${count} charts${unit ? ` in ${unit}` : ''}${layerName ? ` for the layer “${layerName}”` : ''}.`;
}

/**
 * The scale and every row's bar and whisker, in the file's order. `shared` is the panel's scale for
 * the entry (panelScales), which covers every value of the entry; without it the entry's own scale.
 */
export function barsGeometry(categories: readonly BarCategory[], shared?: BarScale | null): BarsGeometry {
  const own = barScale(categories);
  // Nothing of the entry is drawn: no scale, whatever the panel's.
  const scale = own && (shared ?? own);
  if (!scale) return { scale: null, rows: categories.map(() => ({ bar: null, atZero: false, whisker: null })) };
  const at = (v: number) => (v - scale.min) / (scale.max - scale.min);
  const rows = categories.map((c): BarRowGeometry => {
    if (!isNumber(c.value)) return { bar: null, atZero: false, whisker: null };
    const v = at(c.value);
    const ends = interval(c);
    return {
      bar: { from: Math.min(scale.zero, v), to: Math.max(scale.zero, v) },
      atZero: c.value === 0,
      whisker: ends ? { from: at(Math.min(...ends)), to: at(Math.max(...ends)) } : null,
    };
  });
  return { scale, rows };
}

/** The value with its unit, or "not available". */
export function valueText(value: number | null, unit: string): string {
  if (!isNumber(value)) return NOT_AVAILABLE;
  const text = formatNumber(value);
  return unit ? `${text} ${unit}` : text;
}

/** "(low to high)" when both are numbers; a lone end is still written, so no number is hidden. */
export function intervalText(low: number | undefined, high: number | undefined): string | null {
  if (isNumber(low) && isNumber(high)) return `(${formatNumber(low)} to ${formatNumber(high)})`;
  if (isNumber(low)) return `(lower end ${formatNumber(low)})`;
  if (isNumber(high)) return `(upper end ${formatNumber(high)})`;
  return null;
}

/** "n = 93", or null when the file gives no count. */
export function countText(n: number | undefined): string | null {
  return isNumber(n) ? `n = ${formatNumber(n)}` : null;
}

/**
 * The colour of a category's class, when the entry names a categorical layer of this site and the
 * category's `class` is one of that layer's classes; otherwise null (no swatch).
 */
export function classColour(entry: Pick<BarsEntry, 'layer'>, category: BarCategory, layers: readonly Layer[]): string | null {
  if (entry.layer === undefined || !isNumber(category.class)) return null;
  const layer = layers.find((l) => l.id === entry.layer);
  if (layer?.encoding.type !== 'categorical-uint8') return null;
  return layer.encoding.classes.find((k) => k.value === category.class)?.color ?? null;
}
