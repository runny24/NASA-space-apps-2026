# Web app

Static Vite + React + TypeScript app. It reads `public/data/manifest.json` (written by the pipeline;
see `../docs/DATA_CONTRACT.md`) and nothing else about the data.

## Commands (run in `web/`)

| Command | Does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` / `npm run preview` | Production build in `dist/` / serve it on http://localhost:4173 |
| `npm run lint` | ESLint, then `tsc --noEmit` |
| `npm test` | Vitest unit and contract tests (offline) |
| `npm run e2e` | Playwright browser tests against the production build (build first): all on the SYNTHETIC fixtures, but for one smoke test on the build's own real data |
| `npm run gen:contract` | Regenerate `src/contract/*.generated.ts` from `../contract/*.schema.json` (`-- --check` fails if stale) |
| `npm run fixtures` | Write the SYNTHETIC test fixtures to `tests/fixtures/synthetic-out/` (git-ignored; the browser tests do this themselves) |

From the repository root:

- `npm run dev`, `npm run build`, `npm run preview` and `npm run gen:contract` do the same as here.
- `npm run e2e` builds first, then runs the browser tests.
- `npm run lint` and `npm test` also run the Python checks (ruff and pytest) before the web ones.
- `npm run fixtures` exists only here, in `web/`.

### What the browser tests run on

`e2e/` tests the unchanged production build (`dist/`). Every test but one runs on the SYNTHETIC
fixtures of `tests/fixtures/synthetic.mjs`, not on the data in `public/data/`, so they do not depend on
whichever real or sample sites the build carries. The one exception, `e2e/real-data.spec.ts`, is a
smoke test on the build's own data (see below).

- Playwright's global setup (`e2e/global-setup.ts`) writes the fixtures, with the same function as
  `npm run fixtures` (`tests/fixtures/write-fixtures.mjs`). No extra step, in a fresh checkout or in CI.
- `playwright.config.ts` starts `npm run preview` with `SERVE_FIXTURES_AS_DATA=1`. The fixture server
  (`scripts/serve-synthetic-fixtures.ts`) then also answers `/data/` from the fixture folder, in front of
  the build's own `data/`: a file the fixtures lack is a 404, never the real file. Without the variable
  nothing changes.
- The bare address (no site, layer, date, pair, overlays, lon, lat, z or play) opens the guided story's
  cover on a site that has a story, and the fixture year site has one (`e2e/story.spec.ts`; the rules
  are in `web/MOTION.md`). A test that is about the map and not the story opens `./?story=off`, or any
  link that names a site or a selection.
- The tests open `./` and read the manifest the page loads, like a visitor. `e2e/support.ts` fails any
  test whose page loaded a manifest that is not the synthetic one, so a mis-wired server cannot make
  them run on real data unnoticed. Import `test` and `expect` from `./support`, not from `@playwright/test`.
- One test, `e2e/real-data.spec.ts`, runs on the build's own data instead, in a second Playwright project
  ("real-data") against a second preview server on **port 4174**, started without the fixtures. The
  fixtures are small, uncompressed and untiled; the real files are compressed, tiled COGs read by range
  requests, and only this test goes through that path. It opens the first real site, checks that the map
  draws, that another date draws another picture, that a click reads a value in dB, that the rasters are
  answered with 206 and that the console stays clean, all from the manifest it gets. It skips, saying
  why, when the build has no real site. It is outside the fixture guard (it imports `test` from
  `@playwright/test`), and its server is given `SERVE_FIXTURES_AS_DATA=0`.
- The first fixture site, `synthetic-year`, is shaped like the real data will be: 30 pass slots with 4
  missing passes, two per-date layers (one lacks an acquisition), a static class layer, a points overlay,
  a four-step story and two bars entries of one unit and layer (the second's values far smaller). Tests take its ids, dates and counts from the exports of
  `tests/fixtures/synthetic.mjs`, never from literals. `tests/contract/fixture-rules.test.ts` keeps it
  valid against the contract.

To look at the fixture site yourself, first write the fixtures with `npm run fixtures` (only the browser
tests write them on their own; without them the app finds no fixture manifest to load). Then either:

- in development, `npm run dev` and open http://localhost:5173/?manifest=synthetic-fixtures/manifest.json, or
- on the production build, `npm run build`, then start the preview with `SERVE_FIXTURES_AS_DATA=1` set in
  the environment, for example in PowerShell `$env:SERVE_FIXTURES_AS_DATA = '1'` before `npm run preview`.
  The variable stays set in that window, and every later `npm run preview` or `npm run dev` there serves
  the fixtures at `/data/` instead of the real data (the server log warns, and the page shows the
  SYNTHETIC notice). Run `Remove-Item Env:SERVE_FIXTURES_AS_DATA`, or open a new window, to get the real
  data back.

### Browser for `npm run e2e`

The browser tests use Google Chrome when it is installed. Without Chrome, install Playwright's
Chromium once, from inside `web/` so its version matches `package-lock.json`:

```
npx playwright install chromium
```

(In CI the tests always use that Chromium.) The tests start their own two servers, on ports 4173 (the
fixtures) and 4174 (the build's own data), and stop with "http://localhost:4173/ is already used" (or
4174) if something else is listening there: stop it first (often a forgotten `npm run preview`).

To point a production build at another manifest, set `VITE_MANIFEST_URL` when building.

## Where things are

| Path | What |
|---|---|
| `src/contract/` | Generated types, manifest loader and guard, encoding maths (codes to dB), the overlay file loader (`overlay.ts`), the stats loader (`stats.ts`, which also checks the shape of `bars`) |
| `src/map/maplibre.ts` | The one MapLibre + cog:// setup (namespace import, worker URL, protocol) |
| `src/map/dataLayers.ts` | Data layer on the map; flicker-free date switching; says when a date's picture is drawn |
| `src/map/overlayLayers.ts` | Overlays on the map: one GeoJSON source (its credit as attribution) and one circle layer each, filtered to the period |
| `src/map/layerOrder.ts` | The one rule for the stack of map layers: data rasters, then overlay circles, then the basemap's labels |
| `src/map/nearestPoint.ts` | The nearest drawn overlay point to a click, within 12 screen pixels |
| `src/map/switching.ts` | How dates are switched: preload up to 12 files, else one source at a time (and how long a previous picture may stay) |
| `src/map/ramps.ts` | Colour ramps and `cog://` URLs (ramp limits are pixel codes) |
| `src/map/stackQuery.ts`, `inspect.ts` | Click readout and a point's history from the stack file |
| `src/state/` | URL state (shareable links), the timeline, playback's decisions (`playback.ts`: next date, stop, dwell and ceiling), and the overlays: which points go with the date and what the captions say (`overlayPeriod.ts`, `overlayView.ts`) |
| `src/components/` | Thin React components; `usePlayback.ts` is the play button's timer; `PictureLoading.tsx` says on the map that a date's picture is still loading; `Overlays.tsx` (switches, caption box on the map, legend entry, point readout) and `useOverlayFiles.ts` (loads each overlay's file once); `useMediaQuery.ts` (`CAPTION_UNDER_MAP_QUERY`: on a phone the overlay's caption box goes in a strip under the map, never on it; `NOTES_UNDER_MAP_QUERY`: on a short window the loading note goes there too); `StatsPanel.tsx` draws the series and then every entry of `bars` with `BarsFigure.tsx`, the entries of one unit and layer on one scale (`panelScales`), which each figure also writes in words; the scales, bar and whisker positions and row texts are in `barGeometry.ts` and whose numbers are written by `numberText.ts` |
| `src/story/` | The guided story (`docs/MOTION_AND_STORY_BRIEF.md`; its rules and the engine in `web/MOTION.md`): `storyModel.ts` (each step's state, how a step arrives, the cover's figures, the date stamp's words), `storyUrl.ts` (the `story` parameter), `stage.ts` (all it does to the map), `useStory.ts` (the state machine), the panel, the cover, the progress and the date stamp, and `story.css` |
| `src/extensions/` | Placeholders for compare (swipe) and GIBS quick-look |
| `src/branding.ts` | The project's name and tagline: the header and `index.html` (via `vite.config.ts`) read them here |
| `tests/fixtures/` | The SYNTHETIC fixtures (`synthetic.mjs`) and their writer |
| `tests/`, `e2e/` | Vitest and Playwright; `e2e/realLengths.ts` serves the fixture with texts as long as the real fire stage's (`pipeline/fires.py`) for the layout tests |
