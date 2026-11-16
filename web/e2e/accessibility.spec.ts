// Phone, keyboard and reduced-motion checks of the production build. Like smoke.spec.ts they run on
// the SYNTHETIC fixtures, and nothing here names a place, a layer or a date. One test crowds the
// timeline with extra dates through page.route (crowdTheTimeline below); that copy lives only in the
// test's browser and is never written anywhere.

import type { Page } from '@playwright/test';
import { expect, expectSyntheticManifest, openedSite, test } from './support';

interface ManifestLike {
  sites: { title: string; is_sample?: boolean; layers: { id: string; kind: string; items: unknown[] }[] }[];
}

/** What the "At a point" panel shows for a value read (the same pattern as smoke.spec.ts). */
const VALUE_TEXT = /^(-?\d+(\.\d+)?( \S+)?( or (less|more))?|no data)$/;

type Dated = Record<string, unknown> & { date?: string };

/**
 * For this page only, serves a copy of the manifest in which the first per-date layer of the site the
 * app opens (openedSite) has `count` dates 12 days apart (one NISAR repeat cycle), counted from its
 * first date, every one pointing at that layer's first file. It tests a crowded timeline before real data arrives; nothing is shown as data.
 */
async function crowdTheTimeline(page: Page, count: number): Promise<void> {
  await page.route('**/manifest.json', async (route) => {
    const response = await route.fetch();
    const manifest = (await response.json()) as { sites: { is_sample?: boolean; dates: Dated[]; layers: { kind: string; items: Dated[] }[] }[] };
    const site = openedSite(manifest);
    const layer = site?.layers.find((l) => l.kind === 'per-date');
    const start = Date.parse(`${layer?.items[0]?.date}T00:00:00Z`);
    if (site && layer && !Number.isNaN(start)) {
      const dates = Array.from({ length: count }, (_, i) => new Date(start + i * 12 * 86_400_000).toISOString().slice(0, 10));
      site.dates = dates.map((date) => ({ ...site.dates[0], date }));
      layer.items = dates.map((date) => ({ ...layer.items[0], date }));
    }
    await route.fulfill({ response, json: manifest });
  });
}

/**
 * Probes the timeline on a grid, 2 to 42 px down and up to 20 px either side of every mark, and
 * returns the probes that did not pick the mark nearest to them (nothing, when that is a missing
 * pass, which cannot be shown). Probes within 1 px of halfway between two marks are skipped:
 * Chrome's elementFromPoint also counts a box that starts up to 1 px to the right of the point.
 */
function wrongTaps(page: Page): Promise<string[]> {
  return page.locator('.timeline').evaluate((timeline) => {
    timeline.scrollIntoView({ block: 'center' });
    const t = timeline.getBoundingClientRect();
    const marks = [...timeline.querySelectorAll<HTMLElement>('.tick')].map((el) => {
      const box = el.getBoundingClientRect();
      return { el, x: box.x + box.width / 2 };
    });
    const name = (el: Element | null) => (el ? (el.getAttribute('aria-label') ?? el.getAttribute('title')) : 'nothing');
    const wrong: string[] = [];
    for (const mark of marks) {
      for (let dx = -20; dx <= 20; dx += 2) {
        for (let dy = 2; dy < t.height; dy += 4) {
          const x = mark.x + dx;
          const [nearest, next] = [...marks].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
          if (nearest !== mark) continue; // judged with the mark it is nearest to
          if (next && Math.abs(next.x - x) - Math.abs(mark.x - x) < 2) continue;
          const want = mark.el.matches('button') ? mark.el : null;
          const hit = document.elementFromPoint(x, t.top + dy)?.closest('.timeline button.tick') ?? null;
          if (hit !== want) wrong.push(`${dx},${dy} from ${name(mark.el)}: ${name(hit)}`);
        }
      }
    }
    return wrong;
  });
}

type MapLike = import('maplibre-gl').Map;

async function openApp(page: Page): Promise<ManifestLike> {
  const manifestResponse = page.waitForResponse((r) => r.url().endsWith('manifest.json'));
  // story=off: the bare address opens the guided story's cover (e2e/story.spec.ts); the tests here are about the map.
  await page.goto('./?story=off');
  const manifest = (await (await manifestResponse).json()) as ManifestLike;
  expectSyntheticManifest(manifest);
  // The tests below read the site the app opens by the app's own rule; check the page agrees.
  const site = openedSite(manifest);
  if (site) await expect(page.locator('#site-title')).toHaveText(site.title);
  await page.waitForFunction(() => Boolean((window as unknown as { __map?: unknown }).__map));
  // Wait until the map has framed the site and drawn, so later readings are not disturbed by it.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as { __map: MapLike }).__map;
        if (map.loaded() && map.areTilesLoaded()) resolve();
        else map.once('idle', () => resolve());
      }),
  );
  return manifest;
}

/** Shows a per-date layer with at least two dates when the site the app opened has one. */
async function showPerDateLayer(page: Page, manifest: ManifestLike): Promise<boolean> {
  const site = openedSite(manifest);
  const perDate = site?.layers.find((l) => l.kind === 'per-date' && l.items.length > 1);
  if (!site || !perDate) return false;
  if (site.layers[0]?.id !== perDate.id) await page.getByLabel('Layer', { exact: true }).selectOption(perDate.id);
  await expect(page.getByTestId('current-date')).toBeVisible();
  return true;
}

const cooperativeGesturesOn = (page: Page) =>
  page.evaluate(() => (window as unknown as { __map: MapLike }).__map.cooperativeGestures.isEnabled());
const mapCentre = (page: Page) => page.evaluate(() => (window as unknown as { __map: MapLike }).__map.getCenter().toArray());
const mapZoom = (page: Page) => page.evaluate(() => (window as unknown as { __map: MapLike }).__map.getZoom());

/** Clicks MapLibre's zoom-in button and, in the same moment, reports whether the map is still moving. */
const zoomInNow = (page: Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __map: MapLike }).__map;
    const before = map.getZoom();
    document.querySelector<HTMLButtonElement>('.maplibregl-ctrl-zoom-in')!.click();
    return { before, after: map.getZoom(), moving: map.isMoving() };
  });

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('fits the width, keeps the notice in view, and has thumb-sized controls', async ({ page }) => {
    const manifest = await openApp(page);

    // Nothing sticks out sideways (inside the map, MapLibre clips its own drawing).
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      wide: [...document.querySelectorAll('body *')]
        .filter((el) => !el.parentElement?.closest('#map'))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.right > window.innerWidth + 0.5;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    }));
    expect(overflow).toEqual({ page: 0, wide: [] });

    const site = openedSite(manifest);
    test.skip(!site, 'the manifest has no site yet');
    const main = page.locator('.main');

    // Thumb-sized controls.
    const targets = [
      page.getByRole('button', { name: 'About' }),
      page.getByRole('button', { name: 'Zoom in' }),
      page.getByRole('button', { name: 'Zoom out' }),
      page.getByLabel('Layer', { exact: true }),
      page.getByRole('slider'),
      page.getByRole('button', { name: 'Read values at the map centre' }),
    ];
    if (await showPerDateLayer(page, manifest)) {
      targets.push(
        page.getByRole('button', { name: 'Previous date' }),
        page.getByRole('button', { name: 'Next date' }),
        page.getByRole('button', { name: 'Play', exact: true }),
      );
    }
    for (const target of targets) {
      const box = (await target.boundingBox())!;
      expect(box.height, await target.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
      expect(box.width, await target.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
    }

    // A tap on the timeline, up to 20 px beside a mark (its dot is smaller), picks the nearest mark.
    expect(await wrongTaps(page)).toEqual([]);

    // The sample notice stays on screen however far the panels are scrolled.
    if (site?.is_sample) {
      await expect(page.getByTestId('sample-notice')).toBeInViewport();
      await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(page.getByTestId('sample-notice')).toBeInViewport();
    }
  });

  for (const count of [12, 30]) {
    test(`a tap on a timeline crowded with ${count} dates picks the nearest one`, async ({ page }) => {
      await crowdTheTimeline(page, count);
      const manifest = await openApp(page);
      test.skip(!(await showPerDateLayer(page, manifest)), 'no per-date layer with two or more dates');
      await expect(page.locator('.timeline button.tick')).toHaveCount(count);
      expect(await wrongTaps(page)).toEqual([]);
    });
  }

  test('the map always leaves 7rem of the panels in view below it, on tall and short screens', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!openedSite(manifest), 'the manifest has no site yet');
    // Somewhere to put a finger or the mouse wheel and scroll. 375 x 667 is where the map's cap
    // first applies; the last three are landscape phones and 640 x 400, a 1280 x 800 desktop zoomed
    // to 200%, all still in the stacked layout.
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 375, height: 667 },
      { width: 667, height: 375 },
      { width: 568, height: 320 },
      { width: 640, height: 400 },
    ]) {
      await page.setViewportSize(viewport);
      const { room, wanted } = await page.evaluate(() => ({
        room: document.querySelector('.main')!.getBoundingClientRect().bottom - document.querySelector('.map-wrap')!.getBoundingClientRect().bottom,
        wanted: 7 * parseFloat(getComputedStyle(document.documentElement).fontSize),
      }));
      expect(room, `${viewport.width} x ${viewport.height}`).toBeGreaterThanOrEqual(wanted - 0.5);
    }
  });

  test('nothing reaches below the app: the page itself does not scroll, only the column of panels', async ({ page }) => {
    const manifest = await openApp(page);
    // A per-date layer has the visually hidden playback status line under its stepper.
    test.skip(!(await showPerDateLayer(page, manifest)), 'no per-date layer with two or more dates');
    await expect(page.getByTestId('playback-status')).toHaveCount(1);
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 320, height: 640 },
    ]) {
      await page.setViewportSize(viewport);
      const seen = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const app = document.querySelector('.app')!.getBoundingClientRect();
        return {
          pageHeight: document.documentElement.scrollHeight,
          pageScrolledBy: window.scrollY,
          appBottom: Math.round(app.bottom),
          windowHeight: window.innerHeight,
        };
      });
      const size = `${viewport.width} x ${viewport.height}`;
      expect(seen.pageHeight, size).toBe(seen.windowHeight);
      expect(seen.pageScrolledBy, size).toBe(0);
      expect(seen.appBottom, size).toBe(seen.windowHeight);
    }
  });

  test('a finger dragged over the map scrolls the page; two fingers are for the map', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!openedSite(manifest), 'the manifest has no site yet');
    expect(await cooperativeGesturesOn(page)).toBe(true);

    const centreBefore = await mapCentre(page);
    const box = (await page.locator('#map').boundingBox())!;
    const [x, y] = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height * 0.55)];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 20 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(() => page.locator('.main').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await mapCentre(page)).toEqual(centreBefore);
  });

  test('the date stepper works with a tap', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!(await showPerDateLayer(page, manifest)), 'no per-date layer with two or more dates');
    const date = page.getByTestId('current-date');
    const before = await date.innerText();
    const previous = page.getByRole('button', { name: 'Previous date' });
    const atFirst = (await previous.getAttribute('aria-disabled')) === 'true';
    await (atFirst ? page.getByRole('button', { name: 'Next date' }) : previous).tap();
    await expect(date).not.toHaveText(before);
  });

  test('the About text opens at its title, with Close in reach', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'About' }).tap();
    const dialog = page.getByRole('dialog', { name: 'About' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'About', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toBeHidden();
  });
});

test.describe('with the keyboard alone', () => {
  /** A short name for the focused element, and whether it shows a focus ring. */
  const focused = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const labels = (el as HTMLInputElement).labels;
      const name = (el.getAttribute('aria-label') ?? labels?.[0]?.textContent ?? el.textContent ?? '').trim();
      const style = getComputedStyle(el);
      // A solid outline at least 2 px wide; the map's ring is drawn by #map::after instead
      // (styles.css), because the map's box clips an outline drawn round the canvas.
      const ring = el.matches('.maplibregl-canvas')
        ? getComputedStyle(document.getElementById('map')!, '::after').boxShadow !== 'none'
        : style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2;
      return { name, ring, inDialog: Boolean(el.closest('dialog')) };
    });

  test('Tab reaches every control in order, each with a visible focus ring', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!openedSite(manifest), 'the manifest has no site yet');
    const perDate = await showPerDateLayer(page, manifest);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // One full round of Tab, then read it from the first control on the page.
    const round: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const now = await focused(page);
      if (!now) continue;
      if (round.length > 0 && now.name === round[0]) break; // wrapped round
      expect(now.ring, `no focus ring on "${now.name}"`).toBe(true);
      round.push(now.name);
    }
    const start = Math.max(0, round.indexOf('About'));
    const seen = [...round.slice(start), ...round.slice(0, start)];
    const expected: (string | RegExp)[] = ['About', /^Map\./, 'Zoom in', 'Zoom out', 'Layer'];
    if (perDate) expected.push('Previous date', 'Next date', 'Play', /^Show \d{4}-\d{2}-\d{2}$/);
    expected.push(/^Layer opacity/, 'Read values at the map centre');
    let from = 0;
    for (const want of expected) {
      const at = seen.findIndex((name, i) => i >= from && (typeof want === 'string' ? name === want : want.test(name)));
      expect(at, `"${String(want)}" not reached by Tab, in order, in: ${seen.join(' | ')}`).toBeGreaterThanOrEqual(0);
      from = at + 1;
    }

    // The map, when focused, says how to read values without a mouse.
    await expect(page.locator('#map canvas')).toHaveAttribute('aria-label', /Read values at the map centre/);
  });

  test('dates change with Enter, Space and the arrow keys, and focus stays put', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!(await showPerDateLayer(page, manifest)), 'no per-date layer with two or more dates');
    const date = page.getByTestId('current-date');
    const previous = page.getByRole('button', { name: 'Previous date' });
    const next = page.getByRole('button', { name: 'Next date' });

    // Enter on "Previous" until the first date: focus must not drop to the page on arriving there.
    await previous.focus();
    for (let i = 0; i < 50 && (await previous.getAttribute('aria-disabled')) !== 'true'; i++) {
      const before = await date.innerText();
      await page.keyboard.press('Enter');
      await expect(date).not.toHaveText(before);
    }
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await expect(previous).toBeFocused();
    // It looks unavailable, but not through opacity, which would fade its focus ring as well.
    expect(await previous.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    const first = await date.innerText();
    await page.keyboard.press('Enter'); // nothing before the first date
    await expect(date).toHaveText(first);

    await next.focus();
    await page.keyboard.press('Space');
    await expect(date).not.toHaveText(first);

    // Timeline marks: Enter and Space pick their date.
    const ticks = page.locator('.timeline button.tick');
    await ticks.first().focus();
    await page.keyboard.press('Enter');
    await expect(date).toHaveText(first);
    const lastLabel = (await ticks.last().getAttribute('aria-label'))!;
    await ticks.last().focus();
    await page.keyboard.press('Space');
    await expect(date).toHaveText(lastLabel.replace(/^Show /, ''));

    // Arrow keys step from anywhere that does not use them itself.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowLeft');
    await expect(date).not.toHaveText(lastLabel.replace(/^Show /, ''));
  });

  test('values at the map centre can be read without a mouse', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!openedSite(manifest), 'the manifest has no site yet');
    await page.getByRole('button', { name: 'Read values at the map centre' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('inspect')).toContainText('Longitude');
    await expect(page.getByTestId('inspect')).not.toContainText('Reading values');
    // A value was read: the coordinates line alone also shows when reading fails.
    await expect(page.getByTestId('inspect-value')).toHaveText(VALUE_TEXT);
    await expect(page.getByTestId('inspect').locator('.error')).toHaveCount(0);
  });

  test('the About dialog takes focus, keeps it, closes with Escape and gives it back', async ({ page }) => {
    await openApp(page);
    const about = page.getByRole('button', { name: 'About' });
    await about.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'About' });
    await expect(dialog).toBeVisible();
    expect((await focused(page))?.inDialog).toBe(true);
    // Tab cycles through the dialog (and the browser's own toolbar), never the page behind it.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const now = await focused(page);
      expect(now === null || now.inDialog, `focus left the dialog for "${now?.name}"`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(about).toBeFocused();
  });
});

test.describe('in a contrast theme (forced colours)', () => {
  test.use({ forcedColors: 'active' });

  test('the map still shows that it has keyboard focus', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!openedSite(manifest), 'the manifest has no site yet');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const onMap = () => page.evaluate(() => Boolean(document.activeElement?.matches('.maplibregl-canvas:focus-visible')));
    for (let i = 0; i < 10 && !(await onMap()); i++) await page.keyboard.press('Tab');
    expect(await onMap()).toBe(true);
    // Forced colours remove box shadows; the ring is then the outline, which they give a system colour.
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('map')!, '::after');
      return { shadow: style.boxShadow, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), colour: style.outlineColor };
    });
    expect(ring.shadow).toBe('none'); // forced colours are in effect
    expect(ring).toMatchObject({ outline: 'solid' });
    expect(ring.width).toBeGreaterThanOrEqual(2);
    expect(ring.colour).not.toMatch(/^(transparent|rgba\(.*, 0\))$/);
  });

  // Moved here from the first guided tour's tests (pull request 4), whose Back and Next it also
  // covered: the rule in styles.css draws a button marked aria-disabled in GrayText.
  test('an unavailable date step looks unavailable, not like an available one', async ({ page }) => {
    const manifest = await openApp(page);
    test.skip(!(await showPerDateLayer(page, manifest)), 'no per-date layer with two or more dates');
    const look = (name: string) =>
      page.getByRole('button', { name }).evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, border: s.borderTopColor };
      });
    // The app opens on the layer's latest date: Next date is unavailable there, Previous date is not.
    await expect(page.getByRole('button', { name: 'Next date' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Previous date' })).toHaveAttribute('aria-disabled', 'false');
    const [unavailable, available] = [await look('Next date'), await look('Previous date')];
    expect(unavailable.color).not.toBe(available.color);
    expect(unavailable.border).not.toBe(available.border);
  });
});

test.describe('with a mouse on a desktop', () => {
  test('the wheel zooms the map with no modifier key', async ({ page }) => {
    await openApp(page);
    expect(await cooperativeGesturesOn(page)).toBe(false);
    const before = await mapZoom(page);
    const box = (await page.locator('#map').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => mapZoom(page)).toBeGreaterThan(before + 0.1);
  });

  test("MapLibre's zoom buttons keep their square shape", async ({ page }) => {
    await openApp(page);
    const box = (await page.getByRole('button', { name: 'Zoom in' }).boundingBox())!;
    expect(box.height).toBeCloseTo(box.width, 0);
  });

  test('without a reduced-motion preference the zoom button glides (the control for the test below)', async ({ page }) => {
    await openApp(page);
    expect((await zoomInNow(page)).moving).toBe(true);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the map jumps instead of gliding, and nothing on the page animates', async ({ page }) => {
    await openApp(page);
    // Zoom in and read the map in the same moment: with motion reduced it is already there.
    const zoom = await zoomInNow(page);
    expect(zoom.moving).toBe(false);
    expect(zoom.after).toBeCloseTo(zoom.before + 1, 5);

    // Put a marker on the map (MapLibre fades markers in) and check no element has a running time.
    await page.getByRole('button', { name: 'Read values at the map centre' }).click();
    await expect(page.locator('.maplibregl-marker')).toHaveCount(1);
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((el) => {
          const style = getComputedStyle(el);
          const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
          return nonZero(style.transitionDuration) || nonZero(style.animationDuration);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );
    expect(moving).toEqual([]);
  });
});
