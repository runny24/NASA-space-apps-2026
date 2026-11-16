# Design: how the interface looks, and how to add to it

Written 14 November 2026 with the design pass (branch `design-pass`). It covers the interface around the
map: everything in `src/styles.css`. Read it before adding a panel, a control or a chart, so new parts
match without a second pass.

**What the design never touches:** anything that shows data. The radar grey ramp, the class colours of a
layer, display ranges and overlay colours come from the manifest and `src/map/`; the stylesheet frames
them and does not recolour them. Words that describe data, methods and credits are restyled, never reworded
or hidden.

## The idea in five lines

1. **Quiet frame, loud data.** The interface is ink, white and grey. The only strong colours on screen
   belong to the data.
2. **Three roles of colour.** *Ink* (`--accent`) is what you press. *Blue* (`--data`, `--link`) is what the
   interface draws from data (chart lines, timeline marks) and links. *Amber* (`--highlight`) is where you
   are: the date on screen, keyboard focus, the point read on the map (the marker is the same amber).
3. **A dark band on top.** The header is dark in every theme, so the name reads as a title above the map.
4. **Honest states are part of the look.** A sample notice, a missing pass and a data credit each have a
   style of their own. None is ever hidden, shortened or shown only on hover.
5. **Tokens only.** Colours, sizes and spaces are custom properties on `:root`. A new rule uses them and
   never a literal colour, so both themes and the contrast tests keep working.

## Tokens

All in the first `:root` block of `src/styles.css`. The dark theme (`prefers-color-scheme: dark`) changes
tokens (colours, and the shadows deeper) and adds a hairline under the header; the map, its basemap and
every data colour are the same in both themes.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f1f3f5` | `#0f1318` | the page and the column behind the panels |
| `--panel` | `#ffffff` | `#1a1f26` | panels, controls, the dialog, boxes on the map |
| `--inset` | `#f4f6f8` | `#222831` | quiet areas inside a panel: notes, chart frames, a readout |
| `--text` | `#171b21` | `#e9ecf0` | text; whiskers and zero marks of the bars |
| `--muted` | `#55606b` | `#a4aeb9` | secondary text (4.5:1 on all three surfaces) |
| `--line` | `#dfe3e8` | `#2f3741` | hairlines that only separate |
| `--control-line` | `#7f8994` | `#77828f` | the edge of a control or a frame (3:1 on all three surfaces) |
| `--accent`, `--accent-hover`, `--accent-text` | ink, white text | near-white, dark text | the main button of a group; a switch that is on |
| `--link`, `--data` | `#0b5cad` | `#7db8f7` | links; marks drawn from data |
| `--bar` | `#7289ab` | `#6b82a4` | the bars of the statistics panel (neutral; 3:1 on the panel and under the whisker) |
| `--highlight`, `--focus` | `#ffb000` | same | where you are; the focus ring |
| `--focus-edge` | `#171b21` | `#0a0d11` | the dark bands of the focus ring; the rim of an amber mark |
| `--notice-bg`, `--notice-line`, `--warning` | pale amber, amber, brown | dark amber, amber, pale amber | sample notice, cautions |
| `--error`, `--error-bg` | red, pale red | pale red, dark red | problems |
| `--tick-available`, `--tick-missing` | blue, grey | light blue, grey | timeline marks |
| `--header-bg` | `#101820` | `#0a0d11` | the header band, and the tag on the map: dark in both themes |
| `--header-text`, `--header-muted`, `--header-line`, `--header-ring` | `#f5f6f8`, `#b4bcc6`, `#6f7985`, `#7cc4ff` | same | text, quieter text, a control's edge and the mark's ring on that dark |
| `--map-ink` | `#171b21` | same | text on MapLibre's white controls (the credit line) |
| `--dot-rim` | `#1b1f24` | same | the outline of an overlay's dot, as the map draws it |

The two `theme-color` metas in `index.html` repeat `--header-bg` (light and dark): change them together.

Type: system fonts only (`--font-ui`, and `--font-mono` for the date readout). Sizes: `--fs-caption`
(12 px: field labels, keys, credits, methods), `--fs-small` (13 px: secondary text, tables, notes),
`--fs-body` (15 px), `--fs-title` (16 px: panel titles), `--fs-site` (18 px: the place), `--fs-brand`
(20 px: the name). **1rem is 15 px here**, not 16 (the root is 93.75 %): 0.8rem is 12 px, and 0.75rem
would be 11.25 px. Nothing is smaller than 12 px, except the labels inside a line chart's own drawing: 11 px in its
320-unit drawing, so 10 to 11 px on screen in a side column 360 to 400 px wide.

Space: `--sp-1` to `--sp-6` (4, 8, 12, 16, 20, 24 px). Radii: `--radius-s` 4 px (swatches, the colour
scale), `--radius` 8 px (controls, notes, chart frames, boxes on the map), `--radius-l` 12 px (panels, the
dialog). Shadows: `--shadow-1` (panels), `--shadow-2` (things lying on the map), `--shadow-3` (the
dialog). Controls are `--control-h` tall: 36 px, and 44 px on touch screens and phone widths.

## Parts

### Panel

`<section class="panel" aria-labelledby="…">` with one `<h2>`: one subject per panel (the place and its
controls, the legend, a point, the statistics). White, 1 px `--line` border, 12 px radius, `--shadow-1`,
14 px of padding on top and 16 px on the other sides. Panels stack in `.side` with 12 px between them
(10 px on a phone). Inside a panel:

- text is `--fs-body`; secondary text takes `.muted`; small print (a method, a credit) is `--fs-caption`;
- a hairline (`border-top: 1px solid var(--line)`) separates two groups in one panel, as between the
  place's description and its controls, or between a layer's legend and an overlay's entry;
- `.note` is a neutral aside (grey bar on the left, `--inset` fill); `.warning` is a caution about the data
  (amber bar, pale amber fill); `.error` is red text, and a red callout when it stands between panels;
- `.eyebrow` is a small line above a title ("Step 2 of 4"); `.button-row` lays buttons side by side
  (neither is used yet; both follow the theme, so they suit a `--panel` surface, not a surface that is
  dark in both themes).

### Button

`<button>` is the main action of its group (Play, Close): ink fill, white text, 8 px radius, 600 weight.
`<button class="secondary">` is every other action: white, ink text, `--control-line` edge. One main
button per group at most. The header's About button is the secondary button in the header's colours.
Unavailable but focusable buttons use `aria-disabled="true"` (never `disabled` where focus must stay) and
fade by colour, not by opacity, so the focus ring stays strong.

### Menu and slider

`<select>` inside `.field` with a `<label>`: the browser's list in the app's frame. `<input type="range">`
takes the ink through `accent-color`. A field's label is `--fs-caption`, 600, `--muted`.

### Switch

For turning something on the map on or off (an overlay; `components/Overlays.tsx`). A real checkbox with
`role="switch"`, drawn as a switch:

```html
<label class="switch">
  <input type="checkbox" role="switch" />
  <span class="overlay-dot" style="background:#d55e00"></span>
  <span>Fire detections (VIIRS, NASA FIRMS)</span>
</label>
```

Off: white track, grey knob on the left. On: ink track, white knob on the right. The label says what is
switched, not "on" or "off", and is ordinary text, not a field's small label (`.switch` lays itself out
and is thumb-sized wherever it stands, in a `.field` or not). Keyboard, focus ring and
screen-reader state come from the checkbox; a contrast theme shows the browser's own checkbox. What the
switch changed is said in a line under it (`.overlay-caption`), in line with the name.

### Dates: stepper and timeline

Previous and Next are outlined arrow buttons (40 x 36 px; 44 x 44 on touch), the date between them is a
readout (`--font-mono`), Play is the main button. The timeline's marks are slim upright bars on a true time axis: filled blue for an
acquisition, taller amber with a dark rim for the date on screen, hatched with a dashed rim for a missing
pass, hollow for a date this layer lacks. A click or tap anywhere on the strip picks the nearest mark
(each mark has an invisible pad; see the comment above `.timeline`). Marks never animate.

### Legend entry

A class: `<li><span class="swatch" style="background:#…"></span>Label</li>` in `<ul class="classes">`. The
swatch is 14 px with a 1 px `--text` rim, so a pale colour does not vanish, and it keeps its colour in a
contrast theme. A continuous scale is `.ramp` (the gradient of the map's own stops) with `.ramp-labels`
under it. Under either: the description at `--fs-small`, then the method in small print under a hairline.

An overlay that is on gets an entry of its own under a hairline (`.legend-overlay`): its dot
(`.overlay-dot`: its colour with the map's dark outline, round like its points) and name, what it is, what
it is not, then method and credit in small print. The credit is always there in full.

### Charts

A series over time: `<figure class="series">` holds a `<figcaption>` (the title in `<strong>`, then unit
and region), the chart, and the method as `<p class="muted">`. The chart is an inline `<svg class="chart">`:
a framed figure on `--inset` with a 1 px `--line` border and 8 px radius; `.chart-grid` lines in `--line`,
`.chart-label` text at 11 px in `--muted`, `.chart-line` and `.chart-dot` in `--data`. A clipped value is
`.chart-bound`, an open triangle.

A comparison across categories: `<figure class="bars">` (`components/BarsFigure.tsx`). One row per
category: its label (with the class's `.swatch` where it has one), a bar in `--bar` from zero on a scale
the rows share, a whisker from low to high in `--text`, every number written out (the value semibold), and
a note. Above the rows, the scale in words (`.bars-scale`, small print): figures of one unit and layer
share one scale, and the line says so. A missing
value gets no drawing at all, never a zero-length bar. Every line of the drawing is a border, so a contrast
theme still draws it. The method folds under a native `<details>`. Its sizes are measured by
`e2e/bars.spec.ts`: change the look through tokens, not the geometry.

In both: no gradients, no shadows, no animation; nothing is drawn that the numbers do not say.

### At a point

The title carries the amber dot of the map marker. Coordinates are `.readout-where`; the line after them
is the value read, the largest number in the column, on a quiet box. That line has no class of its own (a
unit test matches its markup exactly): the stylesheet finds it as `.readout-where + p`. While another
date's value is read, "Value (date): reading…" stands in the same box at the same height, and the history
stays. The history table is `.history`; the fields of an overlay's nearest point are a two-column list
(`.point-fields`).

### On the map

Top left, in `.map-notes`, clear of MapLibre's buttons, from the top:

- **The tag** (`.map-showing`): "On the map: HH backscatter, 2026-11-04", the layer and the date of the
  picture actually drawn. Always there, plain text on a dark plate in the header's ink (`--header-bg`,
  `--header-text`) in both themes, so it reads on the light basemap and on a dark radar picture, and
  differs from the boxes under it, which come and go.
- **The caption** that says what an overlay's dots are (`.overlay-map-caption`) and the **"Loading the
  picture…" note**: boxes on `--panel` with a 1 px `--control-line` edge, an 8 px radius and `--shadow-2`.

On a phone the caption is in a strip under the map (`.map-notes-under`), never on it; on a short map the
loading note goes there too, and the tag stays on the map. Nothing of the app that lies on the map may take
a tap meant for the map: `pointer-events: none` (the caption box on a desktop is the one exception, because
it scrolls). Where all three lie is checked by `e2e/overlay.spec.ts` and `e2e/real-lengths.spec.ts` (they
must fit beside the map's own controls on a phone): keep their padding and type size.

On a short map (400 px or less: a phone held sideways) MapLibre's two zoom buttons sit side by side, so
the scale does not lie over them, and `.map-notes` leaves room for the wider pair.

MapLibre's own buttons, scale and credit line stay light in both themes, with dark text (`--map-ink`). The
credit line is never hidden or shortened; on a narrow or short map it takes at most 35 % of the map's
height and scrolls inside itself.

## Layout

- Desktop: header, then the map beside a side column `--side-width` wide (30 % of the window, between 360
  and 400 px; narrower, the date readout would not fit), which scrolls by itself.
- Up to 760 px wide: the map on top (55 % of the height, never all of it), the panels below, in one
  scrolling column (`.main`). The sample notice stays above it.
- Touch screens and phone widths: every control is at least 44 px tall and wide.
- The page itself never scrolls. `.side` is positioned so that `.visually-hidden` text inside it (which is
  absolutely positioned) stays in the column; outside `.side`, give the panel that holds such text
  `position: relative` (see below).
- `.main` and `.app` are not positioned. On a desktop `.main` is a flex row whose only flexible child is
  the map: a new child beside `.side` takes its width from the map (a 384 px panel leaves the map 512 px
  of 896). To lay a panel over `.side` instead, give `.main` `position: relative` in your own stylesheet
  and the panel `position: absolute; top: 0; right: 0; bottom: 0; width: var(--side-width); overflow-y:
  auto`; without the positioned `.main` such a panel would cover the header. On a phone `.main` is the
  scroller: keep a new panel in the flow, so that `position: sticky; bottom: 0` inside it sticks to the
  window, and raise `.main`'s `scroll-padding-bottom` by the height of a sticky bar.

## The story and the tool, and who owns what

The bare address opens a cover and a guided story (`src/story/`); `story=off` opens the tool. The story
session leads on what the site shows, so the design fits its structure: where the two meet, its markup
wins and these tokens dress it.

| File | Owns |
|---|---|
| `src/styles.css` (this document) | the tool: tokens, header, panels, controls, legend, charts, the map's notes, both themes, contrast themes, the reduced-motion rule |
| `src/styles/motion.css` | all motion, tool and story: the duration and easing tokens (`--dur-*`, `--ease-*`, `--stagger`, `--rise`), buttons easing their colours, the folds opening, the dialog and panels arriving, the marker's ring; and the structure of the tool's folds (`.series-method`, `.legend-method`, `.missing-reasons`, `.missing-count`) |
| `src/story/story.css` | the story's surfaces, dark in every theme, with their own tokens (`--story-*`, `--night`, `--font-display`, `--font-figures`); everything under `.app[data-story]` and `.story-*`; the header's `.header-actions` wrapper |

`styles.css` sets no transition of its own any more (motion is `motion.css`'s), and never styles `.story-*`
or `.app[data-story]`. The folds are dressed here only in size: their summaries read at `--fs-small`
(a method) or `--fs-caption` (the missing passes), never under 12 px.

## Building on this from another stylesheet (the story, motion)

New parts with their own files (`src/story/story.css`, `src/styles/motion.css`) use these tokens by name
and add their own in their own `:root` block, never in the first `:root` block of `styles.css`, which the
tests parse. **Import them in `main.tsx`, on a line after `import './styles.css'`.** `main.tsx` imports
`App` before `styles.css`, so a stylesheet imported from a component lands before `styles.css` in the
page and loses every tie with it (that is also why MapLibre's own stylesheet comes first).

| Need | Use |
|---|---|
| Space | `--sp-1` to `--sp-6` (4 to 24 px) |
| Corners | `--radius-s` (4), `--radius` (8), `--radius-l` (12) |
| Lift | `--shadow-1` (a panel), `--shadow-2` (on the map), `--shadow-3` (over the page) |
| Type sizes | `--fs-caption` (12), `--fs-small` (13), `--fs-body` (15), `--fs-title` (16), `--fs-site` (18), `--fs-brand` (20); mind that 1rem is 15 px |
| Faces | `--font-ui`; `--font-mono` for figures that must not jump |
| A control's height | `--control-h` (36 px, 44 on touch) |
| A surface that is dark in both themes | `--header-bg` with `--header-text`, `--header-muted` for quieter text and `--header-line` for a control's edge (all checked for contrast on it) |
| Where you are (the step, the date) | `--highlight`; on a light surface give it a `--focus-edge` rim |
| Surfaces that follow the theme | `--panel`, `--inset`, `--bg` with `--text`, `--muted`, `--line`, `--control-line` |

`--text`, `--muted`, `--link` and everything built on them (`.muted`, `.eyebrow`, `.note`, links, headings)
follow the theme. On a surface that is dark in both themes they fail in the light theme (`--muted` is
2.97:1 and `--link` 2.86:1 on `#0b1016`): use that surface's own text tokens there, and give it
`color-scheme: dark` so its scrollbar and native controls are dark too. A size of 0.75rem is 11.25 px
here: for small labels use `var(--fs-caption)` (12 px).

What a new part must keep, because a test or a person depends on it:

- **Buttons.** Every `<button>` takes the app's look: ink fill for the main action, `class="secondary"`
  for the others. The plain button's pointer rule is `:where(button):hover`, which weighs one class, so a
  part's own one-class button rule (the story's `.story-cta`, `.story-quiet`) wins over it when its
  stylesheet comes later, as `story.css` does. The other global rules still weigh one element and one
  class or more: `button.secondary`, `button.secondary:hover` and `button[aria-disabled='true']` (0,1,1
  at least) beat a one-class rule whatever the order. So on a new surface do not use `class="secondary"`
  for its own buttons, and if a button there can be unavailable, give it an `[aria-disabled='true']` rule
  of its own, written as `.story-panel button.story-back` or stronger. The header's colours for a button
  (transparent, `--header-text`, a `--header-line` edge) come from `.header button.secondary` and apply
  nowhere else. A button that should not look like one resets padding, minimum sizes, border, background
  and `transition`, as `.tick` does, and has hover rules of its own, as `.timeline button.tick:hover` has.
- **Focus.** Never remove an outline. `:focus-visible` draws the amber ring with dark edges on everything;
  on a dark surface the amber alone shows, which is enough.
- **Motion.** Motion lives in `styles/motion.css`, inside `@media (prefers-reduced-motion: no-preference)`.
  The last rule of `styles.css` also sets every transition and animation *duration* to 0 s under
  `prefers-reduced-motion: reduce`. It keeps delays (`.picture-loading` relies on its 400 ms delay) and
  does not reach `Element.animate()` or MapLibre's camera: reset the delays of your own staggered classes
  under the same query, and check the setting in script before animating. A date change, a timeline mark,
  a chart and a bar never animate, with or without that setting.
- **Hidden text.** `.visually-hidden` is absolutely positioned. Outside `.side` it needs a positioned box
  round it (`position: relative` on the new panel), or the page scrolls into blank space on a phone
  (`e2e/layout.spec.ts`).
- **On the map.** `pointer-events: none`, clear of MapLibre's three controls (zoom top right, scale and
  credit line bottom right; the bottom left is free), and inside `.map-wrap`. The tag `.map-showing`
  already names the layer and the date drawn. It is rendered only inside `.map-notes`, which is itself
  absolutely positioned at the top left, so CSS cannot move it to another corner: a date stamp elsewhere
  is its own child of `.map-wrap`, or a change to `App.tsx`. With the story closed, `e2e/overlay.spec.ts`
  needs the tag on the map at 375 x 740 and 667 x 375, clear of the zoom buttons, the scale, the credit
  line and the loading note, and on a desktop first in the notes, above the caption.
- **The frame.** One `<header>` element (`e2e/startup.spec.ts` and `e2e/layout.spec.ts` find it by tag,
  in strict mode): use a `div` for a heading block inside a panel. On a desktop the header is a flex row
  (name and tagline, then `.header-actions` with About and Story); on a phone it is a grid: the name and
  `.header-actions` share the first row and the tagline runs under them (hidden while the story is
  open). A new header button goes into `.header-actions` with `class="secondary"` (a plain button there
  is ink on near-black in the light theme). Every pixel of the phone header is taken from the map and
  the story's first screen: `e2e/story.spec.ts` needs the cover's title wholly in view at 375 x 667. The page itself
  never scrolls: `.side` does on a desktop, `.main` on a phone.
- **Colours.** Interface colours are never data colours: `#d55e00` (the fires) and the class colours come
  from the manifest.

## Accessibility, and what proves it

| Rule | Proof |
|---|---|
| Text 4.5:1, marks and control edges 3:1, in both themes | `tests/unit/colours.test.ts`, `tests/unit/theme.test.ts` (computed from the tokens) |
| A visible focus ring on every control: amber between two dark bands | `e2e/accessibility.spec.ts` ("Tab reaches every control"), `e2e/overlay.spec.ts`, `e2e/bars.spec.ts` |
| 44 px touch targets; a tap on the timeline picks the nearest mark | `e2e/accessibility.spec.ts`, `e2e/overlay.spec.ts`, `e2e/bars.spec.ts` ("on a 375 px phone") |
| Contrast themes (forced colours): swatches, dots and the colour scale keep their colours; a timeline mark stays filled, hollow or dashed; bars and callouts keep a rim | `e2e/static-layer.spec.ts`, `e2e/bars.spec.ts`, `e2e/accessibility.spec.ts`, `tests/unit/theme.test.ts`, section 16 of the stylesheet |
| Reduced motion: nothing animates | `e2e/accessibility.spec.ts`, `e2e/play.spec.ts`, `e2e/bars.spec.ts` |
| Keyboard order follows the page: header, map, panels top to bottom | `e2e/accessibility.spec.ts`, `e2e/overlay.spec.ts` |
| The page itself never scrolls | `e2e/layout.spec.ts` |

A new colour pair needs a line in `tests/unit/theme.test.ts`. A new control needs a focus ring (it has one
unless a rule removes the outline) and 44 px on touch (it has it if it is a `button`, a `select`, a range
input or a `.switch`).

## Do not

- write a literal colour in a rule (use a token; add one if a role is new, in both themes);
- colour the interface with data colours, or data with interface colours;
- hide, fade or shorten a sample notice, a missing pass or a credit;
- add a web font, an icon set or an image without an open licence and a line in `docs/SOURCES.md`;
- animate a date change or a chart, or anything that reduced motion should stop without the global rule
  catching it.
