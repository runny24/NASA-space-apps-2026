// The tool with less to read at once, and its small motion (docs/MOTION_AND_STORY_BRIEF.md, slice 4),
// on the SYNTHETIC year site. Three long texts fold under a closed native <details> (a series' region
// and method, the dated reasons of the missing passes, the layer's method); what must stay in view
// stays, the bar charts' regions among it.
// Only the frame moves: never the timeline's marks, the bars or the "Loading the picture" note, and
// nothing at all with reduced motion. Texts, dates and ids come from tests/fixtures/synthetic.mjs.

import type { Locator, Page } from '@playwright/test';
import { MISSING_REASONS_SUMMARY, missingCountText } from '../src/components/Controls';
import { LEGEND_METHOD_SUMMARY } from '../src/components/Legend';
import { MIXED_RELEASE_WARNING, SERIES_METHOD_LABEL, SERIES_METHOD_SUMMARY, SERIES_REGION_LABEL } from '../src/components/StatsPanel';
import type { Stats } from '../src/contract/stats';
import { OVERLAY_NOT_NISAR } from '../src/state/overlayPeriod';
import { BARS_ID, buildManifest, buildYearStats, OVERLAY_ID, YEAR_LAYERS, YEAR_MISSING, YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { expect, openAt, test } from './support';

interface FixtureSite {
  id: string;
  source: { release: string };
  layers: { id: string; description: string; method?: string }[];
  overlays: { id: string; description: string; method?: string; credit: string }[];
}

const yearSite = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID) as unknown as FixtureSite;
const HH = yearSite.layers.find((l) => l.id === YEAR_LAYERS.hh)!;
const OVERLAY = yearSite.overlays.find((o) => o.id === OVERLAY_ID)!;
const SERIES = (buildYearStats() as Stats).series;
const QUERY = `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}`;
/** The layer's method in the legend, and the method in the entry of an overlay that is on (the same markup). */
const LAYER_METHOD = '.legend > details.legend-method';
const OVERLAY_METHOD = '[data-testid="legend-overlay"] details.legend-method';
/** The class components/MapView.tsx gives the marker for its ring (not imported: MapView pulls in the map's code). */
const MARKER_RING = /\bpoint-marker-ring\b/;

/** Opens the year site on its first per-date layer and waits for the map's picture and the Statistics panel. */
async function openTool(page: Page, extra = ''): Promise<void> {
  await openAt(page, `${QUERY}${extra}`);
  await expect(page.locator('figure.series').first()).toBeVisible();
  await expect(page.locator(`figure[data-bars-id="${BARS_ID}"]`)).toBeVisible();
}

/** For this page only, serves the manifest with the year site marked as mixed-release (nothing is written anywhere). */
async function markMixedRelease(page: Page): Promise<void> {
  await page.route('**/manifest.json', async (route) => {
    const response = await route.fetch();
    const manifest = (await response.json()) as { sites: FixtureSite[] };
    const site = manifest.sites.find((s) => s.id === YEAR_SITE_ID);
    if (site) site.source.release = 'mixed';
    await route.fulfill({ response, json: manifest });
  });
}

const ring = (summary: Locator) => summary.evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth]);

test.describe('the folds', () => {
  test('are closed at first, and everything that must stay in view does', async ({ page }) => {
    await markMixedRelease(page);
    await openTool(page, `&overlays=${OVERLAY_ID}`);

    // Each series: its title, unit and chart in view; its region and method folded.
    const figures = page.locator('figure.series');
    await expect(figures).toHaveCount(SERIES.length);
    for (const [i, s] of SERIES.entries()) {
      const figure = figures.nth(i);
      await expect(figure.locator('figcaption')).toBeVisible();
      await expect(figure.locator('figcaption')).toHaveText(`${s.title}${s.unit ? ` (${s.unit})` : ''}`);
      await expect(figure.locator('svg.chart')).toBeVisible();
      await expect(figure.locator('details.series-method')).not.toHaveAttribute('open');
      await expect(figure.locator('details.series-method > summary')).toHaveText(SERIES_METHOD_SUMMARY);
      await expect(figure.getByText(s.region)).toBeHidden();
      await expect(figure.getByText(s.method)).toBeHidden();
    }
    // The bar charts are left as they were: each region in view.
    const barsRegions = page.locator('figure.bars .bars-region');
    expect(await barsRegions.count()).toBeGreaterThan(0);
    for (const r of await barsRegions.all()) await expect(r).toBeVisible();

    // The missing passes: every hatched mark and the key in view, and how many; their dated reasons folded.
    await expect(page.locator('.timeline .tick-missing')).toHaveCount(YEAR_MISSING.length);
    await expect(page.locator('.timeline-key .tick-missing')).toBeVisible();
    await expect(page.getByTestId('missing-count')).toBeVisible();
    await expect(page.getByTestId('missing-count')).toHaveText(missingCountText(YEAR_MISSING.length));
    await expect(page.locator('details.missing-reasons')).not.toHaveAttribute('open');
    await expect(page.locator('details.missing-reasons > summary')).toHaveText(MISSING_REASONS_SUMMARY);
    for (const m of YEAR_MISSING) await expect(page.getByText(`Missing ${m.date}: ${m.reason}`)).toBeHidden();

    // The legend: the description in view; the method folded. The overlay's entry folds its method the
    // same way (its description, sentence and credit stay in view: below).
    await expect(page.locator('.legend .legend-description')).toBeVisible();
    await expect(page.locator('.legend .legend-description')).toHaveText(HH.description);
    await expect(page.locator(LAYER_METHOD)).not.toHaveAttribute('open');
    await expect(page.locator(`${LAYER_METHOD} > summary`)).toHaveText(LEGEND_METHOD_SUMMARY);
    await expect(page.locator(`${LAYER_METHOD} > p`)).toBeHidden();
    await expect(page.locator(OVERLAY_METHOD)).not.toHaveAttribute('open');
    await expect(page.locator(`${OVERLAY_METHOD} > summary`)).toHaveText(LEGEND_METHOD_SUMMARY);
    await expect(page.locator(`${OVERLAY_METHOD} > p`)).toBeHidden();
    await expect(page.getByTestId('legend-overlay').getByText(OVERLAY.description, { exact: true })).toBeVisible();

    // Never folded: the sample notice, the citation, the mixed-release warning (in the place's panel and
    // in Statistics), the overlay's sentence and credit, and the map's credit line.
    await expect(page.getByTestId('sample-notice')).toBeVisible();
    await expect(page.getByTestId('site-citation')).toBeVisible();
    const warnings = page.locator('.side .warning').filter({ hasText: MIXED_RELEASE_WARNING });
    await expect(warnings).toHaveCount(2);
    for (const w of await warnings.all()) await expect(w).toBeVisible();
    const legendOverlay = page.getByTestId('legend-overlay');
    await expect(legendOverlay.getByText(OVERLAY_NOT_NISAR, { exact: true })).toBeVisible();
    await expect(legendOverlay.getByText(`Credit: ${OVERLAY.credit}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('overlay-map-caption').getByText(OVERLAY_NOT_NISAR, { exact: true })).toBeVisible();
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
    const folded = '[data-testid="sample-notice"], [data-testid="site-citation"], .warning, [data-testid="legend-overlay"], .legend-description, [data-testid="missing-count"], .timeline, figcaption, .bars-region';
    await expect(page.locator('details').locator(folded)).toHaveCount(0);
  });

  test('each opens and closes with the keyboard, with the focus ring on its summary, and shows its text word for word', async ({ page }) => {
    await openTool(page);
    const missing = page.locator('details.missing-reasons > summary');
    // From the last date on the timeline, Tab goes on to the reasons of the missing passes.
    await page.locator('.timeline button.tick').last().focus();
    await page.keyboard.press('Tab');
    await expect(missing).toBeFocused();

    const folds: [Locator, Locator][] = [
      [missing, page.locator('ul.missing-list')],
      [page.locator(`${LAYER_METHOD} > summary`), page.locator(`${LAYER_METHOD} > p`)],
      ...SERIES.map((_, i): [Locator, Locator] => [page.locator('details.series-method > summary').nth(i), page.locator('details.series-method').nth(i).locator('p').first()]),
    ];
    for (const [summary, content] of folds) {
      await summary.focus();
      await expect(summary).toBeFocused();
      expect(await ring(summary)).toEqual(['solid', '3px']);
      await page.keyboard.press('Enter');
      await expect(content).toBeVisible();
      await page.keyboard.press('Space');
      await expect(content).toBeHidden();
      await page.keyboard.press('Enter');
      await expect(content).toBeVisible();
    }
    await expect(page.locator('ul.missing-list li')).toHaveText(YEAR_MISSING.map((m) => `Missing ${m.date}: ${m.reason}`));
    await expect(page.locator(`${LAYER_METHOD} > p`)).toHaveText(HH.method!);
    for (const [i, s] of SERIES.entries())
      await expect(page.locator('details.series-method').nth(i).locator('p')).toHaveText([`${SERIES_REGION_LABEL} ${s.region}`, `${SERIES_METHOD_LABEL} ${s.method}`]);
  });

  test("an overlay's method opens and closes with the keyboard too, word for word, and opening it hides nothing", async ({ page }) => {
    await openTool(page, `&overlays=${OVERLAY_ID}`);
    const summary = page.locator(`${OVERLAY_METHOD} > summary`);
    const content = page.locator(`${OVERLAY_METHOD} > p`);
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(content).toBeVisible();
    await expect(content).toHaveText(OVERLAY.method!);
    const entry = page.getByTestId('legend-overlay');
    for (const text of [OVERLAY.description, OVERLAY_NOT_NISAR, `Credit: ${OVERLAY.credit}`]) await expect(entry.getByText(text, { exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(content).toBeHidden();
  });

  test.describe('on a 375 px phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('each summary is at least 44 px tall, and opened nothing sticks out sideways', async ({ page }) => {
      await openTool(page);
      // Measured once the panels have risen into place: a box read during a transform can come out a hair short.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      const summaries = page.locator('details.series-method > summary, details.legend-method > summary, details.missing-reasons > summary');
      await expect(summaries).toHaveCount(SERIES.length + 2);
      for (const s of await summaries.all()) expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      for (const s of await summaries.all()) await s.tap();
      await expect(page.locator('ul.missing-list')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  });
});

/** The motion of every element of `selector`: its animation's name and duration, its transitions' durations. */
const motionOf = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { name: s.animationName, animation: s.animationDuration, transition: s.transitionDuration };
    }),
  );

/** The "Loading the picture" note's own motion (styles.css): put one in the map's notes, read it, take it out. */
const loadingNoteMotion = (page: Page) =>
  page.evaluate(() => {
    const note = document.createElement('p');
    note.className = 'picture-loading';
    document.querySelector('.map-notes')!.append(note);
    const s = getComputedStyle(note);
    const out = { name: s.animationName, duration: s.animationDuration, delay: s.animationDelay, transition: s.transitionDuration };
    note.remove();
    return out;
  });

const STILL = { name: 'none', animation: '0s', transition: '0s' };

test.describe('what never moves', () => {
  test('the timeline marks (also while pressed), the bars, their whiskers and zero marks, and the loading note gained no motion', async ({ page }) => {
    await openTool(page);
    for (const selector of ['.timeline .tick', '.tick-current', '.bars-bar', '.bars-whisker', '.bars-zero-value', '.bars-zero-line']) {
      const looks = await motionOf(page, selector);
      expect(looks.length, selector).toBeGreaterThan(0);
      for (const look of looks) expect(look, selector).toEqual(STILL);
    }
    // A mark held down does not shrink as the other buttons do.
    const mark = page.locator('.timeline button.tick').first();
    const box = (await mark.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await mark.evaluate((el) => [el.matches(':active'), getComputedStyle(el).transform, getComputedStyle(el).transitionDuration])).toEqual([true, 'none', '0s']);
    await page.mouse.up();
    // The loading note keeps its own 400 ms delay and nothing else.
    expect(await loadingNoteMotion(page)).toEqual({ name: 'picture-loading-delay', duration: '0s', delay: '0.4s', transition: '0s' });
  });
});

test.describe('without a reduced-motion preference (the control for the test below)', () => {
  test('the frame moves: panels, buttons, a disclosure, the dialog, the reading and the ring from the marker', async ({ page }) => {
    await openTool(page);
    // The side panels rise once, --stagger (45 ms) apart.
    const panels = await page.locator('.side > .panel').evaluateAll((els) =>
      els.map((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDuration, getComputedStyle(el).animationDelay]),
    );
    expect(panels.length).toBeGreaterThanOrEqual(3);
    expect(panels.slice(0, 3)).toEqual([
      ['tool-panel-rise', '0.32s', '0s'],
      ['tool-panel-rise', '0.32s', '0.045s'],
      ['tool-panel-rise', '0.32s', '0.09s'],
    ]);
    // Buttons ease their colours and their press.
    expect(await page.getByRole('button', { name: 'About' }).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.12s, 0.12s, 0.12s');
    // An opened disclosure's content fades in and rises.
    await page.locator('details.series-method > summary').first().click();
    expect(await page.locator('details.series-method > p').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('tool-unfold');
    // The About dialog and its backdrop fade in.
    await page.getByRole('button', { name: 'About' }).click();
    const dialog = page.locator('dialog.about');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => [getComputedStyle(el).transitionDuration, getComputedStyle(el, '::backdrop').transitionDuration])).toEqual([
      '0.32s, 0.32s',
      '0.32s',
    ]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The value arrives as one line, and one amber ring spreads from where the marker points.
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    expect(await page.locator('.inspect-value-line').evaluate((el) => getComputedStyle(el).animationName)).toBe('tool-fade-in');
    const marker = page.locator('.maplibregl-marker');
    await expect(marker).toHaveClass(MARKER_RING);
    const spread = await marker.evaluate((el) => {
      const s = getComputedStyle(el, '::after');
      const box = el.getBoundingClientRect();
      const map = (window as unknown as { __map: import('maplibre-gl').Map }).__map;
      const canvas = map.getContainer().getBoundingClientRect();
      const point = map.project(map.getCenter());
      return {
        name: s.animationName,
        duration: s.animationDuration,
        colour: s.borderTopColor,
        // The ring's centre (it scales about its centre) and the map's point under the marker.
        ring: [box.left + parseFloat(s.left) + parseFloat(s.marginLeft) + parseFloat(s.width) / 2, box.top + parseFloat(s.top) + parseFloat(s.marginTop) + parseFloat(s.height) / 2],
        point: [canvas.left + point.x, canvas.top + point.y],
      };
    });
    expect(spread).toMatchObject({ name: 'tool-marker-ring', duration: '0.6s', colour: 'rgb(255, 176, 0)' });
    expect(Math.abs(spread.ring[0]! - spread.point[0]!)).toBeLessThanOrEqual(1);
    expect(Math.abs(spread.ring[1]! - spread.point[1]!)).toBeLessThanOrEqual(1);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing of the tool moves or waits: no duration and no delay anywhere, pseudo-elements and the backdrop included', async ({ page }) => {
    await openTool(page);
    // Everything that moves without the preference, done once: every fold opened, a value read, the dialog open.
    for (const summary of await page.locator('.side summary').all()) await summary.click();
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.getByTestId('inspect-value')).toBeVisible();
    await expect(page.locator('.maplibregl-marker')).toHaveCount(1);
    await expect(page.locator('.maplibregl-marker')).not.toHaveClass(MARKER_RING);
    await page.getByRole('button', { name: 'About' }).click();
    const dialog = page.locator('dialog.about');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => [getComputedStyle(el).opacity, getComputedStyle(el).transform])).toEqual(['1', 'none']);

    const moving = await page.evaluate(() => {
      const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
      const found: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        for (const pseudo of [null, '::before', '::after', '::backdrop']) {
          const s = getComputedStyle(el, pseudo);
          if (nonZero(s.transitionDuration) || nonZero(s.animationDuration)) found.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class'))}${pseudo ?? ''}`);
        }
      }
      return found;
    });
    expect(moving).toEqual([]);

    // None of the tool's animations is even named, so none waits on a delay (the staggered panels least of all).
    for (const selector of ['.side > .panel', '.side details[open] > :not(summary)', '.inspect-value-line']) {
      const looks = await page.locator(selector).evaluateAll((els) => els.map((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDelay]));
      expect(looks.length, selector).toBeGreaterThan(0);
      for (const look of looks) expect(look, selector).toEqual(['none', '0s']);
    }
    // The loading note is left as it is: its 400 ms delay is what keeps it from flashing on every date.
    expect(await loadingNoteMotion(page)).toEqual({ name: 'picture-loading-delay', duration: '0s', delay: '0.4s', transition: '0s' });
  });
});
