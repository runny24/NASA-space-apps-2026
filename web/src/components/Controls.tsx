// The controls. Every choice they offer comes from the manifest; nothing about the data is hard-coded.

import { useId, type CSSProperties } from 'react';
import type { Layer, Site } from '../contract/manifest';
import type { StatsSeries } from '../contract/stats';
import { canPlay } from '../state/playback';
import { stepDate, type TimelineEntry } from '../state/timeline';
import { monthTicks, timelineCurve } from '../state/timelineCurve';
import { CurveMonths, YearCurve } from './YearCurve';

export function SitePicker(props: { sites: Site[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  if (props.sites.length < 2) return null;
  return (
    <div className="field">
      <label htmlFor={id}>Place</label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LayerPicker(props: { layers: Layer[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Layer</label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * How far a timeline mark is from the marks before and after it, as fractions of the axis (1 where
 * there is none). On a touch screen each mark's tap pad reaches halfway to its neighbours and no
 * further (styles.css), so a tap picks the nearest mark however crowded the dates are. Missing
 * passes count as neighbours: a tap nearest to one picks nothing.
 */
export function neighbourGaps(entries: TimelineEntry[], i: number): CSSProperties {
  const at = entries[i]?.position ?? 0;
  const before = entries[i - 1];
  const after = entries[i + 1];
  return {
    '--gap-before': before ? at - before.position : 1,
    '--gap-after': after ? after.position - at : 1,
  } as CSSProperties;
}

const STATUS_TEXT: Record<TimelineEntry['status'], string> = {
  available: 'acquisition',
  'not-in-layer': 'acquired, but this layer has no file for it',
  missing: 'missing pass',
};

/** The line under the timeline that stays in view: how many passes of the layer's dates are missing. */
export const missingCountText = (n: number) => `${n} ${n === 1 ? 'pass is' : 'passes are'} missing`;

/** What the closed disclosure of the missing passes' dated reasons says. */
export const MISSING_REASONS_SUMMARY = 'Why they are missing';

/** What the play button needs: whether it is playing, what pressing it does, and what to announce. */
export interface PlayControl {
  playing: boolean;
  onToggle: () => void;
  /** Said by a screen reader when playback stops by itself or is paused ('' otherwise). */
  announcement: string;
}

/**
 * Previous / next buttons, the current date, a play button, and a timeline on a true time axis that
 * marks real acquisitions and shows missing passes as visibly missing: how many, with their dated
 * reasons folded under it.
 * With `series` (the layer's dB series, state/timelineCurve.ts curveSeries), the year as a curve
 * above the marks, on the same axis, and the month names under them (components/YearCurve.tsx);
 * static and aria-hidden, the marks keep their markup. Without it nothing else changes.
 * The left and right arrow keys step too (handled in App, so they work wherever focus is).
 */
export function DateStepper(props: {
  entries: TimelineEntry[];
  itemIndex: number;
  onChange: (itemIndex: number) => void;
  play?: PlayControl;
  series?: StatsSeries | null;
}) {
  const { entries, itemIndex, onChange, play, series } = props;
  const curve = series ? timelineCurve(entries, series.points) : null;
  const current = entries.find((e) => e.itemIndex === itemIndex);
  const prev = stepDate(entries, itemIndex, -1);
  const next = stepDate(entries, itemIndex, 1);
  const missing = entries.filter((e) => e.status === 'missing');
  // At the first or last date the button is marked unavailable with aria-disabled, not `disabled`:
  // a disabled button drops keyboard focus to the page, so stepping to the end with Enter would
  // lose the person's place.
  const atStart = prev === itemIndex;
  const atEnd = next === itemIndex;
  const playing = play?.playing ?? false;
  // At an end the button cannot go further, but while playing a press still stops the playback
  // (onChange with the date on screen does that and changes nothing else), as the arrow keys do.
  const step = (atAnEnd: boolean, to: number) => {
    if (!atAnEnd) onChange(to);
    else if (playing) onChange(itemIndex);
  };
  return (
    <div className="field">
      <span className="field-label" id="date-label">
        Date (UTC)
      </span>
      <div className="stepper" role="group" aria-labelledby="date-label">
        <button type="button" onClick={() => step(atStart, prev)} aria-disabled={atStart} aria-label="Previous date">
          ‹
        </button>
        {/* Not announced on every step while playing; the stop is announced below instead. */}
        <output className="stepper-date" aria-live={playing ? 'off' : 'polite'} data-testid="current-date">
          {current?.date ?? 'none'}
        </output>
        <button type="button" onClick={() => step(atEnd, next)} aria-disabled={atEnd} aria-label="Next date">
          ›
        </button>
        {play && canPlay(entries) && (
          // The name changes between Play and Pause, so no aria-pressed (it would say "Pause, pressed").
          <button type="button" className="play" onClick={play.onToggle} data-testid="play">
            {playing ? <PauseIcon /> : <PlayIcon />}
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>
      {play && (
        <p className="visually-hidden" role="status" data-testid="playback-status">
          {play.announcement}
        </p>
      )}
      {curve && series && <YearCurve curve={curve} unit={series.unit} seriesId={series.id} layerId={series.layer ?? ''} testId="timeline-curve" />}
      <div className="timeline" aria-label="Timeline of passes">
        <div className="timeline-axis" />
        {entries.map((e, i) =>
          e.status === 'available' ? (
            <button
              key={e.date}
              type="button"
              className={`tick tick-available${e.itemIndex === itemIndex ? ' tick-current' : ''}`}
              style={{ left: `${e.position * 100}%`, ...neighbourGaps(entries, i) }}
              aria-label={`Show ${e.date}`}
              aria-pressed={e.itemIndex === itemIndex}
              title={`${e.date}: ${STATUS_TEXT[e.status]}`}
              onClick={() => onChange(e.itemIndex ?? -1)}
            />
          ) : (
            <span
              key={e.date}
              className={`tick tick-${e.status}`}
              style={{ left: `${e.position * 100}%`, ...neighbourGaps(entries, i) }}
              title={`${e.date}: ${STATUS_TEXT[e.status]}${e.reason ? ` (${e.reason})` : ''}`}
              aria-hidden="true"
            />
          ),
        )}
      </div>
      {curve && <CurveMonths months={monthTicks(entries)} />}
      <p className="timeline-key">
        <span className="tick-key tick-available" /> acquisition
        {missing.length > 0 && (
          <>
            {' '}
            <span className="tick-key tick-missing" /> missing pass
          </>
        )}
        {entries.some((e) => e.status === 'not-in-layer') && (
          <>
            {' '}
            <span className="tick-key tick-not-in-layer" /> not in this layer
          </>
        )}
      </p>
      {/* How many passes are missing stays in view under the hatched marks; their dated reasons fold. */}
      {missing.length > 0 && (
        <>
          <p className="missing-count" data-testid="missing-count">
            {missingCountText(missing.length)}
          </p>
          <details className="missing-reasons">
            <summary>{MISSING_REASONS_SUMMARY}</summary>
            <ul className="missing-list">
              {missing.map((m) => (
                <li key={m.date}>
                  Missing {m.date}: {m.reason}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

// Icons drawn in the button's text colour, so a contrast theme recolours them with the text.
function PlayIcon() {
  return (
    <svg className="play-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="play-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1" width="2.5" height="8" fill="currentColor" />
      <rect x="6" y="1" width="2.5" height="8" fill="currentColor" />
    </svg>
  );
}

/** What a static layer shows where a per-date layer has its date stepper. */
export const STATIC_LAYER_NOTE =
  'This layer is a single map. It does not change with the date, so there are no dates to step through.';

export function StaticLayerNote() {
  return (
    <p className="static-note" data-testid="static-note">
      {STATIC_LAYER_NOTE}
    </p>
  );
}

export function PairPicker(props: { layer: Layer; itemIndex: number; onChange: (itemIndex: number) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Pair of dates (UTC)</label>
      <select id={id} value={props.itemIndex} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.layer.items.map((item, i) => (
          <option key={item.url} value={i}>
            {item.reference} to {item.secondary}
          </option>
        ))}
      </select>
    </div>
  );
}

export function OpacityControl(props: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  const percent = Math.round(props.value * 100);
  return (
    <div className="field">
      <label htmlFor={id}>Layer opacity: {percent}%</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(e) => props.onChange(Number(e.target.value) / 100)}
      />
    </div>
  );
}
