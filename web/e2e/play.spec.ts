// Play and pause through the dates of a per-date layer, on the SYNTHETIC year site (26 dates, more
// than PRELOAD_LIMIT, so the map keeps one source at a time and replaces it for each date). Ids,
// dates and counts come from tests/fixtures/synthetic.mjs; no test plays all 26 dates.

import type { Page } from '@playwright/test';
import { describeCode } from '../src/contract/encoding';
import type { Encoding } from '../src/contract/manifest';
import { PREVIOUS_PICTURE_LIMIT_MS } from '../src/map/switching';
import { PLAY_CEILING_MS, PLAY_DWELL_MS } from '../src/state/playback';
import {
  DATES,
  PASS_COUNT,
  SITE_ID,
  SYN_HH_ENCODING,
  YEAR_DATES,
  YEAR_GRID,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_MISSING,
  YEAR_SITE_ID,
  buildManifest,
  mercatorToLonLat,
  yearDisplayCodes,
} from '../tests/fixtures/synthetic.mjs';
import { clickMapAt, dataFiles, dataFingerprint, dataIsBlank, expect, openAt, test, waitForMapIdle } from './support';

const date = (i: number) => YEAR_DATES[i]!;
const LAST = YEAR_DATES.length - 1;
/** The file name of a date of the HH layer (synthetic.mjs names them `<layer>_<date>.tif`). */
const hhFile = (d: string) => `${YEAR_LAYERS.hh}_${d}.tif`;
const at = (i: number, extra = '') => `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${date(i)}${extra}`;

/** The HH layer's title, as the fixture manifest gives it. */
const HH_TITLE: string = buildManifest()
  .sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)!
  .layers.find((l: { id: string }) => l.id === YEAR_LAYERS.hh)!.title;
/** What the tag on the map says while the map shows the HH picture of date `d`. */
const tagSays = (d: string) => `On the map: ${HH_TITLE}, ${d}`;

const playButton = (page: Page) => page.getByTestId('play');
const currentDate = (page: Page) => page.getByTestId('current-date');

interface Seen {
  date: string;
  t: number;
  live: string | null;
  ticks: number;
  missingTicks: number;
  missingItems: number;
  current: (string | null)[];
}

/** From now on, notes every change of the date on screen, with the time and the state of the timeline. */
async function recordDates(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __seen: unknown[] };
    w.__seen = [];
    const out = document.querySelector('[data-testid="current-date"]')!;
    new MutationObserver(() =>
      w.__seen.push({
        date: out.textContent,
        t: performance.now(),
        live: out.getAttribute('aria-live'),
        ticks: document.querySelectorAll('.timeline .tick').length,
        missingTicks: document.querySelectorAll('.timeline .tick-missing').length,
        missingItems: document.querySelectorAll('.missing-list li').length,
        current: [...document.querySelectorAll('.timeline .tick-current')].map((el) => el.getAttribute('aria-label')),
      }),
    ).observe(out, { childList: true, characterData: true, subtree: true });
  });
}
const seen = (page: Page) => page.evaluate(() => (window as unknown as { __seen: Seen[] }).__seen);

interface Frame {
  t: number;
  /** The text of the tag on the map. */
  tag: string;
  /** The date chosen (the stepper). */
  date: string;
  /** The file of every data source drawn at an opacity above 0. */
  drawn: string[];
}

/** From now on, notes in every animation frame the tag on the map, the date chosen and the files drawn. */
async function recordFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: unknown[]; __map: import('maplibre-gl').Map };
    w.__frames = [];
    const look = () => {
      const map = w.__map;
      const drawn = Object.keys(map.getStyle().sources)
        .filter((id) => id.startsWith('data-') && Number(map.getPaintProperty(id, 'raster-opacity')) > 0)
        .map((id) => ((map.getSource(id) as unknown as { url?: string }).url ?? '').replace('cog://', '').split('#')[0]!.split('/').pop()!);
      w.__frames.push({
        t: performance.now(),
        tag: document.querySelector('[data-testid="map-showing"]')?.textContent ?? '',
        date: document.querySelector('[data-testid="current-date"]')?.textContent ?? '',
        drawn,
      });
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const framesSeen = (page: Page) => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);

/**
 * The stretches of frames in which the tag named one date while another date's picture was the one
 * drawn, lasting longer than `toleranceMs`. The map changes a source's opacity in one frame and draws
 * it in the next, and React writes the tag in between, so a single frame may disagree.
 */
function mislabelled(frames: Frame[], toleranceMs = 100): Frame[][] {
  const prefix = tagSays('');
  const wrong = (f: Frame) => f.drawn.length === 1 && f.tag.startsWith(prefix) && f.drawn[0] !== hhFile(f.tag.slice(prefix.length));
  const runs: Frame[][] = [];
  let run: Frame[] = [];
  for (const f of [...frames, null]) {
    if (f && wrong(f)) run.push(f);
    else {
      if (run.length > 0 && run.at(-1)!.t - run[0]!.t > toleranceMs) runs.push(run);
      run = [];
    }
  }
  return runs;
}

/** From now on, notes the aria-live of the "At a point" panel whenever its text changes. */
async function recordInspect(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __inspect: { text: string; live: string | null }[] };
    w.__inspect = [];
    const panel = document.querySelector('[data-testid="inspect"]')!;
    new MutationObserver(() => w.__inspect.push({ text: panel.textContent ?? '', live: panel.getAttribute('aria-live') })).observe(panel, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

test.describe('the play button', () => {
  test('sits in the date stepper of a per-date layer, not for a pair or a static layer', async ({ page }) => {
    await openAt(page, at(LAST));
    const stepper = page.getByRole('group', { name: 'Date (UTC)' });
    await expect(stepper.getByRole('button')).toHaveText(['‹', '›', 'Play']);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(playButton(page)).not.toHaveAttribute('aria-pressed');

    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
    await expect(page.getByTestId('static-note')).toBeVisible();
    await expect(playButton(page)).toHaveCount(0);

    // The small site: a per-date layer with three dates has the button, its pair layer does not.
    await page.getByLabel('Place').selectOption(SITE_ID);
    await expect(currentDate(page)).toHaveText(DATES.at(-1)!);
    await expect(playButton(page)).toBeVisible();
    await page.getByLabel('Layer', { exact: true }).selectOption({ index: 1 });
    await expect(page.getByLabel('Pair of dates (UTC)')).toBeVisible();
    await expect(playButton(page)).toHaveCount(0);
  });

  test('plays one date per step with Enter, stops by itself on the last date, and keeps focus', async ({ page }) => {
    await openAt(page, at(LAST - 2));
    await recordDates(page);
    await playButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await expect(currentDate(page)).toHaveAttribute('aria-live', 'off');
    await expect(playButton(page)).toHaveAccessibleName('Play', { timeout: 10_000 });
    await expect(playButton(page)).toBeFocused();
    await expect(currentDate(page)).toHaveText(date(LAST));

    const steps = await seen(page);
    expect(steps.map((s) => s.date)).toEqual([date(LAST - 1), date(LAST)]);
    // Each date stayed on screen for at least the dwell, and nothing was announced on every step.
    expect(steps[1]!.t - steps[0]!.t).toBeGreaterThanOrEqual(PLAY_DWELL_MS - 50);
    for (const step of steps) expect(step.live).toBe('off');
    // When it stops, the date it stopped on is announced.
    await expect(currentDate(page)).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByTestId('playback-status')).toHaveText(`Played to the last date, ${date(LAST)}.`);
    await expect(page.getByTestId('playback-status')).toHaveRole('status');
    expect(new URL(page.url()).searchParams.get('date')).toBe(date(LAST));

    // Play again on the last date: it starts again from the first date (Space works too).
    await page.keyboard.press('Space');
    await expect(currentDate(page)).toHaveText(date(0));
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await expect(page.getByTestId('playback-status')).toHaveText('');
    await expect.poll(() => dataFiles(page)).toEqual([hhFile(date(0))]);
    await page.keyboard.press('Space');
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(playButton(page)).toBeFocused();
  });

  test('the readings at a point are not announced on every step while it plays', async ({ page }) => {
    await openAt(page, at(LAST - 2));
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.getByTestId('inspect')).toContainText(`Value (${date(LAST - 2)})`);
    await expect(page.getByTestId('inspect')).toHaveAttribute('aria-live', 'polite');
    await recordInspect(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play', { timeout: 10_000 });
    await expect(page.getByTestId('inspect')).toContainText(`Value (${date(LAST)})`);
    const changes = await page.evaluate(() => (window as unknown as { __inspect: { text: string; live: string | null }[] }).__inspect);
    const whilePlaying = changes.filter((c) => c.text.includes(`Value (${date(LAST - 1)})`) || c.text.includes('Reading values'));
    expect(whilePlaying.length).toBeGreaterThan(0);
    for (const c of whilePlaying) expect(c.live).toBe('off');
    // Once it has stopped, the panel is a live region again.
    await expect(page.getByTestId('inspect')).toHaveAttribute('aria-live', 'polite');
  });

  test('Pause stops on the date on screen and Play goes on from there', async ({ page }) => {
    await openAt(page, at(10));
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(11), { timeout: 10_000 });
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(page.getByTestId('playback-status')).toHaveText(`Paused on ${date(11)}.`);
    await page.waitForTimeout(PLAY_DWELL_MS * 2);
    await expect(currentDate(page)).toHaveText(date(11));
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(12), { timeout: 10_000 });
    await playButton(page).click();
  });

  test('missing passes stay on the timeline while it plays; only the current mark moves', async ({ page }) => {
    // From the date before a missing pass to the one after it.
    const before = YEAR_DATES.findIndex((d, i) => YEAR_MISSING.some((m) => (m.date ?? '') > d && (m.date ?? '') < (YEAR_DATES[i + 1] ?? '')));
    expect(before).toBeGreaterThanOrEqual(0);
    await openAt(page, at(before));
    await recordDates(page);
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(before + 1), { timeout: 10_000 });
    await playButton(page).click();

    const [step] = await seen(page);
    expect(step).toMatchObject({
      date: date(before + 1),
      ticks: PASS_COUNT,
      missingTicks: YEAR_MISSING.length,
      missingItems: YEAR_MISSING.length,
      current: [`Show ${date(before + 1)}`],
    });
  });

  test('anything the person does with the dates stops it; the opacity and moving the map do not', async ({ page }) => {
    await openAt(page, at(3));
    const stops: [string, () => Promise<unknown>][] = [
      ['Previous', () => page.getByRole('button', { name: 'Previous date' }).click()],
      ['Next', () => page.getByRole('button', { name: 'Next date' }).click()],
      ['a timeline mark', () => page.getByRole('button', { name: `Show ${date(1)}` }).click()],
      ['the left arrow key', () => page.keyboard.press('ArrowLeft')],
      ['the right arrow key', () => page.keyboard.press('ArrowRight')],
    ];
    for (const [what, act] of stops) {
      await playButton(page).click();
      await expect(playButton(page), what).toHaveAccessibleName('Pause');
      const shown = await currentDate(page).innerText();
      await act();
      await expect(playButton(page), what).toHaveAccessibleName('Play');
      await expect(page.getByTestId('playback-status'), what).toHaveText('');
      await expect(currentDate(page), `${what} chose another date`).not.toHaveText(shown);
    }
    // Nothing moved on after the last of them.
    const stoppedOn = await currentDate(page).innerText();
    await page.waitForTimeout(PLAY_DWELL_MS + 300);
    await expect(currentDate(page)).toHaveText(stoppedOn);

    // Opacity and the map's view do not stop it.
    await playButton(page).click();
    const slider = page.getByRole('slider');
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Layer opacity: 95%')).toBeVisible();
    const box = (await page.locator('#map').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    await page.mouse.wheel(0, -200);
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    const playing = await currentDate(page).innerText();
    await expect(currentDate(page)).not.toHaveText(playing, { timeout: 10_000 });
    await expect(playButton(page)).toHaveAccessibleName('Pause');

    // Another layer stops it, and the map shows that layer's date, not a late picture of the old one.
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    const hvDate = await currentDate(page).innerText();
    expect(YEAR_HV_DATES).toContain(hvDate);
    await waitForMapIdle(page);
    await expect.poll(() => dataFiles(page)).toEqual([`${YEAR_LAYERS.hv}_${hvDate}.tif`]);

    // Another place stops it.
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await page.getByLabel('Place').selectOption(SITE_ID);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await page.waitForTimeout(PLAY_DWELL_MS + 300);
    await expect(currentDate(page)).toHaveText(DATES.at(-1)!);
  });

  test('Previous on the first date and Next on the last stop it too, though they cannot go further', async ({ page }) => {
    // Each date is held on screen by a slow file (not drawn yet), so playback cannot move on
    // before the press lands.
    const hold = (d: string) =>
      page.route(`**/${hhFile(d)}`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.continue().catch(() => undefined);
      });
    await openAt(page, at(1));
    await hold(date(0));
    await page.getByRole('button', { name: 'Previous date' }).click();
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    // Playwright will not click a button marked aria-disabled; a person can, and so can Enter.
    await page.getByRole('button', { name: 'Previous date' }).focus();
    await page.keyboard.press('Enter');
    await expect(currentDate(page)).toHaveText(date(0));
    await expect(playButton(page), 'Previous on the first date').toHaveAccessibleName('Play');
    await expect(page.getByTestId('playback-status')).toHaveText('');
    await page.waitForTimeout(3000 + PLAY_DWELL_MS);
    await expect(currentDate(page)).toHaveText(date(0));

    await hold(date(LAST));
    await page.getByRole('button', { name: `Show ${date(LAST - 1)}` }).click();
    await waitForMapIdle(page);
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(LAST), { timeout: 10_000 });
    await page.getByRole('button', { name: 'Next date' }).focus();
    await page.keyboard.press('Enter');
    await expect(playButton(page), 'Next on the last date').toHaveAccessibleName('Play');
    await expect(page.getByTestId('playback-status')).toHaveText('');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});

test.describe('timing', () => {
  test('waits for the map to draw a slow date before it moves on', async ({ page }) => {
    const slowMs = 2000;
    await page.route(`**/${hhFile(date(6))}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, slowMs));
      await route.continue();
    });
    await openAt(page, at(5));
    await recordDates(page);
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(7), { timeout: 15_000 });
    await playButton(page).click();
    const [slow, after] = await seen(page);
    expect(slow?.date).toBe(date(6));
    // A fixed timer would have moved on after the dwell, while the picture was still loading.
    expect(after!.t - slow!.t).toBeGreaterThanOrEqual(slowMs + PLAY_DWELL_MS - 100);
  });

  test('steps on at the ceiling when a date never loads', async ({ page }) => {
    test.setTimeout(30_000);
    await page.route(`**/${hhFile(date(6))}`, () => new Promise<void>(() => undefined));
    await openAt(page, at(5));
    await recordDates(page);
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(7), { timeout: PLAY_CEILING_MS + 5000 });
    await playButton(page).click();
    const [stuck, after] = await seen(page);
    expect(stuck?.date).toBe(date(6));
    expect(after!.t - stuck!.t).toBeGreaterThanOrEqual(PLAY_CEILING_MS - 50);
    expect(after!.t - stuck!.t).toBeLessThan(PLAY_CEILING_MS + 2000);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});

test.describe('the picture with more dates than are preloaded (one source at a time)', () => {
  test('one source, and stepping or playing always draws the selected date', async ({ page, context }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
    await openAt(page, at(LAST));
    expect(await dataFiles(page)).toEqual([hhFile(date(LAST))]);

    // Stepping changes the picture every time, and the one source draws the selected date.
    let before = await dataFingerprint(page);
    for (const i of [LAST - 1, LAST - 2]) {
      await page.getByRole('button', { name: 'Previous date' }).click();
      await expect(currentDate(page)).toHaveText(date(i));
      await expect.poll(() => dataFiles(page)).toEqual([hhFile(date(i))]);
      const now = await dataFingerprint(page);
      expect(now, date(i)).not.toBe(before);
      before = now;
    }
    // The same date opened afresh, at exactly the same view, draws the same picture.
    const view = await page.evaluate(() => {
      const map = (window as unknown as { __map: import('maplibre-gl').Map }).__map;
      return { center: map.getCenter().toArray(), zoom: map.getZoom() };
    });
    const fresh = await context.newPage();
    await openAt(fresh, new URL(page.url()).search);
    await expect(fresh.getByTestId('current-date')).toHaveText(date(LAST - 2));
    await fresh.evaluate((v) => (window as unknown as { __map: import('maplibre-gl').Map }).__map.jumpTo(v), view);
    expect(await dataFingerprint(fresh)).toBe(before);
    await fresh.close();

    // Playing does too, step by step.
    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 1), { timeout: 10_000 });
    await expect.poll(() => dataFiles(page)).toEqual([hhFile(date(LAST - 1))]);
    await expect(currentDate(page)).toHaveText(date(LAST), { timeout: 10_000 });
    await expect.poll(() => dataFiles(page)).toEqual([hhFile(date(LAST))]);
    await expect(playButton(page)).toHaveAccessibleName('Play', { timeout: 10_000 });
    expect(await dataFingerprint(page)).not.toBe(before);

    // The small site, with three dates, still preloads one source per date.
    await page.getByLabel('Place').selectOption(SITE_ID);
    await waitForMapIdle(page);
    await expect.poll(async () => (await dataFiles(page)).length).toBe(DATES.length);
    expect(problems).toEqual([]);
  });

  test('a date asked for while the previous one is still loading wins over a late answer', async ({ page }) => {
    // Previous loads a date whose file answers late; Next goes back at once. With setUrl on one
    // source, the late answer replaced the picture of the date on screen.
    let served = 0;
    await page.route(`**/${hhFile(date(LAST - 1))}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      served++;
      await route.continue();
    });
    await openAt(page, at(LAST));
    const picture = await dataFingerprint(page);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST));
    await expect.poll(() => served, { timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await waitForMapIdle(page);
    expect(await dataFiles(page)).toEqual([hhFile(date(LAST))]);
    expect(await dataFingerprint(page)).toBe(picture);
  });

  test('a late answer slower than any time limit does not land either', async ({ page }) => {
    // The same, with the answer later than PREVIOUS_PICTURE_LIMIT_MS (a 5 s wait for the old
    // request to finish before setUrl let it through after that).
    test.setTimeout(40_000);
    let served = 0;
    await page.route(`**/${hhFile(date(LAST - 1))}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, PREVIOUS_PICTURE_LIMIT_MS + 1500));
      served++;
      await route.continue().catch(() => undefined);
    });
    await openAt(page, at(LAST));
    const picture = await dataFingerprint(page);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await page.getByRole('button', { name: 'Next date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST));
    await expect.poll(() => served, { timeout: 20_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await waitForMapIdle(page);
    expect(await dataFiles(page)).toEqual([hhFile(date(LAST))]);
    expect(await dataFingerprint(page)).toBe(picture);
  });

  test("a date whose file is missing shows no picture, never the previous date's", async ({ page }) => {
    await page.route(`**/${hhFile(date(LAST - 1))}`, (route) => route.fulfill({ status: 404 }));
    await openAt(page, at(LAST));
    expect(await dataIsBlank(page)).toBe(false);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 1));
    await expect(page.getByRole('alert')).toContainText(hhFile(date(LAST - 1)));
    await waitForMapIdle(page);
    expect(await dataFiles(page)).toEqual([hhFile(date(LAST - 1))]);
    expect(await dataIsBlank(page)).toBe(true);
    await expect(page.getByTestId('picture-loading')).toHaveCount(0);
    // The next good date draws again.
    await page.getByRole('button', { name: 'Previous date' }).click();
    await waitForMapIdle(page);
    await expect.poll(() => dataFiles(page)).toEqual([hhFile(date(LAST - 2))]);
    expect(await dataIsBlank(page)).toBe(false);
  });

  test('the tag never names a date whose file is missing as the picture drawn: it says none is, and which date could not be loaded', async ({ page }) => {
    await page.route(`**/${hhFile(date(LAST - 1))}`, (route) => route.fulfill({ status: 404 }));
    await openAt(page, at(LAST));
    const tag = page.getByTestId('map-showing');
    await expect(tag).toHaveText(tagSays(date(LAST)));
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 1));
    await expect(page.getByRole('alert')).toContainText(hhFile(date(LAST - 1)));
    await expect(tag).toHaveText(`On the map: no picture (${date(LAST - 1)} could not be loaded)`);
    await waitForMapIdle(page);
    expect(await dataIsBlank(page)).toBe(true);
    await expect(tag).toHaveText(`On the map: no picture (${date(LAST - 1)} could not be loaded)`);
    // The next good date is named once it is drawn.
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(tag).toHaveText(tagSays(date(LAST - 2)));
    expect(await dataIsBlank(page)).toBe(false);
  });

  test('while a date loads, the map says so; a date that never loads stops showing the previous picture', async ({ page }) => {
    test.setTimeout(30_000);
    await page.route(`**/${hhFile(date(LAST - 1))}`, () => new Promise<void>(() => undefined));
    await openAt(page, at(LAST));
    await expect(page.getByTestId('picture-loading')).toHaveCount(0);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(page.getByTestId('picture-loading')).toBeVisible();
    await expect(page.getByTestId('picture-loading')).toContainText(date(LAST - 1));
    // The previous date's picture may stay while the new one loads, under that note, but not for ever.
    await expect.poll(() => dataIsBlank(page), { timeout: PREVIOUS_PICTURE_LIMIT_MS + 3000 }).toBe(true);
    await expect(page.getByTestId('picture-loading')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('the tag on the map names the date of the picture drawn, at once, not the date chosen while it loads', async ({ page }) => {
    test.setTimeout(30_000);
    const tag = page.getByTestId('map-showing');
    const says = tagSays;
    // The previous date's file answers only when the test says so.
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/${hhFile(date(LAST - 1))}`, async (route) => {
      await answered;
      await route.continue().catch(() => undefined);
    });
    await openAt(page, at(LAST));
    await expect(tag).toHaveText(says(date(LAST)));
    await expect(tag).not.toHaveAttribute('aria-live');
    await recordFrames(page);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 1));
    // Straight away, before the loading note shows, and for as long as the file takes: the old date.
    expect(await tag.textContent()).toBe(says(date(LAST)));
    await expect(page.getByTestId('picture-loading')).toContainText(date(LAST - 1));
    await expect(tag).toHaveText(says(date(LAST)));
    expect(await dataFiles(page)).toEqual([hhFile(date(LAST)), hhFile(date(LAST - 1))]);
    // Once the previous picture leaves the map (the time limit), the tag says that nothing is drawn.
    await expect(tag).toHaveText('On the map: no picture yet', { timeout: PREVIOUS_PICTURE_LIMIT_MS + 3000 });
    release();
    await expect(tag).toHaveText(says(date(LAST - 1)));
    await waitForMapIdle(page);
    // At no time did the tag name a date whose picture was not the one drawn.
    const frames = await framesSeen(page);
    expect(frames.length).toBeGreaterThan(10);
    expect(mislabelled(frames)).toEqual([]);
    expect(frames.some((f) => f.date === date(LAST - 1) && f.tag === says(date(LAST)) && f.drawn[0] === hhFile(date(LAST)))).toBe(true);
    expect(frames.at(-1)).toMatchObject({ tag: says(date(LAST - 1)), drawn: [hhFile(date(LAST - 1))] });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('while playing, the tag names the picture drawn, not the date chosen', async ({ page }) => {
    const says = tagSays;
    // One slow date in the middle, so the playback waits on it with the previous picture on the map.
    await page.route(`**/${hhFile(date(LAST - 1))}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue().catch(() => undefined);
    });
    await openAt(page, at(LAST - 2));
    await recordFrames(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play', { timeout: 15_000 });
    await expect(page.getByTestId('map-showing')).toHaveText(says(date(LAST)));
    const frames = await framesSeen(page);
    // The date chosen ran ahead of the picture while the slow date loaded; the tag never did.
    expect(frames.some((f) => f.date === date(LAST - 1) && f.tag === says(date(LAST - 2)))).toBe(true);
    expect(mislabelled(frames)).toEqual([]);
  });

  test("a click reads the selected date's value", async ({ page }) => {
    // The middle of one pixel of the fixture grid, so the reading cannot fall on a pixel edge.
    const [c, r] = [Math.round(YEAR_GRID.width / 2), Math.round(YEAR_GRID.height / 3)];
    const [lon, lat] = mercatorToLonLat(YEAR_GRID.x0 + (c + 0.5) * YEAR_GRID.res, YEAR_GRID.y0 - (r + 0.5) * YEAR_GRID.res);
    const expected = (d: string) => describeCode(yearDisplayCodes(d, 'hh')[r * YEAR_GRID.width + c]!, SYN_HH_ENCODING as Encoding, 'dB');
    const chosen = date(LAST - 2);
    expect(expected(chosen)).not.toBe(expected(date(LAST))); // the test can tell the dates apart

    await openAt(page, at(LAST));
    await page.getByRole('button', { name: 'Previous date' }).click();
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(chosen);
    // Zoom in on the point before clicking it. A click lands on a whole screen pixel, up to one
    // pixel from the point asked for: at the zoom the site opens with that is about 75 m, and the
    // value read can then be the next cell's (the reader's cells are not the file's pixels, so a
    // cell edge can lie near the middle of a file pixel). Whether it did depended on the exact
    // size of the map, so on the page's layout. At zoom 13 a screen pixel is under 10 m.
    await page.evaluate(([x, y]) => (window as unknown as { __map: import('maplibre-gl').Map }).__map.jumpTo({ center: [x!, y!], zoom: 13 }), [lon, lat]);
    await waitForMapIdle(page);
    await clickMapAt(page, lon, lat);
    await expect(page.getByTestId('inspect')).toContainText(`Value (${chosen})`);
    await expect(page.getByTestId('inspect-value')).toHaveText(expected(chosen));
  });
});

test.describe('the picture with up to PRELOAD_LIMIT dates (one source per date, preloaded)', () => {
  test('the tag never names a date whose file is missing as the picture drawn: it says none is, and which date could not be loaded', async ({ page }) => {
    // The small fixture site: three dates, every file loaded at once at opacity 0.
    const small = buildManifest().sites.find((s: { id: string }) => s.id === SITE_ID)!;
    const hh = small.layers.find((l: { id: string }) => l.id === 'hh')!;
    const [firstDate, missing, lastDate] = DATES as [string, string, string];
    await page.route(`**/${SITE_ID}/hh_${missing}.tif`, (route) => route.fulfill({ status: 404 }));
    await openAt(page, `?site=${SITE_ID}&layer=hh&date=${lastDate}`);
    const tag = page.getByTestId('map-showing');
    await expect(tag).toHaveText(`On the map: ${hh.title}, ${lastDate}`);
    await expect.poll(async () => (await dataFiles(page)).length).toBe(DATES.length);
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(missing);
    await expect(page.getByRole('alert')).toContainText(`hh_${missing}.tif`);
    await expect(tag).toHaveText(`On the map: no picture (${missing} could not be loaded)`);
    await waitForMapIdle(page);
    expect(await dataIsBlank(page)).toBe(true);
    await expect(tag).toHaveText(`On the map: no picture (${missing} could not be loaded)`);
    // The next good date is named at once: its file was preloaded.
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(tag).toHaveText(`On the map: ${hh.title}, ${firstDate}`);
    expect(await dataIsBlank(page)).toBe(false);
  });
});

test.describe('"At a point" while the date changes', () => {
  test("keeps the history chart and table on screen while the new date's value is read", async ({ page }) => {
    await openAt(page, at(LAST));
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    const panel = page.getByTestId('inspect');
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    await expect(panel).toContainText(`Value (${date(LAST)})`);
    const rows = panel.locator('table.history tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    // From now on, counts every change of the panel that leaves it without its chart or its table.
    await page.evaluate(() => {
      const w = window as unknown as { __historyGone: number };
      w.__historyGone = 0;
      const el = document.querySelector('[data-testid="inspect"]')!;
      new MutationObserver(() => {
        if (!el.querySelector('table.history') || !el.querySelector('svg.chart')) w.__historyGone++;
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    // The previous date's file answers only when the test says so: its value is still being read.
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/${hhFile(date(LAST - 1))}`, async (route) => {
      await answered;
      await route.continue().catch(() => undefined);
    });
    await page.getByRole('button', { name: 'Previous date' }).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 1));
    await expect(page.getByTestId('inspect-value-reading')).toHaveText(`Value (${date(LAST - 1)}): reading…`);
    // The value of the date before is not shown under the new date; the history stays.
    await expect(page.getByTestId('inspect-value')).toHaveCount(0);
    await expect(rows).toHaveCount(count);
    await expect(panel.locator('svg.chart')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('inspect-value-reading')).toBeVisible();
    release();
    await expect(panel).toContainText(`Value (${date(LAST - 1)})`);
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    await expect(page.getByTestId('inspect-value-reading')).toHaveCount(0);
    await expect(rows).toHaveCount(count);
    expect(await page.evaluate(() => (window as unknown as { __historyGone: number }).__historyGone)).toBe(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});

test.describe('play=1 in the link', () => {
  test('opens playing, and is not written back into the link', async ({ page }) => {
    await openAt(page, at(LAST - 3, '&play=1'));
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await expect(currentDate(page)).toHaveText(date(LAST - 2), { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.has('play')).toBe(false);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play');
  });

  test('starts only once the map has drawn the date the link opens on, so a slow start shows that date first', async ({ page }) => {
    // The opened date's file answers only when the test says so, as on a slow connection.
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/${hhFile(date(LAST - 3))}`, async (route) => {
      await answered;
      await route.continue().catch(() => undefined);
    });
    await page.goto(`./${at(LAST - 3, '&play=1')}`);
    await expect(currentDate(page)).toHaveText(date(LAST - 3));
    await recordDates(page);
    // When the button turns to Pause, that is, when playback starts.
    await page.evaluate(() => {
      const w = window as unknown as { __playingFrom?: number };
      const button = document.querySelector('[data-testid="play"]')!;
      new MutationObserver(() => {
        if (button.textContent === 'Pause') w.__playingFrom ??= performance.now();
      }).observe(button, { childList: true, characterData: true, subtree: true });
    });
    // Not drawn yet: nothing plays, however long that takes.
    await page.waitForTimeout(1500);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(currentDate(page)).toHaveText(date(LAST - 3));

    release();
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await expect(currentDate(page)).toHaveText(date(LAST - 2), { timeout: 10_000 });
    await playButton(page).click();
    // The date it opened on stayed on screen, drawn, for the dwell before playback moved on.
    const [first] = await seen(page);
    const playingFrom = await page.evaluate(() => (window as unknown as { __playingFrom: number }).__playingFrom);
    expect(first?.date).toBe(date(LAST - 2));
    expect(first!.t - playingFrom).toBeGreaterThanOrEqual(PLAY_DWELL_MS - 50);
  });

  test('a person who acts before the first picture is drawn cancels it', async ({ page }) => {
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/${hhFile(date(LAST - 3))}`, async (route) => {
      await answered;
      await route.continue().catch(() => undefined);
    });
    await page.goto(`./${at(LAST - 3, '&play=1')}`);
    await expect(currentDate(page)).toHaveText(date(LAST - 3));
    // Play, then Pause, before anything is drawn: once the picture arrives, nothing starts again.
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play');
    release();
    await waitForMapIdle(page);
    await page.waitForTimeout(PLAY_DWELL_MS * 2);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(currentDate(page)).toHaveText(date(LAST - 3));
  });

  test('is read once: after a pause, choosing another layer or date does not start it again', async ({ page }) => {
    await openAt(page, at(LAST - 3, '&play=1'));
    await expect(playButton(page)).toHaveAccessibleName('Pause');
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.hv);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await page.getByRole('button', { name: 'Previous date' }).click();
    const chosen = await currentDate(page).innerText();
    await page.waitForTimeout(PLAY_DWELL_MS * 2);
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await expect(currentDate(page)).toHaveText(chosen);
  });

  test('a date change never animates the current mark', async ({ page }) => {
    await openAt(page, at(LAST - 1));
    const timing = await page.locator('.tick-current').evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration, s.animationDuration];
    });
    expect(timing.every((list) => list.split(',').every((d) => parseFloat(d) === 0))).toBe(true);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('play=1 is ignored; pressing Play still plays, and nothing animates the current mark', async ({ page }) => {
    await openAt(page, at(LAST - 3, '&play=1'));
    await expect(playButton(page)).toHaveAccessibleName('Play');
    await page.waitForTimeout(PLAY_DWELL_MS * 2);
    await expect(currentDate(page)).toHaveText(date(LAST - 3));
    expect(new URL(page.url()).searchParams.has('play')).toBe(false);

    await playButton(page).click();
    await expect(currentDate(page)).toHaveText(date(LAST - 2), { timeout: 10_000 });
    const timing = await page.locator('.tick-current').evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration, s.animationDuration];
    });
    expect(timing.every((list) => list.split(',').every((d) => parseFloat(d) === 0))).toBe(true);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Play');
  });
});
