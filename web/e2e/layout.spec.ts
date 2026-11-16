// The frame of the page, on the SYNTHETIC fixtures: the header (and the sample notice under it) stays
// put, and only the column of panels scrolls. Ids come from tests/fixtures/synthetic.mjs.

import type { Page } from '@playwright/test';
import { YEAR_LAYERS, YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { expect, openAt, test } from './support';

/** How far the page itself can scroll, down and across (0 and 0: it cannot). */
const pageScroll = (page: Page) =>
  page.evaluate(() => ({
    down: document.documentElement.scrollHeight - window.innerHeight,
    across: document.documentElement.scrollWidth - window.innerWidth,
  }));

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('the page itself does not scroll, only the column under the header', async ({ page }) => {
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}`);
    // The playback status line is read by screen readers and not shown (.visually-hidden, which is
    // absolutely positioned). It sits far down the column, below the window: if nothing in the
    // column holds it, it hangs off the page instead, and the page scrolls under the header into
    // blank space (seen at this width before .side was positioned).
    const status = page.getByTestId('playback-status');
    await expect(status).toBeAttached();
    const below = await status.evaluate((el) => el.getBoundingClientRect().top - window.innerHeight);
    expect(below, 'the status line is below the window, so the check below can fail').toBeGreaterThan(0);
    expect(await pageScroll(page)).toEqual({ down: 0, across: 0 });

    // Scrolled to its end, the column still holds everything: the header has not moved.
    await page.locator('.main').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await pageScroll(page)).toEqual({ down: 0, across: 0 });
    expect(await page.locator('header').evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  });
});

test.describe('in a desktop window', () => {
  test('the page itself does not scroll, only the side column', async ({ page }) => {
    await openAt(page, `?site=${YEAR_SITE_ID}&layer=${YEAR_LAYERS.hh}`);
    expect(await pageScroll(page)).toEqual({ down: 0, across: 0 });
    await page.locator('.side').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await pageScroll(page)).toEqual({ down: 0, across: 0 });
    // The map fills what the header, the notice and the side column leave.
    const { map, side, width } = await page.evaluate(() => ({
      map: document.getElementById('map')!.getBoundingClientRect().width,
      side: document.querySelector('.side')!.getBoundingClientRect().width,
      width: window.innerWidth,
    }));
    expect(map + side).toBeCloseTo(width, 0);
    expect(map).toBeGreaterThan(side);
  });
});
