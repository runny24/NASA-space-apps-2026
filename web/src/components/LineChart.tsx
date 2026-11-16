// A small inline SVG line chart with real dates on the x axis. Used for a clicked point's history
// and for every stats series. Gaps (null values) stay gaps.

import { clippedSuffix } from '../contract/encoding';
import { chartGeometry, type ChartPoint } from './chartGeometry';

// Room on the left for value labels, at the top for the unit, at the bottom for dates.
const BOX = { width: 320, height: 160, left: 40, right: 12, top: 22, bottom: 24 };

export function LineChart(props: { points: ChartPoint[]; unit: string; label: string }) {
  const g = chartGeometry(props.points, BOX);
  if (!g.hasData) return <p className="muted">No values to chart here.</p>;
  const yDecimals = g.yTicks.some((t) => !Number.isInteger(t.value)) ? 1 : 0;
  return (
    <svg className="chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={props.label}>
      <title>{props.label}</title>
      {g.yTicks.map((t) => (
        <g key={`y${t.value}`}>
          <line className="chart-grid" x1={BOX.left} x2={BOX.width - BOX.right} y1={t.y} y2={t.y} />
          <text className="chart-label" x={BOX.left - 4} y={t.y + 3} textAnchor="end">
            {t.value.toFixed(yDecimals)}
          </text>
        </g>
      ))}
      {g.xTicks.map((t, i) => (
        <text
          key={`x${t.label}`}
          className="chart-label"
          x={t.x}
          y={BOX.height - 8}
          textAnchor={i === 0 ? 'start' : i === g.xTicks.length - 1 ? 'end' : 'middle'}
        >
          {t.label}
        </text>
      ))}
      {props.unit && (
        <text className="chart-label" x={4} y={11}>
          {props.unit}
        </text>
      )}
      {g.paths.map((d) => (
        <path key={d} className="chart-line" d={d} />
      ))}
      {g.dots.map((p) => {
        const title = <title>{`${p.date}: ${`${p.value.toFixed(2)} ${props.unit}`.trim()}${clippedSuffix(p.clipped)}`}</title>;
        // A clipped value is a bound, not a measurement: draw it as an open triangle pointing the way
        // the true value lies, so it does not read as an exact point.
        if (p.clipped) {
          const d = p.clipped === 'above' ? -1 : 1;
          return (
            <path
              key={p.date}
              className="chart-bound"
              d={`M${p.x - 4},${p.y - 3 * d} L${p.x + 4},${p.y - 3 * d} L${p.x},${p.y + 4 * d} Z`}
              data-clipped={p.clipped}
            >
              {title}
            </path>
          );
        }
        return (
          <circle key={p.date} className="chart-dot" cx={p.x} cy={p.y} r={3}>
            {title}
          </circle>
        );
      })}
    </svg>
  );
}
