// The year as a curve (docs/MOTION_AND_STORY_BRIEF.md, slice 5; components/YearCurve.tsx) on the
// SYNTHETIC fixtures: above the date stepper's marks in the tool, and as a story step's figure.
//
// Honesty test 3 of the brief, in the page: every segment drawn joins two passes that are neighbours on
// the timeline, the line breaks at every missing pass, at every date the layer has no file for and at
// every null value, and there are exactly as many segments as the manifest and stats.json say. In the
// story the curve never shows a pass later than the picture the map has drawn, in any animation frame
// and at any change of the page.
// What the curve should be is worked out here from the fixture module's manifest and stats.json, not
// with the app's own functions. These tests are the point of the work: never weaken them later.
//
// No step of the fixture year site's story plays passes as committed (its cover shows the newest date
// and the step after it an earlier one, a cut; the cross-pol step follows the static layer, also a cut,
// and builds its points day by day), so the flip-book tests below serve a SYNTHETIC copy of the
// manifest in the test's browser in which the second step plays the last eight co-pol passes.

import type { Page } from '@playwright/test';
import {
  buildManifest,
  buildStats,
  buildYearStats,
  HV_ABSENT_DATE,
  PASS_SLOTS,
  SITE_ID,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_SITE_ID,
} from '../tests/fixtures/synthetic.mjs';
import { expect, test, waitForMapIdle } from './support';

type MapLike = import('maplibre-gl').Map;

interface SiteLike {
  id: string;
  dates: { date: string }[];
  missing_passes: { date: string }[];
  layers: { id: string; kind: string; items: { date?: string }[] }[];
  story?: { id: string; layer?: string; date?: string }[];
}
interface StatsLike {
  series: { id: string; title: string; layer?: string; unit: string; points: { date: string; value: number | null }[] }[];
}

const manifest = buildManifest() as unknown as { sites: SiteLike[] };
const siteOf = (id: string) => manifest.sites.find((s) => s.id === id)!;
const YEAR = siteOf(YEAR_SITE_ID);
const YEAR_STATS = buildYearStats() as unknown as StatsLike;
const LAST_HH = YEAR_DATES[YEAR_DATES.length - 1]!;
/** The step after the cover (it has a view and the co-pol layer). */
const SECOND = YEAR.story![1]!;
/** In the SYNTHETIC copy served by playThePasses: the cover shows this pass, the second step plays on to LAST_HH. */
const FLIP_FROM = PASS_SLOTS[20]!;
const PHONE = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };

/**
 * What the curve of `layerId` is, from the manifest and stats.json alone: a dot for every pass the
 * layer has a file for and the layer's dB series a value for; a segment between two such passes only
 * when no other pass (an acquisition or a missing pass) lies between them; the passes that break it.
 */
function expected(site: SiteLike, layerId: string, stats: StatsLike) {
  const layer = site.layers.find((l) => l.id === layerId)!;
  const series = stats.series.find((s) => s.layer === layerId && s.unit === 'dB')!;
  const values = new Map(series.points.flatMap((p) => (typeof p.value === 'number' ? [[p.date, p.value] as const] : [])));
  const inLayer = new Set(layer.items.map((i) => i.date));
  const passes = [...new Set([...site.dates.map((d) => d.date), ...site.missing_passes.map((m) => m.date)])].sort();
  const drawn = (d: string) => inLayer.has(d) && values.has(d);
  const segments: [string, string][] = [];
  for (let i = 0; i + 1 < passes.length; i++) if (drawn(passes[i]!) && drawn(passes[i + 1]!)) segments.push([passes[i]!, passes[i + 1]!]);
  return { series, passes, dots: passes.filter(drawn), segments, breaks: passes.filter((d) => !drawn(d)) };
}

/** The curve as the page draws it: its series, its dots' dates (sorted), its segments, the marked dot. */
const readCurve = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => ({
    series: (el as HTMLElement).dataset.series ?? null,
    hidden: el.closest('[aria-hidden="true"]') !== null,
    dots: [...el.querySelectorAll<SVGCircleElement>('circle.curve-dot')].map((c) => c.dataset.date!).sort(),
    segments: [...el.querySelectorAll<SVGLineElement>('line.curve-segment')].map((l) => [l.dataset.from!, l.dataset.to!] as [string, string]),
    current: el.querySelector<SVGCircleElement>('circle[data-current]')?.dataset.date ?? null,
  }));

/** Whether a segment runs across `date` or ends on it. */
const touches = ([a, b]: [string, string], date: string) => a === date || b === date || (a < date && b > date);

async function openTool(page: Page, query = '?story=off'): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.locator('#site-title')).toBeVisible();
  await expect(page.getByTestId('current-date')).toBeVisible();
}

/** For this page only, serves the fixture manifest with the year site changed by `edit` (a SYNTHETIC copy in the test's browser). */
async function editYearSite(page: Page, edit: (site: SiteLike) => void): Promise<void> {
  await page.route('**/manifest.json', async (route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { sites: SiteLike[] };
    edit(json.sites.find((s) => s.id === YEAR_SITE_ID)!);
    await route.fulfill({ response, json });
  });
}

/** The cover shows FLIP_FROM; the second step plays every co-pol pass after it up to LAST_HH. */
const playThePasses = (page: Page) =>
  editYearSite(page, (site) => {
    site.story![0]!.date = FLIP_FROM;
    site.story![1]!.date = LAST_HH;
  });

/** Opens `query` and waits until the story is open and the map has drawn. */
async function openStory(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.locator('.app')).toHaveAttribute('data-story', 'open');
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: MapLike }).__map?.getStyle()?.sources));
  await waitForMapIdle(page);
}

/** Every element among `selector`'s that reports a non-zero transition or animation duration. */
const moving = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel)]
        .filter((el) => {
          const style = getComputedStyle(el);
          const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
          return nonZero(style.transitionDuration) || nonZero(style.animationDuration) || style.animationName !== 'none';
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class')}`),
    selector,
  );
const CURVE_PARTS = '[data-testid="timeline-curve"], [data-testid="timeline-curve"] *, [data-testid="curve-months"], [data-testid="curve-months"] *';
const STORY_CURVE_PARTS = '[data-testid="story-curve-figure"], [data-testid="story-curve-figure"] *';

/** One animation frame of the story, or one change of the page: the stamp's date, the files the map draws, and the story's curve. */
interface Frame {
  /** When the record began (performance.now(), taken before anything is read). */
  t: number;
  step: string | null;
  stamp: string | null;
  drawn: string[];
  dots: string[];
  segments: [string, string][];
  current: string | null;
}

/**
 * From now on, notes what the page shows in every animation frame (framesOf) and at every change of
 * the page (changesOf). Frames are what was painted, and a slow machine paints few: on CI's small
 * machines (software WebGL) a frame can take longer than a state of the page lasts, so it may never
 * be painted. A MutationObserver's callback comes right after React's commit, before any later task,
 * so the changes hold every state the page's DOM went through, with the files the map drew then,
 * however slowly it paints (as record in e2e/story.spec.ts).
 */
const recordFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __curveFrames: unknown[]; __curveChanges: unknown[]; __map: MapLike };
    w.__curveFrames = [];
    w.__curveChanges = [];
    const snapshot = () => {
      const t = performance.now();
      const map = w.__map;
      const curve = document.querySelector('[data-testid="story-curve"]');
      const sources = map.getStyle()?.sources ?? {};
      return {
        t,
        step: new URL(location.href).searchParams.get('story'),
        stamp: document.querySelector<HTMLElement>('[data-testid="story-stamp"]')?.dataset.drawnDate ?? null,
        drawn: Object.keys(sources)
          .filter((id) => id.startsWith('data-') && Number(map.getPaintProperty(id, 'raster-opacity')) > 0)
          .map((id) => ((map.getSource(id) as unknown as { url?: string }).url ?? '').replace('cog://', '').split('#')[0]!.split('/').pop()!),
        dots: curve ? [...curve.querySelectorAll<SVGCircleElement>('circle.curve-dot')].map((c) => c.dataset.date!).sort() : [],
        segments: curve ? [...curve.querySelectorAll<SVGLineElement>('line.curve-segment')].map((l) => [l.dataset.from!, l.dataset.to!]) : [],
        current: curve?.querySelector<SVGCircleElement>('circle[data-current]')?.dataset.date ?? null,
      };
    };
    const look = () => {
      w.__curveFrames.push(snapshot());
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    new MutationObserver(() => w.__curveChanges.push(snapshot())).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
const framesOf = (page: Page) => page.evaluate(() => (window as unknown as { __curveFrames: Frame[] }).__curveFrames);
const changesOf = (page: Page) => page.evaluate(() => (window as unknown as { __curveChanges: Frame[] }).__curveChanges);

/** `values` without the repeats of the value just before (1, 1, 2, 2, 2, 3 gives 1, 2, 3). */
function withoutRepeats<T>(values: readonly T[]): T[] {
  return values.filter((v, i) => i === 0 || v !== values[i - 1]);
}

/** The date of a fixture data file (synthetic.mjs names them <layer>_<date>.tif), or null. */
const dateOfFile = (file: string | undefined) => /_(\d{4}-\d{2}-\d{2})\.tif$/.exec(file ?? '')?.[1] ?? null;

/**
 * The rules every frame of the story's curve keeps: no dot later than the picture the stamp names (the
 * same report, so in the same frame), none at all while it names none, the marked dot that very
 * picture, every segment between two dots on screen and one the whole curve has. Returns the frames
 * that break one, with why.
 */
function brokenFrames(frames: Frame[], whole: { segments: [string, string][] }): string[] {
  const wanted = new Set(whole.segments.map(([a, b]) => `${a}/${b}`));
  const bad: string[] = [];
  for (const f of frames) {
    const why = (text: string) => bad.push(`${Math.round(f.t)} ms, ${f.step}, stamp ${f.stamp}: ${text}`);
    if (f.stamp === null && f.dots.length > 0) why(`${f.dots.length} dots while the stamp names no picture`);
    if (f.stamp !== null && f.dots.some((d) => d > f.stamp!)) why(`a dot later than the picture drawn: ${f.dots.filter((d) => d > f.stamp!).join(', ')}`);
    if (f.dots.length > 0 && f.current !== f.stamp) why(`the marked dot is ${f.current}`);
    for (const [a, b] of f.segments) {
      if (!f.dots.includes(a) || !f.dots.includes(b)) why(`segment ${a} to ${b} without both its dots`);
      if (!wanted.has(`${a}/${b}`)) why(`segment ${a} to ${b} that the curve does not have`);
    }
  }
  return bad;
}

/**
 * Against the map itself (the file it draws, not the app's report of it): no dot later than the date of
 * the picture on the map. The map flips a source's opacity in one frame and React writes the curve in
 * a later one, so a run of disagreeing frames up to 100 ms is allowed, never longer (as e2e/story.spec.ts
 * allows for the stamp).
 */
function aheadOfTheMap(frames: Frame[]): Frame[][] {
  const runs: Frame[][] = [];
  let run: Frame[] = [];
  for (const f of [...frames, null]) {
    const shown = f ? dateOfFile(f.drawn.length === 1 ? f.drawn[0] : undefined) : null;
    if (f && f.dots.length > 0 && (shown === null || f.dots.some((d) => d > shown))) run.push(f);
    else {
      if (run.length > 0 && run.at(-1)!.t - run[0]!.t > 100) runs.push(run);
      run = [];
    }
  }
  return runs;
}

test.describe('the curve above the timeline', () => {
  const cases = [
    { name: 'the year site, co-pol (four missing passes, two of them neighbours)', query: '?story=off', site: YEAR, layer: YEAR_LAYERS.hh, stats: YEAR_STATS },
    { name: 'the first site, a missing pass and a null value at its last date', query: `?site=${SITE_ID}`, site: siteOf(SITE_ID), layer: 'hh', stats: buildStats() as unknown as StatsLike },
  ];
  for (const c of cases) {
    test(`${c.name}: each segment joins neighbouring passes, the line breaks at every gap, as many segments as the data say`, async ({ page }) => {
      await openTool(page, c.query);
      await expect(page.getByTestId('timeline-curve')).toBeVisible();
      const want = expected(c.site, c.layer, c.stats);
      const got = await readCurve(page, 'timeline-curve');
      expect(got.series).toBe(want.series.id);
      expect(got.hidden).toBe(true);
      expect(got.dots).toEqual(want.dots);
      expect(got.segments).toEqual(want.segments);
      for (const [a, b] of got.segments) expect(want.passes.indexOf(b) - want.passes.indexOf(a), `${a} to ${b}`).toBe(1);
      for (const gap of want.breaks) for (const s of got.segments) expect(touches(s, gap), `${s.join(' to ')} at ${gap}`).toBe(false);
      // The case is really exercised: every missing pass breaks the line, and on the first site the null value does.
      expect(want.breaks).toEqual(expect.arrayContaining(c.site.missing_passes.map((m) => m.date)));
      if (c.site.id === SITE_ID) expect(want.breaks).toContain(c.stats.series.find((s) => s.id === want.series.id)!.points.find((p) => p.value === null)!.date);
    });
  }

  test('a date the layer has no file for breaks the line, although the series has a value for it', async ({ page }) => {
    // A SYNTHETIC copy of stats.json with a dB series for the cross-pol layer that has a value for every
    // pass, the one the layer has no file for included.
    const stats = buildYearStats() as unknown as StatsLike;
    stats.series.push({
      id: 'syn-mean-hv-test',
      title: 'SYNTHETIC mean cross-pol echo (a copy made by e2e/curve.spec.ts)',
      unit: 'dB',
      layer: YEAR_LAYERS.hv,
      points: YEAR_DATES.map((date, i) => ({ date, value: -20 + Math.sin(i) })),
    } as StatsLike['series'][number]);
    await page.route(`**/${YEAR_SITE_ID}/stats.json`, (route) => route.fulfill({ json: stats }));
    await openTool(page);
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(page.getByTestId('timeline-curve')).toHaveAttribute('data-series', 'syn-mean-hv-test');
    const got = await readCurve(page, 'timeline-curve');
    const want = expected(YEAR, YEAR_LAYERS.hv, stats);
    expect(want.breaks).toContain(HV_ABSENT_DATE);
    expect(got.dots).toEqual(YEAR_HV_DATES);
    expect(got.dots).not.toContain(HV_ABSENT_DATE);
    expect(got.segments).toEqual(want.segments);
    for (const s of got.segments) expect(touches(s, HV_ABSENT_DATE!), s.join(' to ')).toBe(false);
  });

  test('a null value between two passes with values breaks the line on both sides of it, in the tool and in the story', async ({ page }) => {
    // A SYNTHETIC copy of stats.json in which the co-pol series has no value on one pass mid-year,
    // with values on the passes either side of it.
    const NULL_DATE = PASS_SLOTS[15]!;
    const stats = buildYearStats() as unknown as StatsLike;
    const series = stats.series.find((s) => s.layer === YEAR_LAYERS.hh && s.unit === 'dB')!;
    series.points = series.points.map((p) => (p.date === NULL_DATE ? { ...p, value: null } : p));
    await page.route(`**/${YEAR_SITE_ID}/stats.json`, (route) => route.fulfill({ json: stats }));
    const want = expected(YEAR, YEAR_LAYERS.hh, stats);
    const at = want.passes.indexOf(NULL_DATE);
    expect([want.dots.includes(want.passes[at - 1]!), want.dots.includes(want.passes[at + 1]!)]).toEqual([true, true]);
    expect(want.segments).toHaveLength(20); // the 22 of the whole series, less the two that would end on it

    await openTool(page);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    const tool = await readCurve(page, 'timeline-curve');
    expect(tool.dots).not.toContain(NULL_DATE);
    expect(tool.dots).toEqual(want.dots);
    expect(tool.segments).toEqual(want.segments);
    for (const s of tool.segments) expect(touches(s, NULL_DATE), s.join(' to ')).toBe(false);

    await openStory(page, `?story=${SECOND.id}`); // mid-year: its date is that very pass
    await expect(page.getByTestId('story-curve')).toBeVisible();
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', SECOND.date!);
    const story = await readCurve(page, 'story-curve');
    expect(story.dots).toEqual(want.dots.filter((d) => d <= SECOND.date!));
    expect(story.current).toBeNull(); // the picture on the map has no value: no dot is marked, none is made up
    for (const s of story.segments) expect(touches(s, NULL_DATE), s.join(' to ')).toBe(false);
  });

  test('a layer without a dB series has no curve, and its timeline is drawn as it was', async ({ page }) => {
    await openTool(page);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(page.getByTestId('current-date')).toHaveText(YEAR_HV_DATES[YEAR_HV_DATES.length - 1]!);
    await expect(page.getByTestId('timeline-curve')).toHaveCount(0);
    await expect(page.getByTestId('curve-months')).toHaveCount(0);
    await expect(page.locator('.timeline .tick')).toHaveCount(YEAR.dates.length + YEAR.missing_passes.length);
  });

  test('each dot stands right above its mark, and each month name lies within its month on the same axis', async ({ page }) => {
    await openTool(page);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    const look = await page.evaluate(() => {
      const centre = (el: Element) => {
        const b = el.getBoundingClientRect();
        return b.x + b.width / 2;
      };
      const marks = new Map([...document.querySelectorAll('.timeline button.tick')].map((el) => [el.getAttribute('aria-label')!.replace('Show ', ''), centre(el)]));
      const axis = document.querySelector('.timeline')!.getBoundingClientRect();
      return {
        dots: [...document.querySelectorAll<SVGCircleElement>('[data-testid="timeline-curve"] circle.curve-dot')].map((c) => ({ date: c.dataset.date!, dx: centre(c) - marks.get(c.dataset.date!)! })),
        axis: { left: axis.left, width: axis.width },
        months: [...document.querySelectorAll<HTMLElement>('.curve-month')].map((m) => {
          const b = m.getBoundingClientRect();
          return { month: m.dataset.month!, text: m.textContent, left: b.left, right: b.right, centre: b.left + b.width / 2 };
        }),
      };
    });
    expect(look.dots).toHaveLength(YEAR_DATES.length);
    for (const d of look.dots) expect(Math.abs(d.dx), d.date).toBeLessThan(0.5);
    // The axis runs from the first pass to the last (missing ones included), in proportion to time.
    const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
    const passes = [...YEAR.dates.map((d) => d.date), ...YEAR.missing_passes.map((m) => m.date)].sort();
    const [d0, d1] = [day(passes[0]!), day(passes[passes.length - 1]!)];
    const px = (d: number) => look.axis.left + ((d - d0) / (d1 - d0)) * look.axis.width;
    const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    expect(look.months.length).toBeGreaterThanOrEqual(4);
    for (const [i, m] of look.months.entries()) {
      const [y, mo] = m.month.split('-').map(Number) as [number, number];
      expect(m.text).toBe(NAMES[mo - 1]);
      const start = Math.max(day(`${m.month}-01`), d0);
      const end = Math.min(Date.UTC(y, mo, 1) / 86_400_000, d1);
      expect(m.centre, m.month).toBeGreaterThanOrEqual(px(start));
      expect(m.centre, m.month).toBeLessThanOrEqual(px(end));
      if (i > 0) expect(m.left, m.month).toBeGreaterThan(look.months[i - 1]!.right); // no two names overlap
    }
  });

  test('stats.json is read by one request per site, for the curve and the Statistics panel alike', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.endsWith('/stats.json')) requests.push(new URL(r.url()).pathname);
    });
    await openTool(page);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    await expect(page.locator('.side figure.series').first()).toBeVisible();
    // Another layer and back, and another date: the file is not read again.
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(page.getByTestId('timeline-curve')).toHaveCount(0);
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hh);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(page.getByTestId('current-date')).toHaveText(YEAR_DATES[YEAR_DATES.length - 2]!);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(new RegExp(`/${YEAR_SITE_ID}/stats\\.json$`));
    // Another place: one request for its own file.
    await page.getByLabel('Place').selectOption(SITE_ID);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    await expect(page.locator('.side figure.series').first()).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatch(new RegExp(`/${SITE_ID}/stats\\.json$`));
  });

  test.describe('without a reduced-motion preference', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('nothing of the curve, and no timeline mark, reports a transition or an animation', async ({ page }) => {
      await openTool(page);
      await expect(page.getByTestId('timeline-curve')).toBeVisible();
      // The control: motion is on here (the side panels rise in), so a moving curve would be caught.
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(true);
      expect(await page.locator('.side > .panel').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('tool-panel-rise');
      expect(await page.locator(CURVE_PARTS).count()).toBeGreaterThan(20);
      expect(await moving(page, CURVE_PARTS)).toEqual([]);
      expect(await moving(page, '.timeline .tick, .tick-current')).toEqual([]);
      // Another date: the curve does not change at all (it is the whole year, static), the marks still do not move.
      const before = await page.getByTestId('timeline-curve').innerHTML();
      await page.getByRole('button', { name: 'Previous date' }).click();
      await expect(page.getByTestId('current-date')).toHaveText(YEAR_DATES[YEAR_DATES.length - 2]!);
      expect(await page.getByTestId('timeline-curve').innerHTML()).toBe(before);
      expect(await moving(page, '.timeline .tick, .tick-current')).toEqual([]);
      // And in the story's figure.
      await openStory(page, `?story=${SECOND.id}`);
      await expect(page.getByTestId('story-curve')).toBeVisible();
      expect(await moving(page, STORY_CURVE_PARTS)).toEqual([]);
    });
  });
});

test.describe('the curve in the story', () => {
  test('only on a step whose layer has a dB series, never on the cover', async ({ page }) => {
    await openStory(page);
    await expect(page.getByTestId('story-cover')).toBeVisible();
    await expect(page.getByTestId('story-figures')).toBeVisible();
    await expect(page.getByTestId('story-curve-figure')).toHaveCount(0); // the cover: its own figures
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('story-curve')).toBeVisible(); // co-pol, mid-year
    const midyear = await readCurve(page, 'story-curve');
    const whole = expected(YEAR, YEAR_LAYERS.hh, YEAR_STATS);
    expect(midyear.series).toBe(whole.series.id);
    expect(midyear.hidden).toBe(true);
    await expect(page.getByTestId('story-curve-figure').locator('.curve-caption')).toHaveText(`${whole.series.title} (dB)`);
    // Revealed up to the step's own picture, the one marked.
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', SECOND.date!);
    await expect.poll(async () => (await readCurve(page, 'story-curve')).dots).toEqual(whole.dots.filter((d) => d <= SECOND.date!));
    expect((await readCurve(page, 'story-curve')).current).toBe(SECOND.date);
    await page.keyboard.press('ArrowRight'); // the static layer
    await expect(page.getByTestId('story-figure')).toBeVisible();
    await expect(page.getByTestId('story-curve-figure')).toHaveCount(0);
    await page.keyboard.press('ArrowRight'); // the cross-pol layer: no dB series for it
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-layer', YEAR_LAYERS.hv);
    await expect(page.getByTestId('story-curve-figure')).toHaveCount(0);
  });

  test('in every animation frame of a flip-book: no pass later than the picture drawn; one whole pass more per picture, to the whole curve', async ({ page }) => {
    test.setTimeout(60_000);
    const requests: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.endsWith('/stats.json')) requests.push(r.url());
    });
    await playThePasses(page);
    await openStory(page);
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', FLIP_FROM);
    const whole = expected(YEAR, YEAR_LAYERS.hh, YEAR_STATS);
    const frames = YEAR_DATES.filter((d) => d > FLIP_FROM);
    expect(frames).toHaveLength(8); // one missing pass between FLIP_FROM and the first of them
    await recordFrames(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('story-play')).toHaveText('Pause'); // it plays by itself
    await expect(page.getByTestId('story-play')).toHaveText('Play again', { timeout: 40_000 });
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', LAST_HH);
    await expect.poll(async () => (await readCurve(page, 'story-curve')).dots.length).toBe(whole.dots.length);
    const all = await framesOf(page);
    const changes = await changesOf(page);
    const seen = all.filter((f) => f.step === SECOND.id);

    // In every frame painted, and at every change of the page: a state that came and went between two
    // frames counts too (a slow machine paints few).
    expect(brokenFrames(all, whole)).toEqual([]);
    expect(brokenFrames(changes, whole)).toEqual([]);
    expect(aheadOfTheMap(all)).toEqual([]);
    expect(aheadOfTheMap(changes)).toEqual([]);
    // It grew one whole pass at a time, never back: from the passes up to the cover's picture to all of
    // them, at the page's changes (the curve, none on the cover) and in the frames painted.
    const before = whole.dots.filter((d) => d <= FLIP_FROM).length;
    const growth = Array.from({ length: whole.dots.length - before + 1 }, (_, i) => before + i);
    expect(withoutRepeats(changes.map((c) => c.dots.length).filter((n) => n > 0)), 'the dots on the curve at the changes').toEqual(growth);
    const counts = seen.map((f) => f.dots.length).filter((n, i, all) => i === 0 || n !== all[i - 1]);
    expect(counts, 'the dots on the curve in the frames painted').toEqual(growth);
    // Each picture of the flip-book was on the map with exactly its passes on the curve.
    for (const date of frames) expect(seen.some((f) => f.stamp === date && f.dots.at(-1) === date && f.dots.length === whole.dots.filter((d) => d <= date).length), date).toBe(true);
    // The end: the whole curve, broken at every missing pass, and the last pass marked.
    const end = await readCurve(page, 'story-curve');
    expect(end.dots).toEqual(whole.dots);
    expect(end.segments).toEqual(whole.segments);
    expect(end.current).toBe(LAST_HH);
    for (const gap of whole.breaks) for (const s of end.segments) expect(touches(s, gap)).toBe(false);
    expect(requests).toHaveLength(1);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test("nothing plays: the curve goes from the picture before straight to the step's final state", async ({ page }) => {
      await playThePasses(page);
      await openStory(page);
      await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', FLIP_FROM);
      const whole = expected(YEAR, YEAR_LAYERS.hh, YEAR_STATS);
      await recordFrames(page);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('story-play')).toHaveText(`Play these ${YEAR_DATES.filter((d) => d > FLIP_FROM).length} passes`);
      await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', LAST_HH);
      await expect.poll(async () => (await readCurve(page, 'story-curve')).dots).toEqual(whole.dots);
      await waitForMapIdle(page);
      // More than five frames painted on the step, waited for: a slow machine paints few while the map
      // draws (CI's runner painted five, from the press to here), and nothing plays, so the step stays
      // in its final state and waiting adds frames of that state only.
      await expect
        .poll(async () => (await framesOf(page)).filter((f) => f.step === SECOND.id).length, { message: 'frames painted on the step', timeout: 10_000 })
        .toBeGreaterThan(5);
      const all = await framesOf(page);
      const changes = await changesOf(page);
      const seen = all.filter((f) => f.step === SECOND.id);
      expect(brokenFrames(all, whole)).toEqual([]);
      expect(brokenFrames(changes, whole)).toEqual([]);
      // No pass in between was ever drawn, on the map or on the curve: in no frame painted on the step,
      // and at no change of the page, so not in a state that came and went between two frames either.
      const before = whole.dots.filter((d) => d <= FLIP_FROM).length;
      for (const f of [...seen, ...changes]) {
        const at = `${Math.round(f.t)} ms, ${f.step}, stamp ${f.stamp}`;
        expect([0, before, whole.dots.length], `${at}: ${f.dots.length} dots`).toContain(f.dots.length);
        for (const file of f.drawn) expect([FLIP_FROM, LAST_HH], `${at}: ${file} on the map`).toContain(dateOfFile(file));
      }
      // Straight from one to the other: at the page's changes the curve (none on the cover) had the
      // passes up to the cover's picture, then every pass, and nothing else.
      expect(withoutRepeats(changes.map((c) => c.dots.length).filter((n) => n > 0)), 'the dots on the curve at the changes').toEqual([before, whole.dots.length]);
      expect(await moving(page, STORY_CURVE_PARTS)).toEqual([]);
      const end = await readCurve(page, 'story-curve');
      expect(end.segments).toEqual(whole.segments);
      expect(end.current).toBe(LAST_HH);
    });
  });
});

test.describe('on a 375 px phone', () => {
  test.use(PHONE);

  const fits = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      const parts = [...document.querySelectorAll(sel)];
      return {
        count: parts.length,
        page: document.documentElement.scrollWidth - window.innerWidth,
        out: parts
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.left < -0.5 || b.right > window.innerWidth + 0.5);
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class')}`),
        small: [...document.querySelectorAll(sel)]
          .filter((el) => el instanceof HTMLElement && (el.textContent ?? '').trim() !== '' && parseFloat(getComputedStyle(el).fontSize) < 12)
          .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class')} ${getComputedStyle(el).fontSize}`),
      };
    }, selector);

  test('in the tool and in the story nothing of the curve sticks out sideways, and no text is under 12 px', async ({ page }) => {
    await openTool(page);
    await expect(page.getByTestId('timeline-curve')).toBeVisible();
    await page.getByTestId('timeline-curve').scrollIntoViewIfNeeded();
    const tool = await fits(page, CURVE_PARTS);
    expect(tool.count).toBeGreaterThan(20);
    expect(tool).toMatchObject({ page: 0, out: [], small: [] });

    await openStory(page, `?story=${SECOND.id}`);
    await expect(page.getByTestId('story-curve')).toBeVisible();
    await page.getByTestId('story-curve').scrollIntoViewIfNeeded();
    const story = await fits(page, STORY_CURVE_PARTS);
    expect(story.count).toBeGreaterThan(10);
    expect(story).toMatchObject({ page: 0, out: [], small: [] });
  });
});

test.describe('in a contrast theme (forced colours)', () => {
  test.use({ forcedColors: 'active' });

  /** The colours the theme gives `CanvasText`, `Canvas` and `Highlight`, read from a probe. */
  const themeColours = (page: Page) =>
    page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.forcedColorAdjust = 'none'; // the system colour itself, as the theme defines it
      document.body.append(probe);
      const read = (c: string) => {
        probe.style.color = c;
        return getComputedStyle(probe).color;
      };
      const colours = { text: read('CanvasText'), canvas: read('Canvas'), highlight: read('Highlight') };
      probe.remove();
      return colours;
    });

  test('the curve is drawn in the theme colours, visible in the tool and in the story', async ({ page }) => {
    await openTool(page);
    const curve = page.getByTestId('timeline-curve');
    await expect(curve).toBeVisible();
    const theme = await themeColours(page);
    expect(theme.text).not.toBe(theme.canvas);
    const look = (testId: string) =>
      page.getByTestId(testId).evaluate((el) => ({
        segments: [...new Set([...el.querySelectorAll('line.curve-segment')].map((l) => getComputedStyle(l).stroke))],
        dots: [...new Set([...el.querySelectorAll('circle.curve-dot:not([data-current])')].map((c) => getComputedStyle(c).fill))],
        current: [...el.querySelectorAll('circle[data-current]')].map((c) => getComputedStyle(c).fill),
        labels: [...new Set([...el.querySelectorAll('.curve-label')].map((p) => getComputedStyle(p).color))],
        widths: [...el.querySelectorAll('line.curve-segment')].map((l) => parseFloat(getComputedStyle(l).strokeWidth)),
      }));
    const tool = await look('timeline-curve');
    expect(tool).toMatchObject({ segments: [theme.text], dots: [theme.text], current: [], labels: [theme.text] });
    expect(Math.min(...tool.widths)).toBeGreaterThanOrEqual(1);
    expect(await page.locator('.curve-month').evaluateAll((els) => [...new Set(els.map((m) => getComputedStyle(m).color))])).toEqual([theme.text]);

    await openStory(page, `?story=${SECOND.id}`);
    await expect(page.getByTestId('story-curve')).toBeVisible();
    await expect(page.getByTestId('story-stamp')).toHaveAttribute('data-drawn-date', SECOND.date!);
    await expect.poll(async () => (await look('story-curve')).current).toEqual([theme.highlight]);
    expect(await look('story-curve')).toMatchObject({ segments: [theme.text], dots: [theme.text], labels: [theme.text] });
  });
});
