# Notes from the second session (branch `web-features`)

Written 14 November 2026 for the build session, which merges `web-features` into `main`. The task is
`docs/WEB_FEATURES_BRIEF.md`. This file covers items 1 to 8; item 9 is built after it by another
agent, against the fixture site described here. Items 4 and 5, item 6, item 7 and item 8 are in their
own sections below, and so is "Real-length texts", which fits the overlay and the bars to the long
texts of the real fire stage (`pipeline/fires.py`).

## Nothing needed from the contract

No change to `contract/`, `pipeline/` or `docs/` was needed or made. Everything below works with the
contract as it is on `main` (commit `93bb3e9` added overlays, story and bars).

## Done

1. **Fixtures first.**
   - `tests/fixtures/synthetic.mjs` now writes a third site, `synthetic-year`, **first** in the
     manifest, shaped like the real data will be: 30 pass slots 12 days apart from 2025-11-25 to
     2026-11-08, slots 7, 11, 12 and 21 missing (26 acquisitions); per-date layers `syn-hh` (26 dates)
     and `syn-hv` (25: it lacks 2026-01-12, which the timeline shows as "not in this layer"; its own
     encoding and display range); a static `categorical-uint8` layer `syn-classes` with five classes
     (Okabe-Ito colours, no green, checked under protanopia and deuteranopia); a click-query stack for
     each per-date layer; a points overlay `syn-points` (violet `#8000ff`, 289 points, `date_range` 2026-09-15 to
     2026-11-18, none in the period of the pass of 2026-10-03, points on a pass day and the day before
     one; seeded, no `Math.random`); a four-step `story`; `stats.json` with a dB series, a % series
     with a null, and one `bars` entry over the five classes (one null with a note, one without an
     interval, three with `low`, `high` and `n`; a second entry of the same unit and layer came with
     the second review, see "Second review of items 6 and 7"). Every text says SYNTHETIC. Ids, dates and texts
     differ from `tarn-taran` on purpose (dates are 4 days off its cycle), so hard-coding shows up as
     a failing test.
   - Every picture differs visibly from every other date's: a seasonal cycle, a front that sweeps
     west to east over the last eight passes (the class raster says which pass it reached each cell
     on), and a bright block on the south edge that moves east with every pass slot.
   - Tests take every id, date and count from the exports of `synthetic.mjs` (`YEAR_DATES`,
     `PASS_SLOTS`, `YEAR_LAYERS`, `OVERLAY_ID`, `EMPTY_PERIOD`, `pointsDated()`, ...).
   - The two earlier fixture sites follow it, unchanged.
   - New vitest checks: `tests/contract/fixture-rules.test.ts` (the contract's rules 1 to 9 as far as
     they apply to fixtures, the overlay, story and bars checks of `docs/DATA_CONTRACT.md`, and what
     the year site must carry), every stats file against `contract/stats.schema.json`, and the class
     and overlay colours in `tests/unit/colours.test.ts` (the overlay colour also stays apart from
     every shade of the grey ramp the per-date layers are drawn with).
2. **The browser tests run on the fixtures**, with the unchanged production build:
   `playwright.config.ts` has a global setup that writes the fixtures (same function as
   `npm run fixtures`, `tests/fixtures/write-fixtures.mjs`) and starts `npm run preview` with
   `SERVE_FIXTURES_AS_DATA=1`; the fixture server then answers `/data/` from the fixture folder, and a
   file the fixtures lack is a 404. `e2e/support.ts` fails any test that loaded a manifest that is not
   the synthetic one. **The browser tests no longer need the sample site** (or any file in
   `web/public/data`): T7 can delete it. (Since the review of PR 1, one smoke test,
   `e2e/real-data.spec.ts`, runs on the build's own data, in a project of its own on port 4174; it
   skips when the build has no real site. See `README.md`.)
3. **The real site first.** `resolveSelection` (via the new `defaultSite`) opens the first site whose
   `is_sample` is not true when the URL names no site or one the manifest lacks; when every site is a
   sample, the first site.
4. **The name.** `src/branding.ts` holds "Before the Smoke" and its tagline (copied from
   `docs/CONCEPT.md`; no test compares the two, so a teammate's edit there cannot block a deploy).
   `index.html` has placeholders that a `transformIndexHtml` plugin in `vite.config.ts` fills,
   escaped, into the title and the meta description. The header shows the name as the `h1` and the
   tagline under it in smaller text. The "working title" wording is gone
   from the header, the About dialog and the tests.

### Changes to the existing browser tests

- `smoke.spec.ts` and `accessibility.spec.ts` import `test` from `./support` (the guard) and check the
  manifest they read is the synthetic one. `smoke.spec.ts` now expects the heading to be the name
  instead of "working title". They pass on the richer first site.
- They read the site the app opens with the app's own rule (`openedSite` in `e2e/support.ts`, which
  calls `defaultSite`), not `manifest.sites[0]`, and check that the page shows that site's title. With
  every fixture site a sample the two are the same site; with one fixture site marked real (tried as a
  scratch change), four tests failed on the wrong site before this and all pass after it.
- One app fix the richer site forced: on a phone, a tap just beside a missing pass picked the next
  date, because a timeline dot (16 px) reaches past halfway to a neighbour 12 days away and a missing
  pass has no touch pad to cover it. Only the pad takes taps now (`styles.css`, the `pointer-events`
  rules under the touch media query). `accessibility.spec.ts` caught it unchanged.

## Verified by running

- `node scripts/tasks.mjs check`: passed (ruff, eslint and tsc, pytest 299 passed, vitest 169
  passed in 16 files, contract types up to date, validate, size budget).
- `node scripts/tasks.mjs e2e --trace off`: builds, then 28 browser tests pass.
- Without `web/dist/data`: after `npm run build`, deleted `web/dist/data` (the build's copy only),
  ran `npx playwright test --trace off` in `web/`: 28 passed.
- `e2e/fixtures.spec.ts` lists the files in `dist/data` (59 with today's real data) and expects a 404
  for each one the fixtures lack; it no longer reads the real manifest, so a real layer with no files
  yet cannot break it (it threw a TypeError before). A server changed to fall through to the build's
  data fails it (200 instead of 404).
- No vitest test reads `web/public/data` to compare dates any more: the check that the fixture's
  dates never meet the real site's compares with fixed facts (tarn-taran's 12-day cycle from
  2025-11-21, layers `hh` and `hv`), so new real data cannot fail the deploy gate.
- A deliberately mis-wired server (a scratch config with `SERVE_FIXTURES_AS_DATA=0`): every test
  failed with "THE BROWSER TESTS ARE NOT RUNNING ON THE SYNTHETIC FIXTURES: the manifest was written
  by "nisar-surface-change pipeline" ...".
- Playwright's `webServer.env` adds to the environment rather than replacing it: a scratch server run
  with `env: { SERVE_FIXTURES_AS_DATA: '1' }` also saw `PATH`, `HOME` and a probe variable set outside.
- Looked at the fixture site in Chrome at 1280 px and 375 px: name and tagline in the header (three
  short lines on the phone, the About button beside them), the SYNTHETIC notice, the HH picture of the
  last pass with the front, the class map in five colours with its legend, and the HV timeline with
  its "not in this layer" mark. No console errors.

## Items 4 and 5: play, and a static layer

Commits `a034971` (map), `945a992` (static layer), `c7593f0` (play). No change to the contract was
needed.

### Done

4. **Play.**
   - A Play / Pause button in the date stepper of a per-date layer, after Previous and Next; not for
     pair or static layers, nor for a layer with fewer than two dates it can show. Its name is "Play"
     or "Pause" (no `aria-pressed`), 44 px tall on phones, the app's focus ring, Enter and Space.
   - It steps through the dates the layer can show in the order of "Next date" (`stepDate`) and stops
     by itself on the last one, keeping focus; Play on the last date starts again from the first.
   - Timing: a step waits until the map has drawn the date's picture, then a dwell. The map side is
     `DataLayerController`'s new `onDrawn`: the item index on the first `idle` after `show()` (also
     when the picture was already loaded: `setPaintProperty` alone triggers a render and an `idle`),
     and null while the picture changes. A ceiling steps on if the map never says so.
   - Previous, Next, a timeline mark, the arrow keys, another layer or place stop it; the opacity
     slider and moving or zooming the map do not.
   - While playing, the date's `aria-live` is off; a pause or the stop at the end is announced in a
     visually hidden status line ("Paused on ...", "Played to the last date, ...").
   - The timeline does not change while it plays except for the current mark (the missing passes and
     their list stay). No transition or cross-fade, with or without reduced motion
     (`raster-fade-duration` 0 and a zero opacity transition, pinned by a unit test).
   - `play=1` in a link opens playing (see Decisions). The placeholder `extensions/timeAnimation.ts` is
     gone (its deletion landed in `a034971`), and `README.md` ("Where things are") says where playback
     lives: `state/playback.ts` (pure: order, start, next or stop, dwell, ceiling, `wantsAutoplay`) and
     `components/usePlayback.ts` (the timer).
   - **Layers with more than 12 dates no longer use `setUrl`** (changed after review, commit
     `08e818c`; see "Review fixes" below). The scaffold and the brief say such a layer switches by
     `setUrl` on one source; it now keeps one source at a time and replaces it for each date: a fresh
     source and layer for the new file at opacity 0, shown, with the old one removed, in the frame
     after it has loaded or failed (`map/dataLayers.ts`, `map/switching.ts`). Why: the cog:// protocol
     ignores MapLibre's abort signal, so with `setUrl` a late answer for an earlier date still landed
     (its TileJSON replaced the new date's tile URLs, or its tile the new tile), and a date whose file
     failed left the previous date's tiles on screen. A late answer now lands in a removed source, and
     a failed file shows nothing, as on the preload path. Real files are 3 MB (`tarn-taran`), far
     beyond the protocol's 64 KB first read, so on the real site these late answers are likelier than
     on the 12 KB fixture files. `docs/HANDOFF.md` (item 5 of "Paths the sample cannot exercise") still
     says `setUrl`; the build session may want to update it.
   - A tag at the top left of the map always names what the map shows: "On the map: <layer title>,
     <date>", with the date of the picture drawn as the map reports it (`DataLayerController`'s
     `onPictureShown`), never the date chosen; the title alone for a static layer; "On the map: no
     picture yet" when none is drawn. While a date's picture loads, the previous date's picture stays
     for at most `PREVIOUS_PICTURE_LIMIT_MS` (5 s), then the map shows nothing until the new file
     arrives, and the tag names that previous date the whole time, from the first frame. Under it,
     "Loading the picture of <date>…" appears after 400 ms (so it does not flicker while playing).
     Neither is a live region. (Added after the review of PR 1: before, the note alone said so, and its
     400 ms delay left the previous picture under the new date's name with nothing saying so.)
5. **A static layer.**
   - In the place of the date stepper: "This layer is a single map. It does not change with the date,
     so there are no dates to step through." No period is claimed. No play button; the arrow keys do
     nothing; the link carries no date (it already did not; now pinned by a unit test with a static
     item that carries a date).
   - The legend's class list is a named list for screen readers (`role="list"`, which Safari drops
     with `list-style: none`). Each swatch has a dark rim (3:1 on the panel), so a light class colour
     (the fixture's yellow) does not vanish, and `forced-color-adjust: none` keeps its colour in a
     contrast theme, where the rim takes the theme's text colour.
   - A click on a class layer reads the class label (it already did; now pinned by a test).

### Tests added

- vitest: `tests/unit/playback.test.ts` (order, start, stop, dwell, ceiling, `play=1`),
  `dataLayers.test.ts` (on the one-source path: one source, a fresh one per date shown once loaded
  and the old removed, a date still loading dropped for a newer one, a failed file shows nothing, the
  previous picture dropped after the 5 s limit, opacity, `show()` right after `setLayer`, a new layer
  drops a loading date and its timer, every source's file named for errors, never `setUrl`; `onDrawn`
  on `idle` on both paths, no fade, `dispose`), `urlState.test.ts` (`play` is never written back; no
  date in a static layer's link), `components.test.ts` (Play / Pause name, `aria-live`, the status
  line, no button for one date, the static note, the class list, the inspect panel quiet while
  playing, the loading note).
- Playwright: `e2e/play.spec.ts` (19 tests) and `e2e/static-layer.spec.ts` (4), with shared map helpers
  in `e2e/support.ts` (`openAt`, `waitForMapIdle`, `dataFiles`, `dataFingerprint`, `canvasColours`,
  `dataIsBlank`, `clickMapAt`). `accessibility.spec.ts` now also expects Play in the Tab order and at 44 px on a phone.
  No test plays more than three dates in a row; the ceiling test and the 6.5 s late-answer test take
  about 10 s, the rest 2 to 9 s.
- Checked that the tests fail without the behaviour: the late-answer test and the slow-date test fail
  with the wait in `dataLayers.ts` switched off and with a fixed dwell instead of waiting for the
  picture; the two swatch tests fail on the old swatch rule.

### Verified by running (items 4 and 5)

- `node scripts/tasks.mjs check`: passed (pytest 299, vitest 206 in 17 files, contract types, validate,
  size budget). `node scripts/tasks.mjs e2e --trace off`: 51 passed in 1.8 min, three runs in a row
  after the review fixes, no test failed in any of them.
- In Chrome on the fixture site at 1280 px and 375 px: the stepper with Previous, the date, Next and
  Play (86 x 36 px on the desktop, 86 x 44 px on the phone), the button reading Pause while the date
  moves on about every 0.75 s with the HH picture changing, and the class layer with the note in place
  of the stepper and the five classes in the legend and on the map. No console errors.
- The one-source path (`syn-hh`, 26 dates): one data source once a date is drawn; after every step and every played step
  its tiles name the selected date's file and the picture differs from the one before; the picture
  equals the same date opened afresh at the same view; a click reads the selected date's value
  (compared with the fixture's own pixel code); the 3-date site still has one source per date; no
  console errors.

### Decisions and why (items 4 and 5)

- **Dwell 700 ms, ceiling 8 s** (`PLAY_DWELL_MS`, `PLAY_CEILING_MS` in `state/playback.ts`). 700 ms is
  long enough to take in a picture and plays 26 passes in about 20 s, which suits the pitch. The dwell
  counts from when the picture is drawn, so a slow network shows every date. 8 s is longer than any
  reasonable load of one date and short enough that a broken file only pauses the playback.
- **`play=1`** opens a link playing, for a shared link and for a screen recording of the pitch. It is
  read once when the page loads and never written back (`serializeUrlState` drops it), so a link
  copied later opens still, on the date it shows. It is ignored under `prefers-reduced-motion`: the
  app never starts moving for someone who asked it not to; pressing Play still works. It starts once
  the map has drawn the picture the link opens on (since the review of PR 1; before, it started when
  the manifest arrived, and the map's start-up counted against the first date's 8 s), and anything the
  person does first (Play, Pause, a date, a layer or a place) cancels it.
- **One source at a time, replaced per date**, instead of `setUrl` on one source (which let late
  answers and failed files show one date's picture under another's name, and mixed old and new tiles
  for 1 to 3 frames, F15) or preloading every date (every pan costs one request per date). For the
  moment a date loads, two sources are on the map; the old one is removed in the frame the new one is
  shown, so there is no blank frame.
- **The previous picture stays while the next loads, for at most 5 s** (`PREVIOUS_PICTURE_LIMIT_MS`),
  and the tag on the map names its date all that time. Hiding it at once would blank the map on every
  step; keeping it under the new date's name, or for ever, would let a screenshot pass it off as the new
  date. The tag, not the loading note, is what prevents that: the note waits 400 ms, so that it does
  not flash on every step of Play, and a date that loads within that time never shows it.

### Review fixes (after two reviews of items 4 and 5)

Each finding was reproduced first: a browser test that failed on the code before the fix, or a
mutation of the app that the tests did not catch.

- A date whose file fails (404) on a layer with more than 12 dates left the previous date's picture
  on screen (the source's tiles still named the old file). Fixed by replacing the source per date.
- A late answer for an earlier date, after the 5 s wait for the source, still landed (a 6.5 s delay
  in the browser: the source drew the earlier date while the stepper named the last). Same fix.
- While a date loaded, nothing said that the picture on screen was still the previous date's. Now the
  loading note, and no previous picture after 5 s. (The note's 400 ms delay still left that window
  unlabelled; the tag on the map, added after the review of PR 1, closes it.)
- The "At a point" panel, a polite live region, announced "Reading values…" and the new reading on
  every step while playing. Its `aria-live` is now off while playing.
- Previous on the first date (and Next on the last) did not stop playback, as the arrow keys do. A
  press there now stops it.
- `play=1` read once was not pinned: deleting `autoplayPending.current = false` in `App.tsx` passed
  every test. A browser test now pauses, changes layer and date, and fails with that line deleted.
- A static layer's link carrying no date was not pinned (the fixture's static item has no date).
  Now a unit test.
- Not changed: the static-layer test's "the arrow keys do nothing" holds by construction (a static
  layer has no timeline, and `stepDate` on an empty timeline is -1), so no mutation short of building
  a timeline for it could change it. The Pause test's timing margin did not fail in 32 runs of a copy
  under 4x and 6x CPU throttling, nor in the three full runs.

### Left

- Items 6 to 9 (overlay, bars, guided tour, swipe), for other agents.
- The inspect panel on a static layer shows the history of the site's first stack (`stackFor` falls
  back to `stacks[0]`, here the HH layer's), labelled with that layer's title. It was so before; the
  build session may prefer no history for a class layer.

## Item 6: the overlay

Commits `2e28c3c` (fixture), `5b3a13b` (logic), `7b96ecf` (app), `054af59` and `b01a258` (browser tests). No change
to the contract was made; one thing it lacks is under "Needed from the data side".

### Done

- **The switch.** After the layer's controls, a group "Data from other sources" with one native
  checkbox (`role="switch"`) per overlay of the site, labelled with its title and its dot; nothing
  when the site has none. Space toggles it, the app's focus ring, 44 px tall on phones (the whole row
  is the label). Every overlay is off by default.
- **State and link.** The switched-on overlays are `Selection.overlays` (in the site's order) and
  `overlays=<id>,<id>` in the link (commas left readable; absent when none is on). Unknown ids are
  dropped; another layer keeps them; another place clears them.
- **Loading.** `contract/overlay.ts` fetches the file the first time an overlay is switched on
  (`components/useOverlayFiles.ts` keeps it for the session), checks it is a FeatureCollection, keeps
  the Points with two finite coordinates (an elevation may follow) and counts the rest. Errors are
  sentences ("Could not load the file of this overlay (HTTP 404), so nothing is drawn."). A failed
  file shows its reason next to the switch (`role="alert"`), draws nothing and shows no count; it is
  fetched again whenever its overlay is switched on afresh (off and on, also when the failure came
  while it was off, or after another place and back), never on a change of layer or date with the
  overlay on. While it loads, the captions say "Loading <title>…".
- **Which points** (`state/overlayPeriod.ts`, pure). UTC days compared as YYYY-MM-DD text, both ends
  included. Per-date layer: the date to the day before the next date THAT layer has (the HV layer,
  which lacks a date, gets longer periods there); its last date: to the end of `date_range` (open
  ended without one). Pair: reference to the day before the secondary. Static layer or no
  `date_property`: every point, the period named being `date_range`. Then against `date_range`:
  wholly outside, "<title>: no data for <period> (this overlay covers <range>)", never a number;
  partly outside, the part inside with the reason ("This overlay's data start on ..." / "end on ...",
  both when both); inside, "<title>, <period>: <count>"; an empty period inside the range reads 0.
  Without `date_range`: the count and "The file does not say which dates it covers." A point whose
  date is missing or not a real YYYY-MM-DD day is never drawn in a dated period; the legend says how
  many are left out. The period words come from one formatter with no locale ("4 to 14 November
  2026", "28 October to 8 November 2026", "28 December 2025 to 8 January 2026").
- **One window, one count.** `state/overlayView.ts` builds, per overlay, the window, the points drawn
  and the caption; the map filter (`map/overlayLayers.ts`, `overlayFilter`) is built from the same
  window. The app gives each point on the map a property `app:day` holding its checked day (absent
  when invalid; a property of that name in the file is dropped), and the filter compares that, so a malformed date can never slip into a string
  comparison. A unit test runs MapLibre's own filter evaluator on the filter and compares with
  `pointInWindow`; the browser tests count the source's features that pass the layer's filter.
- **Drawing.** `map/overlayLayers.ts` (`OverlayController`, MapLibre only through the map instance):
  one GeoJSON source (`attribution` = the overlay's credit) and one circle layer per overlay that is
  on; `overlay.color` or `DEFAULT_OVERLAY_COLOR` (`#c000ff`, checked against the grey ramps for three
  visions and as neither grey, red nor green), a dark outline, radius 4 px at zoom 6 to 6.5 px at
  zoom 14, no transitions. A new date only changes the filter.
- **Order of the map's layers.** `map/layerOrder.ts` is the one place that says where a layer goes:
  rasters before the first overlay circle layer (else before the first label), circles before the
  first label. `DataLayerController` uses it for every raster it adds, so the fresh raster of each
  date on a layer with more than 12 dates stays under the circles.
- **Saying what it is.** On the map, top left (in a column with the "Loading the picture" note under
  it, so neither moves the other or touches the zoom buttons, the scale or the credit line, on a
  phone too): for each overlay on, its dot and the caption, then "From another
  source, not a NISAR measurement. A dot marks a reported location; its size on screen is not a size
  on the ground." Not a live region, and `aria-hidden` (the side caption and the legend say the same,
  so nothing is read twice). On a short window in the stacked layout (`NOTES_UNDER_MAP_QUERY` in
  `components/useMediaQuery.ts`: max-width 760 px and max-height 500 px, a phone held sideways or
  a desktop zoomed to 200%) the box and the loading note go in a strip the width of the map right
  under it instead, so nothing is cut off (since the second review the box goes there on a phone
  of any height: see "Second review of items 6 and 7"). Under each switch the same caption, `aria-live` polite,
  off while the dates play; it stays rendered while empty (never `display: none`), so its first
  words are announced. In the legend, for each overlay on: dot, title, description, the same
  sentence, "Dates are UTC days." when dated, undated points left out, features that are not points,
  the method and the credit. Nothing about a particular overlay is written in the app.
- **Reading a point.** A click and "Read values at the map centre" also look for the nearest DRAWN
  point (on, and inside the period) within 12 screen pixels (`map/nearestPoint.ts`, pure: Web
  Mercator pixels at the zoom of the click, the short way round the 180th meridian, first in file
  order on a tie). That equals the distance on screen only on a flat map, so the map cannot be
  tilted (`maxPitch: 0` in `MapView.tsx`); it can still be rotated, which keeps distances. The "At a point" panel then shows, under the layer's value, a block titled with
  the overlay's title listing its fields in the manifest's order (label, value and unit); a missing
  property reads "not available", a 0 stays 0; with several points within reach it says how many and
  that the nearest is shown. The block follows the date (a point not drawn on the new date is not
  read). The layer's own readout is unchanged.
- **A place with no layers yet** still shows the switches (after the "no layers yet" note) and,
  for the overlays that are on, the legend entries under the heading "Data from other sources".
- **Fixture.** One point (`POINT_LACKING_FIELD`, 2026-09-24) lacks `syn_power`. The overlay's credit
  was a substring of the site's citation, which MapLibre's credit line folds away; it now has its
  own words, and `fixture-rules.test.ts` keeps the two apart.

### Tests added

- vitest: `tests/unit/overlayPeriod.test.ts` (26: days, the formatter, every period case on the
  fixture's dates and on hand-made layers, inclusive ends, undated points),
  `tests/unit/overlay.test.ts` (25: the loader and its errors, the nearest-point search, the layer
  order, the filter against MapLibre's evaluator, the controller with a fake map, the view and a
  point's fields), `tests/unit/overlayComponents.test.ts` (15: the switch group, live regions, the
  alert, the map caption, the legend entry, the point block), `urlState.test.ts` (+6),
  `colours.test.ts` (+7 for the default colour), `fixture-rules.test.ts` (the point lacking a field,
  the credit apart from the citation).
- Playwright: `e2e/overlay.spec.ts` (17 tests), listed in commit `054af59`.
- Checked that the order test fails without `layerOrder.ts`: with the raster placed before the
  first label as before, "every raster under the circles" failed.

### Verified by running (item 6)

- `node scripts/tasks.mjs check`: passed (pytest 299, vitest 285 in 20 files, contract types,
  validate, size budget). `node scripts/tasks.mjs e2e --trace off`: 68 passed (the 51 before and 17
  new) in 2.3 min, twice (after the last test change too).
- In Chrome on the fixture site at 1280 px: off, no dots and no credit; on at 2026-10-15, 66 violet
  dots with dark rims on the radar, the caption box top left with "SYNTHETIC points, 15 to 26 October
  2026: 66", the credit and the sentence (the credit has since left the box: see "Real-length
  texts"), the credit in the map's credit line, the same caption under
  the switch, the legend entry; at 2026-08-28 "no data for 28 August to 8 September 2026 (this
  overlay covers 15 September to 18 November 2026)" and no dots; on the class layer all 289 dots,
  readable on all five class colours; a click on the point lacking a field: "2 points of this overlay
  are within reach; the nearest is shown." and "SYNTHETIC power: not available".
- At 375 px: the caption box clear of the zoom buttons, the scale and the credit line; the switch row
  44 px; the clipped caption of 2026-09-09; a 404 shows the red reason under the switch and no
  count. No console errors apart from the deliberate 404.

### Decisions and why (item 6)

- ~~The credit is also in the caption box on the map~~ (changed, see "Real-length texts": the real
  credit is 336 characters, and the box with it covered the map on a phone).
- **The caption box sits top left, above the loading note** in one column: the bottom left would run
  into the credit line, which spans the width on a phone, and above the note the box does not jump
  when the note comes and goes while playing.
- **On a short window the notes go under the map, not on it.** At 667 x 375 the map is about 130 px
  tall and MapLibre's expanded credit line covers half of it, so the box scrolled and the sentence
  about what a dot is fell out of a picture of the map. The strip is outside the map, so the map
  keeps its height and the 7rem of panels below it, and a finger on the strip scrolls the page.
- **The fixed sentence is the app's own and the same for every overlay**; what one point is (for the
  real data, one 375 m pixel at the time of the satellite pass) must come from the overlay's
  `description`.
- **A failed file is retried when its overlay is switched on afresh**, not on a layer or date
  change with it on, so stepping through the dates does not fetch a missing file again and again.
- **`app:day` on the map's copy of each point** instead of filtering on the date property itself:
  MapLibre expressions cannot check a date's format, and a malformed date compared as text could
  land in a period.
- **Overlay ids in the link are kept in the site's order**, so a link does not depend on the order
  the switches were pressed in.

### Left (item 6)

- The map cannot draw a point's footprint (see below): the dots are a fixed size on screen.
- ~~On a phone the caption box and MapLibre's expanded credit line together cover about half of the
  short map~~ (fixed for real-length texts, see "Real-length texts").
- Two overlays without a `color` get the same default dot, and two with colours differ by colour
  only (every circle has the same size, outline and shape). The task fixed one default colour and
  the real site has one overlay; a site with several should give each its own `color` (see "Needed
  from the data side").

## Item 7: bars

Commits `7f5f7bd` (logic), `6ec0f9b` (app), `9e9991b` (browser tests). No change to the contract or
the fixture was needed.

### Done

- **Where.** In the Statistics panel, after the series charts, one figure per entry of `bars`,
  whatever layer is selected (the panel does not depend on the layer). A site without bars shows
  nothing extra. "No statistics for this place yet." shows only when there are neither series nor
  bars (`hasNoStatistics` in `StatsPanel.tsx`).
- **What.** Caption: the title and the unit. Then a list (`<ul role="list">`), one item per category
  in the file's order: the label (with its class's swatch when the entry's `layer` is a categorical
  layer of the site and the category's `class` is one of its classes; the same rimmed `.swatch` as
  the legend, `aria-hidden`), the drawing, the numbers as text ("0.087 points per km2 (0.069 to
  0.105), n = 93") and the note. Below the list: "Method: ..." and "Region: ...".
- **The drawing** (`BarsFigure.tsx`, positions from `barGeometry.ts`): a bar from zero on one scale
  for the entry (since the second review, one scale for all the entries of one unit and layer,
  written in words too: see "Second review of items 6 and 7"), a whisker from low to high only when both are numbers (2 px dark ink, 10 px end
  caps, over the bar), a 1 px zero line in every drawn row, and the scale's 0 and end value written
  above the rows. The scale runs from 0 (or from a round number at or below the most negative value
  or low) to a round number at or above the largest value or high (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8
  times a power of ten; the fixture's 0.19 gives 0.2). Only what is drawn counts for the scale: a
  null row's low and high, and a lone low or high, do not stretch it.
- **Null and zero.** A null value reads "not available" and its row draws nothing: no bar, no
  whisker, not even the zero line (a lone line could read as a bar of no length), and writes no
  interval even when the file gives `low` and `high` (an interval is the uncertainty of a value);
  its `n` and note stay. A 0 reads "0 points per km2" and gets a 2 px dark tick on the zero line,
  the height of the row, with its whisker: it reaches 1.5 px past zero, less than the thinnest bar
  (2 px), so a 0 never looks longer than a small positive value.
- **Look.** One bar colour, `--bar` `#7289ab` (slate blue, neither red nor green): 3.6:1 on the
  panel and 4.6:1 under the dark whisker (`colours.test.ts`). Every line is a border, so a contrast
  theme (forced colours drops backgrounds) still draws the bar as an outlined box with the whisker,
  caps and zero line in the theme's text colour. No animation or transition.
- **Layout.** Desktop: a grid per row, the label on the left (2 fr), the drawing, numbers and note on
  the right (3 fr). At phone width (the app's `max-width: 760px` query) each row stacks: label,
  drawing, numbers, note, the drawing full width. No horizontal overflow at 375 px.
- **Accessible.** The scale and every row's drawing are `aria-hidden`; every number is in the text.
  Reading order per item: label, value, interval, n, note, with visually hidden ": " after the label
  and ". Note: " before the note so a screen reader does not run them together.
- **Numbers** (`numberText.ts`, `formatNumber`): three significant digits, trailing zeros trimmed,
  the integer part never rounded away (12345 stays 12345), no exponent for ordinary values (only
  below 1e-6, where zeros would be worse), no locale. 0.0123 stays 0.0123. The interval has no unit
  (the value before it has it). A lone `low` or `high` is still written ("(lower end 0.5)"), so no
  number of the file is hidden, but draws no whisker (except beside a null value, see above).
- **Loader.** `loadStats` checks `bars` when present: an array; every entry an object with a
  non-empty array of categories; every category an object with a text `label` and a `value` that is
  a number or null. Otherwise its usual sentence.

### Tests added

- vitest: `tests/unit/barGeometry.test.ts` (35: the formatter, `niceCeiling`, the shared scale, null,
  zero, missing low or high, low and high beyond the value or swapped, negative values, all negative,
  every value null, every value 0, the row texts, `classColour`, `loadStats` with ten broken shapes),
  `tests/unit/barsFigure.test.ts` (12: rows in order, the reading order, the drawing hidden, the null
  and zero rows, the row without an interval, the scale's labels, no swatch without the layer, every
  value null, bars after the series, "No statistics" only with neither), `colours.test.ts` (+3: the
  bar colour's contrast and hue, every line a border), `components.test.ts` (StatsPanel takes the
  site's layers).
- Playwright: `e2e/bars.spec.ts` (13): the rows with the numbers of `buildYearStats()` in reading
  order; the null row (text, note, nothing drawn); the zero row's mark on the zero line; bar ends and
  whisker ends measured on screen against the scale's end value, no whisker for the row without low
  and high; the drawing `aria-hidden` and not animated; method and region below the list; swatches in
  the class colours with their rim; a contrast theme (`forcedColors: 'active'`) still draws the bar,
  whisker and zero line; the bars on every layer of the site; none on `synthetic-test` (series, no
  bars, no "No statistics"); at 375 px the rows stack with nothing sticking out; on a desktop the
  label sits beside its bar.
- Checked that browser tests fail without the behaviour: with the phone rule removed, the 375 px
  test failed; with the bar's border removed, the contrast-theme test failed (the other 11 passed).

### Verified by running (item 7)

- `node scripts/tasks.mjs check`: passed (ruff, eslint and tsc, pytest, vitest, contract types,
  validate, size budget). `node scripts/tasks.mjs e2e --trace off`: 81 passed (the 68 before and 13
  new) in 2.3 min.
- In Chrome on the fixture site at 1280 px: the figure under the two series charts, "0" and "0.2"
  above the rows, the five rows with their class swatches (the yellow and pink ones visible thanks to
  the rim), the zero row as a small box on the zero line with its short whisker to 0.008, the two
  long bars with whiskers that pass beyond their ends, the "not darkened" row with a short bar and no
  whisker, the null row with "not available" and its note and nothing drawn, then the method and the
  region. Labels wrap to three or four lines in the 360 px side panel. Under emulated forced colours:
  white bars with black outlines, black whiskers and caps, swatches still in their colours.
- At 375 px: each row stacked (label, full-width bar, numbers, note), `scrollWidth` 375, no console
  errors. `synthetic-test` (series only): its chart and nothing else in the panel.

### Decisions and why (item 7)

- **Three significant digits.** Enough for a rate with an uncertainty interval (the fixture's
  values print exactly as the file has them), and it keeps 0.0123 as 0.0123. LineChart's
  `toFixed(2)` and the readout's encoding-based decimals would both turn 0.0123 into 0.01, so they
  were not reused; `fieldText` (overlay readout) writes `String(value)`, which shows float noise
  such as 0.30000000000000004. LineChart was left as it is.
- **Round scale ends from a fixed list (1, 1.5, ... 8 times a power of ten)** rather than LineChart's
  1, 2, 5, 10: a scale end of 0.15 instead of 0.2 for a maximum of 0.105 uses the width better, and
  every step is still a number a person can read.
- **A negative scale start is rounded too**, so both ends read as round numbers; zero is then written
  between them.
- **Nothing drawn for a null row**, not even the zero line. **A lone low or high is written but not
  drawn**, since a whisker with one end would claim an interval the file does not give.
- **Desktop rows side by side, phone rows stacked**, by the app's existing viewport query rather than
  a container query: the side panel on a desktop (360 px) is about as wide as a phone's, so a
  container query could not tell them apart, and the brief asks for side by side only on the phone.

### Left (item 7)

- Long class labels wrap to three or four lines in the 360 px desktop panel. Shorter labels in the
  real classes help; the real data's labels are the build session's.
- The axis does not avoid overlapping labels when zero lies very near (but not at) an end of a scale
  with negative values; no such data is expected.

## Review fixes (items 6 and 7)

Two reviews of items 6 and 7, checked by running (15 findings, two of them twice). Each fix has a
test that failed on the code before it; the commits are `fcc1b1c` to `6abdd43`.

- Fixed: the side caption's live region was `display: none` while empty (the test checks it stays
  rendered); the map's caption box was read by screen readers as well as the side caption and the
  legend (now `aria-hidden`; the test counts the caption and the sentence once each in the page's
  accessibility tree); a file property named `app:day` let the map draw an undated point the caption
  did not count (unit test with MapLibre's filter evaluator); a failed file was not fetched again
  when it failed while its overlay was off, or after another place and back (two browser tests,
  and one that a layer or date change still does not fetch it); the map could be tilted to 60
  degrees, which breaks the 12 px point search (browser test: right drag, Ctrl drag, Shift+Up);
  on a 667 x 375 phone the caption box scrolled and cut off the sentence (browser test on the
  clipped date, with and without the loading note); a place with overlays but no layers had no
  switch and no legend entry (browser test with the layers taken out of the manifest); a null bar
  value printed its low-to-high interval (unit test); the mark of a 0 reached further past zero
  than a small bar (browser test with a value a thousandth of the scale).
- Not changed: the empty-period browser test was said to pass before the overlay's data had
  loaded; with the filter broken for that one period it failed in every run, also under 4x, 8x and
  16x CPU throttling, because the map has loaded the data before the first sample. Two overlays
  without a colour share the default dot: the task fixed one default colour, the real site has one
  overlay, and the data side is asked to give each overlay its colour (above).

## Real-length texts: the overlay and the bars with the fire stage's texts

The real overlay and bars come from `pipeline/fires.py` (read, not edited). Their texts are far longer
than the fixture's: the overlay's credit 336 characters, description 346, method 467; three bars
entries, each with a title of 90, a method of 1,153, a region of 375 to 470 and a note on every
category. With them, at 375 x 740 the caption box (236 px) and the expanded credit line (224 px)
covered the whole 407 px map, and the Statistics panel repeated three 1,100-character methods. No
change to the contract or the fixture module was needed.

### Done

- **A1. Tests that see real lengths.** `e2e/realLengths.ts`: `REAL_TEXT_LENGTHS` (each length with
  where it comes from in `pipeline/fires.py`; the site citation's 97 from tarn-taran's `site.json`),
  `realLengthTexts()` and `serveRealLengthTexts(page)`, which serves the fixture's `manifest.json`
  (the year site's overlay title, description, method and credit, and its citation) and the year
  site's `stats.json` (three bars entries, ids `syn-points-per-class-long-1` to `-3`, with long
  titles, methods and regions and a note on every category) by `page.route`. Every text starts with
  its own SYNTHETIC words and is filled with numbered "SYNTHETIC filler sentence" lines; a test
  checks each is at least the real length, says SYNTHETIC, and names none of VIIRS, FIRMS, NASA,
  LANCE, ESDIS, Garwood or harvest. The fixture module is unchanged.
- **A2. The caption box holds the dot, the caption and the fixed sentence, nothing else.** The
  credit is still shown wherever the overlay is drawn: in the map's credit line (the source's
  attribution) and in full in the legend's overlay entry, as the radar's credit is
  (`components/Overlays.tsx`, `.overlay-map-credit` gone from `styles.css`).
- **A3. The credit line on a narrow or short map.** MapLibre 6.18
  (`src/ui/control/attribution_control.ts`) turns to its compact line when the map's canvas
  container is 640 px wide or less, or always with `compact: true`, which `MapView.tsx` sets: so the
  app has the compact line at every width. It is a `<details>`, expanded (`maplibregl-compact-show`)
  when the map loads, folded on the first `drag` and toggled by its (i) button. `styles.css` makes
  `.map-wrap` a size container and, `@container (width <= 640px) or (height <= 400px)`, gives the
  expanded line's `.maplibregl-ctrl-attrib-inner` a `max-height` of `35cqh` less the line's 4 px of
  padding, `overflow-y: auto` and `overscroll-behavior: contain`. MapLibre lists the shortest credit
  first, so the site's own credit is at the top, in view. A wide map of ordinary height (1280 x 800)
  is unchanged (no max-height, nothing scrolls), as is the app's focus ring on the (i) button.
- **A4. A bars figure's method folds.** After the rows, the region as before, then a native
  `<details>` (closed) whose `<summary>` reads "How these numbers and their intervals were computed"
  (`METHOD_SUMMARY` in `BarsFigure.tsx`) and whose content is the method. Native Enter and Space,
  the app's focus ring, 44 px tall on phones (`min-height` and 11 px padding in the touch media
  query), the theme's text colour in a contrast theme. Nothing else of the figure changed.

### Tests added or changed

- vitest: `overlayComponents.test.ts` (the box has no credit, no description, two lines);
  `barsFigure.test.ts` (region after the rows, then the closed `<details>` with the summary and
  the method, written once).
- Playwright: `e2e/real-lengths.spec.ts` (5): the texts' lengths and wording; 1280 x 800 (box at
  most 20 % of the map, no credit in it, the credit in the legend, the credit line uncapped); 375 x
  740 right after loading a link with the overlay on (box at most 40 %, credit line at most 35 %,
  apart, at least a quarter of the map's height covered by neither, the inner list scrolling with
  the site credit in view); folded and reopened with its button (still 35 %, the focus ring on the
  button); 667 x 375 (the strip under the map shows both its lines, and the credit line keeps to
  35 % of the short map). `bars.spec.ts` (+5, one replaced): the region then the closed disclosure;
  on the three long entries, hidden until the summary is clicked and hidden again on a second
  click; with the keyboard (Tab from summary to summary, the ring, Enter opens, Space closes); the
  panel much shorter closed than open; a contrast theme; 44 px summaries at 375 px.
  `overlay.spec.ts`: the box no longer contains the credit.
- Checked that they fail without the behaviour: with the credit back in the box and the cap and
  the 44 px rule taken out, 5 browser tests failed (at 375 x 740 the box measured 236 px and the
  credit line 224 px, the numbers the main session measured, 20 px of the map left clear); with only
  the cap taken out, the two 375 tests and the 667 test failed (credit line 224 and 124 px).

### Measured (production build, fixture site, real-length texts, Chrome)

Right after loading `?site=synthetic-year&layer=syn-hh&date=2026-09-09&overlays=syn-points` (the
longest caption: the period clipped by the start of the overlay's range):

| Viewport | Map height | Caption box (w x h) | Credit line (w x h) | Clear of both |
|---|---|---|---|---|
| 1280 x 800 | 684 px | 390 x 94 px (14 %) | 900 x 84 px (12 %), unchanged | |
| 375 x 740 | 407 px | 305 x 110 px (27 %); now in the strip under the map (second review) | 355 x 142 px (35 %) | 155 px (38 %) |
| 667 x 375 | 132 px | in the strip under the map: 647 x 78 px (strip 91 px) | 647 x 46 px (35 %; 124 px before) | |

Statistics panel with the three long entries: 3,435 px closed and 5,090 px open at 1280 px (the
three methods 1,643 px); 3,446 px closed and 4,926 px open at 375 px. The main session measured
about 4,400 px before, with its own scratch texts.

### Verified by running

- `node scripts/tasks.mjs check`: passed (ruff, eslint and tsc, pytest 502, vitest 337 in 22 files,
  contract types, validate, size budget). `node scripts/tasks.mjs e2e --trace off`: 98 passed in
  2.3 min, no test failed or retried.
- Looked at the fixture site with the real-length texts in Chrome: at 1280 px the box top left
  (the caption in three lines, the sentence in two, no credit), the credit line along the bottom in
  four lines with the site citation first; at 375 px the box (caption three lines, sentence three),
  the dots visible between it and the credit
  line, the credit line cut at 35 % with the citation, the basemap credit and the start of the
  overlay credit in view, and after its (i) button only the button; at 667 x 375 the box in the
  strip under the map and the credit line in two and a half lines (it still overlaps the lower zoom
  button and the scale on that 132 px map, as the uncapped line did, more so); the folded method
  ("▶ How these numbers and their intervals were computed") under the region, and opened by Enter
  with the amber focus ring, at 1280 and 375 px. No console errors.

### Decisions and why

- **The cap also applies to a short map (400 px or less), not only a narrow one.** The task asked
  for the cap where MapLibre shows its compact line and the line unchanged on a wide map; at 667 x
  375 the map is 667 px wide and 132 px tall, and the uncapped line took 124 px of it. A wide map of
  ordinary height keeps the line as MapLibre draws it (pinned at 1280 x 800).
- **640 px**, MapLibre's own width for the compact line, rather than the app's 760 px layout
  query: a container query on the map's own size also catches a narrow map beside the side panel.
- **The credit leaves the box** (the main session's call in the task): the legend carries it in
  full and the credit line carries it whenever the overlay is drawn; after the first drag of the
  map the line folds, so a screenshot taken after a drag shows the credit only behind the (i)
  button, as it shows the radar's. That holds for an overlay switched on after the drag too (by its
  switch or by a tour step): MapLibre expands the line only once, so its new credit is added folded.
- **The method's summary text is the app's** (not from the manifest): it names what the method of
  any bars entry holds.

### Left

- The scrolling part of the credit line is not a tab stop of its own (MapLibre's element); the
  legend carries every credit in full for keyboard users.
- ~~Found while looking, not fixed (outside this task): at 1280 x 800 the document itself scrolls to
  about 2,400 px, because `.side` is not positioned and the bars rows' visually hidden spans
  (`position: absolute`) take the page as their containing block.~~ Fixed after the review of PR 1
  (`.side { position: relative }`), which found the same with the playback status line on a phone.
- The Statistics panel is still about 3,400 px tall with the three long entries closed: the regions
  (about 470 characters each) and the notes are written in full, as the task asked.

## Item 8: the guided tour

> **Replaced.** This tour (pull request 4) was replaced by the guided story of
> `docs/MOTION_AND_STORY_BRIEF.md`, in `web/src/story/`; its rules and what was kept from the tour
> are in `web/MOTION.md`. The tour's code (`src/state/story.ts`, `src/components/StoryPanel.tsx`, the
> `step` parameter, MapView's `viewRequest`) and its tests are gone; the cases still true under the
> brief were ported to `tests/unit/storyModel.test.ts` and `e2e/story.spec.ts`. What follows, and the
> review fixes below, are the record of the tour as it was built.

Written 15 November 2026. The design (B1 to B10) was decided by the main session; this records what
was built against it.

### Done

- **State and link.** `src/state/story.ts` holds every rule as a plain function: the steps of a site
  (`storySteps`; a step without a text id, title or text is skipped, a `story` that is not a list is
  none), `findStep`, `stepPosition` ("Step 2 of 4"), `neighbourStep` (Next and Back), `returnStep`
  (the step left, else the first), `stepView` (a step's view made safe for the map, as a link's is),
  `applyStep`, `openLink` (what a link means), `storyParagraphs` and `stepAnnouncement`.
  `UrlState` gained `step`, written right after `site` and only while the
  tour is on; a step the story lacks, or a place without a story, means no tour and the parameter is
  dropped from the link.
- **When the tour starts by itself.** A link with no layer, date, pair, overlays or step, on a place
  with a story, opens its first step (a place and a view may be named). Choosing a place does the same
  (`selectSite` calls `openLink` with only that place). A place without a story behaves as before.
- **What a link with a step means.** Only a step (and perhaps a place or a view): the step applied in
  full. A step and any of layer, date, pair or overlays: exactly that selection, with the step's panel
  open. A view in the link always wins; without one, the step's view.
- **Applying a step** (Next, Back, coming back in, the start by itself, a link with only a step): the
  layer; for a per-date layer the step's date, else the date on screen if the layer has it, else the
  latest; for a pair layer the step's pair, else the latest pair; a static layer has no date; a step
  without a layer keeps layer and date; exactly the step's overlays; the step's view (a glide, a jump
  under reduced motion; without a view the map stays); playback stops. A part the manifest lacks keeps
  what is selected: an unknown layer keeps layer and date, an unknown date the date on screen (else
  the latest), an unknown pair the pair on screen (else the default), an unknown overlay id is left out.
- **While a step is shown** every control stays live; the panel stays and `step` stays in the link
  beside whatever the person changed.
- **The panel** (`src/components/StoryPanel.tsx`), first in the side column: a region named "Guided
  tour" with "Step n of N", the title as an `h2`, the text as paragraphs
  (blank lines), and Back, Next (`aria-disabled` at the ends, still focusable) and Explore freely.
  Explore freely takes `step` out of the link and changes nothing else; the panel becomes one button,
  "Guided tour", which comes back in at the step left and applies it. Focus: Back and Next keep it;
  Explore freely hands it to "Guided tour", and "Guided tour" hands it to Next. One visually hidden
  polite live region says the step's count, title and text once after Next, Back or coming
  back in; it is empty on opening, cleared on leaving, and never changes while the dates play. All
  texts from the manifest are React text, never HTML.
- **The map.** MapView takes a `viewRequest` (a new object per step applied) and calls `flyTo` or
  `jumpTo`. `flyTo` is marked `essential: true`, so whether it glides is App's choice
  (`prefersReducedMotion()` at the press), not MapLibre's own reduced-motion rule. The first view on
  opening a link goes through the existing `initialView` path (a jump), now set from `openLink`.
- **Phones.** On a 375 or 320 px phone the panel sits right under the map, before the place and layer
  controls; its buttons are 44 px tall (the existing touch rule) and wrap at 320 px; nothing overflows.
- The stub `src/extensions/storyMode.ts` is removed; `README.md` says where the tour's code lives.

### Tests added

- `tests/unit/story.test.ts` (41 tests): every rule above, including the link cases (nothing, only a
  place or a view, a selection, only a step, a step and a view, a step and a selection, a step the
  story lacks, a place without a story, no places), the fallbacks for a layer, date, pair or overlay
  the manifest lacks, a pair layer (on the second fixture site), the URL round trip of `step` and its
  removal, the paragraphs and the announcement, and the panel's markup (region name, count, heading,
  `aria-disabled` at both ends, the collapsed button, one polite live
  region, texts escaped).
- `e2e/tour.spec.ts` (20 tests at first, 23 after the review fixes below; fixture year site, production build): the start by itself (with no
  link, with only a place and view, on choosing the place) and when it does not happen (a layer, a
  date, overlays, an unknown step, a place without a story); Next and Back setting layer, date,
  overlays and view, the map's centre and zoom ending where the step says, a glide (timed, see the review
  fixes below), and
  a step without a view leaving the map; a single move under reduced motion for the same step change;
  controls live during a step (date, overlay, Play); Back and Next stopping playback (review fixes); Explore freely and
  coming back in; coming back in after another place; a link with only a step; a link with a step, a
  selection and a view; a copied link; keyboard operation, focus
  and the focus ring; the live region after Next and during play; the layout at 375 and 320 px.
- Checked that they fail without the behaviour: with `flyTo` always (ignoring reduced motion) the
  reduced-motion test fails (8 moves instead of 1); with the focus hand-over removed, the keyboard
  and Explore freely tests fail. Before `essential: true` the reduced-motion test passed without the
  app's choice, because MapLibre's own flyTo jumps under reduced motion; hence `essential: true`.

### Changes to the existing browser tests

None. Every test that opens the fixture with no layer in the link now starts in the tour, but the
fixture's first step names the default layer (`syn-hh`) and no date, so it shows the same layer,
latest date, no overlays and the framed place as before: each test still checks what it was about
(all 98 earlier tests passed unchanged with the tour in). The README says what to do should a test
need to be outside the tour: give its link a layer.

### Verified by running

- `node scripts/tasks.mjs check`: passed (ruff, web lint, pytest 502 passed, vitest 378 passed in 23
  files, contract types up to date, validate, size budget).
- `node scripts/tasks.mjs e2e --trace off`: 118 passed (98 earlier, 20 new), in one run, no retry.
- Looked at the production build on the fixture site in Chrome (screenshots, not committed): at 1280 x
  800 step 1 opens by itself with "Step 1 of 4" and Back faded; Next glides to step
  2's mid-year date; step 3 (the class map) has its layer's static note; step 4
  shows the cross-pol layer on 2026-11-08 with the violet points and their caption, and Next faded;
  Explore freely leaves one "Guided tour" button with the amber focus ring on it and the same map; the
  keyboard ring shows on Next after Tab. At 375 x 812 the panel sits right under the map's credit line
  and above "Place"; at 320 x 640 Explore freely wraps to its own line, nothing overflows sideways
  (scrollWidth equals the window). No console errors.

### Decisions and why

- **An unknown step does not start the tour by itself.** The link names a step, so the B2 start does
  not apply, and B1 says such a link means no tour; the person sees the place as with no step.
- **A link with a step and a selection but no view takes the step's view.** B3 makes the link's
  selection exact; the view is not part of the selection, and a hand-made link such as
  `?step=x&layer=y` is then framed where the step looks. A copied link always carries a view, which
  wins.
- **Unknown overlay ids are left out, the rest of the step's list is applied** (rather than keeping
  the overlays on screen): a typo in one id would otherwise leave unrelated overlays on.
- **Coming back in announces the step and puts focus on Next**: the button pressed disappears, Next
  is where a reader continues, and the live region (not a focused heading) says the step once, so it
  is not read twice.
- **Coming back in at the step left**, as B6 asks, even if the person changed place since; a new
  place starts its own tour at its first step, so "left" is reset with it.
- **The count is the app's own text**; the title and the text come from the manifest.

### Left

- The tour is first in the side column on a desktop too, so the place and layer controls start lower
  (about 230 px at 1280 x 800 with the fixture's short texts). Real texts of a few sentences push them
  further; the side column scrolls.
- With a step whose view is far from the place's framing, choosing that place glides from the framing
  to the step's view; only the fixture's first step (no view) is tested on a place change.
- Item 9 (swipe) is not started.

## Review fixes (real-length texts and item 8)

> The tour these fixes are about was replaced by the story in `web/src/story/` (see `web/MOTION.md`).
> Kept from them: the fixture guard in `e2e/support.ts`, the forced-colours rule for an unavailable
> button (its test is now in `e2e/accessibility.spec.ts`), and the page-scroll tests in
> `e2e/bars.spec.ts`.

Two reviewers read the real-length and tour changes without running the browser tests. Each finding
was reproduced first (a mutation, a script or a screenshot), then fixed or left with a reason.

- **Fixed: Back and Next stopping playback was not pinned.** The old check pressed Next to the static
  class layer and Back again; the new layer alone gave playback a new timeline, so the test passed
  with `stopPlayback()` removed from `showStep` (ran it: it passed). Two tests now press Back (step 2
  to 1) and Next (1 to 2) while the dates play, steps with the same layer, and check that Play is shown
  and the date stays put for 2 s; with `stopPlayback()` removed both fail ("Pause" shown).
- **Fixed: the glide check counted frames.** It asked for more than 3 move events; with a CPU throttle
  on Chrome's software WebGL the same glide gave 10 moves at full speed, 7 at 8x and 4 at 16x, while it
  lasted about 400 ms at every throttle. It now times movestart to moveend: over 150 ms for the glide,
  under 50 ms for the jump under reduced motion. With `animate: false` forced, the glide test fails
  (6 ms).
- **Fixed: in a forced-colours theme an unavailable button looked available.** Under
  `forcedColors: 'active'` Back on step 1, Next and Back had the same computed colours (black text and
  border on white). `button[aria-disabled='true']` now takes `GrayText` there (Back and Next of the
  tour, the date stepper's ends). A browser test compares them with an available button and fails
  without the rule.
- **Fixed: a flaky guard.** In one of three full runs, overlay.spec.ts's "an unknown id is dropped"
  failed with "the manifest is not a JSON object"; it failed again once in 15 repeats alone. The cause
  (shown with a throwaway script): the browser drops the body of a response the page navigated away
  from before it was read, and the guard in `e2e/support.ts` took an unread body for a manifest that
  is not JSON. The guard now reads what the server serves at that URL instead. Since then: 30 repeats
  of that test and three full runs in a row (121 tests each) passed (the fallback path itself is expected to work; no run hit it
  on purpose).
- **Not changed, the note made exact: after the first drag the overlay's credit is folded.**
  Reproduced: drag the map, then switch the overlay on; the credit line has `maplibregl-compact`
  without `maplibregl-compact-show` and the box has no credit. That is MapLibre's compact line, the
  same for the radar's credit, and the main session's call in task A; the legend carries the credit in
  full. Re-expanding the line whenever an overlay is switched on is a decision for the main session.
- **Not changed, recorded: after Next or Back other polite live regions speak too.** Reproduced:
  after Next the date stepper's output (the new date) is polite and changes in the same render as the
  tour's announcement; on the step that turns the overlay on, the side caption fills as its file loads.
  The step itself is said once, by the tour's one live region, as B6 asks; the others say what changed
  on screen, which the step's text may not. Quieting them for one render would not cover the caption,
  which fills later when the overlay file arrives, and a region switched back on in the same render as
  its change may not be read at all.

## Review fixes (review of PR 1)

Seven findings of an independent review, each confirmed by a second agent; the lead builder chose how
each is fixed. Every fix has a test that failed with the fix undone (the app changed back, rebuilt and
the test run again: the "mutation" named after each item).

- **The previous date's picture under the new date's name** (two findings, one cause). On a layer with
  more than 12 dates the previous picture stays while the next file loads, and the loading note waits
  400 ms, so on every step nothing said for up to 400 ms (for the whole load when it took less) that
  the picture was the previous date's. The note keeps its delay; the tag on the map ("Play", under
  items 4 and 5) now names the date of the picture drawn. Tests: `dataLayers.test.ts` (which picture
  is on the map, on both paths), `components.test.ts` (the tag's text, not a live region),
  `play.spec.ts` (the tag names the drawn date at once while the next one loads, and no frame
  disagrees for more than 100 ms, stepping or playing), `static-layer.spec.ts` (the title alone),
  `overlay.spec.ts` (on a wide screen the tag is on the map above the box; on a phone, where the
  box is in the strip under the map since the second review, the tag stays on the map, clear of the
  controls, also when the notes go under the map). Mutations: the tag fed from the date chosen, or no tag.
- **`play=1` started before the map had drawn anything**, so the map's start counted against the
  first date's 8 s. It now starts once the map has drawn the picture the link opens on; anything the
  person does first cancels it. Tests: `play.spec.ts`, "starts only once the map has drawn ..." and
  "a person who acts before the first picture is drawn cancels it". Mutations: the old start, and no
  cancel on Play / Pause.
- **"At a point" collapsed on every date change**, history and all, until the new value was read: on
  every step while playing. The history does not depend on the date, so it stays, and only the value
  line says "Value (<date>): reading…" (`InspectState` `updating`). Tests: `components.test.ts`,
  `play.spec.ts` "keeps the history chart and table ...". Mutation: the old collapse.
- **No browser test read the real file format.** Now `e2e/real-data.spec.ts` (see `README.md`).
  Mutation: DEFLATE decoding broken in the bundle (a decoder that throws, registered with geotiff's
  `addDecoder`): it fails, while the fixture smoke test and the fixture click test pass. Also checked
  with throwaway copies: it skips when every site is a sample, and fails when served the SYNTHETIC
  manifest.
- **A test tied every deploy to one sentence of `docs/CONCEPT.md`.** Gone ("The name", at the top); a
  test fails if a vitest file reads that file again (it failed with the old test back in the suite).
- **The visually hidden playback status stretched the page on a phone** (2,848 px against 812 on the
  fixture site, the bars' hidden spans included): `.side { position: relative }`. Test:
  `accessibility.spec.ts` "nothing reaches below the app". Mutation: the rule taken out.

**Merged with the second review (below).** The tag stays on the map at every size, first in the notes
on the map (`mapNotes(false)` in `App.tsx`, now rendered at every size), also on a phone, where the
caption box is in the strip under the map, and on a short window, where the loading note is too. It
takes no taps (`.map-showing` and `.map-notes` have `pointer-events: none`), so the 375 x 812 grid
test of `real-lengths.spec.ts` passes unchanged. `overlay.spec.ts`: at 375 px the tag is on the map,
clear of the controls and the loading note (the old "above the box" is gone with the box); a new
1280 x 800 test keeps it: tag, box and loading note on the map in that order, clear of the controls.

**Follow-ups of the verification.**

- **A flaky first read in `real-data.spec.ts`.** `dataFiles` (`e2e/support.ts`) read
  `map.getStyle().sources` unguarded; when the basemap's style (from the network) came after the
  stepper, the first `expect.poll` failed at once with "Cannot read properties of undefined (reading
  'sources')" instead of waiting. The test now waits for the style first, and `dataFiles` returns no
  files while the map or its style is not there, so a poll on it waits. Checked with throwaway copies
  holding the style 2 s: the old test with the old `dataFiles` failed in 0.8 s with that error; the
  new test, and the old test with the new `dataFiles`, passed.
- **A file that failed was named on the map as the picture drawn.** MapLibre counts a source that
  failed as loaded, so the controller swapped it in (the map rightly shows nothing, not the previous
  date) and reported its date, and the tag said "On the map: HH backscatter, 2026-10-23" over the bare
  basemap. The controller now remembers its sources that fail as a whole (a map `error` with their
  `sourceId` and no `tile`; an error about one tile leaves the rest of the picture, and still counts
  as drawn) and reports that item with `failed: true` (`PictureOnMap`), on both paths: at once when a
  preloaded file failed unseen, else when it fails. The tag then says "On the map: no picture
  (<date> could not be loaded)" (the pair of dates for a pair, the title for a static layer). The red
  line in the side panel is unchanged. Tests: `dataLayers.test.ts` (both paths, the first file of a
  layer, a tile error and another source's error not counted), `components.test.ts` (the text),
  `play.spec.ts` (a 404 for one date's file on the year site and on the three-date site: the tag says
  no picture and names the date, the map is blank, the next good date is named again). The five new
  tests (three vitest, two browser), and the old `dataLayers.test.ts` test whose failed file is now
  reported as failed, fail on the code before; in the browser the tag said "On the map: SYNTHETIC co-pol echo, 2026-10-27" and
  "On the map: Synthetic HH backscatter, 2026-07-13".

## Second review of items 6 and 7 (branch `pr1-fixes-2`)

An independent review of the fire overlay and the fire bars confirmed six findings with four causes
(`bars-per-chart-scale` and `bars-scale-per-entry`; `overlay-caption-box-hides-dots-on-phone`,
`overlay-note-under-attribution-on-phone` and `phone-caption-real-credit`; `bars-firms-credit-missing`).
The lead decided A to C below. Each fix has a test that failed on the code before it.

### Done

- **A. One scale for the bars of one unit and layer.** The real `stats.json` has three entries of
  the same quantity (fire detections per km2 on the same six classes, three windows one after
  another), and each figure drew on its own scale (0 to 0.8, 0 to 1.5, 0 to 0.6), so a larger value
  could draw a shorter bar in the next figure. `panelScales` (`barGeometry.ts`) now gives the
  entries that share a unit and a layer one scale, computed over all their categories, and
  `StatsBody` passes it to each `BarsFigure`. An entry of another unit or layer, or with no layer,
  keeps a scale of its own; an entry with nothing to draw has none and is not counted. Each figure
  writes its scale after its caption as visible text that screen readers get (`.bars-scale`,
  `scaleText`; the axis stays `aria-hidden`): "Scale: 0 to 1.5 detections per km2, the same in all
  three charts." ("both charts" for two; ", for this chart only." when other figures have other
  scales; nothing more when it is the only figure; "the same in the two charts in <unit> for the
  layer “<title>”." when only some share it). On the real data (StatsBody rendered on
  `public/data/tarn-taran/stats.json` in a scratch test, not committed): all three "Scale: 0 to 1.5
  detections per km2, the same in all three charts."
- **The fixture** (`buildYearStats()`): a second entry, `BARS_PERIOD_ID`, of the same unit and
  layer, over the points of one pass's period (`BARS_PERIOD`, 2026-09-21 to 2026-10-02): values at
  most 0.076, so a scale of its own would end at 0.08 against the shared 0.2. The first entry and its
  special cases (a null with a note, a category without an interval, a zero) are unchanged.
- **B. On a phone the overlay's caption box is never on the map.** At 375 x 812 the opaque box
  (caption and sentence) sat over the top left of the site, where about half of the dots it counts
  are, and took the taps there. `CAPTION_UNDER_MAP_QUERY` (`components/useMediaQuery.ts`, the
  stacked layout's `(max-width: 760px)`, `STACKED_LAYOUT_QUERY`) puts the box in the strip right
  under the map at every height. `App.tsx` renders the notes on the map (`data-testid="map-notes"`)
  and the strip (`data-testid="map-notes-under"`; on a short window it was "map-notes") apart. The
  loading note, one short line with `pointer-events: none`, stays on the map on a tall phone and
  goes in the strip only on a short window, as before, so the panels below do not jump at every
  date. Wider screens are unchanged. No CSS changed: the strip is the existing `.map-notes-under`.
- **C. Longer bars texts.** The data side adds the FIRMS credit to the bars (the title names NASA
  FIRMS, the method ends with the credit); nothing in the app changed for it. `REAL_TEXT_LENGTHS`
  (`e2e/realLengths.ts`) now takes a bars title of 110 characters and a method of 1,600, and the
  method served ends with a credit holding a 35-character unbreakable token, as the real one has.

### Tests added or changed

- vitest: `barGeometry.test.ts` (+8: `panelScales` on the fixture's two entries, on three like the
  real site's, for another unit, layer or none, with nothing to draw, and empty; `scaleText`);
  `barsFigure.test.ts` (+3: the sentence after the caption and before the hidden axis; `StatsBody`
  draws both entries on 0 to 0.2 with the same sentence and the period's bar at its share of 0.2;
  another unit keeps its own scale); `fixture-rules.test.ts` (two entries, the second of the same
  unit and layer with values below half of the first's).
- Playwright: `bars.spec.ts` (+2): the two entries have one end, every bar drawn to it, a larger value
  never a shorter bar, the sentence visible and not `aria-hidden`; at 375 px with the three long
  entries and their methods open, the title, the sentence, the region and the method stay inside the
  screen and none is clipped. `real-lengths.spec.ts` (+1, 375 x 812): a 15 x 15 grid of
  `elementFromPoint` over the map hits only its canvas or MapLibre's own controls; the strip right
  under the map shows the caption and the sentence, in view; taps at 40, 40 (where the box was) and
  at the centre reach the map as MapLibre clicks at those points, and the marker appears.
- Changed because they encoded the old behaviour: `real-lengths.spec.ts` at 375 x 740 (was "the box
  at most 40 % of the map"; now the box in the strip, at least 64 % of the map's height clear);
  `overlay.spec.ts` "on a 375 px phone" (was "the caption box stays inside the map"; now in the
  strip right under the map, and the loading note on the map, clear of its controls); the 667 x 375
  tests of both files measure the box's own container instead of `[data-testid="map-notes"]`.
- Checked that they fail without the fixes, on a production build: with `App.tsx` as before and
  `StatsBody` not passing the shared scale, 5 browser tests failed (the shared scale, the long texts'
  sentence, and the three phone tests); the grid check alone found 54 of 225 points on the box at 375
  x 812; the shared-scale test, geometry first, failed with "the same end on both axes" (0.08 for
  0.2); and 2 vitest tests failed.

### Measured (production build, fixture site, real-length texts, Chrome)

| Viewport | Map height | Caption box | Credit line (w x h) | Other |
|---|---|---|---|---|
| 375 x 740 | 407 px | in the strip: 355 x 110 px (strip 123 px) | 355 x 142 px | 265 px of the map clear |
| 375 x 812 | 447 px | in the strip: 355 x 110 px (strip 123 px) | 355 x 156 px | grid: 127 of 225 points on the canvas, 98 on MapLibre's controls, none on anything else |
| 667 x 375 | 150 px | in the strip: 647 x 78 px (strip 91 px) | 647 x 53 px | |
| 1280 x 800 | 684 px | on the map: 390 x 94 px | 900 x 84 px | unchanged |

The 667 x 375 map is 150 px tall with or without this change (132 px in the table above, measured
with an earlier header).

### Left

- On a phone the strip sits between the map and the controls: while dates play with the overlay
  on, a caption that wraps to another number of lines (a longer period, "no data for ...") moves the
  controls below by a line. A `min-height` on the strip's box would hold it; left to the design
  session, which restyles `styles.css`.
- The comment above `.map-notes-under` in `styles.css` still says "On a short map"; left for the
  same reason.
- Anything else drawn by the app on the map with `pointer-events` on (a tag, say) would fail the
  375 x 812 grid test; it belongs in the strip on a phone, or needs `pointer-events: none`.
- Two entries without a layer keep a scale each even with the same unit (the rule is: same unit
  and same layer).

## Left (other agents, in the brief's order)

9. Swipe. The fixture already carries what it needs.

## Needed from the data side

For the guided tour (item 8), nothing blocks, but:

- **The contract has no way for a step to ask for the dates to play** (for example to show the
  harvest moving across a season). The app cannot do it without a field such as a step's `play`;
  none was invented. The build session decides.
- A step's `text` is shown as written, with blank lines as paragraph breaks; keep it to a few
  sentences, or the place and layer controls move far down on a phone.
- The first step opens by itself for every visitor whose link names no layer: make it a step that
  makes sense as a landing view (it may leave out `date` to show the latest pass).

For the real-length texts, nothing blocks. Shorter overlay titles and bars titles still help on a
phone: the caption box grows with the overlay's title.

For the bars (item 7), nothing blocks, but:

- The entry's `method` must name the interval `low` to `high` stands for (the contract says so); the
  app writes "(low to high)" and draws a whisker, but says nothing about what kind of interval it is.
- Give each category its `class` and the entry its `layer` (the harvest map's id), or the labels get
  no colour swatch. Shorter class labels read better beside the bars on a desktop.
- A category that could not be computed should be `null` with a `note` saying why, never 0: the app
  draws a 0 as a real zero.

For the overlay (item 6), nothing blocks, but:

- **The contract has no field for the size of a point's footprint** (for FIRMS VIIRS, a 375 m
  pixel), so the app cannot draw it and draws dots of a fixed size on screen, saying that their size
  is not a size on the ground. A field such as `footprint_m` on an overlay would let it draw the
  footprint when zoomed in. The build session decides.
- The overlay's `description` must say what one point is (for example "Each dot is one VIIRS 375 m
  pixel flagged as a fire at the time of the satellite pass"); the app shows it in the legend and
  writes nothing about a particular overlay itself.
- Give the overlay a `credit` that is not a part of `source.citation` (or the reverse): MapLibre's
  credit line drops a credit that another contains.
- `date_range` matters: without it the app cannot tell "no points" from "no data" and says so.
- A site with more than one overlay should give each its own `color`: without one they share the
  app's default dot, and the circles differ by nothing but colour. The contract has no field for a
  marker shape, so colour is all the map can vary between overlays.

Before item 6: nothing new. For the real site, the app now opens `tarn-taran` by default whatever the order of sites
in the manifest, so the sample site can stay listed until T7 removes it.

## Decisions and why

- **Serve fixtures at `/data/` instead of building a separate test build.** The brief asks for the
  unchanged production build; an environment variable on the preview server leaves `dist/` as it would
  be deployed. 404 instead of fall-through, so a missing fixture can never be replaced by a real file.
- **The guard checks the generator name and the site ids**, not `is_sample`: the test for item 2
  marks a fixture site as real in the browser, and must still pass the guard.
- **Overlay colour violet `#8000ff`.** It stays apart from all five class colours and from every grey
  of the radar ramp for every vision tested. (It was white at first, which is the top of the grey ramp:
  on bright or clipped radar pixels a white fill matched the background.) The real overlay chooses its
  own colour in its manifest.
- **The page title is the name alone**, and the tagline is the meta description: a tab title of 130
  characters would be cut anyway. A reviewer read the brief as asking for the tagline in the title
  too; if the build session agrees, change `<title>` in `index.html` to `__BRAND_NAME__: __BRAND_TAGLINE__`
  and the `toHaveTitle` check in `e2e/startup.spec.ts`.
