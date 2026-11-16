// Charts every series in the site's stats.json with the same chart as the point history, then draws
// every entry of its `bars` (comparisons across categories), whatever layer is selected. A series'
// region and method fold under a native <details>; the mixed-release warning never does.
// The file is loaded once per site by App (useStats.ts) and shared with the year's curve.

import type { Layer } from '../contract/manifest';
import type { Stats } from '../contract/stats';
import { panelScales } from './barGeometry';
import { BarsFigure } from './BarsFigure';
import { LineChart } from './LineChart';
import type { StatsLoad } from './useStats';

/** docs/DATA_CONTRACT.md: with source.release "mixed" the app says so wherever dates are compared. */
export const MIXED_RELEASE_WARNING = 'Dates come from more than one data release; compare them with care.';

export const NO_STATISTICS = 'No statistics for this place yet.';

/** What the closed disclosure of a series' region and method says. */
export const SERIES_METHOD_SUMMARY = 'How this was computed';
/** Inside it, the words before the series' region and before its method. */
export const SERIES_REGION_LABEL = 'Where:';
export const SERIES_METHOD_LABEL = 'How:';

/** True when the file has neither a series nor a bars entry to show. */
export function hasNoStatistics(stats: Stats): boolean {
  return stats.series.length === 0 && (stats.bars?.length ?? 0) === 0;
}

/** `load`: the site's stats file as useStats gives it, null while it loads. */
export function StatsPanel(props: { load: StatsLoad | null; mixedRelease: boolean; layers: readonly Layer[] }) {
  const current = props.load;
  return (
    <section className="panel" aria-labelledby="stats-title">
      <h2 id="stats-title">Statistics</h2>
      {!current && <p className="muted">Loading…</p>}
      {current?.error && <p className="error">{current.error}</p>}
      {current?.stats && <StatsBody stats={current.stats} layers={props.layers} mixedRelease={props.mixedRelease} />}
      {!current?.stats && <MixedReleaseWarning show={props.mixedRelease} />}
    </section>
  );
}

/** What a loaded file shows: its series, then its bars. */
export function StatsBody(props: { stats: Stats; layers: readonly Layer[]; mixedRelease: boolean }) {
  const { stats } = props;
  const scales = panelScales(stats.bars ?? []);
  return (
    <>
      {hasNoStatistics(stats) && <p className="muted">{NO_STATISTICS}</p>}
      <MixedReleaseWarning show={props.mixedRelease} />
      {stats.series.map((s) => (
        <figure key={s.id} className="series">
          <figcaption>
            <strong>{s.title}</strong>
            {s.unit && ` (${s.unit})`}
          </figcaption>
          <LineChart points={s.points} unit={s.unit} label={`${s.title} over time`} />
          {/* Folded under a disclosure built like a bars figure's (BarsFigure.tsx): the region (a definition
              of up to 80 words) and the method. The title, unit and chart stay in view. */}
          <details className="muted series-method">
            <summary>{SERIES_METHOD_SUMMARY}</summary>
            <p>
              {SERIES_REGION_LABEL} {s.region}
            </p>
            <p>
              {SERIES_METHOD_LABEL} {s.method}
            </p>
          </details>
        </figure>
      ))}
      {/* Entries of the same unit and layer (one per period, say) draw on one scale, so their bars compare. */}
      {stats.bars?.map((entry, i) => <BarsFigure key={entry.id} entry={entry} layers={props.layers} scale={scales[i]} />)}
    </>
  );
}

function MixedReleaseWarning({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="warning" data-testid="stats-mixed-release">
      {MIXED_RELEASE_WARNING}
    </p>
  );
}
