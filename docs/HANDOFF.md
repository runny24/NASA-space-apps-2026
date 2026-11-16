

## 1. What you are getting

A walking skeleton: every part of the path from NASA's archive to a public web page exists, runs and is
tested, on one clearly labelled **sample** site. Nothing in it is specific to the team's concept, because the
team had not chosen one. Your job is the project itself: the team's place, the analysis, the features, the
words.

| Part | State |
|---|---|
| Data contract (`contract/`, `docs/DATA_CONTRACT.md`) | Written; enforced by tests on both sides |
| Pipeline (`pipeline/`) | Finds granules, reads a window over HTTPS, masks, multilooks, reprojects, writes 8-bit COGs, a click-query stack, statistics and the manifest; validates all of it |
| Web app (`web/`) | Reads only the manifest: site, layer, date and pair controls, missing-pass timeline, legend, click-to-inspect with history chart, statistics panel, sample notice, About panel, state in the URL |
| Tooling (`package.json`, `scripts/`) | One set of `npm run` commands for Windows, macOS and Linux |
| CI and deploy (`.github/workflows/`) | Checks on Ubuntu and Windows on every push; GitHub Pages deploy on every push to `main` |
| Public site | https://runny24.github.io/NASA-space-apps-2026/ shows the sample site |
| Team documents (`docs/`) | Concept template, task list, team checklist, methods, sources, how-it-works, submission text |

## 2. Your first 30 minutes

```
git clone https://github.com/runny24/NASA-space-apps-2026.git
cd NASA-space-apps-2026
npm run doctor      # needs only Node; says what is missing and how to fix it
npm run setup       # Python virtual environment in .venv, packages, web dependencies
npm run check       # must pass before you change anything
npm run dev         # http://localhost:5173 : the sample site, with its notice
```

Needs Node 22 or later, **Python 3.12 or 3.13, 64-bit** (3.11 cannot install the pinned packages) and Git.

- If `npm run check` fails on your machine before you have changed anything, compare with the latest CI
  run on GitHub (it runs the same commands on `windows-latest`), fix that first, and note it in
  `PROGRESS.md`.
- **PowerShell** can swallow the `--` separator, and then the arguments after it are lost. Direct forms
  that work in every shell: `node scripts/py.mjs -m pipeline <args>`,
  `node scripts/tasks.mjs dev --port 5199`, `node scripts/tasks.mjs e2e <args>`,
  `node scripts/setup.mjs --python <path>`.
- **Ports are fixed:** the dev server uses 5173; preview and the browser test use 4173. If 5173 is taken,
  pass `--port` to `dev`. Stop any `npm run preview` before `npm run e2e`.
- **Browser test:** `npm run e2e` uses Google Chrome when it is installed. Without Chrome, run
  `npx playwright install chromium` once inside `web/` (so the browser matches the pinned version).
- Stop `npm run dev` before running `npm run setup` again: Windows cannot replace files that are open.
- Then ask the team for `docs/TEAM_CHECKLIST.md` items 1 to 3 (Earthdata account, concept, Local Lead
  timing; item 4, the Pages switch, is done) and continue with `docs/TASKS.md` T1 and T1b. T1b lists
  what to do while the concept and the login are still missing.

## 3. What was verified, and how

"Ran" means a command was run and its output read during the scaffold session, on macOS (Apple Silicon,
Node 22.15, Python 3.12.5). Windows results come only from CI.

| Claim | How it was checked |
|---|---|
| The pipeline's logic | 189 offline tests on synthetic NISAR-format files: window arithmetic with a descending y axis and half-pixel origin, both mask conventions, power floor, multilook in linear power, grid identity, encoding round trip, placement of a known bright spot after reprojection (within 1.3 m), COG properties, band order of stacks with 3, 4 and 5 dates, every cross-field rule of the contract failing when broken, re-run is a no-op, a changed setting redoes exactly the files it affects, catalog duplicate handling, credentials never printed. Each science rule was removed in turn from a scratch copy and a test failed each time |
| The whole chain on real NISAR-format files | `npm run sample`: 40 s, 105 MB read over HTTPS from NASA's public sample files, 3.7 MB written, `validate` OK, second run changes nothing |
| The sample lands in the right place | The two dry lakes and the city grid sit under the basemap's "Rosamond" and "Lancaster" labels in Chrome; the valid-data extent matches the requested box |
| The web app | 87 unit and contract tests; two Playwright tests of the production build (loads with a clean console, map is drawn, notice and data credit shown, date step changes the picture, a click returns a value, a malformed link still opens the app); looked at in Chrome at desktop and 375 px width; the first view is drawn about 1 s after navigation locally and 2 to 3 s from GitHub Pages (headless Chrome) |
| HTTP range requests locally | `vite` dev and `vite preview` answer 206 for `.tif` files |
| Catalog search | `coverage` run against the live catalog at five places; date counts and spans matched the pre-kickoff table |
| The published sample numbers | Recomputed from NASA's raw files by a separate agent with separately written code (no pipeline imports): placement exact (best shift 0 m, searched to 2 m), 240 m box means within 0.06 dB on average, stack cells within 0.03 dB, change layer within 0.03 dB, statistics within 0.002 dB, dates and metadata consistent with the files |
| A new agent can start from a clean clone | A fresh agent, given only the repository, ran every documented command (doctor, setup, check, dev, sample, coverage, discover, auth-check, e2e) and they worked; what it tripped on has been fixed |
| Windows package availability | Every pinned Python package has `win_amd64` wheels for Python 3.12 and 3.13 on PyPI |
| The commands on Windows and Linux | The first CI run passed on `ubuntu-latest` and `windows-latest`: doctor, setup, check (lint, all tests, contract types, data validation, size budget) and build; the browser smoke test passed on Ubuntu |
| The public site | Opened in Chrome after the first deploy: the sample site draws, rasters are fetched with HTTP 206, a click returns values with 2 requests to the stack file, console clean |

## 4. What was NOT verified. Be suspicious here

> **Update, Saturday 14:36, by the build session.** Items 1 and 2 have since been run in part against a
> real granule: the login (token, and user name with password), the redirect to the signed download
> URL, the reader, the mask values, the page size and the timing all behaved as the code assumes.
> Details are in `PROGRESS.md`, "What the first real NISAR file contained". Still never run on real
> data: the fetch, process and export stages themselves, a window at a swath edge, an expired token.

1. **Everything behind Earthdata Login.** No account existed. Never run: the logged-in branch of
   `auth-check`; `pipeline/access.py` with `access: earthdata` (token as a Bearer header, or an earthaccess
   session); whether the redirect from the archive to its signed download URL keeps working with those
   headers; how long a window takes from a real 2 to 8 GB file. Expect to debug this first. T2 and T3 in
   `docs/TASKS.md` are built around it.
2. **Real NISAR files.** The code has only met NASA's sample files, which follow an older product
   specification (1.2.1; real data is 1.5 or later) and are HH only. Unobserved on real data: the `mask`
   values (the code expects 1 to 5 = valid for specification 1.5+, and stops with a clear error if it sees
   something else); `inputDataExceptionMask`, which the code does not read at all yet; the HDF5 page size
   (the reader assumes 4 MiB); dates of one stack that differ in mode or polarization.
3. **Windows, beyond CI.** CI ran setup, the checks and the build on `windows-latest`. Not run there: the
   sample pipeline against the network (`npm run sample`), the dev server, the browser test, and
   anything typed into PowerShell by hand.
4. **Browsers and devices.** Only Chrome on a Mac. No Safari, Firefox, real phone or screen reader.
5. **Paths the sample cannot exercise:** more than 12 dates in a layer (the app then switches by `setUrl`
   instead of preloading); more than one site; categorical layers (tested only on synthetic fixtures); mixed
   releases.
6. **The NASA GIBS quick-look layer** has never been drawn on a map by anyone on this project.
7. **Radiometry.** The sample's two dates are not comparable, so nothing about thresholds, calibration or
   change detection has been tested on meaningful data.

## 5. Traps already found, and what the code does about them

Full list: `research/ERRATA.md` (145 corrections to the pre-kickoff brief). The ones most likely to cost you
time:

| Trap | Status in the scaffold |
|---|---|
| One satellite pass often has two or more catalog entries (a partial frame beside the full one, mode variants starting in the same second, the same pass in two releases) | `discover` first sets aside entries that lack the site's polarizations or miss its box, then keeps one per pass (better release, then highest counter, then full frame, then more polarizations), and records what it dropped and why. Check its choice on your stack |
| A login test with HEAD always "passes": the archive answers HEAD without credentials | `auth-check` makes a ranged GET and checks for the HDF5 signature |
| A bare `earthaccess.login()` waits for keyboard input forever when no credentials exist | `access.py` tries the environment, then netrc, and fails with instructions |
| "Keep mask 1 to 5" discards every pixel of the sample files, where valid is 0 | Mask meaning is decided from the file's specification version and checked against the values found |
| Real files hold values near 1e-14 at scene edges that pass a `> 0` test | Power floor, default 1e-5 |
| An EPSG:4326 raster raises no error in the browser and draws at 0°N 0°E | The pipeline only writes EPSG:3857 and `validate` rejects anything else |
| Colour ramp limits given in dB paint an 8-bit raster one flat colour | The app converts the display range to pixel codes |
| A 3 or 4 band stack gets tagged RGB or RGBA and dates go blank where the fourth has no data | Stacks are written as plain grey bands; tested with 3, 4 and 5 dates |
| WebP or JPEG compression silently corrupts value-coded rasters, and still passes COG validation | DEFLATE only, and `validate` rejects any other compression. Write rasters only through `export.write_cog` |
| Values brighter than the stored range are clipped (buildings can exceed +5 dB by more than 10 dB) | The app shows a clipped value as "or more" / "or less". Widen `encoding.hi` in the site file for urban sites; statistics are computed before encoding and are unaffected |
| Changing a site's settings while old outputs exist | Each stage records the inputs it used and redoes an output made with different settings; `validate` compares every raster's own encoding tag with the manifest |
| A time series whose dates cover different ground (partial frames) shows coverage changes as backscatter changes | Statistics use only pixels valid on every date; a date with too little coverage is published as missing |
| Listing two releases in a site file gives a mixed-release series on almost any stack (validated data starts 2026-10-21) | The template accepts one release; `discover` warns and says how to keep one |
| Averaging decibels instead of power (several dB wrong on mixed pixels) | All averaging, filtering and reprojection is on linear power; tests |
| Counting web-map pixels overstates area (by 3 % at 10° latitude, double at 45°) | Statistics are computed on the product's own grid |
| MapLibre 6 without `setWorkerUrl`: rasters draw but the basemap silently vanishes | Set up once in `web/src/map/maplibre.ts`; import MapLibre only from there |
| `@maplibre/maplibre-gl-compare` fails under Vite | Not used. A two-map swipe with CSS `clip-path` passed the pre-kickoff tests; see the stub in `web/src/extensions/compareSwipe.ts` |
| Python's built-in `http.server` ignores range requests | Use only `npm run dev` or `npm run preview` |
| `curl -I` (HEAD) reports 200 on GitHub Pages even though ranged GETs work | Test with `curl.exe -s -r 0-99 -o NUL -w "%{http_code} %{size_download}" <url>` on Windows (write `curl.exe`: in PowerShell plain `curl` is a different command) or `curl -s -r 0-99 -o /dev/null -w ...` on macOS and Linux, and expect `206 100` |
| On 14 Nov some NASA GIBS NISAR tiles came back garbled with HTTP 200 | Not used by the scaffold. Check tiles before relying on that layer |
| NASA Harmony's client reads different credential variables (`EDL_USERNAME`, `EDL_PASSWORD`, or an explicit token) | Not used by the scaffold; noted for the access fallback in T3 |

Science traps that no code can catch are in `docs/METHODS.md`, section 4.

## 6. How to

**Add the team's site.** Searching needs no login, so do the first three commands as soon as the team
names a place:

```
npm run pipeline -- coverage --lon <lon> --lat <lat> --releases validated,provisional,beta
```
Copy `pipeline/sites/_template.yaml` to `pipeline/sites/<id>.yaml` and fill it in (leave `stack: null`;
`discover --stack` records the chosen stack in the granule list), then:
```
npm run pipeline -- discover --site <id>                    # ranks the candidate stacks and explains why
npm run pipeline -- discover --site <id> --stack <stack>    # writes pipeline/sites/<id>.granules.json
```
These need `auth-check` to pass:
```
npm run pipeline -- inspect <first granule url> --access earthdata --skip-mask
npm run pipeline -- run --site <id>
npm run dev
```
Commit the YAML and the granule list (the citable record of the data used), and the outputs under
`web/public/data/<id>/`. Do the first run with one date: keep a copy of the granule list, leave a single
entry under `granules`, run, look at `work/<id>/windows/<date>.json` (it records what the file contained,
including the mask values) and at the QA pictures in `work/<id>/qa/`, then restore the list.

**Add a derived layer.** Layers are assembled in `export_site` in `pipeline/stages.py`: compute the array
on the warped display grid (linear power in, physical values out), encode it with `pipeline/encode.py`, write
it with `export.write_cog`, and add a layer entry (kind `per-date`, `pair` or `static`; its encoding and
display hint) to the list passed to `manifest.site_fragment`. Add a test beside
`pipeline/tests/test_end_to_end.py`. The app shows any layer in the manifest without code changes, including
classified maps (`categorical-uint8` with a `classes` list).

**Change the data format.** Edit `contract/*.schema.json`, run `npm run gen:contract`, update the writer
(`pipeline/manifest.py`, `pipeline/stages.py`) and the reader (`web/src/contract/`) in the same commit.
`npm run check` fails while the two sides disagree.

**Add a dependency.** Pin the exact version, check that its licence is permissive, add it to
`docs/SOURCES.md` in the same commit. For Python, confirm a `win_amd64` wheel exists.

**See why CI failed.** Each failed step attaches its last 40 lines to the run as an error annotation,
visible on the run's summary page without opening the logs.

**Deploy.** Push to `main`. The deploy workflow runs `npm run check` itself and publishes only if it
passes; if it fails, the previous version stays up and the run's annotation says why. To undo a bad
deploy, `git revert` the commit and push.

**Remove the sample site** once a real site is live: delete `web/public/data/sample/`, run
`npm run pipeline -- manifest`, commit, push. `npm run sample` rebuilds it locally whenever you want it.

## 7. Rough edges that are yours to decide

Not bugs; choices the scaffold left open.

- On a phone, dragging over the map moves the map, which makes it awkward to scroll past. MapLibre's
  `cooperativeGestures` option is the usual answer.
- The main script is 1.7 MB (about 500 kB gzipped). It loads fast enough on a laptop; lazy-loading the map
  would help phones on slow networks.
- Chart axes are minimal.
- `inspect` reads the whole mask unless `--skip-mask` is given, which is slow on real files.
- `manifest.json` records `generated_at` and the short git commit, so rebuilding a site from a fresh clone
  or a new commit changes those two lines and nothing else. If nothing else changed, discard it with
  `git checkout -- web/public/data/manifest.json`.
- `npm audit` reports a few moderate advisories in development-only tooling; the production dependencies
  have none.

## 8. Where the knowledge is

| If you need | Read |
|---|---|
| What to do next, and by when | `docs/TASKS.md` |
| What only people can do | `docs/TEAM_CHECKLIST.md` |
| The concept | `docs/CONCEPT.md` |
| How the code is organised; the rules it enforces | `docs/ARCHITECTURE.md` |
| The file format between pipeline and app | `docs/DATA_CONTRACT.md`, `contract/` |
| Facts about NISAR data, access and the libraries, with how each was established | `research/VERIFIED_FACTS.md` |
| Where the pre-kickoff brief is wrong | `research/ERRATA.md` |
| The exact command, output or test code behind a fact (for example the tested swipe view, the Harmony request shape, the layout of a real product file) | `research/digests/`, one file per topic; each is long, so search it instead of reading it whole |
| The long pre-kickoff brief (science guardrails, schedule thinking, resources) | `research/BUILD_PROMPT.md` |
| The hackathon rules, as saved | `research/evidence/rules/` |
| What to say when asked "where does this number come from?" | `docs/HOW_IT_WORKS.md` |
