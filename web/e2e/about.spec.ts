// The About panel (components/AboutDialog.tsx), opened from the tool on the SYNTHETIC year site: its
// title takes the focus, the challenge's three questions and the method are closed folds that open
// with the keyboard, the limits stay in view, no block is marked as unchecked (checked by a teammate),
// nothing speaks of a sample site, and the AI paragraph names no person and says nothing of the
// concept. On a phone the folds are 44 px rows and Close stays in reach. The panel's text is the
// same on every site; the words are read from the component's own constants.

import type { Page } from '@playwright/test';
import { CHALLENGE_QUESTIONS, METHOD_FOLD_SUMMARY } from '../src/components/AboutDialog';
import { YEAR_SITE_ID } from '../tests/fixtures/synthetic.mjs';
import { expect, openAt, test } from './support';

const BLOCKS = ['what', 'question-1', 'question-2', 'question-3', 'method', 'limits', 'credits', 'ai'];

/** Opens the tool on the year site, then the About panel; returns the dialog. */
async function openAbout(page: Page) {
  await openAt(page, `?site=${YEAR_SITE_ID}&story=off`);
  // Closed, the panel puts none of its words in the page.
  await expect(page.locator('dialog.about')).toBeEmpty();
  await page.getByRole('button', { name: 'About' }).click();
  const dialog = page.getByRole('dialog', { name: 'About' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the title takes the focus, and the three questions and the method are closed folds that open and close with the keyboard', async ({ page }) => {
  const dialog = await openAbout(page);
  await expect(dialog.getByRole('heading', { name: 'About', exact: true })).toBeFocused();

  const summaries = dialog.locator('details > summary');
  await expect(summaries).toHaveText([...CHALLENGE_QUESTIONS, METHOD_FOLD_SUMMARY]);
  for (const details of await dialog.locator('details').all()) await expect(details).not.toHaveAttribute('open');

  // Tab from the title goes through the folds in order, then the link and Close.
  for (const [i, text] of [...CHALLENGE_QUESTIONS, METHOD_FOLD_SUMMARY].entries()) {
    await page.keyboard.press('Tab');
    const summary = summaries.nth(i);
    await expect(summary).toBeFocused();
    await expect(summary).toHaveText(text);
    const block = dialog.locator('details').nth(i).locator('.about-block');
    await expect(block).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(block).toBeVisible();
    await page.keyboard.press('Space');
    await expect(block).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(block).toBeVisible();
  }
  await expect(dialog.locator('details:not([open])')).toHaveCount(0);
  await expect(dialog.locator('[data-block="method"] ol > li')).toHaveCount(5);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  // Closing gives the focus back to the button and takes the words out of the page again.
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'About' })).toBeFocused();
  await expect(page.locator('dialog.about')).toBeEmpty();
  await expect(page.getByText('Draft, not yet checked by the team')).toHaveCount(0);
});

test('the limits are in view, no block is marked as unchecked (a teammate checked the text), and nothing mentions a sample', async ({ page }) => {
  const dialog = await openAbout(page);

  // The limits: a heading and a list, never inside a fold, visible without opening anything.
  const limits = dialog.locator('[data-block="limits"]');
  await expect(dialog.getByRole('heading', { name: 'Limits', level: 3 })).toBeVisible();
  await expect(dialog.locator('details [data-block="limits"]')).toHaveCount(0);
  const items = limits.locator('li');
  expect(await items.count()).toBeGreaterThanOrEqual(9);
  for (const item of await items.all()) await expect(item).toBeVisible();

  // Every block is there; none carries a mark of unchecked text, or any word of one.
  await expect(dialog.locator('[data-block]')).toHaveCount(BLOCKS.length);
  await expect(dialog.locator('.about-draft')).toHaveCount(0);
  await expect(dialog).not.toContainText(/draft|not yet checked/i);

  await expect(dialog).not.toContainText(/sample/i);
  await expect(dialog).toContainText('This project is not affiliated with or endorsed by NASA.');
  // No logo or insignia: the panel holds no picture at all.
  await expect(dialog.locator('img, svg, picture, canvas')).toHaveCount(0);
});

test('the AI paragraph names no person and says nothing of the concept or the idea', async ({ page }) => {
  const dialog = await openAbout(page);
  const ai = dialog.locator('[data-block="ai"] > p');
  await expect(ai).toHaveCount(1);
  const text = (await ai.innerText()).replace(/\s+/g, ' ').trim();
  expect(text).toMatch(/^We used Claude \(Anthropic\) in Claude Code/);
  expect(text).toMatch(/AI_USE\.md in the project's repository is the running record\.$/);
  expect(text).not.toMatch(/concept|idea|propos|suggest|chose|asked|TO FILL/i);
  const allowed = new Set(['We', 'Claude', 'Anthropic', 'Code', 'Fable', 'Opus', 'NISAR', 'No', 'AI-generated', 'AI_USE.md']);
  const capitalised = text
    .split(' ')
    .map((w) => w.replace(/^[(“"]+/, '').replace(/[),;:.”"]+$/, ''))
    .filter((w) => /^[A-Z]/.test(w));
  for (const w of capitalised) expect(allowed.has(w), w).toBe(true);
});

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('each fold is a 44 px row; with every fold open and the text scrolled to its end, Close is in reach and nothing sticks out sideways', async ({ page }) => {
    const dialog = await openAbout(page);
    await expect(dialog.getByRole('heading', { name: 'About', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport();
    const summaries = dialog.locator('details > summary');
    for (const s of await summaries.all()) {
      expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await s.tap();
    }
    await expect(dialog.locator('details:not([open])')).toHaveCount(0);
    await dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(dialog.getByRole('link')).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport();
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toBeHidden();
  });
});
