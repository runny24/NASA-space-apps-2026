// Legend for the active layer: the ramp drawn from the same stops the map uses, end labels in
// physical units, and the layer's one-sentence description, then its method folded under a native
// <details>; then an entry for each overlay that is switched on (components/Overlays.tsx), whose
// method folds the same way, under the same summary. A place with no layers yet gets only the
// overlay entries.

import { decimalsFor, formatValue } from '../contract/encoding';
import type { Layer } from '../contract/manifest';
import { rampFor } from '../map/ramps';
import type { OverlayView } from '../state/overlayView';
import { OVERLAY_GROUP_LABEL, OverlayLegendEntry } from './Overlays';

/** What the closed disclosure of the layer's method says, and of an overlay's. */
export const LEGEND_METHOD_SUMMARY = 'Method';

export function Legend(props: { layer: Layer | null; overlays?: readonly OverlayView[] }) {
  const { layer } = props;
  return (
    <section className="panel legend" aria-labelledby="legend-title">
      <h2 id="legend-title">{layer ? layer.title : OVERLAY_GROUP_LABEL}</h2>
      {layer && (
        <>
          {layer.encoding.type === 'linear-uint8' ? <LinearScale layer={layer} /> : <ClassList layer={layer} />}
          {/* The description stays in view; the method folds, as a bars figure's does. */}
          <p className="legend-description">{layer.description}</p>
          {layer.method && (
            <details className="muted legend-method">
              <summary>{LEGEND_METHOD_SUMMARY}</summary>
              <p>{layer.method}</p>
            </details>
          )}
        </>
      )}
      {props.overlays?.map((v) => <OverlayLegendEntry key={v.overlay.id} view={v} />)}
    </section>
  );
}

function LinearScale({ layer }: { layer: Layer }) {
  const enc = layer.encoding;
  if (enc.type !== 'linear-uint8') return null;
  const range = layer.display ?? { min: enc.lo, max: enc.hi };
  const stops = rampFor(layer);
  const decimals = decimalsFor(enc);
  const label = (v: number) => formatValue(v, layer.unit, decimals);
  // Values beyond the display range take the end colours, so the ends read "or less" / "or more".
  return (
    <div>
      <div
        className="ramp"
        style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
        role="img"
        aria-label={`Colour scale from ${label(range.min)} to ${label(range.max)}`}
      />
      <div className="ramp-labels">
        <span>{label(range.min)} or less</span>
        {layer.display?.diverging && <span>{label((range.min + range.max) / 2)}</span>}
        <span>{label(range.max)} or more</span>
      </div>
    </div>
  );
}

function ClassList({ layer }: { layer: Layer }) {
  const enc = layer.encoding;
  if (enc.type !== 'categorical-uint8') return null;
  return (
    // role="list": with list-style none, Safari and VoiceOver stop treating it as a list.
    <ul className="classes" role="list" aria-label={`Classes of ${layer.title}`}>
      {enc.classes.map((c) => (
        <li key={c.value}>
          <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
          {c.label}
        </li>
      ))}
    </ul>
  );
}
