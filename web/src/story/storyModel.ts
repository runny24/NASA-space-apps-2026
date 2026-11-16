// The guided story as data: what each step shows, how the map gets there, and the words the story
// puts on screen that come from the data (docs/MOTION_AND_STORY_BRIEF.md, section 7; the rules are
// in web/MOTION.md). Pure functions, unit-tested (tests/unit/storyModel.test.ts); the state machine
// is story/useStory.ts and everything done to the map is story/stage.ts.
//
// The steps are the site's `story` in the manifest (contract rule 12). Nothing here is keyed on a
// step's id or on a site: the same rules run every story.

import type { Layer, Manifest, Site, StoryStep } from '../contract/manifest';
import type { PictureOnMap } from '../map/dataLayers';
import { MAX_MAP_LATITUDE, MAX_ZOOM, MIN_ZOOM, wrapLongitude } from '../map/geo';
import { formatDay, formatPeriod, isDay } from '../state/overlayPeriod';
import { pairKey, resolveSelection, selectionToUrlState, type Selection, type UrlState } from '../state/urlState';
import type { StoryIntent } from './storyUrl';

export type { StoryStep };

/** What a step shows on the map: always valid for its site (resolveSelection made it). */
export interface StepState {
  /** The layer's id, or null when the site has no layer. */
  layerId: string | null;
  /** Index into that layer's items (-1 when it has none). */
  itemIndex: number;
  /** Ids of the overlays switched on, in the site's order. */
  overlays: string[];
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * The steps of a site's story, none when it has no story. The app's manifest guard does not check
 * the story (the pipeline does, contract rule 12), so a hand-edited one degrades quietly here: a step
 * without a text id, title or text is skipped, and a `story` that is not a list is no story.
 */
export function storySteps(site: Site | null | undefined): StoryStep[] {
  const story: unknown = site?.story;
  if (!Array.isArray(story)) return [];
  return story.filter((s): s is StoryStep => typeof s === 'object' && s !== null && isText(s.id) && isText(s.title) && isText(s.text));
}

/** Whether a site has a story to tell. */
export const hasStory = (site: Site | null | undefined): boolean => storySteps(site).length > 0;

/**
 * The step the story opens at for what the address asked: the step of that id, or the cover (0) for
 * the cover, an unknown id, or no intent to open.
 */
export function openingIndex(steps: readonly StoryStep[], intent: StoryIntent): number {
  const found = intent.kind === 'step' ? steps.findIndex((s) => s.id === intent.id) : -1;
  return found >= 0 ? found : 0;
}

/** A step's text as paragraphs: split at blank lines only, each trimmed, empty ones dropped. */
export function storyParagraphs(text: string): string[] {
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

const stateOf = (sel: Selection): StepState => ({ layerId: sel.layer?.id ?? null, itemIndex: sel.itemIndex, overlays: [...sel.overlays] });

/**
 * One state per step of the site's story, each valid for the site. Resolved once, by folding from
 * what the site opens with (its first layer, the newest date, no overlay): each step changes only
 * what it names and sets its overlays (none when it names none). So "a step without a layer keeps
 * the layer, a step without a date keeps the date" never depends on how the visitor got to the step:
 * Next, Back, a jump and a reload at `story=<id>` all show the same picture for it.
 *
 * A name the site lacks keeps what is shown (the story is checked by the pipeline, not by the app's
 * guard, so this only guards a hand-edited one): an unknown layer keeps the layer; a date the layer
 * lacks keeps the date shown when the layer has it, else its newest; a pair the layer lacks keeps
 * the pair shown, else its newest; an unknown overlay id is left out.
 */
export function stepStates(manifest: Manifest, site: Site): StepState[] {
  const start = resolveSelection(manifest, { site: site.id });
  if (!start || start.site.id !== site.id) return [];
  let url = selectionToUrlState(start);
  return storySteps(site).map((step) => {
    // Spread only what the step names: a key set to undefined would make resolveSelection fall back
    // to the first layer and the newest date.
    const next: UrlState = { ...url, overlays: Array.isArray(step.overlays) ? step.overlays : [] };
    if (step.layer && site.layers.some((l) => l.id === step.layer)) next.layer = step.layer;
    const layer = site.layers.find((l) => l.id === next.layer);
    if (step.date && layer?.kind === 'per-date' && layer.items.some((it) => it.date === step.date)) next.date = step.date;
    if (step.reference && step.secondary && layer?.kind === 'pair') {
      const pair = pairKey(step.reference, step.secondary);
      if (layer.items.some((it) => it.reference && it.secondary && pairKey(it.reference, it.secondary) === pair)) next.pair = pair;
    }
    const sel = resolveSelection(manifest, next) ?? start;
    url = selectionToUrlState(sel);
    return stateOf(sel);
  });
}

/** The app's selection for a step's state. */
export function stepSelection(site: Site, state: StepState): Selection {
  const layer = site.layers.find((l) => l.id === state.layerId) ?? null;
  return { site, layer, itemIndex: layer ? state.itemIndex : -1, overlays: [...state.overlays] };
}

/** Whether two selections show the same thing (the same site, layer, item and overlays). */
export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.site.id === b.site.id &&
    (a.layer?.id ?? null) === (b.layer?.id ?? null) &&
    a.itemIndex === b.itemIndex &&
    a.overlays.length === b.overlays.length &&
    a.overlays.every((id, i) => b.overlays[i] === id)
  );
}

/** Where the camera goes: a centre and zoom, or bounds to fit (with BOUNDS_PADDING_PX at run time). */
export type CameraTarget = { center: [number, number]; zoom: number } | { bounds: [number, number, number, number] };

/** How the story arrives at a step (rules 2 to 4 of section 7.3 of the brief). */
export interface StepPlan {
  /** Rule 2: the step's view, else the site's view, else the site's bounds. */
  camera: CameraTarget;
  /**
   * Rule 3, the flip-book: item indexes of the step's layer to show in turn, in date order, ending
   * on the step's own item; null for a cut straight to the step's state.
   */
  frames: number[] | null;
  /** Rule 4: overlays with a date_property that this step switches on (they were off before). */
  buildOverlays: string[];
  /** Rule 4: class values in manifest order, for a static layer with classes newly shown; else null. */
  classes: number[] | null;
}

const layerOf = (site: Site, id: string | null): Layer | undefined => (id === null ? undefined : site.layers.find((l) => l.id === id));

/**
 * A view made safe for the map, as a link's view is (state/urlState.ts): null when it is not a
 * centre of two finite numbers with a latitude the map can show and a finite zoom; the longitude
 * brought back from another copy of the world, the zoom held to the map's range. The map throws on a
 * latitude it cannot show, which would close the story.
 */
export function safeView(view: unknown): { center: [number, number]; zoom: number } | null {
  if (typeof view !== 'object' || view === null) return null;
  const { center, zoom } = view as { center?: unknown; zoom?: unknown };
  if (!Array.isArray(center) || center.length !== 2) return null;
  const [lon, lat] = center as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number' || typeof zoom !== 'number') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(zoom) || Math.abs(lat) > MAX_MAP_LATITUDE) return null;
  return { center: [wrapLongitude(lon), lat], zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) };
}

/**
 * Where the tool frames a site when it opens (MapView): the site's view, else its bounds (a view the
 * map cannot show counts as none). Closing the story from the cover gives the camera this, so a
 * visitor who skips the story starts where one who opens the tool directly does.
 */
export function siteCamera(site: Site): CameraTarget {
  return safeView(site.view) ?? { bounds: [...site.bounds] as [number, number, number, number] };
}

/** The date of the per-date item a state shows, or null (another kind of layer, or no item). */
function shownDate(site: Site, state: StepState): string | null {
  const layer = layerOf(site, state.layerId);
  const date = layer?.kind === 'per-date' ? layer.items[state.itemIndex]?.date : undefined;
  return isDay(date) ? date : null;
}

/**
 * How to arrive at `current` from `previous` (the step before, or null for the first step shown).
 * Works on the resolved states, so a previous step that kept its date from the one before counts
 * with that date.
 *
 * - camera (rule 2): `step.view`, else `site.view`, else `site.bounds` (a view the map cannot show
 *   counts as none: safeView).
 * - frames (rule 3): only when the step names a date, its layer is per-date and shows that very
 *   date, and the previous state shows a per-date item of an EARLIER date (on any per-date layer):
 *   the items of the step's own layer after that date up to the step's, in date order. Missing
 *   passes have no item, so they are skipped, as "Next date" skips them. Fewer than two frames, or
 *   any other case (no previous step, a pair or static layer, an equal or later date): null, a cut.
 * - buildOverlays (rule 4): the step's overlays that have a date_property and were off before;
 *   none without a previous step (the cover builds nothing).
 * - classes (rule 4): for a static layer with classes when the previous step showed another layer,
 *   the class values in the order the manifest lists them; else null.
 */
export function planStep(previous: { step: StoryStep; state: StepState } | null, current: { step: StoryStep; state: StepState }, site: Site): StepPlan {
  const { step, state } = current;
  const camera: CameraTarget = safeView(step.view) ?? safeView(site.view) ?? { bounds: [...site.bounds] as [number, number, number, number] };
  if (!previous) return { camera, frames: null, buildOverlays: [], classes: null };

  const layer = layerOf(site, state.layerId);
  let frames: number[] | null = null;
  const to = shownDate(site, state);
  const from = shownDate(site, previous.state);
  if (step.date && layer?.kind === 'per-date' && to === step.date && from !== null && from < to) {
    const order = layer.items
      .map((item, index) => ({ date: item.date, index }))
      .filter((e): e is { date: string; index: number } => isDay(e.date) && e.date > from && e.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((e) => e.index);
    frames = order.length >= 2 ? order : null;
  }

  const buildOverlays = state.overlays.filter(
    (id) => !previous.state.overlays.includes(id) && Boolean((site.overlays ?? []).find((o) => o.id === id)?.date_property),
  );

  const encoding = layer?.encoding;
  const classes =
    layer?.kind === 'static' && encoding?.type === 'categorical-uint8' && previous.state.layerId !== state.layerId ? encoding.classes.map((c) => c.value) : null;

  return { camera, frames, buildOverlays, classes };
}

/** One number of the cover and what it counts. */
export interface CoverFigure {
  value: string;
  label: string;
}

/**
 * The cover's figures, from the manifest alone, as plain numerals: the radar passes, the passes
 * missing, and each overlay's points. A figure whose source is absent is left out (and the missing
 * passes when there are none).
 */
export function coverFigures(site: Site): CoverFigure[] {
  const figures: CoverFigure[] = [];
  const passes = site.dates.length;
  if (passes > 0) figures.push({ value: String(passes), label: passes === 1 ? 'radar pass' : 'radar passes' });
  const missing = site.missing_passes.length;
  if (missing > 0) figures.push({ value: String(missing), label: missing === 1 ? 'pass missing, shown as missing' : 'passes missing, shown as missing' });
  for (const overlay of site.overlays ?? []) {
    if (typeof overlay.count === 'number' && Number.isFinite(overlay.count)) figures.push({ value: String(overlay.count), label: overlay.title });
  }
  return figures;
}

/**
 * The cover's eyebrow, one short line above the title: the place, which is the site's title up to its
 * first colon (the whole title when it has none), then the period from the first to the last
 * acquisition.
 */
export function coverEyebrow(site: Site): string {
  const colon = site.title.indexOf(':');
  const place = (colon >= 0 ? site.title.slice(0, colon) : site.title).trim() || site.title.trim();
  const days = site.dates.map((d) => d.date).filter(isDay).sort();
  const first = days[0];
  const last = days[days.length - 1];
  return first && last ? `${place} · ${formatPeriod({ first, last })}` : place;
}

/** "Step 3 of 9". */
export const stepCount = (index: number, total: number): string => `Step ${index + 1} of ${total}`;

/**
 * What the story's one polite live region says on entering a step: "Step 3 of 9: <title>".
 * Not the text: the panel holds it, and a long text read on every step would be noise.
 */
export function stepAnnouncement(steps: readonly StoryStep[], index: number): string {
  const step = steps[index];
  if (!step) return '';
  return `${stepCount(index, steps.length)}: ${step.title}`;
}

const day = (value: string | undefined): string | undefined => (isDay(value) ? formatDay(value) : value);

/** The name of a picture on the map: the layer's title and its date (or pair of dates). */
function pictureName(shown: PictureOnMap): string {
  const { layer } = shown;
  const item = layer.items[shown.index];
  if (layer.kind === 'per-date' && item?.date) return `${layer.title} · ${day(item.date)}`;
  if (layer.kind === 'pair' && item?.reference && item.secondary) return `${layer.title} · ${day(item.reference)} to ${day(item.secondary)}`;
  return layer.title;
}

/**
 * The story's date stamp, which names the picture the map has DRAWN (DataLayerController's
 * onPictureShown), never the date asked for: "HH backscatter · 25 June 2026", the pair of dates for
 * a pair layer, the title alone for a static layer; "No picture: <that name> could not be loaded"
 * when its file failed; "Loading the picture…" (no date) while the map has no picture of the layer
 * chosen; null when no layer is chosen (nothing to name).
 */
export function stampText(shown: PictureOnMap | null, layerChosen: boolean): string | null {
  if (!shown) return layerChosen ? 'Loading the picture…' : null;
  const name = pictureName(shown);
  return shown.failed ? `No picture: ${name} could not be loaded` : name;
}

/**
 * The ISO date of the picture drawn, for the stamp's data-drawn-date (so a test can compare it with
 * the file the map draws): only for a per-date picture that is on the map; undefined otherwise.
 */
export function stampDrawnDate(shown: PictureOnMap | null): string | undefined {
  if (!shown || shown.failed || shown.layer.kind !== 'per-date') return undefined;
  const date = shown.layer.items[shown.index]?.date;
  return isDay(date) ? date : undefined;
}
