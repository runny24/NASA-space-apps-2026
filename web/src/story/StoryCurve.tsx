// The year's curve as a story step's figure (docs/MOTION_AND_STORY_BRIEF.md, slice 5): the same curve
// as above the timeline (components/YearCurve.tsx), revealed up to the picture the map has DRAWN
// (App's pictureShown, never the date asked for): the passes dated on or before that picture's date,
// when it is a picture of the step's layer that did not fail; otherwise no point at all, only the
// frame, the labels and the caption (state/timelineCurve.ts, revealedItems and revealedCurve). So
// during a flip-book whole points and whole segments appear as each picture is drawn, one pass at a
// time; nothing draws itself, nothing tweens, and min, max and every coordinate stay where they are.
//
// The dot of the picture on the map is the app's amber ("where you are"); nothing else on the curve
// is, and no data colour is used (styles/curve.css). App builds it for the layer on screen and its dB
// series (curveSeries); StoryPanel shows it on every step but the cover. Aria-hidden, as the curve
// above the timeline: the series' chart with its numbers is in the Statistics panel.

import type { Layer } from '../contract/manifest';
import type { StatsSeries } from '../contract/stats';
import type { PictureOnMap } from '../map/dataLayers';
import type { TimelineEntry } from '../state/timeline';
import { drawnItemOf, monthTicks, revealedCurve, revealedItems, type TimelineCurve } from '../state/timelineCurve';
import { CurveMonths, YearCurve } from '../components/YearCurve';

export interface StoryCurveProps {
  series: StatsSeries;
  /** The whole curve of `series` on `entries` (timelineCurve). */
  curve: TimelineCurve;
  /** The timeline of `layer` (buildTimeline), for the month names. */
  entries: TimelineEntry[];
  /** The step's layer: the layer on the map. */
  layer: Layer;
  /** The picture the map has drawn (App's pictureShown). */
  picture: PictureOnMap | null;
}

export function StoryCurve(props: StoryCurveProps) {
  const { series, curve, entries, layer, picture } = props;
  const shown = revealedCurve(curve, revealedItems(layer, picture));
  return (
    <div className="story-curve" aria-hidden="true" data-testid="story-curve-figure">
      <p className="curve-caption">
        {series.title}
        {series.unit && ` (${series.unit})`}
      </p>
      <YearCurve curve={shown} unit={series.unit} seriesId={series.id} layerId={layer.id} current={drawnItemOf(layer, picture)} testId="story-curve" />
      <CurveMonths months={monthTicks(entries)} />
    </div>
  );
}
