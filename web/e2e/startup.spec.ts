// What the app opens with: the project's name, and the first site built from real observations.
// The fixture sites are all samples, so the tests below mark one as real in a copy of the manifest
// served through page.route; that copy lives only in the test's browser and is never written anywhere.
// The links below carry story=off: the bare address opens the guided story's cover on a site that has
// one (e2e/story.spec.ts), and these tests are about the map; story=off names no site, so the app still
// chooses the site by its own rule.

import type { Page } from '@playwright/test';
import { BRANDING } from '../src/branding';
import { buildManifest, YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { expect, test } from './support';

const sites = buildManifest().sites;

/** For this page only, serves the manifest with the site `id` marked as real (not a sample). */
async function markReal(page: Page, id: string): Promise<void> {
  await page.route('**/manifest.json', async (route) => {
    const response = await route.fetch();
    const manifest = (await response.json()) as { sites: { id: string; is_sample?: boolean; notice?: string }[] };
    for (const site of manifest.sites) {
      if (site.id !== id) continue;
      site.is_sample = false;
      delete site.notice;
    }
    await route.fulfill({ response, json: manifest });
  });
}

const siteTitle = (page: Page) => page.locator('#site-title');
const urlSite = (page: Page) => new URL(page.url()).searchParams.get('site');

test.describe('the site the app opens', () => {
  // A real site listed after the samples: the second and the last.
  for (const real of [sites[1]!, sites[sites.length - 1]!]) {
    test(`with no site in the link, the first site that is not a sample (${real.id})`, async ({ page }) => {
      expect(sites.findIndex((s) => s.id === real.id)).toBeGreaterThan(0);
      await markReal(page, real.id);
      await page.goto('./?story=off');
      await expect(siteTitle(page)).toHaveText(real.title);
      await expect(page.getByTestId('sample-notice')).toHaveCount(0);
      await expect.poll(() => urlSite(page)).toBe(real.id);
    });
  }

  test('with a site the manifest does not have, the first site that is not a sample', async ({ page }) => {
    const real = sites[1]!;
    await markReal(page, real.id);
    await page.goto('./?site=no-such-site');
    await expect(siteTitle(page)).toHaveText(real.title);
    await expect.poll(() => urlSite(page)).toBe(real.id);
  });

  test('a site the link names opens even when it is a sample', async ({ page }) => {
    await markReal(page, sites[1]!.id);
    await page.goto(`./?site=${YEAR_SITE_ID}`);
    await expect(siteTitle(page)).toHaveText(sites[0]!.title);
    await expect(page.getByTestId('sample-notice')).toBeVisible();
  });

  test('when every site is a sample, the first site, with its notice', async ({ page }) => {
    expect(sites.every((s) => s.is_sample)).toBe(true);
    await page.goto('./?story=off');
    await expect(siteTitle(page)).toHaveText(sites[0]!.title);
    await expect(page.getByTestId('sample-notice')).toBeVisible();
    await expect.poll(() => urlSite(page)).toBe(sites[0]!.id);
  });
});

test.describe('the name', () => {
  test('is the page title, the meta description and the heading, with the tagline beside it', async ({ page }) => {
    await page.goto('./?story=off');
    await expect(page).toHaveTitle(BRANDING.name);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', BRANDING.tagline);
    const header = page.locator('header');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(BRANDING.name);
    await expect(header).toContainText(BRANDING.tagline);
    await expect(page.locator('body')).not.toContainText(/working title/i);
    // The tagline is smaller than the name.
    const sizes = await header.evaluate((el) => ({
      name: parseFloat(getComputedStyle(el.querySelector('h1')!).fontSize),
      tagline: parseFloat(getComputedStyle(el.querySelector('.tagline')!).fontSize),
    }));
    expect(sizes.tagline).toBeLessThan(sizes.name);
  });

  test('the About text no longer calls the name a working title', async ({ page }) => {
    await page.goto('./?story=off');
    await page.getByRole('button', { name: 'About' }).click();
    const dialog = page.getByRole('dialog', { name: 'About' });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(/working title|no name yet/i);
  });
});
