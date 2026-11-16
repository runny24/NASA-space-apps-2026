// What the map shows, said on the map itself. Until the map has drawn the picture of the chosen date,
// it may still show the previous date's (map/dataLayers.ts), while the date, the link and a reading at
// a point already name the new one. So a tag on the map always names the picture that is drawn: the
// layer's title and the date of that picture, from the map's own report (DataLayerController's
// onPictureShown), never from the date chosen. A screenshot then always carries the date of its
// picture. When that date's file could not be loaded, the map shows no picture, and the tag says so. Under it, "Loading the picture of <date>…" says that the chosen date is on its way; it
// appears only after a short delay (styles.css), so playing the dates does not make it flicker.

import type { Layer } from '../contract/manifest';

/**
 * The tag's text: "On the map: <layer title>, <date>" for the picture the map has drawn (the pair of
 * dates for a pair layer, the title alone for a static layer), "On the map: no picture (<date> could
 * not be loaded)" when that item's file failed (the layer's title for a static layer), "On the map:
 * no picture yet" while it has none of the chosen layer, and null when no layer is chosen (nothing
 * to draw).
 */
export function pictureShownText(shown: { layer: Layer; index: number; failed?: boolean } | null, layerChosen: boolean): string | null {
  if (!shown) return layerChosen ? 'On the map: no picture yet' : null;
  const { layer } = shown;
  const item = layer.items[shown.index];
  const when =
    layer.kind === 'per-date' ? item?.date : layer.kind === 'pair' && item?.reference && item.secondary ? `${item.reference} to ${item.secondary}` : undefined;
  if (shown.failed) return `On the map: no picture (${when ?? layer.title} could not be loaded)`;
  return when ? `On the map: ${layer.title}, ${when}` : `On the map: ${layer.title}`;
}

/**
 * Plain text, not a live region: a screen reader hears the date from the stepper, and the tag
 * changes on every step while the dates play. No delay: it is there whenever the map is.
 */
export function PictureShown(props: { text: string | null }) {
  if (!props.text) return null;
  return (
    <p className="map-showing" data-testid="map-showing">
      {props.text}
    </p>
  );
}

/**
 * The note to show, or null when the map has drawn the chosen item (`drawnItem`, from the map's
 * onDrawn) or when there is nothing to wait for: no layer, or a map problem about what is on screen,
 * which the error line explains instead.
 */
export function pictureLoadingNote(t: { layer: Layer | null; itemIndex: number; drawnItem: number | null; hasError: boolean }): string | null {
  if (!t.layer || t.itemIndex < 0 || t.itemIndex >= t.layer.items.length || t.drawnItem === t.itemIndex || t.hasError) return null;
  const date = t.layer.kind === 'per-date' ? t.layer.items[t.itemIndex]?.date : undefined;
  return date ? `Loading the picture of ${date}…` : 'Loading the picture…';
}

/**
 * Not a live region: a screen reader hears the date from the stepper, and an announcement on every
 * step would be noise. It appears only after a short delay (styles.css), so a picture that loads at
 * once does not make it flicker; until then, and after, the tag above it names the picture on the
 * map.
 */
export function PictureLoading(props: { note: string | null }) {
  if (!props.note) return null;
  return (
    <p className="picture-loading" data-testid="picture-loading">
      {props.note}
    </p>
  );
}
