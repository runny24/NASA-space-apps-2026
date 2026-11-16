# Recovered digest: topic "browser"

MapLibre GL JS + `@geomatico/maplibre-cog-protocol` under Vite in a real headless browser, plus the public NISAR
browse-PNG overlay. Recovered on 2026-11-14 from three interrupted `exec:browser` runs of 2026-11-13/14.

**How to read this file.** Sections 0 to 10 are the digest. Appendix A holds the complete,
verbatim application-side code that ran; Appendix B holds the complete, verbatim test scripts and generators, so
every experiment can be re-run even if the scratch folder is gone. Every code block says which file it came from.
Code blocks marked *verbatim* were executed exactly as shown (one small exception is noted at B.9). Nothing here was re-run for this digest.

**Evidence labels.** `ran` = a saved output, log or transcript tool result shows it being run and what it printed.
`docs` = read in a package README, typings, source or the npm registry. `belief` = no evidence found; treat as a guess.
Conclusions the agents never wrote down are marked *(digest author's reading)*: none of the three runs produced a
final report or a single sentence of commentary, so every "which one to use" below is inferred from the numbers.

Scratch root, called `$B` below:

```
<scratch>/verify/browser
```

## Contents

0. Provenance and how far the runs got
1. Bottom line
2. Versions that actually ran
3. Facts, with evidence
4. Corrections to the brief
5. Recommendations
6. Copy-ready code (verbatim excerpts)
7. Result tables
8. Failures: what was tried and did not work
9. Open questions
10. Artifacts and how to reuse them
- Appendix A: complete application-side files
- Appendix B: complete test scripts and generators

---

## 0. Provenance and how far the runs got

| Transcript (`agent-<id>.jsonl`) | Local time (CST) | What it did |
|---|---|---|
| `a77173c85bd81cdb5` | 13 Nov 19:38 to 19:46 | Scaffolded the Vite page, installed packages, generated 11 synthetic COGs, ran t00 (smoke), t01 (ramp, nodata), t02 (colour function, pixel query). Cut off. |
| `af5ad3bea7a95526f` | 13 Nov 20:41 to 21:07 | Re-ran the above; added t03 (worker and import pitfalls, dev and build), t04 (date switching), t05 (swipe/compare), t06 (wrong and large COGs), t07a to t07d (NISAR browse PNG: fetch, canvas, map overlay, offset). Cut off. Its outputs are now in `$B/_previous_attempt/`. |
| `a6d514150d8f0431d` | 14 Nov 01:41 to 02:01 | Moved the earlier outputs aside, re-ran t00 to t07 from scratch (same pass/fail results), added t08 (HiDPI) and t09 (date switching with 72 MB COGs). Last action: added an "only this variant" filter to `t05_compare.mjs`, apparently to re-test the plugin import. Cut off before using it. |

- Transcripts are in `<transcripts>/wf_0472d927-435/`.
- The only assistant text in all three is "You've hit your 5-hour limit"; the thinking blocks are empty. The evidence is the tool calls, their results, and the files in `$B`.
- Everything the task asked for (steps 1 to 5 of the agent's prompt) was exercised at least once. What is missing is the agent's own summary, its `working_snippets` list and its recommendation.
- Two full, independent runs (20:44 to 21:07 and 01:44 to 02:01) gave the same pass/fail outcome on t01 to t07c: compare `$B/_previous_attempt/shots/*_stdout.txt` with `$B/shots/*_stdout.txt`.
- Test environment: macOS 26.6.2 arm64 (Apple M3 Pro), Node v22.15.0, npm 10.9.2, Python 3.12.2, Google Chrome 157.0.8103.52 headless through Playwright 1.65.1 (`channel: "chrome"`), WebGL 2.0 (ANGLE Metal), device pixel ratio 1 unless stated. Plain JavaScript: no TypeScript, no React. Pages served from `http://localhost:5173` (Vite dev) and `http://localhost:4173` (`vite preview` of the production build), at the site root.

---

## 1. Bottom line

1. **What ran is MapLibre GL JS 6.18.0, not the 5.x line.** With `@geomatico/maplibre-cog-protocol` 0.10.0 and Vite 8.3.8 it works in dev and in a production build, given two idioms: a namespace import (`import * as maplibregl`) and an explicit worker URL (`setWorkerUrl`). Version 5.24.1 was never installed, so the brief's default pin is the untested option.
2. **COG display works as the brief hopes.** Single-band uint8 COGs in EPSG:3857 with nodata 0 and overviews render through `cog://` with a ramp and explicit min/max; nodata is transparent; `setColorFunction` and `locationValues` behave as documented.
3. **Flicker-free date stepping:** one source and layer per date, all loaded at `raster-opacity: 0` with a zero-duration opacity transition; flip opacity to switch (under one frame, no blank frames). `source.setUrl()` is the lighter fallback. Remove-and-add flashes on every step; `visibility` toggling flashes on first show; MapLibre's default 300 ms opacity transition makes every step take about 292 ms.
4. **Swipe:** the npm compare plugin fails when imported through the bundler. A hand-written two-map swipe with CSS `clip-path` (about 40 lines) passed every check in dev and build.
5. **Silent failure to guard against:** an EPSG:4326 COG raises no error and draws nothing where you expect it (it lands at 0°N 0°E). A UTM COG gives a clear error. A 72 MB COG without overviews needs 906 requests and 61 MB for one view.
6. **NISAR browse PNG:** loads from page JavaScript with no login, is already transparent outside the swath (PNG `tRNS` chunk), can be handed to a MapLibre `image` source by URL, and with the brief's corner coordinates lines up with OpenStreetMap's Tonle Sap to about 0.3 km. Pinning it by four corners puts mid-frame rows up to 0.5 km too far north; resampling the rows to Web Mercator (7 ms in a canvas) removes that.
7. **Not done by these runs:** the GIBS NISAR tile layer was never put on a map. Version 5, React, TypeScript, a non-root base path, real hosting, phones, Safari and Firefox were not tested.

---

## 2. Versions that actually ran

| Package | Version | Evidence |
|---|---|---|
| `maplibre-gl` | 6.18.0 (npm `latest`, published 2026-11-11; `latest-5` is 5.24.1, not installed) | `npm ls`: `+-- maplibre-gl@6.18.0`; `$B/shots/t00_stdout.txt`: `"maplibreVersion": "6.18.0"` |
| `@geomatico/maplibre-cog-protocol` | 0.10.0 (published 2026-09-18; peer range `^4.5.0 \|\| ^5.0.0 \|\| ^6.0.0`) | `npm ls`; registry output in transcript `a77…` line 32 |
| `geotiff` | 3.0.5 (dependency of the protocol; never imported directly by the tests) | `npm ls` |
| `@maplibre/maplibre-gl-compare` | 0.5.0 (latest publish 2021-08-11; depends on `@mapbox/mapbox-gl-sync-move` 0.3.1) | registry output in transcript `a77…` line 32; `package-lock.json` |
| `vite` | 8.3.8 (bundler core `rolldown` 1.2.19) | `npm ls`; `$B/shots/build_1.txt`: `vite v8.3.8 building client environment for production...` |
| `playwright` / `pngjs` | 1.65.1 / 7.0.0 (test only) | `npm ls` |
| Python side | rasterio 1.5.2 (GDAL 3.12.2, PROJ 9.8.1), rio-cogeo 7.0.4, morecantile 7.1.0, numpy 2.5.4, pillow 13.0.0 | `$B/py/requirements.freeze.txt`; transcript `a77…` line 67 |

Install commands as run (transcript `a77…` line 35), which resolved to the versions above on 2026-11-13:

```
npm install --no-fund --no-audit maplibre-gl@latest @geomatico/maplibre-cog-protocol@latest geotiff@latest @maplibre/maplibre-gl-compare@latest
npm install --no-fund --no-audit -D vite@latest playwright@latest
npm install --no-fund --no-audit -D pngjs
```

---

## 3. Facts, with evidence

### Stack and build

- **F1 [ran]** Only `maplibre-gl` 6.18.0 was installed and run. The 5.x line appears in the runs only as the npm dist-tag `latest-5: 5.24.1`. Evidence: registry output `dist-tags {'v1': '1.15.3', 'next': '6.0.0-22', 'latest': '6.18.0', 'latest-5': '5.24.1'}` (transcript `a77…` line 32); `$B/shots/t00_stdout.txt` `"maplibreVersion": "6.18.0"`; a search of all three transcripts for `maplibre-gl@5` or `5.24` finds nothing else.
- **F2 [ran]** The import and registration in `$B/app/src/common.js` (Section 6.1) works under Vite 8.3.8 in dev and in the production build: raster through `cog://` and a GeoJSON fill both render. Evidence: `$B/shots/t03_build_stdout.txt`, case `A_setWorkerUrl`: `"workerUrl": "/assets/maplibre-gl-worker-Boc9pDRP.mjs"`, `"rasterRendered": true`, `"geojsonRendered": true`, `"pageErrors": []`; the same in `$B/shots/t03_dev_stdout.txt`.
- **F3 [ran]** A default import of `maplibre-gl` 6 breaks the build and the dev page. Evidence: `$B/shots/build_with_defimport.txt`: `[MISSING_EXPORT] "default" is not exported by "node_modules/maplibre-gl/dist/maplibre-gl.mjs".` pointing at `src/defimport.js:2:8`; `$B/vite-dev.log`: `SyntaxError: The requested module '/node_modules/.vite/deps/maplibre-gl.js?v=6ffa2838' does not provide an export named 'default'`. `$B/shots/t00_stdout.txt`: `"hasDefaultExport": false`.
- **F4 [ran]** Without `setWorkerUrl`, MapLibre 6 asks for `maplibre-gl-worker.mjs?v=6.18.0` next to the bundled chunk, which does not exist: HTTP 504 in dev (`/node_modules/.vite/deps/…`), 404 in the build (`/assets/…`), console error `Worker failed to load. Check that the worker URL is correct.` The failure is partial: the `cog://` raster still renders (its tiles are produced on the main thread by the protocol handler), but the GeoJSON fill does not, so a vector basemap would not either. Evidence: `$B/shots/t03_build_stdout.txt`, case `B_default_worker_lookup`: `"rasterRendered": true`, `"geojsonRendered": false`, `404 http://localhost:4173/assets/maplibre-gl-worker.mjs?v=6.18.0`.
- **F5 [ran]** Production bundle: main chunk (MapLibre 6 + COG protocol + d3-scale) 1,477.54 kB raw, 433 kB gzip; worker 519.54 kB raw, 147 kB gzip; CSS 71.33 kB raw, 10 kB gzip. Vite prints its "Some chunks are larger than 500 kB" warning; the build succeeds in 0.5 s. Evidence: `$B/shots/build_1.txt` (`dist/assets/esm-TffYpWP6.js 1,477.54 kB │ gzip: 433.05 kB`); gzip of the worker measured as 147,180 bytes in transcript `a6d…` line 172.
- **F6 [ran]** The Vite dev server and `vite preview` both answer range requests on `.tif` files with `206 Partial Content`. Evidence: transcript `a6d…` lines 122 and 179: `HTTP/1.1 206 Partial Content … Content-Range: bytes 0-1023/37280`. In the browser, `$B/shots/t01_stdout.txt`: `COG range requests: 1 statuses [ 206 ]`.

### COG display, colour, query

- **F7 [ran]** A `raster` source with `url: 'cog://<absolute URL>#color:<ramp>,<min>,<max>,c'` and `tileSize: 256` renders exactly the colours the library's exported `colorScale()` predicts, for a named ramp, a custom two-colour ramp and two different min/max pairs; values outside min/max clamp. Evidence: `$B/shots/t01_stdout.txt`, ends `ALL PASS`, e.g. `PASS  spectral: value 30 -> screenshot 213,62,79 vs colorScale 213,62,79` and `PASS  grey_55_155: value 180 -> screenshot 255,255,255 vs colorScale 255,255,255`.
- **F8 [ran]** Pixels equal to the declared nodata (0) are transparent, both inside the data and in the padding that web-optimised tiling adds around it; so is everything outside the file. Evidence: same file: `PASS  spectral: lake nodata pixel shows the magenta background 255,0,255`, `… nodata padding pixel shows the magenta background …`, `… outside-file pixel shows the magenta background …`. The COGs declare nodata 0 (`$B/py/gen_cogs.out.json`: `"nodata": 0.0`); an undeclared nodata was not tested.
- **F9 [ran + docs]** Ramp syntax details the brief omits: without the trailing `c` the ramp is discrete (classes), `-` reverses it, a JSON array of hex colours can replace the ramp name, and with no `#color` at all a single-band uint8 COG is drawn as a greyscale picture. Evidence (ran): `$B/shots/t01_stdout.txt`, cases `#color:BrewerYlOrRd7,30,205,-` (values 180 and 205 both give `255,255,178`, one class), `#color:["#000000","#ffffff"],30,205,c`, and `plain_no_hash` (`value 105 drawn as grey 105,105,105`). Docs: package README, "The syntax for the `#color` parameter is `#color:<colorScheme>,<minValue>,<maxValue>,<modifiers>`". The 291 built-in names are ColorBrewer and CARTO only (`BrewerSpectral9`, `BrewerYlGnBu9`, `BrewerRdBu11`, `CartoTeal`, `CartoEarth`, …); there is no viridis, magma or inferno (key list of `dist/esm/render/colorScale.js`).
- **F10 [ran]** `setColorFunction(plainUrl, (pixel, color, metadata) => …)` works for per-pixel classification with alpha. It is keyed by the COG URL without `cog://` and without the hash; it takes precedence over a `#color` hash on the same URL; it is called 65,536 times per tile; and changing the function does not repaint tiles already on screen until the layer (or source) is removed and added again. Evidence: `$B/shots/t02_stdout.txt`: `PASS  colour fn: value 180 -> 127,0,255 (expected ~127,0,255)`; `colour function calls so far: 589824 (= 65536 per 256x256 tile)`; `probe pixel: before change [ 0, 255, 0 ] | after setColorFunction only [ 0, 255, 0 ] | after layer remove+add [ 255, 255, 0 ] | after source remove+add [ 255, 255, 0 ]`; `colour function + #color hash on same URL -> probe pixel [ 255, 255, 0 ] (yellow = function wins)`.
- **F11 [ran]** `locationValues(plainUrl, {latitude, longitude})` returns an array with one number per band; a nodata pixel or a point outside the file comes back as `NaN`; an optional third argument (a zoom) reads an overview instead of full resolution. 204 of 204 probe points on three dates matched the known synthetic values, and four real mouse clicks matched, each answered in 0.1 to 0.2 ms because the tile was already cached by the display. Only single-band files were queried. Evidence: `$B/shots/t02_stdout.txt`: `PASS  locationValues: 204/204 points match the synthetic formula (full res and zoom=8 overview), nodata/outside -> NaN`; `PASS  click at 103.9368,13.2564 -> locationValues [180] expected 180  (0.1 ms)`; `PASS  click at 104.2000,12.8500 -> locationValues ["NaN"] expected NaN (nodata)  (0.1 ms)`.
- **F12 [ran]** The source's zoom range and bounds come from the file: `getCogMetadata(url)` reports `noData`, `bbox` and one entry per overview, and the source ends up with `maxzoom` equal to the COG's native zoom. Evidence: `$B/shots/t01_stdout.txt`: `getCogMetadata: {"offset":0,"scale":1,"noData":0,…"bbox":[103.359375,12.03932055754056,104.94140625,13.581920900545844],"images":[{"zoom":11,"isOverview":false,…},{"zoom":10,"isOverview":true,…},…]}` and `source after TileJSON: {"minzoom":0,"maxzoom":11,"tileSize":256,…}`.

### Date switching

- **F13 [ran]** Six strategies were measured frame by frame over 11 dates (every rendered frame read back with `gl.readPixels` and compared with reference frames), with 0 ms and 200 ms of artificial latency per `.tif` request. Table in Section 7.1. Decisive lines from `$B/shots/t04_stdout_delay0.txt`: remove+add: `PLAYBACK 100 ms/step x33: {"shownWithin100ms":"33/33","holeFrames":33,"maxHolePct":51.92}`; `setUrl`: `"stepsWithHoles":0` cold and warm, warm median `15.1` ms; preload + opacity: `COLD  : {"completeMs":{"min":0.6,"median":0.8,"max":13.1},…"stepsWithHoles":0…}`; preload + visibility: `COLD  : {…"stepsWithHoles":10,"holeFramesTotal":13…}`; preload + opacity with the default transition: `"completeMs":{"min":280.5,"median":292.3,"max":293}` and `"shownWithin100ms":"0/33"`.
- **F14 [ran]** Layers kept at `raster-opacity: 0` do load their tiles (that is what makes preloading work); layers with `visibility: 'none'` do not draw until first shown. Evidence: `$B/shots/t09_stdout.txt`, preload strategy: `setup : {"ms":447,"layers":12,"requests":242,"MB":18.02}` followed by `11 switches COLD : {…"requests":0,"MB":0}`; and F13's visibility line.
- **F15 [ran]** With realistic files (the same 72 MB, 8448 x 8192 px speckled COG under 11 URLs) preloading all 11 dates keeps every switch at about 1 ms with no mixed frames, at the price of 11 times the network on every pan and zoom: pan to idle 551 ms and 231 requests (18 MB) against 63 ms and 21 requests (1.6 MB) for `setUrl`; with 100 ms per request, 1682 ms against 258 ms. `setUrl` on first visit shows 1 to 3 frames that mix old and new tiles and takes 55 to 96 ms (252 to 306 ms with 100 ms per request). JS heap 166 MB against 126 MB; no long tasks in either. Evidence: `$B/shots/t09_stdout.txt` (table in Section 7.2).

### Swipe / compare

- **F16 [ran]** A hand-written swipe (two stacked maps kept in sync by `move` to `jumpTo`, the top one clipped with `clip-path: inset(0 0 0 Xpx)`, a pointer-captured handle) passes every check in dev and in the production build: initial split, programmatic move, real mouse drag of the handle, pan and wheel-zoom on either side with both cameras identical afterwards. Evidence: `$B/shots/t05_dev_stdout.txt` and `$B/shots/t05_build_stdout.txt`, block `=== own_clip_path`: four lines ending `-> PASS` and `camera sync: {"dragLeftMoved":true,"dragLeftSynced":true,"dragRightMoved":true,"dragRightSynced":true,"wheelRightZoomed":true,"wheelRightSynced":true,"wheelLeftZoomed":true,"wheelLeftSynced":true}`. Code: `$B/app/src/compare_clip.js`.
- **F17 [ran]** `@maplibre/maplibre-gl-compare` 0.5.0 imported the normal bundler way fails at construction: `TypeError: EventEmitter is not a constructor` in dev, `TypeError: i is not a constructor` in the build, because its `index.js` does `require("events").EventEmitter` and Vite externalises Node's `events`. Its prebuilt `dist/maplibre-gl-compare.js` does work with MapLibre 6.18.0, but only if a plain, extensible `window.maplibregl = { ...maplibregl }` exists before it is imported; assigning the ES module namespace itself fails in dev (`TypeError: Cannot assign to property 'Compare' of [object Module]`) yet passes in the production build, so dev and build disagree. Evidence: `$B/shots/t05_dev_stdout.txt`, `$B/shots/t05_build_stdout.txt`. Registry: latest publish 2021-08-11 (docs).
- **F18 [ran]** Sizing trap: with the usual `.map { position: absolute; top: 0; bottom: 0; width: 100%; }` rule both map containers collapsed to height 0 (canvas 1000 x 300) and every swipe check failed, because `maplibre-gl.css` sets `.maplibregl-map { position: relative }` and, imported through the bundler, is injected after the page's own `<style>`. Switching to ID selectors (`#before, #after { position: absolute; inset: 0; }`) fixed it. Evidence: transcript `af5…` line 226: `"before": {"position": "relative", … "height": 0, "className": "map maplibregl-map"}`, `"canvasA": [1000, 300]`, `"styleOrder": ["STYLE:inline", "STYLE:maplibre-gl.css", …]`; after the fix (line 230) all `PASS`.

### Wrong and large COGs

- **F19 [ran]** A COG in a projected CRS other than Web Mercator is rejected loudly: `COG projection EPSG:32648 in http://localhost:5173/cogs/bad_utm48n.tif is not supported. Reproject to EPSG:3857 (Web Mercator).` It arrives as a map `error` event, as a rejected `getCogMetadata` and as a rejected `locationValues`. Evidence: `$B/shots/t06_stdout.txt`, block `bad_utm48n`.
- **F20 [ran + docs]** A COG in EPSG:4326 is not rejected. No error anywhere; the layer reports loaded; nothing is drawn at the real location; `locationValues` there returns `NaN`. The file's degrees are read as metres, so it sits at 0°N 0°E with `bbox` about `[0.00093, 0.00011, 0.00094, 0.00012]` and a "zoom" of 27.77; zooming to that spot at z18 shows it. Evidence (ran): `$B/shots/t06_stdout.txt`, blocks `bad_epsg4326` (`map errors: []`, `rendered there: false; non-background area 0 %`) and `bad_epsg4326_at_null_island` (`rendered there: true`). Cause (docs, `dist/esm/read/CogReader.js`): the check is `projectedCSType !== undefined && projectedCSType !== 3857 && projectedCSType !== 102113`, and a geographic CRS has no `ProjectedCSTypeGeoKey`. The README's "reading a COG in any other projection throws an error" is therefore not true for geographic CRSs.
- **F21 [ran]** For small files the layout hardly matters: EPSG:3857 without overviews, striped (not tiled), or not aligned to the tile grid all render correctly and answer `locationValues` (each file is under 64 KB and arrives in one request). Evidence: `$B/shots/t06_stdout.txt`, blocks `bad_no_overviews`, `bad_striped`, `ok_unaligned_3857`: `rendered there: true`, `locationValues at probe: [30]`, `network: 1 requests`.
- **F22 [ran]** For a large file overviews are essential. Same 8448 x 8192 px image at map zoom 8.3: with overviews 5 requests, 0.39 MB, idle after 43 ms; without overviews 906 requests, 61.13 MB, idle after 726 ms on localhost, JS heap 184 MB. At the file's native zoom (13) the two are identical (7 requests, 0.59 MB). 512 px blocks instead of 256 px: fewer, larger requests and no clear win (3 requests and 0.52 MB at z8.3; 8 and 1.84 MB at z11 against 23 and 1.77 MB). No long task (over 50 ms) was recorded in any case. Evidence: `$B/shots/t06_stdout.txt`, blocks `big_*`.
- **F23 [ran]** HiDPI: on a 2x screen a `cog://` source declared with `tileSize: 256` is drawn at 2.03 device pixels per data pixel at an integer map zoom (soft), because MapLibre requests the same tile zoom as on a 1x screen. Declaring `tileSize: 128` makes it request one level deeper and gives 1.01 device pixels per data pixel, for 54 tiles instead of 15. Declaring 512 is worse everywhere (4.06 on 2x, 2.03 on 1x). Sharpness is capped by the COG's native zoom. Evidence: `$B/shots/t08_stdout.txt` (table in Section 7.4).
- **F24 [ran]** `rio-cogeo` 7.0.4: `cog_translate(..., web_optimized=True)` still works but warns `DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option`; the form `tms=morecantile.tms.get("WebMercatorQuad")` wrote valid COGs (`"cog_valid": true`) that the browser read. Evidence: `$B/py/gen_cogs.err.txt`; `$B/py/gen_big.out.json`; `$B/py/gen_big.py` lines 70 to 78.

### NISAR browse PNG (real data, no login)

- **F25 [ran]** The `_LATLON.png` URL of granule `NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001` can be read from page JavaScript on another origin: `fetch()` follows a 303 to CloudFront and gets 200, `access-control-allow-origin: *` on both hops, response type `cors`, content type `binary/octet-stream`, 4,247,472 bytes, 1880 x 1847 px, about 1.3 to 1.7 s. `createImageBitmap` decodes the blob even with the wrong MIME type; the canvas can be read back. `<img crossOrigin="anonymous">` also works and is readable. A plain `<img>` loads but taints the canvas. Evidence: `$B/shots/t07a_stdout.txt`: `"redirected": true, "responseType": "cors", … "contentType": "binary/octet-stream"`, `"bitmapFromRawBlob": {"ok": true, "w": 1880, "h": 1847 …}`, `"imgNoCrossOrigin": {… "readBackError": "SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The canvas has been tainted by cross-origin data."}`.
- **F26 [ran]** The PNG is already transparent outside the swath. It is 8-bit RGB (colour type 2) with a `tRNS` chunk naming (0,0,0) as the transparent colour; Chrome decodes it with alpha 0 on exactly the pure-black pixels (45.71 % of the image), and an explicit "make black transparent" loop changes nothing. Evidence: transcript `a6d…` line 249: `IHDR (1880, 1847, 8, 2, 0, 0, 0)`, `tRNS 000000000000 -> (0, 0, 0)`, `chunk counts {'IHDR': 1, 'tRNS': 1, 'IDAT': 65, 'IEND': 1}`; `$B/shots/t07a_stdout.txt`: `"alphaZeroFraction": 0.4571, "rgbBlackFraction": 0.4571, "blackButOpaque": 0` and `"pixelsNewlyMadeTransparent": 0`; only 72 transparent pixels lie inside the swath. Checked for this one granule. (The saved copy `$B/net/browse_png/browse.png` has colour type 2 in its header, confirmed by a local read for this digest.)
- **F27 [ran]** The image looks magenta and green, not like a three-channel false colour: its red and blue channels have the same mean (81.46, against 71.19 for green) and every pixel sampled in the tests has R equal to B (for example `[219,252,219]`, `[9,1,9]`, `[248,168,248]`). Evidence: transcript `a6d…` lines 249 and 285; screenshot `$B/shots/t07b_liberty_lake_outline_mercator.png`. Which polarisation feeds which channel was not established.
- **F28 [ran]** Four ways of putting it on a MapLibre 6.18.0 map all load and show the right colours, with the exterior transparent: `image` source by URL (MapLibre fetches the cross-origin, redirected, `binary/octet-stream` PNG itself); `canvas` source; `image` source created empty and fed a canvas through `updateImage({ image })`; the same fed an `ImageBitmap`. Corner order is top-left, top-right, bottom-right, bottom-left. Evidence: `$B/shots/t07b_stdout.txt`: four blocks `loaded=true … errors=[]` with all probes `OK`, e.g. `corner area (outside swath, transparent)   png RGBA [0,0,0,0] -> screenshot [255,255,255] OK`.
- **F29 [ran]** Alignment on a real map, using the corners west 102.3865, east 105.5270, north 14.3420, south 11.3330 (taken from the brief's D4, not re-derived): the dark lake in the radar picture and OpenStreetMap's Tonle Sap polygon (from OpenFreeMap vector tiles) overlap with IoU 0.904 at zero shift; areas 2548 km² and 2546 km²; the best rigid shift is 1 px east and 2 px north at 130 m per screen pixel, that is 0.13 km east and 0.26 km north; median shoreline distance 0.29 km. Two smaller water bodies as cross-checks: West Baray 0.31 km east and 0.45 km north; a reservoir in the south-west of the frame was inconclusive (IoU 0.49). The yellow OSM outline in `$B/shots/t07b_liberty_lake_outline_mercator.png` follows the radar shoreline closely. Evidence: `$B/shots/t07c_stdout.txt`, `$B/shots/t07d_stdout.txt` (table in Section 7.5).
- **F30 [ran]** A lat/lon picture pinned by its four corners is stretched linearly in Web Mercator, so rows in the middle of this 3° tall frame are drawn up to 0.501 km too far north (at latitude 12.83). Resampling the rows to Mercator in a canvas (at most 3 rows of shift, 7 ms) removes that: the residual at Tonle Sap flips from 0.26 km north to 0.26 km south (both within two screen pixels), and at West Baray the north error falls from 0.45 km to 0.08 km while zero-shift IoU rises from 0.485 to 0.711. A residual of 0.13 to 0.31 km eastward remains at both sites. Evidence: `$B/shots/t07c_stdout.txt`: `theory: a lat/lon grid pinned by 4 corners in Web Mercator is drawn too far north by up to 0.501 km (at lat 12.83)`; `$B/shots/t07b_stdout.txt`: `PNG loaded in page: {"w":1880,"h":1847,"loadMs":1297,"warpMs":7,"maxRowShiftPx":3}`; `$B/shots/t07d_stdout.txt`.
- **F31 [ran]** The redirect target is a signed CloudFront URL valid for 3600 s (`A-userid=None` in it, so no login is involved); the 303 itself is sent with `cache-control: private, max-age=3540`. An `OPTIONS` preflight is answered with 405. No georeferencing file sits beside the PNG on the public path: `_LATLON.kml`, `.kml`, `_LATLON.pgw`, `_LATLON.wld`, `_LATLON.png.aux.xml`, `_LATLON.tif`, `_LATLON.json`, `_BROWSE.png` all return 404. Evidence: transcript `a6d…` line 245 (`signed URL Expires … | lifetime s 3600`), line 241 (`=== OPTIONS preflight … HTTP/2 405`), line 293; `$B/net/browse_headers.txt`.

### Basemaps and GIBS

- **F32 [ran]** OpenFreeMap works without a key under MapLibre 6.18.0: the `liberty` style loads (112 layers, map idle, no map errors; 108 requests to `tiles.openfreemap.org` over the whole test, all 200), and `https://tiles.openfreemap.org/planet` can be used directly as a vector source whose `water` source-layer gives OSM water polygons (properties `class` = `lake` or `river`, `intermittent`), usable as an independent outline over the radar. `liberty` makes MapLibre 6.18.0 log three `console.warn` lines when the style loads (`layers[highway-shield-non-us].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.`). OpenStreetMap raster tiles as a `raster` source with a `tiles` array also load (53 requests, all 200). Evidence: `$B/shots/t07b_stdout.txt`; `$B/vite-dev.log`.
- **F33 [ran]** CORS of keyless endpoints checked with curl and an `Origin` header, all `200` with `access-control-allow-origin: *`: OpenFreeMap `styles/liberty`, `styles/positron`, `planet`; `demotiles.maplibre.org/style.json`; CARTO `positron-gl-style`; `tile.openstreetmap.org`; one GIBS tile (`BlueMarble_ShadedRelief_Bathymetry … GoogleMapsCompatible_Level8/6/29/50.jpeg`); Esri World Imagery. Evidence: transcript `af5…` line 194.
- **F34 [ran, negative]** The GIBS NISAR layer (`NISAR_L2_Geocoded_Polarimetric_Covariance`, sketch D2 of the brief) was not requested, drawn or mentioned by any of the three browser runs. The single GIBS request in them is the BlueMarble tile in F33. Evidence: searching the three transcripts and `$B` for `gibs` finds only transcript `af5…` lines 193 and 194.
- **F35 [ran]** Every test page logs one console error that is only the missing favicon: `Failed to load resource: the server responded with a status of 404 (Not Found) | location: {"url":"http://localhost:5173/favicon.ico"…}`. Evidence: `$B/shots/t00b_stdout.txt`.

---

## 4. Corrections to the brief

Severity: **blocks-build** = following the brief as written fails; **wrong-result** = it runs but gives wrong data or the brief makes a wrong claim; **minor** = sharpening. No blocks-build item was found for this topic.

| # | Brief section | The brief says | What the evidence shows | Evidence | Severity |
|---|---|---|---|---|---|
| C1 | 6.5 "Pin MapLibre deliberately" | "Start on 5.24.1 unless a quick test shows version 6 working with the COG protocol in this project." | That test was run twice. 6.18.0 + COG protocol 0.10.0 + Vite 8.3.8 works in dev and in a production build for ramps, nodata, colour function, query, `setUrl`, swipe and image/canvas sources. 5.24.1 was never installed, so the brief's default is the unverified choice, and the snippets in this digest are written for version 6. | F1, F2; `$B/shots/t03_build_stdout.txt` | minor (but it decides the first `npm install`) |
| C2 | 6.5, same bullet | Version 6 "needs `setWorkerUrl()` under a bundler" | True, and the failure is partial and easy to miss: without it the COG raster still draws, only vector and GeoJSON layers vanish, with a console error. The working form is `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'; maplibregl.setWorkerUrl(workerUrl);`. "Requires WebGL2" was not tested (the test context was WebGL 2). | F4 | minor |
| C3 | 6.5 "Stack" | "colour ramps through the `cog://URL#color:<ramp>,<min>,<max>` form" | That form gives a discrete (stepped) ramp. A continuous ramp needs a fourth field: `#color:<ramp>,<min>,<max>,c`. Ramp names are ColorBrewer/CARTO names such as `BrewerYlGnBu9` (no viridis); a custom list works as `#color:["#000000","#ffffff"],<min>,<max>,c`. Min and max are compared with the stored pixel values (after the file's GDAL scale and offset if it declares any, per the README; not tested), so with the brief's 8-bit encoding they are 1 to 255, not dB. | F7, F9 | minor (wrong picture if dB limits are passed for 8-bit data) |
| C4 | 6.5 "Stack" | "`locationValues(url, {latitude, longitude})` to read a pixel across all bands" | Works, with details: `url` is the plain COG URL (no `cog://`, no hash); nodata and outside-the-file come back as `NaN`, so test with `Number.isNaN`; values are the stored numbers (8-bit codes here), to be converted to dB with the manifest's `lo`/`hi`. Only single-band files were queried; the multi-band "stack" COG of Section 6.3 was not tried. | F11 | minor |
| C5 | 6.5 "Stack" | "`setColorFunction` for custom colouring" | Works, but a changed function does not repaint tiles already drawn: remove and re-add the layer. It also overrides any `#color` hash on that URL and runs 65,536 times per tile on the main thread. | F10 | minor |
| C6 | 6.5 "Compare view" | The plugin "is unmaintained and breaks with ESM builds. Use two map instances kept in sync (for example with `@mapbox/mapbox-gl-sync-move`) and a CSS clip that follows a draggable divider." | Confirmed (bundler import fails at runtime in dev and build; last publish 2021). Two additions. (a) `@mapbox/mapbox-gl-sync-move` was never imported directly; the verified sync is ten hand-written lines (`move` to `jumpTo`). (b) Size the two map containers with ID selectors or `inset: 0`: a plain `.map { position: absolute … }` class loses to `maplibre-gl.css` and the maps collapse to height 0. | F16, F17, F18 | minor |
| C7 | 6.5 "Time" | "Preload the neighbouring dates so stepping does not flash." | Preloading only works with layers held at `raster-opacity: 0`; `visibility: 'none'` does not preload and flashes on first show. Also set `'raster-opacity-transition': { duration: 0, delay: 0 }`, otherwise each step is a 292 ms cross-fade, and never swap by remove+add (blank frame on every step). What was measured is "all 11 dates preloaded", not "neighbours only". | F13, F14, F15 | minor |
| C8 | 6.3 first bullet | "The browser library that reads COGs directly requires EPSG:3857" | Sharper and more dangerous: a projected non-Mercator COG throws a clear error, but an EPSG:4326 COG throws nothing and silently draws at 0°N 0°E. An export that forgets to reproject from lat/lon will look like "the layer is empty" with a clean console. | F19, F20 | wrong-result (silent) |
| C9 | 6.3 first bullet | "internal overviews" | Confirmed with numbers: 906 requests and 61 MB for one view of a 72 MB COG without overviews, against 5 requests and 0.39 MB with them. Small files (tens of KB) do not care. | F21, F22 | minor |
| C10 | 4.6 last bullet | Preview PNGs are "RGB on black, no transparency" | The PNG carries a `tRNS` chunk that makes pure black transparent; browsers and MapLibre show the outside of the swath as transparent without any processing. (One granule checked.) | F26 | wrong-result (wrong claim; consequence is only unneeded work) |
| C11 | Appendix D4 | "Black pixels must be made transparent in a canvas before display." | Not needed (C10). A canvas step is still worth having for a different reason: see C12. | F26, F28 | minor |
| C12 | Appendix D4 | "*Method verified numerically on three dates of one stack; not yet checked visually on a map.*" with corners 102.3865, 105.5270, 14.3420, 11.3330 | Now checked on a map: those corners place the image within about 0.3 km of OSM water (one to two browse pixels). But handing a lat/lon image and four corners to MapLibre draws mid-frame rows up to 0.5 km too far north; resample rows to Web Mercator first (`warpRowsToMercator`, Section 6.7). A residual 0.13 to 0.31 km eastward offset remains unexplained. | F29, F30 | wrong-result (up to 0.5 km, about 3 browse pixels, if pinned naively) |
| C13 | 4.6 last bullet | "content type `binary/octet-stream`, so fetch them as a blob" | Fetching as a blob works, but is not required: `<img crossOrigin="anonymous">` and a MapLibre `image` source given the URL both work in Chrome 157. What is required is the CORS mode: a plain `<img>` taints the canvas. Do not add custom request headers (the preflight gets 405), and do not store the redirected URL (it expires after an hour). | F25, F28, F31 | minor |
| C14 | 4.6 last bullet | "The matching `.kml` needs login" | On the public BROWSE path the `.kml` and `_LATLON.kml` names return 404, as do world-file and `.aux.xml` names. There is nothing to log in to at those URLs. | F31 | minor |
| C15 | Appendix D5 | `cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False)` | Runs under rio-cogeo 7.0.4 with a deprecation warning. Current form: pass `tms=morecantile.tms.get("WebMercatorQuad")` instead of `web_optimized=True`. | F24 | minor |
| C16 | 8 "Finish line" | "The browser console is clean on load" | Two known sources of noise: a missing `favicon.ico` (404 error on every page) and three `console.warn` lines from the OpenFreeMap `liberty` style under MapLibre 6.18.0. | F32, F35 | minor |
| C17 | Appendix D2 | "*Tile URL verified; the MapLibre call has not been run here.*" | Still true after these runs: no browser attempt touched the NISAR GIBS layer. Only the generic shape (a `raster` source with a `tiles` array) was exercised, with OpenStreetMap tiles. | F34, F32 | minor (status, not an error) |

---

## 5. Recommendations

Each follows from the evidence above; where a recommendation goes beyond what was run, it says so.

1. **MapLibre version: pin `maplibre-gl` 6.18.0 exactly**, with `@geomatico/maplibre-cog-protocol` 0.10.0 and `vite` 8.3.8, and copy `$B/app/package-lock.json` or write exact versions (the test `package.json` used carets). Why: it is the only combination that was executed, twice, in dev and production build. If a React wrapper or plugin the team wants refuses version 6, fall back to 5.24.1, but then nothing in this digest has been run for it: re-run the smoke test first, and expect the import and worker lines to differ (*belief:* version 5 has a default export and no `maplibre-gl-worker.mjs` file to import).
2. **Imports and registration: copy `src/common.js` (Section 6.1) as is.** Namespace import, CSS import, `?url` worker import, `setWorkerUrl`, `addProtocol('cog', cogProtocol)`, once, before any map is created. Why: F2 to F4. In TypeScript the `?url` import needs Vite's client types (*belief*, standard in Vite templates; the tests were plain JS).
3. **Layer recipe:** `map.addSource(id, { type: 'raster', url: 'cog://' + absoluteUrl + '#color:<Ramp>,<min>,<max>,c', tileSize: 256 })` plus a `raster` layer with `'raster-fade-duration': 0`. Build the absolute URL from the page (`new URL(path, document.baseURI).href`); every test used absolute URLs and a site served at `/`, so a relative `cog://` URL and a GitHub Pages base path are untested. Why: F7 to F9.
4. **Date stepping: preload, then flip opacity.** One source and one layer per date, created up front with `'raster-opacity': 0` and `'raster-opacity-transition': { duration: 0, delay: 0 }`; `show(k)` sets the previous layer to 0 and the new one to 1. Use `source.setUrl()` instead for secondary layers or when the rasters are large and people pan a lot, since preloading multiplies every pan's requests by the number of dates. Never remove and re-add; never use `visibility` for this. Why: F13 to F15. If a cross-fade is wanted, keep the playback interval longer than the fade (*digest author's reading*).
5. **Swipe: use the hand-written `compare_clip` (Section 6.5), not the plugin.** Why: F16, F17. Size the map containers by ID or `inset: 0` (F18).
6. **Click to inspect:** `const [v] = await locationValues(plainUrl, { latitude: e.lngLat.lat, longitude: e.lngLat.lng })`; show "no data" when `Number.isNaN(v)`; convert the stored value to dB with the manifest's `lo`/`hi`. Use the same URL string as the displayed layer so the query hits the cached tile. For a time series, call it once per date file until the multi-band stack has been tested. Why: F11.
7. **Guard the pipeline output in a test:** for every exported COG assert EPSG:3857, overviews present, nodata declared, and in the browser (or with `rio cogeo info`) that `getCogMetadata(url).bbox` overlaps the site's bounds. Why: the EPSG:4326 failure is silent (F20) and missing overviews are ruinous for large files (F22).
8. **Write COGs with `tms=morecantile.tms.get("WebMercatorQuad")`, 256 px blocks, DEFLATE, nodata 0** (Section 6.9). Why: F24; 512 px blocks brought no gain (F22).
9. **HiDPI: keep `tileSize: 256` by default; use `tileSize: 128` for the one layer that must look crisp on phones and retina laptops**, accepting about 3.6 times the tile requests. Never 512. Why: F23.
10. **Browse PNG overlay:** use it as an `image` source by URL for the first deployed slice; for anything where position matters, fetch it, resample rows to Mercator with `warpRowsToMercator` and use a `canvas` source. No black-keying. Always request the `nisar.asf.earthdatacloud.nasa.gov` URL, never a saved CloudFront URL; send no custom headers; load lazily (4.2 MB each). Label it a quick-look. Why: F25 to F31.
11. **Basemap and comparison layer:** OpenFreeMap `liberty` is proven under 6.18.0; its `water` source-layer drawn as a yellow line is a ready-made independent water outline. To keep the console clean, add a favicon and either accept or avoid `liberty`'s three warnings (`positron` and `dark` were not rendered in these tests). Why: F32, F35.
12. **GIBS: make sketch D2 the first five-minute test in the web app.** It has still not been drawn on a map. The same source shape with OpenStreetMap tiles worked. Why: F34.
13. **Local serving:** `vite` and `vite preview` are confirmed to honour range requests; keep using them. Why: F6.
14. **Bundle:** expect about 433 kB gzip for the map chunk plus 147 kB for the worker; lazy-load the map module if the first screen has other content. The 500 kB warning is harmless. Why: F5.
15. **Keep the Playwright harness** (`tests/lib.mjs`, Appendix B) for "verify by running": it drives the installed Chrome headless, takes screenshots and reads pixels, and the tests timed in the transcripts took from 4 seconds to about 80 seconds each.

---

## 6. Copy-ready code (verbatim excerpts)

All of this ran against MapLibre GL JS 6.18.0, COG protocol 0.10.0, Vite 8.3.8, Chrome 157. Complete files are in the appendices.

### 6.1 Imports, worker, protocol registration, a dated COG map

Verbatim: `$B/app/src/common.js` (used by the swipe pages in dev and build; the same four setup lines are in `src/harness.js`, which every other test used).

```js
// Shared setup for the test pages: MapLibre GL JS 6 (ESM only, namespace import) + its worker + the cog:// protocol.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import * as cog from '@geomatico/maplibre-cog-protocol';

maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('cog', cog.cogProtocol);

export { maplibregl, cog };

export const DATES = ['20260619', '20260701', '20260713', '20260725', '20260806', '20260818',
  '20260830', '20260911', '20260923', '20261005', '20261017'];
export const cogUrl = (k) => `${location.origin}/cogs/synth_${DATES[k]}.tif`;
export const RAMP = '#color:BrewerSpectral9,30,205,c';

// A map with a flat background colour and one dated COG layer.
export function makeDatedMap(container, k, bg) {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: { cog: { type: 'raster', url: `cog://${cogUrl(k)}${RAMP}`, tileSize: 256 } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': bg } },
        { id: 'cog', type: 'raster', source: 'cog', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } },
      ],
    },
    center: [104.2, 12.85],
    zoom: 8.3,
    fadeDuration: 0,
    attributionControl: false,
  });
  map.on('error', (e) => { (window.errors ||= []).push(String((e.error && e.error.message) || e.error || e)); });
  return map;
}
export const whenIdle = (map) => new Promise((res) => (map.loaded() && map.areTilesLoaded() ? res() : map.once('idle', res)));
```

Notes: `cogUrl` builds an absolute URL from `location.origin`; adapt it to the app's base path. `fadeDuration: 0`, `attributionControl: false`, `'raster-resampling': 'nearest'` and the flat background are test conveniences (exact pixel comparison); a product would keep attribution on.

### 6.2 Date switching

Verbatim: `$B/app/tests/t04_date_switch.mjs` lines 16 to 17 and 47 (constants), then lines 55 to 100 (the six strategies; `show(k)` performs the switch, `cur` is the index now shown). The recommended one is the last `else` branch with `raster-opacity` (strategy D); `setUrl` is strategy B.

```js
const HASH = '#color:BrewerSpectral9,30,255,c';
const PAINT = { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 };
    const url = (k) => `cog://${BASE}/cogs/synth_${DATES[k]}.tif?cb=${strat}${HASH}`;
```

```js
    if (strat === 'A_swap_remove_add') {
      show = (k) => {
        if (map.getLayer('r')) { map.removeLayer('r'); map.removeSource('r'); }
        map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 });
        map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT });
      };
    } else if (strat === 'B_swap_setUrl') {
      show = (k) => {
        if (!map.getSource('r')) {
          map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 });
          map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT });
        } else map.getSource('r').setUrl(url(k));
      };
    } else if (strat === 'C_swap_doublebuffer') {
      let gen = 0;
      show = (k) => {
        const id = `r${++gen}`, prev = `r${gen - 1}`;
        map.addSource(id, { type: 'raster', url: url(k), tileSize: 256 });
        map.addLayer({ id, type: 'raster', source: id, paint: PAINT });
        const check = () => {
          if (map.getSource(id) && map.isSourceLoaded(id)) {
            map.off('sourcedata', check);
            // one more frame so the new tiles are on screen before the old layer goes away
            requestAnimationFrame(() => { if (map.getLayer(prev)) { map.removeLayer(prev); map.removeSource(prev); } });
          }
        };
        map.on('sourcedata', check);
      };
    } else {
      const defaultTransition = strat === 'F_preload_opacity_default_transition';
      for (let k = 0; k < n; k++) {
        map.addSource(`d${k}`, { type: 'raster', url: url(k), tileSize: 256 });
        const paint = { ...PAINT, 'raster-opacity': 0 };
        if (!defaultTransition) paint['raster-opacity-transition'] = { duration: 0, delay: 0 };
        const layer = { id: `d${k}`, type: 'raster', source: `d${k}`, paint };
        if (strat === 'E_preload_visibility') { layer.layout = { visibility: 'none' }; layer.paint['raster-opacity'] = 1; }
        map.addLayer(layer);
      }
      await lab.idle();
      out.sourcesLoadedAfterSetup = DATES.map((_, k) => map.isSourceLoaded(`d${k}`));
      if (strat === 'E_preload_visibility') {
        show = (k) => { if (cur >= 0) map.setLayoutProperty(`d${cur}`, 'visibility', 'none'); map.setLayoutProperty(`d${k}`, 'visibility', 'visible'); };
      } else {
        show = (k) => { if (cur >= 0) map.setPaintProperty(`d${cur}`, 'raster-opacity', 0); map.setPaintProperty(`d${k}`, 'raster-opacity', 1); };
      }
    }
```

The same two strategies with large files, verbatim: `$B/app/tests/t09_preload_big.mjs` lines 53 to 65.

```js
      if (strat === 'D_preload_opacity') {
        for (let k = 0; k < N; k++) {
          map.addSource(`d${k}`, { type: 'raster', url: url(k), tileSize: 256 });
          map.addLayer({ id: `d${k}`, type: 'raster', source: `d${k}`, paint: { ...PAINT, 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0, delay: 0 } } });
        }
        window.show = (k) => { if (cur >= 0) map.setPaintProperty(`d${cur}`, 'raster-opacity', 0); map.setPaintProperty(`d${k}`, 'raster-opacity', 1); };
        await lab.idle();
      } else {
        window.show = (k) => {
          if (!map.getSource('r')) { map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 }); map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT }); }
          else map.getSource('r').setUrl(url(k));
        };
      }
```

### 6.3 Custom colour function

Verbatim: `$B/app/tests/t02_colorfn_query.mjs` lines 15 to 30 (runs inside the page; `cog` is the protocol module, `map` the map).

```js
const cogUrl = `${BASE}/cogs/synth_${DATES[k]}.tif`;
await page.evaluate(async (cogUrl) => {
  // classify: < 100 red, 100..179 green, >= 180 blue at 50 % alpha, nodata transparent
  window.fnCalls = 0;
  cog.setColorFunction(cogUrl, (pixel, color, metadata) => {
    window.fnCalls++;
    const v = pixel[0];
    if (v === metadata.noData) color.set([0, 0, 0, 0]);
    else if (v < 100) color.set([255, 0, 0, 255]);
    else if (v < 180) color.set([0, 255, 0, 255]);
    else color.set([0, 0, 255, 128]);
  });
  map.addSource('c', { type: 'raster', url: `cog://${cogUrl}`, tileSize: 256 });
  map.addLayer({ id: 'c', type: 'raster', source: 'c', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  await new Promise((res) => map.once('idle', res));
}, cogUrl);
```

To change the function later and see it, remove and re-add the layer (lines 55 to 65 of the same file, Appendix B). To drop it: `cog.setColorFunction(cogUrl, undefined)`.

The library's ramps can be reused inside a colour function; this call form ran in `t01_ramp_nodata.mjs` and `t05_compare.mjs`:

```js
          const ramp = cog.colorScale({ colorScheme: 'BrewerSpectral9', min: 30, max: 205, isContinuous: true });
```

### 6.4 Pixel query on click

Verbatim: `$B/app/tests/t02_colorfn_query.mjs` lines 123 to 136.

```js
// real mouse click -> locationValues
const kc = 3, urlc = `${BASE}/cogs/synth_${DATES[kc]}.tif`;
await page.evaluate(async (urlc) => {
  map.addSource('q', { type: 'raster', url: `cog://${urlc}#color:BrewerSpectral9,30,205,c`, tileSize: 256 });
  map.addLayer({ id: 'q', type: 'raster', source: 'q' });
  window.clicks = [];
  map.on('click', async (e) => {
    const t0 = performance.now();
    const values = await cog.locationValues(urlc, { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    window.clicks.push({ lngLat: [e.lngLat.lng, e.lngLat.lat], values: values.map((v) => (Number.isNaN(v) ? 'NaN' : v)), ms: performance.now() - t0 });
    new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(`value: <b>${values[0]}</b><br>${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`).addTo(map);
  });
  await new Promise((res) => map.once('idle', res));
}, urlc);
```

With an overview level instead of full resolution (same file, lines 104 to 105):

```js
      const full = await cog.locationValues(url, { latitude: lat, longitude: lon });
      const z8 = await cog.locationValues(url, { latitude: lat, longitude: lon }, 8);
```

### 6.5 Swipe between two dates

Verbatim: `$B/app/compare_clip.html` and `$B/app/src/compare_clip.js` (passes in dev and production build).

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>compare_clip</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; }
    #wrap { position: absolute; inset: 0; }
    /* ID selectors on purpose: maplibre-gl.css sets .maplibregl-map{position:relative} and, when it is
       imported through the bundler, it is injected AFTER this block, so a plain .map class rule loses. */
    #before, #after { position: absolute; inset: 0; }
  </style>
</head>
<body>
  <div id="wrap">
    <div id="before" class="map"></div>
    <div id="after" class="map"></div>
  </div>
  <script type="module" src="/src/compare_clip.js"></script>
</body>
</html>
```

```js
// Variant 3: no plugin. Two stacked maps, kept in sync, the top one clipped with CSS clip-path; a draggable handle.
import { cog, makeDatedMap, whenIdle } from './common.js';

window.cog = cog;
const a = makeDatedMap('before', 0, '#ff00ff'); // bottom map: visible to the LEFT of the handle
const b = makeDatedMap('after', 5, '#00ffff');  // top map: visible to the RIGHT of the handle
window.mapA = a; window.mapB = b;

// --- keep the two cameras identical
function syncMaps(m1, m2) {
  let busy = false;
  const follow = (src, dst) => src.on('move', () => {
    if (busy) return;
    busy = true;
    dst.jumpTo({ center: src.getCenter(), zoom: src.getZoom(), bearing: src.getBearing(), pitch: src.getPitch() });
    busy = false;
  });
  follow(m1, m2); follow(m2, m1);
}
syncMaps(a, b);

// --- swipe handle
const wrap = document.getElementById('wrap');
const handle = document.createElement('div');
handle.id = 'swipe-handle';
handle.style.cssText = 'position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:#222;cursor:ew-resize;z-index:10;touch-action:none;';
const knob = document.createElement('div');
knob.style.cssText = 'position:absolute;top:50%;left:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:#222;border:2px solid #fff;box-sizing:border-box;';
handle.appendChild(knob);
wrap.appendChild(handle);

function setSwipe(x) {
  const w = wrap.getBoundingClientRect().width;
  x = Math.max(0, Math.min(w, x));
  b.getContainer().style.clipPath = `inset(0 0 0 ${x}px)`; // hide the top map left of x
  handle.style.left = `${x}px`;
  window.swipeX = x;
}
handle.addEventListener('pointerdown', (e) => {
  handle.setPointerCapture(e.pointerId);
  const move = (ev) => setSwipe(ev.clientX - wrap.getBoundingClientRect().left);
  const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
});
window.addEventListener('resize', () => setSwipe(window.swipeX));
setSwipe(wrap.getBoundingClientRect().width / 2);
window.compare = { setSlider: setSwipe };
window.compareOk = true;
window.ready = Promise.all([whenIdle(a), whenIdle(b)]);
```

Not exercised: touch input on a phone, keyboard control of the handle, a horizontal split. The handle uses pointer events and `touch-action: none`, so touch should work (*belief*).

If the plugin is wanted anyway, the only form that worked in both dev and build is `$B/app/src/compare_dist.js` with `?global=copy` (Appendix A).

### 6.6 Map container CSS that survives `maplibre-gl.css`

From the three compare pages (the comment is the agent's):

```css
    /* ID selectors on purpose: maplibre-gl.css sets .maplibregl-map{position:relative} and, when it is
       imported through the bundler, it is injected AFTER this block, so a plain .map class rule loses. */
    #before, #after { position: absolute; inset: 0; }
```

### 6.7 NISAR browse PNG: URL, corners, loading, Mercator fix

Verbatim: `$B/app/tests/nisar.mjs`.

```js
// The public NISAR GCOV browse image used by the real-data checks, and the corner coordinates given in the task.
export const BROWSE_URL = 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png';
export const WEST = 102.3865, EAST = 105.5270, NORTH = 14.3420, SOUTH = 11.3330;
// MapLibre image/canvas source corner order: top-left, top-right, bottom-right, bottom-left
export const CORNERS = [[WEST, NORTH], [EAST, NORTH], [EAST, SOUTH], [WEST, SOUTH]];
```

Verbatim: `$B/app/tests/browselab.js` (in-page helpers: `load` fetches and decodes to a readable canvas, `warpRowsToMercator` fixes the north-south error of corner pinning).

```js
// In-page helpers for the NISAR browse overlay tests (injected with page.addScriptTag).
window.browse = {
  // fetch (follows the 303 redirect), decode, draw to a canvas that can be read back
  async load(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`browse fetch failed: ${resp.status}`);
    const blob = new Blob([await resp.arrayBuffer()], { type: 'image/png' }); // server says binary/octet-stream
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0);
    return c;
  },
  // The PNG is a lat/lon (plate carree) grid: rows are equally spaced in LATITUDE. A MapLibre image/canvas source
  // stretches the picture linearly between its corners in WEB MERCATOR, i.e. rows equally spaced in mercator y.
  // This re-samples the rows so that the picture is linear in mercator y and can be pinned by its 4 corners exactly.
  warpRowsToMercator(src, north, south) {
    const W = src.width, H = src.height, rad = Math.PI / 180;
    const yN = Math.asinh(Math.tan(north * rad)), yS = Math.asinh(Math.tan(south * rad));
    const dst = document.createElement('canvas'); dst.width = W; dst.height = H;
    const ctx = dst.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    let maxShift = 0;
    for (let r = 0; r < H; r++) {
      const lat = Math.atan(Math.sinh(yN - ((r + 0.5) / H) * (yN - yS))) / rad; // latitude of output row r
      const sr = Math.min(H - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * H))); // source row holding that latitude
      maxShift = Math.max(maxShift, Math.abs(sr - r));
      ctx.drawImage(src, 0, sr, W, 1, 0, r, W, 1);
    }
    dst.maxRowShift = maxShift;
    return dst;
  },
  idle(map) { return new Promise((res) => map.once('idle', res)); },
  async setStyle(map, style) {
    map.setStyle(style, { diff: false });
    await new Promise((res) => map.once('style.load', res));
  },
};
```

### 6.8 Putting the picture on the map (four variants that all worked)

Verbatim: `$B/app/tests/t07b_browse_map.mjs` lines 39 to 44. `URL_` is `BROWSE_URL`, `window.cv` the canvas from `browse.load`, and each is followed by `map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });`.

```js
const variants = {
  A_image_source_url: `map.addSource('b', { type: 'image', url: URL_, coordinates: CORNERS });`,
  B_canvas_source: `map.addSource('b', { type: 'canvas', canvas: window.cv, coordinates: CORNERS, animate: false });`,
  C_image_source_updateImage_canvas: `map.addSource('b', { type: 'image', coordinates: CORNERS }); map.getSource('b').updateImage({ image: window.cv });`,
  D_image_source_updateImage_bitmap: `map.addSource('b', { type: 'image', coordinates: CORNERS }); map.getSource('b').updateImage({ image: await createImageBitmap(window.cv) });`,
};
```

The Mercator-corrected overlay with an OSM water outline on top, over a keyless basemap, verbatim lines 123 to 130 of the same file (`window[canvasVar]` is `window.cvMerc = browse.warpRowsToMercator(window.cv, NORTH, SOUTH)`):

```js
    await browse.setStyle(map, styleUrl); map.jumpTo(view);
    map.addSource('b', { type: 'canvas', canvas: window[canvasVar], coordinates: CORNERS, animate: false });
    map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-opacity': opacity } });
    if (outline) {
      // OSM water outline from the basemap's own vector tiles, drawn above the radar picture
      const src = Object.keys(map.getStyle().sources).find((k) => map.getStyle().sources[k].type === 'vector');
      map.addLayer({ id: 'water-outline', type: 'line', source: src, 'source-layer': 'water', paint: { 'line-color': '#ffff00', 'line-width': 1.5 } });
    }
```

An independent water mask as its own style (OpenFreeMap vector tiles, no key), verbatim lines 80 to 84, and the OpenStreetMap raster basemap that also rendered, line 145:

```js
const waterStyle = (filter) => ({
  version: 8, sources: { ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } },
    { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', ...(filter ? { filter } : {}), paint: { 'fill-color': '#0000ff', 'fill-antialias': false } }],
});
const osm = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '&copy; OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
```

Sketch D2 of the brief (GIBS) uses the same `raster` + `tiles` shape as that last line but was not run.

### 6.9 Writing a web-ready COG without the deprecation warning

Verbatim: `$B/py/gen_big.py` lines 69 to 80 (`src_path` is an 8-bit GeoTIFF in EPSG:3857 with `nodata=0`; `cog_profiles`, `cog_translate` from `rio_cogeo`, `morecantile` imported at the top of the file).

```python
    report = {}
    tms = morecantile.tms.get("WebMercatorQuad")

    def cog(name, block, overviews=True):
        prof = cog_profiles.get("deflate")
        prof.update(dict(blockxsize=block, blockysize=block))
        path = os.path.join(outdir, name)
        t0 = time.time()
        cog_translate(src_path, path, prof, nodata=0, tms=tms, overview_level=None if overviews else 0,
                      overview_resampling="average", resampling="nearest", in_memory=True, quiet=True)
        report[name] = describe(path)
        report[name]["write_seconds"] = round(time.time() - t0, 1)
```

The older form that also produced valid files but warns, verbatim `$B/py/gen_cogs.py` lines 85 to 103:

```python
def write_cog(path, data, crs, transform, *, web_optimized, overviews=True):
    src_profile = dict(driver="GTiff", dtype="uint8", count=1, height=data.shape[0], width=data.shape[1],
                       crs=crs, transform=transform, nodata=0)
    dst_profile = cog_profiles.get("deflate")
    dst_profile.update(dict(blockxsize=256, blockysize=256))
    with MemoryFile() as mem:
        with mem.open(**src_profile) as tmp:
            tmp.write(data, 1)
        with mem.open() as src:
            cog_translate(
                src, path, dst_profile,
                nodata=0,
                web_optimized=web_optimized,
                overview_level=None if overviews else 0,
                overview_resampling="nearest",
                resampling="nearest",
                in_memory=True,
                quiet=True,
            )
```

Neither script reprojects real data: both build arrays directly on a Web Mercator grid.

### 6.10 Sharper pixels on HiDPI screens

Verbatim: `$B/app/tests/t08_hidpi.mjs` lines 27 to 28; the variable `tileSize` was 256, 512 or 128. With 128 the source asks for one zoom level deeper.

```js
        map.addSource('r', { type: 'raster', url: `cog://${BASE}/cogs_big/big_z13.tif?ts=${tileSize}#color:["#000000","#ffffff"],1,255,c`, tileSize });
        map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
```

### 6.11 Commands that ran

```
cd $B/app
npm ci                                                   # from package-lock.json: "added 66 packages … in 969ms"
npx vite --port 5173 --strictPort                        # dev server
curl -s -D - -o /dev/null -H "Range: bytes=0-1023" http://localhost:5173/cogs/synth_20260619.tif   # -> 206
node tests/t01_ramp_nodata.mjs                           # any test; BASE defaults to http://localhost:5173
npx vite build                                           # log: "built in 519ms"
npx vite preview --port 4173 --strictPort
BASE=http://localhost:4173 node tests/t03_worker_setup.mjs build
INCLUDE_BROKEN=1 npx vite build --outDir ../_dist_broken --emptyOutDir   # reproduces the default-import build error
cd $B/py && ./venv/bin/python gen_cogs.py ../app/public/cogs && ./venv/bin/python gen_big.py ../app/public/cogs_big
```

---

## 7. Result tables

### 7.1 Date switching, 11 small COGs (38 KB each), 1000 x 700 px view

Source: `$B/shots/t04_stdout_delay0.txt` and `$B/shots/t04_stdout_delay200.txt` (latest run). Times are medians over 11 steps: without added latency / with 200 ms added to every `.tif` request. "Cold" is the first visit to each date, "warm" the second. A "hole" frame shows the page background where data should be. Playback advances one date every 100 ms for 33 steps.

| Strategy | Cold step, ms | Warm step, ms | Steps with hole frames (cold / warm, of 11) | Playback: shown in time, hole frames | Remarks |
|---|---|---|---|---|---|
| A. remove source+layer, add again | 43.9 / 229.9 | 23.0 / 17.3 | 10 / 11 (up to 52 % of the frame) | 33/33, 33 | blank flash on every step, even warm |
| B. `source.setUrl(newUrl)` | 54.0 / 237.6 | 15.1 / 18.6 | 0 / 0 | 33/33, 0 | previous date stays up until the new one arrives |
| C. add new layer, remove old when loaded | 42.6 / 242.6 | 26.7 / 30.0 | 0 / 0 | 33/33, 0 | more code than B for no gain |
| D. all dates preloaded, `raster-opacity` 0/1, transition 0 | 0.8 / 2.4 | 0.7 / 2.0 | 0 / 0 | 33/33, 0 | one frame, always; setup 150 ms / 348 ms |
| E. all dates added, `visibility` none/visible | 17.3 / 16.6 | 0.7 / 0.6 | 10 / 0 | 33/33, 0 | first show of each date flashes for 1 to 2 frames |
| F. like D with MapLibre's default opacity transition | 292.3 / 292.3 | 291.8 / 292.0 | 0 / 0, but 15 to 16 blended frames per step | 0/33, 0 | 300 ms cross-fade; cannot keep up with 10 steps per second |

JS heap after each run was between 66 and 141 MB with no consistent ordering between strategies.

### 7.2 Date switching with large files (11 URLs of one 72 MB, 8448 x 8192 px COG), map zoom 11

Source: `$B/shots/t09_stdout.txt`. First number without added latency, second with 100 ms added to every COG range request.

| | D. preload all 11, flip opacity | B. one layer, `setUrl` |
|---|---|---|
| Setup | 447 / 1380 ms, 242 requests, 18.02 MB | none |
| 11 switches, first visit | median 1 / 0.9 ms, 0 requests, no mixed frames | median 68.2 / 255.4 ms, 242 requests, 18.02 MB, every step has 1 to 3 frames mixing old and new tiles |
| 11 switches, second visit | median 1 / 2.5 ms | median 21.8 / 21.7 ms |
| Pan to a new area, until idle | 551 / 1682 ms, 231 requests, 18.02 MB | 63 / 258 ms, 21 requests, 1.64 MB |
| Zoom in (11 to 12.6), until idle | 207 / 731 ms, 88 requests, 7.93 MB | 30 / 126 ms, 8 requests, 0.72 MB |
| Next date right after the zoom | 18 / 14 ms, 0 requests | 21 / 129 ms, 8 requests, 0.72 MB |
| JS heap | 166 / 164 MB | 126 / 126 MB |
| Long tasks (over 50 ms) | 0 | 0 |

### 7.3 Wrong and large COGs

Source: `$B/shots/t06_stdout.txt`. Map zoom 8.3 unless stated.

| File | Outcome | Requests, MB |
|---|---|---|
| EPSG:3857, web-optimised, overviews (the good case) | renders; query correct | 1, 0.04 |
| EPSG:3857, overviews, not aligned to the tile grid | renders; query correct | 1, 0.03 |
| EPSG:3857, tiled, no overviews (24 KB) | renders; query correct | 1, 0.02 |
| EPSG:3857, striped, no overviews (58 KB) | renders; query correct (`rio cogeo validate` calls it invalid) | 1, 0.06 |
| EPSG:32648 (UTM 48N) | error: `COG projection EPSG:32648 in … is not supported. Reproject to EPSG:3857 (Web Mercator).` Nothing drawn | 1, 0.03 |
| EPSG:4326 | no error, nothing drawn at the site, `locationValues` gives `NaN`; drawn at 0°N 0°E | 1, 0.02 |
| 72 MB, 256 px blocks, overviews: z8.3 / z11 / z13 | idle after 43 / 110 / 49 ms | 5, 0.39 / 23, 1.77 / 7, 0.59 |
| 72 MB, 512 px blocks, overviews: z8.3 / z11 / z13 | idle after 57 / 107 / 61 ms | 3, 0.52 / 8, 1.84 / 5, 1.18 |
| 56 MB, 256 px blocks, no overviews: z8.3 / z11 / z13 | idle after 726 / 112 / 56 ms (localhost) | 906, 61.13 / 47, 4.13 / 7, 0.59 |

### 7.4 HiDPI

Source: `$B/shots/t08_stdout.txt`. COG native zoom 13 (19.1 m). "Device px per data px" is measured from the screenshot with nearest-neighbour resampling: 1 is sharp, 2 means every data pixel covers 2 x 2 device pixels.

| Device pixel ratio | Map zoom | Declared `tileSize` | Tile zoom requested | Tiles | Device px per data px |
|---|---|---|---|---|---|
| 1 | 11 | 256 | 12 | 15 | 1.01 |
| 1 | 11 | 512 | 11 | 6 | 2.03 |
| 1 | 11 | 128 | 13 | 54 | 1.01 |
| 2 | 11 | 256 | 12 | 15 | 2.03 |
| 2 | 11 | 512 | 11 | 6 | 4.06 |
| 2 | 11 | 128 | 13 | 54 | 1.01 |
| 2 | 11.5 | 256 | 13 | 28 | 1.42 |
| 2 | 11.5 | 128 | 13 (native limit) | 28 | 1.42 |

### 7.5 Browse PNG against OpenStreetMap water

Sources: `$B/shots/t07c_stdout.txt` (Tonle Sap, 130 m per screen px, 1200 x 900 view), `$B/shots/t07d_stdout.txt` (three windows). "Naive" pins the lat/lon PNG by its four corners; "Mercator" resamples its rows first. Offsets are where the radar water body sits relative to the OSM one. One browse pixel is about 181 m.

| Water body (screen scale) | Placement | IoU at zero shift | Best-fit offset of radar vs OSM | Best IoU |
|---|---|---|---|---|
| Tonle Sap (130 m/px), OSM 2546 km², radar 2548 km² | naive | 0.9039 | 0.13 km east, 0.26 km north | 0.9177 |
| | Mercator | 0.9129 | 0.13 km east, 0.26 km south | 0.9182 |
| Tonle Sap (149 m/px, second script) | naive | 0.921 | 0.15 km east, 0.30 km north | 0.937 |
| | Mercator | 0.931 | 0.15 km east, 0.30 km south | 0.937 |
| West Baray reservoir (28 m/px), OSM 10.55 km² | naive | 0.485 | 0.31 km east, 0.45 km north | 0.831 |
| | Mercator | 0.711 | 0.31 km east, 0.08 km north | 0.817 |
| Reservoir in the south-west (49 m/px), OSM 11.3 km² | naive | 0.485 | 0.05 km west, 0 | 0.487 |
| | Mercator | 0.439 | 0.05 km west, 0.20 km south | 0.492 |

Median distance from the OSM shoreline of Tonle Sap to the radar shoreline: 0.29 km (naive), 0.26 km (Mercator); 90th percentile about 4.1 km in both, which reflects real differences in where the water was on 2026-10-17 (the south-east arm is water in OSM and not dark in the radar, see `$B/shots/t07c_lake_masks_mercator.png`), not misplacement *(digest author's reading)*. The south-west window is inconclusive: the dark threshold had to be raised to 110 to find a radar water body there at all.

---

## 8. Failures: what was tried and did not work

| Tried | Outcome (error text) |
|---|---|
| `import maplibregl from 'maplibre-gl'` with 6.18.0 (`src/defimport.js`) | Build: `[MISSING_EXPORT] "default" is not exported by "node_modules/maplibre-gl/dist/maplibre-gl.mjs".` Dev: `SyntaxError: The requested module '/node_modules/.vite/deps/maplibre-gl.js?v=6ffa2838' does not provide an export named 'default'`. Note the COG protocol README's own React example uses this import. |
| MapLibre 6 under Vite without `setWorkerUrl` (`src/noworker.js`) | `Worker failed to load. Check that the worker URL is correct.` Dev: `504 http://localhost:5173/node_modules/.vite/deps/maplibre-gl-worker.mjs?v=6.18.0`. Build: `404 http://localhost:4173/assets/maplibre-gl-worker.mjs?v=6.18.0`. COG raster still drew; GeoJSON fill did not. |
| `import Compare from '@maplibre/maplibre-gl-compare'` then `new Compare(a, b, '#wrap', {})` | Dev: `TypeError: EventEmitter is not a constructor`, with Vite's warning `Module "events" has been externalized for browser compatibility. Cannot access "events.EventEmitter" in client code.` Build: `TypeError: i is not a constructor`. No fix (for example adding the `events` npm package) was tried; the last run was cut off while preparing a re-test. |
| Plugin `dist/maplibre-gl-compare.js` with `window.maplibregl = maplibregl` (the ES module namespace) | Dev: `TypeError: Cannot assign to property 'Compare' of [object Module]`. Production build: works. |
| Plugin `dist` bundle with no `window.maplibregl` | `TypeError: Cannot read properties of undefined (reading 'Compare')` |
| Map containers styled with `.map { position: absolute; top: 0; bottom: 0; width: 100%; }` | Containers `position: relative`, height 0, canvas 1000 x 300; every swipe check `FAIL` (`225:?,, 304:?,, …`). Fixed with `#before, #after { position: absolute; inset: 0; }`. |
| Date switch by remove+add | Hole frames on every step: `"holeFrames":33,"maxHolePct":51.92` |
| Preloading with `visibility: 'none'` | First show of 10 of 11 dates has hole frames: `"stepsWithHoles":10,"holeFramesTotal":13` |
| Opacity switch with the default transition | `"completeMs":{"min":280.5,"median":292.3,"max":293}`, playback `"shownWithin100ms":"0/33"` |
| COG in EPSG:32648 | `COG projection EPSG:32648 in http://localhost:5173/cogs/bad_utm48n.tif is not supported. Reproject to EPSG:3857 (Web Mercator).` |
| COG in EPSG:4326 | No error at all; `bbox` `[0.0009297563190637048, 0.0001095944646499468, 0.000942332733041378, 0.00012127256335341654]`; nothing at the real location |
| 72 MB-class COG without overviews at zoom 8.3 | `network: 906 requests, 61.13 MB`, JS heap 184 MB |
| `<img>` without `crossOrigin` drawn to a canvas, then `getImageData` | `SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The canvas has been tainted by cross-origin data.` |
| `OPTIONS` preflight on the browse URL | `HTTP/2 405` (with `access-control-allow-methods: GET`) |
| Looking for georeferencing beside the browse PNG (`_LATLON.kml`, `.kml`, `.png`, `_LATLON.png.aux.xml`, `_LATLON.pgw`, `_LATLON.wld`, `_BROWSE.png`, `_BROWSE.kml`, `_LATLON.json`, `_LATLON.tif`) | all `404 text/html` |
| Offset check on the south-west reservoir with one fixed "dark" threshold (`max(R,G,B) < 40`) | No radar water body found (`"radarBodyKm2":0`); with a per-window threshold of 110 a body was found but IoU stayed at 0.49: inconclusive |
| `__dirname` in `vite.config.js` | Vite 8 warning: `Your Vite config uses features that are unsupported by `configLoader: 'native'` … `__dirname` (vite.config.js:7:15). Use `import.meta.dirname` instead`. Replaced with `import.meta.dirname`. |

---

## 9. Open questions

1. **MapLibre 5.24.1** with the COG protocol under Vite: never run. Only the protocol's peer range says it should work.
2. **GIBS NISAR layer (sketch D2) in MapLibre:** never run. Unverified on a map: the `{z}/{y}/{x}` template, behaviour past zoom 13, the look of the 288-byte empty tiles, date switching on that layer.
3. **React and TypeScript:** all tests were plain JavaScript modules. `react-map-gl` with MapLibre 6 is untested, and the protocol README's React example uses a default import that fails on version 6. Typing of the `?url` worker import in TypeScript is untested.
4. **Base path:** everything was served at `/`. GitHub Pages serves a project site under `/<repository-name>/` (the brief gives `/NASA-space-apps-2026/`); the worker URL (handled by Vite's `?url`) and the hand-built `cog://` absolute URLs under a base path are untested.
5. **Real hosting and network:** only localhost, with 100 or 200 ms added per request. GitHub Pages range behaviour, caching and latency with this protocol were not measured here.
6. **Multi-band stack COG** (one band per date) through `locationValues`: not run; only single-band uint8 files. Float32 COGs and files with GDAL scale/offset were not run either (the README says `#color` and `locationValues` apply scale/offset, and a colour function does not). If that holds, declaring scale and offset in the exported COG would let ramp limits and click values be in dB directly; untested.
7. **"Neighbours only" preloading** (current date plus or minus one or two), which is what the brief words, was not measured; only "all 11" against `setUrl`.
8. **Making the compare plugin work** through an `events` polyfill or alias: not tried. **`@mapbox/mapbox-gl-sync-move` imported directly** with MapLibre 6: not tried (it ran only inside the plugin's prebuilt bundle).
9. **Other browsers and devices:** only headless Chrome 157 on a Mac. Safari (iOS), Firefox, real phones, touch dragging of the swipe handle, and whether they honour the PNG `tRNS` transparency and the `binary/octet-stream` image, are unverified.
10. **Browse overlay generality:** one granule, one date, one stack. The corner coordinates came from the brief; the fitting method of D4 was not re-derived. The 0.13 to 0.31 km eastward residual is unexplained (corner fit, browse geocoding, or OSM shoreline). Other dates of the stack, other stacks and high-latitude frames were not checked; the corner-pinning error grows with frame height and latitude (*belief*, from the formula in `t07c_offset.mjs`).
11. **Which polarisations** the magenta and green of the browse PNG encode: not established.
12. Whether MapLibre 6 truly **requires WebGL 2**: not tested.
13. OpenFreeMap **`positron` and `dark`** under 6.18.0 (rendering and console warnings): not rendered, only `positron`'s style JSON was fetched.
14. Python's built-in HTTP server and range requests (brief 6.6): still not tested.

---

## 10. Artifacts and how to reuse them

The scratch folder is under `/private/tmp` and can disappear on reboot; the code is reproduced in the appendices for that reason. Absolute paths:

| Path | What it is | Reuse notes |
|---|---|---|
| `<scratch>/verify/browser/app/package.json`, `<scratch>/verify/browser/app/package-lock.json` | Dependency set that ran | Copy the lockfile or pin exact versions. Drop `@maplibre/maplibre-gl-compare`, `playwright`, `pngjs` from the product (keep the last two as dev dependencies if the tests are kept). |
| `<scratch>/verify/browser/app/vite.config.js` | Multi-page Vite config (every root `*.html` is an entry; `defimport.html` only with `INCLUDE_BROKEN=1`) | A single-page app needs none of it; add `base: '/<repository-name>/'` for GitHub Pages (untested here). |
| `<scratch>/verify/browser/app/src/common.js` | Working import, worker, protocol registration, `makeDatedMap`, `whenIdle` | Copy the first eight lines unchanged. Replace `cogUrl`, `DATES`, `RAMP` with manifest-driven values. |
| `<scratch>/verify/browser/app/src/harness.js`, `<scratch>/verify/browser/app/harness.html` | Test page exposing `map`, `maplibregl`, `cog`, `waitIdle`, `readPx`, `projectPt` on `window` | Reuse as the page under test. `preserveDrawingBuffer` is on so that pixels can be read; a product does not need it. |
| `<scratch>/verify/browser/app/src/compare_clip.js`, `<scratch>/verify/browser/app/compare_clip.html` | Working swipe | Replace the two `makeDatedMap` calls with the app's maps; keep `syncMaps`, `setSwipe`, the handle and the ID-selector CSS. Add keyboard handling. |
| `<scratch>/verify/browser/app/src/compare_dist.js` | Plugin `dist` bundle workaround (`window.maplibregl = { ...maplibregl }`) | Only if the plugin's look is wanted. |
| `<scratch>/verify/browser/app/src/noworker.js`, `<scratch>/verify/browser/app/src/defimport.js`, `<scratch>/verify/browser/app/src/compare_plugin.js` | The three failing variants | Reference only. |
| `<scratch>/verify/browser/app/tests/lib.mjs`, `<scratch>/verify/browser/app/tests/pattern.mjs` | Playwright helpers (launch installed Chrome, screenshot, pixel lookup); the synthetic pattern | Set `BASE` to the page under test. Needs Google Chrome installed and `npm i -D playwright pngjs`. |
| `<scratch>/verify/browser/app/tests/t00_smoke.mjs` … `t09_preload_big.mjs`, `switchlab.js`, `browselab.js`, `masklib.mjs`, `nisar.mjs` | All experiments | Run with the dev server up: `node tests/<name>.mjs`. t03 and t05 take `dev` or `build` as argument with `BASE` set; t04 takes a delay in ms; t09 takes a list of delays. Outputs go to `<scratch>/verify/browser/shots/`. |
| `<scratch>/verify/browser/py/gen_cogs.py`, `<scratch>/verify/browser/py/gen_big.py`, `<scratch>/verify/browser/py/check_cogs.py`, `<scratch>/verify/browser/py/inspect_browse.py`, `<scratch>/verify/browser/py/requirements.freeze.txt` | Synthetic COG generators, cross-check, PNG inspector, pinned Python packages | `python3 -m venv venv && ./venv/bin/pip install rasterio rio-cogeo numpy pillow`. The COG-writing calls are reusable; the data are synthetic. |
| `<scratch>/verify/browser/app/public/cogs/synth_20260619.tif` … `synth_20261017.tif` (11 files, about 38 KB each), `<scratch>/verify/browser/app/public/cogs/cogs_report.json` | Eleven dated synthetic COGs over lon 103.5 to 104.9, lat 12.2 to 13.5, uint8, EPSG:3857, nodata 0, overviews | Ready-made mock data for the web session before real rasters exist. The dates are a plain 12-day series from 2026-06-19 to 2026-10-17, not the real pass list (which, per the brief, skips 2026-08-06 and ends 2026-10-29). Clearly synthetic: blocks, a nodata ellipse, a moving bright square. Do not ship. |
| `<scratch>/verify/browser/app/public/cogs/bad_*.tif`, `ok_unaligned.tif` | Deliberately wrong COGs | Fixtures for a "bad input" test. |
| `<scratch>/verify/browser/app/public/cogs_big/` (192 MB) | 72 MB speckled COGs for performance tests | Test data only; never copy into the repository. `<scratch>/verify/browser/app/dist/` contains another copy. |
| `<scratch>/verify/browser/shots/*_stdout.txt`, `<scratch>/verify/browser/shots/*_results.json` | Saved outputs of the latest run (t00 to t09), build logs `build_1.txt`, `build_with_defimport.txt` | The evidence quoted above. `<scratch>/verify/browser/_previous_attempt/shots/` holds the earlier run. |
| `<scratch>/verify/browser/shots/*.png` (123 screenshots) | Visual evidence | Most useful: `t07b_liberty_lake_outline_mercator.png`, `t07c_lake_masks_mercator.png`, `t05_build_own_clip_path_3_dragged707.png`, `t02_click_query_popup.png`, `t06_bad_epsg4326.png`. |
| `<scratch>/verify/browser/net/browse_png/browse.png`, `<scratch>/verify/browser/net/browse_headers.txt`, `<scratch>/verify/browser/net/derived/browse_preview_half.png` | The real browse PNG (4.2 MB), its response headers (signature redacted), a half-size preview | The PNG can serve as an offline fixture. |

Data URLs that worked without a key or login:

- `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png` (browse PNG; for another granule substitute collection and granule name).
- `https://tiles.openfreemap.org/styles/liberty` (style), `https://tiles.openfreemap.org/planet` (vector TileJSON; `source-layer: 'water'`).
- `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (raster basemap, `maxzoom: 19`, attribution `© OpenStreetMap contributors`).

---

# Appendix A: complete application-side files (verbatim)

### A.1 `$B/app/package.json`

```json
{
  "name": "nisar-browser-verify",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173 --strictPort",
    "build": "vite build",
    "preview": "vite preview --port 4173 --strictPort"
  },
  "dependencies": {
    "@geomatico/maplibre-cog-protocol": "^0.10.0",
    "@maplibre/maplibre-gl-compare": "^0.5.0",
    "geotiff": "^3.0.5",
    "maplibre-gl": "^6.18.0"
  },
  "devDependencies": {
    "playwright": "^1.65.1",
    "pngjs": "^7.0.0",
    "vite": "^8.3.8"
  }
}
```

### A.2 `$B/app/vite.config.js`

```js
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

// every *.html in the project root is an entry point.
// defimport.html demonstrates a build-breaking default import of maplibre-gl 6, so it is only
// included in the production build when INCLUDE_BROKEN=1.
const skip = process.env.INCLUDE_BROKEN === '1' ? [] : ['defimport.html'];
const pages = Object.fromEntries(
  readdirSync(import.meta.dirname)
    .filter((f) => f.endsWith('.html') && !skip.includes(f))
    .map((f) => [f.replace('.html', ''), resolve(import.meta.dirname, f)])
);

export default defineConfig({
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { rollupOptions: { input: pages } },
});
```

### A.3 `$B/app/harness.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>harness</title>
  <style>
    html, body { margin: 0; height: 100%; }
    #map { position: absolute; inset: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="module" src="/src/harness.js"></script>
</body>
</html>
```

### A.4 `$B/app/src/harness.js`

```js
// Generic test harness: exposes maplibre + cog protocol on window so Playwright can drive it.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as cog from '@geomatico/maplibre-cog-protocol';
// MapLibre GL JS 6 ships its worker as a separate ES module; with a bundler the default lookup
// (new URL('./maplibre-gl-worker.mjs', import.meta.url)) points at a file that does not exist.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

if (new URLSearchParams(location.search).get('worker') !== '0') maplibregl.setWorkerUrl(workerUrl);

const params = new URLSearchParams(location.search);

window.maplibregl = maplibregl;
window.cog = cog;
window.errors = [];

maplibregl.addProtocol('cog', cog.cogProtocol);

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': params.get('bg') || '#ff00ff' } }],
  },
  center: [104.2, 12.85],
  zoom: Number(params.get('zoom') || 8),
  fadeDuration: 0,
  attributionControl: false,
  canvasContextAttributes: { preserveDrawingBuffer: params.get('pdb') !== '0' },
});
window.map = map;
map.on('error', (e) => {
  const msg = (e && e.error && (e.error.message || String(e.error))) || String(e);
  window.errors.push(msg);
  console.error('[map error]', msg);
});
window.mapLoaded = new Promise((resolve) => map.on('load', resolve));

// resolve when the map is idle (all tiles loaded + rendered)
window.waitIdle = () => new Promise((resolve) => {
  if (map.loaded() && !map.isMoving() && map.areTilesLoaded()) { map.once('idle', resolve); map.triggerRepaint(); } else map.once('idle', resolve);
});

// read one RGBA pixel of the WebGL canvas at a lon/lat (needs preserveDrawingBuffer)
window.readPx = (lngLat) => {
  const p = map.project(lngLat);
  const canvas = map.getCanvas();
  const dpr = canvas.width / canvas.clientWidth;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const px = new Uint8Array(4);
  gl.readPixels(Math.round(p.x * dpr), canvas.height - Math.round(p.y * dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from(px);
};
window.projectPt = (lngLat) => { const p = map.project(lngLat); return [p.x, p.y]; };
```

### A.5 `$B/app/src/common.js`

Shown in Section 6.1.

### A.6 `$B/app/compare_clip.html` and `$B/app/src/compare_clip.js`

Shown in Section 6.5.

### A.7 `$B/app/src/compare_dist.js` (plugin `dist` bundle; works with `?global=copy`; `compare_dist.html` is `compare_clip.html` with the script name changed)

```js
// Variant 2: the plugin's prebuilt browserify bundle (dist/maplibre-gl-compare.js). It only exposes itself by
// assigning window.maplibregl.Compare, so window.maplibregl has to exist and be a plain, extensible object
// (the ES module namespace of maplibre-gl 6 is frozen).
import { maplibregl, cog, makeDatedMap, whenIdle } from './common.js';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';

window.cog = cog;
const mode = new URLSearchParams(location.search).get('global') || 'copy';
if (mode === 'copy') window.maplibregl = { ...maplibregl };      // extensible copy
else if (mode === 'namespace') window.maplibregl = maplibregl;   // frozen module namespace
// mode === 'none': no global at all
const a = makeDatedMap('before', 0, '#ff00ff');
const b = makeDatedMap('after', 5, '#00ffff');
window.mapA = a; window.mapB = b;
window.ready = (async () => {
  try {
    await import('@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.js');
    window.compare = new window.maplibregl.Compare(a, b, '#wrap', {});
    window.compareOk = true;
  } catch (e) {
    window.compareOk = false;
    window.compareError = String(e && e.stack || e);
  }
  await Promise.all([whenIdle(a), whenIdle(b)]);
})();
```

### A.8 Failing variants, for reference

`$B/app/src/compare_plugin.js` (fails: `EventEmitter is not a constructor`):

```js
// Variant 1: the npm plugin imported the normal bundler way.
import { maplibregl, cog, makeDatedMap, whenIdle } from './common.js';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';

window.cog = cog;
window.importedCompareType = typeof Compare;
const a = makeDatedMap('before', 0, '#ff00ff');
const b = makeDatedMap('after', 5, '#00ffff');
window.mapA = a; window.mapB = b;
try {
  window.compare = new Compare(a, b, '#wrap', {});
  window.compareOk = true;
} catch (e) {
  window.compareOk = false;
  window.compareError = String(e && e.stack || e);
}
window.ready = Promise.all([whenIdle(a), whenIdle(b)]);
```

`$B/app/src/defimport.js` (fails: no default export):

```js
// What every pre-v6 tutorial does: a DEFAULT import of maplibre-gl.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

window.defaultImportValue = typeof maplibregl;
window.map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ff00ff' } }] },
  center: [104.2, 12.85],
  zoom: 8,
});
```

`$B/app/src/noworker.js` differs from `harness.js` only by lacking the worker import and the `setWorkerUrl` line.

### A.9 `$B/app/tests/nisar.mjs` and `$B/app/tests/browselab.js`

Shown in Section 6.7.

---

# Appendix B: complete test scripts and generators (verbatim)

### B.1 `$B/app/tests/lib.mjs`

```js
// Shared Playwright helpers. Uses the installed Google Chrome (channel "chrome"), headless.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SHOTS = resolve(here, '../../shots');
mkdirSync(SHOTS, { recursive: true });
export const BASE = process.env.BASE || 'http://localhost:5173';

export async function launch({ dpr = 1, width = 1000, height = 700, headless = true, args = [] } = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless, args });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    userAgent: undefined,
  });
  const page = await context.newPage();
  const log = { console: [], pageErrors: [], failed: [], requests: [] };
  page.on('console', (m) => log.console.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => log.pageErrors.push(String(e && e.stack || e)));
  page.on('requestfailed', (r) => log.failed.push(`${r.method()} ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', (r) => {
    const req = r.request();
    log.requests.push({ url: r.url(), status: r.status(), range: req.headers()['range'] || null, type: req.resourceType() });
  });
  return { browser, context, page, log };
}

export async function shot(page, name, opts = {}) {
  const path = resolve(SHOTS, name);
  const buf = await page.screenshot({ path, ...opts });
  return { path, png: PNG.sync.read(buf) };
}

// RGBA at CSS pixel (x, y) of a decoded screenshot taken with device scale factor dpr
export function pxAt(png, x, y, dpr = 1) {
  const X = Math.round(x * dpr), Y = Math.round(y * dpr);
  const i = (png.width * Y + X) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}

export function saveJson(name, obj) {
  const path = resolve(SHOTS, name);
  writeFileSync(path, JSON.stringify(obj, null, 1));
  return path;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
```

### B.2 `$B/app/tests/pattern.mjs`

```js
// JS twin of py/gen_cogs.py pattern(): expected uint8 value at lon/lat for date index k (0 = nodata)
export const W = 103.5, E = 104.9, S = 12.2, N = 13.5, NB = 8;
export const DATES = ['20260619', '20260701', '20260713', '20260725', '20260806', '20260818',
  '20260830', '20260911', '20260923', '20261005', '20261017'];
export function expected(lon, lat, k) {
  if (lon < W || lon >= E || lat <= S || lat > N) return 0;
  const a = 0.12 + 0.04 * (k % 6), b = 0.08 + 0.025 * (k % 6);
  if (((lon - 104.2) / a) ** 2 + ((lat - 12.85) / b) ** 2 <= 1) return 0;
  const sqLon = 103.62 + 0.11 * k, sqLat = 12.36;
  if (Math.abs(lon - sqLon) <= 0.03 && Math.abs(lat - sqLat) <= 0.03) return 255;
  const i = Math.floor((lon - W) / (E - W) * NB), j = Math.floor((N - lat) / (N - S) * NB);
  return 30 + 25 * ((i + j + k) % 8);
}
export const blockCentre = (i, j) => [W + (i + 0.5) * (E - W) / NB, N - (j + 0.5) * (N - S) / NB];
```

### B.3 `$B/app/tests/t00_smoke.mjs`

```js
// Smoke test: does MapLibre GL JS 6 + cog protocol load under the Vite dev server in headless Chrome?
import { launch, shot, BASE } from './lib.mjs';

const { browser, page, log } = await launch();
await page.goto(`${BASE}/harness.html`);
const info = await page.evaluate(async () => {
  await window.mapLoaded;
  const gl = map.getCanvas().getContext('webgl2') || map.getCanvas().getContext('webgl');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    maplibreVersion: maplibregl.getVersion(),
    workerUrl: maplibregl.getWorkerUrl(),
    workerCount: maplibregl.getWorkerCount(),
    cogExports: Object.keys(cog),
    webglVersion: gl.getParameter(gl.VERSION),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    ua: navigator.userAgent,
    dpr: devicePixelRatio,
    canvas: [map.getCanvas().width, map.getCanvas().height],
    hasDefaultExport: 'default' in maplibregl,
  };
});
console.log(JSON.stringify(info, null, 1));
await shot(page, 't00_smoke.png');
console.log('console:', log.console);
console.log('pageErrors:', log.pageErrors);
console.log('failed:', log.failed);
console.log('non-200 responses:', log.requests.filter((r) => r.status >= 400));
console.log('worker-ish requests:', log.requests.filter((r) => /worker/i.test(r.url)).map((r) => `${r.status} ${r.url}`));
await browser.close();
```

### B.4 `$B/app/tests/t01_ramp_nodata.mjs`

```js
// (a) cog:// raster source with a colour ramp and explicit min/max; (b) nodata transparency.
import { launch, shot, pxAt, saveJson, BASE } from './lib.mjs';
import { expected, blockCentre, DATES } from './pattern.mjs';

const { browser, page, log } = await launch();
await page.goto(`${BASE}/harness.html?zoom=8.3`);
await page.evaluate(() => window.mapLoaded);

const k = 0;
const cogUrl = `${BASE}/cogs/synth_${DATES[k]}.tif`;
const results = {};

async function runCase(name, hash) {
  await page.evaluate(async ({ cogUrl, hash }) => {
    if (map.getLayer('r')) map.removeLayer('r');
    if (map.getSource('r')) map.removeSource('r');
    map.addSource('r', { type: 'raster', url: `cog://${cogUrl}${hash}`, tileSize: 256 });
    map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
    await new Promise((res) => map.once('idle', res));
  }, { cogUrl, hash });
  const { png, path } = await shot(page, `t01_${name}.png`);
  // sample: 8 block centres along the top row (j = 0) -> values 30..205; the lake centre (nodata);
  // a point inside the file's nodata padding; a point outside the file extent entirely
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push({ label: `block(${i},0)`, ll: blockCentre(i, 0) });
  pts.push({ label: 'lake-centre(nodata)', ll: [104.2, 12.85] });
  pts.push({ label: 'padding(nodata, inside file)', ll: [103.42, 12.1] });
  pts.push({ label: 'outside file', ll: [103.0, 12.85] });
  pts.push({ label: 'bright square', ll: [103.62, 12.36] });
  const rows = [];
  for (const p of pts) {
    const [x, y] = await page.evaluate((ll) => window.projectPt(ll), p.ll);
    const shotPx = pxAt(png, x, y);
    const glPx = await page.evaluate((ll) => window.readPx(ll), p.ll);
    rows.push({ ...p, value: expected(p.ll[0], p.ll[1], k), screenshotRGBA: shotPx, readPixelsRGBA: glPx });
  }
  results[name] = { hash, screenshot: path, rows };
  console.log(`\n== ${name}  url = cog://${cogUrl}${hash}`);
  for (const r of rows) console.log(`  ${r.label.padEnd(30)} value=${String(r.value).padStart(3)}  screenshot=${JSON.stringify(r.screenshotRGBA)}  gl.readPixels=${JSON.stringify(r.readPixelsRGBA)}`);
  return rows;
}

// 1. custom two-colour ramp black->white, continuous, min 30 max 205: grey = (v-30)/175*255
const grey = await runCase('grey_30_205', '#color:["#000000","#ffffff"],30,205,c');
// 2. same ramp, different explicit min/max 55..155 (values outside clamp)
const grey2 = await runCase('grey_55_155', '#color:["#000000","#ffffff"],55,155,c');
// 3. named ColorBrewer ramp, continuous
const spectral = await runCase('BrewerSpectral9_30_205_c', '#color:BrewerSpectral9,30,205,c');
// 4. named ramp, discrete (no "c"), reversed
const discrete = await runCase('BrewerYlOrRd7_30_205_rev', '#color:BrewerYlOrRd7,30,205,-');
// 5. no #color at all: single-band uint8 rendered as greyscale photo
const plain = await runCase('plain_no_hash', '');

// expected colours computed by the library's own exported colorScale()
const libExpected = await page.evaluate(() => {
  const vals = [30, 55, 80, 105, 130, 155, 180, 205, 255];
  const mk = (o) => vals.map((v) => Array.from(cog.colorScale(o)(v)).map(Math.round));
  return {
    vals,
    grey_30_205: mk({ customColors: ['#000000', '#ffffff'], min: 30, max: 205, isContinuous: true }),
    grey_55_155: mk({ customColors: ['#000000', '#ffffff'], min: 55, max: 155, isContinuous: true }),
    spectral: mk({ colorScheme: 'BrewerSpectral9', min: 30, max: 205, isContinuous: true }),
    discrete: mk({ colorScheme: 'BrewerYlOrRd7', min: 30, max: 205, isReverse: true }),
  };
});
console.log('\nlibrary colorScale() expectations for values', libExpected.vals);
for (const key of ['grey_30_205', 'grey_55_155', 'spectral', 'discrete']) console.log(' ', key, JSON.stringify(libExpected[key]));

// assertions
const close = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
let ok = true;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) ok = false; };
const BG = [255, 0, 255];
for (const [name, rows, exp] of [['grey_30_205', grey, libExpected.grey_30_205], ['grey_55_155', grey2, libExpected.grey_55_155],
  ['spectral', spectral, libExpected.spectral], ['discrete', discrete, libExpected.discrete]]) {
  for (let i = 0; i < 8; i++) {
    const v = rows[i].value, idx = libExpected.vals.indexOf(v);
    check(close(rows[i].screenshotRGBA.slice(0, 3), exp[idx]), `${name}: value ${v} -> screenshot ${rows[i].screenshotRGBA.slice(0, 3)} vs colorScale ${exp[idx]}`);
  }
  check(close(rows[8].screenshotRGBA.slice(0, 3), BG, 0), `${name}: lake nodata pixel shows the magenta background ${rows[8].screenshotRGBA.slice(0, 3)}`);
  check(close(rows[9].screenshotRGBA.slice(0, 3), BG, 0), `${name}: nodata padding pixel shows the magenta background ${rows[9].screenshotRGBA.slice(0, 3)}`);
  check(close(rows[10].screenshotRGBA.slice(0, 3), BG, 0), `${name}: outside-file pixel shows the magenta background ${rows[10].screenshotRGBA.slice(0, 3)}`);
}
for (let i = 0; i < 8; i++) check(close(plain[i].screenshotRGBA.slice(0, 3), [plain[i].value, plain[i].value, plain[i].value]), `plain: value ${plain[i].value} drawn as grey ${plain[i].screenshotRGBA.slice(0, 3)}`);
check(close(plain[8].screenshotRGBA.slice(0, 3), BG, 0), `plain: nodata is transparent ${plain[8].screenshotRGBA.slice(0, 3)}`);

const meta = await page.evaluate((u) => cog.getCogMetadata(u), cogUrl);
console.log('\ngetCogMetadata:', JSON.stringify(meta));
const tj = await page.evaluate(() => { const s = map.getSource('r'); return { minzoom: s.minzoom, maxzoom: s.maxzoom, tileSize: s.tileSize, bounds: s.tileBounds && s.tileBounds.bounds && s.tileBounds.bounds.toArray(), tiles: s.tiles }; });
console.log('source after TileJSON:', JSON.stringify(tj));
console.log('\nmap errors:', await page.evaluate(() => window.errors));
console.log('console errors:', log.console.filter((l) => l.startsWith('[error]') || l.startsWith('[warning]')));
console.log('COG range requests:', log.requests.filter((r) => /\.tif/.test(r.url)).length, 'statuses', [...new Set(log.requests.filter((r) => /\.tif/.test(r.url)).map((r) => r.status))]);
saveJson('t01_results.json', { results, libExpected, meta, tj });
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
await browser.close();
```

### B.5 `$B/app/tests/t02_colorfn_query.mjs`

```js
// (c) custom per-pixel colour function; (d) pixel value query at a clicked lon/lat.
import { launch, shot, pxAt, saveJson, BASE } from './lib.mjs';
import { expected, blockCentre, DATES, NB } from './pattern.mjs';

const { browser, page, log } = await launch();
await page.goto(`${BASE}/harness.html?zoom=8.3`);
await page.evaluate(() => window.mapLoaded);
let ok = true;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) ok = false; };
const close = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const out = {};

// ---------- (c) custom colour function
const k = 3;
const cogUrl = `${BASE}/cogs/synth_${DATES[k]}.tif`;
await page.evaluate(async (cogUrl) => {
  // classify: < 100 red, 100..179 green, >= 180 blue at 50 % alpha, nodata transparent
  window.fnCalls = 0;
  cog.setColorFunction(cogUrl, (pixel, color, metadata) => {
    window.fnCalls++;
    const v = pixel[0];
    if (v === metadata.noData) color.set([0, 0, 0, 0]);
    else if (v < 100) color.set([255, 0, 0, 255]);
    else if (v < 180) color.set([0, 255, 0, 255]);
    else color.set([0, 0, 255, 128]);
  });
  map.addSource('c', { type: 'raster', url: `cog://${cogUrl}`, tileSize: 256 });
  map.addLayer({ id: 'c', type: 'raster', source: 'c', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  await new Promise((res) => map.once('idle', res));
}, cogUrl);
let s = await shot(page, 't02_colorfn_classes.png');
const rows = [];
for (let i = 0; i < NB; i++) {
  const ll = blockCentre(i, 0);
  const v = expected(ll[0], ll[1], k);
  const [x, y] = await page.evaluate((ll) => window.projectPt(ll), ll);
  const px = pxAt(s.png, x, y).slice(0, 3);
  // blue at alpha 128 over magenta (255,0,255) -> approx (127,0,255)
  const exp = v < 100 ? [255, 0, 0] : v < 180 ? [0, 255, 0] : [127, 0, 255];
  rows.push({ ll, v, px, exp });
  check(close(px, exp, 3), `colour fn: value ${v} -> ${px} (expected ~${exp})`);
}
{
  const [x, y] = await page.evaluate((ll) => window.projectPt(ll), [104.2, 12.85]);
  const px = pxAt(s.png, x, y).slice(0, 3);
  check(close(px, [255, 0, 255], 0), `colour fn: nodata lake -> ${px} (magenta background)`);
}
out.colorfn = { rows, fnCalls: await page.evaluate(() => window.fnCalls) };
console.log('colour function calls so far:', out.colorfn.fnCalls, '(= 65536 per 256x256 tile)');

// change the colour function: does the map update by itself? after remove+add layer? after remove+add source?
const probe = blockCentre(0, 0); // value for k=3 at block (0,0) = 30 + 25*3 = 105 -> green
const readProbe = async () => { const sh = await page.screenshot(); const { PNG } = await import('pngjs'); const png = PNG.sync.read(sh); const [x, y] = await page.evaluate((ll) => window.projectPt(ll), probe); return pxAt(png, x, y).slice(0, 3); };
const before = await readProbe();
await page.evaluate(async (cogUrl) => {
  cog.setColorFunction(cogUrl, (pixel, color) => { if (pixel[0] === 0) color[3] = 0; else color.set([255, 255, 0, 255]); }); // all yellow
  map.triggerRepaint();
  await new Promise((res) => setTimeout(res, 500));
}, cogUrl);
const afterSetOnly = await readProbe();
await page.evaluate(async () => {
  map.removeLayer('c');
  map.addLayer({ id: 'c', type: 'raster', source: 'c', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  await new Promise((res) => map.once('idle', res));
});
const afterLayerReadd = await readProbe();
await page.evaluate(async (cogUrl) => {
  map.removeLayer('c'); map.removeSource('c');
  map.addSource('c', { type: 'raster', url: `cog://${cogUrl}`, tileSize: 256 });
  map.addLayer({ id: 'c', type: 'raster', source: 'c', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  await new Promise((res) => map.once('idle', res));
}, cogUrl);
const afterSourceReadd = await readProbe();
console.log('probe pixel: before change', before, '| after setColorFunction only', afterSetOnly, '| after layer remove+add', afterLayerReadd, '| after source remove+add', afterSourceReadd);
out.colorfnRefresh = { before, afterSetOnly, afterLayerReadd, afterSourceReadd };
await shot(page, 't02_colorfn_changed_yellow.png');

// colour function wins over a #color hash on the same URL?
await page.evaluate(async (cogUrl) => {
  map.removeLayer('c'); map.removeSource('c');
  map.addSource('c', { type: 'raster', url: `cog://${cogUrl}#color:BrewerSpectral9,30,205,c`, tileSize: 256 });
  map.addLayer({ id: 'c', type: 'raster', source: 'c', paint: { 'raster-fade-duration': 0 } });
  await new Promise((res) => map.once('idle', res));
}, cogUrl);
out.fnVsHash = await readProbe();
console.log('colour function + #color hash on same URL -> probe pixel', out.fnVsHash, '(yellow = function wins)');
// remove it again, and use a query-string variant of the URL to get an independent function
await page.evaluate(async (cogUrl) => {
  cog.setColorFunction(cogUrl, undefined);
  map.removeLayer('c'); map.removeSource('c');
}, cogUrl);

// ---------- (d) locationValues
const q = [];
let mismatches = 0, n = 0;
for (const kk of [0, 3, 10]) {
  const url = `${BASE}/cogs/synth_${DATES[kk]}.tif`;
  const pts = [];
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) pts.push(blockCentre(i, j));
  pts.push([104.2, 12.85], [103.62 + 0.11 * kk, 12.36], [103.42, 12.1], [103.0, 12.85]);
  const got = await page.evaluate(async ({ url, pts }) => {
    const res = [];
    for (const [lon, lat] of pts) {
      const full = await cog.locationValues(url, { latitude: lat, longitude: lon });
      const z8 = await cog.locationValues(url, { latitude: lat, longitude: lon }, 8);
      res.push({ full: full.map((v) => (Number.isNaN(v) ? 'NaN' : v)), z8: z8.map((v) => (Number.isNaN(v) ? 'NaN' : v)) });
    }
    return res;
  }, { url, pts });
  pts.forEach((ll, idx) => {
    const exp = expected(ll[0], ll[1], kk);
    const expOut = exp === 0 ? 'NaN' : exp; // nodata comes back as NaN
    n++;
    const good = got[idx].full[0] === expOut && got[idx].z8[0] === expOut && got[idx].full.length === 1;
    if (!good) { mismatches++; console.log('  MISMATCH', DATES[kk], ll, 'expected', expOut, 'got', JSON.stringify(got[idx])); }
    q.push({ date: DATES[kk], ll, expected: expOut, got: got[idx] });
  });
}
check(mismatches === 0, `locationValues: ${n - mismatches}/${n} points match the synthetic formula (full res and zoom=8 overview), nodata/outside -> NaN`);
console.log('  sample:', JSON.stringify(q[0]), JSON.stringify(q[64]), JSON.stringify(q[66]), JSON.stringify(q[67]));
out.query = q;

// real mouse click -> locationValues
const kc = 3, urlc = `${BASE}/cogs/synth_${DATES[kc]}.tif`;
await page.evaluate(async (urlc) => {
  map.addSource('q', { type: 'raster', url: `cog://${urlc}#color:BrewerSpectral9,30,205,c`, tileSize: 256 });
  map.addLayer({ id: 'q', type: 'raster', source: 'q' });
  window.clicks = [];
  map.on('click', async (e) => {
    const t0 = performance.now();
    const values = await cog.locationValues(urlc, { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    window.clicks.push({ lngLat: [e.lngLat.lng, e.lngLat.lat], values: values.map((v) => (Number.isNaN(v) ? 'NaN' : v)), ms: performance.now() - t0 });
    new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(`value: <b>${values[0]}</b><br>${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`).addTo(map);
  });
  await new Promise((res) => map.once('idle', res));
}, urlc);
const clickTargets = [blockCentre(2, 1), blockCentre(6, 5), [104.2, 12.85], [103.62 + 0.11 * kc, 12.36]];
for (const ll of clickTargets) {
  const [x, y] = await page.evaluate((ll) => window.projectPt(ll), ll);
  await page.mouse.click(x, y);
  await page.waitForFunction((nn) => window.clicks.length >= nn, clickTargets.indexOf(ll) + 1);
}
const clicks = await page.evaluate(() => window.clicks);
clicks.forEach((c, i) => {
  const exp = expected(c.lngLat[0], c.lngLat[1], kc);
  check(c.values[0] === (exp === 0 ? 'NaN' : exp), `click at ${c.lngLat.map((v) => v.toFixed(4))} -> locationValues ${JSON.stringify(c.values)} expected ${exp === 0 ? 'NaN (nodata)' : exp}  (${c.ms.toFixed(1)} ms)`);
});
out.clicks = clicks;
await shot(page, 't02_click_query_popup.png');

console.log('\nmap errors:', await page.evaluate(() => window.errors));
console.log('console errors:', log.console.filter((l) => l.startsWith('[error]') || l.startsWith('[warning]')));
saveJson('t02_results.json', out);
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
await browser.close();
```

### B.6 `$B/app/tests/t03_worker_setup.mjs`

```js
// Worker / import pitfalls of MapLibre GL JS 6 under a bundler (Vite). Run against dev (5173) or preview (4173):
//   BASE=http://localhost:5173 node tests/t03_worker_setup.mjs dev
//   BASE=http://localhost:4173 node tests/t03_worker_setup.mjs build
import { launch, shot, pxAt, saveJson, BASE, sleep } from './lib.mjs';
import { DATES, blockCentre } from './pattern.mjs';

const tag = process.argv[2] || 'dev';
const out = {};
const cogUrl = `${BASE}/cogs/synth_${DATES[0]}.tif`;

async function probe(pageName, label) {
  const { browser, page, log } = await launch();
  const res = { page: pageName };
  try {
    await page.goto(`${BASE}/${pageName}`);
    await sleep(1500);
    res.hasMap = await page.evaluate(() => typeof window.map !== 'undefined');
    if (res.hasMap) {
      res.info = await page.evaluate(async ({ cogUrl }) => {
        const r = { errors: [] };
        const on = (e) => r.errors.push(String((e.error && e.error.message) || e.error || e));
        map.on('error', on);
        if (!map.loaded()) await Promise.race([new Promise((res) => map.once('load', res)), new Promise((res) => setTimeout(res, 4000))]);
        r.loaded = map.loaded();
        r.version = window.maplibregl ? maplibregl.getVersion() : null;
        r.workerUrl = window.maplibregl ? maplibregl.getWorkerUrl() : null;
        // raster via cog:// (decoded on the main thread by the protocol handler)
        if (window.cog) {
          map.addSource('r', { type: 'raster', url: `cog://${cogUrl}#color:BrewerSpectral9,30,205,c`, tileSize: 256 });
          map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
        }
        // geojson polygon (needs the worker to tessellate)
        map.addSource('g', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[104.0, 12.75], [104.4, 12.75], [104.4, 12.95], [104.0, 12.95], [104.0, 12.75]]] } } });
        map.addLayer({ id: 'g', type: 'fill', source: 'g', paint: { 'fill-color': '#00ffff', 'fill-antialias': false } });
        await Promise.race([new Promise((res) => map.once('idle', res)), new Promise((res) => setTimeout(res, 5000))]);
        r.areTilesLoaded = map.areTilesLoaded();
        const pr = (ll) => { const p = map.project(ll); return [p.x, p.y]; };
        r.rasterPt = pr([103.5875, 13.41875]);   // block (0,0) -> value 30 -> Spectral (213,62,79)
        r.geojsonPt = pr([104.2, 12.85]);         // inside the polygon -> cyan
        return r;
      }, { cogUrl });
      const s = await shot(page, `t03_${tag}_${label}.png`);
      res.rasterPixel = pxAt(s.png, ...res.info.rasterPt).slice(0, 3);
      res.geojsonPixel = pxAt(s.png, ...res.info.geojsonPt).slice(0, 3);
      res.rasterRendered = res.rasterPixel.join() === '213,62,79';
      res.geojsonRendered = res.geojsonPixel.join() === '0,255,255';
    } else {
      await shot(page, `t03_${tag}_${label}.png`);
    }
  } catch (e) {
    res.exception = String(e);
  }
  res.pageErrors = log.pageErrors;
  res.consoleErrors = log.console.filter((l) => /^\[(error|warning)\]/.test(l));
  res.workerRequests = log.requests.filter((r) => /worker/i.test(r.url)).map((r) => `${r.status} ${r.url}`);
  res.failed = log.failed;
  res.status404 = log.requests.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url}`);
  await browser.close();
  out[label] = res;
  console.log(`\n=== ${label} (${pageName})`);
  console.log(JSON.stringify(res, null, 1));
}

await probe('harness.html', 'A_setWorkerUrl');        // import workerUrl from '...worker.mjs?url'; setWorkerUrl(workerUrl)
await probe('noworker.html', 'B_default_worker_lookup'); // nothing: default lookup next to the bundle
await probe('defimport.html', 'C_default_import');     // import maplibregl from 'maplibre-gl'
saveJson(`t03_${tag}_results.json`, out);
```

### B.7 `$B/app/tests/switchlab.js`

```js
// In-page helpers for the date-switching experiment. Injected with page.addScriptTag after the map has loaded.
// Every rendered frame (map 'render' event) is read back with gl.readPixels and compared, pixel by pixel,
// with the steady-state reference frame of the previous date and of the target date.
(() => {
  const canvas = map.getCanvas();
  const gl = canvas.getContext('webgl2');
  const W = canvas.width, H = canvas.height, N = W * H;
  const MAG = new Uint32Array(new Uint8Array([255, 0, 255, 255]).buffer)[0]; // background colour
  const grab = () => { const b = new Uint8Array(N * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return new Uint32Array(b.buffer); };
  let onFrame = null;
  map.on('render', () => { if (onFrame) onFrame(performance.now(), grab()); });

  const analyse = (f, refOld, refNew) => {
    let eqNew = 0, eqOld = 0, missing = 0, other = 0;
    for (let i = 0; i < N; i++) {
      const v = f[i];
      if (v === refNew[i]) eqNew++;       // already the target (includes pixels identical in both dates)
      else if (v === refOld[i]) eqOld++;  // still the previous date
      else if (v === MAG) missing++;      // background showing through where neither date has background = hole
      else other++;                       // blend (cross-fade / resampled parent tile)
    }
    return { eqNew, eqOld, missing, other };
  };

  // Run switchFn(), record every frame until one equals refNew (or timeout); returns per-frame stats.
  const measure = (switchFn, refOld, refNew, { timeoutMs = 8000, settleMs = 120 } = {}) => new Promise((resolve) => {
    const rec = [];
    let done = false, doneAt = null;
    const t0 = performance.now();
    const finish = () => { onFrame = null; clearTimeout(to); resolve({ frames: rec, completeMs: doneAt, timedOut: doneAt === null, N }); };
    const to = setTimeout(finish, timeoutMs);
    onFrame = (t, f) => {
      const a = analyse(f, refOld, refNew);
      rec.push({ dt: +(t - t0).toFixed(2), ...a });
      if (!done && a.eqNew === N) { done = true; doneAt = +(t - t0).toFixed(2); setTimeout(finish, settleMs); }
    };
    switchFn();
    map.triggerRepaint();
  });

  const idle = () => new Promise((res) => map.once('idle', res));
  const steadyFrame = async () => { await idle(); map.triggerRepaint(); await new Promise((res) => map.once('render', res)); return grab(); };

  window.lab = { W, H, N, MAG, grab, analyse, measure, idle, steadyFrame, refs: [] };
})();
```

### B.8 `$B/app/tests/t04_date_switch.mjs`

```js
// (e) Date switching: compare strategies for flicker and latency over the 11 synthetic dates.
//   node tests/t04_date_switch.mjs [delayMs]     (delayMs = artificial latency added to every .tif request)
// Strategies (each in a fresh page):
//   A swap-remove-add   : removeLayer + removeSource + addSource + addLayer
//   B swap-setUrl       : map.getSource(id).setUrl('cog://...')
//   C swap-doublebuffer : add the new source/layer, wait until it is loaded, then remove the old one
//   D preload-opacity   : 11 sources + 11 layers, toggle raster-opacity 0/1 (transition 0)
//   E preload-visibility: 11 sources + 11 layers, toggle layout visibility
//   F preload-opacity-default-transition: like D but with MapLibre's default 300 ms opacity transition
import { readFileSync } from 'node:fs';
import { launch, shot, saveJson, BASE, sleep } from './lib.mjs';
import { DATES } from './pattern.mjs';

const delayMs = Number(process.argv[2] || 0);
const labSrc = readFileSync(new URL('./switchlab.js', import.meta.url), 'utf8');
const HASH = '#color:BrewerSpectral9,30,255,c';
const PAINT = { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 };
const strategies = ['A_swap_remove_add', 'B_swap_setUrl', 'C_swap_doublebuffer', 'D_preload_opacity', 'E_preload_visibility', 'F_preload_opacity_default_transition'];
const summary = {};

for (const strat of strategies) {
  const { browser, page, log } = await launch();
  let tifRequests = 0;
  await page.route('**/cogs/*.tif*', async (route) => {
    tifRequests++;
    if (delayMs && route.request().url().includes('cb=')) await sleep(delayMs);
    await route.continue();
  });
  await page.goto(`${BASE}/harness.html?zoom=8.3`);
  await page.evaluate(() => window.mapLoaded);
  await page.addScriptTag({ content: labSrc });

  // ---- reference pass (plain URLs): steady-state frame of every date
  await page.evaluate(async ({ BASE, DATES, HASH, PAINT }) => {
    for (let k = 0; k < DATES.length; k++) {
      map.addSource('ref', { type: 'raster', url: `cog://${BASE}/cogs/synth_${DATES[k]}.tif${HASH}`, tileSize: 256 });
      map.addLayer({ id: 'ref', type: 'raster', source: 'ref', paint: PAINT });
      lab.refs[k] = await lab.steadyFrame();
      map.removeLayer('ref'); map.removeSource('ref');
    }
    await lab.steadyFrame();
  }, { BASE, DATES, HASH, PAINT });
  const refRequests = tifRequests; tifRequests = 0;

  // ---- measured pass: cache-busted URLs (?cb=<strategy>) so that the library caches and the HTTP cache are cold
  const result = await page.evaluate(async ({ BASE, DATES, HASH, PAINT, strat }) => {
    const url = (k) => `cog://${BASE}/cogs/synth_${DATES[k]}.tif?cb=${strat}${HASH}`;
    const n = DATES.length;
    const out = { setupMs: 0, cold: [], warm: [], playback: null };
    const bg = new Uint32Array(lab.N).fill(lab.MAG);
    let cur = -1;
    let show; // (k) => void : performs the switch
    const t0 = performance.now();

    if (strat === 'A_swap_remove_add') {
      show = (k) => {
        if (map.getLayer('r')) { map.removeLayer('r'); map.removeSource('r'); }
        map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 });
        map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT });
      };
    } else if (strat === 'B_swap_setUrl') {
      show = (k) => {
        if (!map.getSource('r')) {
          map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 });
          map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT });
        } else map.getSource('r').setUrl(url(k));
      };
    } else if (strat === 'C_swap_doublebuffer') {
      let gen = 0;
      show = (k) => {
        const id = `r${++gen}`, prev = `r${gen - 1}`;
        map.addSource(id, { type: 'raster', url: url(k), tileSize: 256 });
        map.addLayer({ id, type: 'raster', source: id, paint: PAINT });
        const check = () => {
          if (map.getSource(id) && map.isSourceLoaded(id)) {
            map.off('sourcedata', check);
            // one more frame so the new tiles are on screen before the old layer goes away
            requestAnimationFrame(() => { if (map.getLayer(prev)) { map.removeLayer(prev); map.removeSource(prev); } });
          }
        };
        map.on('sourcedata', check);
      };
    } else {
      const defaultTransition = strat === 'F_preload_opacity_default_transition';
      for (let k = 0; k < n; k++) {
        map.addSource(`d${k}`, { type: 'raster', url: url(k), tileSize: 256 });
        const paint = { ...PAINT, 'raster-opacity': 0 };
        if (!defaultTransition) paint['raster-opacity-transition'] = { duration: 0, delay: 0 };
        const layer = { id: `d${k}`, type: 'raster', source: `d${k}`, paint };
        if (strat === 'E_preload_visibility') { layer.layout = { visibility: 'none' }; layer.paint['raster-opacity'] = 1; }
        map.addLayer(layer);
      }
      await lab.idle();
      out.sourcesLoadedAfterSetup = DATES.map((_, k) => map.isSourceLoaded(`d${k}`));
      if (strat === 'E_preload_visibility') {
        show = (k) => { if (cur >= 0) map.setLayoutProperty(`d${cur}`, 'visibility', 'none'); map.setLayoutProperty(`d${k}`, 'visibility', 'visible'); };
      } else {
        show = (k) => { if (cur >= 0) map.setPaintProperty(`d${cur}`, 'raster-opacity', 0); map.setPaintProperty(`d${k}`, 'raster-opacity', 1); };
      }
    }
    out.setupMs = +(performance.now() - t0).toFixed(1);

    const step = async (k, opts) => {
      const refOld = cur >= 0 ? lab.refs[cur] : bg;
      const m = await lab.measure(() => { show(k); cur = k; }, refOld, lab.refs[k], opts);
      const fr = m.frames;
      const upTo = m.timedOut ? fr : fr.filter((f) => f.dt <= m.completeMs);
      const holes = upTo.filter((f) => f.missing > 0);
      const blends = upTo.filter((f) => f.other > 0);
      const partial = upTo.filter((f) => f.eqOld > 0 && f.eqNew < lab.N && f.missing === 0 && f.other === 0 && fr.indexOf(f) > 0);
      return {
        k, completeMs: m.completeMs, timedOut: m.timedOut, frames: upTo.length,
        holeFrames: holes.length, maxHolePct: +(100 * Math.max(0, ...holes.map((f) => f.missing)) / lab.N).toFixed(2),
        holeMs: holes.length ? +(m.completeMs - holes[0].dt).toFixed(1) : 0,
        blendFrames: blends.length, staleFrames: upTo.filter((f) => f.eqNew < lab.N).length,
        firstFrameMs: fr.length ? fr[0].dt : null,
      };
    };
    // cold pass: 0..10 ; warm pass: 0..10 again (every date has been shown once)
    for (let k = 0; k < n; k++) out.cold.push(await step(k));
    for (let k = 0; k < n; k++) out.warm.push(await step(k));

    // playback: advance one date every 100 ms for 3 loops, without waiting for completion
    const pb = { steps: [], intervalMs: 100 };
    for (let s = 0; s < 3 * n; s++) {
      const k = s % n;
      const r = await step(k, { timeoutMs: 100, settleMs: 0 });
      pb.steps.push(r);
      const rest = 100 - (r.timedOut ? 100 : r.completeMs);
      if (rest > 0) await new Promise((res) => setTimeout(res, rest));
    }
    pb.shownInTime = pb.steps.filter((s) => !s.timedOut).length;
    pb.holeFrames = pb.steps.reduce((a, s) => a + s.holeFrames, 0);
    pb.maxHolePct = Math.max(...pb.steps.map((s) => s.maxHolePct));
    out.playback = pb;
    out.layers = map.getStyle().layers.length;
    out.jsHeapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null;
    return out;
  }, { BASE, DATES, HASH, PAINT, strat });

  const stat = (arr, key) => { const v = arr.map((s) => s[key]).filter((x) => x !== null).sort((a, b) => a - b); return { min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1] }; };
  const agg = (arr) => ({
    completeMs: stat(arr, 'completeMs'), timedOut: arr.filter((s) => s.timedOut).length,
    stepsWithHoles: arr.filter((s) => s.holeFrames > 0).length, holeFramesTotal: arr.reduce((a, s) => a + s.holeFrames, 0),
    maxHolePct: Math.max(...arr.map((s) => s.maxHolePct)), holeMs: stat(arr, 'holeMs'),
    stepsWithBlend: arr.filter((s) => s.blendFrames > 0).length,
    framesToComplete: stat(arr, 'frames'),
  });
  summary[strat] = {
    setupMs: result.setupMs, sourcesLoadedAfterSetup: result.sourcesLoadedAfterSetup,
    cold: agg(result.cold), warm: agg(result.warm),
    playback: { shownWithin100ms: `${result.playback.shownInTime}/${result.playback.steps.length}`, holeFrames: result.playback.holeFrames, maxHolePct: result.playback.maxHolePct },
    tifRequestsMeasuredPass: tifRequests, tifRequestsRefPass: refRequests, jsHeapMB: result.jsHeapMB,
    mapErrors: await page.evaluate(() => window.errors),
    raw: result,
  };
  await shot(page, `t04_${strat}_delay${delayMs}.png`);
  const s = summary[strat];
  console.log(`\n=== ${strat}  (artificial delay per .tif request: ${delayMs} ms)`);
  console.log('  setup ms:', s.setupMs, ' sources loaded after setup:', JSON.stringify(s.sourcesLoadedAfterSetup));
  console.log('  COLD  :', JSON.stringify(s.cold));
  console.log('  WARM  :', JSON.stringify(s.warm));
  console.log('  PLAYBACK 100 ms/step x33:', JSON.stringify(s.playback));
  console.log('  .tif requests (measured pass):', s.tifRequestsMeasuredPass, ' JS heap MB:', s.jsHeapMB, ' map errors:', JSON.stringify(s.mapErrors));
  await browser.close();
}
saveJson(`t04_results_delay${delayMs}.json`, summary);
```

### B.9 `$B/app/tests/t05_compare.mjs`

One caveat: this is the file as left at 02:01. The three lines that read `process.argv[3]` (the "only this variant" filter) and the changed `saveJson` name were added after the last run; the saved t05 results came from the same script without them.

```js
// (f) swipe / compare with MapLibre GL JS 6: the npm plugin (bundler import), its dist bundle, and a hand-written clip-path swipe.
//   BASE=http://localhost:5173 node tests/t05_compare.mjs dev
import { launch, shot, pxAt, saveJson, BASE, sleep } from './lib.mjs';
import { blockCentre } from './pattern.mjs';

const tag = process.argv[2] || 'dev';
const variants = [
  ['compare_plugin.html', 'plugin_import', '.compare-swiper-vertical'],
  ['compare_dist.html?global=copy', 'plugin_dist_global_copy', '.compare-swiper-vertical'],
  ['compare_dist.html?global=namespace', 'plugin_dist_global_namespace', '.compare-swiper-vertical'],
  ['compare_dist.html?global=none', 'plugin_dist_no_global', '.compare-swiper-vertical'],
  ['compare_clip.html', 'own_clip_path', '#swipe-handle'],
];
// optional 2nd argument: only run the variants whose label contains it, e.g. `node tests/t05_compare.mjs dev plugin_import`
const only = process.argv[3];
if (only) variants.splice(0, variants.length, ...variants.filter((v) => v[1].includes(only)));
const out = {};
const J = 1; // sample the block row j = 1
const close = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

for (const [url, label, handleSel] of variants) {
  const { browser, page, log } = await launch();
  const res = { url };
  console.log(`\n=== ${label}  (${url})`);
  try {
    await page.goto(`${BASE}/${url}`);
    await page.waitForFunction(() => window.ready !== undefined, null, { timeout: 10000 });
    await page.evaluate(() => Promise.race([window.ready, new Promise((r) => setTimeout(r, 8000))]));
    res.compareOk = await page.evaluate(() => window.compareOk);
    res.compareError = await page.evaluate(() => window.compareError || null);
    res.importedCompareType = await page.evaluate(() => window.importedCompareType || null);
    console.log('  compare constructed:', res.compareOk, res.compareError ? `\n  error: ${res.compareError.split('\n').slice(0, 3).join(' | ')}` : '');
    if (res.compareOk) {
      // which map is visible at each block centre of row J?
      const sample = async (name) => {
        const pts = await page.evaluate(({ J, centres }) => {
          const ramp = cog.colorScale({ colorScheme: 'BrewerSpectral9', min: 30, max: 205, isContinuous: true });
          return centres.map(([lon, lat], i) => {
            const p = mapA.project([lon, lat]);
            const colA = Array.from(ramp(30 + 25 * ((i + J + 0) % 8))).map(Math.round);
            const colB = Array.from(ramp(30 + 25 * ((i + J + 5) % 8))).map(Math.round);
            return { i, x: p.x, y: p.y, colA, colB };
          });
        }, { J, centres: Array.from({ length: 8 }, (_, i) => blockCentre(i, J)) });
        const s = await shot(page, `t05_${tag}_${label}_${name}.png`);
        return pts.filter((p) => p.x > 5 && p.x < 995).map((p) => {
          const px = pxAt(s.png, p.x, p.y).slice(0, 3);
          return { x: Math.round(p.x), shows: close(px, p.colA) ? 'A' : close(px, p.colB) ? 'B' : `?${px}` };
        });
      };
      const verdict = (rows, sliderX) => rows.every((r) => r.shows === (r.x < sliderX ? 'A' : 'B'));
      const fmt = (rows) => rows.map((r) => `${r.x}:${r.shows}`).join(' ');

      let rows = await sample('1_initial');
      res.initial = { sliderX: 500, rows, ok: verdict(rows, 500) };
      console.log(`  initial (slider 500):        ${fmt(rows)}  -> ${res.initial.ok ? 'PASS' : 'FAIL'}`);

      await page.evaluate(() => window.compare.setSlider(316));
      await sleep(150);
      rows = await sample('2_setSlider316');
      res.setSlider = { sliderX: 316, rows, ok: verdict(rows, 316) };
      console.log(`  setSlider(316):              ${fmt(rows)}  -> ${res.setSlider.ok ? 'PASS' : 'FAIL'}`);

      // real mouse drag of the handle from its centre to x = 707
      const hb = await page.locator(handleSel).first().boundingBox();
      const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
      await page.mouse.move(hx, hy); await page.mouse.down();
      for (let s = 1; s <= 10; s++) await page.mouse.move(hx + (707 - hx) * s / 10, hy);
      await page.mouse.up();
      await sleep(150);
      rows = await sample('3_dragged707');
      res.drag = { from: Math.round(hx), sliderX: 707, rows, ok: verdict(rows, 707) };
      console.log(`  mouse-drag handle ${Math.round(hx)} -> 707:  ${fmt(rows)}  -> ${res.drag.ok ? 'PASS' : 'FAIL'}`);

      // camera sync: drag the map on the left side (map A visible) and on the right side (map B visible), then wheel-zoom
      const cam = () => page.evaluate(() => ({ a: [mapA.getCenter().lng, mapA.getCenter().lat, mapA.getZoom()], b: [mapB.getCenter().lng, mapB.getCenter().lat, mapB.getZoom()] }));
      const same = (c) => c.a.every((v, i) => Math.abs(v - c.b[i]) < 1e-9);
      const c0 = await cam();
      await page.mouse.move(200, 500); await page.mouse.down();
      for (let s = 1; s <= 8; s++) await page.mouse.move(200 + 10 * s, 500 - 5 * s);
      await page.mouse.up(); await sleep(900);
      const c1 = await cam();
      await page.mouse.move(850, 500); await page.mouse.down();
      for (let s = 1; s <= 8; s++) await page.mouse.move(850 - 10 * s, 500 + 5 * s);
      await page.mouse.up(); await sleep(900);
      const c2 = await cam();
      await page.mouse.move(850, 500); await page.mouse.wheel(0, -300); await sleep(1200);
      const c3 = await cam();
      await page.mouse.move(200, 500); await page.mouse.wheel(0, 300); await sleep(1200);
      const c4 = await cam();
      res.sync = {
        dragLeftMoved: Math.abs(c1.a[0] - c0.a[0]) > 1e-4, dragLeftSynced: same(c1),
        dragRightMoved: Math.abs(c2.b[0] - c1.b[0]) > 1e-4, dragRightSynced: same(c2),
        wheelRightZoomed: Math.abs(c3.b[2] - c2.b[2]) > 1e-3, wheelRightSynced: same(c3),
        wheelLeftZoomed: Math.abs(c4.a[2] - c3.a[2]) > 1e-3, wheelLeftSynced: same(c4),
        cams: [c0, c1, c2, c3, c4],
      };
      const { cams, ...flags } = res.sync;
      console.log('  camera sync:', JSON.stringify(flags));
      await page.evaluate(() => Promise.all([new Promise((r) => (mapA.loaded() && mapA.areTilesLoaded() ? r() : mapA.once('idle', r))), new Promise((r) => (mapB.loaded() && mapB.areTilesLoaded() ? r() : mapB.once('idle', r)))]));
      rows = await sample('4_after_pan_zoom');
      res.afterPanZoom = { sliderX: 707, rows, ok: verdict(rows, 707) };
      console.log(`  after pan+zoom (slider 707): ${fmt(rows)}  -> ${res.afterPanZoom.ok ? 'PASS' : 'FAIL'}`);
      res.styles = await page.evaluate(() => ({
        aClip: getComputedStyle(mapA.getContainer()).clip, bClip: getComputedStyle(mapB.getContainer()).clip,
        aClipPath: getComputedStyle(mapA.getContainer()).clipPath, bClipPath: getComputedStyle(mapB.getContainer()).clipPath,
        aPosition: getComputedStyle(mapA.getContainer()).position,
      }));
      console.log('  container styles:', JSON.stringify(res.styles));
    } else {
      await shot(page, `t05_${tag}_${label}_failed.png`);
    }
  } catch (e) {
    res.exception = String(e && e.stack || e);
    console.log('  EXCEPTION', res.exception.split('\n').slice(0, 4).join(' | '));
  }
  res.mapErrors = await page.evaluate(() => window.errors || []).catch(() => null);
  res.pageErrors = log.pageErrors;
  res.consoleProblems = log.console.filter((l) => /^\[(error|warning)\]/.test(l) && !/favicon|404/.test(l));
  console.log('  page errors:', JSON.stringify(res.pageErrors).slice(0, 600));
  console.log('  console warnings/errors:', JSON.stringify(res.consoleProblems).slice(0, 900));
  console.log('  map errors:', JSON.stringify(res.mapErrors));
  out[label] = res;
  await browser.close();
}
saveJson(`t05_${tag}${only ? `_${only}` : ''}_results.json`, out);
```

### B.10 `$B/app/tests/t06_bad_cogs.mjs`

```js
// (g) What happens with COGs that are not EPSG:3857, have no overviews, are striped, are not grid aligned,
//     plus request counts / bytes / timing for a 72 MB COG at several zooms.
import { launch, shot, pxAt, saveJson, BASE, sleep } from './lib.mjs';
import { expected, blockCentre } from './pattern.mjs';

const out = {};
const HASH = '#color:BrewerSpectral9,30,205,c';

async function run(label, file, { zoom = 8.3, center = [104.2, 12.85], settle = 20000, probeLL = blockCentre(0, 0), hash = HASH, tileSize = 256 } = {}) {
  const { browser, page, log } = await launch();
  const net = { count: 0, bytes: 0, ranges: [] };
  page.on('response', (r) => {
    if (!/\.tif/.test(r.url())) return;
    net.count++;
    const len = Number(r.headers()['content-length'] || 0);
    net.bytes += len;
    net.ranges.push(`${r.status()} ${r.request().headers()['range'] || '(no range)'} len=${len}`);
  });
  await page.goto(`${BASE}/harness.html?zoom=${zoom}`);
  await page.evaluate(() => window.mapLoaded);
  const url = `${BASE}/${file}`;
  const res = await page.evaluate(async ({ url, hash, center, zoom, settle, probeLL, tileSize }) => {
    const r = {};
    const longTasks = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) { r.longTaskUnsupported = true; }
    let t0 = performance.now();
    try { const m = await cog.getCogMetadata(url); r.metadata = { bbox: m.bbox, noData: m.noData, images: m.images.map((i) => ({ zoom: +i.zoom.toFixed(2), ovr: i.isOverview })) }; }
    catch (e) { r.metadataError = String(e.message || e); }
    r.metadataMs = Math.round(performance.now() - t0);
    map.jumpTo({ center, zoom });
    t0 = performance.now();
    map.addSource('t', { type: 'raster', url: `cog://${url}${hash}`, tileSize });
    map.addLayer({ id: 't', type: 'raster', source: 't', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
    r.outcome = await Promise.race([new Promise((res) => map.once('idle', () => res('idle'))), new Promise((res) => setTimeout(() => res('timeout'), settle))]);
    r.idleMs = Math.round(performance.now() - t0);
    const s = map.getSource('t');
    r.source = s ? { minzoom: s.minzoom, maxzoom: s.maxzoom, bounds: s.tileBounds && s.tileBounds.bounds && s.tileBounds.bounds.toArray().flat().map((v) => +v.toFixed(5)) } : null;
    r.sourceLoaded = map.isSourceLoaded('t');
    try { const v = await cog.locationValues(url, { latitude: probeLL[1], longitude: probeLL[0] }); r.locationValue = v.map((x) => (Number.isNaN(x) ? 'NaN' : x)); }
    catch (e) { r.locationValuesError = String(e.message || e); }
    r.probePx = window.projectPt(probeLL);
    r.mapErrors = [...new Set(window.errors)];
    r.longTasks = longTasks; r.longTaskMaxMs = Math.max(0, ...longTasks); r.longTaskTotalMs = longTasks.reduce((a, b) => a + b, 0);
    r.jsHeapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
    return r;
  }, { url, hash, center, zoom, settle, probeLL, tileSize });
  const s = await shot(page, `t06_${label}.png`);
  res.probePixel = pxAt(s.png, ...res.probePx).slice(0, 3);
  res.probeExpectedValue = expected(probeLL[0], probeLL[1], 0);
  res.rendersSomethingAtProbe = res.probePixel.join() !== '255,0,255';
  // fraction of the screenshot that is not the magenta background
  let nonBg = 0; for (let i = 0; i < s.png.data.length; i += 4) if (!(s.png.data[i] === 255 && s.png.data[i + 1] === 0 && s.png.data[i + 2] === 255)) nonBg++;
  res.nonBackgroundPct = +(100 * nonBg / (s.png.width * s.png.height)).toFixed(2);
  res.net = { requests: net.count, MB: +(net.bytes / 1e6).toFixed(2), first: net.ranges.slice(0, 4) };
  res.consoleErrors = [...new Set(log.console.filter((l) => /^\[error\]/.test(l) && !/favicon|404 \(Not Found\)/.test(l)))].slice(0, 4);
  out[label] = res;
  console.log(`\n=== ${label}: ${file}  (zoom ${zoom})`);
  console.log('  getCogMetadata:', res.metadataError ? `ERROR ${res.metadataError}` : JSON.stringify(res.metadata));
  console.log(`  layer: outcome=${res.outcome} after ${res.idleMs} ms, sourceLoaded=${res.sourceLoaded}, source=${JSON.stringify(res.source)}`);
  console.log(`  pixel at probe ${JSON.stringify(probeLL)} (value ${res.probeExpectedValue}) = ${res.probePixel} -> rendered there: ${res.rendersSomethingAtProbe}; non-background area ${res.nonBackgroundPct} %`);
  console.log('  locationValues at probe:', res.locationValuesError ? `ERROR ${res.locationValuesError}` : JSON.stringify(res.locationValue));
  console.log(`  network: ${res.net.requests} requests, ${res.net.MB} MB; first: ${JSON.stringify(res.net.first)}`);
  console.log(`  main thread: long tasks ${JSON.stringify(res.longTasks.slice(0, 12))} max ${res.longTaskMaxMs} ms total ${res.longTaskTotalMs} ms; JS heap ${res.jsHeapMB} MB`);
  console.log('  map errors:', JSON.stringify(res.mapErrors).slice(0, 500));
  console.log('  console errors:', JSON.stringify(res.consoleErrors).slice(0, 700));
  await browser.close();
  return res;
}

// --- small synthetic variants (k = 0 pattern)
await run('good_web_optimized', 'cogs/synth_20260619.tif');
await run('ok_unaligned_3857', 'cogs/ok_unaligned.tif');
await run('bad_epsg4326', 'cogs/bad_epsg4326.tif');
await run('bad_epsg4326_at_null_island', 'cogs/bad_epsg4326.tif', { center: [0.0009, 0.0001], zoom: 18, probeLL: [0.00094, 0.000115] });
await run('bad_utm48n', 'cogs/bad_utm48n.tif');
await run('bad_no_overviews', 'cogs/bad_no_overviews.tif');
await run('bad_striped', 'cogs/bad_striped.tif');

// --- 72 MB speckled COG: overview zoom, mid zoom, native zoom
for (const z of [8.3, 11, 13]) {
  await run(`big_256_z${z}`, 'cogs_big/big_z13.tif', { zoom: z, center: [103.9, 13.2], probeLL: [103.9, 13.2], settle: 60000 });
  await run(`big_512_z${z}`, 'cogs_big/big_z13_b512.tif', { zoom: z, center: [103.9, 13.2], probeLL: [103.9, 13.2], settle: 60000 });
  await run(`big_noovr_z${z}`, 'cogs_big/big_z13_noovr.tif', { zoom: z, center: [103.9, 13.2], probeLL: [103.9, 13.2], settle: 60000 });
}
saveJson('t06_results.json', out);
```

### B.11 `$B/app/tests/t07a_browse_fetch.mjs`

```js
// Step 4 (i) + (ii): fetch NASA's public NISAR browse PNG from page JavaScript, draw it to a canvas, read pixels back,
// and make black transparent. No Earthdata login is used anywhere.
import { launch, saveJson, BASE } from './lib.mjs';
import { BROWSE_URL } from './nisar.mjs';

const { browser, page, log } = await launch();
const net = [];
page.on('response', (r) => { if (/earthdatacloud|cloudfront/.test(r.url())) net.push({ status: r.status(), host: new URL(r.url()).host, type: r.headers()['content-type'], acao: r.headers()['access-control-allow-origin'], len: r.headers()['content-length'], origin: r.request().headers()['origin'] || null, mode: r.request().resourceType() }); });
await page.goto(`${BASE}/harness.html`);
await page.evaluate(() => window.mapLoaded);

const res = await page.evaluate(async (URL_) => {
  const r = {};
  const stats = (ctx, w, h) => {
    const t0 = performance.now();
    const d = ctx.getImageData(0, 0, w, h).data;   // throws SecurityError if the canvas is tainted
    let a0 = 0, black = 0, blackOpaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      const isBlack = d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0;
      if (d[i + 3] === 0) a0++;
      if (isBlack) { black++; if (d[i + 3] !== 0) blackOpaque++; }
    }
    const at = (x, y) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
    return { w, h, alphaZeroFraction: +(a0 / (w * h)).toFixed(4), rgbBlackFraction: +(black / (w * h)).toFixed(4), blackButOpaque: blackOpaque,
      cornerTL: at(0, 0), centre: at(w >> 1, h >> 1), readMs: Math.round(performance.now() - t0) };
  };

  // ---- A. fetch() -> blob -> createImageBitmap -> canvas -> getImageData
  let t0 = performance.now();
  const resp = await fetch(URL_);
  r.fetch = { ok: resp.ok, status: resp.status, redirected: resp.redirected, responseType: resp.type, finalHost: new URL(resp.url).host,
    contentType: resp.headers.get('content-type'), contentLength: resp.headers.get('content-length') };
  const blob = await resp.blob();
  r.fetch.ms = Math.round(performance.now() - t0);
  r.fetch.blobType = blob.type; r.fetch.blobSize = blob.size;
  try {
    t0 = performance.now();
    const bmp = await createImageBitmap(blob);                 // blob.type is binary/octet-stream
    r.bitmapFromRawBlob = { ok: true, w: bmp.width, h: bmp.height, ms: Math.round(performance.now() - t0) };
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    r.bitmapFromRawBlob.canvas = stats(ctx, c.width, c.height);
  } catch (e) { r.bitmapFromRawBlob = { ok: false, error: String(e) }; }
  try {
    const typed = new Blob([await blob.arrayBuffer()], { type: 'image/png' });   // re-label the bytes as PNG
    const bmp = await createImageBitmap(typed);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    r.bitmapFromPngBlob = { ok: true, canvas: stats(ctx, c.width, c.height) };
    window.browseCanvas = c;   // keep for step (ii)
  } catch (e) { r.bitmapFromPngBlob = { ok: false, error: String(e) }; }

  // ---- B. <img crossOrigin="anonymous"> and C. <img> without crossOrigin
  const viaImg = (cors) => new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    const t = performance.now();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      try { resolve({ loaded: true, ms: Math.round(performance.now() - t), canvas: stats(ctx, c.width, c.height) }); }
      catch (e) { resolve({ loaded: true, ms: Math.round(performance.now() - t), readBackError: String(e) }); }
    };
    img.onerror = () => resolve({ loaded: false });
    img.src = URL_;
  });
  r.imgCrossOriginAnonymous = await viaImg(true);
  r.imgNoCrossOrigin = await viaImg(false);

  // ---- (ii) make black transparent explicitly (what you would do if the PNG had no tRNS chunk),
  //      and find out how many transparent pixels lie INSIDE the swath (holes) rather than outside it
  const c = window.browseCanvas, w = c.width, h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  t0 = performance.now();
  const im = ctx.getImageData(0, 0, w, h); const d = im.data;
  let keyed = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) { if (d[i + 3] !== 0) keyed++; d[i + 3] = 0; }
  ctx.putImageData(im, 0, 0);
  r.keying = { loopMs: Math.round(performance.now() - t0), pixelsNewlyMadeTransparent: keyed };
  // flood fill from the border over transparent pixels = exterior; the rest of the transparent pixels are holes inside the swath
  const ext = new Uint8Array(w * h); const stack = [];
  const push = (x, y) => { const p = y * w + x; if (!ext[p] && d[p * 4 + 3] === 0) { ext[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) { const p = stack.pop(); const x = p % w, y = (p - x) / w; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  let exterior = 0, transparent = 0; for (let p = 0; p < w * h; p++) { if (ext[p]) exterior++; if (d[p * 4 + 3] === 0) transparent++; }
  r.keying.transparentTotal = transparent; r.keying.exterior = exterior; r.keying.holesInsideSwath = transparent - exterior;
  r.keying.holesPctOfSwath = +(100 * (transparent - exterior) / (w * h - exterior)).toFixed(3);
  return r;
}, BROWSE_URL);

console.log(JSON.stringify(res, null, 1));
console.log('network (browser side):', JSON.stringify(net, null, 1));
console.log('console errors:', log.console.filter((l) => /^\[error\]/.test(l) && !/favicon/.test(l)));
saveJson('t07a_results.json', { res, net });
await browser.close();
```

### B.12 `$B/app/tests/t07b_browse_map.mjs`

```js
// Step 4 (iii): the NISAR browse image on the map (image source by URL, canvas source, image source fed with a canvas),
// over keyless basemaps, plus the masks used to measure the offset against Tonle Sap lake.
import { readFileSync } from 'node:fs';
import { launch, shot, pxAt, saveJson, BASE, sleep } from './lib.mjs';
import { BROWSE_URL, CORNERS, NORTH, SOUTH, WEST, EAST } from './nisar.mjs';

const labSrc = readFileSync(new URL('./browselab.js', import.meta.url), 'utf8');
const VW = 1200, VH = 900;
const { browser, page, log } = await launch({ width: VW, height: VH });
const ext = [];
page.on('response', (r) => { const h = new URL(r.url()).host; if (!/localhost/.test(h)) ext.push({ host: h, status: r.status() }); });
await page.goto(`${BASE}/harness.html?bg=%23ffffff`);
await page.evaluate(() => window.mapLoaded);
await page.addScriptTag({ content: labSrc });
const out = {};
const LAKE_VIEW = { center: [104.1, 12.85], zoom: 9.2 };
const WIDE_VIEW = { center: [(WEST + EAST) / 2, (NORTH + SOUTH) / 2], zoom: 7.45 };

// ---------- 0. load the PNG once, build the mercator-corrected canvas
out.load = await page.evaluate(async ({ url, NORTH, SOUTH }) => {
  const t0 = performance.now();
  window.cv = await browse.load(url);
  const t1 = performance.now();
  window.cvMerc = browse.warpRowsToMercator(window.cv, NORTH, SOUTH);
  return { w: cv.width, h: cv.height, loadMs: Math.round(t1 - t0), warpMs: Math.round(performance.now() - t1), maxRowShiftPx: cvMerc.maxRowShift };
}, { url: BROWSE_URL, NORTH, SOUTH });
console.log('PNG loaded in page:', JSON.stringify(out.load));

// expected RGBA of the picture at a few lon/lat positions (naive linear lat/lon lookup in the PNG)
const probes = [
  { name: 'corner area (outside swath, transparent)', lon: WEST + 0.05, lat: NORTH - 0.05 },
  { name: 'SW bright area', lon: 103.22, lat: 11.90 },
  { name: 'lake interior (dark)', lon: 104.05, lat: 12.95 },
  { name: 'NE land', lon: 105.0, lat: 13.8 },
];

// ---------- 1. three ways of putting it on the map, white background, wide view
const blank = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }] };
const variants = {
  A_image_source_url: `map.addSource('b', { type: 'image', url: URL_, coordinates: CORNERS });`,
  B_canvas_source: `map.addSource('b', { type: 'canvas', canvas: window.cv, coordinates: CORNERS, animate: false });`,
  C_image_source_updateImage_canvas: `map.addSource('b', { type: 'image', coordinates: CORNERS }); map.getSource('b').updateImage({ image: window.cv });`,
  D_image_source_updateImage_bitmap: `map.addSource('b', { type: 'image', coordinates: CORNERS }); map.getSource('b').updateImage({ image: await createImageBitmap(window.cv) });`,
};
for (const [name, code] of Object.entries(variants)) {
  const r = await page.evaluate(async ({ code, blank, URL_, CORNERS, view, probes, WEST, EAST, NORTH, SOUTH }) => {
    const res = { errors: [] };
    const n0 = window.errors.length;
    await browse.setStyle(map, blank);
    map.jumpTo(view);
    const t0 = performance.now();
    try {
      await (new Function('map', 'URL_', 'CORNERS', `return (async () => { ${code} })()`))(map, URL_, CORNERS);
      map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
      await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 20000))]);
    } catch (e) { res.exception = String(e); }
    res.ms = Math.round(performance.now() - t0);
    res.errors = window.errors.slice(n0);
    res.sourceLoaded = map.getSource('b') ? map.isSourceLoaded('b') : null;
    const ctx = window.cv.getContext('2d');
    res.probes = probes.map((p) => {
      const px = Math.floor((p.lon - WEST) / (EAST - WEST) * cv.width), py = Math.floor((NORTH - p.lat) / (NORTH - SOUTH) * cv.height);
      const s = map.project([p.lon, p.lat]);
      return { ...p, png: Array.from(ctx.getImageData(px, py, 1, 1).data), screen: [s.x, s.y] };
    });
    return res;
  }, { code, blank, URL_: BROWSE_URL, CORNERS, view: WIDE_VIEW, probes, WEST, EAST, NORTH, SOUTH });
  const s = await shot(page, `t07b_${name}_white.png`);
  r.probes.forEach((p) => {
    p.shot = pxAt(s.png, p.screen[0], p.screen[1]).slice(0, 3);
    const want = p.png[3] === 0 ? [255, 255, 255] : p.png.slice(0, 3);
    p.match = want.every((v, i) => Math.abs(v - p.shot[i]) <= 40);
  });
  out[name] = r;
  console.log(`\n=== ${name}: loaded=${r.sourceLoaded} in ${r.ms} ms, errors=${JSON.stringify(r.errors)} ${r.exception || ''}`);
  for (const p of r.probes) console.log(`   ${p.name.padEnd(42)} png RGBA ${JSON.stringify(p.png)} -> screenshot ${JSON.stringify(p.shot)} ${p.match ? 'OK' : 'MISMATCH'}`);
}

// ---------- 2. masks at the lake view: OSM water (OpenFreeMap vector tiles), radar naive, radar mercator-corrected
const waterStyle = (filter) => ({
  version: 8, sources: { ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } },
    { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', ...(filter ? { filter } : {}), paint: { 'fill-color': '#0000ff', 'fill-antialias': false } }],
});
const setAndShot = async (name, fn, arg) => {
  const info = await page.evaluate(fn, arg);
  await sleep(200);
  const s = await shot(page, name);
  return { info, s };
};
const w1 = await setAndShot('t07b_mask_water_all.png', async ({ style, view }) => {
  await browse.setStyle(map, style); map.jumpTo(view);
  await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 30000))]);
  const feats = map.queryRenderedFeatures({ layers: ['water'] });
  const classes = {}; for (const f of feats) { const k = `${f.properties.class}|intermittent=${f.properties.intermittent ?? 0}`; classes[k] = (classes[k] || 0) + 1; }
  return { tilesLoaded: map.areTilesLoaded(), features: feats.length, classes, errors: window.errors.slice(-3) };
}, { style: waterStyle(null), view: LAKE_VIEW });
console.log('\nwater mask (all):', JSON.stringify(w1.info));
const w2 = await setAndShot('t07b_mask_water_permanent.png', async ({ style, view }) => {
  await browse.setStyle(map, style); map.jumpTo(view);
  await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 30000))]);
  return { tilesLoaded: map.areTilesLoaded() };
}, { style: waterStyle(['!=', ['get', 'intermittent'], 1]), view: LAKE_VIEW });
console.log('water mask (non-intermittent):', JSON.stringify(w2.info));

for (const [name, canvasVar] of [['naive', 'cv'], ['mercator', 'cvMerc']]) {
  const r = await setAndShot(`t07b_mask_radar_${name}.png`, async ({ blank, view, CORNERS, canvasVar }) => {
    await browse.setStyle(map, blank); map.jumpTo(view);
    map.addSource('b', { type: 'canvas', canvas: window[canvasVar], coordinates: CORNERS, animate: false });
    map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
    await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 20000))]);
    return { loaded: map.isSourceLoaded('b') };
  }, { blank, view: LAKE_VIEW, CORNERS, canvasVar });
  console.log(`radar overlay (${name}) for mask:`, JSON.stringify(r.info));
}
out.view = { ...LAKE_VIEW, VW, VH, metresPerPx: 78271.516964 * Math.cos(LAKE_VIEW.center[1] * Math.PI / 180) / 2 ** LAKE_VIEW.zoom };
console.log('lake view metres per CSS px:', out.view.metresPerPx.toFixed(2));

// ---------- 3. presentation screenshots over keyless basemaps
const overBasemap = async (file, styleUrl, view, opacity, canvasVar, outline) => {
  const info = await page.evaluate(async ({ styleUrl, view, opacity, CORNERS, canvasVar, outline }) => {
    const n0 = window.errors.length;
    await browse.setStyle(map, styleUrl); map.jumpTo(view);
    map.addSource('b', { type: 'canvas', canvas: window[canvasVar], coordinates: CORNERS, animate: false });
    map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-opacity': opacity } });
    if (outline) {
      // OSM water outline from the basemap's own vector tiles, drawn above the radar picture
      const src = Object.keys(map.getStyle().sources).find((k) => map.getStyle().sources[k].type === 'vector');
      map.addLayer({ id: 'water-outline', type: 'line', source: src, 'source-layer': 'water', paint: { 'line-color': '#ffff00', 'line-width': 1.5 } });
    }
    const outcome = await Promise.race([browse.idle(map).then(() => 'idle'), new Promise((r) => setTimeout(() => r('timeout'), 40000))]);
    return { outcome, tilesLoaded: map.areTilesLoaded(), layers: map.getStyle().layers.length, errors: window.errors.slice(n0) };
  }, { styleUrl, view, opacity, CORNERS, canvasVar, outline });
  await sleep(300);
  await shot(page, file);
  console.log(`${file}: ${JSON.stringify(info)}`);
  return info;
};
out.liberty_wide = await overBasemap('t07b_liberty_wide_overlay.png', 'https://tiles.openfreemap.org/styles/liberty', WIDE_VIEW, 1, 'cvMerc', false);
out.liberty_lake_basemap_only = await overBasemap('t07b_liberty_lake_basemap_only.png', 'https://tiles.openfreemap.org/styles/liberty', LAKE_VIEW, 0, 'cvMerc', false);
out.liberty_lake_60 = await overBasemap('t07b_liberty_lake_overlay60.png', 'https://tiles.openfreemap.org/styles/liberty', LAKE_VIEW, 0.6, 'cvMerc', false);
out.liberty_lake_outline_naive = await overBasemap('t07b_liberty_lake_outline_naive.png', 'https://tiles.openfreemap.org/styles/liberty', LAKE_VIEW, 1, 'cv', true);
out.liberty_lake_outline_merc = await overBasemap('t07b_liberty_lake_outline_mercator.png', 'https://tiles.openfreemap.org/styles/liberty', LAKE_VIEW, 1, 'cvMerc', true);
// raster basemap alternative: OpenStreetMap standard tiles
const osm = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '&copy; OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
out.osm_lake_basemap_only = await overBasemap('t07b_osm_lake_basemap_only.png', osm, LAKE_VIEW, 0, 'cvMerc', false);
out.osm_lake_60 = await overBasemap('t07b_osm_lake_overlay60.png', osm, LAKE_VIEW, 0.6, 'cvMerc', false);

const hosts = {}; for (const e of ext) { const k = `${e.host} ${e.status}`; hosts[k] = (hosts[k] || 0) + 1; }
out.externalRequests = hosts;
console.log('\nexternal requests by host/status:', JSON.stringify(hosts, null, 1));
console.log('map errors (all):', JSON.stringify(await page.evaluate(() => [...new Set(window.errors)])).slice(0, 1500));
console.log('console errors:', JSON.stringify([...new Set(log.console.filter((l) => /^\[error\]/.test(l) && !/favicon/.test(l)))]).slice(0, 1500));
saveJson('t07b_results.json', out);
await browser.close();
```

### B.13 `$B/app/tests/masklib.mjs`

```js
// Binary-mask helpers shared by the offset measurements.
export const maskOf = (png, test) => { const m = new Uint8Array(png.width * png.height); for (let i = 0, p = 0; p < m.length; i += 4, p++) m[p] = test(png.data[i], png.data[i + 1], png.data[i + 2]) ? 1 : 0; return m; };
export const isBlue = (r, g, b) => b > 200 && r < 80 && g < 80;
export const isDark = (r, g, b) => Math.max(r, g, b) < 40;

export function components(m, W, H) {
  const lab = new Int32Array(W * H).fill(-1); const sizes = []; const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s] !== -1) continue;
    const n = sizes.length; let size = 0; lab[s] = n; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % W, y = (p - x) / W;
      if (x > 0 && m[p - 1] && lab[p - 1] === -1) { lab[p - 1] = n; stack.push(p - 1); }
      if (x < W - 1 && m[p + 1] && lab[p + 1] === -1) { lab[p + 1] = n; stack.push(p + 1); }
      if (y > 0 && m[p - W] && lab[p - W] === -1) { lab[p - W] = n; stack.push(p - W); }
      if (y < H - 1 && m[p + W] && lab[p + W] === -1) { lab[p + W] = n; stack.push(p + W); }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}
export function largestComponent(m, W, H) {
  const { lab, sizes } = components(m, W, H);
  let best = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
  const out = new Uint8Array(W * H); if (sizes.length) for (let p = 0; p < W * H; p++) out[p] = lab[p] === best ? 1 : 0;
  return { mask: out, size: sizes.length ? sizes[best] : 0, components: sizes.length };
}
// the connected component that contains pixel (x, y), or the one nearest to it
export function componentAt(m, W, H, x, y) {
  const { lab, sizes } = components(m, W, H);
  let id = -1;
  for (let r = 0; r < 60 && id < 0; r++) for (let yy = y - r; yy <= y + r && id < 0; yy++) for (let xx = x - r; xx <= x + r; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; if (lab[yy * W + xx] >= 0) { id = lab[yy * W + xx]; break; } }
  const out = new Uint8Array(W * H); if (id >= 0) for (let p = 0; p < W * H; p++) out[p] = lab[p] === id ? 1 : 0;
  return { mask: out, size: id >= 0 ? sizes[id] : 0 };
}
export function fillHoles(m, W, H) {
  const ext = new Uint8Array(W * H); const stack = [];
  const push = (p) => { if (!ext[p] && !m[p]) { ext[p] = 1; stack.push(p); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) { const p = stack.pop(); const x = p % W, y = (p - x) / W; if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W); }
  const out = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) out[p] = ext[p] ? 0 : 1; return out;
}
export const iouShift = (a, b, W, H, dx, dy) => { // a shifted by (dx, dy) versus b
  let inter = 0, uni = 0;
  for (let y = 0; y < H; y++) { const ys = y - dy; for (let x = 0; x < W; x++) { const xs = x - dx; const av = (xs >= 0 && xs < W && ys >= 0 && ys < H) ? a[ys * W + xs] : 0; const bv = b[y * W + x]; if (av & bv) inter++; if (av | bv) uni++; } }
  return uni ? inter / uni : 0;
};
// shift of mask a that maximises IoU with mask b: coarse grid (step) then exhaustive refinement
export function bestShift(a, b, W, H, range = 24, step = 2) {
  let best = { iou: -1, dx: 0, dy: 0 };
  for (let dy = -range; dy <= range; dy += step) for (let dx = -range; dx <= range; dx += step) { const v = iouShift(a, b, W, H, dx, dy); if (v > best.iou) best = { iou: v, dx, dy }; }
  const c = { ...best };
  for (let dy = c.dy - step; dy <= c.dy + step; dy++) for (let dx = c.dx - step; dx <= c.dx + step; dx++) { const v = iouShift(a, b, W, H, dx, dy); if (v > best.iou) best = { iou: v, dx, dy }; }
  return best;
}
```

### B.14 `$B/app/tests/t07c_offset.mjs`

```js
// Offset between the dark lake in the NISAR browse overlay and Tonle Sap in the basemap (OSM water polygons from
// OpenFreeMap vector tiles), measured on the masks screenshotted by t07b at the same camera.
//  - best rigid shift (dx, dy) maximising the IoU of the two lake masks
//  - shoreline distance: for every OSM shoreline pixel, distance to the nearest radar-lake shoreline pixel
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { SHOTS, saveJson } from './lib.mjs';
import { NORTH, SOUTH } from './nisar.mjs';

const view = JSON.parse(readFileSync(resolve(SHOTS, 't07b_results.json'), 'utf8')).view;
const M_PER_PX = view.metresPerPx;
const load = (name) => PNG.sync.read(readFileSync(resolve(SHOTS, name)));
const mask = (png, test) => { const m = new Uint8Array(png.width * png.height); for (let i = 0, p = 0; p < m.length; i += 4, p++) m[p] = test(png.data[i], png.data[i + 1], png.data[i + 2]) ? 1 : 0; return m; };

function largestComponent(m, W, H) {
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bestSize = 0, n = 0; const sizes = [];
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s] !== -1) continue;
    let size = 0; lab[s] = n; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % W, y = (p - x) / W;
      if (x > 0 && m[p - 1] && lab[p - 1] === -1) { lab[p - 1] = n; stack.push(p - 1); }
      if (x < W - 1 && m[p + 1] && lab[p + 1] === -1) { lab[p + 1] = n; stack.push(p + 1); }
      if (y > 0 && m[p - W] && lab[p - W] === -1) { lab[p - W] = n; stack.push(p - W); }
      if (y < H - 1 && m[p + W] && lab[p + W] === -1) { lab[p + W] = n; stack.push(p + W); }
    }
    sizes.push(size); if (size > bestSize) { bestSize = size; best = n; } n++;
  }
  const out = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) out[p] = lab[p] === best ? 1 : 0;
  return { mask: out, size: bestSize, components: n };
}
// fill holes (islands, bright ships/vegetation inside the lake) so that only the outer shoreline matters
function fillHoles(m, W, H) {
  const ext = new Uint8Array(W * H); const stack = [];
  const push = (p) => { if (!ext[p] && !m[p]) { ext[p] = 1; stack.push(p); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) { const p = stack.pop(); const x = p % W, y = (p - x) / W; if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W); }
  const out = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) out[p] = ext[p] ? 0 : 1; return out;
}
const iouShift = (a, b, W, H, dx, dy) => { // a shifted by (dx,dy) vs b
  let inter = 0, uni = 0;
  for (let y = 0; y < H; y++) { const ys = y - dy; for (let x = 0; x < W; x++) { const xs = x - dx; const av = (xs >= 0 && xs < W && ys >= 0 && ys < H) ? a[ys * W + xs] : 0; const bv = b[y * W + x]; if (av & bv) inter++; if (av | bv) uni++; } }
  return inter / uni;
};
const boundary = (m, W, H) => { const pts = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x; if (m[p] && (!m[p - 1] || !m[p + 1] || !m[p - W] || !m[p + W])) pts.push([x, y]); } return pts; };
// brute-force nearest distance from each point of A to the set B, using a coarse grid index
function nearestDistances(A, B, W, H) {
  const cell = 16, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell); const grid = Array.from({ length: gw * gh }, () => []);
  for (const [x, y] of B) grid[Math.floor(y / cell) * gw + Math.floor(x / cell)].push([x, y]);
  return A.map(([x, y]) => {
    let best = Infinity; const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let r = 0; r < 12; r++) {
      for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh || (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== r)) continue;
        for (const [bx, by] of grid[gy * gw + gx]) { const d = Math.hypot(bx - x, by - y); if (d < best) best = d; }
      }
      if (best <= r * cell) break;
    }
    return best;
  });
}
const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const waterPng = load('t07b_mask_water_all.png'); const W = waterPng.width, H = waterPng.height;
const isBlue = (r, g, b) => b > 200 && r < 80 && g < 80;
const isDark = (r, g, b) => Math.max(r, g, b) < 40;
const out = { metresPerPx: M_PER_PX, W, H };
const waters = {};
for (const name of ['all', 'permanent']) {
  const lc = largestComponent(mask(load(`t07b_mask_water_${name}.png`), isBlue), W, H);
  waters[name] = fillHoles(lc.mask, W, H);
  out[`water_${name}`] = { lakePx: lc.size, km2: +(lc.size * M_PER_PX * M_PER_PX / 1e6).toFixed(0), components: lc.components };
}
console.log('OSM lake (largest water polygon in view):', JSON.stringify(out.water_all), '| non-intermittent only:', JSON.stringify(out.water_permanent));

for (const variant of ['naive', 'mercator']) {
  const lc = largestComponent(mask(load(`t07b_mask_radar_${variant}.png`), isDark), W, H);
  const radar = fillHoles(lc.mask, W, H);
  const res = { radarLakePx: lc.size, km2: +(lc.size * M_PER_PX * M_PER_PX / 1e6).toFixed(0) };
  const water = waters.all;
  // coarse-to-fine search of the shift of the OSM lake that best matches the radar lake
  let best = { iou: -1 };
  for (let dy = -24; dy <= 24; dy += 2) for (let dx = -24; dx <= 24; dx += 2) { const v = iouShift(water, radar, W, H, dx, dy); if (v > best.iou) best = { iou: v, dx, dy }; }
  const c = { ...best };
  for (let dy = c.dy - 2; dy <= c.dy + 2; dy++) for (let dx = c.dx - 2; dx <= c.dx + 2; dx++) { const v = iouShift(water, radar, W, H, dx, dy); if (v > best.iou) best = { iou: v, dx, dy }; }
  res.iouAtZeroShift = +iouShift(water, radar, W, H, 0, 0).toFixed(4);
  res.bestShiftPx = { dx: best.dx, dy: best.dy, iou: +best.iou.toFixed(4) };
  // the radar picture sits at (+dx east, +dy south) of the basemap lake, in screen px; convert to km (screen y grows southwards)
  res.radarRelativeToBasemapKm = { east: +(best.dx * M_PER_PX / 1000).toFixed(2), north: +(-best.dy * M_PER_PX / 1000).toFixed(2), total: +(Math.hypot(best.dx, best.dy) * M_PER_PX / 1000).toFixed(2) };
  const d = nearestDistances(boundary(water, W, H), boundary(radar, W, H), W, H);
  res.shorelineDistanceKm = { median: +(pct(d, 0.5) * M_PER_PX / 1000).toFixed(2), p75: +(pct(d, 0.75) * M_PER_PX / 1000).toFixed(2), p90: +(pct(d, 0.9) * M_PER_PX / 1000).toFixed(2), shorelinePixels: d.length };
  out[`radar_${variant}`] = res;
  console.log(`\nradar overlay placed ${variant === 'naive' ? 'NAIVELY (lat/lon rows stretched between the 4 corners)' : 'with rows re-sampled to WEB MERCATOR'}:`);
  console.log('  radar dark lake:', res.radarLakePx, 'px =', res.km2, 'km2');
  console.log('  IoU with OSM lake at zero shift:', res.iouAtZeroShift, ' best shift (px):', JSON.stringify(res.bestShiftPx));
  console.log('  => radar lake relative to basemap lake (km):', JSON.stringify(res.radarRelativeToBasemapKm));
  console.log('  shoreline distance OSM -> radar (km):', JSON.stringify(res.shorelineDistanceKm));
  // difference image for the eye: white = both, blue = OSM only, red = radar only
  const png = new PNG({ width: W, height: H });
  for (let p = 0; p < W * H; p++) { const a = water[p], b = radar[p]; const col = a && b ? [235, 235, 235] : a ? [40, 90, 255] : b ? [255, 60, 40] : [20, 20, 20]; png.data.set([...col, 255], p * 4); }
  writeFileSync(resolve(SHOTS, `t07c_lake_masks_${variant}.png`), PNG.sync.write(png));
}
// theoretical north-south error of pinning a lat/lon picture by its corners in Web Mercator
const rad = Math.PI / 180, y = (lat) => Math.asinh(Math.tan(lat * rad)), R = 6378137;
const errs = [];
for (let lat = SOUTH; lat <= NORTH + 1e-9; lat += 0.05) {
  const t = (NORTH - lat) / (NORTH - SOUTH);
  const yDrawn = y(NORTH) - t * (y(NORTH) - y(SOUTH));
  errs.push({ lat: +lat.toFixed(2), northKm: +(((yDrawn - y(lat)) * R * Math.cos(lat * rad)) / 1000).toFixed(3) });
}
const worst = errs.reduce((a, b) => (b.northKm > a.northKm ? b : a));
out.theory = { worst, at12_85: errs.find((e) => Math.abs(e.lat - 12.83) < 0.03) };
console.log('\ntheory: a lat/lon grid pinned by 4 corners in Web Mercator is drawn too far north by up to', worst.northKm, 'km (at lat', worst.lat + ');', 'at the lake latitude 12.83:', JSON.stringify(out.theory.at12_85));
saveJson('t07c_results.json', out);
```

### B.15 `$B/app/tests/t07d_offset_windows.mjs`

```js
// Cross-check of the browse-image placement on three water bodies spread over the swath:
// Tonle Sap lake (centre), West Baray reservoir near Siem Reap (north), a reservoir in the Cardamom mountains (south-west).
// For each window: OSM water mask (OpenFreeMap vector tiles) vs radar-dark mask, naive vs mercator-corrected placement.
import { readFileSync } from 'node:fs';
import { launch, shot, saveJson, BASE, sleep } from './lib.mjs';
import { BROWSE_URL, CORNERS, NORTH, SOUTH } from './nisar.mjs';
import { maskOf, isBlue, isDark, componentAt, fillHoles, iouShift, bestShift } from './masklib.mjs';

const labSrc = readFileSync(new URL('./browselab.js', import.meta.url), 'utf8');
const VW = 1000, VH = 800;
const windows = [
  // darkMax: a radar pixel counts as water when max(R,G,B) < darkMax (open water is near black on Tonle Sap,
  // dark grey on West Baray, dark green in the bright Cardamom forest)
  { name: 'tonle_sap', center: [104.1, 12.85], zoom: 9.0, seed: [104.0, 12.95], darkMax: 40 },
  { name: 'west_baray', center: [103.80, 13.435], zoom: 11.4, seed: [103.775, 13.435], darkMax: 70 },
  { name: 'sw_reservoir', center: [103.32, 11.67], zoom: 10.6, seed: null, darkMax: 110 },
];
const { browser, page } = await launch({ width: VW, height: VH });
await page.goto(`${BASE}/harness.html?bg=%23ffffff`);
await page.evaluate(() => window.mapLoaded);
await page.addScriptTag({ content: labSrc });
await page.evaluate(async ({ url, NORTH, SOUTH }) => { window.cv = await browse.load(url); window.cvMerc = browse.warpRowsToMercator(window.cv, NORTH, SOUTH); }, { url: BROWSE_URL, NORTH, SOUTH });

const blank = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }] };
const waterStyle = { version: 8, sources: { ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } }, { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#0000ff', 'fill-antialias': false } }] };
const out = {};
for (const w of windows) {
  const view = { center: w.center, zoom: w.zoom };
  const mpp = 78271.516964 * Math.cos(w.center[1] * Math.PI / 180) / 2 ** w.zoom;
  const cap = async (file, fn, arg) => { const info = await page.evaluate(fn, arg); await sleep(200); return { info, png: (await shot(page, file)).png }; };
  const water = await cap(`t07d_${w.name}_water.png`, async ({ style, view }) => { await browse.setStyle(map, style); map.jumpTo(view); await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 30000))]); return map.areTilesLoaded(); }, { style: waterStyle, view });
  const radar = {};
  for (const [variant, cvName] of [['naive', 'cv'], ['mercator', 'cvMerc']]) {
    radar[variant] = await cap(`t07d_${w.name}_radar_${variant}.png`, async ({ blank, view, CORNERS, cvName }) => {
      await browse.setStyle(map, blank); map.jumpTo(view);
      map.addSource('b', { type: 'canvas', canvas: window[cvName], coordinates: CORNERS, animate: false });
      map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
      await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 20000))]);
      return map.isSourceLoaded('b');
    }, { blank, view, CORNERS, cvName });
  }
  // outline picture for the eye (mercator-corrected overlay + OSM water outline)
  await cap(`t07d_${w.name}_outline_mercator.png`, async ({ style, view, CORNERS }) => {
    await browse.setStyle(map, style); map.jumpTo(view);
    map.setPaintProperty('water', 'fill-opacity', 0);
    map.addSource('b', { type: 'canvas', canvas: window.cvMerc, coordinates: CORNERS, animate: false });
    map.addLayer({ id: 'b', type: 'raster', source: 'b', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } });
    map.addLayer({ id: 'wl', type: 'line', source: 'ofm', 'source-layer': 'water', paint: { 'line-color': '#ffff00', 'line-width': 1.5 } });
    await Promise.race([browse.idle(map), new Promise((r) => setTimeout(r, 30000))]);
  }, { style: waterStyle, view, CORNERS });

  const W = water.png.width, H = water.png.height;
  const wm = maskOf(water.png, isBlue);
  // seed pixel: the given lon/lat, else the centre of the view
  const seedPx = w.seed ? await page.evaluate((ll) => { const p = map.project(ll); return [Math.round(p.x), Math.round(p.y)]; }, w.seed) : [W >> 1, H >> 1];
  const wc = componentAt(wm, W, H, seedPx[0], seedPx[1]);
  const waterBody = fillHoles(wc.mask, W, H);
  const res = { metresPerPx: +mpp.toFixed(1), osmWaterBodyKm2: +(wc.size * mpp * mpp / 1e6).toFixed(2) };
  for (const variant of ['naive', 'mercator']) {
    const dm = maskOf(radar[variant].png, (r, g, b) => Math.max(r, g, b) < w.darkMax);
    // radar component overlapping the OSM body the most: take the component at the centroid of the OSM body
    let sx = 0, sy = 0, n = 0; for (let p = 0; p < W * H; p++) if (waterBody[p]) { sx += p % W; sy += Math.floor(p / W); n++; }
    const dc = componentAt(dm, W, H, Math.round(sx / n), Math.round(sy / n));
    const radarBody = fillHoles(dc.mask, W, H);
    const range = Math.ceil(1500 / mpp / 2) * 2; // search +-1.5 km
    const b = bestShift(waterBody, radarBody, W, H, range, 1);
    res[variant] = { radarBodyKm2: +(dc.size * mpp * mpp / 1e6).toFixed(2), iouAtZero: +iouShift(waterBody, radarBody, W, H, 0, 0).toFixed(3), bestIou: +b.iou.toFixed(3),
      radarEastKm: +(b.dx * mpp / 1000).toFixed(2), radarNorthKm: +(-b.dy * mpp / 1000).toFixed(2) };
  }
  out[w.name] = res;
  console.log(`\n${w.name}  (${res.metresPerPx} m/px, OSM water body ${res.osmWaterBodyKm2} km2)`);
  console.log('  naive placement    :', JSON.stringify(res.naive));
  console.log('  mercator-corrected :', JSON.stringify(res.mercator));
}
saveJson('t07d_results.json', out);
await browser.close();
```

### B.16 `$B/app/tests/t08_hidpi.mjs`

```js
// Step 5: HiDPI blurriness. Which tile zoom does MapLibre request for a cog:// raster source at device pixel
// ratio 1 and 2, with the source's tileSize declared as 256 (what the protocol delivers), 512 and 128?
// The COG is the 19 m speckled one (native zoom 13), so every texel differs from its neighbours: the share of
// horizontally adjacent device pixels that are identical tells how many device pixels one texel is stretched over
// (nearest resampling): ~0 % identical = 1 texel per device pixel or finer, ~50 % = 2 device px per texel, ~75 % = 4.
//   node tests/t08_hidpi.mjs
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, shot, saveJson, BASE, SHOTS } from './lib.mjs';

const out = [];
const CENTER = [103.9, 13.2];
for (const dpr of [1, 2]) {
  for (const mapZoom of [11, 11.5]) {
    for (const tileSize of [256, 512, 128]) {
      const { browser, page } = await launch({ dpr });
      await page.goto(`${BASE}/harness.html?zoom=${mapZoom}`);
      await page.evaluate(() => window.mapLoaded);
      const info = await page.evaluate(async ({ BASE, tileSize, CENTER, mapZoom }) => {
        // log every tile the map asks the protocol for
        window.tileLog = [];
        maplibregl.removeProtocol('cog');
        maplibregl.addProtocol('cog', (params, ac) => { if (params.type === 'image') window.tileLog.push(params.url.match(/\/(\d+)\/(\d+)\/(\d+)$/).slice(1, 4).join('/')); return cog.cogProtocol(params, ac); });
        map.jumpTo({ center: CENTER, zoom: mapZoom });
        const t0 = performance.now();
        map.addSource('r', { type: 'raster', url: `cog://${BASE}/cogs_big/big_z13.tif?ts=${tileSize}#color:["#000000","#ffffff"],1,255,c`, tileSize });
        map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
        await new Promise((res) => map.once('idle', res));
        const zooms = {}; for (const t of window.tileLog) { const z = t.split('/')[0]; zooms[z] = (zooms[z] || 0) + 1; }
        return { idleMs: Math.round(performance.now() - t0), tiles: window.tileLog.length, tileZooms: zooms, dpr: devicePixelRatio,
          canvas: [map.getCanvas().width, map.getCanvas().height], css: [map.getCanvas().clientWidth, map.getCanvas().clientHeight] };
      }, { BASE, tileSize, CENTER, mapZoom });
      const name = `t08_dpr${dpr}_z${mapZoom}_ts${tileSize}`;
      const s = await shot(page, `${name}.png`);
      // crop 240 x 240 device px around the centre; statistics over it
      const W = s.png.width, H = s.png.height, cw = 240, ch = 240, x0 = (W - cw) >> 1, y0 = (H - ch) >> 1;
      let same = 0, pairs = 0, sameV = 0;
      const crop = new PNG({ width: cw, height: ch });
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = ((y0 + y) * W + x0 + x) * 4;
        crop.data.set(s.png.data.subarray(i, i + 4), (y * cw + x) * 4);
        if (x < cw - 1) { pairs++; if (s.png.data[i] === s.png.data[i + 4]) same++; }
        if (y < ch - 1 && s.png.data[i] === s.png.data[i + W * 4]) sameV++;
      }
      writeFileSync(resolve(SHOTS, `${name}_crop240.png`), PNG.sync.write(crop));
      const identical = same / pairs;
      const row = { dpr, mapZoom, declaredTileSize: tileSize, ...info, identicalNeighbourPct: +(100 * identical).toFixed(1),
        devicePxPerTexel: +(1 / (1 - identical)).toFixed(2), nativeZoomOfCog: 13 };
      out.push(row);
      console.log(JSON.stringify(row));
      await browser.close();
    }
  }
}
saveJson('t08_results.json', out);
console.log('\ndpr mapZoom tileSize | tile zoom(s) requested | tiles | device px per texel | idle ms');
for (const r of out) console.log(`${r.dpr}   ${String(r.mapZoom).padEnd(5)}   ${String(r.declaredTileSize).padEnd(3)}      | ${JSON.stringify(r.tileZooms).padEnd(22)} | ${String(r.tiles).padEnd(5)} | ${String(r.devicePxPerTexel).padEnd(19)} | ${r.idleMs}`);
```

### B.17 `$B/app/tests/t09_preload_big.mjs`

```js
// (e) continued: the two candidate strategies with REALISTIC file sizes. 11 "dates" = the 72 MB / 8448 x 8192 px
// speckled COG under 11 different URLs (?d=k) and 11 different colour ramps, so each date is a separate download,
// a separate cache entry in the library, and a visibly different picture.
//   D preload : 11 raster sources + 11 layers, all loaded, raster-opacity 0/1 (transition 0)
//   B setUrl  : 1 source + 1 layer, source.setUrl() per date
// Measured per strategy, with an artificial delay added to every COG range request (0 and 100 ms):
//   setup time, per-switch latency (cold and warm), frames that show holes or a mix of old and new tiles,
//   time to settle after a pan and after a zoom, number of range requests / MB, long tasks, JS heap.
//   node tests/t09_preload_big.mjs [delayMs ...]
import { readFileSync } from 'node:fs';
import { launch, shot, saveJson, BASE, sleep } from './lib.mjs';

const delays = process.argv.slice(2).map(Number); if (!delays.length) delays.push(0, 100);
const labSrc = readFileSync(new URL('./switchlab.js', import.meta.url), 'utf8');
const N = 11;
const hsl = (h) => { const f = (n) => { const k = (n + h / 30) % 12; const c = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); }; return `#${f(0)}${f(8)}${f(4)}`; };
const COLOURS = Array.from({ length: N }, (_, k) => hsl(k * 360 / N));
const V1 = { center: [103.9, 13.2], zoom: 11 }, V2 = { center: [104.4, 12.7], zoom: 11 }, V3 = { center: [104.4, 12.7], zoom: 12.6 };
const PAINT = { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 };
const all = {};

for (const delayMs of delays) {
  for (const strat of ['D_preload_opacity', 'B_setUrl']) {
    const { browser, page } = await launch();
    const net = { n: 0, bytes: 0 };
    page.on('response', (r) => { if (/cogs_big\/.*\.tif/.test(r.url())) { net.n++; net.bytes += Number(r.headers()['content-length'] || 0); } });
    await page.route('**/cogs_big/*.tif*', async (route) => { if (delayMs && route.request().url().includes('m=')) await sleep(delayMs); await route.continue(); });
    const phaseNet = async (fn) => { const n0 = net.n, b0 = net.bytes; const r = await fn(); await sleep(50); return { ...r, requests: net.n - n0, MB: +((net.bytes - b0) / 1e6).toFixed(2) }; };

    await page.goto(`${BASE}/harness.html?zoom=${V1.zoom}`);
    await page.evaluate(() => window.mapLoaded);
    await page.evaluate((V1) => { map.jumpTo(V1); window.longTasks = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); }, V1);
    await page.addScriptTag({ content: labSrc });
    const ctx = { BASE, N, COLOURS, PAINT, strat };

    // reference frames of every date at V1 (URLs with ?ref so the measured pass stays cold)
    await page.evaluate(async ({ BASE, N, COLOURS, PAINT }) => {
      for (let k = 0; k < N; k++) {
        map.addSource('ref', { type: 'raster', url: `cog://${BASE}/cogs_big/big_z13.tif?ref=1&d=${k}#color:["#000000","${COLOURS[k]}"],1,255,c`, tileSize: 256 });
        map.addLayer({ id: 'ref', type: 'raster', source: 'ref', paint: PAINT });
        lab.refs[k] = await lab.steadyFrame();
        map.removeLayer('ref'); map.removeSource('ref');
      }
      await lab.steadyFrame();
    }, ctx);

    const res = { delayMs, strat };
    // ---- setup
    res.setup = await phaseNet(() => page.evaluate(async ({ BASE, N, COLOURS, PAINT, strat }) => {
      window.url = (k) => `cog://${BASE}/cogs_big/big_z13.tif?m=${strat}&d=${k}#color:["#000000","${COLOURS[k]}"],1,255,c`;
      window.cur = -1;
      const t0 = performance.now();
      if (strat === 'D_preload_opacity') {
        for (let k = 0; k < N; k++) {
          map.addSource(`d${k}`, { type: 'raster', url: url(k), tileSize: 256 });
          map.addLayer({ id: `d${k}`, type: 'raster', source: `d${k}`, paint: { ...PAINT, 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0, delay: 0 } } });
        }
        window.show = (k) => { if (cur >= 0) map.setPaintProperty(`d${cur}`, 'raster-opacity', 0); map.setPaintProperty(`d${k}`, 'raster-opacity', 1); };
        await lab.idle();
      } else {
        window.show = (k) => {
          if (!map.getSource('r')) { map.addSource('r', { type: 'raster', url: url(k), tileSize: 256 }); map.addLayer({ id: 'r', type: 'raster', source: 'r', paint: PAINT }); }
          else map.getSource('r').setUrl(url(k));
        };
      }
      return { ms: Math.round(performance.now() - t0), layers: map.getStyle().layers.length };
    }, ctx));

    // ---- date switches at V1: cold pass then warm pass
    const pass = () => phaseNet(() => page.evaluate(async ({ N }) => {
      const bg = new Uint32Array(lab.N).fill(lab.MAG);
      const steps = [];
      for (let k = 0; k < N; k++) {
        const refOld = cur >= 0 ? lab.refs[cur] : bg;
        const m = await lab.measure(() => { show(k); cur = k; }, refOld, lab.refs[k], { timeoutMs: 20000, settleMs: 60 });
        const fr = m.timedOut ? m.frames : m.frames.filter((f) => f.dt <= m.completeMs);
        steps.push({ k, completeMs: m.completeMs, timedOut: m.timedOut, frames: fr.length,
          holeFrames: fr.filter((f) => f.missing > 0).length,
          mixedFrames: fr.filter((f) => f.eqOld > 0 && f.eqNew > 0 && f.eqNew < lab.N).length,
          otherFrames: fr.filter((f) => f.other > 0).length });
      }
      const v = steps.map((s) => s.completeMs).filter((x) => x !== null).sort((a, b) => a - b);
      return { completeMs: { min: v[0], median: v[v.length >> 1], max: v[v.length - 1] }, timedOut: steps.filter((s) => s.timedOut).length,
        stepsWithHoles: steps.filter((s) => s.holeFrames > 0).length, stepsWithMixedFrames: steps.filter((s) => s.mixedFrames > 0).length,
        mixedFramesTotal: steps.reduce((a, s) => a + s.mixedFrames, 0), steps };
    }, ctx));
    res.cold = await pass();
    res.warm = await pass();

    // ---- pan, then zoom: time until the map is idle again (everything that is going to load has loaded)
    const move = (view) => phaseNet(() => page.evaluate(async (view) => {
      const t0 = performance.now(); map.jumpTo(view); await lab.idle();
      // the visible date: time until its own source is loaded is what the user sees
      return { idleMs: Math.round(performance.now() - t0) };
    }, view));
    res.pan = await move(V2);
    res.zoom = await move(V3);
    // one more switch right after the zoom (D: instant, B: has to fetch)
    res.switchAfterZoom = await phaseNet(() => page.evaluate(async () => { const t0 = performance.now(); const k = (cur + 1) % 11; show(k); cur = k; await lab.idle(); return { idleMs: Math.round(performance.now() - t0) }; }));
    Object.assign(res, await page.evaluate(() => ({ longTasks: window.longTasks.length, longTaskMaxMs: Math.max(0, ...window.longTasks), longTaskTotalMs: window.longTasks.reduce((a, b) => a + b, 0),
      jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, mapErrors: [...new Set(window.errors)] })));
    await shot(page, `t09_${strat}_delay${delayMs}.png`);
    all[`${strat}_delay${delayMs}`] = res;
    const brief = (p) => JSON.stringify({ completeMs: p.completeMs, timedOut: p.timedOut, stepsWithHoles: p.stepsWithHoles, stepsWithMixedFrames: p.stepsWithMixedFrames, requests: p.requests, MB: p.MB });
    console.log(`\n=== ${strat}  (delay per COG range request: ${delayMs} ms)`);
    console.log('  setup            :', JSON.stringify(res.setup));
    console.log('  11 switches COLD :', brief(res.cold));
    console.log('  11 switches WARM :', brief(res.warm));
    console.log('  pan  -> idle     :', JSON.stringify(res.pan));
    console.log('  zoom -> idle     :', JSON.stringify(res.zoom));
    console.log('  switch after zoom:', JSON.stringify(res.switchAfterZoom));
    console.log(`  long tasks: ${res.longTasks} (max ${res.longTaskMaxMs} ms, total ${res.longTaskTotalMs} ms)  JS heap ${res.jsHeapMB} MB  map errors ${JSON.stringify(res.mapErrors)}`);
    await browser.close();
  }
}
saveJson('t09_results.json', all);
```

### B.18 `$B/py/gen_cogs.py`

```python
"""Generate synthetic single-band uint8 COGs (EPSG:3857, nodata=0, overviews) for the browser test.

Run:  ./venv/bin/python gen_cogs.py ../app/public/cogs

Pattern (all a pure function of lon/lat and date index k, so the browser test can predict any pixel):
  - 8 x 8 blocks over lon 103.5..104.9, lat 12.2..13.5; block value = 30 + 25 * ((i + j + k) % 8)   (30..205)
  - a "lake" ellipse of nodata (0) centred on (104.2, 12.85) whose size depends on k
  - a bright 0.06 deg square (value 255) whose lon depends on k
Files:
  synth_<date>.tif      11 dates, web-optimized COG (GoogleMapsCompatible grid, 256 blocks, DEFLATE, nearest overviews)
  bad_epsg4326.tif      same pattern as k=0 but a COG in EPSG:4326
  bad_utm48n.tif        same pattern as k=0 but a COG in EPSG:32648
  bad_no_overviews.tif  EPSG:3857, tiled 256, NO overviews
  bad_striped.tif       EPSG:3857, striped (not tiled), no overviews
  ok_unaligned.tif      EPSG:3857 COG with overviews but NOT aligned to the web-mercator tile grid
"""
import json
import math
import os
import sys

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.warp import transform as warp_transform
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles

W, E, S, N = 103.5, 104.9, 12.2, 13.5
NB = 8
DATES = [
    "20260619", "20260701", "20260713", "20260725", "20260806", "20260818",
    "20260830", "20260911", "20260923", "20261005", "20261017",
]
R = 6378137.0


def merc_x(lon):
    return math.radians(lon) * R


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R


def pattern(lon, lat, k):
    """lon/lat: numpy arrays (degrees). Returns uint8 array; 0 = nodata."""
    i = np.floor((lon - W) / (E - W) * NB).astype(np.int64)
    j = np.floor((N - lat) / (N - S) * NB).astype(np.int64)
    v = 30 + 25 * ((i + j + k) % 8)
    # bright square, moves east with k
    sq_lon = 103.62 + 0.11 * k
    sq_lat = 12.36
    sq = (np.abs(lon - sq_lon) <= 0.03) & (np.abs(lat - sq_lat) <= 0.03)
    v = np.where(sq, 255, v)
    # nodata "lake"
    a = 0.12 + 0.04 * (k % 6)
    b = 0.08 + 0.025 * (k % 6)
    lake = ((lon - 104.2) / a) ** 2 + ((lat - 12.85) / b) ** 2 <= 1.0
    v = np.where(lake, 0, v)
    # outside the nominal bbox -> nodata
    outside = (lon < W) | (lon >= E) | (lat <= S) | (lat > N)
    v = np.where(outside, 0, v)
    return v.astype(np.uint8)


def grid_lonlat(crs, transform, width, height):
    cols, rows = np.meshgrid(np.arange(width) + 0.5, np.arange(height) + 0.5)
    xs = transform.c + cols * transform.a
    ys = transform.f + rows * transform.e
    if crs.to_epsg() == 4326:
        return xs, ys
    lon, lat = warp_transform(crs, CRS.from_epsg(4326), xs.ravel(), ys.ravel())
    return np.array(lon).reshape(xs.shape), np.array(lat).reshape(ys.shape)


def make_array(crs, bounds, width, height, k):
    transform = from_bounds(*bounds, width, height)
    lon, lat = grid_lonlat(crs, transform, width, height)
    return pattern(lon, lat, k), transform


def write_cog(path, data, crs, transform, *, web_optimized, overviews=True):
    src_profile = dict(driver="GTiff", dtype="uint8", count=1, height=data.shape[0], width=data.shape[1],
                       crs=crs, transform=transform, nodata=0)
    dst_profile = cog_profiles.get("deflate")
    dst_profile.update(dict(blockxsize=256, blockysize=256))
    with MemoryFile() as mem:
        with mem.open(**src_profile) as tmp:
            tmp.write(data, 1)
        with mem.open() as src:
            cog_translate(
                src, path, dst_profile,
                nodata=0,
                web_optimized=web_optimized,
                overview_level=None if overviews else 0,
                overview_resampling="nearest",
                resampling="nearest",
                in_memory=True,
                quiet=True,
            )


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    crs3857 = CRS.from_epsg(3857)
    b3857 = (merc_x(W), merc_y(S), merc_x(E), merc_y(N))
    # ~76 m pixels (web mercator zoom 11) -> about 2039 x 1940 px
    res = 2 * math.pi * R / 256 / 2 ** 11
    width = round((b3857[2] - b3857[0]) / res)
    height = round((b3857[3] - b3857[1]) / res)
    report = {}

    for k, date in enumerate(DATES):
        data, transform = make_array(crs3857, b3857, width, height, k)
        path = os.path.join(outdir, f"synth_{date}.tif")
        write_cog(path, data, crs3857, transform, web_optimized=True)
        report[os.path.basename(path)] = describe(path)

    # --- deliberately "wrong" variants (k = 0 pattern)
    k = 0
    # EPSG:4326 COG
    crs4326 = CRS.from_epsg(4326)
    data, transform = make_array(crs4326, (W, S, E, N), 2048, 1902, k)
    path = os.path.join(outdir, "bad_epsg4326.tif")
    write_cog(path, data, crs4326, transform, web_optimized=False)
    report[os.path.basename(path)] = describe(path)

    # UTM 48N COG
    crs_utm = CRS.from_epsg(32648)
    xs, ys = warp_transform(crs4326, crs_utm, [W, E, W, E], [S, S, N, N])
    b_utm = (min(xs), min(ys), max(xs), max(ys))
    data, transform = make_array(crs_utm, b_utm, 2048, 1902, k)
    path = os.path.join(outdir, "bad_utm48n.tif")
    write_cog(path, data, crs_utm, transform, web_optimized=False)
    report[os.path.basename(path)] = describe(path)

    # EPSG:3857, tiled, no overviews
    data, transform = make_array(crs3857, b3857, width, height, k)
    path = os.path.join(outdir, "bad_no_overviews.tif")
    with rasterio.open(path, "w", driver="GTiff", dtype="uint8", count=1, height=height, width=width,
                       crs=crs3857, transform=transform, nodata=0, tiled=True, blockxsize=256, blockysize=256,
                       compress="deflate") as dst:
        dst.write(data, 1)
    report[os.path.basename(path)] = describe(path)

    # EPSG:3857, striped, no overviews
    path = os.path.join(outdir, "bad_striped.tif")
    with rasterio.open(path, "w", driver="GTiff", dtype="uint8", count=1, height=height, width=width,
                       crs=crs3857, transform=transform, nodata=0, tiled=False, compress="deflate") as dst:
        dst.write(data, 1)
    report[os.path.basename(path)] = describe(path)

    # EPSG:3857 COG with overviews, NOT aligned to the tile grid
    path = os.path.join(outdir, "ok_unaligned.tif")
    write_cog(path, data, crs3857, transform, web_optimized=False)
    report[os.path.basename(path)] = describe(path)

    print(json.dumps(report, indent=1))
    with open(os.path.join(outdir, "cogs_report.json"), "w") as f:
        json.dump(report, f, indent=1)


def describe(path):
    with rasterio.open(path) as ds:
        info = dict(
            bytes=os.path.getsize(path), crs=str(ds.crs), size=[ds.width, ds.height], dtype=ds.dtypes[0],
            nodata=ds.nodata, block=list(ds.block_shapes[0]), tiled=ds.profile.get("tiled"),
            compress=ds.profile.get("compress"), overviews=ds.overviews(1),
            res=[round(ds.res[0], 4), round(ds.res[1], 4)],
            bounds=[round(v, 3) for v in ds.bounds],
        )
        b4326 = rasterio.warp.transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)
        info["bounds_lonlat"] = [round(v, 5) for v in b4326]
    valid, errors, warnings = cog_validate(path, quiet=True)
    info["cog_valid"] = bool(valid)
    info["cog_errors"] = list(errors)
    info["cog_warnings"] = list(warnings)
    return info


if __name__ == "__main__":
    main(sys.argv[1])
```

### B.19 `$B/py/gen_big.py`

```python
"""Generate a larger, speckled (poorly compressible) single-band uint8 COG to measure browser performance.

Run:  ./venv/bin/python gen_big.py ../app/public/cogs_big

  big_z13.tif          EPSG:3857, WebMercatorQuad-aligned at zoom 13 (19.1 m), 256 px blocks, DEFLATE, average overviews
  big_z13_noovr.tif    same pixels, tiled 256, NO overviews
  big_z13_b512.tif     same pixels as big_z13 but 512 px blocks (GDAL's COG driver default)
Uses the non-deprecated rio-cogeo call: cog_translate(..., tms=morecantile.tms.get("WebMercatorQuad")).
"""
import json
import math
import os
import sys
import time

import morecantile
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles

W, E, S, N = 103.5, 104.9, 12.2, 13.5
NB = 8
R = 6378137.0
ZOOM = 13


def merc_x(lon):
    return math.radians(lon) * R


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    crs = CRS.from_epsg(3857)
    b = (merc_x(W), merc_y(S), merc_x(E), merc_y(N))
    res = 2 * math.pi * R / 256 / 2 ** ZOOM
    width = round((b[2] - b[0]) / res)
    height = round((b[3] - b[1]) / res)
    transform = from_bounds(*b, width, height)
    # separable lon/lat of pixel centres (EPSG:3857 -> degrees)
    xs = transform.c + (np.arange(width) + 0.5) * transform.a
    ys = transform.f + (np.arange(height) + 0.5) * transform.e
    lon = np.degrees(xs / R)
    lat = np.degrees(np.arctan(np.sinh(ys / R)))
    i = np.floor((lon - W) / (E - W) * NB).astype(np.int64)
    j = np.floor((N - lat) / (N - S) * NB).astype(np.int64)
    base = (30 + 25 * ((i[None, :] + j[:, None]) % 8)).astype(np.float32)
    rng = np.random.default_rng(0)
    data = np.empty((height, width), dtype=np.uint8)
    for r0 in range(0, height, 1024):  # 4-look speckle, in strips to bound memory
        r1 = min(height, r0 + 1024)
        sp = rng.gamma(4.0, 0.25, size=(r1 - r0, width)).astype(np.float32)
        data[r0:r1] = np.clip(base[r0:r1] * sp, 1, 255).astype(np.uint8)
    lake = ((lon[None, :] - 104.2) / 0.12) ** 2 + ((lat[:, None] - 12.85) / 0.08) ** 2 <= 1.0
    data[lake] = 0
    print("source array", data.shape, "res m", round(res, 3), file=sys.stderr)

    src_path = os.path.join(outdir, "_src_tmp.tif")
    with rasterio.open(src_path, "w", driver="GTiff", dtype="uint8", count=1, height=height, width=width, crs=crs,
                       transform=transform, nodata=0, tiled=True, blockxsize=256, blockysize=256, compress="deflate") as dst:
        dst.write(data, 1)

    report = {}
    tms = morecantile.tms.get("WebMercatorQuad")

    def cog(name, block, overviews=True):
        prof = cog_profiles.get("deflate")
        prof.update(dict(blockxsize=block, blockysize=block))
        path = os.path.join(outdir, name)
        t0 = time.time()
        cog_translate(src_path, path, prof, nodata=0, tms=tms, overview_level=None if overviews else 0,
                      overview_resampling="average", resampling="nearest", in_memory=True, quiet=True)
        report[name] = describe(path)
        report[name]["write_seconds"] = round(time.time() - t0, 1)

    cog("big_z13.tif", 256)
    cog("big_z13_b512.tif", 512)
    cog("big_z13_noovr.tif", 256, overviews=False)
    os.remove(src_path)
    print(json.dumps(report, indent=1))
    with open(os.path.join(outdir, "big_report.json"), "w") as f:
        json.dump(report, f, indent=1)


def describe(path):
    with rasterio.open(path) as ds:
        info = dict(bytes=os.path.getsize(path), crs=str(ds.crs), size=[ds.width, ds.height], dtype=ds.dtypes[0],
                    nodata=ds.nodata, block=list(ds.block_shapes[0]), compress=ds.profile.get("compress"),
                    overviews=ds.overviews(1), res=[round(ds.res[0], 4), round(ds.res[1], 4)],
                    tags={k: v for k, v in ds.tags(ns="TILING_SCHEME").items()})
        info["bounds_lonlat"] = [round(v, 5) for v in rasterio.warp.transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)]
    valid, errors, warnings = cog_validate(path, quiet=True)
    info.update(cog_valid=bool(valid), cog_errors=list(errors), cog_warnings=list(warnings))
    return info


if __name__ == "__main__":
    import rasterio.warp  # noqa: F401
    main(sys.argv[1])
```

### B.20 `$B/py/check_cogs.py`

```python
"""Cross-check: sample each synthetic COG at known lon/lat with rasterio and compare with the formula."""
import sys, json
import numpy as np, rasterio
from rasterio.warp import transform as wt
sys.path.insert(0, '.')
from gen_cogs import pattern, DATES, W, E, S, N, NB

pts = []
for i in range(NB):
    for j in range(NB):
        pts.append((W + (i + 0.5) * (E - W) / NB, N - (j + 0.5) * (N - S) / NB))
pts += [(104.2, 12.85), (103.62, 12.36), (103.4, 12.1), (104.93, 13.57)]
lons = np.array([p[0] for p in pts]); lats = np.array([p[1] for p in pts])
bad = 0
for k, d in enumerate(DATES):
    with rasterio.open(f'../app/public/cogs/synth_{d}.tif') as ds:
        xs, ys = wt('EPSG:4326', ds.crs, lons.tolist(), lats.tolist())
        got = np.array([v[0] for v in ds.sample(list(zip(xs, ys)))])
        exp = pattern(lons, lats, k)
        nb = int((got != exp).sum()); bad += nb
        print(d, 'k', k, 'mismatches', nb, 'of', len(pts), 'unique values', sorted(set(got.tolist())))
print('TOTAL MISMATCHES', bad)
```

### B.21 `$B/py/inspect_browse.py`

```python
"""Inspect the downloaded NISAR browse PNG: mode, size, channel stats, fraction of pure black, write a small preview."""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
print("format", im.format, "mode", im.mode, "size", im.size, "info keys", sorted(im.info.keys()))
a = np.asarray(im)
print("array shape", a.shape, "dtype", a.dtype)
for c in range(a.shape[2]):
    ch = a[..., c]
    print(f" channel {c}: min {ch.min()} max {ch.max()} mean {ch.mean():.2f}")
black = (a[..., :3] == 0).all(axis=2)
print("pure black (0,0,0) fraction: %.4f" % black.mean())
grey = (a[..., 0] == a[..., 1]) & (a[..., 1] == a[..., 2])
print("grey (R==G==B) fraction: %.4f" % grey.mean())
dark = (a[..., :3].max(axis=2) < 30) & ~black
print("dark but not pure black (<30) fraction: %.4f" % dark.mean())
# where is the pure-black: border vs interior?  bounding box of non-black
ys, xs = np.where(~black)
print("non-black bbox: x %d..%d  y %d..%d" % (xs.min(), xs.max(), ys.min(), ys.max()))
# corner pixels
for name, (y, x) in {"tl": (0, 0), "tr": (0, a.shape[1]-1), "bl": (a.shape[0]-1, 0), "br": (a.shape[0]-1, a.shape[1]-1), "centre": (a.shape[0]//2, a.shape[1]//2)}.items():
    print(" pixel", name, a[y, x].tolist())
im.convert("RGB").resize((im.size[0] // 2, im.size[1] // 2), Image.BILINEAR).save(dst)
print("preview written", dst)
```

### B.22 `$B/py/requirements.freeze.txt`

```
affine==3.0.1
annotated-types==0.8.0
attrs==26.1.0
certifi==2026.10.23
click==8.5.1
morecantile==7.1.0
numpy==2.5.4
pillow==13.0.0
pydantic==2.14.3
pydantic_core==2.50.4
pyparsing==3.3.3
pyproj==3.8.0
rasterio==1.5.2
rio-cogeo==7.0.4
typing-inspection==0.4.5
typing_extensions==4.16.0
```
