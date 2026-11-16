# Brief: a guided story, motion and a calmer interface

Written Saturday 14 November 2026, about 21:45 Central Time, for the agent that will build it (any model).
It is a prompt: read it top to bottom once, then work through section 8 in order. Everything in it was
checked against the code on `main`, the live site and live sources on the web; what was not checked says
so. It was written against `5b51525` and then checked line by line by an independent reviewer against
`278fedd`, ten commits later (among them the merge of `pr1-fixes-2`). `main` keeps moving tonight: where
the code you find differs from what is written here, the code wins, and the rules of section 4 still hold.

**The problem in one line.** The app works and its data is honest, but it opens on a grey map beside about
1,600 words of small print. Nobody who sees it for ten seconds knows what it shows or why it matters. That
is not good enough for a live pitch on Sunday 15:00, or for the audience the challenge names: "scientists,
resource managers, educators, decision-makers, and the public".

**The answer in one line.** The app opens on a guided story that plays the real data in front of the
visitor, one short sentence at a time, and then hands over the same map as a tool with less small print in
view. Motion is used to explain (where, when, what changed), never to decorate the data.

**Clock.** Feature freeze is Sunday 10:00 CT; Gate B is 09:00; the lead builder needs time to review and
merge. Aim to hand over by **Sunday 06:00 CT**. The slices in section 8 are ordered so that every one you
finish can ship by itself. Stop at a slice boundary, never in the middle of one.

---

## 1. Read first, and the rules that do not bend

Read, in this order: `CLAUDE.md`, the top of `PROGRESS.md` ("Read this first", "Resume here", "In flight"),
`docs/CONCEPT.md`, `docs/ARCHITECTURE.md` ("Science rules the code enforces", "App rules"),
`docs/DATA_CONTRACT.md` (rule 12, the story), and `web/DESIGN.md` if your base has it.

These rules come from the project and are not yours to relax:

1. **Honest data.** Never invent values, dates or imagery. Missing passes show as missing. Text written by
   an AI is marked as unchecked until a teammate agrees it. Every credit stays on screen. Section 4 turns this
   into rules for motion.
2. **No NASA logos, insignia lettering or mission patches**, anywhere, including a cover screen. Credits are
   text.
3. **Open licences only** (MIT, BSD, Apache-2.0, ISC, and SIL OFL for fonts). Every new library, font or
   resource gets a line in `docs/SOURCES.md` with URL and licence. **GSAP is not allowed**: its licence is
   the "Standard 'no charge' license", not an open-source one (checked at gsap.com/standard-license on
   14 November). Also not allowed: Shepherd.js and Intro.js (AGPL), Theatre.js studio (AGPL), highcharts,
   mapbox-gl.
4. **Never go dark.** Run `node scripts/tasks.mjs check` and `node scripts/tasks.mjs e2e` before you hand
   over. A story that fails must fall back to the plain app, never to a blank page.
5. **Do not fetch data.** Never run the pipeline commands `run` or `fires` (the fire data must not be
   fetched again before the pitch). Do not re-export the display rasters. Section 9 says how the story's
   texts reach the public site.
6. **Git.** Work on your own branch (`story-motion`) in your own worktree, cut from the newest `main`
   (fetch over SSH first: `PROGRESS.md`, "Build machine"). Small commits that say what and why. No
   `Co-Authored-By` line. Never force-push. Do not edit `PROGRESS.md` on your branch (the lead builder has
   it open); put your notes in `web/MOTION.md` and in your hand-over message. Record your work in
   `AI_USE.md`, as the other sessions did.
7. **Windows.** Use `node scripts/tasks.mjs <check|dev|e2e|lint|test>` and `node scripts/py.mjs -m pipeline
   <args>`. No shell scripts, no symlinks.
8. **Tokens.** The team asked to save them: give routine coding and mechanical edits to Opus subagents, keep
   your main session for decisions, integration and looking at the result. Check the usage reading before
   each slice and stop at a slice boundary before the 5-hour window passes about 70 %.

**How this fits the plan.** `PROGRESS.md` ("Resume here", item 6) still describes the guided tour as four
steps and as the first thing to cut. A teammate asked for this larger pass on Saturday evening, because
the site as it stands cannot be presented. Inside this brief, slice 1 is the last thing to drop; whether
the branch is merged at all is still the lead builder's decision at the Sunday deadline. How many steps the
story has is the team's choice: the engine shows whatever the site file lists.

**Your base.** Start from `main` as it is when you begin. A design pass (branch `design-pass`: tokens, a
dark header band, card panels, a dark theme, `web/DESIGN.md`) and three fix branches may have been merged by
then, or not. This brief is written so that it works either way:

- Put new styles in **new files** (`web/src/styles/motion.css`, `web/src/story/story.css`), imported after
  `styles.css` in `main.tsx`. Do not rewrite existing rules in `styles.css`; two branches already change
  1,400 lines of it.
- If `web/DESIGN.md` exists, use its tokens (`--sp-*`, `--radius*`, `--shadow-*`, `--fs-*`) and keep its
  rules. Nothing in this brief contradicts them: date changes, timeline marks and charts still never
  animate (section 4). If it does not exist, use the fallbacks given here.
- If the map already carries the tag "On the map: <layer>, <date>" (`data-testid="map-showing"`, from the
  branch `pr1-fixes`), reuse it for the story's date stamp instead of adding a second one.

---

## 2. What we looked at, and the one site to follow

Research agents surveyed the award lists (Awwwards, the Webby Awards, FWA, CSS Design Awards, the Pudding
Cup, Information is Beautiful) and the best public Earth-observation sites on 14 November 2026. The sites
that win the top prizes for animation (Igloo Inc, Awwwards Site of the Year 2024, built on Three.js and
GSAP; Lando Norris, Site of the Year 2025) are showpieces. Awwwards' own developer scores for sites of that
kind (Igloo Inc, Why Zero, Navigate, David Whyte Experience) run from 8.0 to 9.6 for animation and from 6.6
to 6.8 for accessibility. They are the wrong model for a data tool, and GSAP, the library most of them use,
is not open source.

**The reference: ESA's "Climate from Space"** (https://cfs.climate.esa.int/). Looked at first-hand on
14 November. It has the same job as ours: satellite records over time, for the public and for people who
want the data. Open it and click through before you write code. What to take from it:

| What it does | What we do |
|---|---|
| Opens on one picture of the Earth, one title, one sentence, one way in | A cover: the map seen from far away, one title, one sentence, "Start the story" |
| Two modes, clearly separate: stories (a pager, "1/2", one idea per slide) and the data viewer | Two modes: the story (steps) and the map (the tool we have) |
| The data viewer shows almost no words: the data, one legend with its unit, one play button and time slider with the date above the knob, an "i" for the rest | The tool keeps every word, but methods and long reasons fold away until asked for (slice 4) |
| Dark, quiet frame; the only strong colours are the data | Story surfaces are dark in every theme; the map goes "night" behind the story |
| Moving between menu, story and data is a camera move on the same globe, not a page change | One map for everything; the story moves its camera and never reloads it |

**Patterns borrowed from other sites** (take the pattern, never the content, code or assets):

| Site (recognition) | Pattern we take |
|---|---|
| WWF "Protecting Blue Corridors", https://bluecorridors.org/ (Webby 2026 winner, Best Data Visualization) | A landing screen with one button and a row of large real figures; story first, then the map |
| WHOI "It's an Ocean World", https://www.whoi.edu/campaign/why-the-ocean/ (Webby 2026 People's Voice, Science) | One map that stays; each chapter adds one layer and says one sentence; a credit under every layer |
| "Searching for Birds", https://searchingforbirds.visualcinnamon.com/ (Webby 2026 People's Voice, Best Data Visualization; Awwwards Honorable Mention) | Open on one place and one moment before the whole picture; end on the full-year curve with a few annotations; methods and sources in view at the end |
| "Dithering, Part I", https://visualrambling.space/dithering-part-1/ (Pudding Cup 2025) | A stepper: one sentence per step, right arrow or a tap goes on, left goes back. Reliable on a stage |
| NASA Worldview and FIRMS (documentation on earthdata.nasa.gov) | The grammar of time on a map: a play button that is also the pause, a date stamp on every frame, fire dots that build up over a window of days |
| ProPublica "Losing Ground", https://projects.propublica.org/louisiana/ | The chart of the series is also the timeline (slice 5) |
| Esri Sentinel-1 Explorer, https://livingatlas.arcgis.com/sentinel1explorer/ | Radar for the public: click a point for its curve; only like is compared with like |
| NASA Earth Observatory, "Is Fire Activity Declining in Northwestern India?" (January 2025), https://science.nasa.gov/earth/earth-observatory/is-fire-activity-declining-in-northwestern-india-153826/ | How to state what fire detections cannot show, in plain words, next to the data |

**What we deliberately do not copy:** scroll-jacking and smooth-scroll libraries (our page does not scroll,
and the mouse wheel belongs to the map), preloaders, sound, cursor effects, hold-to-proceed gates, WebGL
decoration, count-up numbers, and anything that only appears on hover.

**Why steps and not scrolling.** Most award-winning stories are driven by scrolling. Ours is driven by
steps, for four reasons: the page itself never scrolls and a test pins that; the wheel zooms the map; a
presenter needs one key per beat; and with reduced motion a step is still a step.

---

## 3. The experience, beat by beat

This is what a visitor to the bare address sees once slices 1 to 3 are in. Times are with motion allowed.

| Beat | On the map | In the story panel | Motion |
|---|---|---|---|
| 0. Cover | The map from far away (about zoom 4.6, centred on the site), darkened to night; a ring marks the site. Over it: an eyebrow (place and period, from the data), the first step's title in large display type, its text as one sentence, "Start the story" and "Explore the map" | Real figures (24 radar passes, 6 missing passes, 452 fire detections) and the data credit | Words of the title rise in, one after another, about 0.9 s in all. The ring pulses three times and stops |
| 1. Where | The camera flies down to the site (3.2 s). The site's outline fades in. The first radar picture is on the map | "Step 2 of 9", title, two sentences | One flight. Then stillness |
| 2. How to read it | The camera eases to the town and the river (1.4 s) | Bright means a strong return, black means calm water; the legend ramp with plain end labels | One ease |
| 3. The year | The dates play, one real picture after another, each named by a date stamp on the map | The year's curve (site mean) grows by one real point per pass; the mixed-release warning is in view | A flip-book of hard cuts, 0.7 s per pass, about 15 s. Nothing blends |
| 4. June | A cut back to the flooded fields | One sentence | A cut |
| 5. The harvest in HV | The HV pictures play from July to 4 November | One or two sentences, worded as a hypothesis | Flip-book, 8 frames |
| 6. The harvest wave | The harvest map appears class by class in pass order (slice 6), or all at once | Legend rows light up as their class appears; the caveat on "no harvest seen" is in view | Six beats of 0.9 s, each a real class |
| 7. The fires | Fire detections appear day by day from 15 September to 14 November; the caption counts them | The count so far; the sentence that they are not NISAR measurements; the honest result | 61 real days at 0.12 s each, about 7 s |
| 8. Explore | The newest picture | What this can and cannot show; "Explore the map" | The panel slides away; the night lifts; the tool is there |

The presenter drives it with the right arrow. Pressing it while a sequence runs finishes that sequence at
once (its final, real state); pressing it again goes on. So no beat can ever make the pitch wait.

---

## 4. Honest motion: what may move and what never does

This section is the heart of the brief. If a later instruction seems to conflict with it, this section
wins. Write these rules into `web/MOTION.md`.

1. **A measurement is shown or not shown. It never tweens.** No fade, cross-fade or blend between two
   radar pictures, ever: a frame that mixes two dates is a picture no satellite took, and it would paint
   over a missing pass (science rule 7). `map/dataLayers.ts` already guarantees this
   (`raster-fade-duration: 0`, a zero opacity transition, old and new swapped in one frame) and
   `tests/unit/dataLayers.test.ts` pins it. Do not touch that paint. No raster fades in or out, not even
   the first one.
2. **A date change is instant everywhere**: the picture, the timeline mark and the date readout change in
   the same frame. `e2e/play.spec.ts` pins that `.tick-current` has no transition and no animation even
   without reduced motion. No gliding playhead, no rolling digits.
3. **Charts and numbers appear whole.** No bar grows, no line draws itself, no number counts up: each of
   those shows values the data does not contain. `e2e/bars.spec.ts` pins this for the bar charts. A figure
   may fade or slide in **as one block**. Marks may appear **one whole mark at a time**.
4. **A sequence may build up real things in their true order**, because every state it passes through is
   real: the dates of a layer in order (the flip-book), the classes of a map in legend order, fire
   detections day by day, the points of a series pass by pass. Each state says on screen what it is: the
   date of the picture drawn, the days counted so far.
5. **The name on screen is the name of what is drawn.** The date stamp shows the date of the picture the
   map has drawn (the `onDrawn` signal, or `onPictureShown` if your base has it), never the date just asked
   for. While a picture loads, the stamp says so and names no date. The "Loading the picture" note stays.
6. **What may move freely:** the camera; the frame (panels, cards, the cover, drawers, the dialog, the
   night over the basemap); words; focus and highlight rings; things that carry no data and cannot be taken
   for data.
7. **No decoration that looks like data.** No smoke, flames, particles, radar sweeps, satellite icons
   flying over the map, glows around fire dots or heat hazes. A visitor must never wonder whether a moving
   thing was measured.
8. **Interface colours are not data colours.** The fire dots are `#d55e00` and the harvest classes are
   the viridis colours in the manifest: no button, ring or progress bar uses those. "Where you are" is the
   app's amber (`#ffb000`).
9. **Nothing moves for more than five seconds by itself without a way to stop it** (WCAG 2.2.2). Every
   sequence has a visible Pause, and the right arrow finishes it. Nothing loops forever.
10. **Reduced motion means no motion**, and the story still works as plain steps (section 6).
11. **Honest states are never covered, hidden or shortened**: the sample notice, a mark of unchecked text, the
    mixed-release warning wherever dates are compared, the sentence that an overlay is "not a NISAR
    measurement", the missing-pass marks, the map's credit line.

---

## 5. Look: type, colour, surfaces

**Type.** Two small font files, both SIL OFL 1.1 (licence files checked in the npm packages on
14 November), self-hosted through Fontsource. No font is loaded from another server at run time.

- Display, for the cover title and step titles: **Instrument Serif** 400.
  `npm install --save-exact @fontsource/instrument-serif@5.3.0` in `web/`, then
  `import '@fontsource/instrument-serif/latin-400.css'` in `main.tsx`. The Latin file is 21 KB. It has one
  weight only: never fake a bold with it.
  `--font-display: 'Instrument Serif', 'Iowan Old Style', Palatino, Georgia, serif`.
- Figures, for the date stamp and the counters: **Geist Mono** 500.
  `npm install --save-exact @fontsource/geist-mono@5.3.0`, then the Latin 500 stylesheet (check the package's file list
  for its exact name; `latin-400.css` exists). About 10 KB. Monospaced, so digits never jump sideways.
  `--font-figures: 'Geist Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace`.
- Everything else stays on the system font stack the app has.
- Add both fonts to `docs/SOURCES.md` (name, https://fontsource.org/, SIL OFL 1.1, the copyright line from
  the package's LICENSE). Pin exact versions, as `web/package.json` does for everything.
- If either install fails or costs you more than fifteen minutes, skip it: the fallbacks in the two
  variables above are enough.

| Use | Size | Notes |
|---|---|---|
| Cover title | `clamp(2.75rem, 7vw, 6rem)`, line height 0.98 | display face, balance the lines (`text-wrap: balance`) |
| Step title | `clamp(1.6rem, 2.2vw, 2.1rem)`, line height 1.1 | display face |
| Step text | 1.06rem, line height 1.5, at most about 60 characters a line | system face |
| Eyebrow ("Step 3 of 9") | 0.75rem, upper case, letter spacing 0.08em | system face |
| Cover figures | 2rem, with a 0.75rem label under each | figures face |
| Date stamp on the map | 1.25rem, 1rem on a phone | figures face |
| Nothing | under 12 px | |

**Colour.** Story surfaces are dark in every theme, like the header band of the design pass. Define these
on `:root` in `story.css` (new tokens; do not put them in the first `:root` block of `styles.css`, which
`tests/unit/colours.test.ts` parses):

```css
:root {
  --story-bg: #0b1016;        /* the panel and the cover */
  --story-raised: #151d26;    /* chips, the secondary button */
  --story-line: #2a3440;
  --story-text: #eef2f6;      /* about 17:1 on --story-bg */
  --story-muted: #a9b4c0;     /* about 9:1 */
  --story-accent: #ffb000;    /* the app's amber: the step you are on */
  --story-cta-bg: #f4f6f8;
  --story-cta-text: #0b1016;
  --night: #0b1016;           /* laid over the basemap, under the data */
  --night-opacity: 0.72;
}
```

Add a unit test that computes the contrast of each text pair from these values (4.5:1 for text, 3:1 for
marks and control edges), in the way `tests/unit/colours.test.ts` does.

**Surfaces.** The story panel is a solid `--story-bg` (no transparency, so text contrast never depends on
the map behind it). The cover is `--story-bg` at 0.82 opacity over the night map, solid behind the text
block. No backdrop blur: it is costly on phones and adds nothing here. In a forced-colours theme every
story surface gets a 1 px border and the browser's own colours.

**The night map.** While the story is open the basemap goes dark so the radar picture and the fire dots
stand out. It also fits the subject: radar needs no daylight. It is interface, not data:
the data layers keep their exact colours.

- Add one `background` layer, id `story-night`, colour `--night`, **below every `data-*` raster and above
  the basemap's fills and lines**: insert it before the first existing `data-*` layer, or, when there is
  none, before the id that `beforeIdFor('data', …)` in `map/layerOrder.ts` returns. Data layers added later
  land above it by themselves.
- Animate only its `background-opacity` (0 to `--night-opacity`, 900 ms; 0 ms with reduced motion).
- For every basemap layer of type `symbol`, remember `text-color` and `text-halo-color`, then set them to
  `#d7dee6` and `rgba(11,16,22,0.85)`; put the originals back when the story closes.
- Never change the style URL (`positron` is the only OpenFreeMap style that loads without warnings under
  MapLibre 6.18) and never call `setStyle`: it would drop every data layer.
- MapLibre's credit line and controls keep their own look and are never covered.

---

## 6. The motion system

Put this in `web/src/styles/motion.css`:

```css
:root {
  --dur-1: 120ms;   /* press, hover, a switch */
  --dur-2: 200ms;   /* small fades: a tooltip, a readout arriving */
  --dur-3: 320ms;   /* a card, a drawer, the dialog */
  --dur-4: 520ms;   /* a word of the cover title, the cover leaving */
  --dur-5: 900ms;   /* night falling */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);     /* things arriving */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);      /* things leaving */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* things moving across */
  --stagger: 45ms;
  --rise: 12px;
}
```

and these constants in `web/src/story/timing.ts`: `CAMERA_FLY_MS = 3200`, `CAMERA_EASE_MS = 1400`,
`FIRE_DAY_MS = 120`, `CLASS_BEAT_MS = 900`. The flip-book reuses `PLAY_DWELL_MS` (700) and
`PLAY_CEILING_MS` (8000) from `state/playback.ts`; do not add a second pace.

**Principles.**

- One thing moves at a time. Order within a beat: camera, then picture, then words.
- Arriving is slower than leaving (`--dur-3` in, `--dur-1` or nothing out). An outgoing card may simply be
  replaced.
- Animate only `transform` and `opacity` in CSS, and paint properties on the map. Never animate layout
  (`width`, `height`, `top`, `left`), never `box-shadow` or filters.
- CSS first: classes and `@keyframes`. Use `@starting-style` for things that enter the page (supported in
  all current browsers; without it the thing simply appears). Use the Web Animations API only where CSS
  cannot do it. **No animation library is needed for any of this.** If you find you need exit or layout
  animation that CSS cannot give, the only sanctioned library is `motion` (MIT), through `LazyMotion`, `m`
  and `domAnimation`, wrapped in `<MotionConfig reducedMotion="user">` (its default ignores the setting),
  with a line in `docs/SOURCES.md`.
- Do not use the View Transitions API for anything that includes the map: it takes a snapshot of the WebGL
  canvas and stalls it.

**Reduced motion.** `styles.css` already has the global rule that sets every transition and animation
duration to 0 s under `prefers-reduced-motion: reduce`, and `e2e/accessibility.spec.ts` checks that no
element on the page reports a non-zero duration. So:

- All new CSS motion goes through classes, never through inline `style` durations.
- Under the same media query, in `motion.css`, set `animation-delay: 0s !important; transition-delay: 0s
  !important;` **on your own staggered classes only**, so a staggered word is not left waiting. Do not
  reset delays for every element: the "Loading the picture" note relies on a 400 ms animation delay
  (`.picture-loading` in `styles.css`) and would flash on every date change.
- In JavaScript, read `prefersReducedMotion()` (`components/MapView.tsx`) at the moment you act. With it:
  no sequence starts by itself (the step shows its final state and offers a button, "Play these N passes",
  "Play day by day"); the pulse and the stagger are skipped; night is set at once.
- Camera: call `flyTo` and `easeTo` **without** `essential: true`. MapLibre then jumps by itself under
  reduced motion (checked in the v6 documentation). Do not wait for a duration afterwards: wait for
  `moveend`, which also fires after a jump.

**Performance.** A date is a file of about 3 MB read in pieces; the 24-date layers load one file at a time
and nothing is preloaded. So every sequence **waits for the map to say the picture is drawn** before its
dwell starts, exactly as `usePlayback` does, and gives up after the same ceiling. Never run a sequence on a
timer alone.

**Things you must not animate.** Tests pin three: `.tick` and `.tick-current`; `.bars-bar`, `.bars-whisker`
and the zero mark; any `raster-*` paint property. A fourth by rule: the `.picture-loading` note (its 400 ms
delay is already an animation; leave it exactly as it is). If you give `button` a transition, exclude the
timeline marks, which are buttons: `button:not(.tick)`.

---

## 7. How the story is built

### 7.1 Where it lives on the page

- **Desktop** (wider than 760 px): the story panel takes exactly the place of the side column (`.side`,
  360 px, or the design pass's `--side-width`). The map keeps its size, so nothing resizes when the story
  opens or closes and no camera padding is needed. The side column is still in the page, under the panel.
  Render the panel as a sibling of `.side` inside `.main`, never inside `.side` or `#map`: those go inert
  (7.2) and would take the panel with them.
- **Phone** (760 px and narrower): the map stays on top at its usual height; the story panel takes the
  place of the panels below it. Back and Next sit in a bar that sticks to the bottom of the panel, each at
  least 44 by 44 px. **On a phone nothing of the app may lie on the map**: `e2e/real-lengths.spec.ts` pins
  that for the tool at 375 by 812, and the story keeps to it. The cover's words, the date stamp and the
  notes all sit below the map.
- **The cover** has two parts. On a desktop, a dark scrim lies over the map and carries the eyebrow, the
  title, the sentence and the two buttons. Put it **inside `.map-wrap`, at the stacking level of the notes
  (z-index 1)**, so that MapLibre's corners (z-index 2) stay above it and the credit line stays readable
  and clickable. Beside it the story panel, in its usual place, carries the figures, the mark of unchecked text and the
  data credit. On a phone there is no scrim: the map shows the far view uncovered and the panel below
  carries everything. The header is never covered: its `h1` stays as it is (`e2e/startup.spec.ts` reads
  it) and the cover's title is an `h2`. Hide the zoom buttons while the story is open.
- **The date stamp** sits on the map, bottom left, on a desktop (the notes are top left, the zoom buttons
  top right, the scale and the credit bottom right) and in the strip under the map on a phone.
- **The app's notes stay visible during the story, where they are:** the overlay's caption with its "not a
  NISAR measurement" sentence, and the loading note. On a desktop they are on the map, top left; on a
  phone they are in the strip under the map (`data-testid="map-notes-under"`).

### 7.2 The map is still, the tool is asleep

While the story is open:

- Set the `inert` attribute on the map's canvas container, on its zoom buttons and on `.side` (and remove
  it on closing). Leave the map's credit line alone: its links must stay reachable. The visitor cannot drag
  the map into a state the text does not describe, the tool's controls leave the tab order, and a screen
  reader hears only the story. The camera still moves from code.
- The app's own arrow-key handler (`App.tsx`, which steps dates) must stand down, the way it does for the
  About dialog.
- "Explore the map" is on every step, small, top right of the panel. It closes the story **and keeps what
  the step put on the map**, so any step is a starting point for exploring.

### 7.3 One data-driven engine, no site-specific code

The contract already has what a step needs (`contract/manifest.schema.json`, `storyStep`): `id`, `title`,
`text`, a flag for unchecked text, and optionally `layer`, `date`, `reference` and `secondary`, `overlays`, `view` (centre and
zoom). **Do not change the contract and do not key anything on a step's id or on this site.** The engine
derives all its motion from four general rules, so it works for any site and for the test fixtures:

1. **Cover.** The first step is shown as the cover (large title, its text as the sentence, the figures
   row). Its map state is applied behind it.
2. **Camera.** A step with a `view` moves the camera there. A step without one frames the site (its `view`
   if it has one, else its `bounds` with 40 px padding, through `cameraForBounds`). If the zoom changes by
   more than 3 it is a flight (`flyTo`, `CAMERA_FLY_MS`, `curve: 1.42`); otherwise an ease (`easeTo`,
   `CAMERA_EASE_MS`, an ease-in-out cubic). The first framing of the cover is a `jumpTo`. Take the camera
   only after `MapView` has framed the site for the first time: its own effect runs when the style is
   ready and would overwrite an earlier jump.
3. **Dates play forward.** When a step shows a per-date layer and names a `date`, and the step before it
   named an earlier date, the map shows **every acquisition of the step's layer after the earlier date up
   to the step's date, in order**, and rests on the step's date. In any other case (no earlier date, a
   later one, a pair layer) it cuts straight to the step's state. Missing passes are skipped, as "Next
   date" skips them, and stay marked on the timeline. The step before may have shown another per-date
   layer: what plays is always the step's own layer (after an HH step dated 25 June, an HV step dated
   4 November plays the HV passes from 19 July to 4 November).
4. **Things that build.** When a step switches on an overlay that has a `date_property` and was not on in
   the step before, its points appear **day by day** across the period the app would show for that step
   (slice 3). When a step shows a static layer with classes (`categorical-uint8`) and the step before
   showed another layer, the classes appear **one by one in the order the manifest lists them** (slice 6).

Write rules 2 to 4 as one pure function, `planStep(previousStep, step, site): StepPlan`, in
`web/src/story/storyModel.ts`, with unit tests. Everything else follows from the plan.

### 7.4 Files

New, all under `web/src/story/` (replace the empty stub `web/src/extensions/storyMode.ts` with a
re-export, or delete it and fix the comment that points to it):

| File | What it holds |
|---|---|
| `storyModel.ts` | Types; `planStep`; `coverFigures(site)`; pure, unit-tested |
| `storyUrl.ts` | Reading and writing the `story` parameter (7.6); pure, unit-tested |
| `timing.ts` | The constants of section 6 |
| `stage.ts` | Everything the story does to the MapLibre map: night, the site outline and ring, the camera, layers whose ids start with `story-`. Takes the map; knows nothing of React |
| `useStory.ts` | The state machine: open or closed, the step, the phase (`moving`, `playing`, `resting`), `next`, `back`, `goTo`, `exit`, `replay`, `pause`. Runs a plan and can abandon it at any moment (an `AbortController`; React's strict mode runs effects twice in development) |
| `Story.tsx`, `StoryCover.tsx`, `StoryPanel.tsx`, `StoryProgress.tsx`, `DateStamp.tsx` | The interface |
| `story.css` | Its styles and tokens |

Changes to existing files, kept as small as possible:

- `components/MapView.tsx`: `MapHandle` gains `map(): MapLibreMap | null`. Nothing else changes there. The
  first framing of the site stays a jump.
- `App.tsx`: owns the story through `useStory`, passes it the manifest, the selection and its setter, the
  drawn-item signal and the map handle; renders `<Story>`; adds the header button (7.7); makes `writeUrl`
  and the arrow-key handler aware of the story. Give `h2#site-title` `tabIndex={-1}` and a focus style, so
  that focus can land on it when the story closes (today it cannot take focus).
- `state/urlState.ts`: `serializeUrlState` must drop the `story` key when the story is closed (today it
  keeps every key it does not know).
- `state/overlayView.ts` and `state/overlayPeriod.ts`: an optional upper day for the window (slice 3).
- `contract/manifest.ts`: re-export the generated `StoryStep` type.

**To apply a step's state** use what the app already has, so the URL, the layers, the overlays, their
captions and the legend all follow by themselves:

```ts
setSelection(noteSelection(resolveSelection(manifest, {
  ...selectionToUrlState(current),
  ...(step.layer ? { layer: step.layer } : {}),
  ...(step.date ? { date: step.date } : {}),
  ...(step.reference && step.secondary ? { pair: pairKey(step.reference, step.secondary) } : {}),
  overlays: step.overlays ?? [],
})));
```

Spread only what the step names. A key set to `undefined` would overwrite what is on screen, and
`resolveSelection` would then fall back to the first layer and the newest date. So a step without a layer
keeps the layer, and a step without a date keeps the date on screen when its layer has that date (the
fixture's first step names a layer and no date for exactly this). Stop the tool's own playback
(`stopPlayback()`) whenever the story takes the map.

**To play dates** do not use `usePlayback` (it only plays to the last date). Run the plan's item indexes
yourself with the same rules: `selectItem(i)`, wait until the drawn item is `i` (or `PLAY_CEILING_MS`),
dwell `PLAY_DWELL_MS`, go on. Use `msUntilStep` from `state/playback.ts` so the timing is the tested one.

### 7.5 The panel, element by element

```
<section class="story-panel" role="region" aria-labelledby="story-step-title">
  <ol class="story-progress">            one segment per step; the current one amber; each is a button
  <p class="story-eyebrow">Step 3 of 9</p>
  <p class="…">…</p>                     the mark of unchecked text, only when the step is flagged as unchecked
  <h2 id="story-step-title" tabindex="-1">…</h2>
  <p class="story-text">…</p>
  <div class="story-figure">…</div>      what the step's data offers (below); may be absent
  <p class="story-warning">…</p>         the mixed-release warning, whenever the step shows a per-date layer
                                         of a site whose release is "mixed" (reuse MIXED_RELEASE_WARNING)
  <p class="story-credit">Data: …</p>    the site's citation, on every step
  <div class="story-nav">  Back   [Pause / Play again]   Next  </div>
  <button class="story-exit">Explore the map</button>
  <p class="visually-hidden" role="status" aria-live="polite">Step 3 of 9: The year</p>
</section>
```

- **Next** is the one filled button (`--story-cta-bg`). On the last step it reads "Explore the map" and
  closes the story. **Back** is quiet. Both are at least 44 px tall on touch screens.
- **Focus** stays on Next from step to step, so Enter and Space keep working. When the story opens, focus
  goes to "Start the story"; when it closes, to the site's title (`#site-title`) in the side column.
- **Keys**, handled on the story region only while it is open: Right arrow and Page Down go on; Left arrow
  and Page Up go back; Escape closes; Home returns to the cover. No single-letter shortcuts.
- **A press of Next (or Right) during a sequence** finishes the sequence at once, at its real final state.
  The next press goes on.
- **Pause** is shown while a sequence runs; when it has finished the same button reads "Play again".
- **The figure** is chosen by what the step shows, never by its id:
  - a per-date layer whose site statistics hold a series for it (`series.layer === layer.id`, unit dB):
    the year's curve (slice 5);
  - a layer with classes: its legend rows, the ones not yet revealed dimmed, with a note "not shown yet";
  - an overlay that is on: its caption and count, from the same `overlayView` the map uses, the sentence
    `OVERLAY_NOT_NISAR`, and the overlay's `credit` in full (the legend that normally shows it is asleep);
  - otherwise nothing.
- **How a step arrives:** the eyebrow, the title and the text rise by `--rise` and fade in over `--dur-3`
  with `--ease-out`, `--stagger` apart. The outgoing step is simply replaced. Key the block on the step's
  id so React remounts it.
- **The cover's figures** come from the manifest alone: the number of acquisitions ("24 radar passes"),
  the number of missing passes ("6 passes missing, shown as missing"), and each overlay's `count` with its
  title ("452 fire detections (VIIRS, NASA FIRMS)"). A figure whose source is absent is left out. They are
  plain numerals; they do not count up.
- **The date stamp** reads, for a per-date layer, the layer's title and the date of the drawn picture
  written out, for example "HH backscatter · 25 June 2026". Format the day with the app's own `formatDay`
  (`state/overlayPeriod.ts`), not with `Intl`: the app writes dates without a locale and a test pins that.
  For a static layer the stamp is its title alone; while a picture is changing, "Loading the picture…" and
  no date.

### 7.6 The address

One new parameter, `story`, read once when the page opens:

| Address | Opens |
|---|---|
| No `site`, `layer`, `date`, `pair`, `overlays`, `lon`, `lat`, `z` or `play`, and the site has a story | The cover |
| `story=<step id>` | The story at that step (an unknown id: the cover) |
| `story=off`, or any of the parameters above without `story` | The map, exactly as today |

While the story is open the address carries `story=<step id>` and none of the selection parameters, so a
reload comes back to the same step. When it closes, `story` goes and the usual parameters return. Shared
links made before this change keep working, because they carry `site`.

**The tool must never flash before the cover.** The manifest arrives after the first paint. On a bare
address, draw the cover's dark surface from the very first frame, with the name from `branding.ts` and a
quiet "Loading…"; fill in the title, the sentence and the figures when the manifest arrives; take the
surface away if the site turns out to have no story.

**This changes what the bare address shows, on purpose, and that breaks the tests that open it.** On the
fixtures the bare address opens the site `synthetic-year`, which has a four-step story
(`web/tests/fixtures/synthetic.mjs`). On `278fedd` six calls open a bare address: `openApp` in
`e2e/accessibility.spec.ts`, one `goto` in `e2e/smoke.spec.ts` and four in `e2e/startup.spec.ts` (one of
those then waits for `site` to appear in the address). Every other call carries `site=` and is not
affected. Give those six `story=off`, in one commit that says why, so that every existing test still tests
the tool; search `web/e2e` for `goto(` to be sure none was added since. Then cover the bare address with
the new story spec. Do the same for `scripts/live-check.mjs`, which clicks the middle of the map: check the
tool at `?story=off`, and add a check that the bare address shows the cover and that "Explore the map"
leads to a working map.

### 7.7 Getting in and out

- The header gains a button, "Story", after About in the page order (the tab-order test tolerates extra
  stops but not a new order), shown only when the site has a story. It opens the cover.
- **Closing:** the panel slides 24 px to the right and fades (`--dur-3`, `--ease-in`); night lifts
  (`--dur-5`); the outline and ring are removed; `inert` is removed; focus moves; a polite live region says
  "Exploring the map".
- **If anything in the story throws**, catch it in an error boundary of its own, close the story and show
  the map. Log the error to the console.

---

## 8. Build order

Each slice ends with: `node scripts/tasks.mjs check`, `node scripts/tasks.mjs e2e`, a look at the real data
in the dev server at 1280 by 800 and at 375 by 812, and a commit. Report what you ran and saw separately
from what you expect to work.

### Slice 1: the story as plain steps (must; about 2 hours)

The whole of section 7 with no motion at all: the cover, the panel, the progress segments, Back and Next,
the keys, the `story` parameter, `inert`, the "Story" button, the date stamp, marks of unchecked text, credits, the
mixed-release warning. Steps change the layer, date, overlays and camera by cuts and jumps. No night, no
sequences.

Done when, on the fixtures and on the real data with a local story (section 9):

- the bare address shows the cover; "Start the story" leads through every step to "Explore the map", and
  then the tool works as before; Escape and "Explore the map" close it from any step;
- every existing test passes with `story=off`, and a new `e2e/story.spec.ts` covers: the cover on the bare
  address; next, back and the keys; `story=<id>` and a reload; `story=off`; the mark of unchecked text on a
  flagged step and none on the fixture's unflagged step; the side column and the map being inert while it is
  open; focus after opening and closing; a 375 px phone (nothing sticks out sideways, 44 px targets); a
  forced-colours run; and that the stamp never names a date while the picture is changing;
- with reduced motion nothing reports a non-zero duration and the camera is never moving (`isMoving()`).

This slice alone is the guided tour that `docs/CONCEPT.md` asks for. Everything after it is polish on a
working thing.

### Slice 2: the look and the motion of the story (must; about 1.5 hours)

The fonts and tokens of section 5; `motion.css`; night; the camera flights and eases; the site's outline
(a `line` layer `story-outline` from the site's bounds, white, 1.5 px, fading in over 400 ms after the
flight) and, on the cover, a ring at the site's centre (a `circle` layer `story-site`, stroke only, which
pulses three times and then stays still); the cover's words rising in; steps arriving; the closing
hand-off.

Done when the first three beats of section 3 look right on the real data, a screenshot of each is in your
hand-over, the forced-colours and reduced-motion runs still pass, and the map's credit line is readable on
the cover and on every step.

### Slice 3: real sequences (must; about 1.5 hours)

**The flip-book** (rule 3 of 7.3). Under reduced motion: the final date at once, and a button "Play these
N passes".

**Fires day by day** (rule 4). Give `overlayWindow` and `overlayView` an optional last day. The story holds
"shown up to" as an ISO day and steps it one **real day** at a time, every `FIRE_DAY_MS`, from the first day
of the window to its last; days with no detection still take their tick, because time is real. **The
caption and its count must come from that same capped window**, as they do today (the app's rule: the
count and the map's filter come from one window), so the caption reads, live, "Fire detections (VIIRS,
NASA FIRMS), 15 September to 2 October 2026: 14". Mind one trap: for a static layer `overlayWindow` returns
the kind `'all'`, and `overlayFilter` then returns no filter at all. A capped window must be a dated one,
or the map draws all 452 points while the caption counts fewer. Optional, if it costs under half an hour: a second circle layer `story-fires-today`, filtered to
the day just added, drawn as a white ring 1.8 times the dot's radius, so the eye finds the new dots; it is
a ring, not a glow, and it has no fill. Under reduced motion: the whole period at once, and a button "Play
day by day".

Done when: unit tests cover `planStep` (a later date on the same layer plays the passes in between; an
earlier date cuts; a later date on another per-date layer plays that layer's passes; a missing pass in
between is skipped; a pair step and a step without a date cut) and the capped window; the story spec checks that during a flip-book the stamp always
equals the picture drawn and that the caption's count equals the number of points the filter lets through;
Pause, "Play again" and finish-on-Next work; the beats 3, 5 and 7 of section 3 run on the real data.

### Slice 4: the tool, with less to read at once (must; about 1 hour; independent of slices 2 and 3, so a
second agent can do it at the same time: it does not touch `App.tsx`)

About 80 % of the words on the first view are in the Statistics panel. Nothing is deleted or reworded;
long methods fold, exactly as the bar charts' methods already do (`details.bars-method` in
`components/BarsFigure.tsx`).

| Where | Now | After |
|---|---|---|
| Each series in Statistics (`StatsPanel.tsx`) | title, unit, region and a long method (`p.muted`) all in view; the four methods are about 350 words | Title, unit, region and chart stay in view; the method goes into a `<details>` built like the bar charts' one, summary "How this was computed" |
| Each bar chart | its method already folds; its region is in view | **Leave it exactly as it is.** Its summary text (`METHOD_SUMMARY`), its markup and its region being in view are pinned by `tests/unit/barsFigure.test.ts` and `e2e/bars.spec.ts` |
| Missing passes (`Controls.tsx`, `ul.missing-list`) | six dated reasons in view (114 words) | The hatched marks and the key stay; one line stays in view ("6 passes are missing"); the dated reasons sit in a `<details>` under it, summary "Why they are missing" |
| Legend (`Legend.tsx`) | description and "Method:" paragraph in view (up to 200 words of method on the harvest map) | The description stays, with its mark of unchecked text; the method folds, summary "Method" |

Never folded: the site's citation, the mixed-release warning, marks of unchecked text, the FIRMS credit, the sentence
that an overlay is not a NISAR measurement, the map's credit line.

Then the small motion, all in `motion.css`, all through classes:

- buttons (not `.tick`): background and border ease over `--dur-1`; a press scales to 0.97;
- the overlay switch: its knob slides over `--dur-1`;
- an opened `<details>`: its content fades in and rises 6 px over `--dur-2`;
- the About dialog and its backdrop: fade in over `--dur-3`, the dialog from 98 % scale
  (`@starting-style`);
- the side panels, once, when the data has loaded: rise `--rise` and fade in, `--stagger` apart;
- the value in "At a point" when it arrives: fades in over `--dur-2`;
- the amber marker, when placed: one ring spreads from it and fades over 600 ms (a pseudo-element on the
  marker's element; MapLibre's own marker already fades over 0.2 s);
- desktop only: a header button "Hide panel" / "Show panel" (after "Story" in the page order) that removes
  the side column so the map fills the window for presenting. The map resizes by itself.

Where a test pins markup you change on purpose (`tests/unit/components.test.ts`, and any spec that reads
a series' method, the missing-pass list or the legend's method), change the test in the same commit and
say why. The bar charts' tests should not need to change: if one fails, you touched something this slice
leaves alone. Never weaken a test that guards honesty (section 10).

Done when the first view of the tool on the real site shows about 1,100 words, down from about 1,600, with
every credit and warning still in view, every folded text opens with the keyboard, and the suites pass.
(The regions of the series and of the bar charts are the next 400 words; a test keeps the bar charts'
regions in view on purpose, so folding regions is the team's decision, not yours.)

### Slice 5: the year as a curve in the timeline (should; about 1 hour)

"Punjab's fields dance twice a year" is a shape: two humps in the site's mean brightness. Show it where the
time is.

- In the date stepper, above the marks and on the same true time axis (`TimelineEntry.position`), draw the
  series of the layer on screen (`hh-mean` for `hh`, `hv-mean` for `hv`: the series in `stats.json` whose
  `layer` is the layer's id and whose unit is dB) as a thin line with a dot per pass. It is static.
- **A segment is drawn only between two passes that follow each other in the 12-day cycle.** Where a pass
  is missing or a value is null, the line breaks. A line across a gap would fill in a pass that does not
  exist.
- Label it: the series' unit and its lowest and highest value at the left edge, and month names under the
  axis. It is `aria-hidden` (the full chart with its numbers is in Statistics); the marks stay the
  controls.
- Share the loading of `stats.json` between this and `StatsPanel` (one hook, one request).
- In the story, a step that plays dates shows the same curve in its panel, and **the points appear one by
  one as each picture is drawn**: whole points and whole segments, never a line drawing itself.

Done when the two humps are visible on the real site in HH, the line breaks at all six missing passes, and
no mark of the timeline has gained a transition.

### Slice 6: the harvest wave builds pass by pass (should; about 1.5 hours; the first thing to cut)

Rule 4 of 7.3 for a layer with classes. The classes of `harvest-wave` are listed in pass order (three
harvest windows, then "no harvest seen", "fell before", "not rice"), so listing order is the story.

- A class is revealed or it is not drawn at all. Nothing is recoloured and no label changes, so no state
  says anything the published map does not say.
- How: one raster source per state, all added at opacity 0, shown by flipping opacity in the same frame,
  which is the tested recipe at the top of `map/dataLayers.ts`. Each state needs its own colour function
  built from `classColorTable` with the unrevealed classes made transparent. `cog.setColorFunction` is
  keyed by URL, so the idea is to give each state's URL a distinct query string, which a static host
  ignores. **This idea has not been tried:** prove it with one state before building the rest, and cut the
  slice if it does not work within twenty minutes. The sources' ids start with `story-` (the end-to-end
  helpers count every source whose id starts with `data-`), and they sit where data layers sit
  (`beforeIdFor('data', …)`). The app's own harvest layer is shown only at the end, so the final state is
  the real layer.
- One beat per class, `CLASS_BEAT_MS`. The panel's legend rows light up with their class.
- If this is not solid within its time, drop it: the step then shows the whole map at once, which is
  correct and already works.

### Slice 7: only if everything above is merged

- **A hands-free run for the 30-second video:** `story=auto` plays every step with a rest of 3.5 s after
  each sequence. Any key or click pauses it; never under reduced motion.
- **Swipe between two dates** (the stub `extensions/compareSwipe.ts` explains the tested approach: two
  synced maps and `clip-path`; the compare plugin fails under Vite). Only dates of one stack, and with the
  mixed-release warning in view.
- **A globe on the cover** (`map.setProjection({ type: 'globe' })` while the zoom is under 6, back to
  mercator before the site is reached). Drop it at the first sign of a misplaced raster: check that the
  river in the radar picture lies on the basemap's river.

---

## 9. The story's words, and how they reach the public site

Steps are data. They live in the site file, `pipeline/sites/tarn-taran.yaml`, under `story:` (the template
`pipeline/sites/_template.yaml` shows the form), and `export` copies them into `site.json` as written.

**The words are the team's.** What follows is a first version for them to rewrite, so every step is flagged
as unchecked and shows the mark of unchecked text until a teammate changes the text or agrees it and sets the flag to false. Before
you commit it, **check every number and claim against `docs/METHODS.md` section 6 and
`web/public/data/tarn-taran/stats.json`**; if one does not match, take the number out, do not adjust it.
Interpretation is worded as a hypothesis (the contract asks for that).

```yaml
story:
  - id: two-dances
    title: Punjab's fields dance twice a year
    text: Wheat in winter, rice in the monsoon. The second dance ends in fire.
    # flagged as unchecked
    layer: hh
    date: 2025-11-21
    view: { center: [74.93, 31.21], zoom: 4.6 }
  - id: where
    title: One district, seen every 12 days
    text: >-
      This is about 29 by 29 km, mostly farmland, in southern Tarn Taran, Punjab, and across the Sutlej
      river in Ferozepur district. NISAR passes over it every 12 days, at about a quarter to six in the
      morning. Its radar needs no daylight and sees through haze and cloud.
    # flagged as unchecked
    layer: hh
    date: 2025-11-21
  - id: reading-radar
    title: How to read the picture
    text: >-
      Brighter means more of the radar signal came back. Buildings are bright: the pale patch is the town
      of Patti. Calm water sends the signal away and looks black: the dark ribbon is the Sutlej river and
      the edge of the Harike wetland. The fields in between are the part that changes.
    # flagged as unchecked
    layer: hh
    date: 2025-11-21
    view: { center: [74.90, 31.23], zoom: 11.2 }
  - id: the-year
    title: The year, pass by pass
    text: >-
      Watch the fields. They brighten as the wheat grows from December to March, darken when it is cut in
      April, dip again when the paddies are flooded in June, and brighten strongly as the rice grows. We
      read these two rises as the two crops.
    # flagged as unchecked
    layer: hh
    date: 2026-09-29
  - id: june-flood
    title: June, the fields become mirrors
    text: >-
      Before rice is planted the fields are flooded, a few at a time. Smooth water reflects the radar away
      from the satellite, so a flooded paddy looks dark.
    # flagged as unchecked
    layer: hh
    date: 2026-06-25
  - id: harvest
    title: October, the rice comes off
    text: >-
      The same fields in HV, the part of the signal that leafy plants scatter. We expect it to rise as the
      rice fills in and to fall when the crop is cut. Watch for fields that turn dark from one pass to the
      next: we read that sharp fall as the harvest. In HV most fields do so between 23 October and
      4 November.
    # flagged as unchecked
    layer: hv
    date: 2026-11-04
  - id: the-wave
    title: The harvest wave
    text: >-
      Each 100 m cell of rice is coloured by the pair of passes in which its HV first fell sharply. By
      4 November the map shows this for about two thirds of the rice. Yellow means the radar saw no sharp
      fall. It does not mean the rice was still standing: officials reported more of the harvest done than
      this map sees.
    # flagged as unchecked
    layer: harvest-wave
  - id: the-fires
    title: Then the fires
    text: >-
      Each dot is a 375 m square in which a VIIRS satellite instrument flagged at least one fire, between
      15 September and 14 November 2026 (NASA FIRMS). At the peak of the burning, from 24 October to
      4 November, fires were denser on rice the map calls harvested between 23 October and 4 November than
      on land that is not rice, but the map's harvest dates do not sort the fires. From 5 to 14 November
      the classes of rice could not be told apart, so our guess that fires follow the newest harvest is not
      supported.
    # flagged as unchecked
    layer: harvest-wave
    overlays: [fires]
  - id: explore
    title: Now look for yourself
    text: >-
      What this can show is limited: one look every 12 days, one year of passes and one rice harvest, a
      harvest map of 100 m cells that hold several fields, and an analysis done after the fires. Click any
      field to see its year as a curve.
    # flagged as unchecked
    layer: hh
    date: 2026-11-04
```

Notes on it: the first step is the cover and uses the first line of the pitch from `docs/CONCEPT.md`. The
`view` values are starting points; set them by eye in the dev server (`window.__map.getCenter()` and
`getZoom()` in the console). Rule 3 of 7.3 makes `the-year` play the 20 HH passes that follow 21 November
2025, up to 29 September 2026, and `harvest` play the 8 HV passes from 19 July to 4 November 2026, without
any step saying so. Step ids are deliberately not the ids of layers or overlays.

**Publishing it** takes two different places:

- **On your branch:** commit the site file with the story. For looking at the real data while you build,
  make a local manifest that carries the story: copy `web/public/data/manifest.json` to
  `web/public/data/manifest.story-dev.json`, add the steps to the site there, and open the dev server with
  `?manifest=data/manifest.story-dev.json` (the app honours that parameter in development only, and it
  does not count as a selection, so the cover still opens). Add that file to `.git/info/exclude` so it can
  never be committed. The fixtures' own story serves the automated tests.
- **In the main checkout, by the lead builder, after the merge** (the pipeline reads `work/`, which exists
  only there), these three commands and no others, **never `run` and never `fires`**:

  ```
  node scripts/py.mjs -m pipeline export --site tarn-taran
  node scripts/py.mjs -m pipeline manifest
  node scripts/py.mjs -m pipeline validate
  ```

  `export` never fetches, copies the story as written and leaves rasters that are up to date alone. But it
  rewrites a raster when any of its tags differs (the pipeline's version is one of them), and it removes
  the fire overlay if its detections file is missing or was made with other settings. So: **if
  `git status` shows any `.tif`, `stats.json` or `fires.geojson` changed or deleted, do not commit; run
  `git checkout -- web/public/data` and stop.** Only `site.json` and `manifest.json` may change. Say all of
  this in your hand-over.

---

## 10. Tests: what must keep passing, and what to add

**Pinned today, do not break** (all found in the code on `main`):

- No fade or transition on data rasters; the old picture is removed in the frame the new one appears; a
  file that fails shows a blank map, never the previous date (`tests/unit/dataLayers.test.ts`,
  `e2e/play.spec.ts`).
- The current timeline mark has no transition or animation, with or without reduced motion
  (`e2e/play.spec.ts`).
- Bars, whiskers and the zero mark have no animation (`e2e/bars.spec.ts`).
- Under reduced motion no element reports a non-zero transition or animation duration, and the zoom
  buttons jump (`e2e/accessibility.spec.ts`).
- Tab order: About, the map, Zoom in, Zoom out, Layer, Previous date, Next date, Play, the marks, Layer
  opacity, "Read values at the map centre"; each with a visible focus ring.
- On a 375 px phone: nothing sticks out sideways; targets are 44 px; the map leaves 7rem of panels in view;
  one finger scrolls the page.
- On a desktop the overlay's box on the map takes at most 20 % of the map's height, the credit line at
  most 35 %, and the two never overlap. On a phone (375 by 812) nothing of the app lies on the map at all:
  the notes sit in a strip under it (`e2e/real-lengths.spec.ts`).
- The end-to-end helpers treat every map source whose id starts with `data-` as a date's picture
  (`e2e/support.ts`). Yours start with `story-`.
- `styles.css` keeps its first `:root` block parseable (hex colours only) and the text
  `@media (max-width: 760px) {`.
- The name and the tagline equal `docs/CONCEPT.md` word for word (`tests/unit/branding.test.ts`).
- Lint is strict: `noUnusedLocals`, `noUncheckedIndexedAccess`, the React hooks rules of version 7.

**Honesty tests you add** (these are the point of the work; never weaken them later):

1. During any sequence the date stamp equals the date of the picture the map has drawn, and names no date
   while one is loading.
2. The fire caption's count equals the number of points the map's filter lets through, at every tick.
3. The curve in the timeline has no segment across a missing pass or a null value.
4. A step flagged as unchecked shows the mark of unchecked text; the mixed-release warning is in view on every step that
   shows a per-date layer of a mixed-release site; the overlay's "not a NISAR measurement" sentence is in
   view whenever its dots are.
5. With reduced motion: no sequence starts by itself, nothing reports a duration, the camera never moves.
6. No layer whose id starts with `story-` is left on the map after the story closes, and the basemap's
   label colours are back to what they were.
7. The story in the site file is valid before anything is exported. `validate` cannot tell you: it reads
   only the published data, which has no story until the lead builder exports it. So add a pipeline test
   that parses `pipeline/sites/tarn-taran.yaml` and runs `story_errors` (`pipeline/manifest.py`, rule 12)
   on its steps against the layers, dates and overlays of the published
   `web/public/data/tarn-taran/site.json`.

**Traps found while preparing this brief:**

- A `button` transition reaches the timeline marks (they are buttons). Exclude `.tick`.
- `serializeUrlState` keeps parameters it does not know, so `story` would stay in the address forever.
- The 24-date layers load one file per date and drop the old picture after 5 s if the new one has not
  come; on a slow network a flip-book shows blank frames with the loading note. That is correct. Do not
  "fix" it by keeping the old picture.
- `maxPitch` is 0 on purpose (the search for the nearest fire dot needs a flat map). No tilt.
- The first framing of the site must stay a jump.
- MapLibre 6 has no default export; use the app's `map/maplibre.ts`. Filters use the expression form
  (`['get', …]`), as `map/overlayLayers.ts` does.
- React's strict mode mounts effects twice in development: every sequence must be abandonable.

---

## 11. Accessibility checklist

- Everything works with the keyboard alone; focus is always visible (the app's amber ring) and never under
  the sticky navigation bar.
- A screen reader hears each step once (the polite live region), not every frame of a sequence.
- Text 4.5:1, marks and control edges 3:1, on the story's own surfaces; a unit test computes it.
- Targets 44 by 44 px on touch screens.
- Reduced motion and forced colours each have a run in the story spec.
- Nothing flashes more than three times in a second (the fire ticks are 120 ms apart but each only adds
  small dots; if the optional ring layer makes the map flicker, drop the ring).
- No information is on hover alone. No time limit: the story never moves on by itself (except `story=auto`,
  which pauses on any input).
- The phone layout keeps the map and the step's text both in view at 375 by 667.

---

## 12. How to run the work

1. Fetch, branch `story-motion` from `main`, add a worktree for it. Run `check` and `e2e` once before you
   change anything, so you know your starting point.
2. Slice 1 yourself or with one Opus agent (it touches `App.tsx`). Slice 4 can go to a second Opus agent at
   the same time in a second worktree: it touches `StatsPanel.tsx`, `Controls.tsx`,
   `Legend.tsx`, `AboutDialog` styles and `motion.css`, and their tests, and not `App.tsx` (its two header
   buttons wait until slice 1 is merged into it).
3. After each slice: both suites, a look at 1280 by 800 and 375 by 812 on the real data, a commit.
4. Before handing over, one independent Opus reviewer reads the diff against sections 4 and 10 of this
   brief and tries to break each honesty rule in the browser; a second agent verifies each finding before
   anything is fixed. Fix what is confirmed, each with a test.
5. Hand over to the lead builder with: the branch and its worktree; what each slice does and which were
   cut; what you ran and what you saw (with screenshots of the cover, a flip-book frame, the fires, a
   phone); the data step of section 9; the lines added to `docs/SOURCES.md` and `AI_USE.md`; and how to
   drive the pitch: open the bare address, press F11, Right arrow to go on, Escape to explore, and
   `?story=off` if anything goes wrong on stage.

**Cut order, first to go first:** slice 7; slice 6; the ring on new fire dots; the "Hide panel" button;
slice 5; the fonts; the night map; the day-by-day fires (show them all at once); the flip-book (cut to each
step's date). **Never cut:** slice 1, the honesty tests, reduced motion, the credits.

**Done means:** on the public address a first-time visitor sees the cover within five seconds, reaches
the end of the story with the right arrow alone in under two minutes, has seen only real pictures under
their own dates, and lands in a tool that shows its methods when asked instead of all at once; and every
check the project had before still passes.

---

## Appendix A: facts about the code, checked on `main` on 14 November

- React 19.3.1, TypeScript 6.0.3, Vite 8.3.8, MapLibre GL JS 6.18.0, `@geomatico/maplibre-cog-protocol`
  0.10.0. No animation library, no CSS framework, one stylesheet (`web/src/styles.css`), system fonts.
- All state is in `App.tsx`: `selection` (`{ site, layer, itemIndex, overlays }`), `opacity`, `point`,
  `aboutOpen`; the map's view is in a ref. `resolveSelection`, `selectionToUrlState`, `parseUrlState` and
  `serializeUrlState` are in `state/urlState.ts`. `noteSelection` wraps every change.
- `MapView` exposes only `center()` through its handle and frames the site with `jumpTo` or `fitBounds`
  (padding 40). The map is also at `window.__map`, for tests and the console only.
- The basemap is OpenFreeMap "positron". Layer order: basemap, data rasters (`data-*`), overlay circles
  (`overlay-*`), then the basemap's labels (`map/layerOrder.ts`).
- Fire points: one GeoJSON source and one circle layer per overlay; each point's day is in the property
  `app:day`; `overlayFilter(window)` filters by it; the caption counts the same window
  (`state/overlayPeriod.ts`, `state/overlayView.ts`, `map/overlayLayers.ts`). All its paint transitions are
  0.
- Layers with classes are drawn through `cog.setColorFunction(url, fn)` with a table from
  `classColorTable(encoding)` (`map/ramps.ts`): listed classes opaque, every other code transparent.
- Playback: `PLAY_DWELL_MS` 700, `PLAY_CEILING_MS` 8000, no speeds, no loop, stops on the last date.
  Up to 12 files are preloaded; the 24-date layers are not.
- The real site: id `tarn-taran`; bounds `[74.78, 31.08, 75.08, 31.34]`; release "mixed"; layers `hh` and
  `hv` (per-date, 24 dates from 2025-11-21 to 2026-11-04) and `harvest-wave` (static, six classes, colours
  `#440154`, `#3b528b`, `#21918c`, `#fde725`, `#b8a3d8`, `#d9d9d9`); six missing passes; one overlay,
  `fires` (452 points, `date_property: date`, 2026-09-15 to 2026-11-14, colour `#d55e00`); statistics
  series `hh-mean`, `hv-mean`, `harvest-share-hh`, `harvest-share-hv`; three bar charts; no story yet.
- End-to-end tests run against the production build on synthetic fixtures (port 4173), never on the real
  site. The fixtures' year has 26 dates and a four-step story.
- Today the bare address opens the tool on the newest date.
- On `278fedd`: on every phone the overlay's caption and the loading note sit in a strip under the map
  (`data-testid="map-notes-under"`), and a test pins that nothing of the app covers the map at 375 by 812.
  `export` requires `--site`; `manifest` and `validate` take no site.

## Appendix B: facts about the platform, checked on live sources on 14 November

- MapLibre 6 `flyTo` and `easeTo` jump under reduced motion unless `essential: true`; `flyTo` options
  `curve` (default 1.42), `speed` (1.2), `maxDuration`; `easeTo` animates centre, zoom, bearing, pitch and
  padding. `idle` fires when no camera move is running and every requested tile has loaded.
  `raster-opacity`, the `circle-*` properties and `line-dasharray` are transitionable and
  `raster-fade-duration` is not (checked). `background-opacity`, `line-opacity` and the text colours are
  transitionable according to the style specification (not looked up again that day: try them first).
  `setFilter(layer, expression)`; `setProjection({ type: 'globe' })`.
- `@starting-style`: Chrome 117, Firefox 129, Safari 17.5 (checked). `<dialog>`, `IntersectionObserver`,
  `prefers-reduced-motion` and `font-variant-numeric` are in every browser (checked); so is `inert` (from
  memory, not looked up that day). `interpolate-size` is not in Firefox or Safari: do not rely on it.
  Scroll-driven CSS animations only reached Firefox and Safari recently and are not needed here.
- Licences: `motion` MIT; `@number-flow/react` MIT (not used: its rolling digits show values in between);
  GSAP proprietary; Shepherd.js and Intro.js AGPL; `@maplibre/maplibre-gl-compare` is CommonJS and fails
  under Vite. Fontsource packages carry each font's SIL OFL 1.1.
- WCAG 2.2.2 (Pause, Stop, Hide): anything that starts by itself, lasts over five seconds and is shown
  beside other content needs a way to pause, stop or hide it.

## Appendix C: content the team may want to change (not part of this work)

- The layer titles "HH backscatter" and "HV backscatter" are jargon for a first-time visitor. They come
  from the site file; a plainer title with the code in brackets would help.
- Four on-screen descriptions still begin with the mark of unchecked text. A teammate reading and
  agreeing them, and the story's nine steps, removes every mark of unchecked text before the pitch.
- The tagline says "before dawn". The passes are at 00:13 UTC, 05:43 in India. That is before sunrise in
  the harvest months, but by the reviewer's own estimate (not from a source in this repository) the sun is
  already up at that hour from about early May to early August. Keep the phrase tied to the harvest, as
  the tagline does, and do not say it of the whole year. The story's first version above avoids it.
