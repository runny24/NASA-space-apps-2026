// The points overlay (item 6 of docs/WEB_FEATURES_BRIEF.md) on the SYNTHETIC year site: the switch,
// which points are drawn with which date, the captions, the legend, the credit, the link, the order
// of the map's layers, reading a point, a phone, the keyboard, and a file that fails. Every id,
// date and count comes from tests/fixtures/synthetic.mjs, never from literals.

import type { Page } from '@playwright/test';
import { formatDay, formatPeriod, OVERLAY_NOT_NISAR } from '../src/state/overlayPeriod';
import { OVERLAY_GROUP_LABEL } from '../src/components/Overlays';
import {
  EMPTY_PERIOD,
  HV_ABSENT_DATE,
  OVERLAY_DATE_PROPERTY,
  OVERLAY_DATE_RANGE,
  OVERLAY_FIELDS,
  OVERLAY_ID,
  OVERLAY_URL,
  PASS_SLOTS,
  POINT_DAY_BEFORE_PASS,
  POINT_LACKING_FIELD,
  POINT_ON_PASS_DATE,
  SITE_ID,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_SITE_ID,
  addDays,
  buildManifest,
  overlayBytes,
  overlayPoints,
  pointLackingField,
  pointsDated,
} from '../tests/fixtures/synthetic.mjs';
import { clickMapAt, expect, openAt, test, waitForMapIdle } from './support';

type MapLike = import('maplibre-gl').Map;

const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)! as unknown as {
  overlays: { id: string; title: string; description: string; method: string; credit: string }[];
};
const OVERLAY = site.overlays.find((o) => o.id === OVERLAY_ID)!;
const TITLE: string = OVERLAY.title;
const [RANGE_START, RANGE_END] = OVERLAY_DATE_RANGE as [string, string];
const TOTAL = overlayPoints().features.length;
/** The map's source and layer of the overlay (src/map/overlayLayers.ts, overlayMapId). */
const MAP_ID = `overlay-${OVERLAY_ID}`;
const RANGE_WORDS = formatPeriod({ first: RANGE_START, last: RANGE_END });

/** What the caption should say on `date` of a per-date layer with `dates`, worked out from the fixture. */
function expected(dates: string[], date: string): { caption: string; count: number | null; first: string; last: string } {
  const i = dates.indexOf(date);
  if (i < 0) throw new Error(`${date} is not a date of this layer`);
  const last = i + 1 < dates.length ? addDays(dates[i + 1]!, -1) : RANGE_END;
  if (last < RANGE_START)
    return { caption: `${TITLE}: no data for ${formatPeriod({ first: date, last })} (this overlay covers ${RANGE_WORDS})`, count: null, first: date, last };
  const first = date < RANGE_START ? RANGE_START : date;
  const count = pointsDated(first, last);
  const reason = date < RANGE_START ? `. This overlay's data start on ${formatDay(RANGE_START)}.` : '';
  return { caption: `${TITLE}, ${formatPeriod({ first, last })}: ${count}${reason}`, count, first, last };
}

const query = (layer: string, date?: string, extra = '') =>
  `?site=${YEAR_SITE_ID}&layer=${layer}${date ? `&date=${date}` : ''}&overlays=${OVERLAY_ID}${extra}`;

const theSwitch = (page: Page) => page.getByRole('switch', { name: TITLE });
const sideCaption = (page: Page) => page.locator(`.overlay-switch[data-overlay="${OVERLAY_ID}"]`).getByTestId('overlay-caption');
const mapCaption = (page: Page) => page.getByTestId('overlay-map-caption');
const creditLine = (page: Page) => page.locator('.maplibregl-ctrl-attrib-inner');

/**
 * What the map has of the overlay: its filter, how many features of its source pass that filter
 * (counted by MapLibre over the loaded tiles, which cover the whole site in the default view), and
 * which features it has drawn (ids and days, from queryRenderedFeatures over the whole map).
 */
const onMap = (page: Page) =>
  page.evaluate(
    ([id, dayProperty]) => {
      const map = (window as unknown as { __map: MapLike }).__map;
      if (!map.getLayer(id!)) return null;
      const filter = map.getFilter(id!);
      const passing = map.querySourceFeatures(id!, filter === null || filter === undefined ? {} : { filter });
      const rendered = map.queryRenderedFeatures({ layers: [id!] });
      return {
        filter,
        passing: new Set(passing.map((f) => f.id)).size,
        drawn: new Set(rendered.map((f) => f.id)).size,
        days: [...new Set(rendered.map((f) => String(f.properties[dayProperty!])))].sort(),
      };
    },
    [MAP_ID, OVERLAY_DATE_PROPERTY],
  );

/** Waits until the map draws exactly `count` points of the overlay, and every point that passes its filter. */
async function expectDrawn(page: Page, count: number): Promise<NonNullable<Awaited<ReturnType<typeof onMap>>>> {
  await expect.poll(async () => (await onMap(page))?.drawn, { timeout: 10_000 }).toBe(count);
  await waitForMapIdle(page);
  const state = (await onMap(page))!;
  expect(state.passing, 'features of the source that pass the layer filter').toBe(count);
  expect(state.drawn).toBe(count);
  return state;
}

/** Whether the map draws the fixture point `feature` at its place (queryRenderedFeatures at its pixel). */
const drawsPointAt = (page: Page, feature: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }) =>
  page.evaluate(
    ([id, lon, lat, day, dayProperty]) => {
      const map = (window as unknown as { __map: MapLike }).__map;
      const p = map.project([Number(lon), Number(lat)]);
      return map.queryRenderedFeatures([p.x, p.y], { layers: [id as string] }).some((f) => f.properties[dayProperty as string] === day);
    },
    [MAP_ID, feature.geometry.coordinates[0], feature.geometry.coordinates[1], feature.properties[OVERLAY_DATE_PROPERTY], OVERLAY_DATE_PROPERTY],
  );

const firstPointDated = (day: string) => overlayPoints().features.find((f: { properties: Record<string, unknown> }) => f.properties[OVERLAY_DATE_PROPERTY] === day)!;

test.describe('the switch', () => {
  test('off by default: no dots, no caption, no credit; on shows all three (the credit in the credit line and the legend); off removes them', async ({ page }) => {
    const date = PASS_SLOTS[25]!;
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date}`);
    await expect(page.getByRole('group', { name: OVERLAY_GROUP_LABEL })).toBeVisible();
    await expect(theSwitch(page)).not.toBeChecked();
    expect(await onMap(page)).toBeNull();
    await expect(mapCaption(page)).toHaveCount(0);
    await expect(sideCaption(page)).toHaveText('');
    // The side caption is a live region: rendered while empty (not display:none, which takes it out
    // of the accessibility tree), so that a screen reader hears its first words when the switch goes on.
    await expect(sideCaption(page)).not.toHaveCSS('display', 'none');
    await expect(creditLine(page)).not.toContainText(OVERLAY.credit);
    await expect(page.getByTestId('legend-overlay')).toHaveCount(0);

    await theSwitch(page).check();
    const want = expected(YEAR_DATES, date);
    await expect(sideCaption(page)).toHaveText(want.caption);
    await expect(mapCaption(page)).toContainText(want.caption);
    await expect(mapCaption(page)).toContainText(OVERLAY_NOT_NISAR);
    // The credit is drawn with the overlay, in the map's credit line and the legend, not in the box.
    await expect(mapCaption(page)).not.toContainText(OVERLAY.credit);
    await expectDrawn(page, want.count!);
    await expect(creditLine(page)).toContainText(OVERLAY.credit);
    await expect.poll(() => new URL(page.url()).searchParams.get('overlays')).toBe(OVERLAY_ID);
    // The legend: the dot, the title, the description, what a dot is not, UTC days, the method (folded,
    // as the layer's is: e2e/tool.spec.ts) and the credit.
    const legend = page.getByTestId('legend-overlay');
    for (const text of [TITLE, OVERLAY.description, OVERLAY_NOT_NISAR, 'Dates are UTC days.', `Credit: ${OVERLAY.credit}`])
      await expect(legend).toContainText(text);
    await expect(legend.locator('details.legend-method > p')).toHaveText(OVERLAY.method);
    await expect(legend.locator('details.legend-method > p')).toBeHidden();
    // A screen reader gets the caption once (under the switch) and the sentence once (in the legend):
    // the box on the map, which repeats them for a picture of the map, is not read again.
    const spoken = await page.locator('body').ariaSnapshot();
    const times = (text: string) => spoken.split(text).length - 1;
    expect(times(want.caption), spoken).toBe(1);
    expect(times(OVERLAY_NOT_NISAR), spoken).toBe(1);

    await theSwitch(page).uncheck();
    await expect(mapCaption(page)).toHaveCount(0);
    await expect(sideCaption(page)).toHaveText('');
    await expect(sideCaption(page)).not.toHaveCSS('display', 'none');
    await expect.poll(() => onMap(page)).toBeNull();
    await expect(creditLine(page)).not.toContainText(OVERLAY.credit);
    await expect(page.getByTestId('legend-overlay')).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.has('overlays')).toBe(false);
  });

  test('a file that fails: an error next to the switch, no dots and no count', async ({ page }) => {
    await page.route(`**/${OVERLAY_URL}`, (route) => route.fulfill({ status: 404, body: 'not here' }));
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${PASS_SLOTS[25]}`);
    await theSwitch(page).check();
    const alert = page.locator(`.overlay-switch[data-overlay="${OVERLAY_ID}"]`).getByRole('alert');
    await expect(alert).toHaveText('Could not load the file of this overlay (HTTP 404), so nothing is drawn.');
    await expect(sideCaption(page)).toHaveText('');
    await expect(mapCaption(page)).toContainText('could not be loaded');
    expect(await mapCaption(page).innerText()).not.toMatch(/\d/);
    await waitForMapIdle(page);
    expect(await onMap(page)).toBeNull();
  });
});

test.describe('a file that failed is fetched again', () => {
  /** Answers the overlay's first request with a 404 (after `delay` ms) and passes later ones on. */
  async function failFirst(page: Page, delay = 0) {
    const asked = { count: 0 };
    await page.route(`**/${OVERLAY_URL}`, async (route) => {
      asked.count += 1;
      if (asked.count > 1) return route.continue();
      await new Promise((r) => setTimeout(r, delay));
      await route.fulfill({ status: 404, body: 'not here' });
    });
    return asked;
  }
  const alert = (page: Page) => page.locator(`.overlay-switch[data-overlay="${OVERLAY_ID}"]`).getByRole('alert');
  const date = PASS_SLOTS[25]!;

  test('when it failed while the overlay was off, on switching it on again', async ({ page }) => {
    const asked = await failFirst(page, 1500);
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date}`);
    const failed = page.waitForResponse((r) => r.url().endsWith(OVERLAY_URL) && r.status() === 404);
    await theSwitch(page).check();
    await expect(sideCaption(page)).toHaveText(`Loading ${TITLE}…`);
    await theSwitch(page).uncheck(); // before the answer comes
    await failed;
    await theSwitch(page).check();
    await expect(sideCaption(page)).toHaveText(expected(YEAR_DATES, date).caption);
    await expect(alert(page)).toHaveCount(0);
    await expectDrawn(page, expected(YEAR_DATES, date).count!);
    expect(asked.count).toBe(2);
  });

  test('after choosing another place and coming back', async ({ page }) => {
    const asked = await failFirst(page);
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date}`);
    await theSwitch(page).check();
    await expect(alert(page)).toBeVisible();
    await page.getByLabel('Place').selectOption(SITE_ID);
    await expect(page.getByRole('group', { name: OVERLAY_GROUP_LABEL })).toHaveCount(0);
    await page.getByLabel('Place').selectOption(YEAR_SITE_ID);
    await theSwitch(page).check();
    await expect(sideCaption(page)).toHaveText(new RegExp(`^${TITLE}, `));
    await expect(alert(page)).toHaveCount(0);
    expect(asked.count).toBe(2);
  });

  test('but not on a change of layer or date while it stays on', async ({ page }) => {
    const asked = await failFirst(page);
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date}`);
    await theSwitch(page).check();
    await expect(alert(page)).toBeVisible();
    await page.getByRole('button', { name: 'Previous date' }).click();
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
    await expect(page.getByTestId('static-note')).toBeVisible();
    await expect(alert(page)).toBeVisible();
    expect(asked.count).toBe(1);
  });
});

test.describe('which points are drawn', () => {
  test('a date inside the range: the caption gives the fixture period and count, and the map draws exactly those points', async ({ page }) => {
    const date = PASS_SLOTS[25]!;
    const want = expected(YEAR_DATES, date);
    expect(want.count).toBeGreaterThan(0);
    await openAt(page, query(YEAR_LAYERS.hh, date));
    await expect(sideCaption(page)).toHaveText(want.caption);
    const state = await expectDrawn(page, want.count!);
    // Only points dated in the period, from its first day to its last.
    expect(state.days.every((d) => d >= want.first && d <= want.last), state.days.join(' ')).toBe(true);
    expect(state.days).toContain(want.first);
    // A known point of the period is drawn at its place; one of the next period is not.
    expect(await drawsPointAt(page, firstPointDated(want.first))).toBe(true);
    expect(await drawsPointAt(page, firstPointDated(PASS_SLOTS[27]!))).toBe(false);
  });

  test('the empty period says 0 and draws nothing; a point on a pass day belongs to that pass, one the day before to the previous', async ({ page }) => {
    const [emptyFirst, emptyLast] = EMPTY_PERIOD as [string, string];
    const onPass = POINT_ON_PASS_DATE!;
    await openAt(page, query(YEAR_LAYERS.hh, emptyFirst));
    await expect(sideCaption(page)).toHaveText(`${TITLE}, ${formatPeriod({ first: emptyFirst, last: emptyLast })}: 0`);
    await expect(mapCaption(page)).toContainText(': 0');
    await expect.poll(async () => (await onMap(page))?.passing).toBe(0);
    expect((await onMap(page))!.drawn).toBe(0);

    // On the pass of POINT_ON_PASS_DATE (the next date), its points are drawn...
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(page.getByTestId('current-date')).toHaveText(onPass);
    let state = await expectDrawn(page, expected(YEAR_DATES, onPass).count!);
    expect(state.days).toContain(onPass);
    // ...and so are those of the day before the next pass, which is the last day of this period.
    expect(addDays(POINT_DAY_BEFORE_PASS, 1)).toBe(YEAR_DATES[YEAR_DATES.indexOf(onPass) + 1]);
    expect(state.days).toContain(POINT_DAY_BEFORE_PASS);
    expect(await drawsPointAt(page, firstPointDated(POINT_DAY_BEFORE_PASS))).toBe(true);

    // On the next pass, neither.
    await page.getByRole('button', { name: 'Next date' }).click();
    state = await expectDrawn(page, expected(YEAR_DATES, addDays(POINT_DAY_BEFORE_PASS, 1)).count!);
    expect(state.days).not.toContain(POINT_DAY_BEFORE_PASS);
    expect(state.days).not.toContain(onPass);
  });

  test('wholly before the range: no data and no number; straddling its start: clipped, with the reason; the last date: to the end of the range', async ({ page }) => {
    const before = YEAR_DATES.filter((_, i) => i + 1 < YEAR_DATES.length && YEAR_DATES[i + 1]! <= RANGE_START).at(-1)!;
    const want = expected(YEAR_DATES, before);
    expect(want.count).toBeNull();
    await openAt(page, query(YEAR_LAYERS.hh, before));
    await expect(sideCaption(page)).toHaveText(want.caption);
    await expect(sideCaption(page)).not.toHaveText(/: \d|\b0\b/);
    await expect(mapCaption(page)).toContainText(`${TITLE}: no data for`);
    await expect.poll(async () => (await onMap(page))?.filter).toBe(false);
    expect((await onMap(page))!.drawn).toBe(0);

    // The next date's period straddles the start of the range.
    await page.getByRole('button', { name: 'Next date' }).click();
    const straddle = YEAR_DATES[YEAR_DATES.indexOf(before) + 1]!;
    expect(straddle < RANGE_START).toBe(true);
    const clipped = expected(YEAR_DATES, straddle);
    await expect(sideCaption(page)).toHaveText(clipped.caption);
    await expect(sideCaption(page)).toContainText(`This overlay's data start on ${formatDay(RANGE_START)}.`);
    const state = await expectDrawn(page, clipped.count!);
    expect(state.days[0]! >= RANGE_START).toBe(true);

    // The last date: from it to the end of date_range.
    const last = YEAR_DATES.at(-1)!;
    await page.getByRole('button', { name: `Show ${last}` }).click();
    await expect(sideCaption(page)).toHaveText(`${TITLE}, ${formatPeriod({ first: last, last: RANGE_END })}: ${pointsDated(last, RANGE_END)}`);
    const end = await expectDrawn(page, pointsDated(last, RANGE_END));
    expect(end.days.at(-1)).toBe(RANGE_END);
  });

  test('the static layer: every point, and the period named is the whole range', async ({ page }) => {
    await openAt(page, query(YEAR_LAYERS.hh, PASS_SLOTS[25]));
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
    await expect(page.getByTestId('static-note')).toBeVisible();
    await expect(sideCaption(page)).toHaveText(`${TITLE}, ${RANGE_WORDS}: ${TOTAL}`);
    const state = await expectDrawn(page, TOTAL);
    expect(state.filter ?? null).toBeNull(); // no filter: every point
  });

  test('the other per-date layer, which lacks one date: its periods follow ITS dates', async ({ page }) => {
    // The date before the one syn-hv lacks: on syn-hh its period stops before that date, on syn-hv
    // it runs on to syn-hv's next date.
    const date = YEAR_HV_DATES.filter((d) => d < HV_ABSENT_DATE!).at(-1)!;
    const hh = expected(YEAR_DATES, date);
    const hv = expected(YEAR_HV_DATES, date);
    expect(hh.last).toBe(addDays(HV_ABSENT_DATE!, -1));
    expect(hv.last > hh.last).toBe(true);
    await openAt(page, query(YEAR_LAYERS.hh, date));
    await expect(sideCaption(page)).toHaveText(hh.caption);
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(page.getByTestId('current-date')).toHaveText(date);
    await expect(sideCaption(page)).toHaveText(hv.caption);

    // Inside the range, every step on syn-hv gives the count of its own period.
    const inside = YEAR_HV_DATES.filter((d) => d >= RANGE_START).slice(0, 2);
    for (const d of inside) {
      await page.getByRole('button', { name: `Show ${d}` }).click();
      const want = expected(YEAR_HV_DATES, d);
      await expect(sideCaption(page)).toHaveText(want.caption);
      await expectDrawn(page, want.count!);
    }
  });

  test('points without a valid date are left out of a dated period, and the legend says how many', async ({ page }) => {
    const collection = JSON.parse(new TextDecoder().decode(overlayBytes()));
    const somewhere = collection.features[0].geometry;
    collection.features.push(
      { type: 'Feature', geometry: somewhere, properties: { [OVERLAY_DATE_PROPERTY]: 'not a date' } },
      { type: 'Feature', geometry: somewhere, properties: {} },
    );
    await page.route(`**/${OVERLAY_URL}`, (route) => route.fulfill({ status: 200, contentType: 'application/geo+json', body: JSON.stringify(collection) }));
    const date = PASS_SLOTS[25]!;
    await openAt(page, query(YEAR_LAYERS.hh, date));
    const want = expected(YEAR_DATES, date);
    await expect(sideCaption(page)).toHaveText(want.caption);
    await expectDrawn(page, want.count!);
    await expect(page.getByTestId('overlay-undated')).toHaveText('2 points have no valid date and are left out of every period.');
    // A static layer draws every point, dated or not, and leaves none out.
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
    await expect(sideCaption(page)).toHaveText(`${TITLE}, ${RANGE_WORDS}: ${TOTAL + 2}`);
    await expect(page.getByTestId('overlay-undated')).toHaveCount(0);
  });
});

test.describe('while the dates play', () => {
  test('the period, the dots and both captions follow the date, and the side caption is not announced', async ({ page }) => {
    const start = PASS_SLOTS[24]!;
    await openAt(page, query(YEAR_LAYERS.hh, start));
    await expect(sideCaption(page)).toHaveAttribute('aria-live', 'polite');
    await page.getByTestId('play').click();
    await expect(sideCaption(page)).toHaveAttribute('aria-live', 'off');
    // Watch the steps: at every sample, both captions belong to the date on screen.
    const seen = new Set<string>();
    const wrong: string[] = [];
    const until = Date.now() + 15_000;
    while (seen.size < 3 && Date.now() < until) {
      const now = await page.evaluate(() => ({
        date: document.querySelector('[data-testid="current-date"]')!.textContent!,
        side: document.querySelector('[data-testid="overlay-caption"]')!.textContent!,
        map: document.querySelector('[data-testid="overlay-map-caption-text"]')!.textContent!,
      }));
      const want = expected(YEAR_DATES, now.date).caption;
      if (now.side !== want || now.map !== want) wrong.push(`on ${now.date}: "${now.side}" / "${now.map}", not "${want}"`);
      seen.add(now.date);
      await page.waitForTimeout(50);
    }
    expect(wrong).toEqual([]);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    await page.getByTestId('play').click(); // pause
    await expect(page.getByTestId('play')).toHaveText('Play');
    await expect(sideCaption(page)).toHaveAttribute('aria-live', 'polite');
    const date = (await page.getByTestId('current-date').textContent())!;
    const want = expected(YEAR_DATES, date);
    await expect(sideCaption(page)).toHaveText(want.caption);
    await expectDrawn(page, want.count!);
    // The map caption is never a live region.
    expect(await mapCaption(page).evaluate((el) => el.closest('[aria-live]'))).toBeNull();
  });
});

test.describe('the link', () => {
  test('overlays=... survives a reload and a copied link', async ({ page, context }) => {
    const date = PASS_SLOTS[25]!;
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date}`);
    await theSwitch(page).check();
    await expect.poll(() => new URL(page.url()).searchParams.get('overlays')).toBe(OVERLAY_ID);
    expect(page.url()).toContain(`overlays=${OVERLAY_ID}`);
    await page.reload();
    await expect(theSwitch(page)).toBeChecked();
    await expect(sideCaption(page)).toHaveText(expected(YEAR_DATES, date).caption);
    const copy = await context.newPage();
    await copy.goto(page.url());
    await expect(theSwitch(copy)).toBeChecked();
    await expect(sideCaption(copy)).toHaveText(expected(YEAR_DATES, date).caption);
    await expectDrawn(copy, expected(YEAR_DATES, date).count!);
  });

  test('an unknown id is dropped, and choosing another place clears the overlays', async ({ page }) => {
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&overlays=no-such-overlay,${OVERLAY_ID}`);
    await expect(theSwitch(page)).toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.get('overlays')).toBe(OVERLAY_ID);
    await page.goto(`./?site=${YEAR_SITE_ID}&overlays=no-such-overlay`);
    await expect(theSwitch(page)).not.toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.has('overlays')).toBe(false);

    await page.goto(`./${query(YEAR_LAYERS.hh)}`);
    await expect(theSwitch(page)).toBeChecked();
    await page.getByLabel('Place').selectOption(SITE_ID);
    await expect.poll(() => new URL(page.url()).searchParams.has('overlays')).toBe(false);
    await expect(page.getByRole('group', { name: OVERLAY_GROUP_LABEL })).toHaveCount(0); // that place has none
    await expect(mapCaption(page)).toHaveCount(0);
    await page.getByLabel('Place').selectOption(YEAR_SITE_ID);
    await expect(theSwitch(page)).not.toBeChecked();
  });
});

/** Where the data rasters, the overlay's circles and the first label sit in the map's stack (indexes). */
const stack = (page: Page) =>
  page.evaluate(() => {
    const layers = (window as unknown as { __map: MapLike }).__map.getStyle().layers;
    const where = (test: (l: { id: string; type: string }) => boolean) => layers.flatMap((l, i) => (test(l) ? [i] : []));
    return { data: where((l) => l.id.startsWith('data-')), overlay: where((l) => l.id.startsWith('overlay-')), label: where((l) => l.type === 'symbol')[0]! };
  });

async function expectOrder(page: Page, when: string) {
  const s = await stack(page);
  expect(s.overlay, when).toHaveLength(1);
  expect(s.data.length, when).toBeGreaterThan(0);
  expect(Math.max(...s.data), `${when}: every raster under the circles`).toBeLessThan(s.overlay[0]!);
  expect(s.overlay[0]!, `${when}: the circles under the labels`).toBeLessThan(s.label);
}

test('the map keeps rasters under the circles and the circles under the labels, after a step, playing and a layer switch', async ({ page }) => {
  await openAt(page, query(YEAR_LAYERS.hh, PASS_SLOTS[25]));
  await expectDrawn(page, expected(YEAR_DATES, PASS_SLOTS[25]!).count!);
  await expectOrder(page, 'on opening');
  // A step on the long layer adds a fresh raster for the new date: check while it loads and after.
  await page.getByRole('button', { name: 'Previous date' }).click();
  await expectOrder(page, 'right after a step');
  await waitForMapIdle(page);
  await expectOrder(page, 'after a step');
  // Play a few dates.
  const from = (await page.getByTestId('current-date').textContent())!;
  await page.getByTestId('play').click();
  await expect.poll(async () => YEAR_DATES.indexOf((await page.getByTestId('current-date').textContent())!) - YEAR_DATES.indexOf(from), { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  await expectOrder(page, 'while playing');
  await page.getByTestId('play').click();
  await waitForMapIdle(page);
  await expectOrder(page, 'after playing');
  await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
  await expect.poll(async () => (await stack(page)).data.length).toBeGreaterThan(0);
  await waitForMapIdle(page);
  await expectOrder(page, 'after switching to the other per-date layer');
  await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
  await expect(page.getByTestId('static-note')).toBeVisible();
  await expect.poll(async () => (await stack(page)).data.length).toBeGreaterThan(0);
  await waitForMapIdle(page);
  await expectOrder(page, 'after switching to the static layer');
});

test('the map stays flat, so a distance on screen is the same everywhere on it (the point search relies on it)', async ({ page }) => {
  await openAt(page, query(YEAR_LAYERS.hh, PASS_SLOTS[25]));
  const pitch = () => page.evaluate(() => (window as unknown as { __map: MapLike }).__map.getPitch());
  const map = (await page.locator('#map').boundingBox())!;
  const [x, y] = [map.x + map.width / 2, map.y + map.height / 2];
  // A drag with the right mouse button, or with Ctrl held, tilts a MapLibre map unless it is kept flat.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x, y - 150, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.down('Control');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 150, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  // And Shift with the up arrow, on the map.
  await page.locator('#map canvas').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowUp');
  await waitForMapIdle(page);
  expect(await pitch()).toBe(0);
});

test.describe('reading a point', () => {
  const lacking = pointLackingField()!;
  const [lon, lat] = lacking.geometry.coordinates as [number, number];
  /** The pass whose period holds the point's day. */
  const pass = YEAR_DATES.filter((d) => d <= POINT_LACKING_FIELD.day).at(-1)!;
  const block = (page: Page) => page.getByTestId('overlay-point');
  const rows = (page: Page) =>
    block(page)
      .locator('dl > div')
      .evaluateAll((els) => els.map((el) => [el.querySelector('dt')!.textContent, el.querySelector('dd')!.textContent]));
  /** The fields as the block should list them: label, then value and unit; a missing property "not available". */
  const listed = (properties: Record<string, unknown>) =>
    OVERLAY_FIELDS.map((f: { name: string; label: string; unit?: string }) => [
      f.label,
      properties[f.name] === undefined ? 'not available' : `${properties[f.name]}${f.unit ? ` ${f.unit}` : ''}`,
    ]);

  test('a click on a point lists its fields with labels and units; a property it lacks reads "not available"', async ({ page }) => {
    await openAt(page, `${query(YEAR_LAYERS.hh, pass)}&lon=${lon}&lat=${lat}&z=14`);
    await expect.poll(async () => (await onMap(page))?.drawn ?? 0).toBeGreaterThan(0);
    await waitForMapIdle(page);
    await clickMapAt(page, lon, lat);
    await expect(page.getByTestId('inspect-value')).toBeVisible(); // the layer's own reading still works
    await expect(block(page)).toHaveCount(1);
    await expect(block(page).getByRole('heading')).toHaveText(TITLE);
    expect(await rows(page)).toEqual(listed(lacking.properties));
    expect((await rows(page)).find(([label]) => label === OVERLAY_FIELDS.find((f: { name: string }) => f.name === POINT_LACKING_FIELD.field)!.label)![1]).toBe('not available');

    // A point with every field, with its unit; here only one point is within reach.
    const other = overlayPoints().features.find(
      (f: { properties: Record<string, unknown> }) => f !== lacking && f.properties[OVERLAY_DATE_PROPERTY] === POINT_LACKING_FIELD.day,
    )!;
    const [olon, olat] = other.geometry.coordinates as [number, number];
    await page.goto(`./${query(YEAR_LAYERS.hh, pass)}&lon=${olon}&lat=${olat}&z=14`);
    await expect.poll(async () => (await onMap(page))?.drawn ?? 0).toBeGreaterThan(0);
    await waitForMapIdle(page);
    await clickMapAt(page, olon, olat);
    await expect(block(page)).toHaveCount(1);
    expect(await rows(page)).toEqual(listed(other.properties));
    expect((await rows(page)).some(([, value]) => / MW$/.test(value ?? ''))).toBe(true);
    await expect(page.getByTestId('overlay-point-count')).toHaveCount(0);

    // Far from any drawn point: no block, and the layer's reading as before.
    await clickMapAt(page, olon + 0.01, olat + 0.01);
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });

  test('the centre button reads the point at the centre too; a point not drawn on this date is not read', async ({ page }) => {
    await openAt(page, `${query(YEAR_LAYERS.hh, pass)}&lon=${lon}&lat=${lat}&z=14`);
    await expect.poll(async () => (await onMap(page))?.drawn ?? 0).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(block(page)).toHaveCount(1);
    expect(await rows(page)).toEqual(listed(lacking.properties));
    // The previous date's period does not hold this point: the block goes with the date.
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });

  test('several points within reach: says how many, and shows the nearest', async ({ page }) => {
    // Zoomed far out, the period's points crowd together: a click on one finds several.
    await openAt(page, `${query(YEAR_LAYERS.hh, pass)}&lon=${lon}&lat=${lat}&z=7`);
    await expect.poll(async () => (await onMap(page))?.drawn ?? 0).toBeGreaterThan(0);
    await clickMapAt(page, lon, lat);
    await expect(page.getByTestId('overlay-point-count')).toHaveText(/^\d+ points of this overlay are within reach; the nearest is shown\.$/);
    expect(await rows(page)).toEqual(listed(lacking.properties));
  });
});

test.describe('on a wide screen (1280 x 800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('on the map, top left: the tag naming the picture, the caption box under it, the loading note under that, all clear of its controls', async ({ page }) => {
    await openAt(page, query(YEAR_LAYERS.hh, PASS_SLOTS[24]));
    await expect(mapCaption(page)).toContainText(OVERLAY_NOT_NISAR);
    // A slow next date, so the loading note shows.
    await page.route(`**/${YEAR_LAYERS.hh}_${PASS_SLOTS[25]}.tif`, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(page.getByTestId('picture-loading')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (el: Element | null | undefined) => {
        const r = el?.getBoundingClientRect();
        return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
      };
      const caption = document.querySelector('[data-testid="overlay-map-caption"]');
      return {
        map: rect(document.querySelector('#map'))!,
        caption: rect(caption)!,
        captionIn: caption?.parentElement?.getAttribute('data-testid'),
        firstNote: caption?.parentElement?.firstElementChild?.getAttribute('data-testid'),
        strip: document.querySelector('[data-testid="map-notes-under"]') !== null,
        loading: rect(document.querySelector('[data-testid="picture-loading"]'))!,
        tag: rect(document.querySelector('[data-testid="map-showing"]'))!,
        controls: ['.maplibregl-ctrl-top-right .maplibregl-ctrl-group', '.maplibregl-ctrl-scale', '.maplibregl-ctrl-attrib']
          .map((s) => rect(document.querySelector(s)))
          .filter((r) => r !== null),
      };
    });
    type Box = { left: number; top: number; right: number; bottom: number };
    const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    // The caption box is on the map, in the same notes as the tag, which comes first; no strip under the map.
    expect(boxes.captionIn).toBe('map-notes');
    expect(boxes.firstNote).toBe('map-showing');
    expect(boxes.strip).toBe(false);
    expect(boxes.controls).toHaveLength(3);
    for (const r of [boxes.tag, boxes.caption, boxes.loading]) {
      expect(r.left).toBeGreaterThanOrEqual(boxes.map.left);
      expect(r.right).toBeLessThanOrEqual(boxes.map.right);
      expect(r.top).toBeGreaterThanOrEqual(boxes.map.top);
      expect(r.bottom).toBeLessThanOrEqual(boxes.map.bottom);
      for (const control of boxes.controls) expect(overlap(r, control), JSON.stringify(control)).toBe(false);
    }
    // The tag above the box, the box above the loading note.
    expect(boxes.tag.bottom).toBeLessThanOrEqual(boxes.caption.top);
    expect(boxes.caption.bottom).toBeLessThanOrEqual(boxes.loading.top);
  });
});

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true });

  // The caption box went in the strip under the map on every phone (it had sat on the map, where it
  // hid the dots it counts); the loading note and the tag naming the picture stay on the map, clear
  // of its controls.
  test('the switch is at least 44 px high; the caption box is in the strip right under the map, the loading note and the tag on the map clear of its controls', async ({ page }) => {
    await openAt(page, query(YEAR_LAYERS.hh, PASS_SLOTS[24]));
    await expect(mapCaption(page)).toContainText(OVERLAY_NOT_NISAR);
    const row = (await page.locator(`.overlay-switch[data-overlay="${OVERLAY_ID}"] label`).boundingBox())!;
    expect(row.height).toBeGreaterThanOrEqual(44);

    // A slow next date, so the loading note shows.
    await page.route(`**/${YEAR_LAYERS.hh}_${PASS_SLOTS[25]}.tif`, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(page.getByTestId('picture-loading')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (el: Element | null | undefined) => {
        const r = el?.getBoundingClientRect();
        return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
      };
      const caption = document.querySelector('[data-testid="overlay-map-caption"]');
      return {
        map: rect(document.querySelector('#map'))!,
        caption: rect(caption)!,
        strip: rect(caption?.parentElement)!,
        stripIsUnder: caption?.parentElement?.getAttribute('data-testid') === 'map-notes-under',
        loading: rect(document.querySelector('[data-testid="picture-loading"]'))!,
        tag: rect(document.querySelector('[data-testid="map-showing"]'))!,
        controls: ['.maplibregl-ctrl-top-right .maplibregl-ctrl-group', '.maplibregl-ctrl-scale', '.maplibregl-ctrl-attrib']
          .map((s) => rect(document.querySelector(s)))
          .filter((r) => r !== null),
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    type Box = { left: number; top: number; right: number; bottom: number };
    const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(boxes.pageWidth).toBeLessThanOrEqual(375);
    // The caption: in the strip, which starts where the map ends and is as wide as it.
    expect(boxes.stripIsUnder).toBe(true);
    expect(Math.abs(boxes.strip.top - boxes.map.bottom)).toBeLessThanOrEqual(1);
    expect(boxes.caption.top).toBeGreaterThanOrEqual(boxes.map.bottom);
    expect(boxes.caption.left).toBeGreaterThanOrEqual(boxes.map.left);
    expect(boxes.caption.right).toBeLessThanOrEqual(boxes.map.right);
    // The loading note: on the map, clear of its controls.
    expect(boxes.loading.top).toBeGreaterThanOrEqual(boxes.map.top);
    expect(boxes.loading.bottom).toBeLessThanOrEqual(boxes.map.bottom);
    expect(boxes.controls).toHaveLength(3);
    for (const control of boxes.controls) expect(overlap(boxes.loading, control), JSON.stringify(control)).toBe(false);
    // The tag naming what the map shows: on the map too, clear of its controls and the loading note.
    expect(boxes.tag.left).toBeGreaterThanOrEqual(boxes.map.left);
    expect(boxes.tag.right).toBeLessThanOrEqual(boxes.map.right);
    expect(boxes.tag.top).toBeGreaterThanOrEqual(boxes.map.top);
    expect(boxes.tag.bottom).toBeLessThanOrEqual(boxes.map.bottom);
    for (const control of boxes.controls) expect(overlap(boxes.tag, control), JSON.stringify(control)).toBe(false);
    expect(overlap(boxes.tag, boxes.loading)).toBe(false);
    // Nothing of the box is cut off: it shows all its text.
    expect(await mapCaption(page).evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });
});

test.describe('on a phone held sideways (667 x 375)', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });

  test('the caption box shows all its text, the sentence included, on the map or right under it, clear of its controls, also with the loading note', async ({ page }) => {
    // The date whose period is clipped: the longest caption the fixture has.
    const straddle = YEAR_DATES.find((d, i) => d < RANGE_START && (YEAR_DATES[i + 1] ?? '') > RANGE_START)!;
    await openAt(page, query(YEAR_LAYERS.hh, straddle));
    await expect(mapCaption(page)).toContainText(expected(YEAR_DATES, straddle).caption);
    type Box = { left: number; top: number; right: number; bottom: number };
    const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const check = async (when: string) => {
      const boxes = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const r = el?.getBoundingClientRect();
          return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
        };
        const box = document.querySelector('[data-testid="overlay-map-caption"]')!;
        return {
          map: rect(document.querySelector('#map'))!,
          // The notes the box is in: on the map, or the strip under it.
          notes: rect(box.parentElement)!,
          caption: rect(box)!,
          // Every line of the box, the last (the sentence) included.
          lines: [...box.querySelectorAll('p')].map(rect) as Box[],
          scrolls: box.scrollHeight > box.clientHeight + 1,
          loading: rect(document.querySelector('[data-testid="picture-loading"]')),
          tag: rect(document.querySelector('[data-testid="map-showing"]'))!,
          controls: ['.maplibregl-ctrl-top-right .maplibregl-ctrl-group', '.maplibregl-ctrl-scale', '.maplibregl-ctrl-attrib'].map((s) => rect(document.querySelector(s))).filter((r) => r !== null),
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(boxes.pageWidth, when).toBeLessThanOrEqual(667);
      expect(boxes.scrolls, `${when}: the box shows all its text`).toBe(false);
      for (const line of boxes.lines) {
        expect(line.top, when).toBeGreaterThanOrEqual(boxes.caption.top);
        expect(line.bottom, when).toBeLessThanOrEqual(boxes.caption.bottom + 0.5);
      }
      // On the map, or in a strip right under it (a picture of the map takes the strip with it).
      const onTheMap = boxes.notes.top >= boxes.map.top && boxes.notes.bottom <= boxes.map.bottom;
      const underIt = Math.abs(boxes.notes.top - boxes.map.bottom) <= 1;
      expect(onTheMap || underIt, `${when}: ${JSON.stringify({ map: boxes.map, notes: boxes.notes })}`).toBe(true);
      for (const r of [boxes.caption, ...(boxes.loading ? [boxes.loading] : [])]) {
        expect(r.left, when).toBeGreaterThanOrEqual(boxes.map.left);
        expect(r.right, when).toBeLessThanOrEqual(boxes.map.right);
        expect(r.bottom, when).toBeLessThanOrEqual(boxes.notes.bottom + 0.5);
        for (const control of boxes.controls) expect(overlap(r, control), `${when}: ${JSON.stringify(control)}`).toBe(false);
      }
      expect(boxes.controls, when).toHaveLength(3);
      if (boxes.loading) expect(overlap(boxes.caption, boxes.loading), when).toBe(false);
      // The tag naming what the map shows stays on the map itself, clear of its controls and the box.
      expect(boxes.tag.left, when).toBeGreaterThanOrEqual(boxes.map.left);
      expect(boxes.tag.right, when).toBeLessThanOrEqual(boxes.map.right);
      expect(boxes.tag.top, when).toBeGreaterThanOrEqual(boxes.map.top);
      expect(boxes.tag.bottom, when).toBeLessThanOrEqual(boxes.map.bottom);
      for (const control of boxes.controls) expect(overlap(boxes.tag, control), `${when}: ${JSON.stringify(control)}`).toBe(false);
      expect(overlap(boxes.tag, boxes.caption), when).toBe(false);
    };
    await check('on opening');
    // A slow next date, so the loading note shows with the box.
    const next = YEAR_DATES[YEAR_DATES.indexOf(straddle) + 1]!;
    await page.route(`**/${YEAR_LAYERS.hh}_${next}.tif`, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(page.getByTestId('picture-loading')).toBeVisible();
    await check('while the next date loads');
  });
});

test('a site with overlays but no layers yet still has the switch and the legend entry', async ({ page }) => {
  // The fixture manifest with the year site's layers taken away (a place the pipeline has not filled yet).
  await page.route('**/manifest.json', async (route) => {
    const manifest = await (await route.fetch()).json();
    const year = manifest.sites.find((s: { id: string }) => s.id === YEAR_SITE_ID);
    year.layers = [];
    delete year.stats;
    delete year.story;
    await route.fulfill({ json: manifest });
  });
  await page.goto(`./?site=${YEAR_SITE_ID}&overlays=${OVERLAY_ID}`);
  await expect(page.getByText('This place has no layers yet.')).toBeVisible();
  await expect(theSwitch(page)).toBeChecked();
  await expect(sideCaption(page)).toHaveText(`${TITLE}, ${RANGE_WORDS}: ${TOTAL}`);
  await expect(page.getByTestId('legend-overlay')).toContainText(OVERLAY.description);
  await expect(mapCaption(page)).toContainText(OVERLAY_NOT_NISAR);
  // And it can be switched off.
  await theSwitch(page).uncheck();
  await expect(mapCaption(page)).toHaveCount(0);
  await expect(page.getByTestId('legend-overlay')).toHaveCount(0);
});

test('with the keyboard: Tab reaches the switch after the layer controls, with a visible ring, and Space toggles it', async ({ page }) => {
  await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${PASS_SLOTS[25]}`);
  await page.getByLabel(/^Layer opacity/).focus();
  await page.keyboard.press('Tab');
  await expect(theSwitch(page)).toBeFocused();
  const ring = await theSwitch(page).evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).toBe('solid');
  await page.keyboard.press('Space');
  await expect(theSwitch(page)).toBeChecked();
  await expect(sideCaption(page)).toHaveText(expected(YEAR_DATES, PASS_SLOTS[25]!).caption);
  await page.keyboard.press('Space');
  await expect(theSwitch(page)).not.toBeChecked();
  await expect(mapCaption(page)).toHaveCount(0);
});
