// What the person clicked: coordinates, the active layer's value there, and the point's history.

import type { InspectResult } from '../map/inspect';
import type { OverlayReading } from '../state/overlayView';
import { LineChart } from './LineChart';
import { OverlayPointBlock } from './Overlays';
import { MIXED_RELEASE_WARNING } from './StatsPanel';

export type InspectState =
  | { status: 'idle' }
  | { status: 'loading'; lon: number; lat: number }
  | { status: 'done'; result: InspectResult }
  /**
   * Another date of the same layer at the same point: `result` is the reading of the date before,
   * whose history (the same for every date) stays on screen while the value of `when` is read.
   */
  | { status: 'updating'; result: InspectResult; when: string };

export function InspectPanel(props: {
  state: InspectState;
  mixedRelease: boolean;
  onInspectCentre: () => void;
  /** While the dates play, the reading changes on every step: it is not announced then. */
  quiet?: boolean;
  /** The nearest drawn point of each overlay that is on, where one is within reach. */
  overlayReadings?: readonly OverlayReading[];
}) {
  const { state } = props;
  const readings = state.status === 'idle' ? [] : (props.overlayReadings ?? []);
  return (
    <section className="panel inspect" aria-labelledby="inspect-title" aria-live={props.quiet ? 'off' : 'polite'} data-testid="inspect">
      <h2 id="inspect-title">At a point</h2>
      {state.status === 'idle' && (
        <p className="muted">Click the map to read the values at that point, or move the map and use this button to read its centre.</p>
      )}
      <button type="button" className="secondary" onClick={props.onInspectCentre}>
        Read values at the map centre
      </button>
      {state.status === 'loading' && <p>Reading values…</p>}
      {state.status === 'loading' && <OverlayReadings readings={readings} />}
      {(state.status === 'done' || state.status === 'updating') && (
        <Result
          result={state.result}
          readingWhen={state.status === 'updating' ? state.when : null}
          mixedRelease={props.mixedRelease}
          readings={readings}
        />
      )}
    </section>
  );
}

function OverlayReadings({ readings }: { readings: readonly OverlayReading[] }) {
  return readings.map((r) => <OverlayPointBlock key={r.overlayId} reading={r} />);
}

/**
 * One reading. `readingWhen` (not null) says the value of that date is being read: the value line
 * says so, and the rest (the point, the history) is the reading before, which does not depend on the
 * date, so the panel keeps its height while the dates change.
 */
function Result({
  result,
  readingWhen,
  mixedRelease,
  readings,
}: {
  result: InspectResult;
  readingWhen: string | null;
  mixedRelease: boolean;
  readings: readonly OverlayReading[];
}) {
  const h = result.history;
  return (
    <div className="readout">
      <p className="readout-where">
        Longitude {result.lon.toFixed(4)}, latitude {result.lat.toFixed(4)}
      </p>
      {readingWhen !== null ? (
        <p data-testid="inspect-value-reading">Value{readingWhen ? ` (${readingWhen})` : ''}: reading…</p>
      ) : (
        <>
          {/* inspect-value-line: the line fades in whole when the value arrives (styles/motion.css); the number never counts. */}
          {result.valueText !== null && (
            <p className="inspect-value-line">
              Value{result.valueWhen ? ` (${result.valueWhen})` : ''}: <strong data-testid="inspect-value">{result.valueText}</strong>
            </p>
          )}
          {result.valueError && <p className="error">Could not read the layer here: {result.valueError}</p>}
        </>
      )}
      <OverlayReadings readings={readings} />
      {h && (
        <div>
          <h3>History: {h.layerTitle}</h3>
          <p className="muted">
            Values are means over the stack cell of about {h.resolutionM} m around this point, not the single map pixel.
            {mixedRelease && ` ${MIXED_RELEASE_WARNING}`}
          </p>
          {!h.categorical && <LineChart points={h.points} unit={h.unit} label={`History of ${h.layerTitle} at this point`} />}
          {h.points.some((p) => p.clipped) && (
            <p className="muted" data-testid="clipped-note">
              An open triangle marks a value at the end of the stored range: the true value is that much or more (pointing up)
              or that much or less (pointing down).
            </p>
          )}
          <table className="history">
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {h.points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{p.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.historyError && <p className="error">Could not read the history here: {result.historyError}</p>}
    </div>
  );
}
