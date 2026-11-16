// "What is here?": the value of the active layer at a clicked point, and the point's history across
// all dates from the site's click-query stack.

import { describeCode } from '../contract/encoding';
import type { Layer, LayerItem, Site } from '../contract/manifest';
import { resolveDataUrl } from '../contract/manifest';
import { cog } from './maplibre';
import { historyPoints, readStackCodes, stackFor, type HistoryPoint } from './stackQuery';

export interface InspectResult {
  lon: number;
  lat: number;
  /** The active layer at this point, e.g. "-12.3 dB" or "no data". */
  valueText: string | null;
  /** What the value refers to: a date, a pair of dates, or the whole series. */
  valueWhen: string;
  valueError?: string;
  history?: {
    layerTitle: string;
    unit: string;
    resolutionM: number;
    points: HistoryPoint[];
    /** true when the categorical stack cannot be charted as a line */
    categorical: boolean;
  };
  historyError?: string;
}

export function itemWhen(layer: Layer, item: LayerItem | undefined): string {
  if (!item) return '';
  if (layer.kind === 'per-date') return item.date ?? '';
  if (layer.kind === 'pair') return `${item.reference} to ${item.secondary}`;
  return 'whole series';
}

/** Turn a value from the cog protocol back into the file's code (undoing any GDAL scale/offset). */
function protocolValueToCode(value: number, file: { scale: number; offset: number }): number | null {
  if (Number.isNaN(value)) return null; // the protocol's way of saying nodata or outside the file
  return Math.round((value - file.offset) / file.scale);
}

export async function inspectPoint(opts: {
  site: Site;
  layer: Layer | null;
  itemIndex: number;
  manifestHref: string;
  lon: number;
  lat: number;
}): Promise<InspectResult> {
  const { site, layer, itemIndex, manifestHref, lon, lat } = opts;
  const result: InspectResult = { lon, lat, valueText: null, valueWhen: '' };
  const item = layer?.items[itemIndex];
  const tasks: Promise<void>[] = [];

  if (layer && item) {
    result.valueWhen = itemWhen(layer, item);
    const url = resolveDataUrl(item.url, manifestHref);
    tasks.push(
      (async () => {
        try {
          // Same plain URL as the displayed layer, so the protocol answers from the tile it already has.
          const [value] = await cog.locationValues(url, { latitude: lat, longitude: lon });
          const meta = await cog.getCogMetadata(url);
          const code = protocolValueToCode(value ?? NaN, meta);
          result.valueText = describeCode(code, layer.encoding, layer.unit);
        } catch (err) {
          result.valueError = err instanceof Error ? err.message : String(err);
        }
      })(),
    );
  }

  const stack = stackFor(site, layer);
  if (stack) {
    const stackLayer = site.layers.find((l) => l.id === stack.layer);
    const unit = stackLayer?.unit ?? '';
    tasks.push(
      (async () => {
        try {
          const codes = await readStackCodes(resolveDataUrl(stack.url, manifestHref), lon, lat);
          result.history = {
            layerTitle: stackLayer?.title ?? stack.layer,
            unit,
            resolutionM: stack.resolution_m,
            points: historyPoints(stack, codes, unit),
            categorical: stack.encoding.type !== 'linear-uint8',
          };
        } catch (err) {
          result.historyError = err instanceof Error ? err.message : String(err);
        }
      })(),
    );
  }
  await Promise.all(tasks);
  return result;
}
