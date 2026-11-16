// The year as a curve (docs/MOTION_AND_STORY_BRIEF.md, slice 5): a site's mean backscatter as a thin
// line with a dot per pass, on the same true time axis as the timeline's marks (state/timeline.ts,
// TimelineEntry.position), so each dot stands right above its mark. Drawn in the date stepper
// (Controls.tsx) and, revealed pass by pass, as a story step's figure (story/StoryCurve.tsx).
//
// What it may never do, because each would show a value the data does not hold:
// - join two passes across a gap: only the curve's `segments` are drawn, one line each, never one
//   polyline through every point (state/timelineCurve.ts breaks the line at every missing pass, at
//   every date the layer has no file for and at every null value);
// - move: it is static, with no transition or animation (styles/curve.css). Whole points and whole
//   segments appear or not; nothing draws itself, nothing tweens.
//
// It is aria-hidden: it is a picture of the series whose full chart, with its numbers, is in the
// Statistics panel. The timeline's marks under it stay the controls, unchanged.
//
// The x of a point is a percentage of the plot's width, as a mark's `left` is of the timeline's; the
// plot and the timeline have the same width (styles/curve.css), so a dot and its mark line up.

import type { CurvePoint, MonthTick, TimelineCurve } from '../state/timelineCurve';

/** The plot's height in px, and the radius of a dot and of the dot of the picture on the map. */
export const CURVE_HEIGHT = 48;
const DOT_R = 2.5;
const CURRENT_R = 4.5;
/** Room above the highest dot and below the lowest, so no dot is cut. */
const PAD = CURRENT_R + 1;

/** A value as the curve's labels write it: one decimal, no locale (as LineChart's axis labels). */
export const curveValueText = (value: number, unit: string): string => `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;

const xOf = (p: CurvePoint) => `${p.x * 100}%`;
const yOf = (p: CurvePoint) => PAD + (1 - p.y) * (CURVE_HEIGHT - 2 * PAD);

export interface YearCurveProps {
  /** The curve to draw: the whole curve, or the part revealed so far (revealedCurve keeps min, max and every coordinate). */
  curve: TimelineCurve;
  unit: string;
  /** The series' and the layer's ids, for the tests. */
  seriesId: string;
  layerId: string;
  /** The item of the picture on the map, whose dot is marked (the story's figure); null: none. */
  current?: number | null;
  testId: string;
}

/**
 * The curve's highest value (top left), the plot, and its lowest value (bottom left). Each segment is
 * one <line> with data-from and data-to (its two passes' dates); each point one <circle> with
 * data-date, data-item and data-value.
 */
export function YearCurve(props: YearCurveProps) {
  const { curve, unit, current = null } = props;
  const marked = curve.points.find((p) => p.itemIndex === current) ?? null;
  return (
    <div className="curve" aria-hidden="true" data-testid={props.testId} data-series={props.seriesId} data-layer={props.layerId}>
      <p className="curve-label curve-max">{curveValueText(curve.max, unit)}</p>
      <svg className="curve-plot" width="100%" height={CURVE_HEIGHT} focusable="false">
        {/* Faint rules at the highest and the lowest value, which the labels name: the frame, not data. */}
        {curve.max > curve.min && (
          <>
            <line className="curve-rule" x1="0" x2="100%" y1={PAD} y2={PAD} />
            <line className="curve-rule" x1="0" x2="100%" y1={CURVE_HEIGHT - PAD} y2={CURVE_HEIGHT - PAD} />
          </>
        )}
        {curve.segments.map(([a, b]) => (
          <line key={`${a.date}/${b.date}`} className="curve-segment" x1={xOf(a)} y1={yOf(a)} x2={xOf(b)} y2={yOf(b)} data-from={a.date} data-to={b.date} />
        ))}
        {curve.points.map((p) =>
          p === marked ? null : (
            <circle key={p.date} className="curve-dot" cx={xOf(p)} cy={yOf(p)} r={DOT_R} data-date={p.date} data-item={p.itemIndex} data-value={p.value} />
          ),
        )}
        {/* Drawn last, so no line or dot lies over it. */}
        {marked && (
          <circle
            className="curve-dot curve-dot-current"
            cx={xOf(marked)}
            cy={yOf(marked)}
            r={CURRENT_R}
            data-date={marked.date}
            data-item={marked.itemIndex}
            data-value={marked.value}
            data-current=""
          />
        )}
      </svg>
      <p className="curve-label curve-min">{curveValueText(curve.min, unit)}</p>
    </div>
  );
}

/** The month names under the axis, each at its true place on it (monthTicks). Aria-hidden, like the curve. */
export function CurveMonths(props: { months: readonly MonthTick[] }) {
  return (
    <div className="curve-months" aria-hidden="true" data-testid="curve-months">
      {props.months.map((m) => (
        <span key={m.month} className="curve-month" style={{ left: `${m.x * 100}%` }} data-month={m.month}>
          {m.label}
        </span>
      ))}
    </div>
  );
}
