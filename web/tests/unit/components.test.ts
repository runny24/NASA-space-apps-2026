// Server-side renders of components whose text is part of a fix: no browser needed.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AboutDialog, CHALLENGE_QUESTIONS, METHOD_FOLD_SUMMARY, REPOSITORY_URL } from '../../src/components/AboutDialog';
import { DateStepper, MISSING_REASONS_SUMMARY, missingCountText, STATIC_LAYER_NOTE, StaticLayerNote } from '../../src/components/Controls';
import { CrashMessage, ErrorBoundary } from '../../src/components/ErrorBoundary';
import { InspectPanel } from '../../src/components/InspectPanel';
import { Legend, LEGEND_METHOD_SUMMARY } from '../../src/components/Legend';
import { PictureLoading, PictureShown, pictureLoadingNote, pictureShownText } from '../../src/components/PictureLoading';
import type { Layer, Overlay } from '../../src/contract/manifest';
import type { Stats } from '../../src/contract/stats';
import {
  MIXED_RELEASE_WARNING,
  SERIES_METHOD_LABEL,
  SERIES_METHOD_SUMMARY,
  SERIES_REGION_LABEL,
  StatsBody,
  StatsPanel,
} from '../../src/components/StatsPanel';
import { OVERLAY_NOT_NISAR } from '../../src/state/overlayPeriod';
import { overlayView } from '../../src/state/overlayView';
import { buildTimeline } from '../../src/state/timeline';

describe('DateStepper', () => {
  const entries = buildTimeline(
    { dates: [{ date: '2026-06-19' }, { date: '2026-07-01' }], missing_passes: [] } as unknown as Parameters<typeof buildTimeline>[0],
    { items: [{ url: 'a.tif', date: '2026-06-19' }, { url: 'b.tif', date: '2026-07-01' }] },
  );
  const render = (itemIndex: number) => renderToStaticMarkup(createElement(DateStepper, { entries, itemIndex, onChange: () => undefined }));

  it('marks the end of the dates with aria-disabled, so keyboard focus stays on the button', () => {
    // A `disabled` button drops focus to the page when Enter takes the person to the last date.
    const atLatest = render(1);
    expect(atLatest).not.toMatch(/<button[^>]*disabled=""/);
    expect(atLatest).toMatch(/<button[^>]*aria-disabled="true"[^>]*aria-label="Next date"/);
    expect(atLatest).toMatch(/<button[^>]*aria-disabled="false"[^>]*aria-label="Previous date"/);
    expect(render(0)).toMatch(/<button[^>]*aria-disabled="true"[^>]*aria-label="Previous date"/);
  });

  it('makes every acquisition on the timeline a button that names its date', () => {
    const html = render(0);
    expect(html).toContain('aria-label="Show 2026-06-19"');
    expect(html).toContain('aria-label="Show 2026-07-01"');
  });

  it('gives each mark its distance to the marks either side, where its tap pad stops (styles.css)', () => {
    // 48 days with a missing pass halfway: marks at 0, 0.25, (0.5 missing) and 1 of the axis.
    const crowded = buildTimeline(
      {
        dates: [{ date: '2026-01-01' }, { date: '2026-01-13' }, { date: '2026-02-18' }],
        missing_passes: [{ date: '2026-01-25', reason: 'test' }],
      } as unknown as Parameters<typeof buildTimeline>[0],
      { items: ['2026-01-01', '2026-01-13', '2026-02-18'].map((date) => ({ url: `${date}.tif`, date })) },
    );
    const html = renderToStaticMarkup(createElement(DateStepper, { entries: crowded, itemIndex: 0, onChange: () => undefined }));
    // No neighbour counts as a whole axis away; the missing pass is a neighbour (a tap nearest to it picks nothing).
    expect(html).toMatch(/style="left:0%;--gap-before:1;--gap-after:0.25" aria-label="Show 2026-01-01"/);
    expect(html).toMatch(/style="left:25%;--gap-before:0.25;--gap-after:0.25" aria-label="Show 2026-01-13"/);
    expect(html).toMatch(/style="left:100%;--gap-before:0.5;--gap-after:1" aria-label="Show 2026-02-18"/);
  });
});

describe('DateStepper play button', () => {
  const entries = buildTimeline(
    { dates: [{ date: '2026-06-19' }, { date: '2026-07-01' }], missing_passes: [] } as unknown as Parameters<typeof buildTimeline>[0],
    { items: [{ url: 'a.tif', date: '2026-06-19' }, { url: 'b.tif', date: '2026-07-01' }] },
  );
  const render = (playing: boolean, announcement = '', list = entries) =>
    renderToStaticMarkup(
      createElement(DateStepper, { entries: list, itemIndex: 0, onChange: () => undefined, play: { playing, onToggle: () => undefined, announcement } }),
    );

  it('is named Play while stopped and Pause while playing, without aria-pressed', () => {
    expect(render(false)).toMatch(/<button[^>]*class="play"[^>]*>.*?Play<\/button>/);
    expect(render(true)).toMatch(/<button[^>]*class="play"[^>]*>.*?Pause<\/button>/);
    expect(render(true)).not.toMatch(/class="play"[^>]*aria-pressed/);
  });

  it('keeps the date quiet for screen readers while playing, and announces the stop', () => {
    expect(render(false)).toContain('aria-live="polite" data-testid="current-date"');
    expect(render(true)).toContain('aria-live="off" data-testid="current-date"');
    expect(render(false, 'Paused on 2026-06-19.')).toMatch(/role="status" data-testid="playback-status">Paused on 2026-06-19.</);
  });

  it('is not there when the layer has fewer than two dates to show', () => {
    const one = buildTimeline(
      { dates: [{ date: '2026-06-19' }], missing_passes: [] } as unknown as Parameters<typeof buildTimeline>[0],
      { items: [{ url: 'a.tif', date: '2026-06-19' }] },
    );
    expect(render(false, '', one)).not.toContain('class="play"');
  });
});

describe('static layer', () => {
  it('says why there are no dates, without claiming a period', () => {
    const html = renderToStaticMarkup(createElement(StaticLayerNote));
    expect(html).toContain(STATIC_LAYER_NOTE);
    expect(STATIC_LAYER_NOTE).not.toMatch(/\d{4}/);
  });

  it('lists every class of a categorical layer as a list, with its colour and label from the manifest', () => {
    const classes = [
      { value: 1, label: 'First class', color: '#0072b2' },
      { value: 2, label: 'Second class', color: '#f0e442' },
    ];
    const layer = {
      id: 'c',
      title: 'Classes',
      kind: 'static',
      unit: '',
      description: 'What the classes mean.',
      encoding: { type: 'categorical-uint8', nodata: 0, classes },
      items: [{ url: 'c.tif' }],
    } as unknown as Layer;
    const html = renderToStaticMarkup(createElement(Legend, { layer }));
    expect(html).toMatch(/<ul class="classes" role="list"/);
    for (const c of classes) expect(html).toContain(`<li><span class="swatch" style="background:${c.color}" aria-hidden="true"></span>${c.label}</li>`);
  });
});

describe('AboutDialog', () => {
  // Rendered open: a server render runs no effect, so the dialog element itself stays shut.
  const html = renderToStaticMarkup(createElement(AboutDialog, { open: true, onClose: () => undefined }));
  /** Visible words of a piece of markup (the server render escapes apostrophes and quotes). */
  const words = (markup: string) =>
    markup
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  /** The markup of one block, from its opening tag to its end. */
  const block = (id: string) => {
    const start = html.indexOf(`<div class="about-block" data-block="${id}">`);
    expect(start, `block ${id}`).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf('</div>', start) + '</div>'.length);
  };
  const BLOCKS = ['what', 'question-1', 'question-2', 'question-3', 'method', 'limits', 'credits', 'ai'];

  it('has a title that can take focus when it opens', () => {
    // Without it the browser focuses the first control, far down the text, scrolling past the title.
    expect(html).toMatch(/^<dialog class="about" aria-labelledby="about-title"><h2 id="about-title" tabindex="-1">/);
  });

  it('puts none of its text in the page while it is closed', () => {
    expect(renderToStaticMarkup(createElement(AboutDialog, { open: false, onClose: () => undefined }))).toBe(
      '<dialog class="about" aria-labelledby="about-title"></dialog>',
    );
  });

  it('has its parts in order, each under an h3', () => {
    const headings = [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map((m) => words(m[1]!));
    expect(headings).toEqual(['What this is', "The challenge's three questions", 'How the harvest map is made', 'Limits', 'Data and credits', 'How AI was used']);
    expect(html).not.toMatch(/<h[456]/);
  });

  it('has every block and, since a teammate checked its text on 15 November 2026, no word that marks it as unchecked', () => {
    expect([...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1])).toEqual(BLOCKS);
    expect(html).not.toContain('Draft, not yet checked by the team');
    expect(words(html)).not.toMatch(/draft|not yet checked/i);
  });

  it("asks the challenge's three questions word for word, each a closed fold that opens to its answer", () => {
    expect(CHALLENGE_QUESTIONS).toEqual([
      'What physical drivers are behind what we see, or do not see, in the radar data?',
      'Which polarizations highlight these changes?',
      'What future applications of NISAR are possible?',
    ]);
    CHALLENGE_QUESTIONS.forEach((question, i) =>
      expect(html).toContain(`<details class="about-fold about-question"><summary>${question}</summary><div class="about-block" data-block="question-${i + 1}">`),
    );
  });

  it('folds the method in five steps, and keeps the limits in view', () => {
    expect(html).toContain(`<details class="about-fold about-method"><summary>${METHOD_FOLD_SUMMARY}</summary><div class="about-block" data-block="method"><ol>`);
    expect(block('method').match(/<li>/g)).toHaveLength(5);
    expect(html).not.toContain('<details open');
    // Every fold closes before the limits start: they are never inside one.
    const limits = html.indexOf('data-block="limits"');
    expect(html.lastIndexOf('<details', limits)).toBeLessThan(html.lastIndexOf('</details>', limits));
    expect(block('limits').match(/<li>/g)!.length).toBeGreaterThanOrEqual(9);
    // The optical cross-check's limit, with its own two caveats in the same item.
    expect(words(block('limits'))).toMatch(/Sentinel-2 data suggests .* three of its dates look hazy, and greenness alone cannot tell a cut field from a ripe one\./);
  });

  it('keeps each answer within 90 words and the opening within 70, numbers and units counted as words', () => {
    const count = (id: string) => words(block(id)).split(' ').length;
    expect(count('what')).toBeLessThanOrEqual(70);
    for (const id of ['question-1', 'question-2', 'question-3']) expect(count(id), id).toBeLessThanOrEqual(90);
  });

  it('says nothing of a sample site, and never that the fires were found to follow the harvest', () => {
    expect(words(html)).not.toMatch(/sample/i);
    expect(words(html)).not.toMatch(/fires (do|did) follow|fires followed|confirm/i);
    expect(words(block('question-3'))).toContain('That fires follow the harvest was not supported here for 5 to 14 November');
  });

  it('keeps the credits, with the line that the project is not affiliated with NASA', () => {
    const credits = words(block('credits'));
    expect(credits).toContain('NISAR data courtesy NASA/JPL-Caltech and ISRO, distributed by the Alaska Satellite Facility DAAC.');
    expect(credits).toContain('NASA FIRMS');
    expect(credits).toContain('OpenFreeMap © OpenMapTiles Data from OpenStreetMap');
    expect(credits).toContain('The optical cross-check used Copernicus Sentinel-2 data (ESA): contains modified Copernicus Sentinel data 2026.');
    expect(credits).toContain('This project is not affiliated with or endorsed by NASA.');
  });

  it('says how AI was used without naming a person or saying anything about the concept or the idea', () => {
    const ai = words(block('ai'));
    expect(ai).toMatch(/^We used Claude \(Anthropic\) in Claude Code/);
    expect(ai).toMatch(/AI_USE\.md in the project's repository is the running record\.$/);
    expect(ai).not.toMatch(/concept|idea|propos|suggest|chose|asked/i);
    expect(ai).not.toMatch(/TO FILL|\[/);
    // Every capitalised word is a product, an organisation, a mission, a file or a sentence's first word: no name of a person.
    const allowed = new Set(['We', 'Claude', 'Anthropic', 'Code', 'Fable', 'Opus', 'NISAR', 'No', 'AI-generated', 'AI_USE.md']);
    const capitalised = ai
      .split(' ')
      .map((w) => w.replace(/^[(“"]+/, '').replace(/[),;:.”"]+$/, ''))
      .filter((w) => /^[A-Z]/.test(w));
    expect(capitalised.length).toBeGreaterThan(5);
    for (const w of capitalised) expect(allowed.has(w), w).toBe(true);
  });

  it('keeps the link to the source code and the Close button', () => {
    expect(html).toContain(`<a href="${REPOSITORY_URL}" target="_blank" rel="noreferrer">${REPOSITORY_URL}</a>`);
    expect(html).toMatch(/<form method="dialog"><button type="submit">Close<\/button><\/form><\/dialog>$/);
  });
});

describe('InspectPanel hint', () => {
  it('names the keyboard way to read values, not only the click', () => {
    const html = renderToStaticMarkup(createElement(InspectPanel, { state: { status: 'idle' }, mixedRelease: false, onInspectCentre: () => undefined }));
    expect(html).toContain('Read values at the map centre');
    expect(html).toContain('or move the map and use this button');
  });
});

describe('InspectPanel while the dates play', () => {
  it('is a polite live region, but not while playing (the reading changes on every step)', () => {
    const render = (quiet?: boolean) =>
      renderToStaticMarkup(createElement(InspectPanel, { state: { status: 'idle' }, mixedRelease: false, onInspectCentre: () => undefined, quiet }));
    expect(render()).toContain('aria-live="polite" data-testid="inspect"');
    expect(render(false)).toContain('aria-live="polite" data-testid="inspect"');
    expect(render(true)).toContain('aria-live="off" data-testid="inspect"');
  });
});

describe('pictureLoadingNote', () => {
  const perDate = {
    id: 'hh',
    kind: 'per-date',
    items: [
      { url: 'a.tif', date: '2026-06-19' },
      { url: 'b.tif', date: '2026-07-01' },
    ],
  } as unknown as Layer;
  const still = { id: 'c', kind: 'static', items: [{ url: 'c.tif' }] } as unknown as Layer;
  const note = (layer: Layer | null, itemIndex: number, drawnItem: number | null, hasError = false) =>
    pictureLoadingNote({ layer, itemIndex, drawnItem, hasError });

  it('names the date whose picture is loading until the map has drawn that date', () => {
    expect(note(perDate, 1, null)).toBe('Loading the picture of 2026-07-01…');
    expect(note(perDate, 1, 0)).toBe('Loading the picture of 2026-07-01…'); // the previous date is drawn, not this one
    expect(note(perDate, 1, 1)).toBeNull();
    expect(note(still, 0, null)).toBe('Loading the picture…');
    expect(note(still, 0, 0)).toBeNull();
  });

  it('says nothing without a layer or item, or when a problem with the file is shown instead', () => {
    expect(note(null, -1, null)).toBeNull();
    expect(note(perDate, -1, null)).toBeNull();
    expect(note(perDate, 1, null, true)).toBeNull();
  });

  it('is not a live region', () => {
    const html = renderToStaticMarkup(createElement(PictureLoading, { note: 'Loading the picture of 2026-07-01…' }));
    expect(html).toBe('<p class="picture-loading" data-testid="picture-loading">Loading the picture of 2026-07-01…</p>');
    expect(renderToStaticMarkup(createElement(PictureLoading, { note: null }))).toBe('');
  });
});

describe('the tag on the map (what it shows)', () => {
  const perDate = {
    id: 'hh',
    title: 'HH backscatter',
    kind: 'per-date',
    items: [
      { url: 'a.tif', date: '2026-06-19' },
      { url: 'b.tif', date: '2026-07-01' },
    ],
  } as unknown as Layer;
  const pair = { id: 'd', title: 'Change in HH', kind: 'pair', items: [{ url: 'd.tif', reference: '2026-06-19', secondary: '2026-07-01' }] } as unknown as Layer;
  const still = { id: 'c', title: 'Harvest wave', kind: 'static', items: [{ url: 'c.tif' }] } as unknown as Layer;

  it('names the layer and the date of the picture drawn, the pair of dates of a pair, the title alone for a static layer', () => {
    expect(pictureShownText({ layer: perDate, index: 0 }, true)).toBe('On the map: HH backscatter, 2026-06-19');
    expect(pictureShownText({ layer: perDate, index: 1 }, true)).toBe('On the map: HH backscatter, 2026-07-01');
    expect(pictureShownText({ layer: pair, index: 0 }, true)).toBe('On the map: Change in HH, 2026-06-19 to 2026-07-01');
    expect(pictureShownText({ layer: still, index: 0 }, true)).toBe('On the map: Harvest wave');
  });

  it('says when nothing is drawn, and is absent when there is no layer to draw', () => {
    expect(pictureShownText(null, true)).toBe('On the map: no picture yet');
    expect(pictureShownText(null, false)).toBeNull();
  });

  it('never names a picture whose file could not be loaded as drawn: it says that none is, and which could not be loaded', () => {
    expect(pictureShownText({ layer: perDate, index: 1, failed: true }, true)).toBe('On the map: no picture (2026-07-01 could not be loaded)');
    expect(pictureShownText({ layer: pair, index: 0, failed: true }, true)).toBe('On the map: no picture (2026-06-19 to 2026-07-01 could not be loaded)');
    expect(pictureShownText({ layer: still, index: 0, failed: true }, true)).toBe('On the map: no picture (Harvest wave could not be loaded)');
    expect(pictureShownText({ layer: perDate, index: 1, failed: false }, true)).toBe('On the map: HH backscatter, 2026-07-01');
  });

  it('is plain text, not a live region', () => {
    const html = renderToStaticMarkup(createElement(PictureShown, { text: 'On the map: HH backscatter, 2026-06-19' }));
    expect(html).toBe('<p class="map-showing" data-testid="map-showing">On the map: HH backscatter, 2026-06-19</p>');
    expect(renderToStaticMarkup(createElement(PictureShown, { text: null }))).toBe('');
  });
});

describe('InspectPanel', () => {
  const state = {
    status: 'done' as const,
    result: {
      lon: -118,
      lat: 34.8,
      valueText: '5.0 dB or more',
      valueWhen: '2008-10-12',
      history: {
        layerTitle: 'HH',
        unit: 'dB',
        resolutionM: 125,
        categorical: false,
        points: [
          { date: '2008-10-12', value: 5, text: '5.0 dB or more', clipped: 'above' as const },
          { date: '2008-11-27', value: -12, text: '-12.0 dB' },
        ],
      },
    },
  };

  it('shows a clipped value as a bound in the table and the chart', () => {
    const html = renderToStaticMarkup(createElement(InspectPanel, { state, mixedRelease: false, onInspectCentre: () => undefined }));
    expect(html).toContain('<td>5.0 dB or more</td>');
    expect(html).toContain('class="chart-bound"');
    expect(html).toContain('data-testid="clipped-note"');
    expect(html.match(/class="chart-dot"/g)).toHaveLength(1);
  });

  it("keeps the point and its history while another date's value is read; only the value line says so", () => {
    const render = (s: Parameters<typeof InspectPanel>[0]['state']) =>
      renderToStaticMarkup(createElement(InspectPanel, { state: s, mixedRelease: false, onInspectCentre: () => undefined }));
    const html = render({ status: 'updating', result: state.result, when: '2008-11-27' });
    expect(html).toContain('<p data-testid="inspect-value-reading">Value (2008-11-27): reading…</p>');
    // The value of the date before is not shown under the new date's name.
    expect(html).not.toContain('data-testid="inspect-value"');
    expect(html).not.toContain('Value (2008-10-12)');
    expect(html).not.toContain('Reading values');
    // Everything else is the same as for the finished reading: the point, the chart and the table.
    // (The value's line carries the class that fades it in whole when it arrives, styles/motion.css.)
    const strip = (s: string) =>
      s
        .replace(/<p data-testid="inspect-value-reading">.*?<\/p>/, '')
        .replace(/<p class="inspect-value-line">Value \(2008-10-12\): <strong data-testid="inspect-value">.*?<\/strong><\/p>/, '');
    expect(strip(html)).toBe(strip(render(state)));
    expect(strip(render(state))).not.toContain('Value (2008-10-12)');
    expect(html).toContain('Longitude -118.0000, latitude 34.8000');
    expect(html).toContain('class="chart"');
    expect(html).toContain('<td>-12.0 dB</td>');
  });
});

// The panel no longer loads its file: App reads stats.json once per site (components/useStats.ts) and
// shares it with the year's curve, and gives the panel what that read has come to (`load`, null while
// it loads). These renders pin that it still shows the same three states as when it loaded the file.
describe('StatsPanel', () => {
  const render = (load: Parameters<typeof StatsPanel>[0]['load'], mixedRelease = false) =>
    renderToStaticMarkup(createElement(StatsPanel, { load, mixedRelease, layers: [] }));

  it('carries the mixed-release warning, as the contract asks wherever dates are compared', () => {
    const html = render(null, true);
    expect(html).toContain(MIXED_RELEASE_WARNING);
    expect(render(null, false)).not.toContain(MIXED_RELEASE_WARNING);
  });

  it('says "Loading…" until the file has answered, then its error, or its series and bars', () => {
    expect(render(null)).toContain('<p class="muted">Loading…</p>');
    const failed = render({ error: 'Could not load statistics (HTTP 404).' }, true);
    expect(failed).not.toContain('Loading…');
    expect(failed).toContain('<p class="error">Could not load statistics (HTTP 404).</p>');
    expect(failed).toContain(MIXED_RELEASE_WARNING);
    const series = { id: 's', title: 'Mean of something', unit: 'dB', region: 'R', method: 'M', points: [{ date: '2026-01-01', value: -9 }] };
    const loaded = render({ stats: { schema: 1, site: 'x', series: [series] } as unknown as Stats }, true);
    expect(loaded).not.toContain('Loading…');
    expect(loaded).toContain('<figcaption><strong>Mean of something</strong> (dB)</figcaption>');
    expect(loaded.split(MIXED_RELEASE_WARNING)).toHaveLength(2); // once, not twice
  });
});

describe('crash page', () => {
  it('turns a thrown error into state the boundary can show', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('boom')).error.message).toBe('boom');
    expect(ErrorBoundary.getDerivedStateFromError('text').error.message).toBe('text');
  });

  it('shows the message, a reload link and the sample notice', () => {
    const html = renderToStaticMarkup(
      createElement(CrashMessage, { message: 'boom', sampleNotice: 'Not a NISAR observation.', href: '/app/?lat=1', homeHref: '/app/' }),
    );
    expect(html).toContain('boom');
    expect(html).toContain('href="/app/?lat=1"');
    expect(html).toContain('href="/app/"');
    expect(html).toContain('Not a NISAR observation.');
  });

  it('leaves the notice out when no sample site was showing', () => {
    const html = renderToStaticMarkup(createElement(CrashMessage, { message: 'boom', sampleNotice: null, href: '/', homeHref: '/' }));
    expect(html).not.toContain('sample-notice');
  });
});

// Less to read at once (docs/MOTION_AND_STORY_BRIEF.md, slice 4): three long texts fold under a
// closed native <details>, built like a bars figure's method; what must stay in view stays outside it.
describe('the folds of the tool', () => {
  /** The markup after the first closed <details> of `html` (none: -1). */
  const firstDetails = (html: string) => html.indexOf('<details');

  describe('missing passes', () => {
    const missing = [
      { date: '2026-07-07', reason: 'SYNTHETIC: no product on this date' },
      { date: '2026-07-31', reason: 'SYNTHETIC: an instrument gap' },
    ];
    const timeline = (gaps: typeof missing) =>
      buildTimeline(
        { dates: [{ date: '2026-06-25' }, { date: '2026-07-19' }, { date: '2026-08-12' }], missing_passes: gaps } as unknown as Parameters<
          typeof buildTimeline
        >[0],
        { items: ['2026-06-25', '2026-07-19', '2026-08-12'].map((date) => ({ url: `${date}.tif`, date })) },
      );
    const render = (gaps: typeof missing) =>
      renderToStaticMarkup(createElement(DateStepper, { entries: timeline(gaps), itemIndex: 0, onChange: () => undefined }));

    it('keeps the hatched marks, the key and how many are missing in view, and folds the dated reasons under them', () => {
      const html = render(missing);
      const details = firstDetails(html);
      expect(details).toBeGreaterThan(-1);
      const inView = html.slice(0, details);
      // Every missing pass is still a hatched mark on the timeline, with the key saying what it is.
      expect(inView.match(/class="tick tick-missing"/g)).toHaveLength(missing.length);
      expect(inView).toContain('<span class="tick-key tick-missing"></span> missing pass');
      // One line says how many, right before the fold.
      expect(inView).toMatch(/<p class="missing-count" data-testid="missing-count">2 passes are missing<\/p>$/);
      // The fold: closed, its summary saying what it holds, every dated reason inside, word for word.
      expect(html.slice(details)).toBe(
        `<details class="missing-reasons"><summary>${MISSING_REASONS_SUMMARY}</summary><ul class="missing-list">` +
          missing.map((m) => `<li>Missing ${m.date}: ${m.reason}</li>`).join('') +
          '</ul></details></div>',
      );
      expect(MISSING_REASONS_SUMMARY).toBe('Why they are missing');
    });

    it('counts one pass in the singular, and shows neither line nor fold when none is missing', () => {
      expect(missingCountText(1)).toBe('1 pass is missing');
      expect(missingCountText(6)).toBe('6 passes are missing');
      expect(render(missing.slice(0, 1))).toContain('>1 pass is missing</p>');
      const none = render([]);
      expect(none).not.toContain('missing-count');
      expect(none).not.toContain('<details');
    });
  });

  describe('a series in Statistics', () => {
    const series = {
      id: 's',
      title: 'SYNTHETIC mean echo',
      unit: 'dB',
      region: 'SYNTHETIC: the whole made-up box',
      method: 'SYNTHETIC: the mean of made-up values, written here to be folded.',
      points: [
        { date: '2026-07-01', value: -12 },
        { date: '2026-07-13', value: -11 },
      ],
    };
    const stats = { schema: 1, site: 'x', series: [series] } as unknown as Stats;
    const render = (mixedRelease: boolean) => renderToStaticMarkup(createElement(StatsBody, { stats, layers: [], mixedRelease }));

    it('keeps the title, unit and chart in view and folds the region, then the method, under a closed disclosure', () => {
      const html = render(false);
      const details = firstDetails(html);
      expect(details).toBeGreaterThan(-1);
      const inView = html.slice(0, details);
      expect(inView).toContain(`<figcaption><strong>${series.title}</strong> (${series.unit})</figcaption>`);
      expect(inView).toContain('class="chart"');
      expect(html.slice(details)).toBe(
        `<details class="muted series-method"><summary>${SERIES_METHOD_SUMMARY}</summary>` +
          `<p>${SERIES_REGION_LABEL} ${series.region}</p><p>${SERIES_METHOD_LABEL} ${series.method}</p></details></figure>`,
      );
      expect([SERIES_METHOD_SUMMARY, SERIES_REGION_LABEL, SERIES_METHOD_LABEL]).toEqual(['How this was computed', 'Where:', 'How:']);
      // Each written once, inside the disclosure: nothing deleted, nothing repeated.
      expect(html.split(series.region)).toHaveLength(2);
      expect(html.split(series.method)).toHaveLength(2);
    });

    it('keeps the bar charts as they are: their region in view, only their method folded', () => {
      const bars = {
        id: 'b',
        title: 'SYNTHETIC bars',
        unit: '%',
        region: 'SYNTHETIC: the region of the bars',
        method: 'SYNTHETIC: the method of the bars.',
        categories: [{ label: 'One', value: 1 }],
      };
      const html = renderToStaticMarkup(createElement(StatsBody, { stats: { ...stats, bars: [bars] } as unknown as Stats, layers: [], mixedRelease: false }));
      const figure = html.slice(html.indexOf('<figure class="bars"'));
      expect(figure.indexOf(`<p class="muted bars-region">Region: ${bars.region}</p>`)).toBeGreaterThan(-1);
      expect(figure.indexOf(`<p class="muted bars-region">Region: ${bars.region}</p>`)).toBeLessThan(firstDetails(figure));
      expect(figure).not.toContain(SERIES_REGION_LABEL);
    });

    it('never folds the mixed-release warning', () => {
      const html = render(true);
      expect(html.indexOf(MIXED_RELEASE_WARNING)).toBeGreaterThan(-1);
      expect(html.indexOf(MIXED_RELEASE_WARNING)).toBeLessThan(firstDetails(html));
    });
  });

  describe('the legend', () => {
    const layer = {
      id: 'c',
      title: 'Classes',
      kind: 'static',
      unit: '',
      description: 'SYNTHETIC: what the classes mean.',
      method: 'SYNTHETIC: how the classes were made, written here to be folded.',
      encoding: { type: 'categorical-uint8', nodata: 0, classes: [{ value: 1, label: 'One', color: '#0072b2' }] },
      items: [{ url: 'c.tif' }],
    } as unknown as Layer;

    it('keeps the description in view, and folds the method under a closed disclosure', () => {
      const html = renderToStaticMarkup(createElement(Legend, { layer }));
      const details = firstDetails(html);
      expect(details).toBeGreaterThan(-1);
      expect(html.slice(0, details)).toMatch(/<p class="legend-description">SYNTHETIC: what the classes mean\.<\/p>$/);
      expect(html.slice(details)).toBe(`<details class="muted legend-method"><summary>${LEGEND_METHOD_SUMMARY}</summary><p>${layer.method!}</p></details></section>`);
      expect(LEGEND_METHOD_SUMMARY).toBe('Method');
      expect(html.split(layer.method!)).toHaveLength(2);
    });

    it('has no fold for a layer without a method', () => {
      expect(renderToStaticMarkup(createElement(Legend, { layer: { ...layer, method: undefined } }))).not.toContain('<details');
    });

    it("folds an overlay's method the same way, under the same summary, and keeps its description, sentence and credit in view", () => {
      const overlay = {
        id: 'dots',
        title: 'Dots',
        kind: 'points',
        url: 'd.geojson',
        description: 'SYNTHETIC: what a dot is.',
        method: 'SYNTHETIC: how the dots were chosen, written here to be folded.',
        credit: 'SYNTHETIC credit line',
      } as Overlay;
      const html = renderToStaticMarkup(createElement(Legend, { layer, overlays: [overlayView(overlay, undefined, layer, 0, '#c000ff')] }));
      const entry = html.slice(html.indexOf('data-testid="legend-overlay"'));
      const fold = `<details class="muted legend-method"><summary>${LEGEND_METHOD_SUMMARY}</summary><p>${overlay.method!}</p></details>`;
      expect(entry).toContain(fold);
      expect(html.split('<details')).toHaveLength(3); // the layer's method and the overlay's, nothing else
      const [before, after] = entry.split(fold) as [string, string];
      expect(before).toContain(`<p>${overlay.description}</p>`);
      expect(before).toContain(`<p>${OVERLAY_NOT_NISAR}</p>`);
      expect(after).toContain(`Credit: ${overlay.credit}`);
    });
  });
});
