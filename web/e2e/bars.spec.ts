// Bars in the Statistics panel (an entry of `bars` in stats.json) on the SYNTHETIC year site. The
// numbers, labels, colours and ids come from tests/fixtures/synthetic.mjs (buildYearStats), never
// from literals.

import type { Locator, Page } from '@playwright/test';
import type { BarCategory, BarsEntry, Stats } from '../src/contract/stats';
import { BARS_ID, BARS_PERIOD_ID, SITE_ID, SYN_CLASS_ENCODING, YEAR_SITE_ID, buildManifest, buildStats, buildYearStats } from '../tests/fixtures/synthetic.mjs';
import { METHOD_SUMMARY } from '../src/components/BarsFigure';
import { serveRealLengthTexts } from './realLengths';
import { expect, test } from './support';

const entry: BarsEntry = (buildYearStats() as Stats).bars!.find((b) => b.id === BARS_ID)!;
type Category = BarCategory;
const CATS: Category[] = entry.categories;
const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)!;

const NULL_INDEX = CATS.findIndex((c) => c.value === null);
const NO_INTERVAL_INDEX = CATS.findIndex((c) => c.value !== null && c.low === undefined && c.high === undefined);
const ZERO_INDEX = CATS.findIndex((c) => c.value === 0);
const hasInterval = (c: Category) => typeof c.low === 'number' && typeof c.high === 'number';

/** "#rrggbb" as getComputedStyle writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

const figure = (page: Page) => page.locator(`figure[data-bars-id="${BARS_ID}"]`);
const rows = (page: Page) => figure(page).getByRole('list').getByRole('listitem');

async function openBars(page: Page, query = `?site=${YEAR_SITE_ID}`): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.locator('#site-title')).toBeVisible();
  await expect(figure(page)).toBeVisible();
  await panelsAtRest(page);
}

/**
 * Waits until the side panels have risen into place (styles/motion.css moves each panel as one block
 * once, when the data arrives): boxes read one after another while a panel still moves would be read
 * at different moments of its rise. Nothing in a figure moves by itself; this only waits for the frame.
 */
async function panelsAtRest(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.side > .panel')].every((p) => p.getAnimations({ subtree: true }).every((a) => a.playState !== 'running')),
  );
}

/** The text a row should carry, in reading order: label, value with unit, interval, n, note. */
function expectedParts(c: Category): string[] {
  const parts = [c.label, c.value === null ? 'not available' : `${String(c.value)} ${entry.unit}`];
  if (hasInterval(c)) parts.push(`(${String(c.low)} to ${String(c.high)})`);
  if (typeof c.n === 'number') parts.push(`n = ${String(c.n)}`);
  if (c.note) parts.push(c.note);
  return parts;
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error('no box');
  return b;
};

/** How tall the page is against the window, and the side column against its own box. */
const pageScroll = (page: Page) =>
  page.evaluate(() => {
    const side = document.querySelector('.side')!;
    return { page: document.documentElement.scrollHeight, window: window.innerHeight, side: side.scrollHeight, sideClient: side.clientHeight };
  });

test('the fixture has the rows these tests need', () => {
  expect(CATS).toHaveLength(5);
  expect(NULL_INDEX).toBeGreaterThan(-1);
  expect(NO_INTERVAL_INDEX).toBeGreaterThan(-1);
  expect(ZERO_INDEX).toBeGreaterThan(-1);
  expect(CATS.filter(hasInterval)).toHaveLength(3);
});

test('the figure shows every category in the order of the file, with the numbers of the file in the text', async ({ page }) => {
  await openBars(page);
  await expect(page.getByRole('figure', { name: new RegExp(`^${entry.title} \\(${entry.unit}\\)`) })).toBeVisible();
  await expect(figure(page).locator('figcaption')).toHaveText(`${entry.title} (${entry.unit})`);
  await expect(rows(page)).toHaveCount(CATS.length);
  for (const [i, c] of CATS.entries()) {
    const text = (await rows(page).nth(i).textContent()) ?? '';
    // Every part is there, in reading order.
    let from = 0;
    for (const part of expectedParts(c)) {
      const at = text.indexOf(part, from);
      expect(at, `row ${i}: "${part}" after position ${from} in "${text}"`).toBeGreaterThanOrEqual(from);
      from = at + part.length;
    }
  }
});

test('a null value reads "not available", shows its note, and has no bar, whisker or zero line', async ({ page }) => {
  await openBars(page);
  const row = rows(page).nth(NULL_INDEX);
  await expect(row.locator('.bars-value')).toHaveText('not available');
  await expect(row.getByText(CATS[NULL_INDEX]!.note!)).toBeVisible();
  await expect(row.locator('.bars-bar, .bars-zero-value, .bars-whisker, .bars-zero-line, .bars-track')).toHaveCount(0);
  await expect(row).not.toContainText(/\b0 /);
});

test('a value of 0 is a real zero: it reads 0 and has a mark on the zero line', async ({ page }) => {
  await openBars(page);
  const row = rows(page).nth(ZERO_INDEX);
  await expect(row.locator('.bars-value')).toHaveText(`0 ${entry.unit}`);
  const mark = row.locator('.bars-zero-value');
  await expect(mark).toBeVisible();
  const zero = await box(row.locator('.bars-zero-line'));
  const m = await box(mark);
  expect(Math.abs(m.x + m.width / 2 - (zero.x + zero.width / 2))).toBeLessThan(1.5);
  expect(m.width).toBeGreaterThanOrEqual(2);
});

test('the mark of a 0 reaches no further past zero than the thinnest bar, and is taller than a bar', async ({ page }) => {
  // The fixture's 0 and its largest value, with a positive value far below the scale's end between
  // them: the figure draws that one as thin as it draws any bar.
  const largest = CATS.reduce((a, c) => (c.value !== null && c.value > (a.value ?? -Infinity) ? c : a));
  const tiny = { label: 'SYNTHETIC tiny value', value: (largest.value as number) / 1000 };
  const stats = buildYearStats() as Stats;
  stats.bars!.find((b) => b.id === BARS_ID)!.categories = [CATS[ZERO_INDEX]!, tiny, largest];
  await page.route(`**/${YEAR_SITE_ID}/stats.json`, (route) => route.fulfill({ json: stats }));
  await openBars(page);
  await expect(rows(page)).toHaveCount(3);
  const zeroX = async (i: number) => {
    const z = await box(rows(page).nth(i).locator('.bars-zero-line'));
    return z.x + z.width / 2;
  };
  const mark = await box(rows(page).nth(0).locator('.bars-zero-value'));
  const thin = await box(rows(page).nth(1).locator('.bars-bar'));
  const markReach = mark.x + mark.width - (await zeroX(0));
  const thinReach = thin.x + thin.width - (await zeroX(1));
  expect(thinReach).toBeGreaterThan(0);
  expect(markReach, 'a zero must not look longer than a positive value').toBeLessThanOrEqual(thinReach + 0.01);
  expect(mark.height, 'the mark reads as a mark on the zero line, not as a bar').toBeGreaterThan(thin.height);
});

test('bars share one scale from zero, and whiskers run from low to high only when both exist', async ({ page }) => {
  await openBars(page);
  // The scale's ends are written: 0, and a round number at or above every value and high.
  const ticks = figure(page).locator('.bars-tick');
  await expect(ticks).toHaveCount(2);
  await expect(ticks.first()).toHaveText('0');
  const end = Number(await ticks.last().getAttribute('data-value'));
  await expect(ticks.last()).toHaveText(String(end));
  const largest = Math.max(...CATS.flatMap((c) => (c.value === null ? [] : [c.value, ...(hasInterval(c) ? [c.high!] : [])])));
  expect(end).toBeGreaterThanOrEqual(largest);
  expect(end).toBeLessThan(largest * 2);

  for (const [i, c] of CATS.entries()) {
    const row = rows(page).nth(i);
    if (c.value === null) continue;
    const track = await box(row.locator('.bars-track'));
    const x = (v: number) => track.x + (v / end) * track.width;
    if (c.value > 0) {
      const bar = await box(row.locator('.bars-bar'));
      expect(Math.abs(bar.x - x(0)), `row ${i} bar start`).toBeLessThan(1.5);
      expect(Math.abs(bar.x + bar.width - x(c.value)), `row ${i} bar end`).toBeLessThan(1.5);
    } else {
      await expect(row.locator('.bars-bar')).toHaveCount(0);
    }
    const whisker = row.locator('.bars-whisker');
    if (hasInterval(c)) {
      const w = await box(whisker);
      expect(Math.abs(w.x - x(c.low!)), `row ${i} whisker start`).toBeLessThan(1.5);
      expect(Math.abs(w.x + w.width - x(c.high!)), `row ${i} whisker end`).toBeLessThan(1.5);
    } else {
      await expect(whisker, `row ${i} has no interval`).toHaveCount(0);
    }
  }
  await expect(rows(page).nth(NO_INTERVAL_INDEX).locator('.bars-bar')).toBeVisible();
  await expect(rows(page).nth(NO_INTERVAL_INDEX).locator('.bars-whisker')).toHaveCount(0);
});

test('the entries of one unit and layer share one scale: the same end, said in words, and a larger value never draws a shorter bar', async ({ page }) => {
  // The fixture's two entries: the same unit and layer, the second's values far below the first's
  // (on a scale of its own it would end at 0.08 and draw its bars far longer).
  const both = (buildYearStats() as Stats).bars!.filter((b) => b.unit === entry.unit && b.layer === entry.layer);
  expect(both.map((b) => b.id)).toEqual([BARS_ID, BARS_PERIOD_ID]);
  const drawn = (b: BarsEntry) => b.categories.flatMap((c) => (c.value === null ? [] : [c.value, ...(hasInterval(c) ? [c.high!] : [])]));
  const largest = Math.max(...both.flatMap(drawn));
  expect(Math.max(...drawn(both[1]!))).toBeLessThan(largest / 2);

  await openBars(page);
  const bars: { value: number; width: number }[] = [];
  const ends: number[] = [];
  for (const b of both) {
    const fig = page.locator(`figure[data-bars-id="${b.id}"]`);
    await expect(fig).toBeVisible();
    const end = Number(await fig.locator('.bars-tick').last().getAttribute('data-value'));
    ends.push(end);
    const items = fig.getByRole('list').getByRole('listitem');
    for (const [i, c] of b.categories.entries()) {
      if (c.value === null || c.value <= 0) continue;
      const track = await box(items.nth(i).locator('.bars-track'));
      const bar = await box(items.nth(i).locator('.bars-bar'));
      expect(Math.abs(bar.x + bar.width - (track.x + (c.value / end) * track.width)), `${b.id} row ${i} bar end`).toBeLessThan(1.5);
      bars.push({ value: c.value, width: bar.width });
    }
  }
  // One end for both, and across both figures a larger value draws a longer bar.
  expect(ends[1], 'the same end on both axes').toBe(ends[0]);
  expect(ends[0]).toBeGreaterThanOrEqual(largest);
  expect(ends[0]).toBeLessThan(largest * 2);
  bars.sort((a, b) => a.value - b.value);
  for (let k = 1; k < bars.length; k++) expect(bars[k]!.width, JSON.stringify(bars)).toBeGreaterThan(bars[k - 1]!.width);

  // The scale in words in each figure, visible and not hidden from screen readers (the axis is).
  for (const b of both) {
    const sentence = page.locator(`figure[data-bars-id="${b.id}"] .bars-scale`);
    await expect(sentence).toBeVisible();
    await expect(sentence).toHaveText(`Scale: 0 to ${ends[0]} ${entry.unit}, the same in both charts.`);
    expect(await sentence.evaluate((el) => el.closest('[aria-hidden="true"]') === null)).toBe(true);
  }
});

test('the drawing is hidden from screen readers and nothing is animated', async ({ page }) => {
  await openBars(page);
  for (const selector of ['.bars-axis-row', '.bars-track']) {
    for (const el of await figure(page).locator(selector).all()) await expect(el).toHaveAttribute('aria-hidden', 'true');
  }
  const styles = await figure(page)
    .locator('.bars-bar, .bars-whisker, .bars-zero-value')
    .evaluateAll((els) => els.map((e) => [getComputedStyle(e).animationName, getComputedStyle(e).transitionDuration]));
  expect(styles.length).toBeGreaterThan(0);
  for (const s of styles) expect(s).toEqual(['none', '0s']);
});

test('below the rows the region, then the method folded under a closed disclosure', async ({ page }) => {
  await openBars(page);
  const list = await box(figure(page).getByRole('list'));
  const region = figure(page).getByText(`Region: ${entry.region}`);
  await expect(region).toBeVisible();
  expect((await box(region)).y).toBeGreaterThanOrEqual(list.y + list.height);
  const summary = figure(page).locator('details.bars-method > summary');
  await expect(summary).toHaveText(METHOD_SUMMARY);
  expect((await box(summary)).y).toBeGreaterThanOrEqual((await box(region)).y + (await box(region)).height);
  await expect(figure(page).locator('details.bars-method')).not.toHaveAttribute('open');
  await expect(figure(page).getByText(entry.method)).toBeHidden();
});

// The method of each of three entries as long as the real ones (e2e/realLengths.ts, from pipeline/fires.py).
test.describe('the method of each of three entries of real length', () => {
  const longFigure = (page: Page, b: BarsEntry) => page.locator(`figure[data-bars-id="${b.id}"]`);
  const methodOf = (page: Page, b: BarsEntry) => longFigure(page, b).locator('details.bars-method > p');
  const summaryOf = (page: Page, b: BarsEntry) => longFigure(page, b).getByText(METHOD_SUMMARY, { exact: true });

  async function openLong(page: Page): Promise<BarsEntry[]> {
    const { bars } = await serveRealLengthTexts(page);
    await page.goto(`./?site=${YEAR_SITE_ID}`);
    for (const b of bars) await expect(longFigure(page, b)).toBeVisible();
    await panelsAtRest(page);
    return bars;
  }

  test('is not shown until its summary is clicked, is shown after, and folds again on a second click', async ({ page }) => {
    const bars = await openLong(page);
    for (const b of bars) {
      await expect(methodOf(page, b)).toHaveText(b.method);
      await expect(methodOf(page, b)).toBeHidden();
    }
    for (const b of bars) {
      await summaryOf(page, b).click();
      await expect(methodOf(page, b)).toBeVisible();
    }
    for (const b of bars) {
      await summaryOf(page, b).click();
      await expect(methodOf(page, b)).toBeHidden();
    }
  });

  test('with the keyboard: Tab goes from summary to summary, each with the focus ring; Enter opens and Space closes', async ({ page }) => {
    const bars = await openLong(page);
    await summaryOf(page, bars[0]!).focus();
    for (const [i, b] of bars.entries()) {
      if (i > 0) await page.keyboard.press('Tab');
      await expect(summaryOf(page, b)).toBeFocused();
      expect(await summaryOf(page, b).evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth])).toEqual(['solid', '3px']);
      await page.keyboard.press('Enter');
      await expect(methodOf(page, b)).toBeVisible();
    }
    for (const b of [...bars].reverse()) {
      await expect(summaryOf(page, b)).toBeFocused();
      await page.keyboard.press('Space');
      await expect(methodOf(page, b)).toBeHidden();
      await page.keyboard.press('Shift+Tab');
    }
  });

  test('the Statistics panel is much shorter with the methods closed than open', async ({ page }) => {
    const bars = await openLong(page);
    const panel = page.getByRole('region', { name: 'Statistics' });
    const closed = (await box(panel)).height;
    for (const b of bars) await summaryOf(page, b).click();
    for (const b of bars) await expect(methodOf(page, b)).toBeVisible();
    const open = (await box(panel)).height;
    const methods = (await Promise.all(bars.map((b) => box(methodOf(page, b))))).reduce((sum, m) => sum + m.height, 0);
    console.log(`MEASURED Statistics panel at ${page.viewportSize()!.width} px: ${JSON.stringify({ closed: Math.round(closed), open: Math.round(open), methods: Math.round(methods) })}`);
    expect(open - closed).toBeGreaterThanOrEqual(methods);
    expect(closed).toBeLessThan(0.75 * open);
  });

  test('the page itself never scrolls on a desktop: the side column does, with the methods closed and open', async ({ page }) => {
    // The visually hidden spans in the bar rows once took the page as their containing block and
    // stretched it to about 3,300 px at 1280 x 800, so the whole page scrolled.
    const bars = await openLong(page);
    expect(bars).toHaveLength(3);
    for (const open of [false, true]) {
      if (open) for (const b of bars) await summaryOf(page, b).click();
      for (const b of bars) await expect(methodOf(page, b)).toBeVisible({ visible: open });
      const m = await pageScroll(page);
      expect(m.page, `methods ${open ? 'open' : 'closed'}`).toBeLessThanOrEqual(m.window);
      expect(m.side, `methods ${open ? 'open' : 'closed'}: the side column scrolls`).toBeGreaterThan(m.sideClient);
    }
  });

  test('in a contrast theme the summary is drawn in the theme\'s text colour, not the panel\'s', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const bars = await openLong(page);
    const look = await summaryOf(page, bars[0]!).evaluate((el) => ({
      colour: getComputedStyle(el).color,
      opacity: getComputedStyle(el).opacity,
      panel: getComputedStyle(el.closest('.panel')!).backgroundColor,
      text: getComputedStyle(el.closest('.panel')!).color,
    }));
    expect(look.colour).not.toBe(look.panel);
    expect(look.opacity).toBe('1');
    await summaryOf(page, bars[0]!).click();
    await expect(methodOf(page, bars[0]!)).toBeVisible();
  });

  test.describe('on a 375 px phone', () => {
    test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

    test('each summary is at least 44 px tall, and opening it changes nothing else of the figure', async ({ page }) => {
      const bars = await openLong(page);
      for (const b of bars) expect((await box(summaryOf(page, b))).height).toBeGreaterThanOrEqual(44);
      const panel = page.getByRole('region', { name: 'Statistics' });
      const closed = (await box(panel)).height;
      const rowsBefore = await longFigure(page, bars[0]!).locator('.bars-rows').evaluate((el) => el.getBoundingClientRect().height);
      for (const b of bars) await summaryOf(page, b).tap();
      for (const b of bars) await expect(methodOf(page, b)).toBeVisible();
      const open = (await box(panel)).height;
      console.log(`MEASURED Statistics panel at 375 px: ${JSON.stringify({ closed: Math.round(closed), open: Math.round(open) })}`);
      expect(await longFigure(page, bars[0]!).locator('.bars-rows').evaluate((el) => el.getBoundingClientRect().height)).toBe(rowsBefore);
      expect(closed).toBeLessThan(0.75 * open);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });

    test('the long title, the scale in words, the region and the opened method (ending with its credit) all stay inside the screen', async ({ page }) => {
      const bars = await openLong(page);
      expect(bars).toHaveLength(3);
      for (const b of bars) await summaryOf(page, b).tap();
      for (const b of bars) {
        await expect(methodOf(page, b)).toBeVisible();
        await expect(longFigure(page, b).locator('figcaption')).toHaveText(`${b.title} (${b.unit})`);
        await expect(longFigure(page, b).locator('.bars-scale')).toHaveText(/, the same in all three charts\.$/);
      }
      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth - window.innerWidth,
        // Nothing sticks out sideways, and no text is cut off inside its own box.
        wide: [...document.querySelectorAll('figure.bars, figure.bars *')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && (b.right > window.innerWidth + 0.5 || b.left < -0.5);
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
        clipped: [...document.querySelectorAll('figure.bars figcaption, figure.bars p, figure.bars summary')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      }));
      expect(overflow).toEqual({ page: 0, wide: [], clipped: [] });
    });

    test('the page itself never scrolls: the one column under the header does, with the methods open', async ({ page }) => {
      const bars = await openLong(page);
      for (const b of bars) await summaryOf(page, b).tap();
      for (const b of bars) await expect(methodOf(page, b)).toBeVisible();
      expect(await pageScroll(page)).toMatchObject({ page: 740, window: 740 });
    });
  });
});

test("each label carries its class's colour, in a rimmed swatch", async ({ page }) => {
  await openBars(page);
  for (const [i, c] of CATS.entries()) {
    const swatch = rows(page).nth(i).locator('.swatch');
    const cls = SYN_CLASS_ENCODING.classes.find((k: { value: number }) => k.value === c.class);
    if (!cls) {
      await expect(swatch).toHaveCount(0);
      continue;
    }
    await expect(swatch).toHaveAttribute('aria-hidden', 'true');
    await expect(swatch).toHaveCSS('background-color', rgb(cls.color));
    await expect(swatch).toHaveCSS('border-top-width', '1px');
    await expect(swatch).toHaveCSS('border-top-style', 'solid');
  }
});

test('in a contrast theme the bar, the whisker and the zero line are still drawn', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openBars(page);
  const row = rows(page).nth(CATS.findIndex((c) => hasInterval(c) && (c.value ?? 0) > 0));
  const look = (selector: string, side: 'top' | 'left') =>
    row.locator(selector).evaluate(
      (e, s) => {
        const c = getComputedStyle(e);
        const panel = getComputedStyle(e.closest('.panel')!).backgroundColor;
        return { width: c.getPropertyValue(`border-${s}-width`), colour: c.getPropertyValue(`border-${s}-color`), panel };
      },
      side,
    );
  for (const [selector, side] of [
    ['.bars-bar', 'top'],
    ['.bars-whisker', 'top'],
    ['.bars-zero-line', 'left'],
  ] as const) {
    const s = await look(selector, side);
    expect(parseFloat(s.width), selector).toBeGreaterThanOrEqual(1);
    expect(s.colour, selector).not.toBe(s.panel);
  }
});

test('the bars are there whatever layer is selected', async ({ page }) => {
  await openBars(page);
  for (const layer of site.layers) {
    await page.getByLabel('Layer', { exact: true }).selectOption(layer.id);
    await expect.poll(() => new URL(page.url()).searchParams.get('layer')).toBe(layer.id);
    await expect(rows(page), layer.id).toHaveCount(CATS.length);
  }
});

test('a site without bars shows its series and nothing extra', async ({ page }) => {
  expect((buildStats() as Stats).bars).toBeUndefined();
  await page.goto(`./?site=${SITE_ID}`);
  await expect(page.locator('#site-title')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Statistics' });
  await expect(panel.locator('figure.series')).toHaveCount(buildStats().series.length);
  await expect(panel.locator('figure.bars')).toHaveCount(0);
  await expect(panel).not.toContainText('No statistics');
});

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('the rows stack, the label above its bar, with nothing sticking out sideways', async ({ page }) => {
    await openBars(page);
    await figure(page).scrollIntoViewIfNeeded();
    for (const [i, c] of CATS.entries()) {
      if (c.value === null) continue;
      const row = rows(page).nth(i);
      const label = await box(row.locator('.bars-label'));
      const track = await box(row.locator('.bars-track'));
      const numbers = await box(row.locator('.bars-numbers'));
      expect(label.y + label.height, `row ${i}: label above its bar`).toBeLessThanOrEqual(track.y + 0.5);
      expect(track.y + track.height, `row ${i}: bar above its numbers`).toBeLessThanOrEqual(numbers.y + 0.5);
      expect(track.width, `row ${i}: the bar takes the width`).toBeGreaterThan(250);
    }
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      wide: [...document.querySelectorAll('figure.bars, figure.bars *')]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && (b.right > window.innerWidth + 0.5 || b.left < -0.5);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    }));
    expect(overflow).toEqual({ page: 0, wide: [] });
  });
});

test('on a desktop the label sits beside its bar', async ({ page }) => {
  await openBars(page);
  const i = CATS.findIndex(hasInterval);
  const label = await box(rows(page).nth(i).locator('.bars-label'));
  const track = await box(rows(page).nth(i).locator('.bars-track'));
  expect(label.x + label.width).toBeLessThanOrEqual(track.x);
});

test('on a desktop the page itself never scrolls with the bars in the side column', async ({ page }) => {
  await openBars(page);
  const m = await pageScroll(page);
  expect(m.page).toBeLessThanOrEqual(m.window);
});
