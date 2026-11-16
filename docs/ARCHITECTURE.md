# Architecture

An offline Python pipeline turns NISAR products into small web-ready rasters and JSON. A static web app
reads them straight from static hosting. There is no server at demo time, so nothing can crash while a
judge is watching. The two halves meet at one file, `web/public/data/manifest.json`
(see `docs/DATA_CONTRACT.md`).

```
NASA archive (HDF5, GBs)                                                       browser
        |                                                                          ^
        v                                                                          |  HTTP range requests
 pipeline/  discover -> fetch window -> process -> analyse -> fires -> export -> web/public/data/ -> GitHub Pages
 (Python)   catalog     h5py over      mask,      harvest    NASA     8-bit      manifest.json + COGs + stats
            search      HTTPS          multilook  pairs      FIRMS    COGs in
                                       (linear                        EPSG:3857
                                       power)
```

## Repository layout

```
contract/            JSON Schemas: the data contract (source of truth)
pipeline/            Python package, run as `npm run pipeline -- <command>` from the repository root
  sites/<id>.yaml    one config per place
  tests/             pytest, offline (synthetic NISAR-format files)
web/                 Vite + React + TypeScript app
  public/data/       web-ready outputs written by the pipeline (committed)
  src/  tests/  e2e/
scripts/             cross-platform Node scripts behind the root `npm run` commands
docs/                this file, DATA_CONTRACT, HANDOFF, TASKS, METHODS, SOURCES, ...
research/            pre-kickoff research, kept as written (not project code)
work/                git-ignored: raw downloads, intermediate rasters, QA plots
```

## Commands (identical on macOS, Linux and Windows)

Run from the repository root. Node is the task runner because every machine has it; the scripts find the
project's Python virtual environment themselves, so nobody has to activate anything.

| Command | Does |
|---|---|
| `npm run doctor` | Checks Node, Python, git, disk space, network reach to NASA services, and whether Earthdata credentials are present (never prints them) |
| `npm run setup` | Creates `.venv`, installs `pipeline/requirements-dev.txt` (runtime pins plus pytest and ruff), runs `npm ci` in `web/`. Safe to re-run; `-- --python <path>` picks an interpreter, `-- --force` reinstalls |
| `npm run dev` | Vite dev server for the app |
| `npm run build` / `npm run preview` | Production build of the app / serve that build locally |
| `npm run pipeline -- <args>` | `python -m pipeline <args>` inside the virtual environment |
| `npm run sample` | Rebuilds the sample site from NASA's public sample files (no login) into `web/public/data/sample/`, which adds it to the manifest; the public page no longer has it (`PROGRESS.md`, "Decisions, and why") |
| `npm run validate` | The pipeline's `validate` command: schema, cross-field rules, every raster |
| `npm run gen:contract` | Regenerates the TypeScript types from the JSON Schemas |
| `npm run lint` | ruff, eslint, TypeScript type check |
| `npm test` | pytest and vitest (offline) |
| `npm run e2e` | Builds the app, then runs the Playwright tests against the production build: on synthetic fixtures, plus one smoke test on the real data in `web/public/data` |
| `npm run check-size` | Fails if any file under `web/public/data` reaches 100 MiB or the folder passes 900 MB (GitHub Pages limits); warns above 400 MB |
| `npm run check` | lint, tests, contract types up to date, validate, size budget: what CI runs |
| `npm run live-check` | Opens a page (by default the public site) in a fresh Chrome profile, clicks the map, steps through the dates, takes screenshots and reports what it saw; fails on a console error, a failed request or a click with no value |

No bash-only steps anywhere: no Makefile, no `.sh`, no `&&`-chains that differ between shells, no symlinks,
and paths built with `pathlib` / `node:path`. Scripts never spawn `npm` by name (on Windows it is a `.cmd`
file that Node refuses to start); they go through `runNpm` in `scripts/lib.mjs`.

**PowerShell note.** PowerShell can swallow the `--` separator. These direct forms work in every shell:
`node scripts/py.mjs -m pipeline <args>`, `node scripts/tasks.mjs dev --port 5199`,
`node scripts/tasks.mjs e2e <args>`, `node scripts/setup.mjs --python <path>`. Ports are fixed: the dev
server uses 5173, and preview and the browser test use 4173 (the browser test's real-data smoke test also
4174); pass `--port` to `dev` if 5173 is taken.

## Pipeline

One package, small modules, each stage re-runnable on its own. `npm run pipeline -- --help` lists commands.

| Stage | Module | Reads | Writes |
|---|---|---|---|
| discover | `cmr.py`, `discover.py` | NASA CMR catalog (no login) | `pipeline/sites/<id>.granules.json` (committed: the reproducible, citable list of granules) |
| fetch | `access.py`, `gcov.py` | one window of each granule, over HTTPS or from a local file | `work/<id>/windows/*.tif` float32 linear power in the product's own projection, plus a JSON sidecar of file facts |
| process | `process.py` | windows | `work/<id>/proc/*.tif` masked, multilooked linear power on one identical grid |
| analyse | `harvest.py` | processed rasters of the dates the site's `harvest` block names | with a `harvest` block: `work/<id>/analysis/harvest.json` (rice mask, thresholds, harvest pairs, diagnostics, settings) and `harvest_classes.tif` (class of every cell, HH and HV bands); without one it does nothing (`docs/METHODS.md`, "Analysis: harvest pairs") |
| fires | `fires.py` | NASA FIRMS area API (VIIRS 375 m active fires; needs `FIRMS_MAP_KEY`) | with a `fires` block: raw CSVs cached in `work/<id>/fires/` (at most 5 days per request, as the API allows) and `detections.json` (every detection inside the box, once, with its source). Without a key it prints how to get one and the run goes on; when FIRMS fails (a wrong key, the rate limit, an outage) `run` prints a WARNING and goes on, while the `fires` command on its own stops with the error (`docs/METHODS.md`, section 6) |
| marker | `marker.py` | the analysis (`harvest.json`, `harvest_classes.tif`) and `detections.json` | `work/<id>/analysis/marker.json`: which polarization, HH or HV, should draw the harvest map, by the marker rule (`docs/METHODS.md`, section 6, "Choosing the marker"). It changes no setting (the site file's `harvest.marker` is set by hand), is not part of `run`, and computes nothing unless every day of its window has been fetched |
| export | `export.py`, `encode.py`, `stats.py`, `fires.py` | processed rasters (and the analysis, the detections and `marker.json`) | `web/public/data/<id>/` COGs, `stats.json`, `site.json`; with a `harvest` block also the static `harvest-wave` layer and two harvest series; with a `fires` block also `fires.geojson` (the `fires` overlay) and, for each of its periods, a `bars` entry of detections per km² on each `harvest-wave` class; a site file's `story` is copied to `site.json` |
| manifest | `manifest.py` | every `site.json` | `web/public/data/manifest.json` |
| validate | `manifest.py` | everything above | exit code |
| qa | `qa.py` | windows, processed rasters | `work/<id>/qa/` histograms and thumbnails to look at before trusting a date; with a `stable_target` in the site config, `stable_target.json` and a printed table (does the target stay within about 1 dB of the median on every date? With an even number of dates whose two middle dates differ by more than that, and so with exactly two dates that do, every date is flagged and neither half is blamed; a date that does not cover the target is left out and named) |

Other commands: `coverage` (stacks and dates at a point), `inspect` (print what is inside a product file;
add `--skip-mask` on real multi-gigabyte files, because reading the whole mask touches most of the file),
`auth-check` (test Earthdata credentials with one small request), `run` (fetch, process, analyse, fires,
qa, export, manifest, validate for one site; with a `harvest` block it first checks that every date the
block names is in the granule list).

The FIRMS map key is a segment of the request URL. `fires.py` never prints, logs or stores a URL that holds
it: every message passes through `fires.redact`, cache files are named by source and date, and their records
keep the request with `[MAP_KEY]` in its place. The fires stage asks again for a request made less than two
days after its last day (near-real-time detections keep arriving for some hours after each pass) and fetches
only days that have ended in UTC; the overlay's `date_range` is what was asked for, never more.

Every stage skips an output that already exists, validates, is newer than its inputs and was made with the
same settings (each stage records the inputs it used), so a re-run is cheap, an interrupted run resumes,
and changing a site's config redoes what depends on it (a display range is only a drawing hint: changing it
rewrites `site.json` and the manifest, never a raster). `--force` redoes everything for the site. Set `PIPELINE_DEBUG=1` for
a full traceback instead of the one-line error. While a stage runs, `web/public/data/<site>/` is being
rewritten, so the dev server can briefly show errors for that site.

### Science rules the code enforces

These come from NASA's SAR training material. Each has a test.

1. **Only one stack per site.** A stack is track + direction + frame. Images from different stacks, or
   ascending against descending, are never differenced.
2. **Linear power for all arithmetic, decibels only for storage and display.** Multilooking, filtering,
   reprojection and statistics run on linear gamma-naught. `dB = 10 * log10(power)` is the last step.
3. **Invalid pixels become NaN before any averaging.** Valid means: the product mask says valid, the value
   is finite, and power is above a small floor (real files hold values near 1e-14 at scene edges that pass
   a naive `> 0` test).
4. **Mask meaning depends on the product version, so the code reads it instead of assuming.** In real NISAR
   data (specification 1.5 and later) `mask` is 0 = invalid, 1 to 5 = valid, 255 = outside. In NASA's older
   sample files valid pixels are 0 and only 0 and 255 occur. `fetch` records the unique mask values of
   every file in its sidecar.
5. **Every date of a site sits on one identical grid.** Asserted, not assumed. A comparison across dates
   uses the same pixels or cells on every date (the statistics series, the stable-target check and the
   harvest analysis each say how). Areas (the rice area, the area of each class behind a fire density) are
   counted on the product's own grid, never on the web map's.
6. **One fixed encoding range and one fixed display range per layer** for all dates.
7. **Missing passes are reported, never filled.**
8. **Read what a file contains** (`listOfFrequencies`, `listOfPolarizations`, `listOfCovarianceTerms`)
   instead of assuming frequency A or HH. Granules without them exist.

### Reading a window

`h5py` over an `fsspec` HTTP file opened with `cache_type="blockcache", block_size=4 MiB` (the files use
4 MiB metadata pages). Measured on a public 172 MB sample: about 2 s and 13 MB to open, against 25 s and
111 MB with fsspec defaults. Coordinates in the file are pixel centres and `y` descends, so the raster
origin is `(x[c0] - dx/2, y[r0] - dy/2)`. Data URLs always come from the catalog; never build them by hand.

Authentication for real data (the token and the user name with password were verified on a real granule on
14 November; the netrc route was not): `EARTHDATA_TOKEN` as a Bearer header, or `earthaccess.login()` with
`EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` or a netrc file. `npm run pipeline -- auth-check` exercises it.

### Writing web-ready rasters

Linear power is warped to EPSG:3857 on the web tile grid first, then converted to dB, then encoded to
uint8, then packaged as a COG (rio-cogeo, DEFLATE + predictor 2, nodata 0, WebMercatorQuad tiling, average
overviews). Overview levels therefore average encoded dB values; that is for display only. Numbers the app
reports come from the stack file and `stats.json`, which are computed from linear power.

A classified layer (`categorical-uint8`, such as `harvest-wave`) is different: its class values are warped
by nearest neighbour (`export.warp_classes`) and its overviews are built by nearest neighbour, so every
pixel at every level is nodata or one of the listed classes. `validate` reads every level to check it, and
checks that every overview pixel holds a value found under it (in the level before or at full resolution),
which an averaged overview fails even where the average is itself a listed class.

## Web app

| Piece | Choice | Note |
|---|---|---|
| Build | Vite, React, TypeScript | Static output in `web/dist/`; `base: './'` so it works at any path |
| Map | MapLibre GL JS 6 | ESM only: `import * as maplibregl`, and `setWorkerUrl()` with the worker imported as `?url`. Without the worker URL vector layers silently vanish |
| COG display | `@geomatico/maplibre-cog-protocol` | `cog://<absolute url>#color:<ramp>,<min>,<max>,c` where min and max are pixel codes (1..255), not dB |
| Click query | `geotiff` opened with `fromUrl(url, { blockSize: 16384 })` | 2 requests per first click instead of 9 |
| Basemap | OpenFreeMap (no key) | |
| State | URL query string (site, layer, date or pair, the overlays switched on, map view) | A link reproduces what the sender saw |

Structure: `src/contract/` (generated types, manifest loader, encoding maths, overlay files), `src/map/` (map
setup, layers, overlay points), `src/state/` (URL state, the timeline, play, the overlay's period),
`src/components/` (controls and panels, the charts of the `stats.json` series and bars), `src/extensions/`
(placeholders for a swipe view, a NASA GIBS quick-look and the guided story; nothing imports them). Pure logic
lives in plain functions with vitest tests; components stay thin.

Rules for the app:

- Dates, layers and sites come from the manifest. Nothing about the data is hard-coded.
- A sample site's `notice` is always visible while that site is shown.
- A click returns real values with units and dates; nodata is shown as "no data", never as 0.
- Every layer has a legend with units and one plain sentence on how to read it.
- Colour scales must survive colour-blindness; never red against green.
- Keyboard reachable, honours `prefers-reduced-motion`, usable on a phone.
- No NASA logos, flags or mission patches. Credits are text.

## Hosting and CI

- **GitHub Pages**, deployed by `.github/workflows/deploy.yml` on every push to `main`. The workflow runs
  `npm run check` first and publishes only if it passes, so a broken push leaves the previous version up.
  Pages answers range requests with 206 and sends CORS headers, which COGs need. Do not move COGs to Cloudflare Pages (it
  answers range requests with 200).
- **CI** (`.github/workflows/ci.yml`) runs `npm run doctor`, `npm run setup`, `npm run check` and
  `npm run build` on Ubuntu and Windows, so the Windows build machine is covered on every push, and
  `npm run e2e` on Ubuntu.
- **Local serving:** only `npm run dev` or `npm run preview`. Python's built-in `http.server` ignores range
  requests and breaks COG reads.

## Versions

Exact versions are pinned in `pipeline/requirements.txt` and `web/package.json` (with a lockfile). They are
the versions that were actually run. Do not upgrade during the event without a reason and a re-test.
