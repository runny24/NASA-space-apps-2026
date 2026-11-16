// Overlays (data from other sources) in the page: the switches, the caption box on the map, the
// legend entries and the reading of a point. What they say comes from state/overlayView.ts and the
// manifest; nothing about a particular overlay is written here.

import { useId } from 'react';
import type { Overlay } from '../contract/manifest';
import { OVERLAY_NOT_NISAR } from '../state/overlayPeriod';
import type { OverlayReading, OverlayView } from '../state/overlayView';
// Legend.tsx imports this file too; the summary is only read while rendering, so the cycle is harmless.
import { LEGEND_METHOD_SUMMARY } from './Legend';

/** The heading of the switches. */
export const OVERLAY_GROUP_LABEL = 'Data from other sources';

/** A small picture of the dot the map draws: the overlay's colour with the dark outline. */
export function OverlayDot(props: { color: string }) {
  return <span className="overlay-dot" style={{ background: props.color }} aria-hidden="true" />;
}

/**
 * One switch per overlay of the site, after the layer's own controls; nothing when the site has none.
 * Under each switch its caption, announced politely except while the dates play (as the date is),
 * and, when its file failed, the reason.
 */
export function OverlaySwitches(props: {
  overlays: Overlay[] | undefined;
  on: readonly string[];
  views: readonly OverlayView[];
  onToggle: (id: string, on: boolean) => void;
  quiet: boolean;
  defaultColor: string;
}) {
  const labelId = useId();
  if (!props.overlays || props.overlays.length === 0) return null;
  return (
    <div className="field" role="group" aria-labelledby={labelId} data-testid="overlay-switches">
      <span className="field-label" id={labelId}>
        {OVERLAY_GROUP_LABEL}
      </span>
      {props.overlays.map((o) => {
        const view = props.views.find((v) => v.overlay.id === o.id);
        const isOn = props.on.includes(o.id);
        return (
          <div key={o.id} className="overlay-switch" data-overlay={o.id}>
            <label className="switch">
              <input type="checkbox" role="switch" checked={isOn} onChange={(e) => props.onToggle(o.id, e.target.checked)} />
              <OverlayDot color={o.color ?? props.defaultColor} />
              <span>{o.title}</span>
            </label>
            {/* Always in the page, so that a screen reader hears the caption change. */}
            <p className="overlay-caption" aria-live={props.quiet ? 'off' : 'polite'} data-testid="overlay-caption">
              {isOn && view?.caption ? view.caption : ''}
            </p>
            {isOn && view?.error && (
              <p className="error" role="alert" data-testid="overlay-error">
                {view.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The caption box on the map (on a phone, in the strip right under it: App.tsx), so that a
 * screenshot of the map carries what the dots are: for each
 * overlay that is on, its dot and its caption, then what any such dot is not. Nothing else: its
 * credit is in the map's own credit line (the source's attribution) and in full in the legend, as
 * the radar's credit is, so that a long credit cannot cover the map. Not a live region, and hidden
 * from screen readers: the side panel's caption and the legend say the same, so nothing is read twice.
 */
export function OverlayMapCaption(props: { views: readonly OverlayView[] }) {
  if (props.views.length === 0) return null;
  return (
    <div className="overlay-map-caption" data-testid="overlay-map-caption" aria-hidden="true">
      {props.views.map((v) => (
        <div key={v.overlay.id} className="overlay-map-entry">
          <p className="overlay-map-title">
            <OverlayDot color={v.color} />
            <span data-testid="overlay-map-caption-text">{v.caption ?? `${v.overlay.title}: could not be loaded, so nothing is drawn.`}</span>
          </p>
        </div>
      ))}
      <p className="overlay-map-note">{OVERLAY_NOT_NISAR}</p>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The legend's entry for an overlay that is on. */
export function OverlayLegendEntry(props: { view: OverlayView }) {
  const { overlay, color, undated, skipped } = props.view;
  return (
    <div className="legend-overlay" data-testid="legend-overlay" data-overlay={overlay.id}>
      <h3>
        <OverlayDot color={color} /> {overlay.title}
      </h3>
      <p>{overlay.description}</p>
      <p>{OVERLAY_NOT_NISAR}</p>
      {overlay.date_property && <p className="muted">Dates are UTC days.</p>}
      {undated > 0 && (
        <p className="muted" data-testid="overlay-undated">
          {plural(undated, 'point has', 'points have')} no valid date and {undated === 1 ? 'is' : 'are'} left out of every period.
        </p>
      )}
      {skipped > 0 && (
        <p className="muted">
          {plural(skipped, 'feature', 'features')} of the file {skipped === 1 ? 'is' : 'are'} not a point and {skipped === 1 ? 'is' : 'are'} not drawn.
        </p>
      )}
      {/* The method folds, as the layer's does above it in the legend; the description, the sentence
          that this is not a NISAR measurement and the credit stay in view. */}
      {overlay.method && (
        <details className="muted legend-method">
          <summary>{LEGEND_METHOD_SUMMARY}</summary>
          <p>{overlay.method}</p>
        </details>
      )}
      <p className="muted">Credit: {overlay.credit}</p>
    </div>
  );
}

/** In the "At a point" panel: the fields of the nearest drawn point of an overlay. */
export function OverlayPointBlock(props: { reading: OverlayReading }) {
  const { reading } = props;
  return (
    <div className="overlay-point" data-testid="overlay-point" data-overlay={reading.overlayId}>
      <h3>{reading.title}</h3>
      {reading.withinReach > 1 && (
        <p className="muted" data-testid="overlay-point-count">
          {reading.withinReach} points of this overlay are within reach; the nearest is shown.
        </p>
      )}
      {reading.rows.length > 0 ? (
        <dl className="point-fields">
          {reading.rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">The overlay lists no details for its points.</p>
      )}
    </div>
  );
}
