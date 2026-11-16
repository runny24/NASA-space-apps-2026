# Motion and the guided story

The rules for anything that moves in this app, then the guided story as built (slices 1 to 3 of
`docs/MOTION_AND_STORY_BRIEF.md`: the steps, the night map and the camera, the real sequences), the
tests that hold it to the rules, what came from the first guided tour, and what is not built yet. The brief is the specification; where this file and the code disagree,
the code is what runs and this file is out of date.

## The rules (section 4 of the brief)

These come before every later instruction. They turn "honest data" into rules for motion.

1. **A measurement is shown or not shown. It never tweens.** No fade, cross-fade or blend between two
   radar pictures, ever: a frame that mixes two dates is a picture no satellite took, and it would
   paint over a missing pass. `map/dataLayers.ts` guarantees it (`raster-fade-duration: 0`, a zero
   opacity transition, the old picture removed in the frame the new one appears) and
   `tests/unit/dataLayers.test.ts` pins it. No raster fades in or out, not even the first one.
2. **A date change is instant everywhere**: the picture, the timeline mark and the date readout
   change in the same frame. No gliding playhead, no rolling digits (`e2e/play.spec.ts` pins that
   `.tick-current` has no transition or animation).
3. **Charts and numbers appear whole.** No bar grows, no line draws itself, no number counts up: each
   would show values the data does not contain (`e2e/bars.spec.ts`). A figure may fade or slide in as
   one block; marks may appear one whole mark at a time.
4. **A sequence may build up real things in their true order**, because every state it passes through
   is real: the dates of a layer in order, the classes of a map in legend order, fire detections day
   by day, the points of a series pass by pass. Each state says on screen what it is.
5. **The name on screen is the name of what is drawn.** The date stamp names the picture the map has
   drawn (`onPictureShown`), never the date just asked for. While the new picture loads, the stamp
   keeps naming the picture still on the map; once that has left the map it says "Loading the
   picture…" and names no date. The "Loading the picture of <date>…" note stays where the tool has it.
6. **What may move freely:** the camera; the frame (panels, cards, the cover, drawers, the dialog, the
   night over the basemap); words; focus and highlight rings; things that carry no data and cannot be
   taken for data.
7. **No decoration that looks like data.** No smoke, flames, particles, radar sweeps, satellite icons,
   glows around fire dots or heat hazes. A visitor must never wonder whether a moving thing was
   measured.
8. **Interface colours are not data colours.** The fire dots are `#d55e00` and the harvest classes are
   the viridis colours of the manifest: no button, ring or progress bar uses those. "Where you are" is
   the app's amber, `#ffb000` (`tests/unit/storyColours.test.ts` checks the story's tokens).
9. **Nothing moves for more than five seconds by itself without a way to stop it** (WCAG 2.2.2). Every
   sequence has a visible Pause, and the right arrow finishes it. Nothing loops.
10. **Reduced motion means no motion**, and the story still works as plain steps. `styles.css` sets
    every duration to 0 under `prefers-reduced-motion`; the camera jumps (never `essential: true`).
11. **Honest states are never covered, hidden or shortened**: the sample notice, the mixed-release
    warning wherever dates are compared, the sentence that an overlay is "not a NISAR
    measurement", the missing-pass marks, the map's credit line.

## The story as built (slices 1 to 3)

The story is data: the site's `story` in the manifest (contract rule 12). Nothing in the engine is
keyed on a step's id or on a site. Everything is in `src/story/`:

| File | What it holds |
|---|---|
| `storyModel.ts` | Pure, unit-tested: `stepStates` (each step's resolved state), `stepSelection`, `planStep` (rules 2 to 4 of section 7.3), `coverFigures`, `coverEyebrow`, `stampText`, `stampDrawnDate`, `stepAnnouncement`, `storyParagraphs`, `safeView`, `siteCamera`, `openingIndex` |
| `storyUrl.ts` | `storyIntent` (what the address asks) and `storyQuery` (the query while open) |
| `timing.ts` | The constants of section 6 (`CAMERA_FLY_MS`, `CAMERA_EASE_MS`, `CAMERA_FLY_ZOOM_CHANGE`, `NIGHT_MS`, `OUTLINE_FADE_MS`, `RING_ECHOES`, `COVER_SITE_OFFSET`, `FIRE_DAY_MS`, `CLASS_BEAT_MS`, and the playback pace re-exported) |
| `stage.ts` | Everything the story does to the MapLibre map: `inert` on the canvas container and the zoom corner, the camera (`go`, `finish`), the night and the marks (through `stageLayers.ts`), and `leave()`, which gives all of it back and removes every `story-` layer and source; `frameForTool`, which frames the site for the tool (a jump) when the story closes from the cover |
| `stageLayers.ts` | The three things the story draws that are not data: the night (`fallNight`, `liftNight`), the site's outline and the cover's ring |
| `sequence.ts` | Pure, unit-tested: what a step plays (`stepSequence`), the map state of each frame (`frameState`), the button's words (`sequenceLabel`), the build's calendar (`buildClock`, `clockDay`) and its caps (`capsAt`) |
| `useStory.ts` | The state machine, owned by `App.tsx` |
| `Story.tsx` | The story's error boundary and `useStoryFocus` |
| `StoryCover.tsx`, `StoryPanel.tsx`, `StoryProgress.tsx`, `DateStamp.tsx` | The interface |
| `story.css` | Its tokens and styles; any CSS motion goes through classes (`styles/motion.css`), so reduced motion zeroes it |

**A step's state is deterministic.** `stepStates` folds once from what the site opens with (its first
layer, the newest date, no overlay): each step changes only what it names (layer, date, pair) and
sets its overlays (none when it names none). So a step without a layer keeps the layer and a step
without a date keeps the date, and Next, Back, a jump on the progress bar and a reload at
`story=<id>` all show the same picture for a step. A name the site lacks keeps what is shown. "Explore
the map" closes the story and keeps the step's selection; the camera stays where the step put it.
Except on the cover, whose far view and first date are no place to start exploring: closing from the
cover, by any way (its "Explore the map", Escape, an error), gives the tool what a visitor who opens
it directly gets, the site's first layer at the newest date with no overlay (`resolveSelection`) and
the site framed as MapView frames it (`siteCamera`, `frameForTool` in `stage.ts`: a jump, after the
map has taken the tool's size again).

**The state machine** (`useStory`): `status` is `pending` from the first frame when the address asks
for the story and the manifest is not here yet, then `open` when the site has steps, else `closed`
(silently). `index` (0 is the cover), `phase` (`moving` until the map's `moveend`, then `playing`
while a sequence runs, then `resting`), `run`, which counts every entry into a step, and `play`, the
sequence under way (its part, frame or tick, and whether it is paused). Entering a step stops the
tool's playback and sets the selection through App (`apply`); the camera moves once MapView has
framed the site (`onFramed`). Every effect cleans up after itself (a listener or a stage per effect),
so a step can be left at any moment and strict mode leaves nothing behind. What the story does to
the map goes through `stage.ts` inside try/catch: a throw is logged and the story closes. When the
manifest arrives, `arrive()` returns the opening step's selection, so no other date's picture is
fetched or shown before it.

**The address.** `story=off`: the map, as before. `story=<id>`: that step (an unknown id: the cover),
whatever else the query holds. No `story`: the map when the query names any of `site`, `layer`, `date`,
`pair`, `overlays`, `lon`, `lat`, `z` or `play` (old shared links keep working), else the cover. While
open, the address carries `story=<id>` and no selection (and `site=` only when the story's site is not
the one a bare address opens); on closing `story` leaves and the usual parameters return. Browser
tests that are about the map open `./?story=off`.

**Keys**, on the window while the story is open: Right and Page Down go on (on the last step, close),
Left and Page Up go back, Home returns to the cover, Escape closes. They stand down while the About
dialog is open, with a modifier key held, and in text fields and menus. The tool's own arrow keys
stand down while the story is not closed.

**Focus and what a screen reader hears.** Opening focuses "Start the story" (the cover) or Next (a
step). After a step change focus stays on a control of the story's navigation that still exists (Next
is the same element from step to step), otherwise it goes to the primary button. Closing focuses
`#site-title`. Every focus the story sets uses `preventScroll`, and on opening and on every step the
column (`.main` on a phone) and the panel go back to the top. One persistent polite live region in
App says "Step 3 of 9: <title>", then "Exploring the map".

**Layout.** On a desktop the panel lies exactly over the side column, which stays in the page under
it, inert; the map keeps its size; the cover is a scrim over the map at the stacking level of the
notes, so MapLibre's corners and its credit line stay above it; the zoom buttons are hidden and
inert. On a phone (760 px and narrower) the side column is not shown, the panel is in the flow under
the map with a sticky bar of 44 px buttons, the map is 40vh (at least 180 px) and the tagline is not
shown while the story is open, and nothing of the story lies on the map.

**The date stamp** is the map's own tag in the story's look: App renders either the tool's tag or the
stamp, never both, from the same `pictureShown`. On a desktop it is first in the notes on the map (top
left, where the tag is), clear of the credit line, which runs along the whole bottom of the map with
a long citation; on a phone it is in a strip under the map. It carries `data-drawn-date` and
`data-drawn-layer`, which `e2e/story.spec.ts` compares with the file the map draws in every frame.

**The panel** carries, by what the step shows (never by its id): the eyebrow, the title and text, on
the cover the real figures (passes, missing passes, each overlay's count, as plain
numerals), the classes of a layer with classes, an overlay's caption with its "not a NISAR
measurement" sentence and its credit in full, the mixed-release warning on every step of a
mixed-release site, the cover included and whatever the layer (a static layer of such a site, such as
a harvest map, is itself built by comparing passes of both releases, and the tool's own warning is
asleep under the panel), and the site's data credit on every step.

**The night map.** While the story is open the basemap goes dark under the data: one `background`
layer, `story-night` (`--night` at `--night-opacity` from `story.css`), goes just below the first
`data-` raster, or where `beforeIdFor('data', …)` would put one; the basemap's symbol layers get
light place names (`#d7dee6` with a dark halo), their own `text-color` and `text-halo-color` (or none,
when they had none) remembered once. Only `background-opacity` moves, over `NIGHT_MS` (900 ms), at once
under reduced motion. On closing the labels get their colours back at once and the night lifts over
900 ms and is then removed, so "no `story-` layer is left" holds about a second after closing. The
style URL never changes and `setStyle` is never called. No data layer is touched: the rasters keep
`raster-fade-duration: 0` and a zero opacity transition.

**The camera.** The step the story opens at (a bare address, `story=<id>`, the Story button) is jumped
to; a step reached from another step is glided to: a flight (`flyTo`, `CAMERA_FLY_MS`, curve 1.42) when
the zoom changes by more than `CAMERA_FLY_ZOOM_CHANGE` (3), else an ease (`easeTo`, `CAMERA_EASE_MS`,
an ease-in-out cubic). A step's target is its `view`, else the site's, else the site's bounds with
40 px padding. On a desktop the cover lands the site right of the map's centre, by
`COVER_SITE_OFFSET` (0.24) of the map's width, clear of the cover's words. Never `essential: true`;
under reduced motion every move is a jump. Arrival is the map's `moveend` (a jump fires it too).

**The marks.** On arrival the site is marked: on the cover a ring at its centre (`story-site`, amber,
stroke only), with an echo (`story-site-echo`) that spreads and fades `RING_ECHOES` (3) times and is
then removed; on a step its outline (`story-outline`, white, 1.5 px, fading in over 400 ms). Never both;
under reduced motion no echo and no fade.

**The layer order** (`map/layerOrder.ts`): basemap fills and lines, the night, the data rasters, the
overlay circles and the story's outline and ring, the basemap's labels. A raster added later (each
date of a layer with more than 12 dates gets a fresh one, so every pass of a flip-book does) goes
below the circles and the marks, and so above the night.

**The sequences** (`sequence.ts`; rules 3 and 4 of section 7.3). Coming forward by one step (Next, the
right arrow, Page Down, Start on the cover, or the next segment of the progress) to a step whose plan
has frames plays them, a flip-book of hard cuts: each frame is asked for, waits until the map has its
picture on it (`picture`, the map's own report), then dwells `PLAY_DWELL_MS` (700 ms), and is given up
after `PLAY_CEILING_MS` (8 s) when it never comes, as the tool's playback does; while frames play, the
overlays still to build are off. Then a step that switches on an overlay with a `date_property` builds
it one real day per `FIRE_DAY_MS` (120 ms) tick, days without a point included, once the overlay's file
has answered and the step's picture is drawn. The cap of each building overlay comes from
`story.capOf`, which App gives to `overlayView`, so the caption's count and the map's filter come from
one capped window at every tick; `MapView` sets the overlays in a layout effect, so the filter changes
in the same commit as the caption. The last tick shows the whole period, which is the step at rest.

**The button and the line.** `story-play`, between Back and Next on every step that has a sequence,
reads "Pause" while it runs, "Play" while paused, "Play again" once it has ended, and "Play these N
passes" or "Play day by day" when the step was reached any other way (Back, a segment further away, a
reload at `story=<id>`) or under reduced motion: then nothing starts by itself and the step shows its
final state at once. `story-sequence` says, while a sequence is under way, "Pass k of N", where k is the
place of the picture the map has DRAWN (nothing while a picture loads), or "Day k of N: <day>".

**Next during a sequence** (or the right arrow, or Enter on Next) ends it at the step's real final
state (its own picture and overlays, the camera landed where it was going); the next press goes on.
Next during a plain camera move goes straight on. Back during a sequence goes back at once. Closing
during a sequence (Escape, "Explore the map") leaves the step's final state on the map and in the
address, never the pass or the day the sequence had reached.

**Reduced motion**, read at the moment of acting (`prefersReducedMotion()`): no sequence starts by
itself (a press of the button plays it, as hard cuts), every camera move is a jump, the night falls and
lifts at once, the ring does not pulse, the outline does not fade.

## How the tests hold the story to the rules

`e2e/story.spec.ts` runs on the SYNTHETIC year site. Its flip-book tests serve the fixture's story with
the cover on an earlier date (through `page.route`, in the test's browser only), so that Next from the
cover plays five passes across two missing ones; the fixture's own last step builds its points over
eleven days. They record what the page shows in every animation frame and check, in every frame: the
stamp names the picture the map draws (never a date before its file was drawn; a lag of at most 100 ms
after a swap), and "Pass k of N" names its place, also with one pass's file held back (the stamp then
keeps the pass before, then says it is loading, and the sequence goes on after the ceiling); the
caption's count on the map and in the panel equals the points the map's filter lets through (by
MapLibre's own filter evaluator on the fixture file), in every frame and at every change of the page,
never goes down, and the day line names the filter's last day; the mixed-release warning and the
overlay's sentence and credit are in view whenever they apply; under reduced motion the
camera never moves and nothing has a duration or a delay (but the loading note's own 400 ms delay);
after closing, from the cover, a step or the middle of either sequence, no `story-` layer or source is
left within 2 s and the labels are as on a page that never opened the story. Each of these was seen to
fail with its rule broken in the code. `atRest` waits until no sequence runs, the site is marked and
the camera is still. `tests/unit/storySequence.test.ts` and `tests/unit/storyStage.test.ts` (against a
fake map that keeps its layers in order) pin the pure parts and the stage.

## The first guided tour (pull request 4) and what was kept

Before this work, the web agent on the team's second account built a guided tour (pull request 4,
branch `web-features`, written to an older spec without this brief): `src/state/story.ts`,
`src/components/StoryPanel.tsx`, a `step` URL parameter and a `viewRequest` prop on MapView. It was
merged into this branch (merge commit "Merge story-slice1 …") and replaced, so that one story ships.

**Kept from it:** its fallbacks for a hand-edited story (a step without an id, title or text is
skipped, a story that is not a list is none, a name the site lacks keeps what is shown, a view the map
cannot show counts as none); a step's text as paragraphs; and, among its
fixes unrelated to the tour, the fixture guard that reads a dropped manifest body again from the
server (`e2e/support.ts`), the three page-scroll tests in `e2e/bars.spec.ts`, the `.side`
containing-block rule, and the forced-colours rule that draws an unavailable button in `GrayText`
(its test is now in `e2e/accessibility.spec.ts`). The cases of its tests that the brief keeps were
ported to `tests/unit/storyModel.test.ts` and `e2e/story.spec.ts`.

**Dropped, because the brief reverses them:** every control staying live during a step (the brief
puts the tool to sleep, so the text never describes a state the visitor changed); `step` in the link
beside a selection (now `story=<id>` alone); a link with only a site, a view or `play=1` starting the
tour (such links open the map, so old shared links keep their meaning); `flyTo` with `essential: true`
(it overrides MapLibre's own reduced-motion jump); a step without a view leaving the camera where the
previous step put it (the camera then depended on the path through the story; now such a step frames
the site); "Explore freely" leaving one "Guided tour" button that returns to the step left (now a
"Story" button in the header opens the cover); the announcement reading the whole step text (60 to 80
words on the real texts; now the count and the title); and its blue accent (the
brief reserves amber for "where you are").

## The year as a curve (slice 5)

The layer's dB series in `stats.json` (`curveSeries` in `state/timelineCurve.ts`: the first series
whose `layer` is the layer's id and whose unit is dB, so `hh-mean` for HH) as a thin line with a dot
per pass (`components/YearCurve.tsx`).

- **Above the date stepper's marks**, on their true time axis (`TimelineEntry.position`): the plot is
  exactly as wide as `.timeline`, so each dot stands right above its mark. The highest and lowest
  values with the unit at the left edge, faint dashed rules at those two levels, month names under
  the marks (`monthTicks`, from a fixed English list, never a locale). Aria-hidden: the full chart
  with its numbers is in Statistics; the marks stay the controls, their markup and every `.tick`
  rule unchanged. A layer without such a series has no curve, and nothing else changes.
- **As a story step's figure** (`story/StoryCurve.tsx`), on every step but the cover whose layer has
  such a series (chosen by what the step shows): the same curve, captioned with the series' title
  and unit, revealed up to the picture the map has drawn (`revealedItems`, then `revealedCurve`):
  the passes dated on or before it, and only while it is a picture of the step's layer that did not
  fail. So in a flip-book whole points and whole segments appear as each picture is drawn, one pass
  at a time; the frame and the labels never move. The picture on the map is the one amber dot.
- **Honest:** only `timelineCurve`'s segments are drawn, one line each, never one polyline, so the
  line breaks at every missing pass, date the layer lacks and null value. Static: no transition and
  no animation anywhere on it (`styles/curve.css`, which also holds its story styles and its
  forced-colours rules). `stats.json` is read once per site (`components/useStats.ts`) and shared
  with the Statistics panel. Tests: `tests/unit/timelineCurve.test.ts`, `tests/unit/yearCurve.test.ts`
  and `e2e/curve.spec.ts` (honesty test 3, and the reveal checked in every animation frame).

## Not built yet

- **The optional ring on the day just added** (`story-fires-today`) of slice 3.
- **Slice 6, the harvest wave building class by class: cut** (the lead's decision, 14 November). The
  engine still plans it (`StepPlan.classes`) and `stepSequence` ignores it, so the harvest-wave step
  shows the whole map at once, which is the published map.
- **Slice 7** (a hands-free run, a swipe between two dates, a globe on the cover): not started.
