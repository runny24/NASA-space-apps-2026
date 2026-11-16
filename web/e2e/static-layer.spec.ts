// A static layer (one map, no dates) on the SYNTHETIC year site: its class layer. Ids, labels and
// colours come from tests/fixtures/synthetic.mjs, never from literals.

import type { Page } from '@playwright/test';
import { STATIC_LAYER_NOTE } from '../src/components/Controls';
import { SYN_CLASS_ENCODING, YEAR_GRID, YEAR_LAYERS, YEAR_SITE_ID, buildManifest, mercatorToLonLat, yearClassCodes } from '../tests/fixtures/synthetic.mjs';
import { canvasColours, clickMapAt, dataFingerprint, expect, openAt, test } from './support';

const CLASSES = SYN_CLASS_ENCODING.classes;
const site = buildManifest().sites.find((s: { id: string }) => s.id === YEAR_SITE_ID)!;
const classLayer = site.layers.find((l: { id: string }) => l.id === YEAR_LAYERS.classes)!;

/** WCAG contrast ratio of two colours written "rgb(r, g, b)". */
function contrast(a: string, b: string): number {
  const lum = (css: string) => {
    const [r, g, bl] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** "#rrggbb" as getComputedStyle writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function openStaticLayer(page: Page): Promise<void> {
  // Open on a per-date layer with a date, then choose the static layer, as a person would.
  await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}`);
  await expect(page.getByTestId('current-date')).toBeVisible();
  await page.getByLabel('Layer', { exact: true }).selectOption(YEAR_LAYERS.classes);
  await expect(page.getByTestId('static-note')).toBeVisible();
}

const legendList = (page: Page) => page.getByRole('list', { name: `Classes of ${classLayer.title}` });

test('a static layer shows a note instead of the date controls, and the link carries no date', async ({ page }) => {
  await openStaticLayer(page);
  await expect(page.getByTestId('static-note')).toHaveText(STATIC_LAYER_NOTE);
  await expect(page.getByRole('group', { name: 'Date (UTC)' })).toHaveCount(0);
  await expect(page.getByTestId('current-date')).toHaveCount(0);
  await expect(page.locator('.timeline')).toHaveCount(0);
  await expect(page.getByTestId('play')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('layer')).toBe(YEAR_LAYERS.classes);
  expect(new URL(page.url()).searchParams.has('date')).toBe(false);
  // The tag on the map names the layer alone: there is no date to name.
  await expect(page.getByTestId('map-showing')).toHaveText(`On the map: ${classLayer.title}`);

  // The arrow keys do nothing.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const before = page.url();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('static-note')).toBeVisible();
  expect(page.url()).toBe(before);
});

test('the legend lists every class with the colour and the label of the manifest', async ({ page }) => {
  await openStaticLayer(page);
  const items = legendList(page).getByRole('listitem');
  await expect(items).toHaveText(CLASSES.map((c) => c.label));
  const swatches = await legendList(page)
    .locator('.swatch')
    .evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return {
          background: s.backgroundColor,
          border: s.borderTopStyle,
          width: parseFloat(s.borderTopWidth),
          rim: s.borderTopColor,
          panel: getComputedStyle(el.closest('.panel')!).backgroundColor,
        };
      }),
    );
  expect(swatches.map((s) => s.background)).toEqual(CLASSES.map((c) => rgb(c.color)));
  for (const s of swatches) {
    expect(s).toMatchObject({ border: 'solid' });
    expect(s.width).toBeGreaterThanOrEqual(1);
    // The rim stands out from the panel (3:1, as for any graphic that carries meaning), so a
    // light class colour does not vanish into it.
    expect(contrast(s.rim, s.panel)).toBeGreaterThanOrEqual(3);
  }
  await expect(page.locator('.legend')).toContainText(classLayer.description);
});

test('the map draws the classes in their colours, and a click reads the class label', async ({ page }) => {
  await openStaticLayer(page);
  await dataFingerprint(page); // hides the basemap, so only the data layer is on the canvas
  const colours = await canvasColours(page);
  for (const c of CLASSES) expect(colours, c.label).toContain(c.color.toLowerCase());

  // The middle of a pixel of each of two classes: the one nearest the middle of the grid whose
  // neighbours all share its class, so the reading cannot fall over an edge.
  const codes = yearClassCodes();
  const { width, height } = YEAR_GRID;
  const centreOf = (value: number) => {
    let best: [number, number] | null = null;
    for (let r = 2; r < height - 2; r++)
      for (let c = 2; c < width - 2; c++) {
        const inside = [0, 1, -1].every((dr) => [0, 1, -1].every((dc) => codes[(r + dr) * width + c + dc] === value));
        const far = (rc: [number, number]) => Math.hypot(rc[0] - height / 2, rc[1] - width / 2);
        if (inside && (!best || far([r, c]) < far(best))) best = [r, c];
      }
    if (!best) throw new Error(`no pixel of class ${value}`);
    const [r, c] = best;
    return mercatorToLonLat(YEAR_GRID.x0 + (c + 0.5) * YEAR_GRID.res, YEAR_GRID.y0 - (r + 0.5) * YEAR_GRID.res);
  };
  for (const cls of [CLASSES[0]!, CLASSES[CLASSES.length - 1]!]) {
    const [lon, lat] = centreOf(cls.value);
    await clickMapAt(page, lon, lat);
    await expect(page.getByTestId('inspect-value')).toHaveText(cls.label);
    await expect(page.getByTestId('inspect')).toContainText('Value (whole series)');
  }
});

test.describe('in a contrast theme (forced colours)', () => {
  test.use({ forcedColors: 'active' });

  test('every swatch keeps its colour and a visible rim', async ({ page }) => {
    await openStaticLayer(page);
    const swatches = await legendList(page)
      .locator('.swatch')
      .evaluateAll((els) =>
        els.map((el) => {
          const s = getComputedStyle(el);
          return { background: s.backgroundColor, border: s.borderTopStyle, rim: s.borderTopColor, panel: getComputedStyle(el.closest('.panel')!).backgroundColor };
        }),
      );
    expect(swatches.map((s) => s.background)).toEqual(CLASSES.map((c) => rgb(c.color)));
    for (const s of swatches) {
      expect(s.border).toBe('solid');
      expect(contrast(s.rim, s.panel)).toBeGreaterThanOrEqual(3); // the rim stands apart from the panel behind it
    }
  });
});
