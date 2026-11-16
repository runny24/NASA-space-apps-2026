// Loading a site's stats.json (contract/stats.schema.json): small numbers for charts.

import type { SiteStatistics as Stats } from './stats.generated';

export type { Stats };
export type StatsSeries = Stats['series'][number];
export type BarsEntry = NonNullable<Stats['bars']>[number];
export type BarCategory = BarsEntry['categories'][number];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `bars` is absent, or an array whose every entry has a non-empty list of categories, each with a label and a value that is a number or null. */
function barsShapeOk(bars: unknown): boolean {
  if (bars === undefined) return true;
  return (
    Array.isArray(bars) &&
    bars.every(
      (entry) =>
        isObject(entry) &&
        Array.isArray(entry.categories) &&
        entry.categories.length > 0 &&
        entry.categories.every(
          (c) => isObject(c) && typeof c.label === 'string' && (c.value === null || (typeof c.value === 'number' && Number.isFinite(c.value))),
        ),
    )
  );
}

/** Fetch and lightly check a stats file. Throws an Error whose message is fit to show a person. */
export async function loadStats(href: string, fetchFn: typeof fetch = fetch): Promise<Stats> {
  const response = await fetchFn(href, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load statistics (HTTP ${response.status}).`);
  const json: unknown = await response.json().catch(() => null);
  const ok =
    isObject(json) &&
    json.schema === 1 &&
    Array.isArray(json.series) &&
    json.series.every((s) => isObject(s) && Array.isArray(s.points)) &&
    barsShapeOk(json.bars);
  if (!ok) throw new Error('The statistics file is not in the expected format (schema 1).');
  return json as unknown as Stats;
}
