// The guided story (docs/MOTION_AND_STORY_BRIEF.md, slices 1 to 3; the rules are in web/MOTION.md)
// on the SYNTHETIC year site, whose story has four steps: the co-pol layer without a date (the
// cover), a mid-year date with a view, the static class layer, and the cross-pol layer on its last
// pass with the points overlay and a view. Coming forward to the last step builds the points day by
// day over the eleven days of that pass's period.
// The tests of the flip-book serve the same story with the cover on an earlier date (SEQUENCE_STORY,
// in the test's browser only), so that Next from the cover plays the passes up to the mid-year date.
// Every id, date, title and view comes from the fixture module. Several tests come from the first
// guided tour's (pull request 4, e2e/tour.spec.ts, removed with the tour), where the brief keeps them.
//
// The honesty tests here (section 10 of the brief) are the point of the work: never weaken them later.

import { featureFilter } from '@maplibre/maplibre-gl-style-spec';
import type { Locator, Page } from '@playwright/test';
import { BRANDING } from '../src/branding';
import { MIXED_RELEASE_WARNING } from '../src/components/StatsPanel';
import { readOverlay } from '../src/contract/overlay';
import { overlayMapId, overlaySourceData } from '../src/map/overlayLayers';
import { PREVIOUS_PICTURE_LIMIT_MS } from '../src/map/switching';
import { formatDay, formatPeriod, OVERLAY_NOT_NISAR } from '../src/state/overlayPeriod';
import { PLAY_CEILING_MS } from '../src/state/playback';
import { dayNumber } from '../src/state/timeline';
import { stepAnnouncement } from '../src/story/storyModel';
import { COVER_SITE_OFFSET } from '../src/story/timing';
import {
  buildManifest,
  OVERLAY_DATE_PROPERTY,
  OVERLAY_DATE_RANGE,
  OVERLAY_ID,
  overlayBytes,
  pointsDated,
  SITE_ID,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_MISSING,
  YEAR_SITE_ID,
} from '../tests/fixtures/synthetic.mjs';
import { realLengthTexts } from './realLengths';
import { expect, openAt, test, waitForMapIdle } from './support';

interface Step {
  id: string;
  title: string;
  text: string;
  layer?: string;
  date?: string;
  overlays?: string[];
  view?: { center: [number, number]; zoom: number };
}
interface YearSite {
  id: string;
  title: string;
  bounds: [number, number, number, number];
  story: Step[];
  source: { citation: string; release: string };
  overlays: { id: string; title: string; credit: string; count: number }[];
  layers: { id: string; title: string }[];
}
const year = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)! as unknown as YearSite;
const STEPS = year.story;
const [FIRST, MIDYEAR, CLASSES] = STEPS as [Step, Step, Step, Step];
const OVERLAY = year.overlays.find((o) => o.id === OVERLAY_ID)!;
const LAST_HH = YEAR_DATES[YEAR_DATES.length - 1]!;
const LAST_HV = YEAR_HV_DATES[YEAR_HV_DATES.length - 1]!;
const COVER_EYEBROW = `${year.title} · ${formatPeriod({ first: YEAR_DATES[0]!, last: LAST_HH })}`;
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };

/** The file name the map draws for a date of a per-date layer (synthetic.mjs names them so). */
const file = (layer: string, date: string) => `${layer}_${date}.tif`;
const CLASS_FILE = `${YEAR_LAYERS.classes}.tif`;
/** What the map draws (opens, at an opacity above 0) for each step, as stepStates resolves it. */
const STEP_FILES = [file(YEAR_LAYERS.hh, LAST_HH), file(YEAR_LAYERS.hh, MIDYEAR.date!), CLASS_FILE, file(YEAR_LAYERS.hv, LAST_HV)];
/** The date the stamp names for each step (none for the static layer). */
const STEP_DATES = [LAST_HH, MIDYEAR.date!, null, LAST_HV];

type MapLike = import('maplibre-gl').Map;

const app = (page: Page) => page.locator('.app');
const panel = (page: Page) => page.getByTestId('story-panel');
const stamp = (page: Page) => page.getByTestId('story-stamp');
const params = (page: Page) => new URL(page.url()).searchParams;

/** For this page only, serves the fixture manifest with the year site changed by `edit` (a SYNTHETIC copy in the test's browser). */
async function editManifest(page: Page, edit: (site: YearSite & Record<string, unknown>) => void): Promise<void> {
  await page.route('**/manifest.json', async (route) => {
    const response = await route.fetch();
    const manifest = (await response.json()) as { sites: (YearSite & Record<string, unknown>)[] };
    edit(manifest.sites.find((s) => s.id === YEAR_SITE_ID)!);
    await route.fulfill({ response, json: manifest });
  });
}

/** Opens `query` and waits until the story is open and the map exists. */
async function openStory(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect(app(page)).toHaveAttribute('data-story', 'open');
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: MapLike }).__map?.getStyle()?.sources));
}

/** The files of the data sources the map draws at an opacity above 0. */
const drawnFiles = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map?: MapLike }).__map;
    const sources = map?.getStyle()?.sources;
    if (!map || !sources) return [];
    return Object.keys(sources)
      .filter((id) => id.startsWith('data-') && Number(map.getPaintProperty(id, 'raster-opacity')) > 0)
      .map((id) => ((map.getSource(id) as unknown as { url?: string }).url ?? '').replace('cog://', '').split('#')[0]!.split('/').pop()!);
  });

/**
 * Checks that step `i` is shown: its words, the address, and the picture the map draws (and the
 * stamp names). `coverDate` is the cover's date: the newest in the fixture's story, COVER_DATE in
 * the story the flip-book tests serve (sequenceStory).
 */
async function expectStep(page: Page, i: number, coverDate = LAST_HH): Promise<void> {
  const step = STEPS[i]!;
  await expect(page.getByTestId('story-title')).toHaveText(step.title);
  await expect(page.getByTestId('story-eyebrow')).toHaveText(i === 0 ? COVER_EYEBROW : `Step ${i + 1} of ${STEPS.length}`);
  await expect(page.locator('.story-progress-step[aria-current="step"]')).toHaveAccessibleName(`Step ${i + 1} of ${STEPS.length}: ${step.title}`);
  await expect.poll(() => page.url()).toContain(`story=${step.id}`);
  await expect.poll(() => drawnFiles(page)).toEqual([i === 0 ? file(YEAR_LAYERS.hh, coverDate) : STEP_FILES[i]]);
  const date = i === 0 ? coverDate : STEP_DATES[i];
  if (date) await expect(stamp(page)).toHaveAttribute('data-drawn-date', date);
  else await expect(stamp(page)).toHaveText(year.layers.find((l) => l.id === YEAR_LAYERS.classes)!.title);
}

/** Every element that reports a non-zero transition or animation duration. */
const moving = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        const style = getComputedStyle(el);
        const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
        return nonZero(style.transitionDuration) || nonZero(style.animationDuration);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
  );

/**
 * Every element that reports a non-zero transition or animation delay, except the "Loading the
 * picture" note, whose 400 ms delay is its own (it would flash on every date change without it).
 */
const delayed = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => {
        if (el.closest('.picture-loading')) return false;
        const style = getComputedStyle(el);
        const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) !== 0);
        return nonZero(style.transitionDelay) || nonZero(style.animationDelay);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
  );

/** Layers and sources whose id starts with "story-". */
const storyLayers = (page: Page) =>
  page.evaluate(() => {
    const style = (window as unknown as { __map: MapLike }).__map.getStyle();
    return [...style.layers.map((l) => l.id), ...Object.keys(style.sources)].filter((id) => id.startsWith('story-'));
  });

/** The text colours of the basemap's place names, per symbol layer (the night changes them while the story is open). */
const labelColours = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map: MapLike }).__map;
    return map
      .getStyle()
      .layers.filter((l) => l.type === 'symbol')
      .map((l) => [l.id, JSON.stringify(map.getPaintProperty(l.id, 'text-color')), JSON.stringify(map.getPaintProperty(l.id, 'text-halo-color'))]);
  });

/**
 * Waits until the story is at rest: no sequence under way (its button reads neither "Pause" nor
 * "Play", the words of a sequence that runs or is paused), the site marked (the ring on the cover,
 * the outline on a step: both come when the camera arrives) and the camera still, all of it for
 * three polls in a row.
 */
async function atRest(page: Page): Promise<void> {
  await page.evaluate(() => ((window as unknown as { __still: number }).__still = 0));
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __map?: MapLike; __still: number };
      const map = w.__map;
      if (!map) return false;
      const play = document.querySelector('[data-testid="story-play"]')?.textContent ?? null;
      const index = [...document.querySelectorAll('.story-progress-step')].findIndex((el) => el.getAttribute('aria-current') === 'step');
      const marked = map.getLayer(index === 0 ? 'story-site' : 'story-outline') !== undefined;
      const still = index >= 0 && marked && !map.isMoving() && play !== 'Pause' && play !== 'Play';
      w.__still = still ? w.__still + 1 : 0;
      return w.__still >= 3;
    },
    undefined,
    { polling: 50, timeout: 20_000 },
  );
}

// --- The sequences (slice 3) --------------------------------------------------------------------

/** The cover of SEQUENCE_STORY: a date a few passes before the mid-year step's, across missing passes. */
const COVER_DATE = YEAR_DATES[7]!;
/** What Next from that cover plays: every pass of the co-pol layer after the cover's date up to the mid-year step's. */
const FLIP = YEAR_DATES.filter((d) => d > COVER_DATE && d <= MIDYEAR.date!);
/** The points' build on the last step: one real day per tick, from the last pass to the end of the overlay's range. */
const BUILD_FIRST = LAST_HV;
const BUILD_LAST = OVERLAY_DATE_RANGE[1] as string;
const BUILD_DAYS = dayNumber(BUILD_LAST) - dayNumber(BUILD_FIRST) + 1;
const BUILD_COUNT = pointsDated(BUILD_FIRST, BUILD_LAST);
const OVERLAY_LAYER = overlayMapId(OVERLAY_ID);

/** For this page only, the fixture's story with the cover on COVER_DATE, so that Next from it plays FLIP (SYNTHETIC). */
const sequenceStory = (page: Page) =>
  editManifest(page, (site) => {
    site.story[0]!.date = COVER_DATE;
  });

/** The overlay as the map's source holds it (overlayMapData of the fixture file): its points, each with its checked day. */
const OVERLAY_FEATURES = overlaySourceData(readOverlay(JSON.parse(new TextDecoder().decode(overlayBytes())), OVERLAY_DATE_PROPERTY).points).features;

/** How many of the overlay's points a layer filter lets through, by MapLibre's own filter evaluator ("null": no filter). */
function throughFilter(filterJson: string): number {
  const filter = JSON.parse(filterJson) as unknown;
  if (filter === null) return OVERLAY_FEATURES.length;
  const passes = featureFilter(filter as never, 'layers[0].filter').filter;
  return OVERLAY_FEATURES.filter((f) => passes({ zoom: 10 }, { type: 1, properties: f.properties ?? {}, id: f.id } as never)).length;
}

/** The first and last day a layer filter of overlayFilter lets through (its ">=" and "<=" clauses). */
function filterDays(filterJson: string): { first: string | null; last: string | null } {
  const filter = JSON.parse(filterJson) as unknown;
  const clause = (op: string) => (Array.isArray(filter) ? (filter.find((c) => Array.isArray(c) && c[0] === op) as unknown[] | undefined) : undefined);
  return { first: (clause('>=')?.[2] as string | undefined) ?? null, last: (clause('<=')?.[2] as string | undefined) ?? null };
}

/** The number a caption ends with ("SYNTHETIC points, 8 to 18 November 2026: 57" gives 57), or null. */
const captionCount = (caption: string | null) => {
  const m = caption ? /: (\d+)(?:\.|$)/.exec(caption) : null;
  return m ? Number(m[1]) : null;
};

/** The day a build's line names ("Day 3 of 11: …" gives 3), or null when the line names none. */
const lineDay = (f: { seq: string | null }) => {
  const m = f.seq ? /^Day (\d+) of \d+: /.exec(f.seq) : null;
  return m ? Number(m[1]) : null;
};

/** `values` without the repeats of the value just before (1, 1, 2, 2, 2, 3 gives 1, 2, 3). */
function withoutRepeats<T>(values: readonly T[]): T[] {
  return values.filter((v, i) => i === 0 || v !== values[i - 1]);
}

/** What the page shows in one animation frame, or at one change of the page (record). */
interface Frame {
  /** When the record began (performance.now(), taken before anything is read). */
  t: number;
  /** The story's status on the page (data-story), null when closed. */
  open: string | null;
  /** The step shown (the progress segment marked current), -1 when none. */
  index: number;
  /** The stamp's data-drawn-date and text. */
  date: string | null;
  stamp: string | null;
  /** The files of the data sources drawn at an opacity above 0. */
  drawn: string[];
  /** The story's sequence line ("Pass 2 of 5", "Day 3 of 11: …") and its button. */
  seq: string | null;
  play: string | null;
  /** The map's "Loading the picture of …" note. */
  loading: string | null;
  /** The overlay layer's filter as JSON ("null": no filter), or null when the overlay is not on the map. */
  filter: string | null;
  /** The overlay's caption on the map, and the text of the story panel's figure (its caption, credit and sentence). */
  caption: string | null;
  figure: string | null;
  /** Whether each honest state is in view (not scrolled away, not zero-sized), with its words. */
  warning: string | null;
  figureInView: boolean;
  mapCaptionInView: boolean;
  mapNote: string | null;
  moving: boolean;
}

/**
 * Starts recording what the page shows, in every animation frame, until stopRecording. With
 * `changes`, also at every change of the page (recordedChanges), before any later task runs: a
 * MutationObserver's callback comes in the task of React's commit, after its layout effects, so the
 * map's filter is already the one of the caption it counts. Frames are what was painted, and a slow
 * machine paints few: on CI's small machines (software WebGL) a frame can take longer than a tick of
 * the build, so a day may never be painted. The changes hold every state the page's DOM went through,
 * however slowly it paints.
 */
async function record(page: Page, { changes = false } = {}): Promise<void> {
  await page.evaluate(([overlayLayer, changes]) => {
    const w = window as unknown as { __map: MapLike; __rec: unknown[]; __changes: unknown[]; __observer?: MutationObserver; __recording: boolean };
    w.__rec = [];
    w.__changes = [];
    w.__recording = true;
    const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
    // In view: not zero-sized, inside the window and inside every ancestor that clips its content.
    const inView = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      let [top, bottom, left, right] = [r.top, r.bottom, r.left, r.right];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const q = p.getBoundingClientRect();
        [top, bottom, left, right] = [Math.max(top, q.top), Math.min(bottom, q.bottom), Math.max(left, q.left), Math.min(right, q.right)];
      }
      return Math.min(bottom, window.innerHeight) > Math.max(top, 0) && Math.min(right, window.innerWidth) > Math.max(left, 0);
    };
    const inViewText = (sel: string) => {
      const el = document.querySelector(sel);
      return el && inView(el) ? (el.textContent ?? '') : null;
    };
    const snapshot = () => {
      const t = performance.now();
      const map = w.__map;
      const style = map.getStyle();
      const stampEl = document.querySelector<HTMLElement>('[data-testid="story-stamp"]');
      return {
        t,
        open: document.querySelector('.app')?.getAttribute('data-story') ?? null,
        index: [...document.querySelectorAll('.story-progress-step')].findIndex((el) => el.getAttribute('aria-current') === 'step'),
        date: stampEl?.dataset.drawnDate ?? null,
        stamp: stampEl?.textContent ?? null,
        drawn: Object.keys(style.sources)
          .filter((id) => id.startsWith('data-') && Number(map.getPaintProperty(id, 'raster-opacity')) > 0)
          .map((id) => ((map.getSource(id) as unknown as { url?: string }).url ?? '').replace('cog://', '').split('#')[0]!.split('/').pop()!),
        seq: text('[data-testid="story-sequence"]'),
        play: text('[data-testid="story-play"]'),
        loading: text('[data-testid="picture-loading"]'),
        filter: map.getLayer(overlayLayer) ? JSON.stringify(map.getFilter(overlayLayer) ?? null) : null,
        caption: text('[data-testid="overlay-map-caption-text"]'),
        figure: text('[data-testid="story-figure"]'),
        warning: inViewText('[data-testid="story-warning"]'),
        figureInView: inView(document.querySelector('[data-testid="story-figure"]')),
        mapCaptionInView: inView(document.querySelector('[data-testid="overlay-map-caption"]')),
        mapNote: text('[data-testid="overlay-map-caption"]'),
        moving: map.isMoving(),
      };
    };
    const look = () => {
      if (!w.__recording) return;
      w.__rec.push(snapshot());
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    if (changes) {
      w.__observer = new MutationObserver(() => {
        if (w.__recording) w.__changes.push(snapshot());
      });
      w.__observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  }, [OVERLAY_LAYER, changes] as const);
  // The first frames are in: what the page showed before the next action is on the record.
  await page.waitForFunction(() => (window as unknown as { __rec: unknown[] }).__rec.length >= 2, undefined, { polling: 'raf' });
}

/** Stops recording and returns every frame recorded. */
const stopRecording = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __rec: unknown[]; __observer?: MutationObserver; __recording: boolean };
    w.__recording = false;
    w.__observer?.disconnect();
    return w.__rec as Frame[];
  });

/** After stopRecording, what the page showed at every change recorded by record(page, { changes: true }). */
const recordedChanges = (page: Page) => page.evaluate(() => (window as unknown as { __changes: unknown[] }).__changes as Frame[]);

/**
 * Runs of frames longer than `toleranceMs` in which the stamp names a date but the map does not draw
 * that date's file alone. The map changes a source's opacity in one frame and React writes the stamp
 * in the next, so a short run is allowed, never a longer one.
 */
function disagreements(frames: readonly Frame[], fileOf: (date: string) => string, toleranceMs = 100): Frame[][] {
  const runs: Frame[][] = [];
  let run: Frame[] = [];
  for (const f of [...frames, null]) {
    if (f && f.date !== null && !(f.drawn.length === 1 && f.drawn[0] === fileOf(f.date))) run.push(f);
    else {
      if (run.length > 0 && run.at(-1)!.t - run[0]!.t > toleranceMs) runs.push(run);
      run = [];
    }
  }
  return runs;
}

/** Dates the stamp named before the map had drawn their file once: never allowed. */
function namedBeforeDrawn(frames: readonly Frame[], fileOf: (date: string) => string): string[] {
  const drawnOnce = new Set<string>();
  const early = new Set<string>();
  for (const f of frames) {
    for (const file of f.drawn) drawnOnce.add(file);
    if (f.date !== null && !drawnOnce.has(fileOf(f.date))) early.add(f.date);
  }
  return [...early];
}

/** The pass line in each frame against the stamp: it names the place in FLIP of the picture drawn, or nothing. */
function passLineErrors(frames: readonly Frame[]): string[] {
  const errors: string[] = [];
  for (const f of frames) {
    const place = f.date === null ? -1 : FLIP.indexOf(f.date);
    if (f.seq !== null && f.seq !== `Pass ${place + 1} of ${FLIP.length}`) errors.push(`${f.t.toFixed(0)}: "${f.seq}" with the stamp on ${f.date}`);
    // While the flip-book runs and the picture drawn is one of its frames, the line says so.
    if (f.seq === null && f.play === 'Pause' && place >= 0) errors.push(`${f.t.toFixed(0)}: no pass line with the stamp on frame ${place + 1} (${f.date})`);
  }
  return errors;
}

/**
 * Waits, checking in every animation frame, until the sequence line reads `line` exactly, or
 * matches `pattern`. A pass is on screen for under a second and a day for 120 ms: a slower poll
 * could miss them.
 */
const whenLine = (page: Page, line: { text: string } | { pattern: string }) =>
  page.waitForFunction(
    (want) => {
      const t = document.querySelector('[data-testid="story-sequence"]')?.textContent ?? '';
      return 'text' in want ? t === want.text : new RegExp(want.pattern).test(t);
    },
    line,
    { polling: 'raf', timeout: 15_000 },
  );
const passLine = (k: number) => ({ text: `Pass ${k} of ${FLIP.length}` });
/** The line of the build somewhere between its second and its fifth day: it is under way, far from its end. */
const EARLY_DAY = { pattern: `^Day [2-5] of ${BUILD_DAYS}: ` };

/** The dates the stamp named, in order, each once per run. */
const namedDates = (frames: readonly Frame[]) => frames.map((f) => f.date).filter((d, i, all): d is string => d !== null && d !== all[i - 1]);

/** The map's camera now. */
const cameraNow = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map: MapLike }).__map;
    const c = map.getCenter();
    return { lon: c.lng, lat: c.lat, zoom: map.getZoom() };
  });

/** The camera that frames `bounds` on this map as it is now, as MapView frames a site (padding 40). */
const boundsCamera = (page: Page, bounds: [number, number, number, number]) =>
  page.evaluate((b) => {
    const cam = (window as unknown as { __map: MapLike }).__map.cameraForBounds(b, { padding: 40 })!;
    const c = cam.center as { lng: number; lat: number };
    return { lon: c.lng, lat: c.lat, zoom: cam.zoom! };
  }, bounds);

type Box = { x: number; y: number; width: number; height: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('the bare address', () => {
  test('opens the cover; Start leads through every step to "Explore the map", and then the tool works as before', async ({ page }) => {
    await openStory(page);
    // The cover: the place and the period, the first step's title and text, the real figures and the
    // credit; focus on "Start the story"; the address names the step only.
    await expect(page.getByTestId('story-cover')).toBeVisible();
    await expect(page.getByTestId('story-text')).toHaveText(FIRST.text);
    const figures = page.getByTestId('story-figures');
    await expect(figures).toContainText(`${YEAR_DATES.length} radar passes`);
    await expect(figures).toContainText(`${YEAR_MISSING.length} passes missing, shown as missing`);
    await expect(figures).toContainText(`${OVERLAY.count} ${OVERLAY.title}`);
    await expect(page.getByTestId('story-credit')).toHaveText(`Data: ${year.source.citation}`);
    await expect(page.getByTestId('story-start')).toBeFocused();
    await expect(page.getByTestId('story-status')).toHaveText(stepAnnouncement(STEPS as never, 0));
    await expectStep(page, 0);
    expect(new URL(page.url()).search).toBe(`?story=${FIRST.id}`);
    // The tool's own tag is not on the map: the stamp is the tag while the story is open.
    await expect(page.getByTestId('map-showing')).toHaveCount(0);

    await page.getByTestId('story-start').click();
    await expectStep(page, 1);
    await expect(page.getByTestId('story-next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expectStep(page, 2);
    await expect(page.getByTestId('story-next')).toBeFocused();
    await page.keyboard.press('Space');
    await expectStep(page, 3);
    await expect(page.getByTestId('story-next')).toHaveText('Explore the map');
    // Coming forward to it, the last step builds its points day by day; once that has ended, Enter
    // closes (while it runs, Enter would first end it: see "Next during the build").
    await atRest(page);
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await page.keyboard.press('Enter');

    // Closed: the tool, with what the last step put on the map, and focus on the site's title.
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('#site-title')).toBeFocused();
    await expect(page.getByTestId('story-status')).toHaveText('Exploring the map');
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect.poll(() => params(page).has('story')).toBe(false);
    expect(params(page).get('layer')).toBe(YEAR_LAYERS.hv);
    expect(params(page).get('date')).toBe(LAST_HV);
    expect(params(page).get('overlays')).toBe(OVERLAY_ID);
    await expect(page.getByLabel('Layer', { exact: true })).toHaveValue(YEAR_LAYERS.hv);
    await expect(page.getByTestId('current-date')).toHaveText(LAST_HV);
    await expect(page.getByRole('switch', { name: OVERLAY.title })).toBeChecked();
    await expect(page.getByTestId('map-showing')).toBeVisible();
    await expect(stamp(page)).toHaveCount(0);
    // The tool works as before: the stepper, the arrow keys, a reading at the map centre.
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(page.getByTestId('current-date')).toHaveText(YEAR_HV_DATES[YEAR_HV_DATES.length - 2]!);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('current-date')).toHaveText(YEAR_HV_DATES[YEAR_HV_DATES.length - 3]!);
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.getByTestId('inspect')).toContainText('Longitude');
  });
});

test.describe('before the manifest, and without a story', () => {
  test('the cover is there from the first frame, with the name and "Loading…"; the tool never shows first', async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/manifest.json', async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    });
    await page.goto('./', { waitUntil: 'commit' });
    await expect(app(page)).toHaveAttribute('data-story', 'pending');
    await expect(page.getByTestId('story-cover')).toContainText(BRANDING.name);
    await expect(page.getByTestId('story-cover')).toContainText('Loading…');
    await expect(panel(page)).toContainText('Loading…');
    await expect(page.locator('.side')).toHaveAttribute('inert', '');
    await expect(page.getByTestId('map-showing')).toHaveCount(0);
    release();
    await expect(app(page)).toHaveAttribute('data-story', 'open');
    await expect(page.getByTestId('story-title')).toHaveText(FIRST.title);
  });

  test('the opening step is the first selection: no other date of the layer is fetched before its picture', async ({ page }) => {
    const rasters: string[] = [];
    page.on('request', (r) => {
      const name = new URL(r.url()).pathname.split('/').pop() ?? '';
      if (name.endsWith('.tif') && !name.startsWith('stack_')) rasters.push(name);
    });
    await openStory(page, `?story=${MIDYEAR.id}`);
    await expectStep(page, 1);
    expect(rasters[0]).toBe(file(YEAR_LAYERS.hh, MIDYEAR.date!));
    expect(new Set(rasters)).toEqual(new Set([file(YEAR_LAYERS.hh, MIDYEAR.date!)]));
  });

  test('a site without a story: the bare address shows the map as before, silently, and no Story button', async ({ page }) => {
    await editManifest(page, (site) => delete (site as Partial<YearSite>).story);
    await page.goto('./');
    await expect(page.locator('#site-title')).toHaveText(year.title);
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.getByTestId('map-showing')).toBeVisible();
    await expect(page.getByTestId('story-open')).toHaveCount(0);
    await expect(page.getByTestId('story-status')).toHaveText('');
    await expect(page.locator('[inert]')).toHaveCount(0);
    // A place without a story, with a step in its link: the map, and the step leaves the link.
    await page.goto(`./?site=${SITE_ID}&story=${FIRST.id}`);
    await expect(page.locator('#site-title')).not.toHaveText(year.title);
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect.poll(() => params(page).has('story')).toBe(false);
  });

  test('a manifest that cannot be loaded: its error, and no story', async ({ page }) => {
    await page.route('**/manifest.json', (route) => route.fulfill({ status: 500, body: 'SYNTHETIC failure' }));
    await page.goto('./');
    await expect(page.getByRole('alert')).toContainText('The data could not be loaded');
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.getByTestId('story-cover')).toHaveCount(0);
  });
});

test.describe('Next, Back, the keys and the progress', () => {
  test('Right and Page Down go on, Left and Page Up go back, Home returns to the cover, a segment goes to its step', async ({ page }) => {
    await openStory(page);
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 1);
    await page.keyboard.press('PageDown');
    await expectStep(page, 2);
    await page.keyboard.press('ArrowLeft');
    await expectStep(page, 1);
    await page.keyboard.press('PageUp');
    await expectStep(page, 0);
    await page.keyboard.press('ArrowLeft'); // nothing before the cover
    await expectStep(page, 0);
    await page.locator('.story-progress-step').nth(2).click();
    await expectStep(page, 2);
    await expect(page.locator('.story-progress-step').nth(2)).toBeFocused(); // focus stays on the segment
    await page.keyboard.press('Home');
    await expectStep(page, 0);
    await expect(page.locator('.story-progress-step')).toHaveCount(STEPS.length);
  });

  test('the keys stand down with a modifier key held and while the About dialog is open; Escape then closes the dialog only', async ({ page }) => {
    await openStory(page, `?story=${MIDYEAR.id}`);
    for (const key of ['Alt+ArrowRight', 'Shift+ArrowRight', 'Control+ArrowRight']) await page.keyboard.press(key);
    await expectStep(page, 1);
    await page.getByRole('button', { name: 'About' }).click();
    const dialog = page.getByRole('dialog', { name: 'About' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expectStep(page, 1);
    await expect(app(page)).toHaveAttribute('data-story', 'open');
  });

  test('a step shows the same picture however it is reached: Next, Back, a link', async ({ page }) => {
    await openStory(page);
    await page.getByTestId('story-start').click();
    await expectStep(page, 1);
    await page.getByTestId('story-next').click();
    await expectStep(page, 2);
    await page.getByTestId('story-back').click();
    await expectStep(page, 1);
    await page.getByTestId('story-back').click();
    await expectStep(page, 0); // the cover keeps its own date (the newest), not the one shown before
    await page.goto(`./?story=${MIDYEAR.id}`);
    await expectStep(page, 1);
  });

  test('the step the story opens at is jumped to; a step reached from another is glided to: its view, else the site framed, on the cover right of the centre', async ({ page }) => {
    // How far the camera is from where step `i` puts it: the pixel distance between the target's
    // centre and where it must land (the map's centre; on the desktop cover a share of the map's
    // width to the right, clear of the cover's words), and the zoom's difference.
    const offBy = (i: number) =>
      page.evaluate(
        ([bounds, view, offsetShare]) => {
          const map = (window as unknown as { __map: MapLike }).__map;
          const box = map.getContainer();
          const framed = map.cameraForBounds(bounds, { padding: 40 })!;
          const c = framed.center as { lng: number; lat: number };
          const target = view ?? { center: [c.lng, c.lat] as [number, number], zoom: framed.zoom! };
          const at = map.project(target.center);
          const x = box.clientWidth / 2 + Math.round(box.clientWidth * offsetShare);
          return { px: Math.hypot(at.x - x, at.y - box.clientHeight / 2), zoom: Math.abs(map.getZoom() - target.zoom), moving: map.isMoving() };
        },
        [year.bounds, STEPS[i]!.view ?? null, i === 0 ? COVER_SITE_OFFSET : 0] as const,
      );
    const there = { px: 1, zoom: 0.01 };
    // Opened at a step: a jump, so the camera is there, still, as soon as the step is shown.
    await openStory(page, `?story=${MIDYEAR.id}`);
    await expectStep(page, 1);
    const opened = await offBy(1);
    expect(opened.moving).toBe(false);
    expect(opened.px).toBeLessThan(there.px);
    expect(opened.zoom).toBeLessThan(there.zoom);
    // Reached from another step: a glide (the camera is moving right after the click), ending there.
    for (const i of [0, 2, 3, 1]) {
      await page.locator('.story-progress-step').nth(i).click();
      await expectStep(page, i);
      await atRest(page);
      const got = await offBy(i);
      expect(got.px, STEPS[i]!.id).toBeLessThan(there.px);
      expect(got.zoom, STEPS[i]!.id).toBeLessThan(there.zoom);
    }
    // A jump would be over by the time the click returns; a glide (an ease of 1.4 s here) is not.
    await page.locator('.story-progress-step').nth(0).click();
    expect((await offBy(0)).moving).toBe(true);
    await atRest(page);
    expect((await offBy(0)).px).toBeLessThan(there.px);
  });

  test("the Story button stops the tool's playback: the cover's picture stays", async ({ page }) => {
    await page.goto(`./?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${YEAR_DATES[2]}`);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('current-date')).not.toHaveText(YEAR_DATES[2]!);
    await page.getByTestId('story-open').click();
    await expectStep(page, 0);
    await page.waitForTimeout(2000); // longer than two steps of playback (a 700 ms dwell each)
    expect(await drawnFiles(page)).toEqual([STEP_FILES[0]]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('play')).toHaveText('Play');
    await expect(page.getByTestId('current-date')).toHaveText(LAST_HH);
  });

  test("the Story button puts the layer back at full opacity and clears the tool's reading and its marker", async ({ page }) => {
    await page.goto(`./?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${YEAR_DATES[2]}`);
    await expect(page.getByTestId('current-date')).toHaveText(YEAR_DATES[2]!);
    const slider = page.getByRole('slider');
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Layer opacity: 50%')).toBeVisible();
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.locator('.maplibregl-marker')).toHaveCount(1);
    await page.getByTestId('story-open').click();
    await expectStep(page, 0);
    // The cover's picture at full strength, with no pin over it.
    await expect.poll(() => drawnOpacities(page)).toEqual([1]);
    await expect(page.locator('.maplibregl-marker')).toHaveCount(0);
    // And the tool the story gives back starts from there too.
    await page.keyboard.press('Escape');
    await expect(page.getByText('Layer opacity: 100%')).toBeVisible();
    await expect(page.locator('.maplibregl-marker')).toHaveCount(0);
    await expect(page.getByTestId('inspect-value')).toHaveCount(0);
  });
});

/** The raster-opacity of every data picture on the map that is not hidden (0). */
const drawnOpacities = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map: MapLike }).__map;
    return Object.keys(map.getStyle().sources)
      .filter((id) => id.startsWith('data-'))
      .map((id) => Number(map.getPaintProperty(id, 'raster-opacity')))
      .filter((o) => o > 0);
  });

test.describe('closing', () => {
  test('Escape and "Explore the map" close it from any step after the cover and keep what the step put on the map, camera included', async ({ page }) => {
    for (const [i, step] of STEPS.entries()) {
      if (i === 0) continue; // the cover gives the tool what it opens with ("closing from the cover", below)
      await openStory(page, `?story=${step.id}`);
      await expectStep(page, i);
      // The step's camera (its view, else the site framed), once the step has taken it.
      const want = step.view ? { lon: step.view.center[0], lat: step.view.center[1], zoom: step.view.zoom } : await boundsCamera(page, year.bounds);
      await expect.poll(async () => (await cameraNow(page)).zoom, step.id).toBeCloseTo(want.zoom, 2);
      if (i % 2 === 0) await page.keyboard.press('Escape');
      else await page.getByTestId('story-exit').click();
      await expect(app(page)).not.toHaveAttribute('data-story');
      await expect(page.locator('#site-title')).toBeFocused();
      await expect(page.getByTestId('story-status')).toHaveText('Exploring the map');
      expect(await drawnFiles(page), step.id).toEqual([STEP_FILES[i]]);
      await expect.poll(() => params(page).get('layer')).toBe(i === 2 ? YEAR_LAYERS.classes : i === 3 ? YEAR_LAYERS.hv : YEAR_LAYERS.hh);
      expect(params(page).has('story')).toBe(false);
      // The step's date (none for the static layer) and its overlays, in the link and in the tool.
      expect(params(page).get('date'), step.id).toBe(STEP_DATES[i]);
      expect(params(page).get('overlays'), step.id).toBe(i === 3 ? OVERLAY_ID : null);
      await expect(page.getByRole('switch', { name: OVERLAY.title }), step.id).toBeChecked({ checked: i === 3 });
      // The camera stays where the step put it, and the link carries it.
      const got = await cameraNow(page);
      expect(got.lon, step.id).toBeCloseTo(want.lon, 4);
      expect(got.lat, step.id).toBeCloseTo(want.lat, 4);
      expect(got.zoom, step.id).toBeCloseTo(want.zoom, 2);
      expect(Number(params(page).get('lon')), step.id).toBeCloseTo(want.lon, 4);
      expect(Number(params(page).get('lat')), step.id).toBeCloseTo(want.lat, 4);
      expect(Number(params(page).get('z')), step.id).toBeCloseTo(want.zoom, 1);
    }
  });

  test('"Explore the map" on the desktop cover closes it too', async ({ page }) => {
    await openStory(page);
    await page.getByTestId('story-cover').getByTestId('story-exit').click();
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.getByTestId('story-cover')).toHaveCount(0);
    await expect(page.locator('#site-title')).toBeFocused();
  });

  test('nothing of the story is left on the map: no story- layer, no inert, the basemap labels as they were', async ({ page }) => {
    await page.goto('./?story=off');
    await expect(page.locator('#site-title')).toBeVisible();
    await waitForMapIdle(page);
    const before = await labelColours(page);
    expect(before.length).toBeGreaterThan(0);
    await page.getByTestId('story-open').click();
    await expectStep(page, 0);
    await expect(page.locator('.side')).toHaveAttribute('inert', '');
    for (let i = 1; i < STEPS.length; i++) {
      await page.getByTestId(i === 1 ? 'story-start' : 'story-next').click();
      await expectStep(page, i);
    }
    // The last step builds its points (coming forward to it); Next then would end that first.
    await atRest(page);
    await page.getByTestId('story-next').click();
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.locator('[inert]')).toHaveCount(0);
    // The labels at once; the night lifts over 900 ms and is then removed with everything else.
    expect(await labelColours(page)).toEqual(before);
    await expect.poll(() => storyLayers(page), { timeout: 2000 }).toEqual([]);
    expect(await labelColours(page)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  });
});

/** The zoom of the far view the cover is given below (the real cover's: the site a few pixels across). */
const FAR_COVER_ZOOM = 4.6;
/**
 * Gives the cover what the real one has, a far view on an early date, and also the other per-date
 * layer and the points, so that every part of what the tool gets on closing from it is told apart
 * from what the cover showed (the fixture's own cover shows what the tool opens with).
 */
function farCover(site: YearSite & Record<string, unknown>): void {
  const [w, s, e, n] = site.bounds;
  const center: [number, number] = [(w + e) / 2 + 3, (s + n) / 2 + 2];
  site.story[0] = { ...site.story[0]!, layer: YEAR_LAYERS.hv, date: YEAR_HV_DATES[0]!, overlays: [OVERLAY_ID], view: { center, zoom: FAR_COVER_ZOOM } };
}

for (const [size, use] of [
  ['1280 x 800', { viewport: { width: 1280, height: 800 } }],
  ['375 x 812', PHONE],
] as const) {
  test.describe(`closing from the cover at ${size}`, () => {
    test.use(use);

    test('"Explore the map" and Escape give the tool what opening it directly gives: the site framed as at story=off, the first layer on its newest date, no overlay, and a click reads a value', async ({ page }) => {
      await editManifest(page, farCover);
      // What a visitor who opens the tool directly gets (MapView has framed the site once the data
      // layer is on the map).
      await openAt(page, '?story=off');
      const want = await cameraNow(page);
      expect(want.zoom).toBeGreaterThan(FAR_COVER_ZOOM + 2);
      for (const how of ['Explore the map', 'Escape'] as const) {
        await openStory(page);
        await expect(page.getByTestId('story-title')).toHaveText(FIRST.title);
        // The cover: its far view, its date of the cross-pol layer, the points on.
        await expect.poll(() => drawnFiles(page), how).toEqual([file(YEAR_LAYERS.hv, YEAR_HV_DATES[0]!)]);
        await expect.poll(async () => (await cameraNow(page)).zoom, how).toBeCloseTo(FAR_COVER_ZOOM, 2);
        if (how === 'Escape') await page.keyboard.press('Escape');
        else if (size === '375 x 812') {
          // A finger on the button where it is seen, in the sticky bar at the foot of the screen (a
          // locator's click would first scroll the column to the bar's place in the flow, far below).
          const b = (await page.getByTestId('story-exit').boundingBox())!;
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        } else await page.getByTestId('story-exit').click();
        await expect(app(page)).not.toHaveAttribute('data-story');
        await expect(page.locator('#site-title')).toBeFocused();
        // The selection the tool opens with: its first layer on the newest date, no overlay.
        await expect(page.getByLabel('Layer', { exact: true }), how).toHaveValue(YEAR_LAYERS.hh);
        await expect(page.getByTestId('current-date'), how).toHaveText(LAST_HH);
        await expect(page.getByRole('switch', { name: OVERLAY.title }), how).not.toBeChecked();
        await expect.poll(() => drawnFiles(page), how).toEqual([file(YEAR_LAYERS.hh, LAST_HH)]);
        // The site framed exactly as at story=off.
        const got = await cameraNow(page);
        expect(got.lon, how).toBeCloseTo(want.lon, 4);
        expect(got.lat, how).toBeCloseTo(want.lat, 4);
        expect(got.zoom, how).toBeCloseTo(want.zoom, 2);
        // The address: the usual selection of what is on screen, and the view of the framed site.
        await expect.poll(() => params(page).get('date'), how).toBe(LAST_HH);
        const p = params(page);
        expect(p.get('site'), how).toBe(YEAR_SITE_ID);
        expect(p.get('layer'), how).toBe(YEAR_LAYERS.hh);
        expect(p.has('overlays'), how).toBe(false);
        expect(p.has('story'), how).toBe(false);
        expect(Number(p.get('lon')), how).toBeCloseTo(want.lon, 4);
        expect(Number(p.get('lat')), how).toBeCloseTo(want.lat, 4);
        expect(Number(p.get('z')), how).toBeCloseTo(want.zoom, 1);
        // A working tool: a click (on a phone, a tap) in the middle of the site reads a value.
        const [w, s, e, n] = year.bounds;
        const at = await page.evaluate(([lon, lat]) => (window as unknown as { __map: MapLike }).__map.project([lon!, lat!]), [(w + e) / 2, (s + n) / 2]);
        const box = (await page.locator('#map').boundingBox())!;
        if (size === '375 x 812') await page.touchscreen.tap(box.x + at.x, box.y + at.y);
        else await page.mouse.click(box.x + at.x, box.y + at.y);
        await expect(page.getByTestId('inspect-value'), how).toHaveText(/^(-?\d+(\.\d+)?( \S+)?( or (less|more))?|no data)$/);
      }
    });
  });
}

test.describe('the address', () => {
  test('story=<id> opens that step with focus on Next; a reload and a copied link come back to it', async ({ page, context }) => {
    await openStory(page, `?story=${CLASSES.id}`);
    await expectStep(page, 2);
    await expect(page.getByTestId('story-next')).toBeFocused();
    expect(new URL(page.url()).search).toBe(`?story=${CLASSES.id}`);
    await page.reload();
    await expect(app(page)).toHaveAttribute('data-story', 'open');
    await expectStep(page, 2);
    const copy = await context.newPage();
    await openStory(copy, new URL(page.url()).search);
    await expectStep(copy, 2);
  });

  test('an id the story does not have opens the cover', async ({ page }) => {
    await openStory(page, '?story=no-such-step');
    await expectStep(page, 0);
    await expect(page.getByTestId('story-start')).toBeFocused();
  });

  test('story=off and any link that names the map open the map exactly as before; the Story button opens the cover', async ({ page }) => {
    for (const query of [
      '?story=off',
      `?site=${YEAR_SITE_ID}`,
      `?layer=${YEAR_LAYERS.hv}`,
      `?date=${YEAR_DATES[3]}`,
      `?overlays=${OVERLAY_ID}`,
      '?lon=-40&lat=14&z=8',
    ]) {
      await page.goto(`./${query}`);
      await expect(page.locator('#site-title'), query).toBeVisible();
      await expect(app(page), query).not.toHaveAttribute('data-story');
      await expect(page.getByTestId('map-showing'), query).toBeVisible();
      await expect(page.locator('[inert]'), query).toHaveCount(0);
      await expect.poll(() => params(page).has('story'), query).toBe(false);
    }
    await page.getByTestId('story-open').click();
    await expectStep(page, 0);
    await expect(page.getByTestId('story-start')).toBeFocused();
    // The Story button is after About in the header.
    const order = await page.locator('header button').allTextContents();
    expect(order.indexOf('Story')).toBe(order.indexOf('About') + 1);
  });
});

test.describe('the map and the tool are asleep while the story is open', () => {
  test('the side column, the map and its zoom buttons take no input and leave the tab order', async ({ page }) => {
    await openStory(page, `?story=${MIDYEAR.id}`);
    await expectStep(page, 1);
    await waitForMapIdle(page);
    await expect(page.locator('.side')).toHaveAttribute('inert', '');
    await expect(page.locator('.maplibregl-canvas-container')).toHaveAttribute('inert', '');
    await expect(page.locator('.maplibregl-ctrl-top-right')).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeHidden();
    // The credit line stays reachable.
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
    const camera = () =>
      page.evaluate(() => {
        const map = (window as unknown as { __map: MapLike }).__map;
        return [...map.getCenter().toArray(), map.getZoom()];
      });
    const before = await camera();
    const box = (await page.locator('#map').boundingBox())!;
    const [x, y] = [box.x + box.width * 0.3, box.y + box.height * 0.5];
    await page.mouse.click(x, y);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -400);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await camera()).toEqual(before);
    await expect(page.locator('.maplibregl-marker')).toHaveCount(0);
    // A full round of Tab never lands in the side column or on the map.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const visited: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      visited.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          if (el.closest('.side')) return 'SIDE';
          if (el.closest('.maplibregl-canvas-container, .maplibregl-ctrl-top-right')) return 'MAP';
          return el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent ?? el.tagName;
        }),
      );
    }
    expect(visited).not.toContain('SIDE');
    expect(visited).not.toContain('MAP');
    expect(visited).toContain('story-next');
    // The tool's arrow keys stand down: Right goes on in the story, not to the next date.
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 2);
  });
});

test.describe('focus and what a screen reader hears', () => {
  test('Tab reaches the story buttons with the amber ring; Enter steps and keeps focus on Next to the end', async ({ page }) => {
    await openStory(page, `?story=${MIDYEAR.id}`);
    const next = page.getByTestId('story-next');
    await expect(next).toBeFocused();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < 25 && !(await next.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
    expect(await next.evaluate((el) => `${getComputedStyle(el).outlineStyle} ${getComputedStyle(el).outlineColor}`)).toBe('solid rgb(255, 176, 0)');
    for (const i of [2, 3]) {
      await page.keyboard.press('Enter');
      await expectStep(page, i);
      await expect(next).toBeFocused();
    }
    // The last step builds its points: the first Enter ends that build at the step's final state,
    // with focus still on Next; the second closes.
    await expect(page.getByTestId('story-play')).toHaveText('Pause');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await expectStep(page, 3);
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.locator('#site-title')).toBeFocused();
  });

  test('one polite live region: the step once on entering it; "Exploring the map" after closing', async ({ page }) => {
    await openStory(page);
    const live = page.getByTestId('story-status');
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveText(`Step 1 of 4: ${FIRST.title}`);
    await page.keyboard.press('ArrowRight');
    await expect(live).toHaveText(`Step 2 of 4: ${MIDYEAR.title}`);
    await page.keyboard.press('ArrowRight');
    await expect(live).toHaveText(`Step 3 of 4: ${CLASSES.title}`);
    // The panel and the cover are not live themselves, so a step is not read twice.
    expect(await page.locator('.story-panel [aria-live], .story-panel [role="status"], .story-cover [aria-live]').count()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(live).toHaveText('Exploring the map');
  });
});

test.describe('honest states', () => {
  test("on a mixed-release site the warning is in view on every step, whatever the layer; an overlay's sentence and credit whenever its dots are", async ({ page }) => {
    await editManifest(page, (site) => {
      site.source.release = 'mixed';
    });
    await openStory(page);
    for (const [i, step] of STEPS.entries()) {
      if (i > 0) await page.keyboard.press('ArrowRight');
      await expectStep(page, i);
      // The cover, the dates, the static class layer (built by comparing passes too) and the step with
      // the points: every one.
      const warning = page.getByTestId('story-warning');
      await expect(warning, step.id).toHaveText(MIXED_RELEASE_WARNING);
      await expect(warning, step.id).toBeInViewport();
      await expect(page.getByTestId('story-credit')).toBeInViewport();
    }
    // The last step has the points on: what they are not, on the map and in the panel, and their credit.
    await expect(page.getByTestId('overlay-map-caption')).toContainText(OVERLAY_NOT_NISAR);
    await expect(page.getByTestId('overlay-map-caption')).toBeInViewport();
    const figure = page.getByTestId('story-figure');
    await expect(figure).toContainText(OVERLAY_NOT_NISAR);
    await expect(figure).toContainText(`Credit: ${OVERLAY.credit}`);
    await expect(figure).toContainText(OVERLAY.title);
  });

  test('on a site that is not mixed no step shows the mixed-release warning', async ({ page }) => {
    expect(year.source.release).not.toBe('mixed');
    await openStory(page);
    for (const [i, step] of STEPS.entries()) {
      if (i > 0) await page.keyboard.press('ArrowRight');
      await expectStep(page, i);
      await expect(page.getByTestId('story-warning'), step.id).toHaveCount(0);
      await expect(page.getByText(MIXED_RELEASE_WARNING), step.id).toHaveCount(0);
    }
  });

  test('the stamp names only the picture drawn, in every frame, also while a held file loads; never the new date before its file is drawn', async ({ page }) => {
    test.setTimeout(40_000);
    const [oldFile, newFile] = [file(YEAR_LAYERS.hh, LAST_HH), file(YEAR_LAYERS.hh, MIDYEAR.date!)];
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/${newFile}`, async (route) => {
      await answered;
      await route.continue().catch(() => undefined);
    });
    await openStory(page);
    await expectStep(page, 0);
    await waitForMapIdle(page);
    // From now on, in every animation frame: the stamp's date and text, the step, the files drawn.
    await page.evaluate(() => {
      const w = window as unknown as { __frames: unknown[]; __map: MapLike };
      w.__frames = [];
      const look = () => {
        const map = w.__map;
        const el = document.querySelector<HTMLElement>('[data-testid="story-stamp"]');
        w.__frames.push({
          t: performance.now(),
          date: el?.dataset.drawnDate ?? null,
          text: el?.textContent ?? null,
          step: new URL(location.href).searchParams.get('story'),
          drawn: Object.keys(map.getStyle().sources)
            .filter((id) => id.startsWith('data-') && Number(map.getPaintProperty(id, 'raster-opacity')) > 0)
            .map((id) => ((map.getSource(id) as unknown as { url?: string }).url ?? '').replace('cog://', '').split('#')[0]!.split('/').pop()!),
        });
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.url()).toContain(`story=${MIDYEAR.id}`);
    // While the new file is held: the picture still on the map, named; then none, and no date.
    expect(await stamp(page).getAttribute('data-drawn-date')).toBe(LAST_HH);
    await expect(page.getByTestId('picture-loading')).toContainText(MIDYEAR.date!);
    await expect(stamp(page)).toHaveText('Loading the picture…', { timeout: PREVIOUS_PICTURE_LIMIT_MS + 3000 });
    await expect(stamp(page)).not.toHaveAttribute('data-drawn-date');
    release();
    await expect(stamp(page)).toHaveAttribute('data-drawn-date', MIDYEAR.date!);
    await waitForMapIdle(page);
    type Frame = { t: number; date: string | null; text: string | null; step: string; drawn: string[] };
    const frames = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
    expect(frames.length).toBeGreaterThan(30);
    const fileOf = (date: string) => file(YEAR_LAYERS.hh, date);
    // Never the new date before its file is drawn: in every frame that names it, its file is on the map.
    for (const f of frames.filter((fr) => fr.date === MIDYEAR.date)) expect(f.drawn).toContain(newFile);
    // In every frame that names a date, the map draws that date's file and no other. The map changes a
    // source's opacity in one frame and React writes the stamp in the next, so a run of disagreeing
    // frames up to 100 ms is allowed, never longer.
    const runs: Frame[][] = [];
    let run: Frame[] = [];
    for (const f of [...frames, null]) {
      if (f && f.date !== null && !(f.drawn.length === 1 && f.drawn[0] === fileOf(f.date))) run.push(f);
      else {
        if (run.length > 0 && run.at(-1)!.t - run[0]!.t > 100) runs.push(run);
        run = [];
      }
    }
    expect(runs).toEqual([]);
    // The case was really exercised: the old picture named while the new step was chosen, then no date
    // with nothing drawn, then the new picture.
    expect(frames.some((f) => f.step === MIDYEAR.id && f.date === LAST_HH && f.drawn[0] === oldFile)).toBe(true);
    expect(frames.some((f) => f.step === MIDYEAR.id && f.date === null && f.text === 'Loading the picture…' && f.drawn.length === 0)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ date: MIDYEAR.date, drawn: [newFile] });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});

test.describe('the flip-book (honesty test 1)', () => {
  const fileOf = (date: string) => file(YEAR_LAYERS.hh, date);

  test('the fixture story with the cover moved plays at least four passes, across missing passes', () => {
    expect(FLIP.length).toBeGreaterThanOrEqual(4);
    expect(FLIP.at(-1)).toBe(MIDYEAR.date);
    expect(YEAR_MISSING.some((m) => m.date !== undefined && m.date > COVER_DATE && m.date < MIDYEAR.date!)).toBe(true);
  });

  test('in every frame the stamp names the picture the map draws, never a date before its file is drawn, and "Pass k of N" its place; it rests on the step', async ({ page }) => {
    await sequenceStory(page);
    await openStory(page);
    await expectStep(page, 0, COVER_DATE);
    await expect(stamp(page)).toHaveAttribute('data-drawn-date', COVER_DATE);
    await atRest(page);
    // In every animation frame, and also at every change of the page (record, `changes`).
    await record(page, { changes: true });
    await page.keyboard.press('ArrowRight');
    await whenLine(page, passLine(1));
    await atRest(page);
    const frames = await stopRecording(page);
    const changes = await recordedChanges(page);
    for (const [kind, records] of [['the frames painted', frames], ['the changes of the page', changes]] as const) {
      expect(namedBeforeDrawn(records, fileOf), kind).toEqual([]);
      expect(disagreements(records, fileOf), kind).toEqual([]);
      expect(passLineErrors(records), kind).toEqual([]);
      // Every pass named once, in order, from the cover's to the step's; no other date.
      expect(namedDates(records), kind).toEqual([COVER_DATE, ...FLIP]);
    }
    // Each line was painted, and each frame stayed on the map for its dwell (700 ms after it was
    // drawn): the stamp named it without a break for more than 600 ms, from the first change of the
    // page that named it to the first that named anything else (the next pass, or no date: time
    // with no picture named is not the pass's). namedDates rules out a pass named again after a
    // break. Timed at the changes: frames, which a slow machine paints late and few, made it look
    // shorter.
    expect(new Set(frames.map((f) => f.seq).filter(Boolean))).toEqual(new Set(FLIP.map((_, i) => `Pass ${i + 1} of ${FLIP.length}`)));
    for (const date of FLIP.slice(0, -1)) {
      const from = changes.findIndex((c) => c.date === date);
      const until = changes.findIndex((c, i) => i > from && c.date !== date);
      const named = changes[until]!.t - changes[from]!.t;
      expect(named, `${date} named for ${named.toFixed(0)} ms (until the stamp named ${changes[until]!.date})`).toBeGreaterThan(600);
    }
    // At rest on the step's own picture, with the button that plays it again.
    await expectStep(page, 1);
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await expect(page.getByTestId('story-sequence'), 'the line stays, naming the picture on the map').toHaveText(`Pass ${FLIP.length} of ${FLIP.length}`);
  });

  test('with one pass held back: the stamp names the picture before it, then says it is loading, never the held date; the sequence still ends', async ({ page }) => {
    test.setTimeout(60_000);
    const held = FLIP[2]!;
    await page.route(`**/${fileOf(held)}`, () => undefined); // never answered
    await sequenceStory(page);
    await openStory(page);
    await expectStep(page, 0, COVER_DATE);
    await atRest(page);
    await record(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('picture-loading')).toContainText(held, { timeout: 15_000 });
    await expect(stamp(page)).toHaveText('Loading the picture…', { timeout: PREVIOUS_PICTURE_LIMIT_MS + 3000 });
    await atRest(page);
    const frames = await stopRecording(page);
    expect(frames.some((f) => f.date === held)).toBe(false);
    expect(namedBeforeDrawn(frames, fileOf)).toEqual([]);
    expect(disagreements(frames, fileOf)).toEqual([]);
    expect(passLineErrors(frames)).toEqual([]);
    // The case was really exercised: the pass before still named while the held one was asked for;
    // then nothing drawn and no date; then the sequence went on after its ceiling and ended.
    const asked = (f: Frame) => f.loading?.includes(held) ?? false;
    expect(frames.some((f) => asked(f) && f.date === FLIP[1] && f.drawn[0] === fileOf(FLIP[1]!))).toBe(true);
    expect(frames.some((f) => asked(f) && f.date === null && f.stamp === 'Loading the picture…' && f.drawn.length === 0 && f.seq === null)).toBe(true);
    expect(namedDates(frames)).toEqual([COVER_DATE, ...FLIP.filter((d) => d !== held)]);
    const waited = frames.filter(asked);
    expect(waited.at(-1)!.t - waited[0]!.t).toBeGreaterThan(PLAY_CEILING_MS - 500);
    await expectStep(page, 1);
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('Pause holds the picture and Play goes on; "Play again" plays it again from its first pass', async ({ page }) => {
    await sequenceStory(page);
    await openStory(page);
    await atRest(page);
    await page.keyboard.press('ArrowRight');
    const button = page.getByTestId('story-play');
    await whenLine(page, passLine(2));
    await expect(button).toHaveText('Pause');
    await button.click();
    await expect(button).toHaveText('Play');
    // A pass asked for just before the press may still arrive; it is then the one held. Once the
    // map has it on screen and the stamp names it: for 2 s the same picture, stamp and line.
    await waitForMapIdle(page);
    await expect
      .poll(async () => {
        const date = await stamp(page).getAttribute('data-drawn-date');
        return date !== null && (await drawnFiles(page)).join() === fileOf(date);
      })
      .toBe(true);
    const held = { date: await stamp(page).getAttribute('data-drawn-date'), files: await drawnFiles(page), line: await page.getByTestId('story-sequence').textContent() };
    expect(FLIP).toContain(held.date);
    await record(page);
    await page.waitForTimeout(2000);
    const frames = await stopRecording(page);
    expect(frames.length).toBeGreaterThan(30);
    for (const f of frames) expect({ date: f.date, files: f.drawn, line: f.seq }).toEqual(held);
    await button.click();
    await expect(button).toHaveText('Pause');
    await whenLine(page, passLine(FLIP.indexOf(held.date!) + 2));
    await atRest(page);
    await expect(button).toHaveText('Play again');
    await expect(stamp(page)).toHaveAttribute('data-drawn-date', MIDYEAR.date!);
    // Again, from the first pass: every pass named in order, ending on the step's.
    await record(page);
    await button.click();
    await expect(button).toHaveText('Pause');
    await whenLine(page, passLine(1));
    await atRest(page);
    const again = await stopRecording(page);
    expect(namedDates(again)).toEqual([MIDYEAR.date!, ...FLIP]);
    expect(passLineErrors(again)).toEqual([]);
    expect(disagreements(again, fileOf)).toEqual([]);
    await expect(button).toHaveText('Play again');
  });

  test("Next during the flip-book ends it on the step's own picture and camera; the next Next goes on", async ({ page }) => {
    await sequenceStory(page);
    await openStory(page);
    await atRest(page);
    await page.keyboard.press('ArrowRight');
    await whenLine(page, passLine(2));
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await expect(page.getByTestId('story-sequence'), 'the line stays, naming the picture on the map').toHaveText(`Pass ${FLIP.length} of ${FLIP.length}`);
    await expectStep(page, 1);
    // The camera too: at the step's view at once, not gliding there.
    const camera = await page.evaluate((view) => {
      const map = (window as unknown as { __map: MapLike }).__map;
      const at = map.project(view.center);
      const box = map.getContainer();
      return { moving: map.isMoving(), px: Math.hypot(at.x - box.clientWidth / 2, at.y - box.clientHeight / 2), zoom: map.getZoom() };
    }, MIDYEAR.view!);
    expect(camera.moving).toBe(false);
    expect(camera.px).toBeLessThan(1);
    expect(camera.zoom).toBeCloseTo(MIDYEAR.view!.zoom, 2);
    // No pass comes after the end.
    await page.waitForTimeout(1000);
    expect(await drawnFiles(page)).toEqual([fileOf(MIDYEAR.date!)]);
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 2);
  });

  test('Back during the flip-book goes back at once, and no pass comes after it', async ({ page }) => {
    await sequenceStory(page);
    await openStory(page);
    await atRest(page);
    await page.getByTestId('story-start').click();
    await whenLine(page, passLine(2));
    await page.getByTestId('story-back').click();
    await expect(page.getByTestId('story-eyebrow')).toHaveText(COVER_EYEBROW);
    await expect(stamp(page)).toHaveAttribute('data-drawn-date', COVER_DATE);
    await expect(page.getByTestId('story-sequence')).toHaveCount(0);
    await record(page);
    await page.waitForTimeout(1500);
    const frames = await stopRecording(page);
    for (const f of frames) expect(f.drawn).toEqual([fileOf(COVER_DATE)]);
    await expectStep(page, 0, COVER_DATE);
    expect(new URL(page.url()).search).toBe(`?story=${FIRST.id}`);
  });
});

test.describe('the points build day by day (honesty test 2)', () => {
  test('the fixture: the last pass to the end of the overlay\'s range, ten days or more, every day with a point', () => {
    expect(BUILD_DAYS).toBeGreaterThanOrEqual(10);
    for (let d = 0; d < BUILD_DAYS; d++) {
      const day = new Date(Date.parse(`${BUILD_FIRST}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
      expect(pointsDated(day, day), day).toBeGreaterThan(0);
    }
  });

  test("at every tick the caption's count, on the map and in the panel, is the number of points the map's filter lets through; it never goes down; the day line names the filter's last day; the last tick shows every point", async ({ page }) => {
    await openStory(page, `?story=${CLASSES.id}`);
    await expectStep(page, 2);
    await atRest(page);
    // In every animation frame, and also at every change of the page (record, `changes`).
    await record(page, { changes: true });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('story-sequence')).toContainText(`of ${BUILD_DAYS}: `);
    await atRest(page);
    const frames = await stopRecording(page);
    const changes = await recordedChanges(page);
    const counted = changes.filter((c) => captionCount(c.caption) !== null);
    expect(counted.length).toBeGreaterThan(BUILD_DAYS);
    for (const c of counted) expect(c.filter === null ? null : throughFilter(c.filter), `at a change of the page: "${c.caption}", filter ${c.filter}`).toBe(captionCount(c.caption));
    // Every state recorded with the points on the map, painted (a frame) or not (a change), in time order.
    const onMap = (records: readonly Frame[]) => records.filter((f) => f.index === 3 && f.filter !== null);
    const states = onMap([...frames, ...changes].sort((a, b) => a.t - b.t));
    expect(states.length, 'states with the points on the map').toBeGreaterThan(BUILD_DAYS);
    let before = 0;
    for (const f of states) {
      const through = throughFilter(f.filter!);
      const at = `${f.t.toFixed(0)} ms, filter ${f.filter}`;
      expect(captionCount(f.caption), `${at}: the caption on the map`).toBe(through);
      expect(f.figure, `${at}: the caption in the panel`).toContain(f.caption!);
      expect(through, `${at}: never fewer than before`).toBeGreaterThanOrEqual(before);
      before = through;
      const { first, last } = filterDays(f.filter!);
      expect(first, at).toBe(BUILD_FIRST);
      expect(f.caption, at).toContain(formatPeriod({ first: BUILD_FIRST, last: last! }));
      const line = f.seq ? /^Day (\d+) of (\d+): (.+)$/.exec(f.seq) : null;
      if (f.seq !== null) {
        expect(line, `${at}: "${f.seq}"`).not.toBeNull();
        const k = Number(line![1]);
        expect(Number(line![2])).toBe(BUILD_DAYS);
        expect(k, at).toBe(dayNumber(last!) - dayNumber(BUILD_FIRST) + 1);
        expect(line![3], at).toBe(formatDay(last!));
      } else expect(f.play, `${at}: no day line while the build runs`).not.toBe('Pause');
    }
    // No state shows every point first: the first with the points on the map shows the first day's alone.
    expect(filterDays(states[0]!.filter!).last, 'the first state on the map').toBe(BUILD_FIRST);
    expect(throughFilter(states[0]!.filter!), 'the first state on the map').toBeLessThan(BUILD_COUNT);
    // Every day took its tick, one after another, none skipped: the days the line named at the page's
    // changes.
    expect(withoutRepeats(onMap(changes).map(lineDay).filter((k) => k !== null))).toEqual(Array.from({ length: BUILD_DAYS }, (_, i) => i + 1));
    // And each day stayed on screen long enough to be seen: the first change naming day k + 1 comes
    // at least DAY_FLOOR_MS after the first change naming day k. The tick is a setTimeout of 120 ms
    // (FIRE_DAY_MS, story/timing.ts) that an effect arms after each commit (story/useStory.ts), and
    // React runs that effect only after the observer has recorded the commit: after a commit it
    // yields to the browser before its effects (measured: the timer armed 0.2 to 30 ms after the
    // record). So the next day can come no sooner than 120 ms after this day's record, and a slow
    // machine can only make a day last longer. Measured from day 2 on: 122 to 218 ms to the next day
    // at 1x, 4x and 6x CPU throttling and with slow painting (day 1 also waits for the camera, over a
    // second). 100 ms is well under that and well over a flash nobody could see. A literal, not
    // FIRE_DAY_MS: a floor imported from the site would shrink with a shortened tick.
    const DAY_FLOOR_MS = 100;
    const firstNaming = new Map<number, number>();
    for (const c of changes) {
      const k = lineDay(c);
      if (k !== null && !firstNaming.has(k)) firstNaming.set(k, c.t);
    }
    for (let k = 1; k < BUILD_DAYS; k++) {
      const shown = firstNaming.get(k + 1)! - firstNaming.get(k)!;
      expect(shown, `day ${k} on screen ${shown.toFixed(1)} ms before day ${k + 1}`).toBeGreaterThanOrEqual(DAY_FLOOR_MS);
    }
    // The frames painted showed the days in that order too, and the build under way.
    const painted = onMap(frames);
    const paintedDays = painted.map(lineDay).filter((k) => k !== null);
    expect(paintedDays, 'the days painted, in order').toEqual([...paintedDays].sort((a, b) => a - b));
    expect(painted.some((f) => f.play === 'Pause' && (lineDay(f) ?? BUILD_DAYS) < BUILD_DAYS), 'a frame painted while the points build').toBe(true);
    // The last tick shows every point of the period, as the step does at rest.
    expect(before).toBe(BUILD_COUNT);
    expect(throughFilter(painted.at(-1)!.filter!)).toBe(BUILD_COUNT);
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(`${OVERLAY.title}, ${formatPeriod({ first: BUILD_FIRST, last: BUILD_LAST })}: ${BUILD_COUNT}`);
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await expect(page.getByTestId('story-sequence'), 'the line stays, naming the whole period').toHaveText(`Day ${BUILD_DAYS} of ${BUILD_DAYS}: ${formatDay(BUILD_LAST)}`);
  });

  test('Next during the build shows every point at once; the next Next closes, with the step on the map', async ({ page }) => {
    await openStory(page, `?story=${CLASSES.id}`);
    await atRest(page);
    await page.keyboard.press('ArrowRight');
    await whenLine(page, EARLY_DAY);
    await page.keyboard.press('ArrowRight');
    const whole = `${OVERLAY.title}, ${formatPeriod({ first: BUILD_FIRST, last: BUILD_LAST })}: ${BUILD_COUNT}`;
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(whole);
    await expect(page.getByTestId('story-play')).toHaveText('Play again');
    await expect(page.getByTestId('story-sequence'), 'the line stays, naming the whole period').toHaveText(`Day ${BUILD_DAYS} of ${BUILD_DAYS}: ${formatDay(BUILD_LAST)}`);
    await expect(app(page)).toHaveAttribute('data-story', 'open');
    await page.keyboard.press('ArrowRight');
    await expect(app(page)).not.toHaveAttribute('data-story');
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(whole);
    await expect.poll(() => params(page).get('overlays')).toBe(OVERLAY_ID);
  });
});

test.describe('the stage', () => {
  /** The ids of the map's layers from bottom to top, with each layer's type. */
  const stack = (page: Page) =>
    page.evaluate(() =>
      (window as unknown as { __map: MapLike }).__map
        .getStyle()
        .layers.map((l) => ({ id: l.id, type: l.type })),
    );
  /** Checks the order: basemap fills and lines, the night, the data, then the outline or ring and the overlay's circles, then the basemap's labels. */
  async function expectOrder(page: Page, marks: { ring: boolean; outline: boolean; overlay?: boolean }): Promise<void> {
    const layers = await stack(page);
    const at = (pred: (l: { id: string; type: string }) => boolean) => layers.flatMap((l, i) => (pred(l) ? [i] : []));
    const night = at((l) => l.id === 'story-night');
    const data = at((l) => l.id.startsWith('data-'));
    const above = at((l) => l.id.startsWith('overlay-') || (l.id.startsWith('story-') && l.id !== 'story-night'));
    const firstLabel = layers.findIndex((l) => l.type === 'symbol' && !l.id.startsWith('story-') && !l.id.startsWith('overlay-'));
    const ids = layers.map((l) => l.id).filter((id) => id.startsWith('story-') || id.startsWith('overlay-'));
    expect(night, ids.join(' ')).toHaveLength(1);
    expect(data.length).toBeGreaterThan(0);
    expect(Math.max(...night), 'the night under every data layer').toBeLessThan(Math.min(...data));
    // Under the night only the basemap: no data, no overlay, nothing else of the story.
    expect(layers.slice(0, night[0]).filter((l) => /^(data|overlay|story)-/.test(l.id))).toEqual([]);
    expect(firstLabel).toBeGreaterThan(0);
    for (const i of above) {
      expect(i, `${layers[i]!.id} above every data layer`).toBeGreaterThan(Math.max(...data));
      expect(i, `${layers[i]!.id} under the basemap's labels`).toBeLessThan(firstLabel);
    }
    expect(Math.max(...data)).toBeLessThan(firstLabel);
    expect(ids.includes('story-site'), 'the ring').toBe(marks.ring);
    expect(ids.includes('story-outline'), 'the outline').toBe(marks.outline);
    if (marks.overlay !== undefined) expect(ids.includes(OVERLAY_LAYER), 'the overlay').toBe(marks.overlay);
    if (!marks.ring) expect(ids).not.toContain('story-site-echo');
  }
  /** The paint of every data layer: never a fade, never a transition of its opacity. */
  const dataPaint = (page: Page) =>
    page.evaluate(() => {
      const map = (window as unknown as { __map: MapLike }).__map;
      return map
        .getStyle()
        .layers.filter((l) => l.id.startsWith('data-'))
        .map((l) => ({ fade: map.getPaintProperty(l.id, 'raster-fade-duration'), transition: map.getPaintProperty(l.id, 'raster-opacity-transition') }));
    });
  const still = { fade: 0, transition: { duration: 0, delay: 0 } };

  test('the night under the data, the ring on the cover only, the outline on steps only, the circles and labels as before, also after a date changes; the data paint untouched', async ({ page }) => {
    await sequenceStory(page);
    await openStory(page);
    await atRest(page);
    await expectOrder(page, { ring: true, outline: false, overlay: false });
    for (const p of await dataPaint(page)) expect(p).toEqual(still);
    // Into the flip-book: every date is a fresh data layer, added while the story is open.
    await page.keyboard.press('ArrowRight');
    await whenLine(page, passLine(3));
    await expectOrder(page, { ring: false, outline: true, overlay: false });
    for (const p of await dataPaint(page)) expect(p).toEqual(still);
    await atRest(page);
    await expectOrder(page, { ring: false, outline: true, overlay: false });
    // The static layer, then the last pass of the other layer with the points building over it.
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 2);
    await atRest(page);
    await expectOrder(page, { ring: false, outline: true, overlay: false });
    await page.keyboard.press('ArrowRight');
    await whenLine(page, EARLY_DAY);
    await expectOrder(page, { ring: false, outline: true, overlay: true });
    await atRest(page);
    await expectOrder(page, { ring: false, outline: true, overlay: true });
    for (const p of await dataPaint(page)) expect(p).toEqual(still);
    // Home: the ring again, the outline gone.
    await page.keyboard.press('Home');
    await expectStep(page, 0, COVER_DATE);
    await atRest(page);
    await expectOrder(page, { ring: true, outline: false, overlay: false });
  });
});

test.describe('honest states through the sequences (honesty test 4)', () => {
  test('on a mixed-release site, in every frame: the warning in view on every step, whatever the layer, and the overlay\'s sentence and credit whenever its dots are on the map', async ({ page }) => {
    test.setTimeout(60_000);
    await editManifest(page, (site) => {
      site.source.release = 'mixed';
      site.story[0]!.date = COVER_DATE;
    });
    await openStory(page);
    await atRest(page);
    // In every animation frame, and also at every change of the page (record, `changes`).
    await record(page, { changes: true });
    for (const i of [1, 2, 3]) {
      await page.keyboard.press('ArrowRight');
      // At rest first: the flip-book alone takes longer than expectStep's polls wait.
      await atRest(page);
      await expectStep(page, i);
    }
    // The dots at rest ("Play again") in a frame painted. The step stays at rest, so a machine that
    // paints slowly paints that frame later, never not at all: wait for it.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __rec: Frame[] }).__rec.some((f) => f.filter !== null && f.play === 'Play again')), {
        message: 'a frame painted with the dots at rest',
        timeout: 10_000,
      })
      .toBe(true);
    const frames = await stopRecording(page);
    const changes = await recordedChanges(page);
    // On every step of a mixed-release site, whatever its layer (the static step 2 included: a map of
    // classes is itself made by comparing passes of both releases): in every frame painted and at every
    // change of the page.
    for (const [kind, records] of [['frame', frames], ['change of the page', changes]] as const) {
      for (const f of records) {
        const at = `${kind} on step ${f.index}, ${f.t.toFixed(0)} ms`;
        expect(f.index, at).toBeGreaterThanOrEqual(0);
        expect(f.warning, `${at}: the mixed-release warning`).toBe(MIXED_RELEASE_WARNING);
        if (f.filter !== null) {
          expect(f.mapNote, `${at}: the sentence on the map`).toContain(OVERLAY_NOT_NISAR);
          expect(f.mapCaptionInView, at).toBe(true);
          expect(f.figure, `${at}: the sentence in the panel`).toContain(OVERLAY_NOT_NISAR);
          expect(f.figure, `${at}: the credit in the panel`).toContain(`Credit: ${OVERLAY.credit}`);
          expect(f.figureInView, at).toBe(true);
        }
      }
    }
    // The dots were on the map, and so checked, at every day of the build (each a change of the page,
    // however slowly the machine paints), in frames painted while they built, and after.
    expect(withoutRepeats(changes.filter((c) => c.filter !== null).map(lineDay).filter((k) => k !== null))).toEqual(Array.from({ length: BUILD_DAYS }, (_, i) => i + 1));
    expect(frames.some((f) => f.filter !== null && f.seq?.startsWith('Day '))).toBe(true);
    expect(frames.some((f) => f.filter !== null && f.play === 'Play again'), 'a frame painted with the dots at rest').toBe(true);
    expect(frames.some((f) => f.seq?.startsWith('Pass '))).toBe(true);
  });
});

test.describe('closing (honesty test 6)', () => {
  /** Waits until nothing of the story is on the map or the page, within 2 s of closing, with the labels as `labels`. */
  async function expectGivenBack(page: Page, labels: string[][]): Promise<void> {
    await expect(app(page)).not.toHaveAttribute('data-story');
    expect(await labelColours(page)).toEqual(labels);
    await expect.poll(() => storyLayers(page), { timeout: 2000 }).toEqual([]);
    expect(await labelColours(page)).toEqual(labels);
    await expect(page.locator('.maplibregl-canvas-container')).not.toHaveAttribute('inert');
    await expect(page.locator('.maplibregl-ctrl-top-right')).not.toHaveAttribute('inert');
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  }
  /** The basemap's label colours on a page that never opened the story. */
  async function labelsWithoutStory(page: Page): Promise<string[][]> {
    const other = await page.context().newPage();
    await other.goto('./?story=off');
    await expect(other.locator('#site-title')).toBeVisible();
    await other.waitForFunction(() => ((window as unknown as { __map?: MapLike }).__map?.getStyle()?.layers ?? []).some((l) => l.type === 'symbol'));
    const labels = await labelColours(other);
    await other.close();
    expect(labels.length).toBeGreaterThan(0);
    return labels;
  }

  test('from the cover, from a step, and in the middle of each sequence: within 2 s nothing of the story is left, the labels are as they were, nothing is inert', async ({ page }) => {
    test.setTimeout(90_000);
    const labels = await labelsWithoutStory(page);
    await sequenceStory(page);
    // From the cover, with Escape.
    await openStory(page);
    await atRest(page);
    expect(await labelColours(page)).not.toEqual(labels); // the night's labels, so the check below means something
    await page.keyboard.press('Escape');
    await expectGivenBack(page, labels);
    // From a step at rest, with "Explore the map".
    await openStory(page, `?story=${CLASSES.id}`);
    await atRest(page);
    await page.getByTestId('story-exit').click();
    await expectGivenBack(page, labels);
    // In the middle of the flip-book, with Escape: the step's FINAL state stays, not the pass on screen.
    await openStory(page);
    await atRest(page);
    await page.keyboard.press('ArrowRight');
    await whenLine(page, passLine(2));
    await page.keyboard.press('Escape');
    await expectGivenBack(page, labels);
    await expect.poll(() => params(page).get('date')).toBe(MIDYEAR.date);
    expect(params(page).get('layer')).toBe(YEAR_LAYERS.hh);
    await expect(page.getByTestId('current-date')).toHaveText(MIDYEAR.date!);
    await expect.poll(() => drawnFiles(page)).toEqual([file(YEAR_LAYERS.hh, MIDYEAR.date!)]);
    // In the middle of the build, with "Explore the map": every point of the period, no cap.
    await openStory(page, `?story=${CLASSES.id}`);
    await atRest(page);
    await page.keyboard.press('ArrowRight');
    await whenLine(page, EARLY_DAY);
    await page.getByTestId('story-exit').click();
    await expectGivenBack(page, labels);
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(`${OVERLAY.title}, ${formatPeriod({ first: BUILD_FIRST, last: BUILD_LAST })}: ${BUILD_COUNT}`);
    await expect.poll(() => params(page).get('overlays')).toBe(OVERLAY_ID);
    expect(params(page).get('date')).toBe(LAST_HV);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing reports a duration and the camera is never moving: one jump per step', async ({ page }) => {
    await openStory(page);
    await expectStep(page, 0);
    await waitForMapIdle(page);
    await page.evaluate(() => {
      const w = window as unknown as { __map: MapLike; __moving: number; __starts: number };
      w.__moving = 0;
      w.__starts = 0;
      w.__map.on('movestart', () => (w.__starts += 1));
      const look = () => {
        if (w.__map.isMoving()) w.__moving += 1;
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    // The camera and the moves started so far.
    const now = () =>
      page.evaluate(() => {
        const w = window as unknown as { __map: MapLike; __starts: number };
        const c = w.__map.getCenter();
        return { camera: `${c.lng.toFixed(6)} ${c.lat.toFixed(6)} ${w.__map.getZoom().toFixed(4)}`, starts: w.__starts, moving: w.__map.isMoving() };
      });
    // One jump for every step whose camera differs from the one before, none for a step that frames the
    // same view (two steps that both frame the site: the camera is already there), never a glide.
    let jumps = 0;
    const moves: [string, number][] = [...STEPS.slice(1).map((_, i): [string, number] => ['ArrowRight', i + 1]), ['Home', 0]];
    for (const [key, step] of moves) {
      const before = await now();
      await page.keyboard.press(key);
      await expectStep(page, step);
      const after = await now();
      expect(after.moving, `${key} to step ${step}`).toBe(false);
      expect(after.starts - before.starts, `${key} to step ${step}: ${before.camera} -> ${after.camera}`).toBe(after.camera === before.camera ? 0 : 1);
      jumps += after.starts - before.starts;
    }
    expect(await moving(page)).toEqual([]);
    const seen = await page.evaluate(() => (window as unknown as { __moving: number }).__moving);
    expect(seen).toBe(0);
    // The fixture's story moves the camera at least twice (to a step's own view, and back to the cover).
    expect(jumps).toBeGreaterThanOrEqual(2);
  });

  test('no sequence starts by itself (honesty test 5): each step shows its final state at once and offers its sequence; a press plays it; nothing has a duration or a delay; the camera never moves', async ({ page }) => {
    test.setTimeout(60_000);
    const asked: string[] = [];
    page.on('request', (r) => {
      const name = new URL(r.url()).pathname.split('/').pop() ?? '';
      if (name.endsWith('.tif')) asked.push(name);
    });
    await sequenceStory(page);
    await openStory(page);
    await expectStep(page, 0, COVER_DATE);
    await atRest(page);
    await record(page);
    const button = page.getByTestId('story-play');
    const line = page.getByTestId('story-sequence');
    // The flip-book's step: its own picture at once, no pass in between asked for, the button offering them.
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 1);
    await expect(button).toHaveText(`Play these ${FLIP.length} passes`);
    await expect(line, 'reached without playing: the line names the picture on the map').toHaveText(`Pass ${FLIP.length} of ${FLIP.length}`);
    await page.waitForTimeout(1500);
    await expect(button).toHaveText(`Play these ${FLIP.length} passes`);
    expect(await drawnFiles(page)).toEqual([file(YEAR_LAYERS.hh, MIDYEAR.date!)]);
    expect(asked.filter((name) => FLIP.slice(0, -1).some((d) => name === file(YEAR_LAYERS.hh, d)))).toEqual([]);
    expect(await moving(page)).toEqual([]);
    expect(await delayed(page)).toEqual([]);
    // A press plays it, every pass in turn, and it ends where it was.
    await button.click();
    await expect(button).toHaveText('Pause');
    await whenLine(page, passLine(1));
    expect(await moving(page)).toEqual([]);
    expect(await delayed(page)).toEqual([]);
    await atRest(page);
    await expect(button).toHaveText('Play again');
    await expect(stamp(page)).toHaveAttribute('data-drawn-date', MIDYEAR.date!);
    // The build's step: every point of the period at once, the button offering the days.
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 2);
    await page.keyboard.press('ArrowRight');
    await expectStep(page, 3);
    const whole = `${OVERLAY.title}, ${formatPeriod({ first: BUILD_FIRST, last: BUILD_LAST })}: ${BUILD_COUNT}`;
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(whole);
    await expect(button).toHaveText('Play day by day');
    await expect(line, 'reached without playing: the whole period is on the map').toHaveText(`Day ${BUILD_DAYS} of ${BUILD_DAYS}: ${formatDay(BUILD_LAST)}`);
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(whole);
    await button.click();
    await whenLine(page, EARLY_DAY);
    expect(await moving(page)).toEqual([]);
    expect(await delayed(page)).toEqual([]);
    await atRest(page);
    await expect(button).toHaveText('Play again');
    await expect(page.getByTestId('overlay-map-caption-text')).toHaveText(whole);
    const frames = await stopRecording(page);
    // The camera never moved, in any frame; the passes played only after the press, each in turn.
    expect(frames.filter((f) => f.moving)).toEqual([]);
    // (The cover's picture may still be named for a few frames on step 1, until the step's own is drawn.)
    const named = namedDates(frames.filter((f) => f.index === 1));
    expect(named[0] === COVER_DATE ? named.slice(1) : named).toEqual([MIDYEAR.date!, ...FLIP]);
    expect(passLineErrors(frames.filter((f) => f.index === 1))).toEqual([]);
  });
});

test.describe('on a desktop (1280 x 800)', () => {
  test("the panel takes exactly the side column's place; the map keeps its size; the credit line is uncovered and reachable on the cover", async ({ page }) => {
    await openStory(page);
    await expectStep(page, 0);
    const [p, side, mapOpen] = [(await panel(page).boundingBox())!, (await page.locator('.side').boundingBox())!, (await page.locator('.map-wrap').boundingBox())!];
    expect(p.x).toBeCloseTo(side.x, 0);
    expect(p.width).toBeCloseTo(side.width, 0);
    expect(p.y).toBeCloseTo(side.y, 0);
    expect(p.height).toBeCloseTo(side.height, 0);
    // The credit line is what a click on it reaches, above the cover's scrim.
    const attrib = (await page.locator('.maplibregl-ctrl-attrib').boundingBox())!;
    const hit = await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x!, y!)?.closest('.maplibregl-ctrl-attrib')), [attrib.x + attrib.width - 8, attrib.y + attrib.height / 2]);
    expect(hit).toBe(true);
    await page.keyboard.press('Escape');
    await expect(app(page)).not.toHaveAttribute('data-story');
    const mapClosed = (await page.locator('.map-wrap').boundingBox())!;
    expect(mapClosed).toEqual(mapOpen);
  });
});

/** The stamp, the credit line and the scale, and whether the stamp is on top where it lies. */
const stampPlace = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    };
    const el = document.querySelector<HTMLElement>('[data-testid="story-stamp"]')!;
    // Hit-test the stamp's middle with taps allowed on it for a moment (it takes none otherwise).
    const notes = el.closest<HTMLElement>('.map-notes');
    el.style.pointerEvents = 'auto';
    if (notes) notes.style.pointerEvents = 'auto';
    const r = el.getBoundingClientRect();
    const onTop = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    el.style.pointerEvents = '';
    if (notes) notes.style.pointerEvents = '';
    return { stamp: box('[data-testid="story-stamp"]')!, credit: box('.maplibregl-ctrl-attrib'), scale: box('.maplibregl-ctrl-scale'), map: box('#map')!, onTop };
  });

for (const [size, use] of [
  ['1280 x 800', { viewport: { width: 1280, height: 800 } }],
  ['375 x 812', PHONE],
] as const) {
  test.describe(`the stamp at ${size}, with a citation of real length`, () => {
    test.use(use);

    test('overlaps neither the credit line nor the scale, on the cover and on a step, and is never hidden', async ({ page }) => {
      const citation = realLengthTexts().citation;
      await editManifest(page, (site) => {
        site.source.citation = citation;
      });
      await openStory(page);
      for (const i of [0, 1]) {
        if (i > 0) await page.keyboard.press('ArrowRight');
        await expectStep(page, i);
        await waitForMapIdle(page);
        await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText(citation);
        // The tool's tag and the stamp are never both there.
        await expect(page.getByTestId('map-showing')).toHaveCount(0);
        await expect(stamp(page)).toHaveCount(1);
        const m = await stampPlace(page);
        expect(m.credit && overlap(m.stamp, m.credit), `step ${i}: stamp and credit line`).toBe(false);
        expect(m.scale && overlap(m.stamp, m.scale), `step ${i}: stamp and scale`).toBe(false);
        expect(m.onTop, `step ${i}: the stamp is on top where it lies`).toBe(true);
        if (size === '375 x 812') expect(m.stamp.y, 'on a phone, under the map').toBeGreaterThanOrEqual(m.map.y + m.map.height - 0.5);
        else expect(m.stamp.y + m.stamp.height, 'on a desktop, on the map').toBeLessThanOrEqual(m.map.y + m.map.height);
      }
    });
  });
}

/** A SYNTHETIC text of about 1,000 characters, for a step whose words run long. */
const LONG_TEXT = Array.from({ length: 10 }, (_, i) => `SYNTHETIC long step text, sentence ${i + 1}, which makes the made-up step as long as a real one may be.`).join(' ');

// At 375 x 812 and 375 x 667 the first screen shows the map and the step's title above the bar. At
// 320 x 640 the fixture's long SYNTHETIC sample notice (about five lines there) takes that room, so
// only the column's position, the width and the targets are checked (the real site has no notice).
for (const { firstScreen, ...viewport } of [
  { width: 375, height: 812, firstScreen: true },
  { width: 375, height: 667, firstScreen: true },
  { width: 320, height: 640, firstScreen: false },
]) {
  test.describe(`on a ${viewport.width} x ${viewport.height} phone`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test('the map and the title come first, nothing sticks out, 44 px targets, the sticky bar covers nothing', async ({ page }) => {
      await editManifest(page, (site) => {
        site.story[0]!.text = `${site.story[0]!.text} ${LONG_TEXT}`;
        site.story[1]!.text = `${site.story[1]!.text} ${LONG_TEXT}`;
      });
      await openStory(page);
      for (const i of [0, 1]) {
        if (i === 1) await page.getByTestId('story-start').click();
        await expectStep(page, i);
        await expect(page.getByTestId('story-cover')).toHaveCount(0);
        await expect(page.locator('.side')).toBeHidden();
        await expect(page.locator('.tagline')).toBeHidden();
        // The first screen: the column at its top, the map and the step's title in view, the bar too.
        await expect.poll(() => page.locator('.main').evaluate((el) => el.scrollTop)).toBe(0);
        const map = (await page.locator('.map-wrap').boundingBox())!;
        expect(map.y, 'the map starts in view').toBeGreaterThanOrEqual(0);
        expect(map.y + map.height, 'the map ends in view').toBeLessThanOrEqual(viewport.height);
        await expect(page.locator('.story-nav')).toBeInViewport({ ratio: 1 });
        if (firstScreen) await expect(page.getByTestId('story-title')).toBeInViewport({ ratio: 1 });
        // Nothing sticks out sideways.
        const wide = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - window.innerWidth,
          wide: [...document.querySelectorAll('body *')]
            .filter((el) => !el.parentElement?.closest('#map'))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > window.innerWidth + 0.5;
            })
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
        }));
        expect(wide).toEqual({ page: 0, wide: [] });
        // Targets: the bar's two buttons and "Explore the map" 44 x 44; the segments 44 tall.
        const targets: Locator[] =
          i === 0 ? [page.getByTestId('story-start'), page.getByTestId('story-exit')] : [page.getByTestId('story-next'), page.getByTestId('story-back'), page.getByTestId('story-exit')];
        for (const target of targets) {
          const b = (await target.boundingBox())!;
          expect(b.height, await target.innerText()).toBeGreaterThanOrEqual(44);
          expect(b.width, await target.innerText()).toBeGreaterThanOrEqual(44);
        }
        for (const seg of await page.locator('.story-progress-step').all()) {
          const b = (await seg.boundingBox())!;
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.width).toBeGreaterThanOrEqual(24);
        }
        // On the cover "Explore the map" is in the bar, at its left; Start at its right.
        if (i === 0) {
          const [exit, start] = [(await page.getByTestId('story-exit').boundingBox())!, (await page.getByTestId('story-start').boundingBox())!];
          expect(exit.x).toBeLessThan(start.x);
          await expect(page.locator('.story-nav').getByTestId('story-exit')).toHaveCount(1);
        }
        // Scrolled to the end, the bar covers neither the last line of the text nor the credit.
        await page.locator('.main').evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const nav = (await page.locator('.story-nav').boundingBox())!;
        const text = (await page.getByTestId('story-text').boundingBox())!;
        const credit = (await page.getByTestId('story-credit').boundingBox())!;
        expect(text.y + text.height).toBeLessThanOrEqual(nav.y + 0.5);
        expect(credit.y + credit.height).toBeLessThanOrEqual(nav.y + 0.5);
        await page.locator('.main').evaluate((el) => el.scrollTo(0, 0));
      }
      // Focus moved by Tab is never under the sticky bar: every control the panel offers, ring and all.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      let checked = 0;
      for (let k = 0; k < 14; k++) {
        await page.keyboard.press('Tab');
        const seen = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const nav = document.querySelector('.story-nav')!.getBoundingClientRect();
          if (!el || el === document.body || !el.closest('.story-panel') || el.closest('.story-nav')) return null;
          const r = el.getBoundingClientRect();
          // The ring: a 3 px outline 2 px out.
          const ring = { top: r.top - 5, bottom: r.bottom + 5 };
          return { name: el.getAttribute('aria-label') ?? el.textContent, covered: ring.bottom > nav.top && ring.top < nav.bottom, inView: ring.top >= 0 && ring.bottom <= window.innerHeight };
        });
        if (!seen) continue;
        checked += 1;
        expect(seen.covered, `the bar covers the ring of "${seen.name}"`).toBe(false);
        expect(seen.inView, `"${seen.name}" is in view`).toBe(true);
      }
      expect(checked).toBeGreaterThan(0);
    });

    // The fixture site is a sample, and its SYNTHETIC notice stays on screen above the map; a real site
    // (the one the story is for) has none. Without it, as there, the title sits above the bar.
    if (firstScreen) test('on a site that is not a sample, the first screen shows the map and the whole title above the bar, on the cover and after Next', async ({ page }) => {
      await editManifest(page, (site) => {
        (site as Record<string, unknown>).is_sample = false;
        delete (site as Record<string, unknown>).notice;
      });
      await openStory(page);
      await expect(page.getByTestId('sample-notice')).toHaveCount(0);
      for (const i of [0, 1]) {
        if (i === 1) await page.getByTestId('story-start').click();
        await expectStep(page, i);
        await expect.poll(() => page.locator('.main').evaluate((el) => el.scrollTop)).toBe(0);
        const [map, title, bar] = [
          (await page.locator('.map-wrap').boundingBox())!,
          (await page.getByTestId('story-title').boundingBox())!,
          (await page.locator('.story-nav').boundingBox())!,
        ];
        expect(map.y).toBeGreaterThanOrEqual(0);
        expect(title.y).toBeGreaterThanOrEqual(map.y + map.height);
        expect(title.y + title.height, 'the title is above the bar').toBeLessThanOrEqual(bar.y + 0.5);
        expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height + 0.5);
      }
    });

    test('nothing of the story lies on the map: the stamp in the strip under it, the zoom buttons hidden', async ({ page }) => {
      await openStory(page, `?story=${MIDYEAR.id}`);
      await expectStep(page, 1);
      const map = (await page.locator('#map').boundingBox())!;
      const s = (await stamp(page).boundingBox())!;
      expect(s.y).toBeGreaterThanOrEqual(map.y + map.height - 0.5);
      await expect(page.getByRole('button', { name: 'Zoom in' })).toBeHidden();
      // A grid of points over the map hits the map (its inert canvas falls through to #map) or
      // MapLibre's own controls, never anything of the app.
      const other = await page.evaluate(() => {
        const r = document.querySelector('#map')!.getBoundingClientRect();
        const out: string[] = [];
        for (let i = 0; i < 12; i++)
          for (let j = 0; j < 12; j++) {
            const hit = document.elementFromPoint(r.left + 2 + ((r.width - 4) * (i + 0.5)) / 12, r.top + 2 + ((r.height - 4) * (j + 0.5)) / 12);
            if (!hit?.closest('#map')) out.push(hit ? `${hit.tagName.toLowerCase()}.${String(hit.className)}` : 'nothing');
          }
        return out;
      });
      expect(other).toEqual([]);
    });
  });
}

test.describe('in a contrast theme (forced colours)', () => {
  test.use({ forcedColors: 'active' });

  test('every story surface has a border, and the current step is told by its shape', async ({ page }) => {
    await openStory(page, `?story=${MIDYEAR.id}`);
    await expectStep(page, 1);
    for (const target of [panel(page), stamp(page), page.getByTestId('story-next'), page.getByTestId('story-back')]) {
      const [style, width] = await target.evaluate((el) => [getComputedStyle(el).borderTopStyle, parseFloat(getComputedStyle(el).borderTopWidth)] as const);
      expect(style).toBe('solid');
      expect(width).toBeGreaterThanOrEqual(1);
    }
    const marks = page.locator('.story-progress-mark');
    const heights = await marks.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights[1]).toBeGreaterThan(heights[0]!);
    const colours = await marks.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(colours[1]).not.toBe(colours[0]);
    await openStory(page);
    await expect(page.locator('.story-cover-block')).toHaveCSS('border-top-style', 'solid');
  });
});
