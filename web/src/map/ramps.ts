// Colour ramps and the cog:// URLs that draw a layer with them.
//
// Every ramp here survives the common forms of colour-blindness, and none puts red against green
// (docs/ARCHITECTURE.md). The legend draws the same stops, so legend and map always agree.

import { displayRangeToCodes, type CategoricalEncoding } from '../contract/encoding';
import type { Layer } from '../contract/manifest';

export const RAMPS: Record<string, readonly string[]> = {
  // Backscatter is a brightness, so it is shown as one: dark = weak echo, light = strong echo.
  grey: ['#000000', '#ffffff'],
  // Perceptually even and colour-blind safe (viridis stops), for other one-directional quantities.
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  // Diverging around a meaningful centre (for example 0 dB change): blue below, orange above.
  'blue-orange': ['#08519c', '#4292c6', '#c6dbef', '#f7f7f7', '#fdd0a2', '#f16913', '#8c2d04'],
  // Diverging blue to red (ColorBrewer RdBu reversed). Red against blue is safe; red against green is not.
  'blue-red': ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'],
  // ColorBrewer ramps under the names the cog protocol uses, so a manifest written with those names
  // draws the same colours here. Only colour-blind-safe ones are listed; colours from ColorBrewer
  // 2.0 by Cynthia Brewer (colorbrewer2.org, Apache-2.0). Note BrewerGreys9 runs WHITE to black,
  // so with it the lowest values look brightest.
  BrewerGreys9: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
  BrewerPuOr11: ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'],
  BrewerRdBu11: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'],
  BrewerBrBG11: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
};

const ALIASES: Record<string, string> = { gray: 'grey', greys: 'grey', greyscale: 'grey', grayscale: 'grey' };

export const DEFAULT_RAMP = 'grey';
export const DEFAULT_DIVERGING_RAMP = 'blue-orange';

/** The stops for a layer: its named ramp if the app knows it, else a default by kind of scale. */
export function rampFor(layer: Pick<Layer, 'display'>): readonly string[] {
  const asked = layer.display?.ramp;
  if (asked) {
    const lower = asked.toLowerCase();
    const known = RAMPS[asked] ?? RAMPS[ALIASES[lower] ?? lower];
    if (known) return known;
  }
  return RAMPS[layer.display?.diverging ? DEFAULT_DIVERGING_RAMP : DEFAULT_RAMP] ?? ['#000000', '#ffffff'];
}

/**
 * The ramp limits a cog:// URL needs, in the file's own units.
 * They start as pixel codes (1..255) from the layer's display range. If the file also declares a
 * GDAL scale and offset, the protocol applies them before comparing with the limits, so the limits
 * must go through the same conversion; with the contract's plain codes (scale 1, offset 0) this
 * changes nothing.
 */
export function rampLimits(
  layer: Pick<Layer, 'display' | 'encoding'>,
  file: { scale: number; offset: number } = { scale: 1, offset: 0 },
): { min: number; max: number; reversed: boolean } {
  if (layer.encoding.type !== 'linear-uint8') return { min: 1, max: 255, reversed: false };
  const display = layer.display ?? { min: layer.encoding.lo, max: layer.encoding.hi };
  const codes = displayRangeToCodes(display, layer.encoding);
  const a = file.offset + codes.min * file.scale;
  const b = file.offset + codes.max * file.scale;
  return a <= b ? { min: a, max: b, reversed: codes.reversed } : { min: b, max: a, reversed: !codes.reversed };
}

/**
 * The raster source URL for one file of a layer.
 * Linear layers: `cog://<absolute url>#color:<stops>,<min>,<max>,c` where `c` makes the ramp
 * continuous (without it the protocol draws stepped classes) and `-` reverses it.
 * Categorical layers: plain `cog://<url>`; their colours come from a colour function instead.
 */
export function cogSourceUrl(absoluteUrl: string, layer: Pick<Layer, 'display' | 'encoding'>, file?: { scale: number; offset: number }): string {
  if (layer.encoding.type !== 'linear-uint8') return `cog://${absoluteUrl}`;
  const { min, max, reversed } = rampLimits(layer, file);
  const stops = JSON.stringify(rampFor(layer));
  return `cog://${absoluteUrl}#color:${stops},${min},${max},${reversed ? 'c-' : 'c'}`;
}

/** #rrggbb -> [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A lookup table code -> RGBA for a categorical encoding: class colours, everything else
 * (nodata and codes without a class) transparent.
 */
export function classColorTable(enc: CategoricalEncoding): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  for (const cls of enc.classes) {
    const [r, g, b] = hexToRgb(cls.color);
    table.set([r, g, b, 255], cls.value * 4);
  }
  return table;
}
