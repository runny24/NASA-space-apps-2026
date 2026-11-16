// Reading a place's whole history from a click-query stack: one multi-band GeoTIFF per layer,
// one band per date, pixel-interleaved, so a single small range request returns every date.
//
// Tested idiom (research/digests/cog.md, section 11.3 and recommendation R5): open the file once with
// fromUrl(url, OPEN_OPTIONS) (2 requests on the first click instead of 9, repeats free),
// keep the full-resolution image, and per click read a 1 x 1 window with interleave: true.
// geotiff.js returns the stored codes; decoding uses the stack's own encoding from the manifest.

import { fromUrl, type BlockedSourceOptions, type GeoTIFFImage, type RemoteSourceOptions } from 'geotiff';
import { clippedSide, decodeLinear, describeCode, type ClippedSide } from '../contract/encoding';
import type { Layer, Site, Stack } from '../contract/manifest';

const EARTH_RADIUS = 6378137; // the sphere Web Mercator (EPSG:3857) is defined on

/** Longitude/latitude in degrees -> Web Mercator metres. */
export function lonLatToMercator(lon: number, lat: number): [number, number] {
  const x = ((lon * Math.PI) / 180) * EARTH_RADIUS;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * EARTH_RADIUS;
  return [x, y];
}

export interface GridInfo {
  /** Top-left corner of the top-left pixel, metres. */
  origin: [number, number];
  /** Pixel size in metres; y is negative for a north-up image. */
  resolution: [number, number];
  width: number;
  height: number;
}

/** The pixel (column, row) that contains a lon/lat point, or null when it is outside the file. */
export function pixelIndex(grid: GridInfo, lon: number, lat: number): { col: number; row: number } | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) >= 85.06) return null;
  const [x, y] = lonLatToMercator(lon, lat);
  const col = Math.floor((x - grid.origin[0]) / grid.resolution[0]);
  const row = Math.floor((y - grid.origin[1]) / grid.resolution[1]);
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height) return null;
  return { col, row };
}

const images = new Map<string, Promise<GeoTIFFImage>>();

// 16 KiB blocks: the first click on a stack costs 2 requests (header, then the pixel's tile).
// geotiff 3.0.5 accepts blockSize at run time but leaves it out of fromUrl's declared type.
const OPEN_OPTIONS: RemoteSourceOptions & BlockedSourceOptions = { blockSize: 16384 };

function openImage(url: string): Promise<GeoTIFFImage> {
  let image = images.get(url);
  if (!image) {
    image = fromUrl(url, OPEN_OPTIONS).then((tiff) => tiff.getImage(0)); // image 0 = full resolution
    // Forget a failed open so the next click can try again.
    image.catch(() => images.delete(url));
    images.set(url, image);
  }
  return image;
}

/**
 * The stored codes of every band at a point (one per date), or null when the point is outside the
 * file. Code 0 means nodata on that date.
 */
export async function readStackCodes(url: string, lon: number, lat: number): Promise<number[] | null> {
  const image = await openImage(url);
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  const grid: GridInfo = {
    origin: [ox ?? 0, oy ?? 0],
    resolution: [rx ?? 1, ry ?? -1],
    width: image.getWidth(),
    height: image.getHeight(),
  };
  const px = pixelIndex(grid, lon, lat);
  if (!px) return null;
  const data = await image.readRasters({ window: [px.col, px.row, px.col + 1, px.row + 1], interleave: true });
  return Array.from(data as ArrayLike<number>);
}

export interface HistoryPoint {
  date: string;
  /** Physical value, or null for nodata (a gap, never 0). */
  value: number | null;
  text: string;
  /** Set when the stored code is an end of the encoded range: the value is a bound, not exact. */
  clipped?: ClippedSide;
}

/**
 * The stack to chart for a layer: its own; otherwise the stack of a layer with the same
 * polarization (a static map drawn from HV charts the HV history, not the first stack's); otherwise
 * the site's first one. The panel titles the history with the charted stack's own layer, so it
 * always says which one is shown.
 */
export function stackFor(site: Site, layer: Layer | null): Stack | undefined {
  const own = site.stacks.find((s) => s.layer === layer?.id);
  if (own) return own;
  const polarization = layer?.polarization;
  const samePolarization =
    polarization === undefined ? undefined : site.stacks.find((s) => site.layers.find((l) => l.id === s.layer)?.polarization === polarization);
  return samePolarization ?? site.stacks[0];
}

/** Stack codes -> points with physical values, one per band date. */
export function historyPoints(stack: Stack, codes: number[] | null, unit: string): HistoryPoint[] {
  return stack.band_dates.map((date, i) => {
    const code = codes ? (codes[i] ?? 0) : 0;
    const value = stack.encoding.type === 'linear-uint8' ? decodeLinear(code, stack.encoding) : null;
    const point: HistoryPoint = { date, value, text: describeCode(code, stack.encoding, unit) };
    const side = clippedSide(code, stack.encoding);
    if (side) point.clipped = side;
    return point;
  });
}
