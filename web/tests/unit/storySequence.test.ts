// What a step of the guided story plays (src/story/sequence.ts: stepSequence, frameState,
// sequenceLabel, buildClock, clockDay, capsAt), on the SYNTHETIC fixture manifest and copies of it,
// and once on the published data of Tarn Taran with its real fire detections. Honesty test 2 of
// docs/MOTION_AND_STORY_BRIEF.md at its root: at every tick of a build, the cap gives one window,
// and the caption's count, the points drawn and the map's filter all come from it.

import { readFileSync } from 'node:fs';
import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import type { Manifest, Overlay, Site, StoryStep } from '../../src/contract/manifest';
import { readOverlay, type OverlayPoint } from '../../src/contract/overlay';
import { overlayFilter, overlaySourceData } from '../../src/map/overlayLayers';
import { addDays, capWindow, overlayWindow, pointsInWindow, type OverlayWindow } from '../../src/state/overlayPeriod';
import { overlayView, type OverlayLoad } from '../../src/state/overlayView';
import { dayNumber } from '../../src/state/timeline';
import { buildClock, capsAt, clockDay, frameState, sequenceLabel, stepSequence, type StepSequence } from '../../src/story/sequence';
import { planStep, stepStates, storySteps, type StepPlan, type StepState } from '../../src/story/storyModel';
import {
  buildManifest,
  OVERLAY_DATE_PROPERTY,
  OVERLAY_DATE_RANGE,
  OVERLAY_ID,
  overlayBytes,
  pointsDated,
  STORY_MIDYEAR_DATE,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_SITE_ID,
} from '../fixtures/synthetic.mjs';

const fixture = () => buildManifest() as unknown as Manifest;
const yearOf = (manifest: Manifest) => manifest.sites.find((s) => s.id === YEAR_SITE_ID)!;
const year = yearOf(fixture());
const hh = year.layers.find((l) => l.id === YEAR_LAYERS.hh)!;
const hhAt = (date: string) => hh.items.findIndex((it) => it.date === date);
const LAST_HV = YEAR_HV_DATES[YEAR_HV_DATES.length - 1]!;
const RANGE_END = OVERLAY_DATE_RANGE[1] as string;

const loaded: OverlayLoad = { status: 'ready', loaded: readOverlay(JSON.parse(new TextDecoder().decode(overlayBytes())), OVERLAY_DATE_PROPERTY) };
const POINTS = loaded.status === 'ready' ? loaded.loaded.points : [];
const ready = () => loaded;
const notYet = () => undefined;

/** The sequence each step of `site`'s story plays when reached from the step before (null for a cut). */
function sequences(manifest: Manifest, site: Site): { plans: StepPlan[]; states: StepState[]; sequences: (StepSequence | null)[] } {
  const steps = storySteps(site);
  const states = stepStates(manifest, site);
  const plans = steps.map((step, i) => planStep(i > 0 ? { step: steps[i - 1]!, state: states[i - 1]! } : null, { step, state: states[i]! }, site));
  return { plans, states, sequences: plans.map(stepSequence) };
}

/** The fixture with the cover on an earlier date: Next from it plays the passes up to the mid-year step's (as e2e/story.spec.ts serves it). */
function withCoverOn(date: string): { manifest: Manifest; site: Site } {
  const manifest = fixture();
  const site = yearOf(manifest);
  (site.story![0] as StoryStep).date = date;
  return { manifest, site };
}

/** How many points MapLibre's own filter evaluator lets through `window`'s layer filter. */
function filterCount(points: readonly OverlayPoint[], window: OverlayWindow): number {
  const filter = overlayFilter(window);
  const passes = filter === null ? () => true : featureFilter(filter, 'layers[0].filter').filter;
  return overlaySourceData(points).features.filter((f) => passes({ zoom: 10 }, { type: 1, properties: f.properties ?? {}, id: f.id } as never)).length;
}

describe('stepSequence: what a plan plays', () => {
  const plan = (frames: number[] | null, buildOverlays: string[] = []): StepPlan => ({ camera: { bounds: [0, 0, 1, 1] }, frames, buildOverlays, classes: null });

  it('a cut (no frames, nothing to build) plays nothing', () => {
    expect(stepSequence(plan(null))).toBeNull();
  });
  it('fewer than two frames is a cut', () => {
    expect(stepSequence(plan([3]))).toBeNull();
    expect(stepSequence(plan([]))).toBeNull();
    expect(stepSequence(plan([3], ['fires']))).toEqual({ frames: null, build: ['fires'] });
  });
  it('keeps the frames in order and the overlays to build, as copies', () => {
    const frames = [4, 5, 7];
    const build = ['fires'];
    const sequence = stepSequence(plan(frames, build))!;
    expect(sequence).toEqual({ frames: [4, 5, 7], build: ['fires'] });
    frames.push(9);
    build.push('other');
    expect(sequence).toEqual({ frames: [4, 5, 7], build: ['fires'] });
  });

  it('on the fixture story: the cover and the two steps after it are cuts; the last step builds the points', () => {
    const manifest = fixture();
    expect(sequences(manifest, yearOf(manifest)).sequences).toEqual([null, null, null, { frames: null, build: [OVERLAY_ID] }]);
  });

  it('with the cover moved to an earlier date: the mid-year step plays every pass after it, missing passes skipped, ending on its own', () => {
    const cover = YEAR_DATES[7]!;
    const { manifest, site } = withCoverOn(cover);
    const { sequences: all, states } = sequences(manifest, site);
    const passes = YEAR_DATES.filter((d) => d > cover && d <= STORY_MIDYEAR_DATE!);
    expect(passes.length).toBeGreaterThanOrEqual(4);
    expect(all[1]).toEqual({ frames: passes.map(hhAt), build: [] });
    expect(all[1]!.frames!.at(-1)).toBe(states[1]!.itemIndex);
  });
});

describe('frameState: what the map shows while a frame is up', () => {
  const final: StepState = { layerId: YEAR_LAYERS.hh, itemIndex: 20, overlays: [OVERLAY_ID, 'other'] };

  it("shows each frame's item, with the overlays still to build left off", () => {
    const sequence: StepSequence = { frames: [17, 18, 20], build: [OVERLAY_ID] };
    expect(frameState(final, sequence, 0)).toEqual({ layerId: YEAR_LAYERS.hh, itemIndex: 17, overlays: ['other'] });
    expect(frameState(final, sequence, 2)).toEqual({ layerId: YEAR_LAYERS.hh, itemIndex: 20, overlays: ['other'] });
  });
  it("past the last frame, the step's own item", () => {
    expect(frameState(final, { frames: [17, 18, 20], build: [] }, 7).itemIndex).toBe(20);
  });
  it('without frames (a build alone): the step itself, its overlays on (they are capped instead)', () => {
    expect(frameState(final, { frames: null, build: [OVERLAY_ID] }, 0)).toEqual(final);
  });
  it('never changes the state it is given', () => {
    const copy = structuredClone(final);
    frameState(final, { frames: [17, 20], build: [OVERLAY_ID] }, 0);
    expect(final).toEqual(copy);
  });
});

describe('sequenceLabel: the button of a sequence that did not start by itself', () => {
  it('offers the passes by their number, or the days, and "Play again" once played', () => {
    expect(sequenceLabel({ frames: [1, 2, 3, 4, 5], build: [] }, false)).toBe('Play these 5 passes');
    expect(sequenceLabel({ frames: [1, 2], build: [OVERLAY_ID] }, false)).toBe('Play these 2 passes');
    expect(sequenceLabel({ frames: null, build: [OVERLAY_ID] }, false)).toBe('Play day by day');
    expect(sequenceLabel({ frames: [1, 2], build: [] }, true)).toBe('Play again');
    expect(sequenceLabel({ frames: null, build: [OVERLAY_ID] }, true)).toBe('Play again');
  });
});

describe('buildClock, clockDay and capsAt on the fixture', () => {
  const manifest = fixture();
  const states = stepStates(manifest, year);
  const last = states[3]!;

  it('the points on the last pass: from it to the end of their range, one day per tick', () => {
    const clock = buildClock(year, last, [OVERLAY_ID], ready)!;
    expect(clock.first).toBe(LAST_HV);
    expect(clock.days).toBe(dayNumber(RANGE_END) - dayNumber(LAST_HV) + 1);
    expect(clock.days).toBeGreaterThanOrEqual(10);
    expect([...clock.periods]).toEqual([[OVERLAY_ID, { first: LAST_HV, last: RANGE_END }]]);
  });

  it('needs no file when the window has an end; builds nothing for an overlay it is not asked for', () => {
    expect(buildClock(year, last, [OVERLAY_ID], notYet)).toEqual(buildClock(year, last, [OVERLAY_ID], ready));
    expect(buildClock(year, last, ['no-such-overlay'], ready)).toBeNull();
    expect(buildClock(year, last, [], ready)).toBeNull();
  });

  it('without a date_range, the last pass has no end until the file says where its points end; a file that failed builds nothing', () => {
    const copy = fixture();
    const site = yearOf(copy);
    delete (site.overlays![0] as Partial<Overlay>).date_range;
    expect(buildClock(site, last, [OVERLAY_ID], notYet)).toBeNull();
    expect(buildClock(site, last, [OVERLAY_ID], () => ({ status: 'loading' }))).toBeNull();
    expect(buildClock(site, last, [OVERLAY_ID], () => ({ status: 'error', message: 'SYNTHETIC failure' }))).toBeNull();
    const latest = POINTS.map((p) => p.day!).sort().at(-1)!;
    expect(buildClock(site, last, [OVERLAY_ID], ready)).toMatchObject({ first: LAST_HV, days: dayNumber(latest) - dayNumber(LAST_HV) + 1 });
  });

  it('a static layer builds the overlay over its whole range', () => {
    const clock = buildClock(year, states[2]!, [OVERLAY_ID], ready)!;
    expect(clock).toMatchObject({ first: OVERLAY_DATE_RANGE[0], days: dayNumber(RANGE_END) - dayNumber(OVERLAY_DATE_RANGE[0] as string) + 1 });
  });

  it('a pass whose period lies wholly before the range builds nothing (no data stays no data)', () => {
    const early = { ...last, layerId: YEAR_LAYERS.hh, itemIndex: hhAt(YEAR_DATES[0]!) };
    expect(buildClock(year, early, [OVERLAY_ID], ready)).toBeNull();
  });

  it('clockDay counts real calendar days from the first and is held to the calendar', () => {
    const clock = buildClock(year, last, [OVERLAY_ID], ready)!;
    expect(clockDay(clock, 0)).toBe(LAST_HV);
    expect(clockDay(clock, 1)).toBe(addDays(LAST_HV, 1));
    expect(clockDay(clock, 2.7)).toBe(addDays(LAST_HV, 2));
    expect(clockDay(clock, clock.days - 1)).toBe(RANGE_END);
    expect(clockDay(clock, clock.days + 5)).toBe(RANGE_END);
    expect(clockDay(clock, -3)).toBe(LAST_HV);
  });

  it('at every tick the cap gives one window: the count it captions, the points drawn and the filter agree, never go down, and end on every point', () => {
    const overlay = year.overlays!.find((o) => o.id === OVERLAY_ID)!;
    const layer = year.layers.find((l) => l.id === last.layerId)!;
    const clock = buildClock(year, last, [OVERLAY_ID], ready)!;
    let before = 0;
    for (let tick = 0; tick < clock.days; tick++) {
      const cap = capsAt(clock, tick).get(OVERLAY_ID)!;
      const day = clockDay(clock, tick);
      expect(cap).toEqual({ first: LAST_HV, upTo: day });
      const view = overlayView(overlay, loaded, layer, last.itemIndex, '#c000ff', cap);
      const count = pointsDated(LAST_HV, day);
      expect(view.drawn.length, day).toBe(count);
      expect(filterCount(POINTS, view.window), day).toBe(count);
      expect(view.caption, day).toMatch(new RegExp(`: ${count}$`));
      expect(count, day).toBeGreaterThan(before);
      before = count;
    }
    expect(before).toBe(pointsDated(LAST_HV, RANGE_END));
    expect(overlayView(overlay, loaded, layer, last.itemIndex, '#c000ff', capsAt(clock, clock.days - 1).get(OVERLAY_ID)).caption).toBe(
      overlayView(overlay, loaded, layer, last.itemIndex, '#c000ff').caption,
    );
  });

  it('two overlays: each from its own first day to the calendar day, never past its own last; one not begun yet shows nothing', () => {
    const clock = { first: '2026-10-01', days: 20, periods: new Map([['a', { first: '2026-10-01', last: '2026-10-20' }], ['b', { first: '2026-10-08', last: '2026-10-12' }]]) };
    expect(Object.fromEntries(capsAt(clock, 3))).toEqual({ a: { first: '2026-10-01', upTo: '2026-10-04' }, b: { first: '2026-10-08', upTo: '2026-10-04' } });
    expect(Object.fromEntries(capsAt(clock, 9))).toEqual({ a: { first: '2026-10-01', upTo: '2026-10-10' }, b: { first: '2026-10-08', upTo: '2026-10-10' } });
    expect(Object.fromEntries(capsAt(clock, 19))).toEqual({ a: { first: '2026-10-01', upTo: '2026-10-20' }, b: { first: '2026-10-08', upTo: '2026-10-12' } });
    // Before its first day "b" has an empty period: no point, a count of 0, a filter that lets none through.
    const window: OverlayWindow = { kind: 'dated', wanted: { first: '2026-10-08', last: '2026-10-12' }, used: { first: '2026-10-08', last: '2026-10-12' }, clippedStart: false, clippedEnd: false, rangeKnown: true };
    const points: OverlayPoint[] = ['2026-10-08', '2026-10-10', '2026-10-12'].map((day, index) => ({ index, lon: 0, lat: 0, day, properties: {} }));
    const early = capWindow(window, capsAt(clock, 3).get('b'));
    expect(pointsInWindow(points, early)).toEqual([]);
    expect(filterCount(points, early)).toBe(0);
    expect(pointsInWindow(points, capWindow(window, capsAt(clock, 9).get('b'))).length).toBe(2);
  });
});

describe('on the published data of Tarn Taran, with its real fire detections', () => {
  const data = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
  const manifest = data('manifest.json') as Manifest;
  const site = manifest.sites.find((s) => s.id === 'tarn-taran')!;
  const fires = site.overlays!.find((o) => o.id === 'fires')!;
  const geojson = data('tarn-taran/fires.geojson') as { features: { properties: Record<string, unknown> }[] };
  const fireLoad: OverlayLoad = { status: 'ready', loaded: readOverlay(geojson, fires.date_property) };
  const points = fireLoad.status === 'ready' ? fireLoad.loaded.points : [];
  // The two steps of the site file's story (pipeline/sites/tarn-taran.yaml) that the build depends
  // on: the harvest map alone, then the harvest map with the fire detections. The published manifest
  // carries no story until the lead builder exports it, so they are given here, words left out.
  const story: StoryStep[] = [
    { id: 'the-wave', title: 'The harvest wave', text: 'Words left out.', layer: 'harvest-wave' },
    { id: 'the-fires', title: 'The fires', text: 'Words left out.', layer: 'harvest-wave', overlays: ['fires'] },
  ];
  const told = { ...site, story } as Site;
  const withStory = { ...manifest, sites: manifest.sites.map((s) => (s.id === site.id ? told : s)) } as Manifest;

  it("the fire step builds the detections; its clock is 61 days from 15 September 2026, and every tick's count is the window's, the file's and the filter's", () => {
    const { sequences: all, states } = sequences(withStory, told);
    expect(all).toEqual([null, { frames: null, build: ['fires'] }]);
    const state = states[1]!;
    const clock = buildClock(told, state, ['fires'], () => fireLoad)!;
    expect(clock.first).toBe('2026-09-15');
    expect(clock.days).toBe(61);
    expect(clockDay(clock, 60)).toBe('2026-11-14');
    const layer = told.layers.find((l) => l.id === state.layerId)!;
    let before = 0;
    for (let tick = 0; tick < clock.days; tick++) {
      const cap = capsAt(clock, tick).get('fires')!;
      const window = capWindow(overlayWindow(fires, layer, state.itemIndex), cap);
      const count = pointsInWindow(points, window).length;
      const view = overlayView(fires, fireLoad, layer, state.itemIndex, '#c000ff', cap);
      const day = clockDay(clock, tick);
      // Counted straight from the file's own dates, not through the app's code.
      const inFile = geojson.features.filter((f) => {
        const d = f.properties[fires.date_property!];
        return typeof d === 'string' && d >= '2026-09-15' && d <= day;
      }).length;
      expect(view.drawn.length, day).toBe(count);
      expect(count, day).toBe(inFile);
      expect(filterCount(points, view.window), day).toBe(count);
      expect(view.caption, day).toMatch(new RegExp(`: ${count}$`));
      expect(count, day).toBeGreaterThanOrEqual(before);
      before = count;
    }
    expect(before).toBe(pointsInWindow(points, overlayWindow(fires, layer, state.itemIndex)).length);
    expect(before).toBe(fires.count);
  });
});
