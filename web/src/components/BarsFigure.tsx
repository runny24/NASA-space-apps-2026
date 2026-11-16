// One entry of `bars` in stats.json: a row per category with its label, a horizontal bar from zero on
// a scale shared by the rows (and by the panel's other entries of the same unit and layer, which the
// figure says in words), a whisker from low to high, and every number written out. The drawing is
// hidden from screen readers (the text says it all), the rows are a list read as label, value,
// interval, n, note. Below the rows the region, then the method, folded under a native <details>.
// The geometry and the words are in barGeometry.ts.

import type { Layer } from '../contract/manifest';
import type { BarsEntry } from '../contract/stats';
import {
  barsGeometry,
  classColour,
  countText,
  intervalText,
  panelScales,
  scaleText,
  valueText,
  type BarRowGeometry,
  type BarScale,
  type PanelScale,
} from './barGeometry';
import { formatNumber } from './numberText';

const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;

/** What the closed disclosure of a figure's method says. */
export const METHOD_SUMMARY = 'How these numbers and their intervals were computed';

/** `scale`: the panel's scale for this entry (panelScales, in StatsBody); without it, a scale of its own. */
export function BarsFigure(props: { entry: BarsEntry; layers: readonly Layer[]; scale?: PanelScale }) {
  const { entry } = props;
  const shared = props.scale ?? panelScales([entry])[0]!;
  const g = barsGeometry(entry.categories, shared.scale);
  const layerName = props.layers.find((l) => l.id === entry.layer)?.title ?? entry.layer;
  return (
    <figure className="bars" data-bars-id={entry.id}>
      <figcaption>
        <strong>{entry.title}</strong>
        {entry.unit && ` (${entry.unit})`}
      </figcaption>
      {/* The scale in words: the axis below is hidden from screen readers, and it does not say whether other figures share it. */}
      {g.scale && <p className="muted bars-scale">{scaleText(g.scale, entry.unit, shared, layerName)}</p>}
      {g.scale && <BarAxis scale={g.scale} />}
      {/* role="list": with list-style none, Safari and VoiceOver stop treating it as a list. */}
      <ul className="bars-rows" role="list">
        {entry.categories.map((c, i) => {
          const colour = classColour(entry, c, props.layers);
          // An interval is the uncertainty of a value: with no value there is none to write.
          const interval = c.value === null ? null : intervalText(c.low, c.high);
          const count = countText(c.n);
          const row = g.rows[i];
          return (
            <li key={i} className="bars-row" data-missing={c.value === null ? 'true' : undefined}>
              <div className="bars-label">
                {colour && <span className="swatch" style={{ background: colour }} aria-hidden="true" />}
                <span>
                  {c.label}
                  <span className="visually-hidden">: </span>
                </span>
              </div>
              {/* A missing value gets no drawing at all, not even the zero line, so nothing in its row looks like a zero. */}
              {g.scale && row?.bar && <BarTrack row={row} zero={g.scale.zero} />}
              <div className="bars-numbers">
                <span className="bars-value">{valueText(c.value, entry.unit)}</span>
                {interval && (
                  <>
                    {' '}
                    <span className="bars-interval">{interval}</span>
                  </>
                )}
                {count && (
                  <>
                    {', '}
                    <span className="bars-n">{count}</span>
                  </>
                )}
              </div>
              {c.note && (
                <div className="bars-note">
                  <span className="visually-hidden">. Note: </span>
                  {c.note}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted bars-region">Region: {entry.region}</p>
      {/* Folded: a real method runs to about 1,100 characters, and the panel would repeat one per figure. */}
      <details className="muted bars-method">
        <summary>{METHOD_SUMMARY}</summary>
        <p>{entry.method}</p>
      </details>
    </figure>
  );
}

/** The scale's ends and zero, written above the rows' drawings (hidden: every number is in the rows' text). */
function BarAxis({ scale }: { scale: BarScale }) {
  return (
    <div className="bars-axis-row" aria-hidden="true">
      <div className="bars-axis">
        {scale.ticks.map((t) => (
          <span
            key={t.value}
            className="bars-tick"
            data-value={t.value}
            style={{ left: percent(t.at), transform: t.at <= 0 ? undefined : t.at >= 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {formatNumber(t.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarTrack({ row, zero }: { row: BarRowGeometry; zero: number }) {
  return (
    <div className="bars-track" aria-hidden="true">
      <span className="bars-zero-line" style={{ left: percent(zero) }} />
      {row.bar && !row.atZero && <span className="bars-bar" style={{ left: percent(row.bar.from), width: percent(row.bar.to - row.bar.from) }} />}
      {row.atZero && <span className="bars-zero-value" style={{ left: percent(zero) }} />}
      {row.whisker && (
        <span className="bars-whisker" style={{ left: percent(row.whisker.from), width: percent(row.whisker.to - row.whisker.from) }} />
      )}
    </div>
  );
}
