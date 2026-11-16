// The story's date stamp: the map's own tag (components/PictureLoading.tsx), in the story's look. It
// is fed by the same report, the picture the map has DRAWN (onPictureShown), never the date asked
// for: while a new date loads it still names the previous picture, which is the one on the map, and
// once that has left the map it says "Loading the picture…" and names no date (storyModel.ts,
// stampText). App shows either this or the tool's tag, never both: on a desktop on the map, bottom
// left; on a phone in a strip under the map, so nothing of the story lies on the map.
//
// data-drawn-date and data-drawn-layer say what is drawn, for the tests (e2e/story.spec.ts compares
// them with the file the map draws). Plain text, not a live region: the live region says the step.

import type { PictureOnMap } from '../map/dataLayers';
import { stampDrawnDate, stampText } from './storyModel';

export function DateStamp(props: { shown: PictureOnMap | null; layerChosen: boolean; under: boolean }) {
  const text = stampText(props.shown, props.layerChosen);
  if (!text) return null;
  return (
    <p
      className={props.under ? 'story-stamp story-stamp-under' : 'story-stamp'}
      data-testid="story-stamp"
      data-drawn-date={stampDrawnDate(props.shown)}
      data-drawn-layer={props.shown?.layer.id}
    >
      {text}
    </p>
  );
}
