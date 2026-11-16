// The guided story's rules (src/story/storyModel.ts) and its panel's markup, on the SYNTHETIC fixture
// manifest and on copies of it changed per test. Several cases come from the first guided tour's
// tests (pull request 4, tests/unit/story.test.ts, removed with the tour), where the brief keeps them.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MIXED_RELEASE_WARNING } from '../../src/components/StatsPanel';
import type { Manifest, Site, StoryStep } from '../../src/contract/manifest';
import type { PictureOnMap } from '../../src/map/dataLayers';
import { formatDay, formatPeriod } from '../../src/state/overlayPeriod';
import { overlayView } from '../../src/state/overlayView';
import { selectionToUrlState, type Selection } from '../../src/state/urlState';
import { StoryPanel, type StoryPanelProps } from '../../src/story/StoryPanel';
import {
  coverEyebrow,
  coverFigures,
  hasStory,
  openingIndex,
  planStep,
  safeView,
  sameSelection,
  siteCamera,
  stampDrawnDate,
  stampText,
  stepAnnouncement,
  stepSelection,
  stepStates,
  storyParagraphs,
  storySteps,
  type StepState,
} from '../../src/story/storyModel';
import {
  buildManifest,
  DATES,
  HV_ABSENT_DATE,
  MISSING_SLOTS,
  OVERLAY_ID,
  PASS_SLOTS,
  SITE_ID,
  STORY_MIDYEAR_DATE,
  YEAR_DATES,
  YEAR_HV_DATES,
  YEAR_LAYERS,
  YEAR_MISSING,
  YEAR_SITE_ID,
} from '../fixtures/synthetic.mjs';

const fresh = () => buildManifest() as unknown as Manifest;
const manifest = fresh();
const year = manifest.sites.find((s) => s.id === YEAR_SITE_ID)!;
const steps = year.story!;
const [first, midyear, classes, points] = steps as [StoryStep, StoryStep, StoryStep, StoryStep];
const lastHh = YEAR_DATES[YEAR_DATES.length - 1]!;
const lastHv = YEAR_HV_DATES[YEAR_HV_DATES.length - 1]!;
const hh = year.layers.find((l) => l.id === YEAR_LAYERS.hh)!;
const hv = year.layers.find((l) => l.id === YEAR_LAYERS.hv)!;
const classLayer = year.layers.find((l) => l.id === YEAR_LAYERS.classes)!;
const hhAt = (date: string) => hh.items.findIndex((it) => it.date === date);
const hvAt = (date: string) => hv.items.findIndex((it) => it.date === date);

/** A manifest whose site `id` (the year site by default) has this story instead of the fixture's. */
function withStory(story: unknown, id = YEAR_SITE_ID): { manifest: Manifest; site: Site } {
  const m = fresh();
  const site = m.sites.find((s) => s.id === id)!;
  (site as unknown as { story: unknown }).story = story;
  return { manifest: m, site };
}
const step = (id: string, extra: Partial<StoryStep> = {}): StoryStep => ({ id, title: `SYNTHETIC ${id}`, text: 'SYNTHETIC text.', ...extra });
/** The link keys of a step's state, for comparing states. */
const keys = (site: Site, state: StepState) => selectionToUrlState(stepSelection(site, state));
const states = (story: StoryStep[], id = YEAR_SITE_ID) => {
  const { manifest: m, site } = withStory(story, id);
  return stepStates(m, site).map((s) => keys(site, s));
};

describe('the fixture story these tests rely on', () => {
  it('has four steps: no date, a date and a view, a static layer, and overlays with a view', () => {
    expect(steps).toHaveLength(4);
    expect(first.layer).toBe(YEAR_LAYERS.hh);
    expect(first.date).toBeUndefined();
    expect(first.view).toBeUndefined();
    expect(midyear.date).toBe(STORY_MIDYEAR_DATE);
    expect(midyear.view).toBeDefined();
    expect(classes.layer).toBe(YEAR_LAYERS.classes);
    expect(points.overlays).toEqual([OVERLAY_ID]);
    expect(points.date).toBe(lastHv);
    expect(year.view).toBeUndefined();
  });
});

describe('the steps of a site', () => {
  it('lists the steps of a site, and none for a site without a story', () => {
    expect(storySteps(year).map((s) => s.id)).toEqual(steps.map((s) => s.id));
    expect(storySteps(manifest.sites.find((s) => s.id === SITE_ID))).toEqual([]);
    expect(storySteps(null)).toEqual([]);
    expect(hasStory(year)).toBe(true);
    expect(hasStory(manifest.sites.find((s) => s.id === SITE_ID))).toBe(false);
  });

  it('skips a step that has no id, title or text, and a story that is not a list (unknown parts degrade quietly)', () => {
    const odd = withStory([step('a'), { id: 'b', title: 'B' }, null, 'c', { title: 'D', text: 'x' }, { id: ' ', title: 'E', text: 'x' }]).site;
    expect(storySteps(odd).map((s) => s.id)).toEqual(['a']);
    expect(storySteps(withStory({ id: 'a' }).site)).toEqual([]);
    expect(hasStory(withStory([]).site)).toBe(false);
  });

  it('opens at the step the address names, else at the cover', () => {
    expect(openingIndex(steps, { kind: 'step', id: classes.id })).toBe(2);
    expect(openingIndex(steps, { kind: 'step', id: 'no-such-step' })).toBe(0);
    expect(openingIndex(steps, { kind: 'cover' })).toBe(0);
    expect(openingIndex([], { kind: 'step', id: classes.id })).toBe(0);
  });
});

describe("each step's state (stepStates)", () => {
  it('resolves the fixture story: the newest HH date kept, the mid-year date, the classes, the last HV pass with the points', () => {
    expect(stepStates(manifest, year)).toEqual([
      { layerId: YEAR_LAYERS.hh, itemIndex: hhAt(lastHh), overlays: [] },
      { layerId: YEAR_LAYERS.hh, itemIndex: hhAt(STORY_MIDYEAR_DATE!), overlays: [] },
      { layerId: YEAR_LAYERS.classes, itemIndex: 0, overlays: [] },
      { layerId: YEAR_LAYERS.hv, itemIndex: hvAt(lastHv), overlays: [OVERLAY_ID] },
    ]);
  });

  it('is the same however the step is reached: a pure fold from the site default, valid for the site', () => {
    const once = stepStates(manifest, year);
    expect(stepStates(fresh(), fresh().sites.find((s) => s.id === YEAR_SITE_ID)!)).toEqual(once);
    for (const state of once) {
      const sel = stepSelection(year, state);
      expect(sel.layer?.items[sel.itemIndex]).toBeDefined();
    }
  });

  it('a step without a date keeps the date shown when its layer has it', () => {
    const date = YEAR_HV_DATES[3]!;
    expect(states([step('a', { layer: YEAR_LAYERS.hv, date }), step('b', { layer: YEAR_LAYERS.hh })])[1]).toEqual({
      site: YEAR_SITE_ID,
      layer: YEAR_LAYERS.hh,
      date,
    });
  });

  it("a step without a date takes the layer's newest when it lacks the date shown; after a static layer, the newest", () => {
    expect(states([step('a', { layer: YEAR_LAYERS.hh, date: HV_ABSENT_DATE }), step('b', { layer: YEAR_LAYERS.hv })])[1]!.date).toBe(lastHv);
    expect(states([step('a', { layer: YEAR_LAYERS.classes }), step('b', { layer: YEAR_LAYERS.hh })])[1]!.date).toBe(lastHh);
  });

  it('a static layer has no date (its one item)', () => {
    const { manifest: m, site } = withStory([step('a', { layer: YEAR_LAYERS.hh, date: YEAR_DATES[2] }), classes]);
    expect(stepStates(m, site)[1]).toEqual({ layerId: YEAR_LAYERS.classes, itemIndex: 0, overlays: [] });
    expect(states([step('a', { layer: YEAR_LAYERS.hh, date: YEAR_DATES[2] }), classes])[1]).toEqual({ site: YEAR_SITE_ID, layer: YEAR_LAYERS.classes });
  });

  it('a step without a layer keeps the layer and the date and sets its overlays; a step naming none switches them off', () => {
    const date = YEAR_HV_DATES[5]!;
    const got = states([step('a', { layer: YEAR_LAYERS.hv, date }), step('b', { overlays: [OVERLAY_ID] }), step('c')]);
    expect(got[1]).toEqual({ site: YEAR_SITE_ID, layer: YEAR_LAYERS.hv, date, overlays: [OVERLAY_ID] });
    expect(got[2]).toEqual({ site: YEAR_SITE_ID, layer: YEAR_LAYERS.hv, date });
  });

  it('keeps what is shown for every part the site lacks, and never throws', () => {
    const date = YEAR_HV_DATES[5]!;
    const ghost = step('ghost', { layer: 'no-such-layer', date: '1999-01-01', overlays: ['no-such-overlay', OVERLAY_ID] });
    const got = states([step('a', { layer: YEAR_LAYERS.hv, date }), ghost]);
    // The layer and the date stay; of the overlays only the ones the site has.
    expect(got[1]).toEqual({ site: YEAR_SITE_ID, layer: YEAR_LAYERS.hv, date, overlays: [OVERLAY_ID] });
    // A date the layer lacks: the date shown when the layer has it, else the layer's newest.
    expect(states([step('a', { layer: YEAR_LAYERS.hv, date }), step('b', { layer: YEAR_LAYERS.hh, date: '1999-01-01' })])[1]!.date).toBe(date);
    expect(states([step('a', { layer: YEAR_LAYERS.hh, date: HV_ABSENT_DATE }), step('b', { layer: YEAR_LAYERS.hv, date: '1999-01-01' })])[1]!.date).toBe(lastHv);
    // A date with a static layer is ignored; overlays that are not a list are none.
    const odd = { ...step('odd', { layer: YEAR_LAYERS.classes, date: YEAR_DATES[0] }), overlays: 'x' } as unknown as StoryStep;
    expect(states([odd])[0]).toEqual({ site: YEAR_SITE_ID, layer: YEAR_LAYERS.classes });
  });

  describe('on a pair layer (the second fixture site, given a story)', () => {
    const site = manifest.sites.find((s) => s.id === SITE_ID)!;
    const pairLayer = site.layers.find((l) => l.kind === 'pair')!;
    const [p0, p1] = pairLayer.items as unknown as [{ reference: string; secondary: string }, { reference: string; secondary: string }];
    const key = (p: { reference: string; secondary: string }) => `${p.reference}_${p.secondary}`;
    const pairStep = (id: string, extra: Partial<StoryStep> = {}) => step(id, { layer: pairLayer.id, ...extra });

    it("sets the step's reference and secondary", () => {
      expect(states([step('a', { layer: 'hh', date: DATES[0] }), pairStep('b', { reference: p0.reference, secondary: p0.secondary })], SITE_ID)[1]).toEqual({
        site: SITE_ID,
        layer: pairLayer.id,
        pair: key(p0),
      });
    });

    it("without a pair keeps the pair shown (the brief's spread), else the layer's newest", () => {
      const got = states([pairStep('a', { reference: p0.reference, secondary: p0.secondary }), step('b'), pairStep('c')], SITE_ID);
      expect(got[2]!.pair).toBe(key(p0));
      expect(states([step('a', { layer: 'hh' }), pairStep('b')], SITE_ID)[1]!.pair).toBe(key(p1));
    });

    it('with a pair the layer lacks keeps the pair shown, else the newest', () => {
      const missing = { reference: '1999-01-01', secondary: '1999-01-13' };
      expect(states([pairStep('a', { reference: p0.reference, secondary: p0.secondary }), pairStep('b', missing)], SITE_ID)[1]!.pair).toBe(key(p0));
      expect(states([step('a', { layer: 'hh' }), pairStep('b', missing)], SITE_ID)[1]!.pair).toBe(key(p1));
    });
  });

  it('gives no states for a site the manifest does not have', () => {
    expect(stepStates({ ...manifest, sites: [] }, year)).toEqual([]);
  });
});

describe('sameSelection', () => {
  it('compares site, layer, item and overlays', () => {
    const [a, b] = stepStates(manifest, year).map((s) => stepSelection(year, s)) as [Selection, Selection];
    expect(sameSelection(a, { ...a, overlays: [...a.overlays] })).toBe(true);
    expect(sameSelection(a, b)).toBe(false);
    expect(sameSelection(a, { ...a, overlays: [OVERLAY_ID] })).toBe(false);
    expect(sameSelection(null, null)).toBe(true);
    expect(sameSelection(a, null)).toBe(false);
  });
});

describe('how a step arrives (planStep)', () => {
  const resolved = stepStates(manifest, year);
  const at = (i: number) => ({ step: steps[i]!, state: resolved[i]! });
  /** A previous step showing `layer` on `date` (resolved, as stepStates would). */
  const showing = (layerId: string, date: string, extra: Partial<StoryStep> = {}) => {
    const layer = year.layers.find((l) => l.id === layerId)!;
    return { step: step('before', { layer: layerId, date, ...extra }), state: { layerId, itemIndex: layer.items.findIndex((it) => it.date === date), overlays: [] } };
  };
  /** The current step: `layer` on `date`, as stepStates resolves it. */
  const toDate = (layerId: string, date: string, extra: Partial<StoryStep> = {}) => showing(layerId, date, extra);
  const datesOf = (layerId: string, frames: number[] | null) => frames?.map((i) => year.layers.find((l) => l.id === layerId)!.items[i]!.date);

  describe('the camera (rule 2)', () => {
    it("is the step's view, else the site's view, else the site's bounds", () => {
      expect(planStep(null, at(1), year).camera).toEqual({ center: midyear.view!.center, zoom: midyear.view!.zoom });
      expect(planStep(null, at(0), year).camera).toEqual({ bounds: year.bounds });
      const viewed = { ...year, view: { center: [-40, 14] as [number, number], zoom: 6 } };
      expect(planStep(null, at(0), viewed).camera).toEqual({ center: [-40, 14], zoom: 6 });
      expect(planStep(null, at(1), viewed).camera).toEqual({ center: midyear.view!.center, zoom: midyear.view!.zoom });
    });

    it('takes a view the map cannot show as none, and makes the rest safe', () => {
      expect(safeView({ center: [10, 89], zoom: 5 })).toBeNull();
      expect(safeView({ center: [10], zoom: 5 })).toBeNull();
      expect(safeView({ center: [10, 'x'], zoom: 5 })).toBeNull();
      expect(safeView({ center: [10, 20], zoom: Number.NaN })).toBeNull();
      expect(safeView(null)).toBeNull();
      expect(safeView({ center: [190, 20], zoom: 30 })).toEqual({ center: [-170, 20], zoom: 22 });
      expect(safeView({ center: [10, 20], zoom: -3 })).toEqual({ center: [10, 20], zoom: 0 });
      const bad = { step: { ...first, view: { center: [10, 89], zoom: 5 } } as StoryStep, state: resolved[0]! };
      expect(planStep(null, bad, year).camera).toEqual({ bounds: year.bounds });
    });
  });

  describe('the dates playing forward (rule 3)', () => {
    it('without a previous step (the cover) cuts, and builds nothing', () => {
      expect(planStep(null, at(1), year)).toMatchObject({ frames: null, buildOverlays: [], classes: null });
    });

    it('a later date on the same layer plays the passes in between, in order, and rests on the step', () => {
      const plan = planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[2]!), toDate(YEAR_LAYERS.hh, YEAR_DATES[5]!), year);
      expect(datesOf(YEAR_LAYERS.hh, plan.frames)).toEqual(YEAR_DATES.slice(3, 6));
    });

    it('the fixture: step 1 (newest HH, kept) to step 2 (mid-year) is earlier, so a cut', () => {
      expect(planStep(at(0), at(1), year).frames).toBeNull();
    });

    it('an earlier or the same date cuts', () => {
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[9]!), toDate(YEAR_LAYERS.hh, YEAR_DATES[4]!), year).frames).toBeNull();
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[4]!), toDate(YEAR_LAYERS.hh, YEAR_DATES[4]!), year).frames).toBeNull();
    });

    it('the next date alone (fewer than two frames) cuts', () => {
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[4]!), toDate(YEAR_LAYERS.hh, YEAR_DATES[5]!), year).frames).toBeNull();
    });

    it("a later date on another per-date layer plays that layer's passes", () => {
      // HH shown on a date, then an HV step: what plays is the HV layer's own passes.
      const plan = planStep(showing(YEAR_LAYERS.hh, PASS_SLOTS[1]!), toDate(YEAR_LAYERS.hv, PASS_SLOTS[6]!), year);
      expect(plan.frames!.every((i) => hv.items[i] !== undefined)).toBe(true);
      expect(datesOf(YEAR_LAYERS.hv, plan.frames)).toEqual(YEAR_HV_DATES.filter((d) => d > PASS_SLOTS[1]! && d <= PASS_SLOTS[6]!));
      // The date HV lacks is not played (it is not one of its passes).
      expect(datesOf(YEAR_LAYERS.hv, plan.frames)).not.toContain(HV_ABSENT_DATE);
      expect(PASS_SLOTS[1]! < HV_ABSENT_DATE! && HV_ABSENT_DATE! < PASS_SLOTS[6]!).toBe(true);
    });

    it('skips the missing passes in between, as Next date does', () => {
      const [from, to] = [PASS_SLOTS[6]!, PASS_SLOTS[13]!];
      const missing = MISSING_SLOTS.map((s) => PASS_SLOTS[s]!).filter((d) => d > from && d <= to);
      expect(missing.length).toBeGreaterThan(0);
      const played = datesOf(YEAR_LAYERS.hh, planStep(showing(YEAR_LAYERS.hh, from), toDate(YEAR_LAYERS.hh, to), year).frames)!;
      expect(played).toEqual(YEAR_DATES.filter((d) => d > from && d <= to));
      for (const d of missing) expect(played).not.toContain(d);
      expect(YEAR_MISSING.map((m) => m.date)).toEqual(MISSING_SLOTS.map((s) => PASS_SLOTS[s]));
    });

    it('counts a previous step that kept its date from the step before (its resolved state)', () => {
      // "before" names no date, but shows (resolved) the date the step before it chose.
      const before = { step: step('before', { layer: YEAR_LAYERS.hh }), state: showing(YEAR_LAYERS.hh, YEAR_DATES[2]!).state };
      expect(datesOf(YEAR_LAYERS.hh, planStep(before, toDate(YEAR_LAYERS.hh, YEAR_DATES[5]!), year).frames)).toEqual(YEAR_DATES.slice(3, 6));
    });

    it('a step without a date cuts, even when its layer shows a later date', () => {
      const current = { step: step('now', { layer: YEAR_LAYERS.hh }), state: showing(YEAR_LAYERS.hh, YEAR_DATES[9]!).state };
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[2]!), current, year).frames).toBeNull();
    });

    it('a step whose date its layer lacks (resolved to another date) cuts', () => {
      const current = { step: step('now', { layer: YEAR_LAYERS.hv, date: HV_ABSENT_DATE }), state: showing(YEAR_LAYERS.hv, lastHv).state };
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[0]!), current, year).frames).toBeNull();
    });

    it('after a static layer, or onto a static or a pair layer, cuts', () => {
      expect(planStep(at(2), at(3), year).frames).toBeNull(); // classes, then the last HV pass
      expect(planStep(showing(YEAR_LAYERS.hh, YEAR_DATES[0]!), at(2), year).frames).toBeNull();
      const pairSite = manifest.sites.find((s) => s.id === SITE_ID)!;
      const pairLayer = pairSite.layers.find((l) => l.kind === 'pair')!;
      const item = pairLayer.items[1]!;
      const pairNow = { step: step('pair', { layer: pairLayer.id, date: item.secondary, reference: item.reference, secondary: item.secondary }), state: { layerId: pairLayer.id, itemIndex: 1, overlays: [] } };
      const hhBefore = { step: step('hh', { layer: 'hh', date: DATES[0] }), state: { layerId: 'hh', itemIndex: 0, overlays: [] } };
      expect(planStep(hhBefore, pairNow, pairSite).frames).toBeNull();
    });
  });

  describe('things that build (rule 4)', () => {
    it('an overlay with a date_property switched on by the step builds; one already on does not', () => {
      expect(planStep(at(2), at(3), year).buildOverlays).toEqual([OVERLAY_ID]);
      expect(planStep(at(3), at(3), year).buildOverlays).toEqual([]);
    });

    it('an overlay without a date_property does not build', () => {
      const m = fresh();
      const site = m.sites.find((s) => s.id === YEAR_SITE_ID)!;
      delete (site.overlays![0] as { date_property?: string }).date_property;
      expect(planStep(at(2), at(3), site).buildOverlays).toEqual([]);
    });

    it('a static layer with classes shown after another layer builds its classes in manifest order', () => {
      const values = (classLayer.encoding as { classes: { value: number }[] }).classes.map((c) => c.value);
      expect(planStep(at(1), at(2), year).classes).toEqual(values);
      expect(planStep(at(2), at(2), year).classes).toBeNull(); // the same layer before
      expect(planStep(null, at(2), year).classes).toBeNull(); // the cover
      expect(planStep(at(2), at(3), year).classes).toBeNull(); // not a static layer
    });
  });
});

describe('the camera the tool gets when the story closes from the cover (siteCamera)', () => {
  it("is the site's view, else its bounds, as MapView frames a site; never a step's view", () => {
    expect(siteCamera(year)).toEqual({ bounds: year.bounds });
    const viewed = { ...year, view: { center: [-40, 14] as [number, number], zoom: 6 } };
    expect(siteCamera(viewed)).toEqual({ center: [-40, 14], zoom: 6 });
    // The cover's own view (a far one, as on the real site) is not where the tool starts.
    const farCover = withStory([{ ...first, view: { center: [-40, 14], zoom: 4.6 } }, ...steps.slice(1)]).site;
    expect(siteCamera(farCover)).toEqual({ bounds: year.bounds });
  });

  it('takes a view the map cannot show as none, and makes the rest safe', () => {
    expect(siteCamera({ ...year, view: { center: [10, 89] as [number, number], zoom: 5 } })).toEqual({ bounds: year.bounds });
    expect(siteCamera({ ...year, view: { center: [190, 20] as [number, number], zoom: 30 } })).toEqual({ center: [-170, 20], zoom: 22 });
  });
});

describe('the cover', () => {
  it('counts the radar passes, the missing passes and each overlay with a count, as plain numerals', () => {
    expect(coverFigures(year)).toEqual([
      { value: String(YEAR_DATES.length), label: 'radar passes' },
      { value: String(YEAR_MISSING.length), label: 'passes missing, shown as missing' },
      { value: String(year.overlays![0]!.count), label: year.overlays![0]!.title },
    ]);
  });

  it('leaves out a figure whose source is absent (no missing pass, an overlay without a count) and says one in the singular', () => {
    const m = fresh();
    const site = m.sites.find((s) => s.id === YEAR_SITE_ID)!;
    site.missing_passes = [];
    delete site.overlays![0]!.count;
    site.dates = site.dates.slice(0, 1);
    expect(coverFigures(site)).toEqual([{ value: '1', label: 'radar pass' }]);
    site.dates = [];
    expect(coverFigures(site)).toEqual([]);
  });

  it('names the place (the whole title when it has no colon) and the period from the first to the last acquisition', () => {
    expect(year.title).not.toContain(':');
    const period = formatPeriod({ first: YEAR_DATES[0]!, last: lastHh });
    expect(coverEyebrow(year)).toBe(`${year.title} · ${period}`);
    expect(coverEyebrow({ ...year, dates: [] })).toBe(year.title);
  });

  it('takes the place from the title up to its first colon', () => {
    const period = formatPeriod({ first: YEAR_DATES[0]!, last: lastHh });
    expect(coverEyebrow({ ...year, title: 'SYNTHETIC Place, Region: a made-up year: seen by radar' })).toBe(`SYNTHETIC Place, Region · ${period}`);
    // A title that starts with a colon keeps its words rather than naming nothing.
    expect(coverEyebrow({ ...year, title: ': SYNTHETIC' })).toBe(`: SYNTHETIC · ${period}`);
  });
});

describe('the date stamp', () => {
  const shown = (layerId: string, index: number, failed = false): PictureOnMap => ({ layer: year.layers.find((l) => l.id === layerId)!, index, failed });

  it('names the layer and the date of the picture drawn, written out', () => {
    const i = hhAt(STORY_MIDYEAR_DATE!);
    expect(stampText(shown(YEAR_LAYERS.hh, i), true)).toBe(`${hh.title} · ${formatDay(STORY_MIDYEAR_DATE!)}`);
    expect(stampDrawnDate(shown(YEAR_LAYERS.hh, i))).toBe(STORY_MIDYEAR_DATE);
  });

  it('names a static layer by its title alone, with no date', () => {
    expect(stampText(shown(YEAR_LAYERS.classes, 0), true)).toBe(classLayer.title);
    expect(stampDrawnDate(shown(YEAR_LAYERS.classes, 0))).toBeUndefined();
  });

  it('names both dates of a pair', () => {
    const site = manifest.sites.find((s) => s.id === SITE_ID)!;
    const pairLayer = site.layers.find((l) => l.kind === 'pair')!;
    const item = pairLayer.items[0]!;
    expect(stampText({ layer: pairLayer, index: 0, failed: false }, true)).toBe(`${pairLayer.title} · ${formatDay(item.reference!)} to ${formatDay(item.secondary!)}`);
    expect(stampDrawnDate({ layer: pairLayer, index: 0, failed: false })).toBeUndefined();
  });

  it('says that a file could not be loaded, and gives no drawn date for it', () => {
    const i = hhAt(lastHh);
    expect(stampText(shown(YEAR_LAYERS.hh, i, true), true)).toBe(`No picture: ${hh.title} · ${formatDay(lastHh)} could not be loaded`);
    expect(stampText(shown(YEAR_LAYERS.classes, 0, true), true)).toBe(`No picture: ${classLayer.title} could not be loaded`);
    expect(stampDrawnDate(shown(YEAR_LAYERS.hh, i, true))).toBeUndefined();
  });

  it('names no date while the map has no picture of the layer chosen, and says nothing without a layer', () => {
    const loading = stampText(null, true);
    expect(loading).toBe('Loading the picture…');
    expect(loading).not.toMatch(/\d/);
    expect(stampText(null, false)).toBeNull();
    expect(stampDrawnDate(null)).toBeUndefined();
  });
});

describe('the words', () => {
  it("splits a step's text into paragraphs at blank lines only", () => {
    expect(storyParagraphs('One.\nStill one.\n\nTwo.\r\n  \r\nThree. ')).toEqual(['One.\nStill one.', 'Two.', 'Three.']);
    expect(storyParagraphs('\n\n')).toEqual([]);
  });

  it('announces the count and the title', () => {
    expect(stepAnnouncement(steps, 1)).toBe(`Step 2 of 4: ${midyear.title}`);
    expect(stepAnnouncement(steps, 2)).toBe(`Step 3 of 4: ${classes.title}`);
    expect(stepAnnouncement([{ ...midyear, title: 'Ends well.' }], 0)).toBe('Step 1 of 1: Ends well.');
    expect(stepAnnouncement(steps, 9)).toBe('');
  });
});

describe('the panel', () => {
  const props = (index: number, extra: Partial<StoryPanelProps> = {}): StoryPanelProps => ({
    pending: false,
    site: year,
    steps,
    index,
    layer: null,
    overlayViews: [],
    coverOnMap: false,
    control: null,
    onControl: () => undefined,
    onNext: () => undefined,
    onBack: () => undefined,
    onGoTo: () => undefined,
    onExit: () => undefined,
    ...extra,
  });
  const render = (index: number, extra: Partial<StoryPanelProps> = {}) => renderToStaticMarkup(createElement(StoryPanel, props(index, extra)));

  it('is a region named by the step title, with the count, the title as a focusable heading and the text', () => {
    const html = render(1);
    expect(html).toMatch(/<section[^>]*role="region"[^>]*aria-labelledby="story-step-title"/);
    expect(html).toContain('Step 2 of 4');
    expect(html).toMatch(new RegExp(`<h2 id="story-step-title"[^>]*tabindex="-1"[^>]*>${midyear.title}</h2>`));
    expect(html).toContain(`<p>${midyear.text}</p>`);
  });

  it('has no Back on the cover, Start there, Next after it, and "Explore the map" as Next on the last step', () => {
    const cover = render(0);
    expect(cover).not.toContain('data-testid="story-back"');
    expect(cover).toMatch(/data-testid="story-start"[^>]*>Start the story</);
    const middle = render(1);
    expect(middle).toMatch(/data-testid="story-back"[^>]*>Back</);
    expect(middle).toMatch(/data-testid="story-next"[^>]*>Next</);
    expect(render(3)).toMatch(/data-testid="story-next"[^>]*>Explore the map</);
    // "Explore the map", small at the top, on every step.
    for (const i of [0, 1, 2, 3]) expect(render(i)).toContain('data-testid="story-exit"');
  });

  it('on a desktop cover leaves the words and the buttons to the cover, and keeps the figures and the credit', () => {
    const html = render(0, { coverOnMap: true });
    expect(html).not.toContain('id="story-step-title"');
    expect(html).not.toContain('data-testid="story-start"');
    expect(html).not.toContain('data-testid="story-exit"');
    expect(html).toContain('data-testid="story-figures"');
    expect(html).toContain(`Data: ${year.source.citation}`);
  });

  it('carries the data credit on every step, and the mixed-release warning on every step of a mixed site whatever the layer, none on a site that is not mixed', () => {
    const mixed = { ...year, source: { ...year.source, release: 'mixed' as const } };
    expect(year.source.release).not.toBe('mixed');
    // Every step of the fixture story with what it puts on the map: the cover (also as the panel beside
    // the desktop cover), the mid-year date, the static class layer, and the last HV pass with the points.
    const shown: [number, Partial<StoryPanelProps>][] = [
      [0, { layer: hh }],
      [0, { layer: hh, coverOnMap: true }],
      [1, { layer: hh }],
      [2, { layer: classLayer }],
      [3, { layer: hv, overlayViews: [overlayView(year.overlays![0]!, undefined, hv, hvAt(lastHv), '#000000')] }],
    ];
    for (const [i, extra] of shown) {
      expect(render(i, extra)).toContain(`Data: ${year.source.citation}`);
      expect(render(i, { ...extra, site: mixed })).toContain(`data-testid="story-warning">${MIXED_RELEASE_WARNING}</p>`);
      expect(render(i, extra)).not.toContain('data-testid="story-warning"');
    }
    // Even with no layer on the map.
    expect(render(1, { site: mixed })).toContain('data-testid="story-warning"');
  });

  it('shows the classes of a layer with classes', () => {
    const html = render(2, { layer: classLayer });
    for (const c of (classLayer.encoding as { classes: { label: string }[] }).classes) expect(html).toContain(c.label);
  });

  it('renders the texts as text, never as HTML', () => {
    const html = render(1, { steps: [first, { ...midyear, title: '<b>SYNTHETIC</b>', text: 'One <i>x</i>.\n\nTwo.' }] });
    expect(html).toContain('&lt;b&gt;SYNTHETIC&lt;/b&gt;');
    expect(html).toContain('<p>One &lt;i&gt;x&lt;/i&gt;.</p><p>Two.</p>');
    expect(html).not.toContain('<b>');
  });

  it('holds no live region of its own (the one live region is in App)', () => {
    expect(render(1)).not.toMatch(/aria-live|role="status"|role="alert"/);
  });

  it('while pending says only that it is loading', () => {
    const html = render(0, { pending: true, site: null });
    expect(html).toContain('Loading…');
    expect(html).not.toContain('<button');
  });
});
