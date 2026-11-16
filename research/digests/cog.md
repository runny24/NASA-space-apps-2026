# Recovered digest: topic "cog"

Cloud-Optimized GeoTIFF packaging for the NISAR surface-change app: creation options, what geotiff.js
decodes, cost of reading one pixel across a many-band stack, which local servers honour HTTP Range, and
file sizes. Recovered on 2026-11-14 from an interrupted verification run of 2026-11-13/14.

Evidence classes used throughout:

- **ran**: a saved log, result JSON or transcript tool result shows it being run and what it printed.
- **docs**: read in installed package source, `--help` output, or an npm/PyPI registry query. Not executed.
- **belief**: asserted without evidence I could find, or my own reading of the code. Treat as unverified.

Path shorthand used below (every path under it is absolute once you prepend this):

```
COG = <scratch>/verify/cog
TX  = <transcripts>/wf_0472d927-435
```

`COG` lives under `/private/tmp`, so a reboot can erase it. Everything a builder needs to copy is embedded
in Appendix A of this file.

---

## 0. How far the run got

Three agents attempted the same task in turn. None wrote a final report: each ended on
`You've hit your 5-hour limit`. Their thinking blocks are empty in the transcripts, so the conclusions
below are reconstructed from the scripts, logs and result JSON they left, not from their own summaries.

| Attempt | Transcript | Local time (CST) | Got to |
|---|---|---|---|
| 1 | `TX/agent-afd70868e487e38f2.jsonl` | 13 Nov 19:38 to 19:48 | venv, `synth.py`, `pipeline.py`, smoke test, first codec comparison |
| 2 | `TX/agent-a76ae1ae4f257dea6.jsonl` | 13 Nov 20:41 to 21:07 | Steps 1 to 4 complete, step 5 partly, wrote the browser test (step 6) but never ran it. Outputs now in `COG/prev_run/` |
| 3 | `TX/agent-a279b6fda46750f0e.jsonl` | 14 Nov 01:41 to 02:02 | Re-ran steps 1 to 5 from a fresh venv, all logs in `COG/work/logs/`. Cut off the moment `work/sizes.json` finished |

Attempts 2 and 3 produced identical numbers (same byte sizes, request counts and HTTP status codes), so
the results are reproducible on this machine.

**Never run, in any attempt:** the real-browser test (`COG/node/step6_browser_test.mjs`); anything with
`@geomatico/maplibre-cog-protocol` or MapLibre; any request to GitHub Pages or another host; any real
NISAR data. All rasters are synthetic.

**Verdict on the brief for this topic:** Sections 6.3, 6.6 and sketch D5 hold up. I found no correction
that blocks the build or produces wrong data. There are seven sharpenings (Section 5 below), the most
useful being how to open the click-query file so that one click costs 2 requests instead of 9.

---

## 1. Bottom line for the builder

1. **Per-date display COG:** rio-cogeo 7.0.4, DEFLATE, `PREDICTOR=2`, 512 px blocks, `nodata=0`,
   WebMercatorQuad, bilinear warp, average overviews. Valid COG, 9.46 MB per 4096 x 3840 file at 38 m,
   0.5 s to write, decoded bit-exactly by every geotiff.js release tested (1.0.0-beta.13 to 3.1.0-beta.0).
2. **Do not use WEBP or JPEG** for these value-coded rasters. Single-band WEBP silently writes an
   all-zero file that still passes `rio cogeo validate`. JPEG is off by up to 54 DN (8.5 dB) and drops the
   nodata tag.
3. **ZSTD is 7.6 % smaller but only decodes in geotiff >= 3.0.x.** Not worth the risk; stay on DEFLATE.
4. **Click-to-chart file:** one uint8 multi-band COG, bands = dates, pixel-interleaved (the default in
   both writers), **128 px blocks**, DEFLATE + predictor 2. 5.2 MB for 11 dates at 153 m.
5. **Open it with `fromUrl(url, { blockSize: 16384 })`.** geotiff 3.x no longer block-caches by default:
   without the option a cold click is 9 requests (about 470 ms at 50 ms per request) and every repeat
   click re-downloads the tile. With it: 2 requests, 131 KB, about 117 ms, and repeats cost nothing.
6. **Block size sets bytes per click:** 512 px blocks (the rio-cogeo default) cost 1.10 MB per click for
   11 bands; 256 costs 372 KB; 128 costs 92 KB; 64 costs 26 KB.
7. **Local servers:** Vite 8.3.8 dev and `vite preview` both answer 206 correctly. `python3 -m http.server`
   (3.12.2) answers 200 with the whole file and geotiff.js throws `Server responded with full file`.
8. **Budget:** 11 dates x 2 channels over a frame-sized window (about 15,000 km² valid) is 208 MB at
   40 m and 927 MB at 20 m. "A few hundred MB" means 40 m for a window that large.
9. **`pipeline.py` is a sound reference** for multilook, dB encoding and both COG writers, with three
   caveats listed in Section 10 (mask handling, zero power, dB-domain resampling).
10. **Untested and still needed:** a real browser, the MapLibre COG protocol, and GitHub Pages.

---

## 2. Environment and versions (ran)

From `COG/work/logs/step1_versions.log`, `COG/work/logs/step1_pip_install.log`,
`COG/work/logs/step1_npm_install.log`.

| Component | Version |
|---|---|
| Machine | Apple M3 Pro, 11 cores, macOS 26.6.2 arm64, no system GDAL |
| Python | 3.12.2 (`/opt/anaconda3/bin/python3`, venv in `COG/venv`) |
| rasterio | 1.5.2, bundles **GDAL 3.12.2**, PROJ 9.8.1 |
| rio-cogeo | 7.0.4 |
| morecantile / affine / pyproj | 7.1.0 / 3.0.1 / 3.8.0 |
| numpy / scipy | 2.5.4 / 1.18.1 |
| rangehttpserver (pip) | 1.4.0 |
| Node / npm | v22.15.0 / 10.9.2 |
| geotiff (npm `latest`) | 3.0.5 (`beta` tag: 3.1.0-beta.0) |
| vite / http-server / serve | 8.3.8 / 14.1.1 / 14.2.8 |
| playwright-core, Chrome | 1.65.1 installed but unused; Google Chrome 157.0.8103.52 present |

These were also the newest versions on PyPI and npm on 2026-11-13 (`pip index versions`, `npm view`).
Install was `pip install rasterio rio-cogeo numpy scipy` into a fresh venv: wheels only, 6 seconds from
cache.

The GDAL inside the rasterio wheel has the `COG`, `GTiff`, `WEBP`, `JPEG`, `HDF5`, `netCDF` and `Zarr`
drivers. There is no `osgeo` Python module (`ModuleNotFoundError: No module named 'osgeo'`) and no GDAL
command line, so everything goes through the rasterio API or the `rio` CLI.

---

## 3. Facts

Each row is one claim a builder can act on. Where the evidence is a transcript, "tool call N" means the
N-th `tool_use` block in that transcript, counting from 0.

| # | Claim | Kind | Evidence |
|---|---|---|---|
| F1 | The whole toolchain installs from pip and npm with no system GDAL: rasterio 1.5.2 (GDAL 3.12.2), rio-cogeo 7.0.4, geotiff 3.0.5, vite 8.3.8. | ran | `COG/work/logs/step1_versions.log`: `rasterio     1.5.2` / `rio_cogeo    7.0.4` / `GDAL (bundled in rasterio wheel): 3.12.2`; `COG/work/logs/step1_npm_install.log`: `+-- geotiff@3.0.5` |
| F2 | The tested per-date recipe turns a uint8 EPSG:32648 40 m raster with nodata 0 into a valid web-optimised COG: EPSG:3857, 4096 x 3840, 38.2185 m (WebMercatorQuad z12), origin exactly on the tile grid, 512 blocks, overviews 2/4/8, nodata 0 kept, 9.46 MB in 0.51 s. | ran | `COG/work/logs/step2a_smoke.log`: `== riocogeo_deflate_512_p2.tif: 9.46 MB in 0.51s` / `crs EPSG:3857 size 4096 3840 count 1 dtype ('uint8',) nodata 0.0` / `block [(512, 512)] overviews [2, 4, 8]` / `origin in 256px tile units: x=3224.000000 y=1892.000000` / `cog_validate: True [] []` |
| F3 | Lossless codec sizes for that file (512 blocks): raw 22.28 MB; DEFLATE 10.90; **DEFLATE+pred2 9.46**; ZSTD+pred2 8.75; LZW+pred2 10.86; LERC 9.31; LERC_ZSTD 8.92; PACKBITS 14.91. Predictor 2 saves 13 % on DEFLATE. 256 vs 512 blocks differ by under 1 %. DEFLATE level 9 gains 0.1 %. ZSTD level 22 gains 1.3 % and takes 17 times longer. | ran | `COG/work/logs/step2b_table.log`: `rc_deflate_512_pred2  9.46  0.425  0.51 … identical`; `rc_zstd_512_pred2  8.75`; `rc_deflate_512_nopred  10.90`; `rc_zstd_512_pred2_l22  8.63 … 8.51` |
| F4 | JPEG q75 is 1.84 MB but lossy by up to 54 DN (8.5 dB at 0.157 dB per DN), RMSE 3.49 DN, and rio-cogeo replaces the nodata tag with an internal mask (`nodata None`). LERC_ZSTD with `MAX_Z_ERROR=2` is 6.48 MB (31 % smaller than DEFLATE) with error bounded at 2 DN (0.31 dB) and nodata kept. | ran | `COG/work/logs/step2b_table.log`: `rc_jpeg_q75_512  1.84  0.083  0.51  4  None per_dataset -  maxabs=54 rmse=3.4888 v2n=0 n2v=22869`; `rc_lerc_zstd_512_maxz2  6.48  0.291 … maxabs=2 rmse=1.2162` |
| F5 | Single-band WEBP cannot be written, and fails silently. GDAL prints `WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.` The GDAL COG driver (and rio-cogeo in a fresh process) raise nothing and leave a tiny file with zero valid pixels that passes validation. | ran | `COG/work/logs/step2d_webp_1band.log`: `[gdalcog] NO EXCEPTION RAISED` / `[gdalcog] file exists: 1356 bytes, 1536x1536, valid px (DN>0) = 0 of source valid 1048576`; `COG/work/logs/step2b.out`: `gd_webp_lossless_512_1band  0.00 MB … api_valid=True cli_exit=0` |
| F6 | geotiff.js 3.0.5 in Node decodes NONE, DEFLATE, ZSTD, LZW (each with and without predictor 2), LERC, LERC_ZSTD and PACKBITS bit-identically to GDAL, at full resolution and at the smallest overview; JPEG within 1 DN. It reports `getGDALNoData()` = 0 for the nodata-0 files and `null` for the rio-cogeo JPEG files. WEBP cannot be decoded in Node. ZSTD fails on geotiff 2.1.3 and 1.0.0-beta.13; LERC also fails on 1.0.0-beta.13. | ran | `COG/work/logs/step2e_summary.log`: `DEFLATE+PREDICTOR=2 … geotiff 1.0.0-beta.13  OK bit-identical to GDAL (11 files)`; `ZSTD+PREDICTOR=2 … geotiff 2.1.3  FAIL: Unknown compression method identifier: 50000 (6 files)`; `COG/work/logs/step2c_decode_node.log`: `rc_deflate_512_pred2  comp=8  pred=2 spp=1 ifds=4 nodata=0  OK   full identical to GDAL; ovr identical; 330 ms` |
| F7 | `@geomatico/maplibre-cog-protocol` 0.10.0 depends on `geotiff ^3.0.5` (peer `maplibre-gl ^4.5.0 \|\| ^5.0.0 \|\| ^6.0.0`), so it uses the decoder set tested in F6. `ol` 10.11.0 uses `geotiff ^3.1.0-beta.0`; `georaster` 1.6.0 pins `geotiff 1.0.0-beta.13` (no ZSTD, no LERC). | docs | npm registry query, `TX/agent-a279b6fda46750f0e.jsonl` tool call 41: `"name": "@geomatico/maplibre-cog-protocol", "version": "0.10.0", "dependencies": { "geotiff": "^3.0.5", …` |
| F8 | geotiff 3.x only wraps a remote source in a caching `BlockedSource` when `blockSize` is passed. In 2.1.3 it was on by default (65536). So `fromUrl(url)` in 3.0.5 issues many tiny requests and caches nothing. | docs + ran | Installed source `geotiff/dist-module/source/remote.js` 3.0.5: `if (blockSize === undefined) { return source; }`; 2.1.3: `if (blockSize === null) { return source; }` with `blockSize = 65536` default (`TX/agent-a279b6fda46750f0e.jsonl` tool call 51). Request counts in F10 confirm it. |
| F9 | Multi-band cubes are pixel-interleaved by default in both writers. An 11-band uint8 cube at z10 (1024 x 1024, 152.87 m) is 5.22 MB with 128 px blocks; band-interleaved is 23 % larger (6.42 MB); dropping the predictor costs 29 % (256 blocks: 6.62 against 5.13 MB); a 22-band HH+HV cube is 10.10 MB; the same cube at z11 (76.4 m) is 23.25 MB. Band descriptions (dates) are stored. All validate. | ran | `COG/work/logs/step3b_make_cubes.log`: `cube/hh_z10_px_128.tif  5.22 MB  0.34s [1024, 1024] x11 uint8 blk128 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8] valid=True`; `cube/hh_z10_band_128.tif  6.42 MB`; `cube/hhhv_z10_px_128.tif  10.10 MB` |
| F10 | Cold read of one pixel across 11 bands with geotiff 3.0.5 defaults: pixel-interleaved = **9 requests** (6 header, 2 tile-index, 1 data); band- or tile-interleaved = **39 requests**. Bytes follow block size: 64 px 28 KB, 128 px 94 KB, 256 px 374 KB, 512 px 1.10 MB. At 50 ms simulated latency per request that is about 472 ms. | ran | `COG/work/logs/step3c_latency0.log`: `CUBE cube/hh_z10_px_128.tif  {}  9  94409  6.1`; `CUBE cube/hh_z10_px_512.tif  {}  9  1103750`; `CUBE cube/hh_z10_band_256.tif  {}  39  428843`; `COG/work/logs/step3c_latency50.log`: `CUBE cube/hh_z10_px_128.tif  {}  9  94409  472` |
| F11 | With `{ blockSize: 16384 }` the same cold read is **2 requests, 131 KB, 116.5 ms** at 50 ms latency; a second pixel in another tile is 1 request (57 ms); the same pixel again is 0 requests. `blockSize: 65536` gives the same request count but 262 KB. | ran | `COG/work/logs/step3c_latency50.log`: `CUBE cube/hh_z10_px_128.tif  {"blockSize":16384}  2  131072  116.5  \| 1/81920/57`; `same pixel again: 0 req, 0 B` |
| F12 | Reading the same pixel from 11 separate single-band COGs works but costs 55 requests by default (22 with `blockSize`), and 1.86 to 3.6 MB per click when the files are the 38 m display COGs with 512 blocks. | ran | `COG/work/logs/step3c_latency50.log`: `11 SEPARATE per-date display COGs (z12, 512 tiles)  {}  55  1861127  305.3`; `… {"blockSize":65536}  22  3604480  153.2` |
| F13 | The JavaScript pixel-index idiom (lon/lat to EPSG:3857, then `floor((x - ox) / rx)`, `floor((y - oy) / ry)` with `getOrigin()` and `getResolution()`, then `readRasters({ window: [col, row, col+1, row+1], interleave: true })`) returns exactly the values and row/col rasterio reports, in all 27 scenarios, including a nodata pixel (zeros) and NaN in a float32 cube. | ran | `COG/work/logs/step3c_latency0.log`: `pixel col,row=417,490 matches rasterio: true; values match rasterio: true` / `values: [161,157,154,185,194,194,64,65,66,64,65]`; every SUMMARY row ends `\| true` |
| F14 | Range support of local static servers, probed with ranged GET requests: **python3 -m http.server 3.12.2: 200, whole file**. `python -m RangeHTTPServer` 1.4.0, `serve` 14.2.8, `http-server` 14.1.1, **Vite 8.3.8 dev** (files in `public/` and under `src/`) and **`vite preview`** (copied `public/` files and hashed build assets): 206 with correct `Content-Range` and bytes identical to disk. | ran | `COG/work/logs/step4_range_servers.log`: `GET  Range: bytes=0-1023  -> HTTP/1.0 200 OK \| body=5221660B \| Content-Range=[]` (python); `GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content \| body=100B \| Content-Range=[bytes 1000000-1000099/5221660]` and `bytes 1000000-1000099 identical to file on disk: yes` (vite dev, vite preview) |
| F15 | geotiff.js against `python3 -m http.server` fails: default options throw `Error: Server responded with full file`; `{allowFullFile: true}` alone throws `RangeError: Invalid field type: 192`; only `{allowFullFile: true, blockSize: 65536}` works, by downloading the whole file three times. Against every other server above it returns correct values. | ran | `COG/work/logs/step4b_geotiff_vs_servers.log`: `fromUrl(url, {})  ERROR Error: Server responded with full file \| 1 requests, statuses 200, 0 bytes`; `fromUrl(url, {"allowFullFile":true,"blockSize":65536})  OK, values correct \| 3 requests, statuses 200, 15664980 bytes` |
| F16 | Vite quirks: it sends no `Accept-Ranges` header on a plain GET or HEAD although it honours Range; it answers suffix ranges wrongly (`bytes=-100` returns bytes 0 to 100, 101 bytes from the start); it sent no `Access-Control-Allow-Origin` in these probes (which carried no `Origin` header). `http-server` defaults to `Cache-Control: max-age=3600`; started with `-c-1 --cors` it sends `no-store` and `access-control-allow-origin: *`. No server gzip-encoded a ranged response. | ran | `COG/work/logs/step4_range_servers.log`: `GET  Range: bytes=-100  -> HTTP/1.1 206 Partial Content \| body=101B \| Content-Range=[bytes 0-100/5221660]` and `HEAD  -> HTTP/1.1 200 OK \| Accept-Ranges=[] \| Content-Length=[5221660] \| ACAO=[]` (vite); `TX/agent-a279b6fda46750f0e.jsonl` tool call 48: `access-control-allow-origin: *` |
| F17 | Total size of 22 per-date COGs (11 dates x 2 channels, about 15,000 km² valid, DEFLATE+pred2, 512 blocks): **z13 / 19.1 m: 927.0 MB** (42.1 MB per file); **z12 / 38.2 m: 208.1 MB** (9.46 MB per file); z11 / 76.4 m: 48.9 MB; z10 / 152.9 m: 11.9 MB. ZSTD: 899 / 192 / 45.5 / 11.1 MB. LERC_ZSTD max error 2 DN: 637 / 142 / 34.3 / 8.5 MB. Only 38 m or coarser fits a 300 MB budget losslessly. | ran | `COG/work/sizes.json`; `COG/work/logs/step5_sizes.log`: `z12 (2x2 looks= 16,   38.22 m) deflate_pred2_512  total    208.1 MB (HH 104.1, HV 104.0) mean/file   9.46 MB [4096, 3840]`; `z13 (1x1 looks=  4,   19.11 m) deflate_pred2_512  total    927.0 MB` |
| F18 | Vite 8.3.8 bundles an app that imports `geotiff` 3.0.5 without configuration (66 modules; main chunk 306 kB, 112 kB gzipped; decoders split into lazy chunks). Files in `public/data/` are copied to `dist/data/` unchanged. A `.tif` imported from `src/` with `?url` is emitted again as a hashed asset. | ran | `COG/work/logs/step4_prepare_vite_app.log`: `✓ 66 modules transformed.` / `dist/assets/cube_in_src-BVcd_Wqe.tif  5,221.66 kB` / `dist/assets/index-Dx8RU0Qy.js  305.94 kB │ gzip: 112.19 kB` |
| F19 | The GDAL COG driver inside the rasterio wheel writes an equivalent file without rio-cogeo (`rasterio.shutil.copy(src, dst, driver="COG", TILING_SCHEME="GoogleMapsCompatible", …)`): 9.46 MB in 0.32 s, valid. It pads to the block grid (4096 x 4096 instead of 4096 x 3840). Against rio-cogeo's output about 0.1 % of pixels differ (17,246 of 15.7 million), essentially all by 1 DN, and 3 pixels at the footprint edge are valid in one file and nodata in the other. **Gotcha:** its `ZOOM_LEVEL` is relative to `BLOCKSIZE`; `BLOCKSIZE=128` with `ZOOM_LEVEL=10` produced 512 x 512 at 305.75 m instead of 1024 x 1024 at 152.87 m. rio-cogeo's `zoom_level` is independent of block size. | ran | `COG/work/logs/step2a_smoke.log`: `== gdalcog_deflate_512_p2.tif: 9.46 MB in 0.32s` / `size 4096 4096`; `COG/work/variants/manifest.json` record `gd_deflate_512_pred`: `"n_diff": 17246`, record `gd_deflate_256_pred`: `"rmse_dn_valid": 0.0396, … "nodata_to_valid": 3`; `COG/work/logs/step3b_make_cubes.log`: `cube/hh_z10_gd_tile_128.tif  1.69 MB  0.14s [512, 512] x11`; `TX/agent-a279b6fda46750f0e.jsonl` tool call 47: `res=305.7481` |
| F20 | uint8 beats float32 for the click cube: the float32 dB cube is 29.8 MB against 5.1 MB (5.8 times) and costs 2.1 MB per cold click. At the test pixel the uint8 values decoded to dB agree with the float32 values to within 0.09 dB on all 11 dates. | ran | `COG/work/logs/step3b_make_cubes.log`: `cube/hh_z10_f32_px_256.tif  29.81 MB`; `COG/work/logs/step3c_latency0.log`: `CUBE cube/hh_z10_f32_px_256.tif  {}  9  2135474`, values `[-9.87…, -10.39…, …]` against DN `[161,157,…]` |
| F21 | `rio cogeo validate` and `cog_validate()` passed every file written, including the all-zero WEBP files. They check structure, not content. | ran | `COG/work/logs/step2b.out`: every row `api_valid=True cli_exit=0 cli='… is a valid cloud optimized GeoTIFF'`, including `gd_webp_lossless_256_1band` |
| F22 | A chart read from a coarser cube will not equal the display pixel under the cursor. At the test point the 153 m cube and the 38 m display COG differ by up to 11 DN (1.7 dB) on a date. Warp resampling also matters: nearest against bilinear differ by RMSE 4.1 DN on this speckled data. | ran | `COG/work/logs/step3c_latency0.log`: cube `values: [161,157,154,185,194,194,64,65,66,64,65]` against per-date z12 `values: [163,153,143,194,200,193,60,64,62,61,66]`; `COG/work/logs/step2b_table.log`: `rc_deflate_512_pred2_nearest … maxabs=98 rmse=4.1247` |
| F23 | rio-cogeo 7.0.4 still accepts `web_optimized=True` but it is deprecated: it emits a `DeprecationWarning` and only sets `tms` to WebMercatorQuad. Defaults that matter: warp `resampling="nearest"`, `overview_resampling="nearest"`, profile block size 512, `interleave: pixel`. | docs | Installed source `COG/venv/lib/python3.12/site-packages/rio_cogeo/cogeo.py` lines 85 and 189 to 195: `web_optimized: bool = False,` … `"'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option"` |
| F24 | Two complete independent runs (attempts 2 and 3) gave identical file sizes, request counts, byte counts and status codes. | ran | `COG/prev_run/work/step4_range_servers.log` against `COG/work/logs/step4_range_servers.log`, and the `step3c`, `step4b` and `step2c` pairs: no differences apart from timings |
| F25 | No browser, MapLibre, COG-protocol, GitHub Pages or real-data test was run in this topic. | ran | Last line of all three transcripts: `You've hit your 5-hour limit`; no `COG/work/browser_test_*.json` exists; `step6_browser_test.mjs` appears in the transcripts only as a file write |
| F26 | `pipeline.py` and `synth.py` are sound as references: every step from 2a to 5 imports them, and their outputs validate and read back correctly (F2, F13). Caveats in Section 10 are from reading the code, not from a failing run. | ran (use) + belief (caveats) | `COG/pipeline.py`, `COG/synth.py`; `COG/work/logs/step2_synth.log`: `HH date 0 2026-06-05: shape=(6500, 7000) dtype=float32 nan_frac=0.166 lake_frac=0.020 mean_dB(power avg) lake=-24.94 ring=-4.60 land=-10.04` |

---

## 4. Result tables

### 4.1 Creation options, one date (HH, 4096 x 3840 px at 38.2 m, 70 % valid), rio-cogeo, 512 blocks

From `COG/work/logs/step2b_table.log`. "Lossless" means GDAL-decoded pixels identical to the uncompressed
variant.

| Variant | MB | Ratio to raw | Write s | Lossless | Note |
|---|---|---|---|---|---|
| raw | 22.28 | 1.000 | 0.52 | yes | |
| DEFLATE | 10.90 | 0.489 | 0.51 | yes | |
| **DEFLATE + PREDICTOR=2** | **9.46** | 0.425 | 0.51 | yes | recommended |
| DEFLATE + pred2, zlevel 9 | 9.45 | 0.424 | 0.66 | yes | no real gain |
| ZSTD | 11.32 | 0.508 | 0.49 | yes | |
| ZSTD + PREDICTOR=2 | 8.75 | 0.392 | 0.51 | yes | needs geotiff >= 3.0.x |
| ZSTD + pred2, level 19 / 22 | 8.65 / 8.63 | 0.388 / 0.387 | 1.34 / 8.51 | yes | |
| LZW | 12.43 | 0.558 | 0.49 | yes | |
| LZW + PREDICTOR=2 | 10.86 | 0.487 | 0.59 | yes | slowest to decode in JS |
| LERC | 9.31 | 0.418 | 0.51 | yes | |
| LERC_ZSTD | 8.92 | 0.400 | 0.50 | yes | |
| LERC, MAX_Z_ERROR=1 / 2 | 9.21 / 7.48 | 0.413 / 0.336 | 0.53 / 0.46 | max error 1 / 2 DN | |
| LERC_ZSTD, MAX_Z_ERROR=2 | 6.48 | 0.291 | 0.47 | max error 2 DN | size fallback |
| PACKBITS | 14.91 | 0.669 | 0.51 | yes | |
| JPEG q75 / q90 | 1.84 / 3.51 | 0.083 / 0.158 | 0.51 / 0.56 | max error 54 / 18 DN | nodata tag dropped, internal mask |
| WEBP lossless, 1 band | fails | | | | see F5 |
| WEBP lossless, gray copied to 3 bands | 7.96 | 0.357 | 2.66 | yes | not decodable in Node; browser untested |
| DEFLATE+pred2, warp nearest | 9.78 | 0.439 | 0.31 | differs from bilinear: max 98 DN, RMSE 4.12 | |
| DEFLATE+pred2, warp cubic | 9.83 | 0.441 | 0.79 | differs from bilinear: max 18 DN, RMSE 1.34 | |
| DEFLATE+pred2, 1 thread | 9.46 | 0.425 | 0.83 | yes | same bytes as multi-thread |

256 px blocks: within 1 % of the 512 px sizes (DEFLATE+pred2 9.52 MB) and one more overview level
(2/4/8/16).

GDAL COG driver (`gd_*` rows in the log): same sizes to within 0.01 MB, 0.3 s per file.

### 4.2 Decoder support, by geotiff.js version (Node v22.15.0)

From `COG/work/logs/step2e_summary.log`. "identical" = sha256 of decoded band 1 equals GDAL's decode.

| Compression | 3.0.5 (latest) | 3.1.0-beta.0 | 2.1.3 | 1.0.0-beta.13 |
|---|---|---|---|---|
| NONE | identical | identical | identical | identical |
| DEFLATE, with or without predictor 2 | identical | identical | identical | identical |
| LZW, with or without predictor 2 | identical | identical | identical | identical |
| PACKBITS | identical | identical | identical | identical |
| ZSTD, with or without predictor 2 | identical | identical | FAIL `Unknown compression method identifier: 50000` | FAIL (same) |
| LERC, LERC_ZSTD | identical | identical | identical | FAIL `Unknown compression method identifier: 34887` |
| JPEG | within 1 DN | within 1 DN | within 1 DN | within 1 DN |
| WEBP | FAIL in Node: ``Cannot decode WebImage as `createImageBitmap` is not available`` | same | same | FAIL `… identifier: 50001` |

Full-image decode time in Node, 4096 x 3840, geotiff 3.0.5 (`COG/work/logs/step2c_decode_node.log`):
raw 169 ms, ZSTD+pred2 223 ms, PACKBITS 281 ms, DEFLATE+pred2 330 ms, LERC 348 ms, JPEG 452 ms,
LZW+pred2 967 ms.

### 4.3 Time cubes (HH, 11 dates, uint8 unless stated)

From `COG/work/logs/step3b_make_cubes.log`. `px` = INTERLEAVE=PIXEL, `band` = INTERLEAVE=BAND.

| File | Grid | Blocks | MB |
|---|---|---|---|
| `cube/hh_z10_px_64.tif` | 1024², 152.87 m | 64 | 5.42 |
| `cube/hh_z10_px_128.tif` | 1024², 152.87 m | 128 | **5.22** |
| `cube/hh_z10_px_256.tif` | 1024², 152.87 m | 256 | 5.13 |
| `cube/hh_z10_px_512.tif` | 1024², 152.87 m | 512 | 4.89 |
| `cube/hh_z10_band_128.tif` / `_256` | same | 128 / 256 | 6.42 / 6.33 |
| `cube/hh_z10_px_256_nopred.tif` | same | 256 | 6.62 |
| `cube/hh_z10_px_256_zstd.tif` | same | 256 | 4.97 |
| `cube/hhhv_z10_px_128.tif` (22 bands: HH then HV) | same | 128 | 10.10 |
| `cube/hh_z11_px_128.tif` / `_256` | 2048², 76.44 m | 128 / 256 | 23.25 / 23.03 |
| `cube/hh_z10_f32_px_256.tif` (float32 dB, NaN nodata, predictor 3) | 1024² | 256 | 29.81 |
| `cube/hh_z10_gd_px_256.tif` / `gd_band` / `gd_tile` (GDAL COG driver) | 1024² | 256 | 5.13 / 6.33 / 6.33 |
| 11 separate `single_z10/HH_<date>.tif` | 1024² each | 256 | 6.34 in total |

### 4.4 Cost of one pixel across all dates, geotiff 3.0.5 in Node over HTTP

From `COG/work/pixel_read_18731_latency0.json` and `COG/work/pixel_read_18731_latency50.json` (the same
numbers are in `COG/work/logs/step3c_latency0.log` and `step3c_latency50.log`). Server: `http-server`
14.1.1 on localhost. "Cold" = `fromUrl` + `getImage` + one pixel. "ms @50" = wall time with a 50 ms sleep
before every request (requests issued in parallel overlap). Median of 5 runs. All values matched rasterio.

| Source | `fromUrl` options | Cold requests | Cold bytes | Cold ms @50 | Second pixel, other tile: requests / bytes / ms @50 | Same pixel again: requests |
|---|---|---|---|---|---|---|
| cube px, 64 blocks | none | 9 | 28,038 | 471.6 | 3 / 23,293 / 158 | 1 |
| **cube px, 128 blocks** | none | 9 | 94,409 | 472 | 3 / 69,903 / 158 | 1 |
| cube px, 256 blocks | none | 9 | 373,864 | 477.8 | 3 / 112,102 / 162 | 1 |
| cube px, 512 blocks | none | 9 | 1,103,750 | 493.2 | 3 / 980,201 / 183 | 1 |
| cube band, 128 blocks | none | 39 | 96,865 | 478.3 | 33 / 85,328 / 164 | 11 |
| cube band, 256 blocks | none | 39 | 428,843 | 486.6 | 33 / 134,049 / 168 | 11 |
| cube GDAL INTERLEAVE=TILE, 256 | none | 39 | 428,832 | 483.5 | 33 / 134,049 / 171 | 11 |
| cube px ZSTD, 256 blocks | none | 9 | 363,927 | 472 | 3 / 105,377 / 159 | 1 |
| cube 22 bands HH+HV px, 128 | none | 9 | 184,894 | 477.1 | 3 / 135,668 / 164 | 1 |
| cube px z11, 128 blocks | none | 9 | 108,261 | 470.7 | 3 / 102,626 / 159 | 1 |
| cube px float32, 256 blocks | none | 9 | 2,135,474 | 510.9 | 3 / 591,502 / 179 | 1 |
| **cube px, 128 blocks** | `{blockSize: 16384}` | **2** | **131,072** | **116.5** | 1 / 81,920 / 57 | **0** |
| cube px, 128 blocks | `{blockSize: 65536}` | 2 | 262,144 | 117.5 | 1 / 131,072 / 57 | 0 |
| cube px, 256 blocks | `{blockSize: 16384}` | 2 | 409,600 | 122.3 | 1 / 114,688 / 60 | 0 |
| cube band, 256 blocks | `{blockSize: 65536}` | 12 | 1,310,720 | 126.1 | 5 / 327,680 / 58 | 0 |
| 11 single-band z10 COGs, 256 blocks | none | 55 | 449,154 | 273.2 | 33 / 134,049 / 164 | 11 |
| 11 single-band z10 COGs | `{blockSize: 65536}` | 22 | 1,441,792 | 122.2 | 11 / 720,896 / 63 | 0 |
| 11 per-date display COGs (z12, 512 blocks) | none | 55 | 1,861,127 | 305.3 | 33 / 1,355,713 / 192 | 11 |
| 11 per-date display COGs (z12, 512 blocks) | `{blockSize: 65536}` | 22 | 3,604,480 | 153.2 | 11 / 2,162,688 / 91 | 0 |

How the 9 default requests break down, for `cube/hh_z10_px_128.tif`:
`bytes=0-1023 | 192-1215 | 1518-1541 | 1542-1589 | 1590-1653 | 1654-1686` (header and IFD, sequential),
`2582-2585 | 2838-2841` (the one tile's offset and byte count, 4 bytes each), then
`2993512-3085695 -> 206 92184B` (the tile with all 11 bands).
With `blockSize: 16384`: `bytes=0-16383 -> 206 16384B | bytes=2981888-3096575 -> 206 114688B`.

Reading the numbers: with `blockSize` set, wall time is about the same for a cube and for 11 separate
files in this Node simulation, because the requests overlap. What the cube saves is requests (2 against
22) and bytes (131 KB against 1.4 to 3.6 MB). A browser on HTTP/1.1 caps parallel connections per host,
which this simulation does not model.

### 4.5 Local static servers and HTTP Range

From `COG/work/logs/step4_range_servers.log` (curl 8.9.1, ranged GET requests against a 5,221,660-byte
COG) and `COG/work/logs/step4b_geotiff_vs_servers.log`.

| Server | `Range: bytes=0-1023` | `bytes=1000000-1000099` | Suffix `bytes=-100` | `bytes=0-99,200-299` | Plain GET headers | geotiff.js 3.0.5 `fromUrl(url)` |
|---|---|---|---|---|---|---|
| `python3 -m http.server` (3.12.2) | **200, 5,221,660 B** | 200, whole file | 200, whole file | 200, whole file | no `Accept-Ranges` | **ERROR `Server responded with full file`** |
| `python -m RangeHTTPServer` 1.4.0 (pip) | 206 | 206, identical to disk | 400 `Invalid byte range` | 400 | `Accept-Ranges: bytes` | OK |
| `serve` 14.2.8 | 206 | 206, identical | 206, correct last 100 bytes | 206, first range only | `Accept-Ranges: bytes`, ETag | OK |
| `http-server` 14.1.1 | 206 | 206, identical | 416 | 206, first range only | `Accept-Ranges: bytes`, `Cache-Control: max-age=3600` | OK |
| **Vite 8.3.8 dev**, file in `public/` | 206 | 206, identical | 206 but **wrong** (`bytes 0-100`, 101 B) | 206, first range only | no `Accept-Ranges`, `Cache-Control: no-cache` | OK |
| Vite 8.3.8 dev, file under `src/` | 206 | 206, identical | same wrong answer | 206, first range only | same | OK |
| **Vite 8.3.8 preview**, `public/` copy | 206 | 206, identical | same wrong answer | 206, first range only | same | OK |
| Vite 8.3.8 preview, hashed asset | 206 | 206, identical | same wrong answer | 206, first range only | same | not run against this URL |

geotiff.js only sends explicit `start-end` ranges, so the suffix-range and multi-range differences did not
affect it. With every 206 server: `fromUrl(url, {})` read two pixels in 12 requests / 164,312 bytes;
`fromUrl(url, {blockSize: 65536})` in 3 requests / 393,216 bytes; values correct.

### 4.6 Size of the full set: 11 dates x 2 channels = 22 per-date COGs

From `COG/work/sizes.json`. Source scene: 7000 x 6500 px at 20 m with 83 % inside the footprint, about
15,200 km² valid. 512 blocks, bilinear warp, average overviews. "Looks" assumes 4-look input.

| Zoom | Pixel (EPSG:3857) | Multilook | Image px | DEFLATE+pred2 | ZSTD+pred2 | LERC_ZSTD, error <= 2 DN | JPEG q75 (lossy) | Mean file, DEFLATE | Write, 22 files |
|---|---|---|---|---|---|---|---|---|---|
| 13 | 19.11 m | none (4 looks) | 7936 x 7168 | **927.0 MB** | 899.0 | 637.4 | 217.7 | 42.14 MB | 48.9 s |
| 12 | 38.22 m | 2 x 2 (16 looks) | 4096 x 3840 | **208.1 MB** | 192.4 | 142.4 | 40.2 | 9.46 MB | 13.0 s |
| 11 | 76.44 m | 4 x 4 (64 looks) | 2048 x 2048 | 48.9 MB | 45.5 | 34.3 | 10.2 | 2.22 MB | 3.5 s |
| 10 | 152.87 m | 8 x 8 (256 looks) | 1024 x 1024 | 11.9 MB | 11.1 | 8.5 | 2.7 | 0.54 MB | 1.2 s |

DEFLATE with 256 blocks: 929.2 / 209.4 / 49.9 / 12.7 MB.

Derived rule of thumb, mine, from these numbers (not measured separately): DEFLATE+pred2 costs about
0.78 to 0.96 bytes per valid output pixel per date per channel, overviews included (0.96 at z13, 0.86 at
z12, 0.81 at z11, 0.78 at z10); that is about
2.8 kB per km² per file at z13 and 0.62 kB per km² per file at z12. A 100 x 100 km window would be about
610 MB at z13 and 137 MB at z12 for 22 files. The synthetic speckle is close to incompressible noise, so
real data could come out smaller or larger.

---

## 5. Corrections to the brief

None blocks the build. None produces wrong data. All are sharpenings.

| # | Brief section | Brief says | Actually | Evidence | Severity |
|---|---|---|---|---|---|
| C1 | 6.3, click-query COG | "One multi-band COG per channel for click queries, with one band per date and pixel interleaving, so a single range request returns a pixel's whole history." | Pixel interleaving is right: one tile request holds all dates, where band or tile interleaving needs 11 data requests plus 22 index lookups. But a cold click with geotiff 3.0.5 defaults is 9 requests (about 470 ms at 50 ms each) and repeat clicks re-download the tile. `fromUrl(url, {blockSize: 16384})` makes it 2 requests / 131 KB / about 117 ms, with repeats free. Bytes per click follow block size, and the rio-cogeo default of 512 means 1.10 MB per click for 11 bands (128 px: 92 KB). | `COG/work/logs/step3c_latency50.log`: `CUBE cube/hh_z10_px_128.tif  {}  9  94409  472` against `{"blockSize":16384}  2  131072  116.5`; `CUBE cube/hh_z10_px_512.tif  {}  9  1103750`; `CUBE cube/hh_z10_band_256.tif  {}  39` | minor |
| C2 | 6.6, local testing | "(*Whether Python's built-in server does is unverified; do not rely on it.*)" | Verified: it does not. Python 3.12.2 `http.server` ignores Range and returns 200 with the whole file; geotiff.js then throws `Server responded with full file`. A Python-only alternative that works is `pip install rangehttpserver` then `python -m RangeHTTPServer <port>`. | `COG/work/logs/step4_range_servers.log`: `GET  Range: bytes=0-1023  -> HTTP/1.0 200 OK \| body=5221660B`; `COG/work/logs/step4b_geotiff_vs_servers.log`: `ERROR Error: Server responded with full file` | minor |
| C3 | 6.6, local testing | "Use the Vite dev server or `vite preview`, and confirm with `curl -r 0-99 -I <url>` that you get 206." | Confirmed for Vite 8.3.8 dev and preview, with ranged **GET** requests. The `-I` (HEAD) form was not tested, and Vite sends no `Accept-Ranges` header, so check with a ranged GET and look at the status line and `Content-Range`: `curl -s -r 0-99 -o /dev/null -D - <url>`. Vite also answers suffix ranges (`bytes=-100`) with the wrong bytes; harmless for geotiff.js, which never sends them. | `COG/work/logs/step4_range_servers.log`: vite rows `-> HTTP/1.1 206 Partial Content \| body=1024B \| Content-Range=[bytes 0-1023/5221660]`, `HEAD -> HTTP/1.1 200 OK \| Accept-Ranges=[]`, `Range: bytes=-100 … Content-Range=[bytes 0-100/5221660]` | minor |
| C4 | Appendix D5 | `cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False)`, labelled "Not run here." | A tested equivalent now exists (Section 11). In rio-cogeo 7.0.4 `web_optimized` is deprecated (warning; it only sets `tms`); the tested call passes `tms=morecantile.tms.get("WebMercatorQuad")`. D5 as written also leaves the warp at `resampling="nearest"`, sets no predictor (file 15 % larger: 10.90 against 9.46 MB) and keeps 512 blocks (right for display, wrong for the click cube). The literal D5 call was still never run. | Installed `rio_cogeo/cogeo.py` lines 85, 189 to 195 (docs); `COG/work/logs/step2b_table.log`: `rc_deflate_512_nopred  10.90`, `rc_deflate_512_pred2  9.46`; `COG/pipeline.py` `write_cog_riocogeo` (ran) | minor |
| C5 | 6.5, geotiff note | "`geotiff` 3.x if you need lower-level reads (version 3 renamed `image.geoKeys` to `getGeoKeys()`)" | `getGeoKeys()` is in the 3.0.5 type declarations. The change that costs more: 3.x has no default block cache (F8), so pass `blockSize`. Also, tags are read with `await image.getFileDirectory().loadValue('Compression')`, and `require('geotiff/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. | `TX/agent-a76ae1ae4f257dea6.jsonl` tool call 24 (`getGeoKeys(): Partial<Record<…>> \| null;`) and tool call 27 (the `ERR_PACKAGE_PATH_NOT_EXPORTED` trace); `COG/node/step2c_decode_test.mjs` (ran with `loadValue`) | minor |
| C6 | 6.3, budget | "Aim for a few hundred megabytes in total" | For 11 dates x 2 channels over a frame-sized window that means 40 m (208 MB), not 20 m (927 MB, nearly the whole 1 GB Pages limit). No single file exceeds 100 MiB even at 20 m (42 MB). Synthetic data; real ratios unknown. | `COG/work/sizes.json`; `COG/work/logs/step5_sizes.log` | minor |
| C7 | 6.3, nodata | "…it only treats *declared* nodata as transparent, so set nodata on the source before reprojecting." | The recipe does that and geotiff.js reads the tag back (`getGDALNoData()` = 0). One trap: with the JPEG profile rio-cogeo silently converts nodata to an internal mask and the file has no nodata tag. Whether the MapLibre protocol renders either case transparently was not tested here. | `COG/work/logs/step2c_decode_node.log`: `rc_deflate_512_pred2 … nodata=0`, `rc_jpeg_q75_512 … ifds=8 nodata=null`; `COG/work/logs/step2b_table.log` warning `Nodata/Alpha band will be translated to an internal mask band.` | minor |

Confirmed as written, no change needed: 6.1 "Reading with `h5py` and writing with `rasterio` avoids any
dependency on a system GDAL" (the whole run used pip wheels on a machine with no GDAL); 4.5 "`pip install
rasterio` bundles GDAL 3.12" (3.12.2, with HDF5 and netCDF drivers present); 6.3 "8-bit, in EPSG:3857 with
web-map tiling, internal overviews, nodata 0 declared in the file"; D5 "Then `rio cogeo validate dst`"
(works; exit 0 and `… is a valid cloud optimized GeoTIFF`).

---

## 6. Recommendations

| # | Decision | Choice | Why |
|---|---|---|---|
| R1 | Writer and options for per-date display COGs | rio-cogeo 7.0.4 `cog_translate` with `cog_profiles.get("deflate")`, `blockxsize=blockysize=512`, `predictor=2`; `nodata=0` on the source dataset and in the call; `tms=morecantile.tms.get("WebMercatorQuad")`; `resampling="bilinear"`; `overview_resampling="average"`; `config={"GDAL_NUM_THREADS": "ALL_CPUS", "GDAL_TIFF_OVR_BLOCKSIZE": "512"}`. Use `write_cog_riocogeo` from `pipeline.py` (Appendix A) as is. | This exact function wrote every per-date file in the run: valid, on the tile grid, nodata kept, 9.46 MB and 0.5 s per file, bit-exact in every geotiff.js version tested (F2, F3, F6). |
| R2 | Compression | DEFLATE + PREDICTOR=2. Not ZSTD, LZW, WEBP or JPEG. Keep LERC_ZSTD `MAX_Z_ERROR=2` in reserve if the size budget breaks. | DEFLATE is the only strong codec every geotiff.js version decodes. ZSTD saves 7.6 % but fails on geotiff <= 2.1.3. LZW is 15 % larger and three times slower to decode. WEBP and JPEG corrupt or lose values (F4, F5). LERC_ZSTD at 2 DN saves 31 % and decodes on geotiff >= 2.1.3. |
| R3 | Display resolution | 40 m multilook (lands on z12, 38.2 m per pixel) for a frame-sized window. 20 m only if the window is about a quarter of that area or the date count is small. Run `du -sh web/public/data` before each deploy. | 208 MB against 927 MB for 22 files (F17). |
| R4 | Click-to-chart product | One uint8 pixel-interleaved multi-band COG per site, bands = dates in manifest order (HH and HV can share one file: 22 bands, 10.1 MB, 185 KB per cold click), `blocksize=128`, DEFLATE + predictor 2, `zoom_level=10` or `11`, written with rio-cogeo. | 2 requests and 131 KB per cold click with R5, against 22 to 55 requests and 1.4 to 3.6 MB from separate files (F10 to F12). uint8 is 5.8 times smaller than float32 and agrees to 0.09 dB (F20). rio-cogeo's zoom level does not shift with block size (F19). |
| R5 | JavaScript read idiom | Open once per file with `fromUrl(url, { blockSize: 16384 })`, keep the `image` from `tiff.getImage(0)`, and per click call `image.readRasters({ window: [col, row, col + 1, row + 1], interleave: true })` with `col`/`row` from `getOrigin()`/`getResolution()` (Section 11.3). Decode `dB = lo + (DN - 1) * (hi - lo) / 254`; DN 0 is nodata. | Verified against rasterio in all scenarios (F13); `blockSize` cuts cold requests from 9 to 2 and makes repeats free (F11). 16384 fetched half the bytes of 65536 for the same request count. |
| R6 | If there is no time to build the cube | Read the click history straight from the per-date display COGs, each opened with `{ blockSize: 65536 }`. | Correct values with no extra pipeline product; cost is 22 requests and 3.6 MB per cold click (F12). Acceptable on a laptop, heavy on a phone. |
| R7 | Local development server | `vite` dev or `vite preview`, data under `web/public/data/`. For a separate data origin: `npx http-server <dir> -p <port> -a 127.0.0.1 -c-1 --cors`. Never `python3 -m http.server`. | F14, F15, F16. `-c-1` avoids the default one-hour cache serving stale rasters; `--cors` adds the header. |
| R8 | Range check command | `curl -s -r 0-99 -o /dev/null -D - <url>` and expect `206` plus `Content-Range: bytes 0-99/<size>`. Do not judge by `Accept-Ranges`. | This is the form that was tested; Vite honours Range without advertising it (C3). |
| R9 | Where COGs live in the Vite project | `web/public/data/`, referenced by URL from the manifest. Do not `import x from './file.tif?url'`. | `public/` files are copied unchanged and keep stable URLs; a `?url` import works but emits a second hashed copy whose name changes with content (F18). |
| R10 | Validation after every write | Keep `rio cogeo validate`, and add content checks: valid-pixel fraction above zero and close to the source's, and a few sampled pixels round-tripped to dB. | Validation passed an all-zero file (F5, F21). |
| R11 | dB encoding range | Use the tested mapping, `lo = -35`, `hi = +5` (0.157 dB per step), or pick `lo`/`hi` per layer from the histogram; record them in the manifest and log the fraction of valid pixels clipped at DN 1 and DN 255. | The tested constants are in `pipeline.py`. The brief's example `lo: -25, hi: 0` would clip the run's synthetic open water (HH -25 dB, HV -29 dB). Real NISAR floor values were not measured, so this is a design caution, not a measurement. |
| R12 | Before multilooking real data | Set every invalid sample to NaN first: GCOV `mask` not in 1..5, non-finite, and power <= 0. | `multilook()` only skips non-finite samples and `power_to_dn()` maps zero power to DN 1 (valid, -35 dB); only NaN and negative values become nodata (code reading, Section 10). |
| R13 | GDAL COG driver | Fine as a no-rio-cogeo alternative for 256 or 512 blocks (`write_cog_gdal` in `pipeline.py`). For small-block cubes use rio-cogeo, or raise `ZOOM_LEVEL` by one per halving of `BLOCKSIZE` below 256. | F19. |
| R14 | Consistency between products | Use one warp resampling for every date and for both the display COGs and the cube; state in the UI that the chart is a mean over the cube's cell (for example about 150 m) and not the display pixel. | F22: up to 1.7 dB between products at one point; nearest against bilinear RMSE 4.1 DN. |
| R15 | Band-to-date mapping | Keep it in `manifest.json` (`band_dates`), as the brief's contract already does. | Band descriptions are written into the TIFF, but reading them back with geotiff.js (`getGDALMetadata(i)`) was coded in the browser test and never executed. |
| R16 | First real-browser check | In the first hours, load one DEFLATE per-date COG and the cube in Chrome through Vite and from the deployed Pages URL, and click a pixel. `COG/node/step6_browser_test.mjs` (Appendix B) is a ready, unrun harness. | Everything here was measured in Node; browser decode, workers, CORS and connection limits are untested (F25). |

---

## 7. Artifacts

All under `COG`. Source files are embedded verbatim in Appendix A.

| Path | What | To reuse |
|---|---|---|
| `COG/pipeline.py` | `multilook`, `power_to_dn`, `dn_to_db`, `multilook_transform`, `open_memory_dataset`, `write_cog_riocogeo`, `write_cog_gdal`. Ran in every step. | Copy into `pipeline/`. Change `DB_MIN`/`DB_MAX` if the encoding range changes and mirror them in the manifest. Mask invalid samples to NaN before `multilook` (R12). |
| `COG/synth.py` | Deterministic synthetic NISAR-like scenes (UTM 48N, 20 m, 7000 x 6500, 4-look speckle, growing lake, NaN outside a rotated footprint), 11 dates x HH/HV. | Test fixture for the pipeline and the web app before real data arrives. First call writes a 774 MB cache `work/synth_static.npz` next to the script. Needs `scipy` and `affine`. |
| `COG/step2a_smoke.py` | One scene through both writers, prints structure and validation. | Template for a pipeline smoke test. |
| `COG/step2b_compare_options.py` + `COG/work/variants/manifest.json` | Attempts 55 creation-option variants (53 written, the two single-band WEBP ones fail); records size, time, structure, validation, losslessness, sha256. | Re-run only if a different codec is being considered. |
| `COG/step3a_prepare_stacks.py`, `COG/step3b_make_cubes.py` | Build uint8 stacks at four multilook factors; write cubes, single-band sets and the 22 per-date COGs; write `expected.json` truth values. | `step3b` lines calling `write(...)` are the exact tested invocations for the cube and the per-date files (Section 11). |
| `COG/step5_sizes.py` + `COG/work/sizes.json` | Size of the full 22-file set per zoom and codec. | Swap the synthetic stacks for a real one to re-measure the budget. |
| `COG/node/step3c_pixel_read.mjs` + `COG/work/pixel_read_18731_latency0.json`, `…latency50.json` | Pixel time-series read over HTTP with request and byte counting, checked against rasterio. | `lonLatTo3857`, `pixelOf`, `openImage`, `readPixel` are the tested read functions (Section 11.3). Run as `node step3c_pixel_read.mjs <baseUrl> <latencyMs>`. |
| `COG/node/step2c_decode_test.mjs`, `COG/node/step2e_decode_other_versions.mjs`, `COG/node/install_other_geotiff_versions.sh` | Decode every variant with geotiff.js (current and three other releases) and compare with GDAL. | Needs `work/variants/` from step 2b. |
| `COG/step4_range_servers.sh` + `COG/work/logs/step4_range_servers.log` | Starts each local server and probes it with `curl -r`. | The `probe` function works against any URL; use it on the deployed GitHub Pages URL. `PY=/opt/anaconda3/bin/python3` is hard-coded. |
| `COG/step4b_geotiff_vs_servers.sh`, `COG/node/step4b_geotiff_vs_server.mjs` | geotiff.js pixel read against each server with four option sets. | `node step4b_geotiff_vs_server.mjs <label> <url>` works against any URL of `cube/hh_z10_px_128.tif`. |
| `COG/step4_prepare_vite_app.sh`, `COG/node/vite-app/` | Minimal Vite app (data in `public/data`, one `?url` import) that builds. | Reference for where data goes in a Vite project. The functions in `src/main.js` were bundled but never executed in a browser. |
| `COG/node/step6_browser_test.mjs` | Playwright + installed Chrome harness: decoders in the browser including WEBP, worker `Pool`, same-origin and cross-origin reads, throttled network. **Never run.** | Needs `work/site/variants/` staged first (command in Section 12) and two servers. Appendix B. |
| `COG/work/site/` | Ready sample COGs: `cube/*.tif`, `single_z10/*.tif`, `perdate_z12/{HH,HV}_<date>.tif`, `expected.json` (truth values at four test points), `cubes_report.json`. 3857, nodata 0, DN = -35..+5 dB. | Drop a per-date file and a cube into `web/public/data/` to develop the map and chart before real data exists. Test point that floods mid-series: lon 103.9327867, lat 12.9266910; expected cube values `[161,157,154,185,194,194,64,65,66,64,65]`. |
| `http://127.0.0.1:18731/` | A leftover `http-server` from the interrupted run (pid 8141, started with `-c-1 --cors`) was still listening at 10:45 on 14 Nov, serving `COG/work/site/`. | Usable right now as a CORS-enabled sample endpoint, for example `http://127.0.0.1:18731/cube/hh_z10_px_128.tif`. Stop it with `kill 8141` when not wanted. I left it running. |
| `COG/work/logs/` | Every log of attempt 3. `COG/prev_run/` holds attempt 2's outputs (4.1 GB, redundant). | The scratch folder is 8.0 GB on a disk that had 30 GB free; `prev_run/` and `work/src/` can be deleted by the team if space is needed. |

---

## 8. Failures (tried, did not work)

| Tried | Outcome |
|---|---|
| Write a single-band uint8 COG with WEBP lossless (rio-cogeo `webp` profile + `WEBP_LOSSLESS=YES`; GDAL COG driver `COMPRESS=WEBP, QUALITY=100`; plain GTiff) | GDAL: `ERROR 1: WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.` and `ERROR 1: Error when compressing strip/tile N`. rio-cogeo raised `CPLE_AppDefinedError` inside the long comparison run but raised nothing in a fresh process and left a 1,308-byte file with 0 valid pixels. GDAL COG driver: no exception, 1,356-byte (or 2,098 / 4,192-byte) all-zero file reported as a valid COG. Plain GTiff: `RasterioIOError: Write failed. See previous exception for details.` |
| Decode WEBP-compressed COGs with geotiff.js in Node | ``Error: Cannot decode WebImage as `createImageBitmap` is not available`` (3.0.5, 3.1.0-beta.0, 2.1.3). Browser decode never tested. |
| Decode ZSTD with geotiff 2.1.3 or 1.0.0-beta.13 | `Error: Unknown compression method identifier: 50000` |
| Decode LERC or LERC_ZSTD with geotiff 1.0.0-beta.13 | `Error: Unknown compression method identifier: 34887` |
| geotiff.js 3.0.5 against `python3 -m http.server` | `fromUrl(url, {})`: `Error: Server responded with full file`. `{blockSize: 65536}`: `AggregateError: Request failed`. `{allowFullFile: true}`: `RangeError: Invalid field type: 192`. Only `{allowFullFile: true, blockSize: 65536}` returned correct values, after 3 full downloads (15,664,980 bytes for a 5.2 MB file). |
| GDAL COG driver with `BLOCKSIZE=128`, `ZOOM_LEVEL=10`, `TILING_SCHEME=GoogleMapsCompatible` | Wrote 512 x 512 at 305.75 m instead of 1024 x 1024 at 152.87 m (file `cube/hh_z10_gd_tile_128.tif`, 1.69 MB). Valid COG, wrong resolution. |
| Suffix range `bytes=-100` | Vite dev and preview: `206` with `Content-Range: bytes 0-100/5221660` (wrong bytes). `http-server`: `416 Range Not Satisfiable`. `RangeHTTPServer`: `400 Invalid byte range`. Only `serve` answered correctly. |
| `require('geotiff/package.json')` from an ES module to read the version | `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './package.json' is not defined by "exports"`. Fixed by reading `node_modules/geotiff/package.json` from disk. |
| `from osgeo import gdal` in the venv | `ModuleNotFoundError: No module named 'osgeo'` (the rasterio wheel has no Python GDAL bindings). Driver options were listed through ctypes instead (`misc_gdal_driver_options.py`). |
| Installing three geotiff versions side by side with an inline `for spec in …; set -- $spec` loop | Failed under zsh (`ENOENT … node_modules/geotiff/package.json`); a retry containing `rm -rf` inside `bash -c` was refused by a safety check. Fixed with the script `node/install_other_geotiff_versions.sh`. |
| Finishing the task | All three attempts stopped on `You've hit your 5-hour limit`. Step 6 (browser) never ran and no final report was written. |

---

## 9. Open questions

1. **Real browser.** Does Chrome decode these COGs through Vite and from the deployed site the way Node
   does? Untested: WEBP in the browser, the worker `Pool`, cross-origin reads, request counts as Chrome
   sees them, HTTP/1.1 connection limits, throttled networks.
2. **MapLibre COG protocol.** `@geomatico/maplibre-cog-protocol` 0.10.0 was never loaded in this topic:
   rendering of these files, nodata transparency, 256 against 512 block effects, whether it lets you pass
   `blockSize` to geotiff, and whether `locationValues()` on the pixel-interleaved cube returns all bands
   in one tile request.
3. **GitHub Pages.** 206 responses, CORS headers, caching and any content-encoding on `.tif` were not
   probed here. Run the R8 command against the deployed URL.
4. **`curl -r 0-99 -I`.** Whether Vite answers a HEAD with Range as 206 was not tested.
5. **Real NISAR data.** Compression ratios, sensible `lo`/`hi`, and how much of a real frame is nodata.
   The synthetic 4-look speckle is nearly incompressible, so sizes are an estimate.
6. **Resampling in dB.** `pipeline.py` warps and builds overviews on the dB-coded bytes, not on linear
   power, which Section 5 of the brief asks for. The size of the difference was not measured (my estimate
   in Section 10).
7. **Band descriptions in the browser.** Whether `image.getGDALMetadata(i)` exposes the per-band date
   strings was never executed.
8. **Vite and CORS.** The probes sent no `Origin` header, so whether Vite adds
   `Access-Control-Allow-Origin` for a cross-origin page is unknown.
9. **The literal D5 call** (`web_optimized=True`, default nearest warp, `in_memory=False`) was never run.

---

## 10. Are `pipeline.py` and `synth.py` sound references?

**`pipeline.py`: yes, with caveats.** Every function was exercised by steps 2a to 5 and the outputs
validated and read back correctly in Python and JavaScript. What it does, in order: NaN-aware n x n block
mean in linear power; `10 * log10`; quantise to uint8 with 0 = nodata and 1..255 = -35..+5 dB; wrap in an
in-memory GeoTIFF with nodata declared; warp to EPSG:3857 on the WebMercatorQuad grid with overviews,
through rio-cogeo or the GDAL COG driver.

Caveats from reading the code. None of these was shown by a failing run.

- **No mask handling.** `multilook()` treats every finite sample as valid. Real GCOV needs the `mask`
  layer and the "greater than zero" rule applied first (brief 6.2 step 3).
- **Zero power becomes a valid pixel.** `power_to_dn()` turns 0 into `-inf` dB, clips it to DN 1 and
  keeps it; only NaN and negative power become DN 0.
- **Partial blocks.** `multilook()` drops trailing rows and columns that do not fill a block (6500 rows at
  n = 8 become 812). The origin stays correct. A block with some NaN is averaged over its valid samples.
- **Resampling happens in dB.** The bilinear warp and the `average` overviews run on the dB-coded bytes.
  For 16-look data the bias of averaging in dB instead of power is at most about -0.14 dB, below the
  0.157 dB quantisation step; for unmultilooked 4-look data it reaches about -0.57 dB in the overviews.
  Those figures are my arithmetic (digamma(L) - ln L, times 4.34), not a measurement. To follow the brief
  strictly, warp the float32 linear power to the target grid first and quantise afterwards.
- **`in_memory=True`.** Fine up to the 7936 x 7168 files written here; for much larger rasters pass
  `in_memory=False`.
- **`open_memory_dataset()` returns two handles.** The caller must close both (`src.close(); mem.close()`).

**`synth.py`: yes, as a test fixture only.** It is deterministic (fixed seed), matches its stated
statistics (`lake=-24.94 ring=-4.60 land=-10.04` dB for HH; lake fraction growing 0.020 to 0.066; 16.6 %
NaN), and gives the pipeline a realistic shape: UTM, 20 m, NaN outside a rotated footprint. It does not
model terrain, the GCOV mask, mode or polarization changes between dates, or real speckle statistics, and
it writes a 774 MB cache file on first use.

---

## 11. Recipes: the exact tested calls

The functions named here are verbatim in Appendix A. The call lines come from the scripts that ran, with
the arguments of the small `write()` / `scenario()` helpers substituted in so each call reads on its own.

### 11.1 Per-date display COG (ran: `step3b_make_cubes.py` lines 43 to 50 and 98 to 101)

```python
import pipeline as P                      # Appendix A
# dn: 2-D uint8 array, 0 = nodata, 1..255 = -35..+5 dB, on the product's UTM grid
# tr: affine transform of that grid; CRS: e.g. "EPSG:32648"
mem, src = P.open_memory_dataset(dn, tr, CRS, descriptions=[f"{ch} {d}"], nodata=0)
P.write_cog_riocogeo(src, path, compress="deflate", blocksize=512, predictor=2)
src.close(); mem.close()
```

How `dn` and `tr` were made (ran: `step3a_prepare_stacks.py` line 34, `step3b_make_cubes.py` line 38):

```python
dn = P.power_to_dn(P.multilook(power, 2))        # power: float32 linear, NaN = no data, 20 m
tr = P.multilook_transform(TRANSFORM, 2)         # TRANSFORM: affine of the 20 m grid
```

Result for each of the 22 files: `[4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8]
valid=True`, 9.45 to 9.46 MB, about 0.5 s.

What `write_cog_riocogeo` does with those arguments, flattened. This flattened form is my transcription
of the function body and was not itself executed:

```python
import morecantile
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

profile = cog_profiles.get("deflate")            # returns a copy
profile.update(blockxsize=512, blockysize=512)
profile["predictor"] = 2
cog_translate(
    src, dst_path, profile,
    nodata=0,
    add_mask=False,
    tms=morecantile.tms.get("WebMercatorQuad"),  # replaces deprecated web_optimized=True
    zoom_level=None,                             # None -> closest zoom to native resolution
    resampling="bilinear",                       # warp
    overview_resampling="average",
    in_memory=True,
    quiet=True,
    config={"GDAL_NUM_THREADS": "ALL_CPUS", "GDAL_TIFF_OVR_BLOCKSIZE": "512"},
)
```

Validation that ran on every file: `rio cogeo validate <file>` printed
`<file> is a valid cloud optimized GeoTIFF` with exit code 0; `cog_validate(path, quiet=True)` returned
`(True, [], [])`.

CLI equivalent, from `rio cogeo create --help` only (**docs, not run**):
`rio cogeo create in.tif out.tif -p deflate --blocksize 512 --nodata 0 -w -r bilinear --overview-resampling average --co PREDICTOR=2`

### 11.2 Click-query cube (ran: `step3b_make_cubes.py` lines 67 to 69 and 80 to 82)

```python
# hh: uint8 array of shape (n_dates, rows, cols) on the UTM grid, 8x8 multilooked (160 m); tr160 its transform
# DATES: list of ISO date strings, one per band
mem, src = P.open_memory_dataset(hh, tr160, CRS, descriptions=DATES, nodata=0)
P.write_cog_riocogeo(src, path, compress="deflate", blocksize=128, predictor=2, zoom_level=10)
src.close(); mem.close()
```

Result: `cube/hh_z10_px_128.tif  5.22 MB  0.34s [1024, 1024] x11 uint8 blk128 il=PIXEL DEFLATE pred=2
ovr=[2, 4, 8] valid=True`. For HH and HV in one file the run concatenated the stacks
(`np.concatenate([dn160["HH"], dn160["HV"]])`, descriptions `HH <date>` … `HV <date>`): 22 bands,
10.10 MB. For 80 m use the 4x4 stack with `zoom_level=11` (23.25 MB for 11 bands).

Pixel interleaving is the profile default; nothing extra is needed. Band interleaving required
`extra={"interleave": "band"}` and should not be used.

### 11.3 Reading one pixel's time series in JavaScript (ran: `node/step3c_pixel_read.mjs` lines 32 to 51)

Verbatim from the script:

```js
import { fromUrl } from 'geotiff';

// ---- lon/lat -> EPSG:3857 -> pixel ----
const R = 6378137;
const lonLatTo3857 = (lon, lat) => [(lon * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R];
function pixelOf(image, lon, lat) {
  const [x, y] = lonLatTo3857(lon, lat);
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();          // ry is negative (north-up)
  return [Math.floor((x - ox) / rx), Math.floor((y - oy) / ry)];
}

async function openImage(url, opts) {
  const tiff = await fromUrl(url, opts);
  return tiff.getImage(0);                          // IFD 0 = full resolution
}
async function readPixel(image, lon, lat) {
  const [col, row] = pixelOf(image, lon, lat);
  if (col < 0 || row < 0 || col >= image.getWidth() || row >= image.getHeight()) return { col, row, values: null };
  const data = await image.readRasters({ window: [col, row, col + 1, row + 1], interleave: true });
  return { col, row, values: Array.from(data) };
}
```

What the script's `scenario()` loop executes for the best-performing case, written out for one file and
one point (same functions, same options object, same test point):

```js
const image = await openImage(`${base}/cube/hh_z10_px_128.tif`, { blockSize: 16384 });   // once per file
const { values } = await readPixel(image, 103.9327867278638, 12.926691049684008);
// values -> [161,157,154,185,194,194,64,65,66,64,65]   (one uint8 DN per band/date; 0 = nodata)
```

DN to dB, same constants as `pipeline.py` (`dn_to_db`); this one-liner in JavaScript was not run:
`const dB = dn === 0 ? null : -35 + (dn - 1) * 40 / 254;`

### 11.4 Checking a server for Range support (ran: `step4_range_servers.sh`, `probe`)

The probe that produced the table in 4.5, reduced to one line:

```bash
curl -s -A "cog-range-test/1.0" -r 1000000-1000099 -o /tmp/body.bin -D - "<url>"
# want: HTTP/1.1 206 Partial Content, Content-Range: bytes 1000000-1000099/<size>, body of exactly 100 bytes
```

The data server used for the pixel benchmarks (ran):

```bash
node_modules/.bin/http-server work/site -p 18731 -a 127.0.0.1 -c-1 --cors
# -> HTTP/1.1 206 Partial Content, Accept-Ranges: bytes, access-control-allow-origin: *,
#    cache-control: no-cache, no-store, must-revalidate
```

---

## 12. How to re-run (attempt 3's commands, with the log redirection removed)

```bash
cd "$COG"
/opt/anaconda3/bin/python3 -m venv venv
./venv/bin/python -m pip install --no-input --disable-pip-version-check rasterio rio-cogeo numpy scipy
./venv/bin/python -m pip install rangehttpserver                     # only for step 4
./venv/bin/python synth.py                                           # builds work/synth_static.npz (14 s, 774 MB)
./venv/bin/python step2a_smoke.py                                    # writes work/dn_utm40_HH_d00.npy
./venv/bin/python step2b_compare_options.py > work/logs/step2b.out 2> work/logs/step2b.err   # ~2.5 min
for w in riocogeo gdalcog gtiff; do ./venv/bin/python step2d_webp_1band_fresh.py $w; done
(cd node && npm install geotiff@latest http-server@latest serve@latest vite@latest playwright-core@latest)
(cd node && node step2c_decode_test.mjs)
(cd node && bash install_other_geotiff_versions.sh && for v in gt213 gt310b gt100b13; do node step2e_decode_other_versions.mjs gtver/$v; done)
./venv/bin/python step3a_prepare_stacks.py                           # ~1 min, 1.3 GB in work/src
./venv/bin/python step3b_make_cubes.py                               # ~35 s, writes work/site/
node/node_modules/.bin/http-server work/site -p 18731 -a 127.0.0.1 -c-1 --cors &
(cd node && node step3c_pixel_read.mjs http://127.0.0.1:18731 0 && node step3c_pixel_read.mjs http://127.0.0.1:18731 50)
bash step4_prepare_vite_app.sh
bash step4_range_servers.sh
bash step4b_geotiff_vs_servers.sh
./venv/bin/python step5_sizes.py                                     # ~5.5 min
```

To run the browser test that never ran (Appendix B), first stage the variant files it expects, as attempt
2 did, then start a Vite server for the app and a CORS data server:

```bash
cd "$COG/node"
mkdir -p ../work/site/variants
for v in rc_raw_512 rc_deflate_512_pred2 rc_deflate_512_nopred rc_zstd_512_pred2 rc_lzw_512_pred2 rc_jpeg_q75_512 rc_lerc_512 rc_lerc_zstd_512 rc_lerc_zstd_512_maxz2 rc_packbits_512 rc_webp_lossless_512_rgb gd_webp_lossless_512_rgb rc_deflate_256_pred2; do cp ../work/variants/$v.tif ../work/site/variants/; done
cp ../work/variants/manifest.json ../work/site/variants/
# then, per the script header (not run):
#   (cd vite-app && ../node_modules/.bin/vite --port 18734 --strictPort --host 127.0.0.1) &
#   node step6_browser_test.mjs http://127.0.0.1:18734 http://127.0.0.1:18731 dev
```


---

## Appendix A. Code that ran, verbatim

Copied byte for byte from the scratch folder on 2026-11-14. `COG` is the base path defined at the top.
All Python ran under `COG/venv` (rasterio 1.5.2, rio-cogeo 7.0.4); all JavaScript under Node v22.15.0 with
geotiff 3.0.5.

### `pipeline.py`

Source: `<scratch>/verify/cog/pipeline.py` (120 lines). Ran in every step (2a, 2b, 2d, 3a, 3b, 5). The reference module for multilook, dB encoding and both COG writers.

````python
"""Per-date product pipeline: linear power (float32, UTM) -> uint8 dB web-optimised COG.

    power (float32, NaN = no data, UTM grid)
      -> n x n multilook in linear power (NaN-aware block mean)
      -> dB = 10*log10(power)
      -> uint8 DN, 0 = nodata, 1..255 = DB_MIN..DB_MAX
      -> warp to EPSG:3857 on the WebMercatorQuad grid + internal overviews, as a COG

DN mapping (the JS side must use the same constants):
    DN = 0                                   nodata
    DN = 1 + round(254 * (clip(dB, -35, 5) + 35) / 40)       (1..255)
    dB = -35 + (DN - 1) * 40 / 254           (step 0.15748 dB)
"""
from __future__ import annotations

import numpy as np
import morecantile
import rasterio
from affine import Affine
from rasterio.io import MemoryFile
from rasterio.shutil import copy as rio_copy
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

DB_MIN, DB_MAX = -35.0, 5.0
WEB_MERCATOR = morecantile.tms.get("WebMercatorQuad")


def multilook(power: np.ndarray, n: int) -> np.ndarray:
    """NaN-aware n x n block mean in linear power. Output NaN where a block has no valid sample."""
    if n == 1:
        return power
    h, w = power.shape
    h2, w2 = (h // n) * n, (w // n) * n
    blocks = power[:h2, :w2].reshape(h2 // n, n, w2 // n, n)
    valid = np.isfinite(blocks)
    total = np.where(valid, blocks, 0.0).sum(axis=(1, 3), dtype=np.float64)
    count = valid.sum(axis=(1, 3))
    out = np.full(count.shape, np.nan, dtype=np.float32)
    np.divide(total, count, out=out, where=count > 0, casting="unsafe")
    return out


def power_to_dn(power: np.ndarray) -> np.ndarray:
    """Linear power -> uint8 DN. 0 = nodata (NaN or negative power), 1..255 = -35..+5 dB."""
    with np.errstate(divide="ignore", invalid="ignore"):
        db = 10.0 * np.log10(power)                     # 0 -> -inf (clipped to DN 1), <0/NaN -> NaN
    dn = 1.0 + np.round(254.0 * (np.clip(db, DB_MIN, DB_MAX) - DB_MIN) / (DB_MAX - DB_MIN))
    return np.where(np.isnan(db), 0, dn).astype(np.uint8)


def dn_to_db(dn: np.ndarray) -> np.ndarray:
    db = DB_MIN + (dn.astype(np.float32) - 1.0) * (DB_MAX - DB_MIN) / 254.0
    return np.where(dn == 0, np.nan, db)


def multilook_transform(transform: Affine, n: int) -> Affine:
    return transform * Affine.scale(n, n)


def open_memory_dataset(stack: np.ndarray, transform: Affine, crs, descriptions=None, nodata=0):
    """Wrap a (bands, rows, cols) uint8 array as an in-memory GeoTIFF. Returns (memfile, dataset)."""
    if stack.ndim == 2:
        stack = stack[np.newaxis]
    mem = MemoryFile()
    with mem.open(driver="GTiff", dtype=stack.dtype.name, count=stack.shape[0],
                  height=stack.shape[1], width=stack.shape[2],
                  crs=crs, transform=transform, nodata=nodata) as dst:
        dst.write(stack)
        if descriptions:
            for i, d in enumerate(descriptions, start=1):
                dst.set_band_description(i, d)
    return mem, mem.open()


def write_cog_riocogeo(src, dst_path, *, compress="deflate", blocksize=512, predictor=None,
                       level=None, zoom_level=None, resampling="bilinear",
                       overview_resampling="average", nodata=0, extra=None, threads="ALL_CPUS",
                       add_mask=False):
    """rio-cogeo writer. `src` is an open rasterio dataset (any CRS); output is EPSG:3857,
    aligned to the WebMercatorQuad tile grid, with internal overviews."""
    profile = cog_profiles.get(compress)                # returns a copy
    profile.update(blockxsize=blocksize, blockysize=blocksize)
    if predictor:
        profile["predictor"] = predictor                # 2 = horizontal differencing
    if level is not None:
        profile[{"deflate": "zlevel", "zstd": "zstd_level"}[compress]] = level
    if extra:
        profile.update(extra)
    cog_translate(
        src, dst_path, profile,
        nodata=nodata,
        add_mask=add_mask,
        tms=WEB_MERCATOR,                               # replaces deprecated web_optimized=True
        zoom_level=zoom_level,                          # None -> closest zoom to native res
        resampling=resampling,                          # warp resampling
        overview_resampling=overview_resampling,
        in_memory=True,
        quiet=True,
        config={"GDAL_NUM_THREADS": threads, "GDAL_TIFF_OVR_BLOCKSIZE": str(blocksize)},
    )


def write_cog_gdal(src, dst_path, *, compress="DEFLATE", blocksize=512, predictor="YES",
                   level=None, zoom_level=None, resampling="BILINEAR",
                   overview_resampling="AVERAGE", extra=None, threads="ALL_CPUS"):
    """GDAL COG driver through rasterio (no rio-cogeo needed)."""
    opts = dict(driver="COG", TILING_SCHEME="GoogleMapsCompatible", COMPRESS=compress,
                BLOCKSIZE=blocksize, WARP_RESAMPLING=resampling,
                OVERVIEW_RESAMPLING=overview_resampling, NUM_THREADS=threads,
                BIGTIFF="IF_SAFER")
    if predictor:
        opts["PREDICTOR"] = predictor
    if level is not None:
        opts["LEVEL"] = level
    if zoom_level is not None:
        opts["ZOOM_LEVEL"] = zoom_level
    if extra:
        opts.update(extra)
    rio_copy(src, dst_path, **opts)
````

### `synth.py`

Source: `<scratch>/verify/cog/synth.py` (132 lines). Ran (`python synth.py` printed the scene statistics; imported by steps 2a to 5). Synthetic test scenes.

````python
"""Synthetic NISAR-like L-band backscatter scenes (linear power, float32, UTM 48N, 20 m).

Shape of the real thing (GCOV-like): EPSG:32648 grid, 20 m posting, 7000 x 6500 px,
float32 linear power, NaN outside a rotated-rectangle footprint.

Content: lognormal scene texture x gamma speckle (4 looks), a dark lake (~ -25 dB HH)
that grows over 11 dates, ringed by bright flooded vegetation (~ -5 dB HH).

Usage as a module:
    from synth import Synth
    s = Synth()                    # builds/caches static fields (a few seconds)
    power = s.scene(k, "HH")       # k = 0..10 -> float32 (6500, 7000), NaN outside footprint
"""
from __future__ import annotations

import datetime as dt
import os
import time

import numpy as np
from affine import Affine
from scipy import ndimage as ndi

W, H = 7000, 6500
POSTING = 20.0
X0, Y0 = 330000.0, 1495000.0          # upper-left corner, UTM zone 48N metres
CRS = "EPSG:32648"
TRANSFORM = Affine(POSTING, 0.0, X0, 0.0, -POSTING, Y0)
N_DATES = 11
CHANNELS = ("HH", "HV")
LOOKS = 4
DATES = [(dt.date(2026, 6, 5) + dt.timedelta(days=12 * k)).isoformat() for k in range(N_DATES)]

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "work", "synth_static.npz")


def _smooth_field(rng, shape, coarse, sigma, order=1):
    """Unit-variance smooth gaussian field: low-res noise -> blur -> upsample."""
    h, w = shape
    hc, wc = h // coarse + 2, w // coarse + 2
    f = rng.standard_normal((hc, wc)).astype(np.float32)
    f = ndi.gaussian_filter(f, sigma, mode="wrap")
    f = ndi.zoom(f, coarse, order=order)[:h, :w]
    f -= f.mean()
    f /= f.std()
    return f.astype(np.float32)


class Synth:
    def __init__(self, seed=20261113):
        self.seed = seed
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        if os.path.exists(CACHE):
            z = np.load(CACHE)
            self.tex_db, self.level, self.footprint, self.g1, self.g2 = (
                z["tex_db"], z["level"], z["footprint"], z["g1"], z["g2"])
            return
        rng = np.random.default_rng(seed)
        shape = (H, W)
        large = _smooth_field(rng, shape, 50, 3.0, order=3)     # ~3 km structures
        medium = _smooth_field(rng, shape, 10, 2.5, order=1)    # ~500 m structures
        small = ndi.gaussian_filter(rng.standard_normal(shape).astype(np.float32), 4.0)
        small /= small.std()                                    # ~80 m structures
        # texture in dB (gaussian) -> lognormal in linear power
        self.tex_db = (2.0 * large + 1.5 * medium + 1.0 * small).astype(np.float32)

        # lake "level" function: normalised elliptical distance + irregular shoreline
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        cx, cy, a, b, ang = 3400.0, 3300.0, 1500.0, 700.0, np.deg2rad(35.0)
        u = (xx - cx) * np.cos(ang) + (yy - cy) * np.sin(ang)
        v = -(xx - cx) * np.sin(ang) + (yy - cy) * np.cos(ang)
        shore = _smooth_field(rng, shape, 50, 2.0, order=3)
        self.level = (np.sqrt((u / a) ** 2 + (v / b) ** 2) + 0.15 * shore).astype(np.float32)

        # footprint: rectangle rotated 12 deg about the grid centre
        rot = np.deg2rad(12.0)
        du, dv = xx - W / 2, yy - H / 2
        along = du * np.sin(rot) + dv * np.cos(rot)
        across = du * np.cos(rot) - dv * np.sin(rot)
        self.footprint = (np.abs(across) < 2900) & (np.abs(along) < 3600)

        # two smooth fields driving date-to-date land changes
        self.g1 = _smooth_field(rng, shape, 50, 4.0, order=3)
        self.g2 = _smooth_field(rng, shape, 50, 4.0, order=3)
        np.savez(CACHE, tex_db=self.tex_db, level=self.level, footprint=self.footprint,
                 g1=self.g1, g2=self.g2)

    def lake_threshold(self, k):
        return 0.55 + 0.045 * k        # lake grows with date index

    def scene_db_mean(self, k, channel):
        """Speckle-free mean backscatter in dB for date k (0..10) and channel."""
        land0, lake0, ring0 = {"HH": (-11.0, -25.0, -5.0), "HV": (-18.0, -29.0, -13.0)}[channel]
        phase = 2 * np.pi * k / N_DATES
        db = land0 + self.tex_db + 0.8 * np.sin(phase) * self.g1 + 0.8 * np.cos(phase) * self.g2
        t = self.lake_threshold(k)
        lake = self.level < t
        ring = (self.level >= t) & (self.level < t + 0.12)
        db = np.where(ring, ring0 + 0.5 * self.tex_db, db)
        db = np.where(lake, lake0 + 0.15 * self.tex_db, db)
        return db.astype(np.float32)

    def scene(self, k, channel):
        """Linear power with 4-look gamma speckle, NaN outside the footprint."""
        rng = np.random.default_rng([self.seed, k, CHANNELS.index(channel)])
        power = np.power(np.float32(10.0), self.scene_db_mean(k, channel) / np.float32(10.0))
        speckle = rng.standard_gamma(LOOKS, size=(H, W), dtype=np.float32) / np.float32(LOOKS)
        power = (power * speckle).astype(np.float32)
        power[~self.footprint] = np.nan
        return power


if __name__ == "__main__":
    t0 = time.time()
    s = Synth()
    print(f"static fields ready in {time.time() - t0:.1f}s")
    for ch in CHANNELS:
        for k in (0, 10):
            t0 = time.time()
            p = s.scene(k, ch)
            db = 10 * np.log10(p)
            t = s.lake_threshold(k)
            lake = (s.level < t) & s.footprint
            ring = (s.level >= t) & (s.level < t + 0.12) & s.footprint
            land = (s.level >= t + 0.12) & s.footprint
            print(f"{ch} date {k} {DATES[k]}: shape={p.shape} dtype={p.dtype} "
                  f"nan_frac={np.isnan(p).mean():.3f} "
                  f"lake_frac={lake.mean():.3f} "
                  f"mean_dB(power avg) lake={10*np.log10(p[lake].mean()):.2f} "
                  f"ring={10*np.log10(p[ring].mean()):.2f} land={10*np.log10(p[land].mean()):.2f} "
                  f"std_dB land px={db[land].std():.2f}  ({time.time() - t0:.1f}s)")
````

### `step2a_smoke.py`

Source: `<scratch>/verify/cog/step2a_smoke.py` (59 lines). Ran. Output: `COG/work/logs/step2a_smoke.log`.

````python
"""Smoke test: one scene through the per-date pipeline with both writers; inspect outputs."""
import json
import os
import time

import numpy as np
import rasterio
from rio_cogeo.cogeo import cog_info, cog_validate

import pipeline as P
from synth import CRS, TRANSFORM, Synth

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "work", "smoke")
os.makedirs(OUT, exist_ok=True)

s = Synth()
t0 = time.time(); power = s.scene(0, "HH"); t_scene = time.time() - t0
t0 = time.time(); ml = P.multilook(power, 2); t_ml = time.time() - t0
t0 = time.time(); dn = P.power_to_dn(ml); t_dn = time.time() - t0
tr = P.multilook_transform(TRANSFORM, 2)
print(f"scene {t_scene:.2f}s  multilook {t_ml:.2f}s  to_dn {t_dn:.2f}s")
print("multilooked shape", ml.shape, "dn dtype", dn.dtype, "nodata frac", float((dn == 0).mean()),
      "dn min/max over valid", int(dn[dn > 0].min()), int(dn.max()))
print("transform (40 m):", tuple(tr)[:6])
# keep the uint8 UTM source for the option comparison
np.save(os.path.join(HERE, "work", "dn_utm40_HH_d00.npy"), dn)

mem, src = P.open_memory_dataset(dn, tr, CRS)
print("src profile:", {k: (str(v) if k in ("crs", "transform") else v) for k, v in src.profile.items()})

for name, fn, kw in [
    ("riocogeo_deflate_512_p2.tif", P.write_cog_riocogeo, dict(compress="deflate", blocksize=512, predictor=2)),
    ("gdalcog_deflate_512_p2.tif", P.write_cog_gdal, dict(compress="DEFLATE", blocksize=512, predictor="YES")),
]:
    path = os.path.join(OUT, name)
    t0 = time.time()
    fn(src, path, **kw)
    dt = time.time() - t0
    with rasterio.open(path) as ds:
        print(f"\n== {name}: {os.path.getsize(path)/1e6:.2f} MB in {dt:.2f}s")
        print("  crs", ds.crs, "size", ds.width, ds.height, "count", ds.count, "dtype", ds.dtypes,
              "nodata", ds.nodata)
        print("  transform", tuple(ds.transform)[:6])
        print("  block", ds.block_shapes, "overviews", ds.overviews(1))
        print("  compression", ds.compression, "interleave", ds.interleaving,
              "IMAGE_STRUCTURE", ds.tags(ns="IMAGE_STRUCTURE"))
        print("  tags", ds.tags())
        print("  mask_flags", ds.mask_flag_enums, "colorinterp", ds.colorinterp)
        res = ds.transform.a
        ox, oy = ds.transform.c, ds.transform.f
        half = 20037508.342789244
        for ts in (256, 512):
            print(f"  origin in {ts}px tile units: x={(ox + half) / (res * ts):.6f} y={(half - oy) / (res * ts):.6f}")
        a = ds.read(1)
        print("  valid frac", float((a > 0).mean()), "mean DN valid", float(a[a > 0].mean()))
    ok, errors, warns = cog_validate(path, quiet=True)
    print("  cog_validate:", ok, errors, warns)
src.close(); mem.close()
````

### `step2b_compare_options.py`

Source: `<scratch>/verify/cog/step2b_compare_options.py` (177 lines). Ran (about 2.5 minutes). Output: `COG/work/logs/step2b.out`, `COG/work/variants/manifest.json`.

````python
"""Step 2: write one date (HH, date 0, 40 m uint8 dB) as web-optimised COGs with many
creation options. Records size, write time (median of 3), structure, rio-cogeo validation
(Python API + `rio cogeo validate` CLI), losslessness vs the uncompressed variant, and
sha256 / reference arrays for the geotiff.js decode test (step2c_decode_test.mjs).

Input : work/dn_utm40_HH_d00.npy   (written by step2a_smoke.py)
Output: work/variants/*.tif, work/variants/manifest.json, work/variants/ref/*.bin
"""
import hashlib
import json
import os
import statistics
import subprocess
import time
import warnings

import numpy as np
import rasterio
from rio_cogeo.cogeo import cog_validate

import pipeline as P
from synth import CRS, TRANSFORM

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "work", "variants")
REF = os.path.join(OUT, "ref")
os.makedirs(REF, exist_ok=True)

dn = np.load(os.path.join(HERE, "work", "dn_utm40_HH_d00.npy"))
tr = P.multilook_transform(TRANSFORM, 2)
mem1, src1 = P.open_memory_dataset(dn, tr, CRS)                       # 1 band
mem3, src3 = P.open_memory_dataset(np.stack([dn, dn, dn]), tr, CRS)   # gray replicated to RGB

R = P.write_cog_riocogeo
G = P.write_cog_gdal
V = []   # (name, writer, src, kwargs)


def add(name, writer, src, **kw):
    V.append((name, writer, src, kw))


# ---- rio-cogeo (GTiff driver + COPY_SRC_OVERVIEWS) ----
for bs in (256, 512):
    add(f"rc_raw_{bs}", R, src1, compress="raw", blocksize=bs)
    for comp in ("deflate", "zstd", "lzw"):
        add(f"rc_{comp}_{bs}_nopred", R, src1, compress=comp, blocksize=bs)
        add(f"rc_{comp}_{bs}_pred2", R, src1, compress=comp, blocksize=bs, predictor=2)
    add(f"rc_webp_lossless_{bs}_1band", R, src1, compress="webp", blocksize=bs, extra={"WEBP_LOSSLESS": "YES"})
    add(f"rc_webp_lossless_{bs}_rgb", R, src3, compress="webp", blocksize=bs, extra={"WEBP_LOSSLESS": "YES"})
    add(f"rc_jpeg_q75_{bs}", R, src1, compress="jpeg", blocksize=bs)
    add(f"rc_jpeg_q90_{bs}", R, src1, compress="jpeg", blocksize=bs, extra={"JPEG_QUALITY": 90})
    add(f"rc_lerc_{bs}", R, src1, compress="lerc", blocksize=bs)
    add(f"rc_lerc_zstd_{bs}", R, src1, compress="lerc_zstd", blocksize=bs)
    add(f"rc_packbits_{bs}", R, src1, compress="packbits", blocksize=bs)
# compression levels
add("rc_deflate_512_pred2_z9", R, src1, compress="deflate", blocksize=512, predictor=2, level=9)
add("rc_deflate_512_pred2_z12", R, src1, compress="deflate", blocksize=512, predictor=2, level=12)
add("rc_deflate_256_pred2_z9", R, src1, compress="deflate", blocksize=256, predictor=2, level=9)
add("rc_zstd_512_pred2_l19", R, src1, compress="zstd", blocksize=512, predictor=2, level=19)
add("rc_zstd_512_pred2_l22", R, src1, compress="zstd", blocksize=512, predictor=2, level=22)
# lossy with bounded error (LERC), lossy JPEG with an internal mask
add("rc_lerc_512_maxz1", R, src1, compress="lerc", blocksize=512, extra={"MAX_Z_ERROR": 1})
add("rc_lerc_512_maxz2", R, src1, compress="lerc", blocksize=512, extra={"MAX_Z_ERROR": 2})
add("rc_lerc_zstd_512_maxz2", R, src1, compress="lerc_zstd", blocksize=512, extra={"MAX_Z_ERROR": 2})
add("rc_jpeg_q75_512_mask", R, src1, compress="jpeg", blocksize=512, add_mask=True)
# warp resampling choice / threads
add("rc_deflate_512_pred2_nearest", R, src1, compress="deflate", blocksize=512, predictor=2, resampling="nearest")
add("rc_deflate_512_pred2_cubic", R, src1, compress="deflate", blocksize=512, predictor=2, resampling="cubic")
add("rc_deflate_512_pred2_single_thread", R, src1, compress="deflate", blocksize=512, predictor=2, threads="1")
# ---- GDAL COG driver through rasterio.shutil.copy ----
for bs in (256, 512):
    add(f"gd_deflate_{bs}_pred", G, src1, compress="DEFLATE", blocksize=bs, predictor="YES")
    add(f"gd_deflate_{bs}_nopred", G, src1, compress="DEFLATE", blocksize=bs, predictor=None)
    add(f"gd_zstd_{bs}_pred", G, src1, compress="ZSTD", blocksize=bs, predictor="YES")
    add(f"gd_lzw_{bs}_pred", G, src1, compress="LZW", blocksize=bs, predictor="YES")
    add(f"gd_jpeg_q75_{bs}", G, src1, compress="JPEG", blocksize=bs, predictor=None)
    add(f"gd_webp_lossless_{bs}_1band", G, src1, compress="WEBP", blocksize=bs, predictor=None, extra={"QUALITY": 100})
    add(f"gd_webp_lossless_{bs}_rgb", G, src3, compress="WEBP", blocksize=bs, predictor=None, extra={"QUALITY": 100})
add("gd_deflate_512_pred_z9", G, src1, compress="DEFLATE", blocksize=512, predictor="YES", level=9)

WIN = (1800, 1700, 512, 512)     # col_off, row_off, width, height (straddles tile borders, covers the lake)
results, arrays = [], {}
for name, writer, src, kw in V:
    path = os.path.join(OUT, name + ".tif")
    rec = {"name": name, "writer": "rio-cogeo" if writer is R else "gdal-cog-driver",
           "options": dict(kw)}
    times, err, wmsgs = [], None, []
    for _ in range(3):
        if os.path.exists(path):
            os.remove(path)
        with warnings.catch_warnings(record=True) as wlist:
            warnings.simplefilter("always")
            t0 = time.perf_counter()
            try:
                writer(src, path, **kw)
            except Exception as e:  # noqa: BLE001
                err = f"{type(e).__name__}: {e}"
            else:
                times.append(time.perf_counter() - t0)
        wmsgs = sorted({str(w.message) for w in wlist})
        if err:
            break
    rec["write_warnings"] = wmsgs
    if err:
        rec["error"] = err
        if os.path.exists(path):
            rec["leftover_bytes"] = os.path.getsize(path)
            os.remove(path)
        results.append(rec)
        print(f"{name:38s} FAILED: {err[:200]}")
        continue
    rec["write_s_median"] = round(statistics.median(times), 3)
    rec["write_s_all"] = [round(t, 3) for t in times]
    rec["bytes"] = os.path.getsize(path)
    with rasterio.open(path) as ds:
        rec.update(width=ds.width, height=ds.height, count=ds.count, dtype=ds.dtypes[0],
                   nodata=ds.nodata, block=list(ds.block_shapes[0]), overviews=ds.overviews(1),
                   compression=ds.compression.value if ds.compression else None,
                   interleave=ds.interleaving.value if ds.interleaving else None,
                   image_structure=ds.tags(ns="IMAGE_STRUCTURE"), tags=ds.tags(),
                   mask_flags=[[f.name for f in fl] for fl in ds.mask_flag_enums],
                   transform=list(ds.transform)[:6], crs=str(ds.crs))
        whole = ds.read(1)
        rec["valid_frac"] = float((whole > 0).mean())
        rec["sha256_band1_full"] = hashlib.sha256(whole.tobytes()).hexdigest()
        if ds.count == 3:
            rec["bands_identical"] = bool((ds.read(2) == whole).all() and (ds.read(3) == whole).all())
    with rasterio.open(path, OVERVIEW_LEVEL=len(rec["overviews"]) - 1) as ov:
        o = ov.read(1)
        rec["ovr_shape"] = [ov.width, ov.height]
        rec["sha256_band1_ovr"] = hashlib.sha256(o.tobytes()).hexdigest()
    # reference arrays (as decoded by GDAL) for the geotiff.js comparison
    whole.tofile(os.path.join(REF, name + "_full.bin"))
    o.tofile(os.path.join(REF, name + "_ovr.bin"))
    rec["window"] = list(WIN)
    arrays[name] = (whole, o)
    ok, errors, warns = cog_validate(path, quiet=True)
    rec["cog_validate_api"] = {"valid": ok, "errors": errors, "warnings": warns}
    cli = subprocess.run([os.path.join(HERE, "venv", "bin", "rio"), "cogeo", "validate", path],
                         capture_output=True, text=True)
    rec["rio_cogeo_validate_cli"] = {"exit": cli.returncode,
                                     "stdout": cli.stdout.strip().replace(OUT + "/", ""),
                                     "stderr": cli.stderr.strip().replace(OUT + "/", "")[-400:]}
    results.append(rec)
    print(f"{name:38s} {rec['bytes']/1e6:7.2f} MB  {rec['write_s_median']:6.2f}s  "
          f"{rec['width']}x{rec['height']} blk{rec['block'][1]} ovr{rec['overviews']} "
          f"api_valid={ok} cli_exit={cli.returncode} cli='{rec['rio_cogeo_validate_cli']['stdout'][:60]}'")

# losslessness: compare the GDAL-decoded pixels against the uncompressed rio-cogeo variant
# (same warp + overview settings, same block size)
for r in results:
    if "error" in r:
        continue
    whole, ovr = arrays[r["name"]]
    bw, bo = arrays[f"rc_raw_{r['block'][1]}"]
    if whole.shape == bw.shape:
        d = whole.astype(np.int16) - bw.astype(np.int16)
        valid = bw > 0
        r["vs_raw_full"] = {"identical": bool((d == 0).all()), "max_abs_dn": int(np.abs(d).max()),
                            "rmse_dn_valid": round(float(np.sqrt((d[valid].astype(np.float64) ** 2).mean())), 4),
                            "valid_to_nodata": int(((whole == 0) & (bw > 0)).sum()),
                            "nodata_to_valid": int(((whole > 0) & (bw == 0)).sum())}
    else:
        # GDAL COG driver pads to a different height; compare on the common rows (same origin)
        hh, ww = min(whole.shape[0], bw.shape[0]), min(whole.shape[1], bw.shape[1])
        d = whole[:hh, :ww].astype(np.int16) - bw[:hh, :ww].astype(np.int16)
        r["vs_raw_full"] = {"note": f"grid {whole.shape} vs rio-cogeo raw {bw.shape}; compared common {hh}x{ww}",
                            "identical": bool((d == 0).all()), "max_abs_dn": int(np.abs(d).max()),
                            "n_diff": int((d != 0).sum())}
    if ovr.shape == bo.shape:
        d = ovr.astype(np.int16) - bo.astype(np.int16)
        r["vs_raw_ovr"] = {"identical": bool((d == 0).all()), "max_abs_dn": int(np.abs(d).max())}

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(results, f, indent=1, default=str)
print("\nwrote", os.path.join(OUT, "manifest.json"))
````

### `step2d_webp_1band_fresh.py`

Source: `<scratch>/verify/cog/step2d_webp_1band_fresh.py` (40 lines). Ran three times (`riocogeo`, `gdalcog`, `gtiff`). Output: `COG/work/logs/step2d_webp_1band.log`.

````python
"""Fresh-process check: what happens when a 1-band uint8 raster is written with COMPRESS=WEBP?
(a) rio-cogeo cog_translate (GTiff driver)   (b) GDAL COG driver via rasterio.shutil.copy
(c) plain rasterio GTiff write."""
import os, sys
import numpy as np
import rasterio
from rasterio.shutil import copy as rio_copy
import pipeline as P
from synth import CRS, TRANSFORM

HERE = os.path.dirname(os.path.abspath(__file__))
dn = np.load(os.path.join(HERE, "work", "dn_utm40_HH_d00.npy"))[:1024, 1000:2024].copy()
tr = P.multilook_transform(TRANSFORM, 2)
mem, src = P.open_memory_dataset(dn, tr, CRS)
which = sys.argv[1]
out = os.path.join(HERE, "work", "misc", f"webp1band_{which}.tif")
if os.path.exists(out):
    os.remove(out)
try:
    if which == "riocogeo":
        P.write_cog_riocogeo(src, out, compress="webp", blocksize=512, extra={"WEBP_LOSSLESS": "YES"})
    elif which == "gdalcog":
        P.write_cog_gdal(src, out, compress="WEBP", blocksize=512, predictor=None, extra={"QUALITY": 100})
    elif which == "gtiff":
        with rasterio.open(out, "w", driver="GTiff", dtype="uint8", count=1, height=dn.shape[0], width=dn.shape[1],
                           crs=CRS, transform=tr, nodata=0, tiled=True, blockxsize=512, blockysize=512,
                           compress="WEBP", WEBP_LOSSLESS="YES") as dst:
            dst.write(dn, 1)
    print(f"[{which}] NO EXCEPTION RAISED")
except Exception as e:  # noqa: BLE001
    print(f"[{which}] RAISED {type(e).__name__}: {str(e)[:200]}")
if os.path.exists(out):
    with rasterio.open(out) as ds:
        try:
            a = ds.read(1)
            print(f"[{which}] file exists: {os.path.getsize(out)} bytes, {ds.width}x{ds.height}, valid px (DN>0) = {int((a > 0).sum())} of source valid {int((dn > 0).sum())}")
        except Exception as e:  # noqa: BLE001
            print(f"[{which}] file exists ({os.path.getsize(out)} bytes) but read failed: {type(e).__name__}: {str(e)[:200]}")
else:
    print(f"[{which}] no output file")
````

### `step3a_prepare_stacks.py`

Source: `<scratch>/verify/cog/step3a_prepare_stacks.py` (69 lines). Ran (57 s). Output: `COG/work/src/*.npy`, `COG/work/src/meta.json`.

````python
"""Generate all 11 dates x 2 channels once and store the uint8 dB stacks at 4 multilook factors.

For each channel:  work/src/dn{20,40,80,160}_{HH,HV}.npy   shape (11, rows, cols) uint8, UTM 48N
    20 m  = no multilook (4 looks)        -> WebMercatorQuad z13
    40 m  = 2x2 multilook in linear power -> z12   (the per-date display product)
    80 m  = 4x4                            -> z11
    160 m = 8x8                            -> z10   (time cube)
Multilooking is always done on the float32 linear power, then converted to dB and quantised.
Also writes work/src/meta.json (dates, transforms, a test point that turns from land into lake).
"""
import json
import os
import time

import numpy as np
from rasterio.warp import transform as warp_transform

import pipeline as P
from synth import CHANNELS, CRS, DATES, N_DATES, TRANSFORM, Synth

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "work", "src")
os.makedirs(OUT, exist_ok=True)
FACTORS = (1, 2, 4, 8)

s = Synth()
t_all = time.time()
for ch in CHANNELS:
    stacks = {n: [] for n in FACTORS}
    for k in range(N_DATES):
        t0 = time.time()
        power = s.scene(k, ch)
        for n in FACTORS:
            stacks[n].append(P.power_to_dn(P.multilook(power, n)))
        print(f"{ch} date {k} {DATES[k]} done in {time.time() - t0:.1f}s", flush=True)
    for n in FACTORS:
        arr = np.stack(stacks[n])
        np.save(os.path.join(OUT, f"dn{20 * n}_{ch}.npy"), arr)
        print(f"  dn{20 * n}_{ch}.npy shape={arr.shape} nodata_frac={(arr == 0).mean():.4f} "
              f"DN range over valid {int(arr[arr > 0].min())}..{int(arr.max())}")

# test points (UTM pixel -> lon/lat): one that floods mid-series, one always-lake, one always-land,
# one outside the footprint (nodata)
lvl, fp = s.level, s.footprint
pts = {}
cand = np.argwhere((np.abs(lvl - 0.80) < 0.002) & fp)
r, c = cand[len(cand) // 2]
pts["floods_mid_series"] = (int(r), int(c))
cand = np.argwhere((lvl < 0.30) & fp)
r, c = cand[len(cand) // 2]
pts["always_lake"] = (int(r), int(c))
cand = np.argwhere((lvl > 2.5) & fp)
r, c = cand[len(cand) // 3]
pts["always_land"] = (int(r), int(c))
pts["outside_footprint"] = (30, 30)
points = {}
for name, (r, c) in pts.items():
    x, y = TRANSFORM * (c + 0.5, r + 0.5)
    lon, lat = warp_transform(CRS, "EPSG:4326", [x], [y])
    points[name] = {"utm_row": r, "utm_col": c, "utm_x": x, "utm_y": y, "lon": lon[0], "lat": lat[0],
                    "level": float(lvl[r, c]), "in_footprint": bool(fp[r, c])}
meta = {"dates": DATES, "channels": list(CHANNELS), "crs": CRS, "transform20": list(TRANSFORM)[:6],
        "dn_mapping": {"nodata": 0, "db_min": P.DB_MIN, "db_max": P.DB_MAX,
                       "formula": "DN = 1 + round(254*(clip(dB,-35,5)+35)/40); dB = -35 + (DN-1)*40/254"},
        "lake_threshold_per_date": [s.lake_threshold(k) for k in range(N_DATES)], "points": points}
with open(os.path.join(OUT, "meta.json"), "w") as f:
    json.dump(meta, f, indent=1)
print(json.dumps(points, indent=1))
print(f"total {time.time() - t_all:.1f}s")
````

### `step3b_make_cubes.py`

Source: `<scratch>/verify/cog/step3b_make_cubes.py` (144 lines). Ran (35 s). Output: `COG/work/site/`, `COG/work/logs/step3b_make_cubes.log`.

````python
"""Step 3: time cubes (bands = dates) + the per-file alternatives, all under work/site/ (the web root).

  cube/hh_z10_px_{64,128,256,512}.tif     11 bands, INTERLEAVE=PIXEL, DEFLATE+PREDICTOR=2 (rio-cogeo)
  cube/hh_z10_band_{128,256}.tif          11 bands, INTERLEAVE=BAND (rio-cogeo)
  cube/hh_z10_gd_{px,band,tile}_256.tif   GDAL COG driver, INTERLEAVE=PIXEL/BAND/TILE
  cube/hh_z10_px_256_zstd.tif             ZSTD instead of DEFLATE
  cube/hh_z10_px_256_nopred.tif           no predictor
  cube/hhhv_z10_px_128.tif                22 bands (11 x HH then 11 x HV)
  cube/hh_z11_px_{128,256}.tif            80 m multilook -> z11
  cube/hh_z10_f32_{px,band}_256.tif       float32 dB, NaN nodata, DEFLATE+PREDICTOR=3
  single_z10/HH_<date>.tif                11 single-band COGs on the same z10 grid
  perdate_z12/{HH,HV}_<date>.tif          the 22 per-date display COGs (40 m -> z12, 512 blocks)
  expected.json                           values rasterio reads at the test points (truth for JS)
"""
import json
import os
import time
import warnings

import numpy as np
import rasterio
from rasterio.warp import transform as warp_transform
from rio_cogeo.cogeo import cog_validate

import pipeline as P
from synth import CRS, DATES, N_DATES, TRANSFORM, Synth

warnings.filterwarnings("ignore", message="Non-standard compression schema")
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "work", "src")
SITE = os.path.join(HERE, "work", "site")
for d in ("cube", "single_z10", "perdate_z12"):
    os.makedirs(os.path.join(SITE, d), exist_ok=True)

meta = json.load(open(os.path.join(SRC, "meta.json")))
dn160 = {ch: np.load(os.path.join(SRC, f"dn160_{ch}.npy")) for ch in ("HH", "HV")}
dn80_hh = np.load(os.path.join(SRC, "dn80_HH.npy"))
tr160, tr80, tr40 = (P.multilook_transform(TRANSFORM, n) for n in (8, 4, 2))
R, G = P.write_cog_riocogeo, P.write_cog_gdal
report = []


def write(rel, writer, stack, tr, descriptions, **kw):
    path = os.path.join(SITE, rel)
    nodata = kw.pop("src_nodata", 0)
    mem, src = P.open_memory_dataset(stack, tr, CRS, descriptions=descriptions, nodata=nodata)
    t0 = time.perf_counter()
    writer(src, path, **kw)
    dt = time.perf_counter() - t0
    src.close(); mem.close()
    ok, errors, warns = cog_validate(path, quiet=True)
    with rasterio.open(path) as ds:
        rec = {"file": rel, "bytes": os.path.getsize(path), "write_s": round(dt, 2), "size": [ds.width, ds.height],
               "count": ds.count, "dtype": ds.dtypes[0], "block": list(ds.block_shapes[0]),
               "interleave": ds.tags(ns="IMAGE_STRUCTURE").get("INTERLEAVE"), "compression": ds.compression.value,
               "predictor": ds.tags(ns="IMAGE_STRUCTURE").get("PREDICTOR"), "overviews": ds.overviews(1),
               "nodata": None if ds.nodata is None else float(ds.nodata) if not np.isnan(ds.nodata) else "nan",
               "descriptions": list(ds.descriptions)[:3], "transform": list(ds.transform)[:6],
               "cog_valid": ok, "cog_errors": errors, "cog_warnings": warns}
    report.append(rec)
    print(f"{rel:38s} {rec['bytes']/1e6:7.2f} MB {dt:5.2f}s {rec['size']} x{rec['count']} {rec['dtype']} blk{rec['block'][1]} "
          f"il={rec['interleave']} {rec['compression']} pred={rec['predictor']} ovr={rec['overviews']} valid={ok} {warns if warns else ''}")
    return path


# ---------------- cubes at z10 (160 m, 8x8 multilook) ----------------
hh = dn160["HH"]
for bs in (64, 128, 256, 512):
    write(f"cube/hh_z10_px_{bs}.tif", R, hh, tr160, DATES, compress="deflate", blocksize=bs, predictor=2, zoom_level=10)
for bs in (128, 256):
    write(f"cube/hh_z10_band_{bs}.tif", R, hh, tr160, DATES, compress="deflate", blocksize=bs, predictor=2,
          zoom_level=10, extra={"interleave": "band"})
for il in ("PIXEL", "BAND", "TILE"):
    write(f"cube/hh_z10_gd_{il.lower().replace('pixel', 'px')}_256.tif", G, hh, tr160, DATES, compress="DEFLATE",
          blocksize=256, predictor="YES", zoom_level=10, extra={"INTERLEAVE": il})
write("cube/hh_z10_gd_tile_128.tif", G, hh, tr160, DATES, compress="DEFLATE", blocksize=128, predictor="YES",
      zoom_level=10, extra={"INTERLEAVE": "TILE"})
write("cube/hh_z10_px_256_zstd.tif", R, hh, tr160, DATES, compress="zstd", blocksize=256, predictor=2, zoom_level=10)
write("cube/hh_z10_px_256_nopred.tif", R, hh, tr160, DATES, compress="deflate", blocksize=256, zoom_level=10)
both = np.concatenate([dn160["HH"], dn160["HV"]])
write("cube/hhhv_z10_px_128.tif", R, both, tr160, [f"HH {d}" for d in DATES] + [f"HV {d}" for d in DATES],
      compress="deflate", blocksize=128, predictor=2, zoom_level=10)
for bs in (128, 256):
    write(f"cube/hh_z11_px_{bs}.tif", R, dn80_hh, tr80, DATES, compress="deflate", blocksize=bs, predictor=2, zoom_level=11)

# float32 dB cube (8x8 multilook in power -> dB, NaN nodata), floating point predictor
s = Synth()
f32 = np.stack([10.0 * np.log10(P.multilook(s.scene(k, "HH"), 8)) for k in range(N_DATES)]).astype(np.float32)
for il in ("pixel", "band"):
    write(f"cube/hh_z10_f32_{il.replace('pixel', 'px')}_256.tif", R, f32, tr160, DATES, compress="deflate", blocksize=256,
          predictor=3, zoom_level=10, nodata=float("nan"), src_nodata=float("nan"), extra={"interleave": il})

# ---------------- 11 single-band COGs on the same z10 grid ----------------
for k, d in enumerate(DATES):
    write(f"single_z10/HH_{d}.tif", R, hh[k], tr160, [d], compress="deflate", blocksize=256, predictor=2, zoom_level=10)

# ---------------- the 22 per-date display COGs (z12) ----------------
for ch in ("HH", "HV"):
    dn40 = np.load(os.path.join(SRC, f"dn40_{ch}.npy"))
    for k, d in enumerate(DATES):
        write(f"perdate_z12/{ch}_{d}.tif", R, dn40[k], tr40, [f"{ch} {d}"], compress="deflate", blocksize=512, predictor=2)
    del dn40

# ---------------- expected values at the test points (truth for the JS reads) ----------------
expected = {"dates": DATES, "points": {}, "files": {}}
for name, p in meta["points"].items():
    x, y = warp_transform("EPSG:4326", "EPSG:3857", [p["lon"]], [p["lat"]])
    expected["points"][name] = {"lon": p["lon"], "lat": p["lat"], "x3857": x[0], "y3857": y[0]}
check = [r["file"] for r in report if r["file"].startswith("cube/")] + ["single_z10/*", "perdate_z12/HH_*"]
for rel in check:
    if "*" in rel:
        d, prefix = rel.split("/")[0], rel.split("/")[1].rstrip("*")
        files = sorted(f for f in os.listdir(os.path.join(SITE, d)) if f.startswith(prefix))
        vals = {}
        for name, p in expected["points"].items():
            v = []
            for f in files:
                with rasterio.open(os.path.join(SITE, d, f)) as ds:
                    v.append(int(next(ds.sample([(p["x3857"], p["y3857"])]))[0]))
                    rc = ds.index(p["x3857"], p["y3857"])
            vals[name] = {"values": v, "row": int(rc[0]), "col": int(rc[1])}
        expected["files"][rel] = {"files": [f"{d}/{f}" for f in files], "points": vals}
    else:
        with rasterio.open(os.path.join(SITE, rel)) as ds:
            vals = {}
            for name, p in expected["points"].items():
                v = next(ds.sample([(p["x3857"], p["y3857"])]))
                rc = ds.index(p["x3857"], p["y3857"])
                vals[name] = {"values": [None if np.isnan(t) else float(t) for t in v.astype(np.float64)],
                              "row": int(rc[0]), "col": int(rc[1])}
            expected["files"][rel] = {"points": vals}
with open(os.path.join(SITE, "expected.json"), "w") as f:
    json.dump(expected, f, indent=1)
with open(os.path.join(SITE, "cubes_report.json"), "w") as f:
    json.dump(report, f, indent=1)

p = expected["files"]["cube/hh_z10_px_128.tif"]["points"]
for name in p:
    dn = np.array(p[name]["values"])
    print(name, "row/col", p[name]["row"], p[name]["col"], "DN", dn.astype(int).tolist(),
          "dB", np.round(P.dn_to_db(dn), 1).tolist())
tot = lambda prefix: sum(r["bytes"] for r in report if r["file"].startswith(prefix))  # noqa: E731
print(f"per-date z12 set: {tot('perdate_z12/')/1e6:.1f} MB in {sum(1 for r in report if r['file'].startswith('perdate_z12/'))} files; "
      f"single_z10 set: {tot('single_z10/')/1e6:.2f} MB")
````

### `step5_sizes.py`

Source: `<scratch>/verify/cog/step5_sizes.py` (70 lines). Ran (5.5 minutes). Output: `COG/work/sizes.json`.

````python
"""Step 5: total size of the full 11 dates x 2 channels set at several resolutions / codecs.

Each (zoom, codec) combination writes all 22 per-date COGs (web-optimised, 512 px blocks, bilinear warp,
average overviews) into work/sizes_tmp/, sums the bytes and deletes the files again.
Result: work/sizes.json
"""
import json
import os
import time
import warnings

import numpy as np
import rasterio

import pipeline as P
from synth import CRS, DATES, TRANSFORM

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "work", "src")
TMP = os.path.join(HERE, "work", "sizes_tmp")
os.makedirs(TMP, exist_ok=True)

LEVELS = [  # (zoom, multilook factor, source stack)
    (13, 1, "dn20"), (12, 2, "dn40"), (11, 4, "dn80"), (10, 8, "dn160")]
CODECS = {
    "deflate_pred2_512": dict(compress="deflate", blocksize=512, predictor=2),
    "deflate_pred2_256": dict(compress="deflate", blocksize=256, predictor=2),
    "zstd_pred2_512": dict(compress="zstd", blocksize=512, predictor=2),
    "lerc_zstd_maxz2_512 (lossy, |err|<=2 DN)": dict(compress="lerc_zstd", blocksize=512, extra={"MAX_Z_ERROR": 2}),
    "jpeg_q75_512 (lossy, internal mask)": dict(compress="jpeg", blocksize=512),
}
out = []
for zoom, n, stem in LEVELS:
    tr = P.multilook_transform(TRANSFORM, n)
    stacks = {ch: np.load(os.path.join(SRC, f"{stem}_{ch}.npy"), mmap_mode="r") for ch in ("HH", "HV")}
    for cname, kw in CODECS.items():
        total = 0
        per_channel = {"HH": 0, "HV": 0}
        valid_px = 0
        shape = None
        t0 = time.perf_counter()
        for ch in ("HH", "HV"):
            for k, d in enumerate(DATES):
                mem, src = P.open_memory_dataset(np.ascontiguousarray(stacks[ch][k]), tr, CRS)
                path = os.path.join(TMP, f"{ch}_{d}.tif")
                P.write_cog_riocogeo(src, path, zoom_level=zoom, **kw)
                src.close(); mem.close()
                b = os.path.getsize(path)
                total += b
                per_channel[ch] += b
                if ch == "HH" and k == 0:
                    with rasterio.open(path) as ds:
                        shape = [ds.width, ds.height]
                        res = ds.transform.a
                        valid_px = int(ds.dataset_mask().astype(bool).sum())
                os.remove(path)
        dt = time.perf_counter() - t0
        rec = {"zoom": zoom, "multilook": f"{n}x{n}", "looks": 4 * n * n, "res_3857_m": round(res, 3),
               "codec": cname, "files": 22, "total_bytes": total, "total_MB": round(total / 1e6, 1),
               "HH_MB": round(per_channel["HH"] / 1e6, 1), "HV_MB": round(per_channel["HV"] / 1e6, 1),
               "mean_file_MB": round(total / 22 / 1e6, 2), "image_px": shape, "valid_px_fullres_date0": valid_px,
               "bytes_per_valid_fullres_px": round(total / 22 / valid_px, 3), "write_s_total": round(dt, 1)}
        out.append(rec)
        print(f"z{zoom} ({n}x{n} looks={4*n*n:3d}, {res:7.2f} m) {cname:42s} total {rec['total_MB']:8.1f} MB "
              f"(HH {rec['HH_MB']}, HV {rec['HV_MB']}) mean/file {rec['mean_file_MB']:6.2f} MB "
              f"{shape} valid={valid_px} B/validpx={rec['bytes_per_valid_fullres_px']} write {dt:5.1f}s", flush=True)
with open(os.path.join(HERE, "work", "sizes.json"), "w") as f:
    json.dump(out, f, indent=1)
os.rmdir(TMP)
````

### `misc_gdal_driver_options.py`

Source: `<scratch>/verify/cog/misc_gdal_driver_options.py` (23 lines). Ran in attempt 2 as `python misc_gdal_driver_options.py COG` (lists creation options of the GDAL bundled in the rasterio wheel through ctypes).

````python
"""Print the creation options of the COG and GTiff drivers of the GDAL bundled in the rasterio wheel
(no GDAL CLI / osgeo bindings available, so call the C API through ctypes)."""
import ctypes, glob, os, re, sys
import rasterio
libs = glob.glob(os.path.join(os.path.dirname(rasterio.__file__), ".dylibs", "libgdal*.dylib"))
gdal = ctypes.CDLL(libs[0])
gdal.GDALAllRegister()
gdal.GDALGetDriverByName.restype = ctypes.c_void_p
gdal.GDALGetDriverByName.argtypes = [ctypes.c_char_p]
gdal.GDALGetMetadataItem.restype = ctypes.c_char_p
gdal.GDALGetMetadataItem.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p]
gdal.GDALVersionInfo.restype = ctypes.c_char_p
gdal.GDALVersionInfo.argtypes = [ctypes.c_char_p]
print("lib:", os.path.basename(libs[0]), "|", gdal.GDALVersionInfo(b"--version").decode())
for drv in sys.argv[1:]:
    d = gdal.GDALGetDriverByName(drv.encode())
    xml = gdal.GDALGetMetadataItem(d, b"DMD_CREATIONOPTIONLIST", None).decode()
    print(f"\n== {drv} creation options ==")
    for opt in re.findall(r"<Option .*?(?:/>|</Option>)", xml, re.S):
        name = re.search(r"name='([^']+)'", opt).group(1)
        default = re.search(r"default='([^']*)'", opt)
        vals = re.findall(r"<Value>([^<]*)</Value>", opt)
        print(f"  {name:28s} default={(default.group(1) if default else '-'):12s} values={','.join(vals)}")
````

### `step4_prepare_vite_app.sh`

Source: `<scratch>/verify/cog/step4_prepare_vite_app.sh` (13 lines). Ran. Output: `COG/work/logs/step4_prepare_vite_app.log`.

````bash
#!/bin/bash
# Step 4 (setup): put test COGs into the Vite app and build it.
#   public/data/*            -> served as /data/* by `vite` (dev) and copied to dist/data by `vite build`
#   src/assets/cube_in_src.tif -> imported in src/main.js with `?url` (dev: /src/assets/..., build: hashed /assets/...)
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$HERE/work/site"; APP="$HERE/node/vite-app"; BIN="$HERE/node/node_modules/.bin"
mkdir -p "$APP/public/data" "$APP/src/assets"
cp "$SITE/cube/hh_z10_px_128.tif" "$APP/public/data/hh_z10_px_128.tif"
cp "$SITE/perdate_z12/HH_2026-06-05.tif" "$APP/public/data/HH_2026-06-05.tif"
cp "$SITE/expected.json" "$APP/public/data/expected.json"
cp "$SITE/cube/hh_z10_px_128.tif" "$APP/src/assets/cube_in_src.tif"
cd "$APP" && rm -rf dist && "$BIN/vite" build 2>&1
ls -la "$APP/dist" "$APP/dist/assets" "$APP/dist/data"
````

### `step4_range_servers.sh`

Source: `<scratch>/verify/cog/step4_range_servers.sh` (103 lines). Ran. Output: `COG/work/logs/step4_range_servers.log`. Note the hard-coded `PY=/opt/anaconda3/bin/python3`.

````bash
#!/bin/bash
# Step 4: which local static servers honour HTTP Range requests?
# Starts each server on 127.0.0.1 (ports 1873x), probes it with curl -r, stops it.
# Usage: bash step4_range_servers.sh            (run from anywhere)
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$HERE/work/site"
NODE="$HERE/node"
BIN="$NODE/node_modules/.bin"
TMP="$HERE/work/misc"; mkdir -p "$TMP"
UA="cog-range-test/1.0"
export NO_UPDATE_CHECK=1          # `serve` otherwise phones home for update checks

wait_port() {  # port
  for _ in $(seq 1 100); do
    if curl -s -o /dev/null -A "$UA" "http://127.0.0.1:$1/"; then return 0; fi
    perl -e 'select(undef,undef,undef,0.1)'
  done
  echo "!! server on port $1 did not come up"; return 1
}

hdr() { grep -i "^$1:" "$TMP/h.txt" | tr -d '\r' | head -1 | sed 's/^[^:]*: *//'; }

probe() {  # label url
  local label="$1" url="$2"
  echo "--- $label  $url"
  local spec
  for spec in "0-1023" "1000000-1000099" "-100" "0-99,200-299"; do
    curl -s -A "$UA" -r "$spec" -o "$TMP/body.bin" -D "$TMP/h.txt" "$url"
    printf '  GET  Range: bytes=%-16s -> %s | body=%sB | Content-Range=[%s] | Content-Length=[%s] | Content-Type=[%s]\n' \
      "$spec" "$(head -1 "$TMP/h.txt" | tr -d '\r')" "$(wc -c < "$TMP/body.bin" | tr -d ' ')" \
      "$(hdr content-range)" "$(hdr content-length)" "$(hdr content-type)"
  done
  curl -s -A "$UA" -r 0-1023 -H "Accept-Encoding: gzip, deflate, br" -o "$TMP/body.bin" -D "$TMP/h.txt" "$url"
  printf '  GET  Range 0-1023 + Accept-Encoding: gzip   -> %s | body=%sB | Content-Encoding=[%s] | Content-Range=[%s]\n' \
    "$(head -1 "$TMP/h.txt" | tr -d '\r')" "$(wc -c < "$TMP/body.bin" | tr -d ' ')" "$(hdr content-encoding)" "$(hdr content-range)"
  curl -s -A "$UA" -o "$TMP/body.bin" -D "$TMP/h.txt" "$url"
  printf '  GET  (no Range)                    -> %s | body=%sB | Accept-Ranges=[%s] | Cache-Control=[%s] | ETag=[%s]\n' \
    "$(head -1 "$TMP/h.txt" | tr -d '\r')" "$(wc -c < "$TMP/body.bin" | tr -d ' ')" "$(hdr accept-ranges)" "$(hdr cache-control)" "$(hdr etag)"
  curl -s -A "$UA" -I -o /dev/null -D "$TMP/h.txt" "$url"
  printf '  HEAD                               -> %s | Accept-Ranges=[%s] | Content-Length=[%s] | ACAO=[%s]\n' \
    "$(head -1 "$TMP/h.txt" | tr -d '\r')" "$(hdr accept-ranges)" "$(hdr content-length)" "$(hdr access-control-allow-origin)"
  # is the 206 body byte-identical to the same range of the file on disk?
  if [ -n "$3" ]; then
    curl -s -A "$UA" -r 1000000-1000099 -o "$TMP/body.bin" "$url"
    if [ "$(wc -c < "$TMP/body.bin" | tr -d ' ')" = "100" ] && cmp -s "$TMP/body.bin" <(dd if="$3" bs=1 skip=1000000 count=100 2>/dev/null); then
      echo "  bytes 1000000-1000099 identical to file on disk: yes"
    else
      echo "  bytes 1000000-1000099 identical to file on disk: NO (got $(wc -c < "$TMP/body.bin" | tr -d ' ') bytes)"
    fi
  fi
}

run_server() {  # label port workdir cmd...
  local label="$1" port="$2" wd="$3"; shift 3
  echo; echo "=================== $label (port $port)"
  echo "cmd: $*"
  ( cd "$wd" && exec "$@" ) > "$TMP/server_$port.log" 2>&1 &
  SERVER_PID=$!
  wait_port "$port"
}
stop_server() { kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; }

CUBE="$SITE/cube/hh_z10_px_128.tif"

echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)   curl: $(curl --version | head -1)"

# 1. python -m http.server
PY=/opt/anaconda3/bin/python3
run_server "python3 -m http.server ($($PY --version 2>&1))" 18732 "$SITE" "$PY" -m http.server 18732 --bind 127.0.0.1
probe "python http.server" "http://127.0.0.1:18732/cube/hh_z10_px_128.tif" "$CUBE"
stop_server

# 1b. python RangeHTTPServer (pip package) as a python-only alternative
if "$HERE/venv/bin/python" -c "import RangeHTTPServer" 2>/dev/null; then
  run_server "python -m RangeHTTPServer ($("$HERE/venv/bin/python" -m pip show rangehttpserver 2>/dev/null | grep -i '^version'))" 18736 "$SITE" "$HERE/venv/bin/python" -m RangeHTTPServer 18736 --bind 127.0.0.1
  probe "python RangeHTTPServer" "http://127.0.0.1:18736/cube/hh_z10_px_128.tif" "$CUBE"
  stop_server
fi

# 2. npx serve
run_server "serve $(node -p "require('$NODE/node_modules/serve/package.json').version")" 18733 "$NODE" "$BIN/serve" -l tcp://127.0.0.1:18733 --no-clipboard "$SITE"
probe "serve" "http://127.0.0.1:18733/cube/hh_z10_px_128.tif" "$CUBE"
stop_server

# 3. npx http-server (default flags)
run_server "http-server $(node -p "require('$NODE/node_modules/http-server/package.json').version") (default flags)" 18737 "$NODE" "$BIN/http-server" "$SITE" -p 18737 -a 127.0.0.1
probe "http-server" "http://127.0.0.1:18737/cube/hh_z10_px_128.tif" "$CUBE"
stop_server

# 4. vite dev server
VITE_VER=$(node -p "require('$NODE/node_modules/vite/package.json').version")
run_server "vite $VITE_VER dev server" 18734 "$NODE/vite-app" "$BIN/vite" --port 18734 --strictPort --host 127.0.0.1
probe "vite dev, file in public/" "http://127.0.0.1:18734/data/hh_z10_px_128.tif" "$CUBE"
probe "vite dev, file under src/ (path returned by import x from './assets/cube_in_src.tif?url')" "http://127.0.0.1:18734/src/assets/cube_in_src.tif" "$CUBE"
stop_server

# 5. vite preview (serves dist/ produced by `vite build`)
run_server "vite $VITE_VER preview" 18735 "$NODE/vite-app" "$BIN/vite" preview --port 18735 --strictPort --host 127.0.0.1
probe "vite preview, file copied from public/" "http://127.0.0.1:18735/data/hh_z10_px_128.tif" "$CUBE"
ASSET=$(cd "$NODE/vite-app/dist/assets" && ls cube_in_src-*.tif | head -1)
probe "vite preview, hashed build asset" "http://127.0.0.1:18735/assets/$ASSET" "$CUBE"
stop_server
echo; echo done
````

### `step4b_geotiff_vs_servers.sh`

Source: `<scratch>/verify/cog/step4b_geotiff_vs_servers.sh` (21 lines). Ran. Output: `COG/work/logs/step4b_geotiff_vs_servers.log`.

````bash
#!/bin/bash
# Step 4b: run geotiff.js (Node) against each local static server.
HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$HERE/work/site"; NODE="$HERE/node"; BIN="$NODE/node_modules/.bin"; TMP="$HERE/work/misc"; mkdir -p "$TMP"
export NO_UPDATE_CHECK=1
wait_port() { for _ in $(seq 1 100); do curl -s -o /dev/null -A "cog-range-test/1.0" "http://127.0.0.1:$1/" && return 0; perl -e 'select(undef,undef,undef,0.1)'; done; echo "!! port $1 not up"; return 1; }
run() {  # label port workdir urlpath cmd...
  local label="$1" port="$2" wd="$3" urlpath="$4"; shift 4
  ( cd "$wd" && exec "$@" ) > "$TMP/server_$port.log" 2>&1 &
  local pid=$!
  wait_port "$port" && ( cd "$NODE" && node step4b_geotiff_vs_server.mjs "$label" "http://127.0.0.1:$port$urlpath" )
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}
C=/cube/hh_z10_px_128.tif
run "python3 -m http.server (3.12.2)" 18732 "$SITE" $C /opt/anaconda3/bin/python3 -m http.server 18732 --bind 127.0.0.1
run "python -m RangeHTTPServer 1.4.0" 18736 "$SITE" $C "$HERE/venv/bin/python" -m RangeHTTPServer 18736 --bind 127.0.0.1
run "serve 14.2.8" 18733 "$NODE" $C "$BIN/serve" -l tcp://127.0.0.1:18733 --no-clipboard "$SITE"
run "http-server 14.1.1" 18737 "$NODE" $C "$BIN/http-server" "$SITE" -p 18737 -a 127.0.0.1
run "vite 8.3.8 dev (public/)" 18734 "$NODE/vite-app" /data/hh_z10_px_128.tif "$BIN/vite" --port 18734 --strictPort --host 127.0.0.1
run "vite 8.3.8 dev (src/assets)" 18734 "$NODE/vite-app" /src/assets/cube_in_src.tif "$BIN/vite" --port 18734 --strictPort --host 127.0.0.1
run "vite 8.3.8 preview" 18735 "$NODE/vite-app" /data/hh_z10_px_128.tif "$BIN/vite" preview --port 18735 --strictPort --host 127.0.0.1
````

### `node/package.json`

Source: `<scratch>/verify/cog/node/package.json` (20 lines). The npm manifest of the test folder after `npm install geotiff@latest http-server@latest serve@latest vite@latest playwright-core@latest`.

````json
{
  "name": "node",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "type": "module",
  "dependencies": {
    "geotiff": "^3.0.5",
    "http-server": "^14.1.1",
    "playwright-core": "^1.65.1",
    "serve": "^14.2.8",
    "vite": "^8.3.8"
  }
}
````

### `node/install_other_geotiff_versions.sh`

Source: `<scratch>/verify/cog/node/install_other_geotiff_versions.sh` (15 lines). Ran. Installs geotiff 2.1.3, 3.1.0-beta.0 and 1.0.0-beta.13 side by side.

````bash
#!/bin/bash
# Install other geotiff.js releases side by side (node/gtver/<name>/node_modules/geotiff) so the
# decode test can be repeated against what map libraries actually bundle:
#   2.1.3          last 2.x release
#   3.1.0-beta.0   what ol@10.11.0 depends on (^3.1.0-beta.0)
#   1.0.0-beta.13  what georaster@1.6.0 depends on
HERE="$(cd "$(dirname "$0")" && pwd)"
for spec in "gt213 geotiff@2.1.3" "gt310b geotiff@3.1.0-beta.0" "gt100b13 geotiff@1.0.0-beta.13"; do
  set -- $spec
  mkdir -p "$HERE/gtver/$1"
  cd "$HERE/gtver/$1" || exit 1
  [ -f package.json ] || echo '{"name":"x","private":true,"type":"module"}' > package.json
  npm install --userconfig /dev/null --no-audit --no-fund "$2" 2>&1 | tail -2
  node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("node_modules/geotiff/package.json","utf8"));console.log(process.argv[1], p.version, "main=",p.main,"module=",p.module,"exports=",JSON.stringify(p.exports),"deps=",JSON.stringify(p.dependencies))' "$1"
done
````

### `node/step2c_decode_test.mjs`

Source: `<scratch>/verify/cog/node/step2c_decode_test.mjs` (93 lines). Ran with geotiff 3.0.5 on Node v22.15.0. Output: `COG/work/logs/step2c_decode_node.log`.

````js
// Step 2c: which TIFF compressions can the current geotiff.js release decode (in Node)?
// For every variant written by step2b_compare_options.py: open the file with geotiff.js,
// decode the whole full-resolution band 1 and the smallest overview, and compare the pixels
// with what GDAL (rasterio) decoded from the same file (sha256 + reference .bin files).
//
//   node step2c_decode_test.mjs            -> prints a table, writes ../work/variants/decode_node.json
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'work', 'variants');
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
const geotiffVersion = JSON.parse(await readFile(path.join(here, 'node_modules', 'geotiff', 'package.json'), 'utf8')).version;
console.log(`node ${process.version}  geotiff ${geotiffVersion}`);

const sha = (ta) => createHash('sha256').update(Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength)).digest('hex');

function diffStats(a, ref) {
  if (a.length !== ref.length) return { lengthMismatch: [a.length, ref.length] };
  let maxAbs = 0; let nDiff = 0; let sq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - ref[i]);
    if (d) { nDiff++; sq += d * d; if (d > maxAbs) maxAbs = d; }
  }
  return { maxAbs, nDiff, rmse: Math.sqrt(sq / a.length) };
}

const out = [];
for (const rec of manifest) {
  if (rec.error) {
    out.push({ name: rec.name, written: false, writeError: rec.error });
    console.log(`${rec.name.padEnd(36)} NOT WRITTEN (${rec.error.slice(0, 90)})`);
    continue;
  }
  const file = path.join(dir, `${rec.name}.tif`);
  const r = { name: rec.name, written: true, bytes: rec.bytes };
  let tiff;
  try {
    tiff = await fromFile(file);
    const count = await tiff.getImageCount();
    const image = await tiff.getImage(0);
    const fd = image.getFileDirectory();
    r.ifdCount = count;
    r.compressionTag = await fd.loadValue('Compression');
    r.predictorTag = (await fd.loadValue('Predictor')) ?? 1;
    r.planarConfiguration = await fd.loadValue('PlanarConfiguration');
    r.photometric = await fd.loadValue('PhotometricInterpretation');
    r.samplesPerPixel = image.getSamplesPerPixel();
    r.size = [image.getWidth(), image.getHeight()];
    r.tile = [image.getTileWidth(), image.getTileHeight()];
    r.gdalNoData = image.getGDALNoData();
    // --- full resolution, band 1 ---
    let t0 = performance.now();
    const [full] = await image.readRasters({ samples: [0] });
    r.fullDecodeMs = Math.round(performance.now() - t0);
    r.fullMatchesGdal = sha(full) === rec.sha256_band1_full;
    if (!r.fullMatchesGdal) {
      const ref = new Uint8Array(await readFile(path.join(dir, 'ref', `${rec.name}_full.bin`)));
      r.fullDiffVsGdal = diffStats(full, ref);
    }
    // --- smallest overview: last IFD that is not a mask (NewSubfileType bit 2 = mask) ---
    let ovr = null;
    for (let i = count - 1; i > 0 && !ovr; i--) {
      const im = await tiff.getImage(i);
      const sub = (await im.getFileDirectory().loadValue('NewSubfileType')) ?? 0;
      if ((sub & 4) === 0) ovr = im;
    }
    t0 = performance.now();
    const [o] = await ovr.readRasters({ samples: [0] });
    r.ovrSize = [ovr.getWidth(), ovr.getHeight()];
    r.ovrMatchesGdal = sha(o) === rec.sha256_band1_ovr;
    if (!r.ovrMatchesGdal) {
      const ref = new Uint8Array(await readFile(path.join(dir, 'ref', `${rec.name}_ovr.bin`)));
      r.ovrDiffVsGdal = diffStats(o, ref);
    }
    r.decoded = true;
  } catch (e) {
    r.decoded = false;
    r.error = `${e.name}: ${e.message}`;
  } finally {
    if (tiff) await tiff.close();
  }
  out.push(r);
  const status = r.decoded
    ? `OK   full ${r.fullMatchesGdal ? 'identical to GDAL' : `DIFFERS ${JSON.stringify(r.fullDiffVsGdal)}`}; ovr ${r.ovrMatchesGdal ? 'identical' : `DIFFERS ${JSON.stringify(r.ovrDiffVsGdal)}`}; ${r.fullDecodeMs} ms`
    : `FAIL ${r.error}`;
  console.log(`${rec.name.padEnd(36)} comp=${String(r.compressionTag).padEnd(5)} pred=${r.predictorTag} spp=${r.samplesPerPixel} ifds=${r.ifdCount} nodata=${r.gdalNoData}  ${status}`);
}
await writeFile(path.join(dir, 'decode_node.json'), JSON.stringify({ node: process.version, geotiff: geotiffVersion, results: out }, null, 1));
console.log('wrote', path.join(dir, 'decode_node.json'));
````

### `node/step2e_decode_other_versions.mjs`

Source: `<scratch>/verify/cog/node/step2e_decode_other_versions.mjs` (59 lines). Ran for the three other geotiff releases. Output: `COG/work/logs/step2e_decode_*.log`.

````js
// Step 2e: repeat the decode test with OTHER geotiff.js releases (those bundled by map libraries).
//   node step2e_decode_other_versions.mjs gtver/gt213       (2.1.3)
//   node step2e_decode_other_versions.mjs gtver/gt310b      (3.1.0-beta.0, dependency of ol@10.11.0)
//   node step2e_decode_other_versions.mjs gtver/gt100b13    (1.0.0-beta.13, dependency of georaster@1.6.0)
// Only uses API common to all versions: fromFile, getImage, getImageCount, readRasters.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const verDir = path.resolve(here, process.argv[2]);
const pkgDir = path.join(verDir, 'node_modules', 'geotiff');
const pkg = JSON.parse(await readFile(path.join(pkgDir, 'package.json'), 'utf8'));
let G;
if (pkg.exports) {
  G = await import(pathToFileURL(path.join(pkgDir, pkg.exports['.'].import)).href);
} else {
  G = createRequire(path.join(verDir, 'x.js'))('geotiff');   // old CommonJS build
}
const fromFile = G.fromFile ?? G.default?.fromFile;
const dir = path.join(here, '..', 'work', 'variants');
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
const sha = (ta) => createHash('sha256').update(Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength)).digest('hex');
console.log(`node ${process.version}  geotiff ${pkg.version}`);

const out = [];
for (const rec of manifest) {
  if (rec.error) continue;
  const r = { name: rec.name };
  let tiff;
  try {
    tiff = await fromFile(path.join(dir, `${rec.name}.tif`));
    const image = await tiff.getImage(0);
    const t0 = performance.now();
    const rasters = await image.readRasters({ samples: [0] });
    const full = rasters[0];
    r.ms = Math.round(performance.now() - t0);
    r.decoded = true;
    r.identicalToGdal = sha(full) === rec.sha256_band1_full;
    if (!r.identicalToGdal) {
      const ref = new Uint8Array(await readFile(path.join(dir, 'ref', `${rec.name}_full.bin`)));
      let maxAbs = 0; let nDiff = 0;
      if (ref.length === full.length) {
        for (let i = 0; i < ref.length; i++) { const d = Math.abs(full[i] - ref[i]); if (d) { nDiff++; if (d > maxAbs) maxAbs = d; } }
        r.diff = { maxAbs, nDiff };
      } else r.diff = { lengthMismatch: [full.length, ref.length] };
    }
  } catch (e) {
    r.decoded = false;
    r.error = `${e && e.name}: ${e && e.message}`.slice(0, 160);
  } finally {
    try { if (tiff && tiff.close) await tiff.close(); } catch (e) { /* ignore */ }
  }
  out.push(r);
  console.log(`${rec.name.padEnd(36)} ${r.decoded ? (r.identicalToGdal ? `OK identical to GDAL (${r.ms} ms)` : `DECODED BUT DIFFERS ${JSON.stringify(r.diff)} (${r.ms} ms)`) : `FAIL ${r.error}`}`);
}
await writeFile(path.join(dir, `decode_node_geotiff_${pkg.version}.json`), JSON.stringify({ node: process.version, geotiff: pkg.version, results: out }, null, 1));
````

### `node/step3c_pixel_read.mjs`

Source: `<scratch>/verify/cog/node/step3c_pixel_read.mjs` (142 lines). Ran twice (latency 0 and 50 ms). Output: `COG/work/pixel_read_18731_latency0.json`, `COG/work/pixel_read_18731_latency50.json`. Lines 32 to 51 are the tested read functions.

````js
// Step 3c: read one pixel's time series over HTTP range requests with geotiff.js (Node).
// Counts HTTP requests + response bytes (by wrapping global fetch), times the read, and checks
// the values against what rasterio read from the same files (expected.json).
//
//   node step3c_pixel_read.mjs [baseUrl] [simulatedLatencyMs]
//   default baseUrl = http://127.0.0.1:18731  (npx http-server ../work/site -p 18731 -c-1)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://127.0.0.1:18731';
const latencyMs = Number(process.argv[3] ?? 0);
const expected = JSON.parse(await readFile(path.join(here, '..', 'work', 'site', 'expected.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fetch instrumentation: every HTTP request geotiff.js makes goes through here ----
const realFetch = globalThis.fetch;
let log = [];
globalThis.fetch = async (url, init = {}) => {
  if (latencyMs) await sleep(latencyMs);          // simulated network round trip, per request
  const res = await realFetch(url, init);
  const entry = { url: String(url).replace(base, ''), range: init.headers?.Range ?? null, status: res.status, bytes: 0 };
  log.push(entry);
  const arrayBuffer = res.arrayBuffer.bind(res);
  res.arrayBuffer = async () => { const b = await arrayBuffer(); entry.bytes = b.byteLength; return b; };
  return res;
};
const snapshot = () => ({ requests: log.length, bytes: log.reduce((s, e) => s + e.bytes, 0), statuses: [...new Set(log.map((e) => e.status))] });

// ---- lon/lat -> EPSG:3857 -> pixel ----
const R = 6378137;
const lonLatTo3857 = (lon, lat) => [(lon * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R];
function pixelOf(image, lon, lat) {
  const [x, y] = lonLatTo3857(lon, lat);
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();          // ry is negative (north-up)
  return [Math.floor((x - ox) / rx), Math.floor((y - oy) / ry)];
}

async function openImage(url, opts) {
  const tiff = await fromUrl(url, opts);
  return tiff.getImage(0);                          // IFD 0 = full resolution
}
async function readPixel(image, lon, lat) {
  const [col, row] = pixelOf(image, lon, lat);
  if (col < 0 || row < 0 || col >= image.getWidth() || row >= image.getHeight()) return { col, row, values: null };
  const data = await image.readRasters({ window: [col, row, col + 1, row + 1], interleave: true });
  return { col, row, values: Array.from(data) };
}

const P1 = expected.points.floods_mid_series;
const P2 = expected.points.always_land;
const P3 = expected.points.outside_footprint;
const same = (a, b) => a.length === b.length && a.every((v, i) => (Number.isNaN(v) && b[i] === null) || Math.abs(v - b[i]) < 1e-4);

async function scenario(label, files, expKey, opts) {
  const urls = files.map((f) => `${base}/${f}`);
  const exp = expected.files[expKey].points;
  const runs = [];
  let last;
  for (let i = 0; i < 5; i++) {
    log = [];
    let t0 = performance.now();
    const images = await Promise.all(urls.map((u) => openImage(u, opts)));
    const openMs = performance.now() - t0;
    const afterOpen = snapshot();
    t0 = performance.now();
    const r1 = await Promise.all(images.map((im) => readPixel(im, P1.lon, P1.lat)));
    const coldMs = openMs + (performance.now() - t0);
    const cold = snapshot();
    const coldLog = log.slice();
    log = []; t0 = performance.now();
    const r2 = await Promise.all(images.map((im) => readPixel(im, P2.lon, P2.lat)));
    const warmMs = performance.now() - t0; const warm = snapshot();
    log = []; t0 = performance.now();
    const r1b = await Promise.all(images.map((im) => readPixel(im, P1.lon, P1.lat)));
    const repeatMs = performance.now() - t0; const repeat = snapshot();
    log = [];
    const r3 = await Promise.all(images.map((im) => readPixel(im, P3.lon, P3.lat)));
    const nodataReq = snapshot();
    runs.push({ openMs, coldMs, warmMs, repeatMs });
    last = { afterOpen, cold, warm, repeat, nodataReq, r1, r2, r1b, r3, coldLog, images };
  }
  const med = (k) => { const v = runs.map((r) => r[k]).sort((a, b) => a - b); return Math.round(v[2] * 10) / 10; };
  const flat = (rs) => rs.flatMap((r) => r.values);
  const im0 = last.images[0];
  const res = {
    label, files: files.length, options: opts ?? {},
    image: { size: [im0.getWidth(), im0.getHeight()], tile: [im0.getTileWidth(), im0.getTileHeight()], bands: im0.getSamplesPerPixel() },
    pixel: [last.r1[0].col, last.r1[0].row],
    pixelMatchesRasterio: last.r1[0].col === exp.floods_mid_series.col && last.r1[0].row === exp.floods_mid_series.row,
    valuesMatchRasterio: same(flat(last.r1), exp.floods_mid_series.values) && same(flat(last.r2), exp.always_land.values)
      && same(flat(last.r1b), exp.floods_mid_series.values) && same(flat(last.r3), exp.outside_footprint.values),
    values: flat(last.r1),
    open: { requests: last.afterOpen.requests, bytes: last.afterOpen.bytes, ms: med('openMs') },
    coldTotal: { requests: last.cold.requests, bytes: last.cold.bytes, ms: med('coldMs'), statuses: last.cold.statuses },
    secondPixelOtherTile: { requests: last.warm.requests, bytes: last.warm.bytes, ms: med('warmMs') },
    samePixelAgain: { requests: last.repeat.requests, bytes: last.repeat.bytes, ms: med('repeatMs') },
    nodataPixel: { requests: last.nodataReq.requests, bytes: last.nodataReq.bytes },
    coldRanges: files.length === 1 ? last.coldLog.map((e) => `${e.range} -> ${e.status} ${e.bytes}B`) : undefined,
  };
  console.log(`\n== ${label}  ${JSON.stringify(res.options)}`);
  console.log(`   image ${res.image.size.join('x')} x${res.image.bands} bands, tiles ${res.image.tile.join('x')}; pixel col,row=${res.pixel} matches rasterio: ${res.pixelMatchesRasterio}; values match rasterio: ${res.valuesMatchRasterio}`);
  console.log(`   values: ${JSON.stringify(res.values)}`);
  console.log(`   open (fromUrl+getImage): ${res.open.requests} req, ${res.open.bytes} B, ${res.open.ms} ms`);
  console.log(`   COLD total (open + 1 pixel): ${res.coldTotal.requests} req, ${res.coldTotal.bytes} B, ${res.coldTotal.ms} ms  statuses ${res.coldTotal.statuses}`);
  console.log(`   2nd pixel, other tile:       ${res.secondPixelOtherTile.requests} req, ${res.secondPixelOtherTile.bytes} B, ${res.secondPixelOtherTile.ms} ms`);
  console.log(`   same pixel again:            ${res.samePixelAgain.requests} req, ${res.samePixelAgain.bytes} B, ${res.samePixelAgain.ms} ms`);
  console.log(`   nodata pixel (empty tile):   ${res.nodataPixel.requests} req, ${res.nodataPixel.bytes} B`);
  if (res.coldRanges) console.log(`   cold request ranges: ${res.coldRanges.join(' | ')}`);
  return res;
}

const results = [];
const one = (f) => [[f], f];
const cubes = ['cube/hh_z10_px_64.tif', 'cube/hh_z10_px_128.tif', 'cube/hh_z10_px_256.tif', 'cube/hh_z10_px_512.tif',
  'cube/hh_z10_band_128.tif', 'cube/hh_z10_band_256.tif', 'cube/hh_z10_gd_px_256.tif', 'cube/hh_z10_gd_band_256.tif',
  'cube/hh_z10_gd_tile_256.tif', 'cube/hh_z10_px_256_zstd.tif', 'cube/hhhv_z10_px_128.tif', 'cube/hh_z11_px_128.tif',
  'cube/hh_z11_px_256.tif', 'cube/hh_z10_f32_px_256.tif', 'cube/hh_z10_f32_band_256.tif'];
for (const f of cubes) results.push(await scenario(`CUBE ${f}`, ...one(f), undefined));
for (const f of ['cube/hh_z10_px_128.tif', 'cube/hh_z10_px_256.tif', 'cube/hh_z10_band_256.tif', 'cube/hh_z10_gd_tile_256.tif']) {
  results.push(await scenario(`CUBE ${f}`, ...one(f), { blockSize: 65536 }));
  results.push(await scenario(`CUBE ${f}`, ...one(f), { blockSize: 16384 }));
}
const single = expected.files['single_z10/*'].files;
const perdate = expected.files['perdate_z12/HH_*'].files;
results.push(await scenario('11 SEPARATE single-band COGs (z10, 256 tiles)', single, 'single_z10/*', undefined));
results.push(await scenario('11 SEPARATE single-band COGs (z10, 256 tiles)', single, 'single_z10/*', { blockSize: 65536 }));
results.push(await scenario('11 SEPARATE per-date display COGs (z12, 512 tiles)', perdate, 'perdate_z12/HH_*', undefined));
results.push(await scenario('11 SEPARATE per-date display COGs (z12, 512 tiles)', perdate, 'perdate_z12/HH_*', { blockSize: 65536 }));

const outFile = path.join(here, '..', 'work', `pixel_read_${new URL(base).port}_latency${latencyMs}.json`);
await writeFile(outFile, JSON.stringify({ node: process.version, base, latencyMs, results }, null, 1));
console.log('\nwrote', outFile);
console.log('\nSUMMARY (cold = fromUrl + getImage + 1 pixel across all dates)');
console.log('label'.padEnd(64), 'opts'.padEnd(20), 'req'.padStart(4), 'bytes'.padStart(9), 'ms'.padStart(7), ' | 2nd px req/bytes/ms', ' | values ok');
for (const r of results) {
  console.log(r.label.padEnd(64), JSON.stringify(r.options).padEnd(20), String(r.coldTotal.requests).padStart(4), String(r.coldTotal.bytes).padStart(9),
    String(r.coldTotal.ms).padStart(7), ` | ${r.secondPixelOtherTile.requests}/${r.secondPixelOtherTile.bytes}/${r.secondPixelOtherTile.ms}`.padEnd(24), ` | ${r.valuesMatchRasterio && r.pixelMatchesRasterio}`);
}
````

### `node/step4b_geotiff_vs_server.mjs`

Source: `<scratch>/verify/cog/node/step4b_geotiff_vs_server.mjs` (53 lines). Ran against seven server/URL combinations.

````js
// Step 4b: does geotiff.js actually work against a given static server?
//   node step4b_geotiff_vs_server.mjs <label> <url-of-cube/hh_z10_px_128.tif>
// Tries fromUrl with: default options, {blockSize}, {allowFullFile:true}, {allowFullFile:true, blockSize}
// and compares the pixel time series with the rasterio truth in work/site/expected.json.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';

const [label, url] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(await readFile(path.join(here, '..', 'work', 'site', 'expected.json'), 'utf8'));
const truth = expected.files['cube/hh_z10_px_128.tif'].points;

const realFetch = globalThis.fetch;
let log = [];
globalThis.fetch = async (u, init = {}) => {
  const res = await realFetch(u, init);
  const entry = { status: res.status, bytes: 0 };
  log.push(entry);
  const ab = res.arrayBuffer.bind(res);
  res.arrayBuffer = async () => { const b = await ab(); entry.bytes = b.byteLength; return b; };
  return res;
};
const R = 6378137;
const to3857 = (lon, lat) => [(lon * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R];

async function attempt(opts) {
  log = [];
  const t0 = performance.now();
  try {
    const tiff = await fromUrl(url, opts);
    const image = await tiff.getImage(0);
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();
    const out = {};
    for (const name of ['floods_mid_series', 'always_land']) {
      const [x, y] = to3857(expected.points[name].lon, expected.points[name].lat);
      const col = Math.floor((x - ox) / rx); const row = Math.floor((y - oy) / ry);
      out[name] = Array.from(await image.readRasters({ window: [col, row, col + 1, row + 1], interleave: true }));
    }
    const ok = Object.keys(out).every((n) => JSON.stringify(out[n]) === JSON.stringify(truth[n].values));
    return `${ok ? 'OK, values correct' : `WRONG VALUES ${JSON.stringify(out.floods_mid_series)}`}`
      + ` | ${log.length} requests, statuses ${[...new Set(log.map((e) => e.status))]}, ${log.reduce((s, e) => s + e.bytes, 0)} bytes, ${Math.round(performance.now() - t0)} ms`;
  } catch (e) {
    return `ERROR ${e.name}: ${e.message}`
      + ` | ${log.length} requests, statuses ${[...new Set(log.map((e) => e.status))]}, ${log.reduce((s, e) => s + e.bytes, 0)} bytes`;
  }
}
console.log(`--- geotiff.js vs ${label}: ${url}`);
for (const opts of [undefined, { blockSize: 65536 }, { allowFullFile: true }, { allowFullFile: true, blockSize: 65536 }]) {
  console.log(`  fromUrl(url, ${JSON.stringify(opts ?? {})})`.padEnd(58), await attempt(opts));
}
````

### `node/vite-app/index.html`

Source: `<scratch>/verify/cog/node/vite-app/index.html` (8 lines). Part of the minimal Vite app. Built with `vite build` and served by `vite` dev and `vite preview`; never opened in a browser.

````html
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>cog range test</title></head>
  <body>
    <pre id="out">loading</pre>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
````

### `node/vite-app/package.json`

Source: `<scratch>/verify/cog/node/vite-app/package.json` (1 lines). Part of the minimal Vite app (geotiff resolves from the parent `node/node_modules`).

````json
{ "name": "vite-app", "private": true, "version": "0.0.0", "type": "module" }
````

### `node/vite-app/vite.config.js`

Source: `<scratch>/verify/cog/node/vite-app/vite.config.js` (7 lines). Part of the minimal Vite app. Used by the dev and preview servers in step 4.

````js
import { defineConfig } from 'vite';

export default defineConfig({
  // resolve geotiff from the parent node_modules (single install for all tests)
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
});
````

---

## Appendix B. Code written but never run

Kept because it is the designed next step (a real-browser check). Treat every line as untested.

### `node/vite-app/src/main.js`

Source: `<scratch>/verify/cog/node/vite-app/src/main.js` (76 lines). **Bundled by `vite build` but never executed**: no browser ever loaded the page, so `decodeVariant`, `pixelSeries` and `describe` are untested. Its `?url` import is what produced the hashed `.tif` asset in the build.

````js
// Minimal app used to exercise geotiff.js in a real browser behind Vite's dev server and
// behind `vite preview` (production bundle). The tests are driven by ../../step6_browser_test.mjs
// (Playwright, installed Chrome) through window.tests.
import { fromUrl, Pool } from 'geotiff';
import cubeUrl from './assets/cube_in_src.tif?url';

const R = 6378137;
const to3857 = (lon, lat) => [(lon * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R];

async function sha256(ta) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let pool = null;

window.tests = {
  cubeUrlFromImport: cubeUrl,

  // decode band 1 of the full-resolution image and compare with the sha256 of GDAL's decode
  async decodeVariant(url, expectedSha, usePool) {
    const t0 = performance.now();
    try {
      const tiff = await fromUrl(url);
      const image = await tiff.getImage(0);
      if (usePool && !pool) pool = new Pool();
      const [band] = await image.readRasters({ samples: [0], pool: usePool ? pool : null });
      const identical = (await sha256(band)) === expectedSha;
      let nonZero = 0;
      for (let i = 0; i < band.length; i++) if (band[i] !== 0) nonZero++;
      return { ok: true, identical, ms: Math.round(performance.now() - t0), size: [image.getWidth(), image.getHeight()], nonZero };
    } catch (e) {
      return { ok: false, error: `${e.name}: ${e.message}`, ms: Math.round(performance.now() - t0) };
    }
  },

  // one pixel across all bands of each url (cube: 1 url; per-date files: 11 urls)
  async pixelSeries(urls, lon, lat, opts) {
    const t0 = performance.now();
    try {
      const values = (await Promise.all(urls.map(async (url) => {
        const tiff = await fromUrl(url, opts);
        const image = await tiff.getImage(0);
        const [x, y] = to3857(lon, lat);
        const [ox, oy] = image.getOrigin();
        const [rx, ry] = image.getResolution();
        const col = Math.floor((x - ox) / rx);
        const row = Math.floor((y - oy) / ry);
        const data = await image.readRasters({ window: [col, row, col + 1, row + 1], interleave: true });
        return Array.from(data);
      }))).flat();
      return { ok: true, values, ms: Math.round((performance.now() - t0) * 10) / 10 };
    } catch (e) {
      return { ok: false, error: `${e.name}: ${e.message}` };
    }
  },

  // metadata available to the app: nodata, band descriptions (GDAL metadata), bbox
  async describe(url) {
    const tiff = await fromUrl(url);
    const image = await tiff.getImage(0);
    return {
      imageCount: await tiff.getImageCount(),
      size: [image.getWidth(), image.getHeight()],
      bands: image.getSamplesPerPixel(),
      nodata: image.getGDALNoData(),
      bbox: image.getBoundingBox(),
      epsg: image.getGeoKeys()?.ProjectedCSTypeGeoKey,
      gdalMetadataDataset: await image.getGDALMetadata(),
      gdalMetadataBand0: await image.getGDALMetadata(0),
      gdalMetadataBand10: await image.getGDALMetadata(10),
    };
  },
};
document.getElementById('out').textContent = `ready; imported asset url = ${cubeUrl}`;
window.appReady = true;
````

### `node/step6_browser_test.mjs`

Source: `<scratch>/verify/cog/node/step6_browser_test.mjs` (126 lines). **Written at the end of attempt 2 and never run.** Drives the page above in installed Chrome through `playwright-core`. Expects `COG/work/site/variants/` to be staged (Section 12) and two servers: a Vite server for the app and a CORS static server for the data.

````js
// Step 6: the same reads in a REAL browser (installed Google Chrome, headless, via playwright-core).
//   node step6_browser_test.mjs <appBase> <dataBase> [label]
//     appBase  = Vite dev server or `vite preview` serving ./vite-app   (same-origin data under /data/)
//     dataBase = a second static server with CORS serving ../work/site  (cross-origin data)
// Checks: decoders (incl. WebP, which Node cannot test), Pool (web workers), pixel time series,
// request counts/bytes as seen by Chrome, behaviour with 50 ms latency + 10 Mbit/s throttling.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const [appBase, dataBase, label = 'run'] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', 'work', 'site');
const expected = JSON.parse(await readFile(path.join(site, 'expected.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(site, 'variants', 'manifest.json'), 'utf8'));
const P1 = expected.points.floods_mid_series;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

let net = [];
const pending = new Set();
page.on('request', (req) => { if (req.url().includes('.tif')) pending.add(req); });
page.on('requestfailed', (req) => { pending.delete(req); if (req.url().includes('.tif')) net.push({ url: req.url(), failed: req.failure()?.errorText }); });
page.on('requestfinished', async (req) => {
  if (!req.url().includes('.tif')) return;
  const res = await req.response();
  const h = await req.allHeaders();
  const sizes = await req.sizes().catch(() => ({}));
  net.push({ url: req.url(), method: req.method(), range: h.range, acceptEncoding: h['accept-encoding'], status: res?.status(),
    bodyBytes: sizes.responseBodySize, contentRange: (await res?.allHeaders())?.['content-range'] });
  pending.delete(req);
});
async function settle() { for (let i = 0; i < 100 && pending.size; i++) await new Promise((r) => setTimeout(r, 20)); await new Promise((r) => setTimeout(r, 50)); }
async function measured(fn) {
  net = [];
  const result = await fn();
  await settle();
  const ok = net.filter((n) => !n.failed);
  return { result, requests: net.length, bytes: ok.reduce((s, n) => s + (n.bodyBytes || 0), 0), statuses: [...new Set(net.map((n) => n.status ?? n.failed))], sample: net[0] };
}

const out = { label, appBase, dataBase, chrome: browser.version(), tests: {} };
const log = (k, v) => { out.tests[k] = v; console.log(`\n[${k}]\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1).slice(0, 2600)}`); };

await page.goto(`${appBase}/`);
await page.waitForFunction(() => window.appReady === true, null, { timeout: 60000 });
console.log(`chrome ${browser.version()}  app ${appBase}  data ${dataBase}`);
console.log('user agent:', await page.evaluate(() => navigator.userAgent));

// 1. metadata as geotiff.js exposes it
log('describe same-origin cube', await page.evaluate((u) => window.tests.describe(u), '/data/hh_z10_px_128.tif'));

// 2. pixel time series, same origin (served by Vite), cube with 11 bands
const truthCube = expected.files['cube/hh_z10_px_128.tif'].points.floods_mid_series.values;
for (const opts of [undefined, { blockSize: 65536 }, { blockSize: 16384 }]) {
  const m = await measured(() => page.evaluate(([u, lon, lat, o]) => window.tests.pixelSeries([u], lon, lat, o), ['/data/hh_z10_px_128.tif', P1.lon, P1.lat, opts]));
  log(`pixel series same-origin cube ${JSON.stringify(opts ?? {})}`, { valuesCorrect: m.result.ok && eq(m.result.values, truthCube), ...m.result, requests: m.requests, bytes: m.bytes, statuses: m.statuses, firstRequest: m.sample });
}
// 2b. file imported from src/ with ?url (hashed asset in the build)
{
  const u = await page.evaluate(() => window.tests.cubeUrlFromImport);
  const m = await measured(() => page.evaluate(([uu, lon, lat]) => window.tests.pixelSeries([uu], lon, lat, { blockSize: 65536 }), [u, P1.lon, P1.lat]));
  log('pixel series, asset imported with ?url', { url: u, valuesCorrect: m.result.ok && eq(m.result.values, truthCube), requests: m.requests, bytes: m.bytes, statuses: m.statuses, error: m.result.error });
}

// 3. cross-origin (data on another origin/port with Access-Control-Allow-Origin: *)
for (const opts of [undefined, { blockSize: 65536 }]) {
  const m = await measured(() => page.evaluate(([u, lon, lat, o]) => window.tests.pixelSeries([u], lon, lat, o), [`${dataBase}/cube/hh_z10_px_128.tif`, P1.lon, P1.lat, opts]));
  log(`pixel series CROSS-origin cube ${JSON.stringify(opts ?? {})}`, { valuesCorrect: m.result.ok && eq(m.result.values, truthCube), ...m.result, requests: m.requests, bytes: m.bytes, statuses: m.statuses, firstRequest: m.sample });
}

// 4. cube vs 11 separate per-date COGs, unthrottled and with 50 ms latency + 10 Mbit/s
const perdate = expected.files['perdate_z12/HH_*'];
const single = expected.files['single_z10/*'];
const scenarios = [
  ['cube px128, default', [`${dataBase}/cube/hh_z10_px_128.tif`], undefined, truthCube],
  ['cube px128, blockSize 65536', [`${dataBase}/cube/hh_z10_px_128.tif`], { blockSize: 65536 }, truthCube],
  ['cube px128, blockSize 16384', [`${dataBase}/cube/hh_z10_px_128.tif`], { blockSize: 16384 }, truthCube],
  ['cube px256, default', [`${dataBase}/cube/hh_z10_px_256.tif`], undefined, truthCube],
  ['cube band256, default', [`${dataBase}/cube/hh_z10_band_256.tif`], undefined, truthCube],
  ['11 single-band z10 COGs, default', single.files.map((f) => `${dataBase}/${f}`), undefined, single.points.floods_mid_series.values],
  ['11 single-band z10 COGs, blockSize 65536', single.files.map((f) => `${dataBase}/${f}`), { blockSize: 65536 }, single.points.floods_mid_series.values],
  ['11 per-date z12 display COGs, default', perdate.files.map((f) => `${dataBase}/${f}`), undefined, perdate.points.floods_mid_series.values],
  ['11 per-date z12 display COGs, blockSize 65536', perdate.files.map((f) => `${dataBase}/${f}`), { blockSize: 65536 }, perdate.points.floods_mid_series.values],
];
for (const throttle of [null, { latency: 50, mbit: 10 }]) {
  if (throttle) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: throttle.latency, downloadThroughput: (throttle.mbit * 1e6) / 8, uploadThroughput: (throttle.mbit * 1e6) / 8 });
  const rows = [];
  for (const [name, urls, opts, truth] of scenarios) {
    const times = []; let m;
    for (let i = 0; i < 3; i++) {
      m = await measured(() => page.evaluate(([u, lon, lat, o]) => window.tests.pixelSeries(u, lon, lat, o), [urls, P1.lon, P1.lat, opts]));
      times.push(m.result.ms);
    }
    times.sort((a, b) => a - b);
    rows.push(`${name.padEnd(46)} requests=${String(m.requests).padStart(3)} bytes=${String(m.bytes).padStart(8)} median_ms=${String(times[1]).padStart(7)} valuesCorrect=${m.result.ok && eq(m.result.values, truth)} ${m.result.error ?? ''}`);
  }
  log(`cold pixel time series in Chrome, ${throttle ? `throttled: ${throttle.latency} ms latency, ${throttle.mbit} Mbit/s` : 'unthrottled localhost'}`, rows.join('\n'));
}
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// 5. decoders in the browser (cross-origin files), without and with the worker Pool
const names = ['rc_raw_512', 'rc_deflate_512_pred2', 'rc_deflate_512_nopred', 'rc_zstd_512_pred2', 'rc_lzw_512_pred2', 'rc_jpeg_q75_512', 'rc_lerc_512',
  'rc_lerc_zstd_512', 'rc_lerc_zstd_512_maxz2', 'rc_packbits_512', 'rc_webp_lossless_512_rgb', 'gd_webp_lossless_512_rgb', 'rc_deflate_256_pred2'];
for (const usePool of [false, true]) {
  const rows = [];
  for (const n of names) {
    const rec = manifest.find((r) => r.name === n);
    const r = await page.evaluate(([u, s, p]) => window.tests.decodeVariant(u, s, p), [`${dataBase}/variants/${n}.tif`, rec.sha256_band1_full, usePool]);
    rows.push(`${n.padEnd(28)} ${r.ok ? `decoded ${r.size.join('x')} in ${String(r.ms).padStart(5)} ms; identical to GDAL decode: ${r.identical}; nonzero px ${r.nonZero}` : `FAIL ${r.error}`}`);
  }
  log(`decode full-res band 1 in Chrome, ${usePool ? 'with new Pool() (web workers)' : 'main thread (no pool)'}`, rows.join('\n'));
}
log('console errors', consoleErrors);
await browser.close();
await writeFile(path.join(here, '..', 'work', `browser_test_${label}.json`), JSON.stringify(out, null, 1));
````

---

## Appendix C. Raw evidence logs, verbatim

The compact logs behind the tables above, in case the scratch folder is gone. All from attempt 3
(`COG/work/logs/`).

### `work/logs/step1_versions.log`

Source: `<scratch>/verify/cog/work/logs/step1_versions.log` (37 lines). Versions and drivers.

````text
<stdin>:5: DeprecationWarning: The '__version__' attribute is deprecated and will be removed in Click 9.1. Use feature detection or 'importlib.metadata.version("click")' instead.
<stdin>:19: UserWarning: Non-standard compression schema: zstd. The output COG might not be fully supported by software not build against latest libtiff.
<stdin>:19: UserWarning: Non-standard compression schema: webp. The output COG might not be fully supported by software not build against latest libtiff.
<stdin>:19: UserWarning: Non-standard compression schema: lerc. The output COG might not be fully supported by software not build against latest libtiff.
<stdin>:19: UserWarning: Non-standard compression schema: lerc_zstd. The output COG might not be fully supported by software not build against latest libtiff.
python 3.12.2 macOS-26.6.2-arm64-arm-64bit arm64
numpy        2.5.4
scipy        1.18.1
rasterio     1.5.2
rio_cogeo    7.0.4
morecantile  7.1.0
affine       3.0.1
pyproj       3.8.0
click        8.5.1
pydantic     2.14.3
GDAL (bundled in rasterio wheel): 3.12.2
PROJ: 9.8.1  GEOS: 0.0.0
  driver GTiff : GeoTIFF
  driver COG   : Cloud optimized GeoTIFF generator
  driver MEM   : In Memory raster, vector and multidimensional raster
  driver VRT   : Virtual Raster
  driver PNG   : Portable Network Graphics
  driver JPEG  : JPEG JFIF
  driver WEBP  : WEBP
  driver HDF5  : Hierarchical Data Format Release 5
  driver netCDF: Network Common Data Format
  driver Zarr  : Zarr
rasterio.enums.Compression: ['JPEG', 'LZW', 'PACKBITS', 'DEFLATE', 'CCITTRLE', 'CCITTFAX3', 'CCITTFAX4', 'LZMA', 'NONE', 'ZSTD', 'LERC', 'LERC_DEFLATE', 'LERC_ZSTD', 'WEBP', 'JPEG2000']
rio-cogeo profiles: ['deflate', 'jpeg', 'lerc', 'lerc_deflate', 'lerc_zstd', 'lzma', 'lzw', 'packbits', 'raw', 'webp', 'zstd']
  cog_profiles.get('deflate') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'DEFLATE'}
  cog_profiles.get('zstd') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'ZSTD'}
  cog_profiles.get('lzw') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'LZW'}
  cog_profiles.get('webp') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'WEBP'}
  cog_profiles.get('jpeg') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'JPEG', 'photometric': 'YCbCr'}
  cog_profiles.get('lerc') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'LERC'}
  cog_profiles.get('lerc_zstd') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'LERC_ZSTD'}
  cog_profiles.get('raw') = {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512}
````

### `work/logs/step2a_smoke.log`

Source: `<scratch>/verify/cog/work/logs/step2a_smoke.log` (29 lines). One scene through both writers.

````text
scene 1.16s  multilook 0.29s  to_dn 0.07s
multilooked shape (3250, 3500) dn dtype uint8 nodata frac 0.16539173626373627 dn min/max over valid 25 239
transform (40 m): (40.0, 0.0, 330000.0, 0.0, -40.0, 1495000.0)
src profile: {'driver': 'GTiff', 'dtype': 'uint8', 'nodata': 0.0, 'width': 3500, 'height': 3250, 'count': 1, 'crs': 'EPSG:32648', 'transform': '| 40.00, 0.00, 330000.00|\n| 0.00,-40.00, 1495000.00|\n| 0.00, 0.00, 1.00|', 'blockxsize': 3500, 'blockysize': 2, 'tiled': False, 'interleave': 'band'}

== riocogeo_deflate_512_p2.tif: 9.46 MB in 0.51s
  crs EPSG:3857 size 4096 3840 count 1 dtype ('uint8',) nodata 0.0
  transform (38.21851414258813, 0.0, 11505912.99371101, 0.0, -38.21851414258813, 1526294.5807983987)
  block [(512, 512)] overviews [2, 4, 8]
  compression Compression.deflate interleave Interleaving.band IMAGE_STRUCTURE {'LAYOUT': 'COG', 'COMPRESSION': 'DEFLATE', 'INTERLEAVE': 'BAND', 'PREDICTOR': '2'}
  tags {'OVERVIEW_RESAMPLING': 'AVERAGE', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '12', 'AREA_OR_POINT': 'Area'}
  mask_flags ([<MaskFlags.nodata: 8>],) colorinterp (<ColorInterp.gray: 1>,)
  origin in 256px tile units: x=3224.000000 y=1892.000000
  origin in 512px tile units: x=1612.000000 y=946.000000
  valid frac 0.7006649017333985 mean DN valid 151.26915043646815
  cog_validate: True [] []

== gdalcog_deflate_512_p2.tif: 9.46 MB in 0.32s
  crs EPSG:3857 size 4096 4096 count 1 dtype ('uint8',) nodata 0.0
  transform (38.21851414258813, 0.0, 11505912.993711011, 0.0, -38.21851414258813, 1526294.5807983994)
  block [(512, 512)] overviews [2, 4, 8]
  compression Compression.deflate interleave Interleaving.band IMAGE_STRUCTURE {'LAYOUT': 'COG', 'COMPRESSION': 'DEFLATE', 'INTERLEAVE': 'BAND', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'PREDICTOR': '2'}
  tags {'AREA_OR_POINT': 'Area'}
  mask_flags ([<MaskFlags.nodata: 8>],) colorinterp (<ColorInterp.gray: 1>,)
  origin in 256px tile units: x=3224.000000 y=1892.000000
  origin in 512px tile units: x=1612.000000 y=946.000000
  valid frac 0.6568735241889954 mean DN valid 151.26913929293102
  cog_validate: True [] []
./venv/bin/python step2a_smoke.py  3.93s user 1.08s system 146% cpu 3.415 total
````

### `work/logs/step2b_table.log`

Source: `<scratch>/verify/cog/work/logs/step2b_table.log` (56 lines). Creation-option comparison (the `gd_*` rows are the GDAL COG driver; `v2n`/`n2v` = valid-to-nodata / nodata-to-valid pixel counts against the raw rio-cogeo file).

````text
name                                      MB  ratio write_s ifd nodata mask       pred lossless_vs_raw              warnings
rc_raw_256                             21.31  1.000    0.47   5    0.0 nodata     -    identical                    
rc_deflate_256_nopred                  10.75  0.505    0.49   5    0.0 nodata     -    identical                    
rc_deflate_256_pred2                    9.52  0.447    0.50   5    0.0 nodata     2    identical                    
rc_zstd_256_nopred                     11.17  0.524    0.52   5    0.0 nodata     -    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_zstd_256_pred2                       8.71  0.409    0.57   5    0.0 nodata     2    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_lzw_256_nopred                      12.23  0.574    0.46   5    0.0 nodata     -    identical                    
rc_lzw_256_pred2                       10.93  0.513    0.48   5    0.0 nodata     2    identical                    
rc_webp_lossless_256_1band           WRITE FAILED: CPLE_AppDefinedError: WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.
rc_webp_lossless_256_rgb                8.01  0.376    1.94   5    0.0 nodata     -    identical                    Non-standard compression schema: webp. The output COG might not be ful
rc_jpeg_q75_256                         1.87  0.088    0.51   5   None per_dataset -    maxabs=54 rmse=3.4888 v2n=0 n2v=22869 Nodata/Alpha band will be translated to an internal mask band.; PHOTOMETRIC=YCBCR not supported on a 1-band raster and has been set to
rc_jpeg_q90_256                         3.54  0.166    0.54   5   None per_dataset -    maxabs=18 rmse=2.5555 v2n=0 n2v=20757 Nodata/Alpha band will be translated to an internal mask band.; PHOTOMETRIC=YCBCR not supported on a 1-band raster and has been set to
rc_lerc_256                             9.01  0.423    0.49   5    0.0 nodata     -    identical                    Non-standard compression schema: lerc. The output COG might not be ful
rc_lerc_zstd_256                        8.83  0.414    0.50   5    0.0 nodata     -    identical                    Non-standard compression schema: lerc_zstd. The output COG might not b
rc_packbits_256                        14.96  0.702    0.46   5    0.0 nodata     -    identical                    
rc_raw_512                             22.28  1.000    0.52   4    0.0 nodata     -    identical                    
rc_deflate_512_nopred                  10.90  0.489    0.51   4    0.0 nodata     -    identical                    
rc_deflate_512_pred2                    9.46  0.425    0.51   4    0.0 nodata     2    identical                    
rc_zstd_512_nopred                     11.32  0.508    0.49   4    0.0 nodata     -    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_zstd_512_pred2                       8.75  0.392    0.51   4    0.0 nodata     2    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_lzw_512_nopred                      12.43  0.558    0.49   4    0.0 nodata     -    identical                    
rc_lzw_512_pred2                       10.86  0.487    0.59   4    0.0 nodata     2    identical                    
rc_webp_lossless_512_1band           WRITE FAILED: CPLE_AppDefinedError: WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.
rc_webp_lossless_512_rgb                7.96  0.357    2.66   4    0.0 nodata     -    identical                    Non-standard compression schema: webp. The output COG might not be ful
rc_jpeg_q75_512                         1.84  0.083    0.51   4   None per_dataset -    maxabs=54 rmse=3.4888 v2n=0 n2v=22869 Nodata/Alpha band will be translated to an internal mask band.; PHOTOMETRIC=YCBCR not supported on a 1-band raster and has been set to
rc_jpeg_q90_512                         3.51  0.158    0.56   4   None per_dataset -    maxabs=18 rmse=2.5555 v2n=0 n2v=20757 Nodata/Alpha band will be translated to an internal mask band.; PHOTOMETRIC=YCBCR not supported on a 1-band raster and has been set to
rc_lerc_512                             9.31  0.418    0.51   4    0.0 nodata     -    identical                    Non-standard compression schema: lerc. The output COG might not be ful
rc_lerc_zstd_512                        8.92  0.400    0.50   4    0.0 nodata     -    identical                    Non-standard compression schema: lerc_zstd. The output COG might not b
rc_packbits_512                        14.91  0.669    0.51   4    0.0 nodata     -    identical                    
rc_deflate_512_pred2_z9                 9.45  0.424    0.66   4    0.0 nodata     2    identical                    
rc_deflate_512_pred2_z12                9.45  0.424    0.52   4    0.0 nodata     2    identical                    
rc_deflate_256_pred2_z9                 9.51  0.446    0.51   5    0.0 nodata     2    identical                    
rc_zstd_512_pred2_l19                   8.65  0.388    1.34   4    0.0 nodata     2    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_zstd_512_pred2_l22                   8.63  0.387    8.51   4    0.0 nodata     2    identical                    Non-standard compression schema: zstd. The output COG might not be ful
rc_lerc_512_maxz1                       9.21  0.413    0.53   4    0.0 nodata     -    maxabs=1 rmse=0.7018         Non-standard compression schema: lerc. The output COG might not be ful
rc_lerc_512_maxz2                       7.48  0.336    0.46   4    0.0 nodata     -    maxabs=2 rmse=1.2162         Non-standard compression schema: lerc. The output COG might not be ful
rc_lerc_zstd_512_maxz2                  6.48  0.291    0.47   4    0.0 nodata     -    maxabs=2 rmse=1.2162         Non-standard compression schema: lerc_zstd. The output COG might not b
rc_jpeg_q75_512_mask                    1.84  0.083    0.49   4   None per_dataset -    maxabs=54 rmse=3.4888 v2n=0 n2v=22869 PHOTOMETRIC=YCBCR not supported on a 1-band raster and has been set to
rc_deflate_512_pred2_nearest            9.78  0.439    0.31   4    0.0 nodata     2    maxabs=98 rmse=4.1247        
rc_deflate_512_pred2_cubic              9.83  0.441    0.79   4    0.0 nodata     2    maxabs=18 rmse=1.3414        
rc_deflate_512_pred2_single_thread      9.46  0.425    0.83   4    0.0 nodata     2    identical                    
gd_deflate_256_pred                     9.52  0.447    0.31   5    0.0 nodata     2    maxabs=172 rmse=0.0396 v2n=0 n2v=3 
gd_deflate_256_nopred                  10.75  0.505    0.34   5    0.0 nodata     -    maxabs=172 rmse=0.0396 v2n=0 n2v=3 
gd_zstd_256_pred                        8.71  0.409    0.34   5    0.0 nodata     2    maxabs=172 rmse=0.0396 v2n=0 n2v=3 
gd_lzw_256_pred                        10.93  0.513    0.27   5    0.0 nodata     2    maxabs=172 rmse=0.0396 v2n=0 n2v=3 
gd_jpeg_q75_256                         1.84  0.087    0.26   5    0.0 nodata     -    maxabs=156 rmse=3.4889 v2n=0 n2v=22863 
gd_webp_lossless_256_1band              0.00  0.000    0.24   5    0.0 nodata     -    maxabs=235 rmse=153.0177 v2n=11020506 n2v=0 
gd_webp_lossless_256_rgb                7.52  0.353    1.62   5    0.0 nodata     -    maxabs=172 rmse=0.0333 v2n=0 n2v=3 
gd_deflate_512_pred                     9.46  0.425    0.32   4    0.0 nodata     2    maxabs=172 rmse=- (common rows) 
gd_deflate_512_nopred                  10.90  0.489    0.32   4    0.0 nodata     -    maxabs=172 rmse=- (common rows) 
gd_zstd_512_pred                        8.74  0.392    0.35   4    0.0 nodata     2    maxabs=172 rmse=- (common rows) 
gd_lzw_512_pred                        10.86  0.487    0.28   4    0.0 nodata     2    maxabs=172 rmse=- (common rows) 
gd_jpeg_q75_512                         1.82  0.082    0.27   4    0.0 nodata     -    maxabs=156 rmse=- (common rows) 
gd_webp_lossless_512_1band              0.00  0.000    0.26   4    0.0 nodata     -    maxabs=235 rmse=- (common rows) 
gd_webp_lossless_512_rgb                7.46  0.335    1.70   4    0.0 nodata     -    maxabs=172 rmse=- (common rows) 
gd_deflate_512_pred_z9                  9.45  0.424    0.33   4    0.0 nodata     2    maxabs=172 rmse=- (common rows) 
````

### `work/logs/step2d_webp_1band.log`

Source: `<scratch>/verify/cog/work/logs/step2d_webp_1band.log` (15 lines). Single-band WEBP in fresh processes.

````text
  15 ERROR 1: WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.
  15 ERROR 1: Error when compressing strip/tile N
   1 [riocogeo] file exists: 1308 bytes, 1536x1536, valid px (DN>0) = 0 of source valid 1048576
   1 [riocogeo] NO EXCEPTION RAISED
   1 <scratch>/verify/cog/pipeline.py:82: UserWarning: Non-standard compression schema: webp. The output COG might not be fully supported by software not build against latest libtiff.
   1   profile = cog_profiles.get(compress)                # returns a copy

  15 ERROR 1: WebPSetupEncode:WEBP driver doesn't support 1 bands. Must be 3 (RGB) or 4 (RGBA) bands.
  15 ERROR 1: Error when compressing strip/tile N
   1 [gdalcog] file exists: 1356 bytes, 1536x1536, valid px (DN>0) = 0 of source valid 1048576
   1 [gdalcog] NO EXCEPTION RAISED

   1 [gtiff] file exists: 542 bytes, 1024x1024, valid px (DN>0) = 0 of source valid 1048576
   1 [gtiff] RAISED RasterioIOError: Write failed. See previous exception for details.

````

### `work/logs/step2e_summary.log`

Source: `<scratch>/verify/cog/work/logs/step2e_summary.log` (60 lines). Decoder support by codec and geotiff.js version.

````text
NONE
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (2 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (2 files)
    geotiff 2.1.3            OK bit-identical to GDAL (2 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (2 files)
DEFLATE
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (4 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (4 files)
    geotiff 2.1.3            OK bit-identical to GDAL (4 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (4 files)
DEFLATE+PREDICTOR=2
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (11 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (11 files)
    geotiff 2.1.3            OK bit-identical to GDAL (11 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (11 files)
ZSTD
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (2 files)
    geotiff 1.0.0-beta.13    FAIL: Unknown compression method identifier: 50000 (2 files)
    geotiff 2.1.3            FAIL: Unknown compression method identifier: 50000 (2 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (2 files)
ZSTD+PREDICTOR=2
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (6 files)
    geotiff 1.0.0-beta.13    FAIL: Unknown compression method identifier: 50000 (6 files)
    geotiff 2.1.3            FAIL: Unknown compression method identifier: 50000 (6 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (6 files)
LZW
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (2 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (2 files)
    geotiff 2.1.3            OK bit-identical to GDAL (2 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (2 files)
LZW+PREDICTOR=2
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (4 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (4 files)
    geotiff 2.1.3            OK bit-identical to GDAL (4 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (4 files)
WEBP
    geotiff 3.0.5 (latest)   FAIL: Cannot decode WebImage as `createImageBitmap` is not availab (6 files)
    geotiff 1.0.0-beta.13    FAIL: Unknown compression method identifier: 50001 (6 files)
    geotiff 2.1.3            FAIL: Cannot decode WebImage as `createImageBitmap` is not availab (6 files)
    geotiff 3.1.0-beta.0     FAIL: Cannot decode WebImage as `createImageBitmap` is not availab (6 files)
JPEG
    geotiff 3.0.5 (latest)   OK decodes, max |diff| vs GDAL = 1 DN (7 files)
    geotiff 1.0.0-beta.13    OK decodes, max |diff| vs GDAL = 1 DN (7 files)
    geotiff 2.1.3            OK decodes, max |diff| vs GDAL = 1 DN (7 files)
    geotiff 3.1.0-beta.0     OK decodes, max |diff| vs GDAL = 1 DN (7 files)
LERC
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (4 files)
    geotiff 1.0.0-beta.13    FAIL: Unknown compression method identifier: 34887 (4 files)
    geotiff 2.1.3            OK bit-identical to GDAL (4 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (4 files)
LERC_ZSTD
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (3 files)
    geotiff 1.0.0-beta.13    FAIL: Unknown compression method identifier: 34887 (3 files)
    geotiff 2.1.3            OK bit-identical to GDAL (3 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (3 files)
PACKBITS
    geotiff 3.0.5 (latest)   OK bit-identical to GDAL (2 files)
    geotiff 1.0.0-beta.13    OK bit-identical to GDAL (2 files)
    geotiff 2.1.3            OK bit-identical to GDAL (2 files)
    geotiff 3.1.0-beta.0     OK bit-identical to GDAL (2 files)
````

### `work/logs/step3b_make_cubes.log`

Source: `<scratch>/verify/cog/work/logs/step3b_make_cubes.log` (56 lines). Cubes, single-band sets and the 22 per-date COGs.

````text
cube/hh_z10_px_64.tif                     5.42 MB  0.35s [1024, 1024] x11 uint8 blk64 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8, 16] valid=True 
cube/hh_z10_px_128.tif                    5.22 MB  0.34s [1024, 1024] x11 uint8 blk128 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
cube/hh_z10_px_256.tif                    5.13 MB  0.36s [1024, 1024] x11 uint8 blk256 il=PIXEL DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_px_512.tif                    4.89 MB  0.50s [1024, 1024] x11 uint8 blk512 il=PIXEL DEFLATE pred=2 ovr=[2] valid=True 
cube/hh_z10_band_128.tif                  6.42 MB  0.27s [1024, 1024] x11 uint8 blk128 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
cube/hh_z10_band_256.tif                  6.33 MB  0.29s [1024, 1024] x11 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_gd_px_256.tif                 5.13 MB  0.32s [1024, 1024] x11 uint8 blk256 il=PIXEL DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_gd_band_256.tif               6.33 MB  0.23s [1024, 1024] x11 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_gd_tile_256.tif               6.33 MB  0.21s [1024, 1024] x11 uint8 blk256 il=TILE DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_gd_tile_128.tif               1.69 MB  0.14s [512, 512] x11 uint8 blk128 il=TILE DEFLATE pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_px_256_zstd.tif               4.97 MB  0.29s [1024, 1024] x11 uint8 blk256 il=PIXEL ZSTD pred=2 ovr=[2, 4] valid=True 
cube/hh_z10_px_256_nopred.tif             6.62 MB  0.31s [1024, 1024] x11 uint8 blk256 il=PIXEL DEFLATE pred=None ovr=[2, 4] valid=True 
cube/hhhv_z10_px_128.tif                 10.10 MB  0.81s [1024, 1024] x22 uint8 blk128 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
cube/hh_z11_px_128.tif                   23.25 MB  1.18s [2048, 2048] x11 uint8 blk128 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8, 16] valid=True 
cube/hh_z11_px_256.tif                   23.03 MB  1.19s [2048, 2048] x11 uint8 blk256 il=PIXEL DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
cube/hh_z10_f32_px_256.tif               29.81 MB  0.53s [1024, 1024] x11 float32 blk256 il=PIXEL DEFLATE pred=3 ovr=[2, 4] valid=True 
cube/hh_z10_f32_band_256.tif             30.67 MB  0.48s [1024, 1024] x11 float32 blk256 il=BAND DEFLATE pred=3 ovr=[2, 4] valid=True 
single_z10/HH_2026-06-05.tif              0.58 MB  0.05s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-06-17.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-06-29.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-07-11.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-07-23.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-08-04.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-08-16.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-08-28.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-09-09.tif              0.58 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-09-21.tif              0.57 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
single_z10/HH_2026-10-03.tif              0.57 MB  0.04s [1024, 1024] x1 uint8 blk256 il=BAND DEFLATE pred=2 ovr=[2, 4] valid=True 
perdate_z12/HH_2026-06-05.tif             9.46 MB  0.46s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-06-17.tif             9.46 MB  0.46s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-06-29.tif             9.46 MB  0.51s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-07-11.tif             9.46 MB  0.52s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-07-23.tif             9.46 MB  0.51s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-08-04.tif             9.46 MB  0.53s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-08-16.tif             9.46 MB  0.50s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-08-28.tif             9.46 MB  0.47s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-09-09.tif             9.46 MB  0.48s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-09-21.tif             9.46 MB  0.67s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HH_2026-10-03.tif             9.46 MB  0.54s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-06-05.tif             9.46 MB  0.51s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-06-17.tif             9.46 MB  0.54s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-06-29.tif             9.46 MB  0.49s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-07-11.tif             9.46 MB  0.45s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-07-23.tif             9.46 MB  0.50s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-08-04.tif             9.46 MB  0.53s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-08-16.tif             9.46 MB  0.50s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-08-28.tif             9.45 MB  0.46s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-09-09.tif             9.46 MB  0.45s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-09-21.tif             9.45 MB  0.52s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
perdate_z12/HV_2026-10-03.tif             9.45 MB  0.46s [4096, 3840] x1 uint8 blk512 il=BAND DEFLATE pred=2 ovr=[2, 4, 8] valid=True 
floods_mid_series row/col 490 417 DN [161, 157, 154, 185, 194, 194, 64, 65, 66, 64, 65] dB [-9.800000190734863, -10.399999618530273, -10.899999618530273, -6.0, -4.599999904632568, -4.599999904632568, -25.100000381469727, -24.899999618530273, -24.799999237060547, -25.100000381469727, -24.899999618530273]
always_lake row/col 496 508 DN [61, 63, 63, 64, 62, 63, 63, 62, 63, 63, 61] dB [-25.600000381469727, -25.200000762939453, -25.200000762939453, -25.100000381469727, -25.399999618530273, -25.200000762939453, -25.200000762939453, -25.399999618530273, -25.200000762939453, -25.200000762939453, -25.600000381469727]
always_land row/col 203 778 DN [158, 160, 165, 166, 168, 171, 169, 163, 163, 159, 159] dB [-10.300000190734863, -10.0, -9.199999809265137, -9.0, -8.699999809265137, -8.199999809265137, -8.5, -9.5, -9.5, -10.100000381469727, -10.100000381469727]
outside_footprint row/col 51 54 DN [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] dB [nan, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan]
per-date z12 set: 208.1 MB in 22 files; single_z10 set: 6.34 MB
./venv/bin/python step3b_make_cubes.py  49.12s user 6.46s system 156% cpu 35.500 total
````

### `work/logs/step4_range_servers.log`

Source: `<scratch>/verify/cog/work/logs/step4_range_servers.log` (93 lines). curl range probes of every local server.

````text
date: 2026-11-14T07:56:42Z   curl: curl 8.9.1 (arm64-apple-darwin20.0.0) libcurl/8.9.1 OpenSSL/3.6.2 zlib/1.2.13 libssh2/1.11.0 nghttp2/1.57.0

=================== python3 -m http.server (Python 3.12.2) (port 18732)
cmd: /opt/anaconda3/bin/python3 -m http.server 18732 --bind 127.0.0.1
--- python http.server  http://127.0.0.1:18732/cube/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.0 200 OK | body=5221660B | Content-Range=[] | Content-Length=[5221660] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.0 200 OK | body=5221660B | Content-Range=[] | Content-Length=[5221660] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.0 200 OK | body=5221660B | Content-Range=[] | Content-Length=[5221660] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.0 200 OK | body=5221660B | Content-Range=[] | Content-Length=[5221660] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.0 200 OK | body=5221660B | Content-Encoding=[] | Content-Range=[]
  GET  (no Range)                    -> HTTP/1.0 200 OK | body=5221660B | Accept-Ranges=[] | Cache-Control=[] | ETag=[]
  HEAD                               -> HTTP/1.0 200 OK | Accept-Ranges=[] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: NO (got 5221660 bytes)

=================== python -m RangeHTTPServer (Version: 1.4.0) (port 18736)
cmd: <scratch>/verify/cog/venv/bin/python -m RangeHTTPServer 18736 --bind 127.0.0.1
--- python RangeHTTPServer  http://127.0.0.1:18736/cube/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.0 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.0 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.0 400 Invalid byte range | body=350B | Content-Range=[] | Content-Length=[350] | Content-Type=[text/html;charset=utf-8]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.0 400 Invalid byte range | body=350B | Content-Range=[] | Content-Length=[350] | Content-Type=[text/html;charset=utf-8]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.0 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.0 200 OK | body=5221660B | Accept-Ranges=[bytes] | Cache-Control=[] | ETag=[]
  HEAD                               -> HTTP/1.0 200 OK | Accept-Ranges=[bytes] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes

=================== serve 14.2.8 (port 18733)
cmd: <scratch>/verify/cog/node/node_modules/.bin/serve -l tcp://127.0.0.1:18733 --no-clipboard <scratch>/verify/cog/work/site
--- serve  http://127.0.0.1:18733/cube/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 5221560-5221659/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[bytes] | Cache-Control=[] | ETag=["b6139732a6c1ff08423b3c1a7cdc0db6897f78b0"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[bytes] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes

=================== http-server 14.1.1 (default flags) (port 18737)
cmd: <scratch>/verify/cog/node/node_modules/.bin/http-server <scratch>/verify/cog/work/site -p 18737 -a 127.0.0.1
--- http-server  http://127.0.0.1:18737/cube/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 416 Range Not Satisfiable | body=0B | Content-Range=[] | Content-Length=[0] | Content-Type=[]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[bytes] | Cache-Control=[max-age=3600] | ETag=[W/"159781019-5221660-2026-11-14T07:52:42.701Z"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[bytes] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes

=================== vite 8.3.8 dev server (port 18734)
cmd: <scratch>/verify/cog/node/node_modules/.bin/vite --port 18734 --strictPort --host 127.0.0.1
--- vite dev, file in public/  http://127.0.0.1:18734/data/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 206 Partial Content | body=101B | Content-Range=[bytes 0-100/5221660] | Content-Length=[101] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[] | Cache-Control=[no-cache] | ETag=[W/"5221660-1794642991927"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes
--- vite dev, file under src/ (path returned by import x from './assets/cube_in_src.tif?url')  http://127.0.0.1:18734/src/assets/cube_in_src.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 206 Partial Content | body=101B | Content-Range=[bytes 0-100/5221660] | Content-Length=[101] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[] | Cache-Control=[no-cache] | ETag=[W/"5221660-1794642991949"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes

=================== vite 8.3.8 preview (port 18735)
cmd: <scratch>/verify/cog/node/node_modules/.bin/vite preview --port 18735 --strictPort --host 127.0.0.1
--- vite preview, file copied from public/  http://127.0.0.1:18735/data/hh_z10_px_128.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 206 Partial Content | body=101B | Content-Range=[bytes 0-100/5221660] | Content-Length=[101] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[] | Cache-Control=[no-cache] | ETag=[W/"5221660-1794642992613"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes
--- vite preview, hashed build asset  http://127.0.0.1:18735/assets/cube_in_src-BVcd_Wqe.tif
  GET  Range: bytes=0-1023           -> HTTP/1.1 206 Partial Content | body=1024B | Content-Range=[bytes 0-1023/5221660] | Content-Length=[1024] | Content-Type=[image/tiff]
  GET  Range: bytes=1000000-1000099  -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 1000000-1000099/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range: bytes=-100             -> HTTP/1.1 206 Partial Content | body=101B | Content-Range=[bytes 0-100/5221660] | Content-Length=[101] | Content-Type=[image/tiff]
  GET  Range: bytes=0-99,200-299     -> HTTP/1.1 206 Partial Content | body=100B | Content-Range=[bytes 0-99/5221660] | Content-Length=[100] | Content-Type=[image/tiff]
  GET  Range 0-1023 + Accept-Encoding: gzip   -> HTTP/1.1 206 Partial Content | body=1024B | Content-Encoding=[] | Content-Range=[bytes 0-1023/5221660]
  GET  (no Range)                    -> HTTP/1.1 200 OK | body=5221660B | Accept-Ranges=[] | Cache-Control=[no-cache] | ETag=[W/"5221660-1794642992637"]
  HEAD                               -> HTTP/1.1 200 OK | Accept-Ranges=[] | Content-Length=[5221660] | ACAO=[]
  bytes 1000000-1000099 identical to file on disk: yes

done
````

### `work/logs/step4b_geotiff_vs_servers.log`

Source: `<scratch>/verify/cog/work/logs/step4b_geotiff_vs_servers.log` (35 lines). geotiff.js against every local server.

````text
--- geotiff.js vs python3 -m http.server (3.12.2): http://127.0.0.1:18732/cube/hh_z10_px_128.tif
  fromUrl(url, {})                                         ERROR Error: Server responded with full file | 1 requests, statuses 200, 0 bytes
  fromUrl(url, {"blockSize":65536})                        ERROR AggregateError: Request failed | 1 requests, statuses 200, 0 bytes
  fromUrl(url, {"allowFullFile":true})                     ERROR RangeError: Invalid field type: 192 | 2 requests, statuses 200, 10443320 bytes
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 200, 15664980 bytes, 55 ms
--- geotiff.js vs python -m RangeHTTPServer 1.4.0: http://127.0.0.1:18736/cube/hh_z10_px_128.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 52 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 23 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 15 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 22 ms
--- geotiff.js vs serve 14.2.8: http://127.0.0.1:18733/cube/hh_z10_px_128.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 62 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 24 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 14 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 22 ms
--- geotiff.js vs http-server 14.1.1: http://127.0.0.1:18737/cube/hh_z10_px_128.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 54 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 23 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 15 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 23 ms
--- geotiff.js vs vite 8.3.8 dev (public/): http://127.0.0.1:18734/data/hh_z10_px_128.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 52 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 23 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 13 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 22 ms
--- geotiff.js vs vite 8.3.8 dev (src/assets): http://127.0.0.1:18734/src/assets/cube_in_src.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 53 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 24 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 21 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 22 ms
--- geotiff.js vs vite 8.3.8 preview: http://127.0.0.1:18735/data/hh_z10_px_128.tif
  fromUrl(url, {})                                         OK, values correct | 12 requests, statuses 206, 164312 bytes, 67 ms
  fromUrl(url, {"blockSize":65536})                        OK, values correct | 3 requests, statuses 206, 393216 bytes, 28 ms
  fromUrl(url, {"allowFullFile":true})                     OK, values correct | 12 requests, statuses 206, 164312 bytes, 17 ms
  fromUrl(url, {"allowFullFile":true,"blockSize":65536})   OK, values correct | 3 requests, statuses 206, 393216 bytes, 27 ms
````

### `work/logs/step5_sizes.log`

Source: `<scratch>/verify/cog/work/logs/step5_sizes.log` (21 lines). Size of the 22-file set per zoom and codec.

````text
z13 (1x1 looks=  4,   19.11 m) deflate_pred2_512                          total    927.0 MB (HH 463.6, HV 463.4) mean/file  42.14 MB [7936, 7168] valid=44071347 B/validpx=0.956 write  48.9s
z13 (1x1 looks=  4,   19.11 m) deflate_pred2_256                          total    929.2 MB (HH 464.7, HV 464.5) mean/file  42.24 MB [7936, 7168] valid=44071347 B/validpx=0.958 write  54.7s
z13 (1x1 looks=  4,   19.11 m) zstd_pred2_512                             total    899.0 MB (HH 449.6, HV 449.4) mean/file  40.86 MB [7936, 7168] valid=44071347 B/validpx=0.927 write  46.8s
z13 (1x1 looks=  4,   19.11 m) lerc_zstd_maxz2_512 (lossy, |err|<=2 DN)   total    637.4 MB (HH 319.1, HV 318.3) mean/file  28.97 MB [7936, 7168] valid=44071347 B/validpx=0.657 write  44.4s
z13 (1x1 looks=  4,   19.11 m) jpeg_q75_512 (lossy, internal mask)        total    217.7 MB (HH 109.1, HV 108.6) mean/file   9.90 MB [7936, 7168] valid=44071347 B/validpx=0.225 write  51.0s
z12 (2x2 looks= 16,   38.22 m) deflate_pred2_512                          total    208.1 MB (HH 104.1, HV 104.0) mean/file   9.46 MB [4096, 3840] valid=11020506 B/validpx=0.858 write  13.0s
z12 (2x2 looks= 16,   38.22 m) deflate_pred2_256                          total    209.4 MB (HH 104.7, HV 104.7) mean/file   9.52 MB [4096, 3840] valid=11020506 B/validpx=0.864 write  11.5s
z12 (2x2 looks= 16,   38.22 m) zstd_pred2_512                             total    192.4 MB (HH 96.2, HV 96.2) mean/file   8.75 MB [4096, 3840] valid=11020506 B/validpx=0.794 write  12.2s
z12 (2x2 looks= 16,   38.22 m) lerc_zstd_maxz2_512 (lossy, |err|<=2 DN)   total    142.4 MB (HH 71.3, HV 71.1) mean/file   6.47 MB [4096, 3840] valid=11020506 B/validpx=0.587 write  11.6s
z12 (2x2 looks= 16,   38.22 m) jpeg_q75_512 (lossy, internal mask)        total     40.2 MB (HH 20.2, HV 20.0) mean/file   1.83 MB [4096, 3840] valid=11020506 B/validpx=0.166 write  11.8s
z11 (4x4 looks= 64,   76.44 m) deflate_pred2_512                          total     48.9 MB (HH 24.5, HV 24.5) mean/file   2.22 MB [2048, 2048] valid=2756349 B/validpx=0.807 write   3.5s
z11 (4x4 looks= 64,   76.44 m) deflate_pred2_256                          total     49.9 MB (HH 25.0, HV 25.0) mean/file   2.27 MB [2048, 2048] valid=2756349 B/validpx=0.823 write   3.3s
z11 (4x4 looks= 64,   76.44 m) zstd_pred2_512                             total     45.5 MB (HH 22.8, HV 22.7) mean/file   2.07 MB [2048, 2048] valid=2756349 B/validpx=0.75 write   3.3s
z11 (4x4 looks= 64,   76.44 m) lerc_zstd_maxz2_512 (lossy, |err|<=2 DN)   total     34.3 MB (HH 17.2, HV 17.1) mean/file   1.56 MB [2048, 2048] valid=2756349 B/validpx=0.566 write   3.0s
z11 (4x4 looks= 64,   76.44 m) jpeg_q75_512 (lossy, internal mask)        total     10.2 MB (HH 5.1, HV 5.1) mean/file   0.46 MB [2048, 2048] valid=2756349 B/validpx=0.168 write   3.2s
z10 (8x8 looks=256,  152.87 m) deflate_pred2_512                          total     11.9 MB (HH 5.9, HV 5.9) mean/file   0.54 MB [1024, 1024] valid=689446 B/validpx=0.783 write   1.2s
z10 (8x8 looks=256,  152.87 m) deflate_pred2_256                          total     12.7 MB (HH 6.3, HV 6.3) mean/file   0.58 MB [1024, 1024] valid=689446 B/validpx=0.835 write   1.0s
z10 (8x8 looks=256,  152.87 m) zstd_pred2_512                             total     11.1 MB (HH 5.5, HV 5.5) mean/file   0.50 MB [1024, 1024] valid=689446 B/validpx=0.73 write   1.1s
z10 (8x8 looks=256,  152.87 m) lerc_zstd_maxz2_512 (lossy, |err|<=2 DN)   total      8.5 MB (HH 4.2, HV 4.2) mean/file   0.38 MB [1024, 1024] valid=689446 B/validpx=0.558 write   1.0s
z10 (8x8 looks=256,  152.87 m) jpeg_q75_512 (lossy, internal mask)        total      2.7 MB (HH 1.3, HV 1.3) mean/file   0.12 MB [1024, 1024] valid=689446 B/validpx=0.176 write   1.0s
./venv/bin/python step5_sizes.py  413.03s user 61.19s system 144% cpu 5:28.31 total
````

### `work/logs/step3c_latency0.log` (SUMMARY section only)

Source: `<scratch>/verify/cog/work/logs/step3c_latency0.log`. Simulated latency 0 ms per request. Columns: cold requests, cold bytes, cold ms, then second pixel in another tile as requests/bytes/ms.

````text
SUMMARY (cold = fromUrl + getImage + 1 pixel across all dates)
label                                                            opts                  req     bytes      ms  | 2nd px req/bytes/ms  | values ok
CUBE cube/hh_z10_px_64.tif                                       {}                      9     28038     5.6  | 3/23293/2.3            | true
CUBE cube/hh_z10_px_128.tif                                      {}                      9     94409     6.1  | 3/69903/3.7            | true
CUBE cube/hh_z10_px_256.tif                                      {}                      9    373864    12.8  | 3/112102/6             | true
CUBE cube/hh_z10_px_512.tif                                      {}                      9   1103750    30.3  | 3/980201/25.8          | true
CUBE cube/hh_z10_band_128.tif                                    {}                     39     96865    12.9  | 33/85328/8.2           | true
CUBE cube/hh_z10_band_256.tif                                    {}                     39    428843    20.3  | 33/134049/11.4         | true
CUBE cube/hh_z10_gd_px_256.tif                                   {}                      9    373832    16.3  | 3/112102/7             | true
CUBE cube/hh_z10_gd_band_256.tif                                 {}                     39    428832    19.3  | 33/134049/12.1         | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {}                     39    428832    15.2  | 33/134049/9.8          | true
CUBE cube/hh_z10_px_256_zstd.tif                                 {}                      9    363927     7.7  | 3/105377/3.9           | true
CUBE cube/hhhv_z10_px_128.tif                                    {}                      9    184894     6.6  | 3/135668/4.2           | true
CUBE cube/hh_z11_px_128.tif                                      {}                      9    108261     5.4  | 3/102626/3.6           | true
CUBE cube/hh_z11_px_256.tif                                      {}                      9    404255    12.5  | 3/305086/9.3           | true
CUBE cube/hh_z10_f32_px_256.tif                                  {}                      9   2135474    43.6  | 3/591502/25.8          | true
CUBE cube/hh_z10_f32_band_256.tif                                {}                     39   2161412    63.9  | 33/625580/40.8         | true
CUBE cube/hh_z10_px_128.tif                                      {"blockSize":65536}     2    262144    14.4  | 1/131072/6.3           | true
CUBE cube/hh_z10_px_128.tif                                      {"blockSize":16384}     2    131072    14.8  | 1/81920/6.1            | true
CUBE cube/hh_z10_px_256.tif                                      {"blockSize":65536}     2    524288    19.5  | 1/196608/8.9           | true
CUBE cube/hh_z10_px_256.tif                                      {"blockSize":16384}     2    409600    18.9  | 1/114688/8.6           | true
CUBE cube/hh_z10_band_256.tif                                    {"blockSize":65536}    12   1310720    22.1  | 5/327680/9.3           | true
CUBE cube/hh_z10_band_256.tif                                    {"blockSize":16384}    12    655360    20.8  | 11/327680/9.6          | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {"blockSize":65536}     8    589824    20.7  | 3/196608/8.9           | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {"blockSize":16384}    12    458752      22  | 8/147456/9.8           | true
11 SEPARATE single-band COGs (z10, 256 tiles)                    {}                     55    449154    17.6  | 33/134049/10.1         | true
11 SEPARATE single-band COGs (z10, 256 tiles)                    {"blockSize":65536}    22   1441792    21.6  | 11/720896/10.8         | true
11 SEPARATE per-date display COGs (z12, 512 tiles)               {}                     55   1861127    48.4  | 33/1355713/38.5        | true
11 SEPARATE per-date display COGs (z12, 512 tiles)               {"blockSize":65536}    22   3604480    53.3  | 11/2162688/39.2        | true
node step3c_pixel_read.mjs http://127.0.0.1:18731 0  9.79s user 0.47s system 119% cpu 8.558 total
````

### `work/logs/step3c_latency50.log` (SUMMARY section only)

Source: `<scratch>/verify/cog/work/logs/step3c_latency50.log`. Simulated latency 50 ms per request. Columns: cold requests, cold bytes, cold ms, then second pixel in another tile as requests/bytes/ms.

````text
SUMMARY (cold = fromUrl + getImage + 1 pixel across all dates)
label                                                            opts                  req     bytes      ms  | 2nd px req/bytes/ms  | values ok
CUBE cube/hh_z10_px_64.tif                                       {}                      9     28038   471.6  | 3/23293/158            | true
CUBE cube/hh_z10_px_128.tif                                      {}                      9     94409     472  | 3/69903/158.4          | true
CUBE cube/hh_z10_px_256.tif                                      {}                      9    373864   477.8  | 3/112102/161.8         | true
CUBE cube/hh_z10_px_512.tif                                      {}                      9   1103750   493.2  | 3/980201/182.5         | true
CUBE cube/hh_z10_band_128.tif                                    {}                     39     96865   478.3  | 33/85328/163.7         | true
CUBE cube/hh_z10_band_256.tif                                    {}                     39    428843   486.6  | 33/134049/167.9        | true
CUBE cube/hh_z10_gd_px_256.tif                                   {}                      9    373832     483  | 3/112102/160.6         | true
CUBE cube/hh_z10_gd_band_256.tif                                 {}                     39    428832   492.4  | 33/134049/169.1        | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {}                     39    428832   483.5  | 33/134049/170.6        | true
CUBE cube/hh_z10_px_256_zstd.tif                                 {}                      9    363927     472  | 3/105377/158.6         | true
CUBE cube/hhhv_z10_px_128.tif                                    {}                      9    184894   477.1  | 3/135668/163.5         | true
CUBE cube/hh_z11_px_128.tif                                      {}                      9    108261   470.7  | 3/102626/158.6         | true
CUBE cube/hh_z11_px_256.tif                                      {}                      9    404255   480.8  | 3/305086/169.3         | true
CUBE cube/hh_z10_f32_px_256.tif                                  {}                      9   2135474   510.9  | 3/591502/179.4         | true
CUBE cube/hh_z10_f32_band_256.tif                                {}                     39   2161412   522.6  | 33/625580/193.3        | true
CUBE cube/hh_z10_px_128.tif                                      {"blockSize":65536}     2    262144   117.5  | 1/131072/57.3          | true
CUBE cube/hh_z10_px_128.tif                                      {"blockSize":16384}     2    131072   116.5  | 1/81920/57             | true
CUBE cube/hh_z10_px_256.tif                                      {"blockSize":65536}     2    524288   130.4  | 1/196608/60.8          | true
CUBE cube/hh_z10_px_256.tif                                      {"blockSize":16384}     2    409600   122.3  | 1/114688/59.7          | true
CUBE cube/hh_z10_band_256.tif                                    {"blockSize":65536}    12   1310720   126.1  | 5/327680/57.8          | true
CUBE cube/hh_z10_band_256.tif                                    {"blockSize":16384}    12    655360   124.9  | 11/327680/61.4         | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {"blockSize":65536}     8    589824     124  | 3/196608/59.6          | true
CUBE cube/hh_z10_gd_tile_256.tif                                 {"blockSize":16384}    12    458752   123.1  | 8/147456/60.3          | true
11 SEPARATE single-band COGs (z10, 256 tiles)                    {}                     55    449154   273.2  | 33/134049/164.3        | true
11 SEPARATE single-band COGs (z10, 256 tiles)                    {"blockSize":65536}    22   1441792   122.2  | 11/720896/62.5         | true
11 SEPARATE per-date display COGs (z12, 512 tiles)               {}                     55   1861127   305.3  | 33/1355713/191.6       | true
11 SEPARATE per-date display COGs (z12, 512 tiles)               {"blockSize":65536}    22   3604480   153.2  | 11/2162688/90.6        | true
node step3c_pixel_read.mjs http://127.0.0.1:18731 50  11.02s user 0.62s system 13% cpu 1:26.79 total
````

