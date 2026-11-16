// Texts as long as the real ones, for the browser tests that check the layout with them. The real
// overlay and the real bars come from the pipeline's fire stage (pipeline/fires.py), whose texts are
// far longer than the fixture's. serveRealLengthTexts() serves the fixture's manifest.json and the
// year site's stats.json with texts of those lengths, by page.route. Every text it writes says
// SYNTHETIC and none copies the real wording: a fixture never passes for real data.

import type { Page } from '@playwright/test';
import type { BarsEntry, Stats } from '../src/contract/stats';
import { BARS_ID, OVERLAY_ID, YEAR_SITE_ID, buildYearStats } from '../tests/fixtures/synthetic.mjs';

/**
 * The lengths, in characters, of the real texts, from pipeline/fires.py as it stood on 15 November 2026
 * (measured by calling its functions with three FIRMS sources):
 * - the overlay (overlay_entry): its default title 35, its description 346 (DESCRIPTION, 310, after a
 *   36-character prefix that pipeline/stages.py then added), its method 467 (with a count of points
 *   left out), CREDIT 336;
 * - the bars (period_bar): three entries in stats.json, one per period; a title of 90 ("... per km2 in
 *   each harvest-map class, 12 to 23 October 2026 (UTC dates)"), a method of 1,153, a region of 375 to
 *   470 (with the sentences on the area left out and on a period fetched only in part), and a note of
 *   about 49 on every category ("12.34 detections attributed, class area 45.67 km2").
 * The site's own credit (`source.citation`) is not from fires.py: tarn-taran's is 97 characters
 * (web/public/data/tarn-taran/site.json).
 * The data side is adding the FIRMS credit to the bars (review finding bars-firms-credit-missing):
 * each title will name NASA FIRMS and each method end with the 336-character credit, so the bars'
 * title is taken here as about 110 and their method as about 1,600, and the method served ends with
 * a credit with a long unbreakable token, as the real credit has addresses in brackets.
 * The texts served here are at least this long.
 */
export const REAL_TEXT_LENGTHS = {
  overlayTitle: 35,
  overlayDescription: 346,
  overlayMethod: 467,
  overlayCredit: 336,
  barsEntries: 3,
  barsTitle: 110,
  barsMethod: 1600,
  barsRegion: 470,
  barsNote: 49,
  siteCitation: 97,
} as const;

/** `lead`, then numbered SYNTHETIC filler sentences until it is at least `min` characters long. */
export function lengthen(lead: string, min: number): string {
  let text = lead;
  for (let i = 1; text.length < min; i++) text += ` SYNTHETIC filler sentence ${i}, which makes this made-up text as long as the real one.`;
  return text;
}

/** `text`, after checking that it is at least `min` characters long and says SYNTHETIC. */
function atLeast(text: string, min: number): string {
  if (text.length < min) throw new Error(`"${text}" has ${text.length} characters, fewer than the real ${min}`);
  if (!text.includes('SYNTHETIC')) throw new Error(`"${text}" does not say SYNTHETIC`);
  return text;
}

export interface RealLengthTexts {
  citation: string;
  overlay: { title: string; description: string; method: string; credit: string };
  /** The year site's stats.json: the fixture's series, and three long bars entries. */
  stats: Stats;
  bars: BarsEntry[];
}

/** The texts, built once per call from the fixture (deterministic: the same on every call). */
export function realLengthTexts(): RealLengthTexts {
  const L = REAL_TEXT_LENGTHS;
  const overlay = {
    title: atLeast('SYNTHETIC made-up points (a title of real length)', L.overlayTitle),
    description: atLeast(lengthen('SYNTHETIC: each circle is a made-up point, placed by a formula for the app tests.', L.overlayDescription), L.overlayDescription),
    method: atLeast(lengthen('SYNTHETIC: placed by a seeded formula in (web/tests/fixtures/synthetic.mjs), with made-up dates.', L.overlayMethod), L.overlayMethod),
    // A long unbreakable token, as the real credit has addresses in brackets.
    credit: atLeast(lengthen('Made-up SYNTHETIC points (web/tests/fixtures/synthetic.mjs), credited at real length for the layout tests.', L.overlayCredit), L.overlayCredit),
  };
  // At least as wide on one line as the real credit, not only as long, and not much wider: at
  // 667 x 375 the credit line is capped to one row of 611 px, which the real credit fits in DejaVu
  // Sans (Ubuntu's default sans-serif, so almost certainly the app's system-ui on CI) with 17 px to
  // spare. Hence about as many capitals as the real credit has (26 against 29): DejaVu Sans is far
  // wider than Arial in lower case and no wider in capitals, so a text in lower case that fits the
  // row in DejaVu Sans is narrower than the real credit in Arial. Measured in the credit line at
  // 12 px in Chrome (DejaVu Sans served from its TTF), the real credit / this text: Segoe UI 522.5 /
  // 527.5 px, Arial (Liberation Sans has its metrics) 546.2 / 552.2, DejaVu Sans 593.8 / 597.1. The
  // texts before: 97 characters, 515.1 / 520.2 / 592.0, narrower than the real credit in all three;
  // 108 characters, 570.4 / 576.2 / 656.0, which wrapped in DejaVu Sans. real-lengths.spec.ts checks
  // the widths in the font the browser has.
  const citation = atLeast('SYNTHETIC JUNK data - made up by a JS formula for the tests - NOT a real credit at all, JUST a TEST.', L.siteCitation);

  const stats = buildYearStats() as Stats;
  const base = stats.bars!.find((b) => b.id === BARS_ID)!;
  const periods = ['15 to 26 September 2026', '27 September to 8 October 2026', '9 to 20 October 2026'];
  // The method ends with a credit, as the real one will.
  const methodCredit = 'SYNTHETIC credit: made-up points (web/tests/fixtures/synthetic.mjs), credited at the end of the method as the real credit will be.';
  const bars: BarsEntry[] = periods.map((period, k) => ({
    ...base,
    id: `${BARS_ID}-long-${k + 1}`,
    title: atLeast(`SYNTHETIC made-up points (from a made-up source) per km2 in each made-up class of the test map, ${period} (made-up dates)`, L.barsTitle),
    method: atLeast(
      `${lengthen(`SYNTHETIC method of entry ${k + 1}: made-up points in each class divided by the made-up class area.`, L.barsMethod - methodCredit.length - 1)} ${methodCredit}`,
      L.barsMethod,
    ),
    region: atLeast(lengthen(`SYNTHETIC region of entry ${k + 1}: the whole made-up box, ${period}.`, L.barsRegion), L.barsRegion),
    categories: base.categories.map((c, i) => ({
      ...c,
      note: atLeast(c.note ? lengthen(c.note, L.barsNote) : `SYNTHETIC note: ${i + 1}.25 made-up points, made-up class area ${i + 4}.5 km2`, L.barsNote),
    })) as BarsEntry['categories'],
  }));
  stats.bars = bars;
  return { citation, overlay, stats, bars };
}

/**
 * Serves the fixture's manifest.json with the year site's overlay texts and citation at real length,
 * and its stats.json with three bars entries at real length. Call before opening the page.
 */
export async function serveRealLengthTexts(page: Page): Promise<RealLengthTexts> {
  const texts = realLengthTexts();
  await page.route('**/manifest.json', async (route) => {
    const manifest = await (await route.fetch()).json();
    const year = manifest.sites.find((s: { id: string }) => s.id === YEAR_SITE_ID);
    Object.assign(year.overlays.find((o: { id: string }) => o.id === OVERLAY_ID), texts.overlay);
    year.source.citation = texts.citation;
    await route.fulfill({ json: manifest });
  });
  await page.route(`**/${YEAR_SITE_ID}/stats.json`, (route) => route.fulfill({ json: texts.stats }));
  return texts;
}
