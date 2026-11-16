// Finding, loading and sanity-checking manifest.json, the only thing the app knows about the data.
//
// The full JSON Schema check lives in the tests (ajv) and in `python -m pipeline validate`. Here a
// small hand-written guard checks only the fields this app relies on, so a broken or outdated
// manifest gives a clear message instead of a blank page or a crash deep inside the map code.

import type { DataManifest, Encoding, Layer, LayerItem, Overlay, Site, Stack, StoryStep } from './manifest.generated';

export type { DataManifest as Manifest, Encoding, Layer, LayerItem, Overlay, Site, Stack, StoryStep };

export const DEFAULT_MANIFEST_PATH = 'data/manifest.json';

/**
 * Where to load the manifest from, as an absolute URL.
 * Order: a same-origin `?manifest=` parameter (development builds only, so a deployed site cannot be
 * pointed at someone else's data by a link), then the build-time VITE_MANIFEST_URL, then the default.
 * Relative paths resolve against the page's base URI, so the app works under any path.
 */
export function manifestUrl(opts: { baseURI: string; search: string; envUrl?: string; dev: boolean }): string {
  if (opts.dev) {
    const param = new URLSearchParams(opts.search).get('manifest');
    if (param) {
      const candidate = new URL(param, opts.baseURI);
      if (candidate.origin === new URL(opts.baseURI).origin) return candidate.href;
    }
  }
  return new URL(opts.envUrl || DEFAULT_MANIFEST_PATH, opts.baseURI).href;
}

/** A URL from the manifest made absolute. URLs in the manifest are relative to the manifest itself. */
export function resolveDataUrl(url: string, manifestHref: string): string {
  return new URL(url, manifestHref).href;
}

export type GuardResult = { ok: true; manifest: DataManifest } | { ok: false; problems: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkEncoding(enc: unknown, where: string, problems: string[]) {
  if (!isObject(enc)) return void problems.push(`${where}: missing encoding`);
  if (enc.type === 'linear-uint8') {
    if (!isNumber(enc.lo) || !isNumber(enc.hi) || enc.lo === enc.hi) problems.push(`${where}: linear encoding needs two different numbers lo and hi`);
  } else if (enc.type === 'categorical-uint8') {
    if (!Array.isArray(enc.classes) || enc.classes.length === 0) problems.push(`${where}: categorical encoding needs classes`);
    else
      enc.classes.forEach((c, i) => {
        if (!isObject(c) || !isNumber(c.value) || !isString(c.label) || !isString(c.color) || !/^#[0-9a-fA-F]{6}$/.test(c.color))
          problems.push(`${where}.classes[${i}]: needs value, label and a #rrggbb color`);
      });
  } else problems.push(`${where}: unknown encoding type ${JSON.stringify(enc.type)}`);
}

function checkLayer(layer: unknown, where: string, problems: string[]) {
  if (!isObject(layer)) return void problems.push(`${where}: not an object`);
  for (const key of ['id', 'title', 'unit', 'description'] as const)
    if (!isString(layer[key])) problems.push(`${where}.${key}: missing or not text`);
  if (layer.kind !== 'per-date' && layer.kind !== 'pair' && layer.kind !== 'static')
    problems.push(`${where}.kind: must be per-date, pair or static`);
  checkEncoding(layer.encoding, `${where}.encoding`, problems);
  const display = layer.display;
  if (display !== undefined) {
    if (!isObject(display) || !isNumber(display.min) || !isNumber(display.max)) problems.push(`${where}.display: needs numbers min and max`);
    // The legend labels the ends "or less" and "or more" in that order, so a reversed range would
    // label them the wrong way round. The pipeline refuses one too.
    else if (display.min >= display.max) problems.push(`${where}.display: min (${display.min}) must be less than max (${display.max})`);
  }
  if (!Array.isArray(layer.items)) return void problems.push(`${where}.items: missing`);
  layer.items.forEach((item, i) => {
    const at = `${where}.items[${i}]`;
    if (!isObject(item) || !isString(item.url)) return void problems.push(`${at}: needs a url`);
    if (layer.kind === 'per-date' && !(isString(item.date) && DATE.test(item.date))) problems.push(`${at}: needs a date`);
    if (layer.kind === 'pair' && !(isString(item.reference) && isString(item.secondary)))
      problems.push(`${at}: needs reference and secondary dates`);
  });
  if (layer.kind === 'static' && layer.items.length !== 1) problems.push(`${where}.items: a static layer has exactly one item`);
}

/** The map throws on a centre it cannot show, which would take the whole page down. */
function checkView(view: unknown, where: string, problems: string[]) {
  if (!isObject(view)) return void problems.push(`${where}: not an object`);
  const [lon, lat] = Array.isArray(view.center) && view.center.length === 2 ? (view.center as unknown[]) : [];
  if (!isNumber(lon) || !isNumber(lat)) problems.push(`${where}.center: needs [longitude, latitude]`);
  else if (Math.abs(lon) > 180 || Math.abs(lat) > 85)
    problems.push(`${where}.center: [${lon}, ${lat}] is off the map (longitude -180 to 180, latitude -85 to 85)`);
  if (!(isNumber(view.zoom) && view.zoom >= 0 && view.zoom <= 22)) problems.push(`${where}.zoom: needs a number from 0 to 22`);
}

function checkSite(site: unknown, where: string, problems: string[]) {
  if (!isObject(site)) return void problems.push(`${where}: not an object`);
  if (!isString(site.id)) problems.push(`${where}.id: missing`);
  if (!isString(site.title)) problems.push(`${where}.title: missing`);
  if (!Array.isArray(site.bounds) || site.bounds.length !== 4 || !site.bounds.every(isNumber))
    problems.push(`${where}.bounds: needs [west, south, east, north]`);
  if (site.is_sample === true && !isString(site.notice)) problems.push(`${where}.notice: a sample site must carry a notice`);
  if (!Array.isArray(site.dates) || !site.dates.every((d) => isObject(d) && isString(d.date) && DATE.test(d.date)))
    problems.push(`${where}.dates: needs a list of acquisitions with dates`);
  if (!Array.isArray(site.missing_passes) || !site.missing_passes.every((m) => isObject(m) && isString(m.date) && isString(m.reason)))
    problems.push(`${where}.missing_passes: needs a list of {date, reason}`);
  if (!isObject(site.source)) problems.push(`${where}.source: missing`);
  if (site.view !== undefined) checkView(site.view, `${where}.view`, problems);
  if (!Array.isArray(site.layers)) problems.push(`${where}.layers: missing`);
  else site.layers.forEach((layer, i) => checkLayer(layer, `${where}.layers[${i}]`, problems));
  if (!Array.isArray(site.stacks)) problems.push(`${where}.stacks: missing`);
  else
    site.stacks.forEach((stack, i) => {
      const at = `${where}.stacks[${i}]`;
      if (!isObject(stack) || !isString(stack.layer) || !isString(stack.url) || !isNumber(stack.resolution_m))
        return void problems.push(`${at}: needs layer, url and resolution_m`);
      if (!Array.isArray(stack.band_dates) || !stack.band_dates.every(isString)) problems.push(`${at}.band_dates: missing`);
      checkEncoding(stack.encoding, `${at}.encoding`, problems);
    });
  if (site.stats !== undefined && !isString(site.stats)) problems.push(`${where}.stats: must be a URL`);
}

/** Check the parts of a parsed manifest.json that the app depends on. */
export function checkManifest(json: unknown): GuardResult {
  const problems: string[] = [];
  if (!isObject(json)) return { ok: false, problems: ['manifest is not a JSON object'] };
  if (json.schema !== 1)
    return { ok: false, problems: [`manifest schema is ${JSON.stringify(json.schema)}; this app reads schema 1`] };
  if (!Array.isArray(json.sites)) problems.push('sites: missing');
  else json.sites.forEach((site, i) => checkSite(site, `sites[${i}]`, problems));
  return problems.length > 0 ? { ok: false, problems } : { ok: true, manifest: json as unknown as DataManifest };
}

/** Fetch and check the manifest. Throws an Error whose message is fit to show a person. */
export async function loadManifest(href: string, fetchFn: typeof fetch = fetch): Promise<DataManifest> {
  let response: Response;
  try {
    response = await fetchFn(href, { cache: 'no-cache' });
  } catch {
    throw new Error(`Could not reach ${href}. Check the network connection.`);
  }
  if (!response.ok) throw new Error(`Could not load ${href} (HTTP ${response.status}).`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    // A dev server answers a missing file with the app's own HTML page, which is not JSON.
    throw new Error(`${href} is not valid JSON.`);
  }
  const result = checkManifest(json);
  if (!result.ok) throw new Error(`The data manifest has problems:\n${result.problems.slice(0, 10).join('\n')}`);
  return result.manifest;
}
