#!/usr/bin/env node
// Look at a page of the app the way a visitor would: a fresh Chrome profile (the same as a private window),
// wait for the map, click it, step back through the dates, take screenshots, and report what was seen.
// Use it after every push, because the Actions runs of a private repository cannot be read without a login:
//
//   node scripts/live-check.mjs                         the public site
//   node scripts/live-check.mjs <url> [screenshot.png]  any page, for example http://localhost:5173/?site=<id>
//
// Two checks, in one fresh profile:
// 1. The tool: the page at <url> with story=off added (the bare address opens the guided story's cover
//    when the site has a story; story=off is the map exactly as before): wait for the map, click it,
//    step back through the dates.
// 2. The story: the bare address (<url> without its query, keeping a development ?manifest=). It
//    passes either way, and the JSON says which it saw ("story.seen"): "cover" when the page opened
//    the guided story (then "Explore the map" must close it and leave a map that reads a value on a
//    click), "none" when the site has no story yet (the bare address then shows the map).
//
// Prints one JSON object. Exits 1 when a page logged an error, a request failed, a click on the map
// returned no value, or the story did not hand over a working map. Needs the web dependencies
// (npm run setup) and Google Chrome.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] ?? 'https://runny24.github.io/NASA-space-apps-2026/';
const shot = path.resolve(process.argv[3] ?? path.join(repo, 'work', 'live-check.png'));
mkdirSync(path.dirname(shot), { recursive: true });

/** `url` with story=off added: the map, never the story. */
const toolUrl = (() => {
  const u = new URL(url);
  u.searchParams.set('story', 'off');
  return u.href;
})();
/** The bare address of `url`: no query, except a development ?manifest=. */
const bareUrl = (() => {
  const u = new URL(url);
  const manifest = u.searchParams.get('manifest');
  u.search = '';
  if (manifest) u.searchParams.set('manifest', manifest);
  return u.href;
})();

const require = createRequire(path.join(repo, 'web', 'package.json'));
const { chromium } = require('@playwright/test');

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
const failed = [];
const rasterStatuses = {};

/** A page whose errors, failed requests and raster answers are recorded. */
async function watchedPage() {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));
  // A request the page itself cancels (the map leaving a view while tiles load) is not a failure of the site.
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(why)) failed.push(`${r.url().slice(-80)} (${why})`);
  });
  page.on('response', (r) => {
    if (r.url().endsWith('.tif')) rasterStatuses[r.url().split('/').slice(-2).join('/')] = r.status();
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(-80)}`);
  });
  return page;
}

/** Waits until the map has framed a site: the scale bar then no longer shows a world view. */
const waitForFramedMap = (page) =>
  page.waitForFunction(
    () => {
      const s = document.querySelector('.maplibregl-ctrl-scale');
      return s && !/000 km/.test(s.textContent || '');
    },
    null,
    { timeout: 30000 },
  );

/** Clicks the middle of the map and returns whether "At a point" shows a value. */
async function clickReadsValue(page) {
  const box = await page.locator('canvas.maplibregl-canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  return page
    .waitForFunction(() => /Value \(/.test(document.querySelector('[aria-label="Controls and readouts"]')?.innerText ?? ''), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}

// --- 1. The tool, at story=off -------------------------------------------------------------------
const page = await watchedPage();
const t0 = Date.now();
await page.goto(toolUrl, { waitUntil: 'load' });
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 20000 });
await waitForFramedMap(page);
// A dev server keeps a connection open, so "network idle" may never come there: do not wait long for it.
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
const firstViewMs = Date.now() - t0;

await clickReadsValue(page);
await page.waitForTimeout(800);
await page.screenshot({ path: shot });

const info = await page.evaluate(() => {
  const side = document.querySelector('[aria-label="Controls and readouts"]');
  const text = side ? side.innerText : '';
  const i = text.indexOf('At a point');
  const heading = side ? side.querySelector('h2') : null;
  return {
    href: location.href,
    title: document.title,
    heading: heading ? heading.textContent : null,
    choices: [...document.querySelectorAll('select')].flatMap((s) => [...s.options].map((o) => o.textContent)).slice(0, 12),
    notice: !!document.querySelector('[role="note"]'),
    scale: (document.querySelector('.maplibregl-ctrl-scale') || {}).textContent,
    inspect: i >= 0 ? text.slice(i, i + 330) : '',
  };
});

// Step back through the dates and report what the stepper and the history table show.
const stepped = [];
for (let i = 0; i < 4; i += 1) {
  const prev = page.locator('button[aria-label="Previous date"]');
  if ((await prev.count()) === 0 || (await prev.getAttribute('aria-disabled')) === 'true') break;
  await prev.click();
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  stepped.push(new URL(page.url()).searchParams.get('date'));
}
if (stepped.length > 0) await page.screenshot({ path: shot.replace(/\.png$/, '_stepped.png') });
const history = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[aria-label="Controls and readouts"] table tr')].map((r) =>
    r.innerText.replace(/\s+/g, ' ').trim(),
  );
  return { rows: rows.length, first: rows.slice(0, 3), last: rows.slice(-2) };
});
const gotValue = /Value \(/.test(info.inspect);
await page.close();

// --- 2. The story, at the bare address ---------------------------------------------------------
// The page opens the story ('cover' on the bare address) or, when the site has no story, the map.
const storyPage = await watchedPage();
const story = { url: bareUrl, seen: null, title: null, closed: null, mapAfter: null, ok: false };
await storyPage.goto(bareUrl, { waitUntil: 'load' });
story.seen = await storyPage
  .waitForFunction(
    () => {
      const app = document.querySelector('.app');
      if (app?.getAttribute('data-story') === 'open') return 'cover';
      if (app && !app.hasAttribute('data-story') && document.querySelector('#site-title')) return 'none';
      return false;
    },
    null,
    { timeout: 30000 },
  )
  .then((handle) => handle.jsonValue())
  .catch(() => 'neither');
if (story.seen === 'cover') {
  story.title = await storyPage.locator('[data-testid="story-title"]').first().textContent();
  await storyPage.screenshot({ path: shot.replace(/\.png$/, '_story.png') });
  // On a desktop the cover carries "Explore the map"; on a step it is at the top of the panel.
  await storyPage.locator('[data-testid="story-exit"]').first().click();
  story.closed = await storyPage
    .waitForSelector('.app:not([data-story]) #site-title', { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (story.closed) {
    await waitForFramedMap(storyPage).catch(() => {});
    story.mapAfter = { readsValue: await clickReadsValue(storyPage), href: storyPage.url() };
  }
  story.ok = story.closed === true && story.mapAfter?.readsValue === true;
} else if (story.seen === 'none') {
  // No story yet: the bare address shows the map, which check 1 has looked at in full.
  story.ok = await storyPage
    .waitForSelector('canvas.maplibregl-canvas', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}
await storyPage.close();

console.log(
  JSON.stringify({ firstViewMs, ...info, stepped, history, story, rasterStatuses, consoleErrors, failed, screenshot: shot }, null, 1),
);
await browser.close();
process.exit(consoleErrors.length === 0 && failed.length === 0 && gotValue && story.ok ? 0 : 1);
