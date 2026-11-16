// The overlay's notes on the map with texts as long as the real ones (pipeline/fires.py), served by
// e2e/realLengths.ts: the caption box holds the caption and the sentence but no credit, the credit is
// in the map's credit line and the legend, on a phone the box is in the strip under the map (never
// on it), and on a narrow map the expanded credit line takes at most 35 % of the map's height, so
// that the box and the line never cover the map between them. Each test logs what it measured
// (MEASURED ...), for the notes.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { OVERLAY_NOT_NISAR } from '../src/state/overlayPeriod';
import { OVERLAY_DATE_RANGE, OVERLAY_ID, YEAR_DATES, YEAR_LAYERS, YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { REAL_TEXT_LENGTHS, realLengthTexts, serveRealLengthTexts } from './realLengths';
import { expect, openAt, test } from './support';

type MapLike = import('maplibre-gl').Map;

const [RANGE_START] = OVERLAY_DATE_RANGE as [string, string];
/** The date whose period the start of the overlay's range clips: the longest caption the fixture has. */
const STRADDLE = YEAR_DATES.find((d, i) => d < RANGE_START && (YEAR_DATES[i + 1] ?? '') > RANGE_START)!;
const LINK = `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}&date=${STRADDLE}&overlays=${OVERLAY_ID}`;

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/** Opens the link with the overlay on, the texts at real length, and waits for the box and the credit line to carry them. */
async function openWithRealTexts(page: Page) {
  const texts = await serveRealLengthTexts(page);
  await openAt(page, LINK);
  await expect(page.getByTestId('overlay-map-caption')).toContainText(OVERLAY_NOT_NISAR);
  await expect(page.getByTestId('overlay-map-caption')).toContainText(texts.overlay.title);
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText(texts.overlay.credit);
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText(texts.citation);
  return texts;
}

/** Where the map, the caption box and the credit line are, and what the credit line shows. */
const measure = (page: Page, citation: string) =>
  page.evaluate((citation) => {
    const rect = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const credit = document.querySelector('.maplibregl-ctrl-attrib')!;
    const inner = credit.querySelector('.maplibregl-ctrl-attrib-inner')!;
    // Where the site's own credit is drawn inside the credit line, and whether all of it is in view.
    const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
    let citationBox: Box | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(citation);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + citation.length);
      const r = range.getBoundingClientRect();
      citationBox = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }
    const innerBox = rect(inner)!;
    return {
      map: rect(document.querySelector('#map'))!,
      // The notes the caption box is in: on the map, or the strip under it.
      notes: rect(document.querySelector('[data-testid="overlay-map-caption"]')!.parentElement)!,
      caption: rect(document.querySelector('[data-testid="overlay-map-caption"]'))!,
      captionScrolls: (() => {
        const box = document.querySelector('[data-testid="overlay-map-caption"]')!;
        return box.scrollHeight > box.clientHeight + 1;
      })(),
      credit: rect(credit)!,
      creditExpanded: credit.classList.contains('maplibregl-compact-show'),
      innerScrolls: inner.scrollHeight > inner.clientHeight + 1,
      innerMaxHeight: getComputedStyle(inner).maxHeight,
      citationInView: citationBox !== null && citationBox.top >= innerBox.top - 0.5 && citationBox.bottom <= innerBox.bottom + 0.5,
      pageWidth: document.documentElement.scrollWidth,
    };
  }, citation);

/** The real sites' own credits, as the app reads them (web/public/data/manifest.json), for which the SYNTHETIC citation stands in. */
const REAL_CITATIONS = (
  JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'manifest.json'), 'utf8')) as {
    sites: { is_sample?: boolean; source: { citation?: string } }[];
  }
).sites.flatMap((s) => (!s.is_sample && s.source.citation ? [s.source.citation] : []));

/**
 * Checks that the SYNTHETIC citation is at least as wide on one line as every real site's credit, in
 * the font the credit line has in this browser (its computed font, once document.fonts.ready): the
 * layout tests stand it in for the real credit, so in a font where it is narrower they could pass
 * while the real credit wraps. Then this fails instead. Each text is measured in a span inside the
 * credit line, which takes the line's font, size, spacing and kerning, out of the flow, on one line.
 */
async function expectCitationAsWideAsReal(page: Page, citation: string): Promise<void> {
  expect(REAL_CITATIONS.length, 'the real sites\' credits in web/public/data/manifest.json').toBeGreaterThan(0);
  const { font, widths } = await page.evaluate(async (texts) => {
    await document.fonts.ready;
    const inner = document.querySelector('.maplibregl-ctrl-attrib-inner')!;
    const span = document.createElement('span');
    span.style.cssText = 'position: absolute; visibility: hidden; white-space: pre; width: max-content';
    inner.append(span);
    const widths = texts.map((text) => {
      span.textContent = text;
      return span.getBoundingClientRect().width;
    });
    span.remove();
    return { font: getComputedStyle(inner).font, widths };
  }, [citation, ...REAL_CITATIONS]);
  const [standIn, ...real] = widths as [number, ...number[]];
  console.log(`MEASURED one-line widths in ${font}: ${JSON.stringify({ synthetic: +standIn.toFixed(1), real: real.map((w) => +w.toFixed(1)) })}`);
  for (const [i, width] of real.entries())
    expect(standIn, `in ${font}: the SYNTHETIC citation takes ${standIn.toFixed(1)} px, the real "${REAL_CITATIONS[i]}" ${width.toFixed(1)} px`).toBeGreaterThanOrEqual(width);
}

const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** How much of the map's height neither the box nor the credit line covers (any row either touches counts as covered). */
function freeHeight(map: Box, ...boxes: Box[]): number {
  const spans = boxes
    .map((b) => [Math.max(map.top, b.top), Math.min(map.bottom, b.bottom)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let end = -Infinity;
  for (const [a, b] of spans) {
    if (b <= end) continue;
    covered += b - Math.max(a, end);
    end = b;
  }
  return map.height - covered;
}

const log = (label: string, m: Awaited<ReturnType<typeof measure>>, extra: Record<string, number> = {}) =>
  console.log(
    `MEASURED ${label}: ${JSON.stringify({
      map: Math.round(m.map.height),
      captionBox: [Math.round(m.caption.width), Math.round(m.caption.height)],
      creditLine: [Math.round(m.credit.width), Math.round(m.credit.height)],
      ...extra,
    })}`,
  );

test('the texts served are at least as long as the real ones, all SYNTHETIC, none in the real words', () => {
  const texts = realLengthTexts();
  const L = REAL_TEXT_LENGTHS;
  const all: [string, number][] = [
    [texts.citation, L.siteCitation],
    [texts.overlay.title, L.overlayTitle],
    [texts.overlay.description, L.overlayDescription],
    [texts.overlay.method, L.overlayMethod],
    [texts.overlay.credit, L.overlayCredit],
  ];
  expect(texts.bars).toHaveLength(L.barsEntries);
  expect(new Set(texts.bars.map((b) => b.id)).size).toBe(L.barsEntries);
  for (const b of texts.bars) {
    all.push([b.title, L.barsTitle], [b.method, L.barsMethod], [b.region!, L.barsRegion]);
    for (const c of b.categories) all.push([c.note ?? '', L.barsNote]);
  }
  for (const [text, min] of all) {
    expect(text.length, text).toBeGreaterThanOrEqual(min);
    expect(text).toContain('SYNTHETIC');
    // Never the real wording: no instrument, programme or agency of the real texts.
    expect(text).not.toMatch(/VIIRS|FIRMS|NASA|LANCE|ESDIS|Garwood|harvest/i);
  }
});

test.describe('at 1280 x 800', () => {
  test('the box holds the caption and the sentence, not the credit, in at most 20 % of the map; the credit line is as MapLibre draws it', async ({ page }) => {
    const texts = await openWithRealTexts(page);
    const box = page.getByTestId('overlay-map-caption');
    await expect(box).not.toContainText(texts.overlay.credit);
    await expect(box).not.toContainText('Credit');
    // The legend carries the credit in full.
    await expect(page.getByTestId('legend-overlay')).toContainText(`Credit: ${texts.overlay.credit}`);
    const m = await measure(page, texts.citation);
    log('1280x800', m);
    expect(m.caption.height).toBeLessThanOrEqual(0.2 * m.map.height);
    expect(m.captionScrolls).toBe(false);
    // A wide map: no cap, nothing scrolls inside the line.
    expect(m.map.width).toBeGreaterThan(640);
    expect(m.innerMaxHeight).toBe('none');
    expect(m.innerScrolls).toBe(false);
    expect(overlap(m.caption, m.credit)).toBe(false);
  });
});

test.describe('on a 375 x 740 phone', () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true });

  // The box used to sit on the map here (at most 40 % of it); on a phone it now goes in the strip
  // under the map at every height, so only the credit line is on the map.
  test('right after loading: the box in the strip under the map, the credit line at most 35 % of the map, the site credit in view', async ({ page }) => {
    const texts = await openWithRealTexts(page);
    const m = await measure(page, texts.citation);
    log('375x740', m, { strip: Math.round(m.notes.height), free: Math.round(freeHeight(m.map, m.caption, m.credit)) });
    expect(m.pageWidth).toBeLessThanOrEqual(375);
    expect(m.creditExpanded, 'the credit line is expanded until the map is first moved').toBe(true);
    expect(Math.abs(m.notes.top - m.map.bottom), 'the strip is right under the map').toBeLessThanOrEqual(1);
    expect(m.caption.top).toBeGreaterThanOrEqual(m.map.bottom);
    expect(m.captionScrolls, 'the box shows all its text').toBe(false);
    await expect(page.getByTestId('overlay-map-caption')).not.toContainText(texts.overlay.credit);
    expect(m.credit.height).toBeLessThanOrEqual(0.35 * m.map.height + 0.5);
    expect(overlap(m.caption, m.credit)).toBe(false);
    // Only the credit line is on the map.
    expect(freeHeight(m.map, m.caption, m.credit)).toBeGreaterThanOrEqual(0.64 * m.map.height);
    // The rest of the credits scroll inside the line; the site's own credit, the shorter, comes first, in view.
    expect(m.innerScrolls).toBe(true);
    expect(m.citationInView).toBe(true);
    await expect(page.getByTestId('legend-overlay')).toContainText(`Credit: ${texts.overlay.credit}`);
  });

  test('folded and opened again with its button, the credit line keeps to 35 % of the map; the button keeps the focus ring', async ({ page }) => {
    const texts = await openWithRealTexts(page);
    const button = page.locator('.maplibregl-ctrl-attrib-button');
    await button.click();
    await expect(page.locator('.maplibregl-ctrl-attrib')).not.toHaveClass(/maplibregl-compact-show/);
    await button.click();
    await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveClass(/maplibregl-compact-show/);
    const m = await measure(page, texts.citation);
    expect(m.credit.height).toBeLessThanOrEqual(0.35 * m.map.height + 0.5);
    expect(m.citationInView).toBe(true);
    // The app's focus ring on MapLibre's button (styles.css), not clipped by the scrolling list.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    expect(await button.evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineWidth])).toEqual(['solid', '3px']);
  });
});

test.describe('on a 375 x 812 phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('nothing of the app covers the map (a grid of points hits its canvas or MapLibre\'s own controls), the strip shows the caption, and taps reach the map', async ({ page }) => {
    const texts = await openWithRealTexts(page);
    const m = await measure(page, texts.citation);
    log('375x812', m, { strip: Math.round(m.notes.height) });
    expect(m.pageWidth).toBeLessThanOrEqual(375);

    // The strip right under the map shows the caption and the sentence, all of it, on screen.
    const caption = page.getByTestId('overlay-map-caption');
    expect(Math.abs(m.notes.top - m.map.bottom), 'the strip is right under the map').toBeLessThanOrEqual(1);
    expect(m.caption.top).toBeGreaterThanOrEqual(m.map.bottom);
    expect(m.captionScrolls).toBe(false);
    await expect(caption).toContainText(texts.overlay.title);
    await expect(caption).toContainText(OVERLAY_NOT_NISAR);
    await expect(caption).toBeInViewport({ ratio: 1 });

    // A grid of points over the map: each hits the map's canvas, or one of MapLibre's own controls
    // (the credit line is expanded until the map is first moved).
    const hits = await page.evaluate(() => {
      const map = document.querySelector('#map')!;
      const canvas = map.querySelector('canvas.maplibregl-canvas');
      const r = map.getBoundingClientRect();
      const out = { points: 0, canvas: 0, controls: 0, other: [] as string[] };
      const n = 15;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = r.left + 2 + ((r.width - 4) * (i + 0.5)) / n;
          const y = r.top + 2 + ((r.height - 4) * (j + 0.5)) / n;
          const el = document.elementFromPoint(x, y);
          out.points += 1;
          if (el && el === canvas) out.canvas += 1;
          else if (el?.closest('.maplibregl-control-container')) out.controls += 1;
          else out.other.push(`${Math.round(x)},${Math.round(y)}: ${el ? `${el.tagName.toLowerCase()}.${String(el.className)}` : 'nothing'}`);
        }
      }
      return out;
    });
    console.log(`MEASURED 375x812 grid: ${JSON.stringify({ points: hits.points, canvas: hits.canvas, controls: hits.controls })}`);
    expect(hits.other).toEqual([]);
    // Most of the rest is the expanded credit line, at most 35 % of the map's height.
    expect(hits.canvas).toBeGreaterThanOrEqual(0.5 * hits.points);

    // Taps reach the map: at the top left, where the box used to be, and in the middle.
    await page.evaluate(() => {
      const w = window as unknown as { __map: MapLike; __taps: [number, number][] };
      w.__taps = [];
      w.__map.on('click', (e) => w.__taps.push([e.point.x, e.point.y]));
    });
    const taps = [
      [40, 40],
      [Math.round(m.map.width / 2), Math.round(m.map.height / 2)],
    ] as const;
    for (const [k, [x, y]] of taps.entries()) {
      await page.touchscreen.tap(m.map.left + x, m.map.top + y);
      await expect.poll(() => page.evaluate(() => (window as unknown as { __taps: unknown[] }).__taps.length)).toBe(k + 1);
      const [px, py] = (await page.evaluate(() => (window as unknown as { __taps: [number, number][] }).__taps.at(-1)!))!;
      expect(Math.abs(px - x) + Math.abs(py - y), `tap at ${x},${y} reached the map at ${px},${py}`).toBeLessThanOrEqual(2);
    }
    // And the map marks the point read.
    await expect(page.locator('#map .maplibregl-marker')).toBeVisible();
  });
});

test.describe('on a phone held sideways (667 x 375)', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true });

  test('the strip under the map shows all of its text, and the credit line keeps to 35 % of the short map', async ({ page }) => {
    const texts = await openWithRealTexts(page);
    // Whether the site's credit fits the one row the line has here depends on its width in the font:
    // the SYNTHETIC citation is a test of the real credit only where it is at least as wide.
    await expectCitationAsWideAsReal(page, texts.citation);
    const m = await measure(page, texts.citation);
    log('667x375', m, { strip: Math.round(m.notes.height) });
    expect(m.pageWidth).toBeLessThanOrEqual(667);
    expect(Math.abs(m.notes.top - m.map.bottom), 'the strip is right under the map').toBeLessThanOrEqual(1);
    expect(m.captionScrolls).toBe(false);
    const lines = await page.getByTestId('overlay-map-caption').locator('p').evaluateAll((ps) =>
      ps.map((p) => {
        const r = p.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.top).toBeGreaterThanOrEqual(m.caption.top);
      expect(line.bottom).toBeLessThanOrEqual(m.caption.bottom + 0.5);
    }
    await expect(page.getByTestId('overlay-map-caption')).not.toContainText(texts.overlay.credit);
    // A wide but short map: the credit line keeps to 35 % of it too (uncapped it took 124 of 132 px).
    expect(m.map.width).toBeGreaterThan(640);
    expect(m.creditExpanded).toBe(true);
    expect(m.credit.height).toBeLessThanOrEqual(0.35 * m.map.height + 0.5);
    expect(m.citationInView).toBe(true);
  });
});
