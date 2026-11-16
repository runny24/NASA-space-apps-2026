# Recovered findings: engineering review of the build brief (Section 6 and Appendix D)

Digest written 2026-11-14 from an interrupted review run. Topic: **engineering**.
Brief that was checked: `<prehackathon-repo>/research/BUILD_PROMPT.md` (851 lines, 58558 bytes; the same file the second run read).

**How to read this file.** Sections 1 to 8 are the digest. Appendices A to C are reference material copied by script, byte for byte, from the scratch folder and the transcripts: A is code that ran, B is the shell commands that ran, C is the printed output. The scratch folder lives under `/private/tmp` and can disappear on a reboot, so everything a builder needs is repeated here.

Evidence labels used throughout:

- **ran**: a saved output, log, or transcript tool result shows it being run and what it printed.
- **docs**: read in a package registry, a README, or a library's source, but not exercised.
- **belief**: asserted or inferred, with no run behind it.

Quoted output in Sections 3 to 7 is word for word, except that runs of spaces and line breaks are collapsed and `...` marks an omission. The unaltered output is in Appendix C.

---

## 1. Sources and how far the run got

| What | Path |
|---|---|
| Scratch folder (run 1 at top level, run 2 under `run2/`) | `<scratch>/review/geo-frontend-engineer` (called `S` below) |
| Transcript, run 1 (2026-11-13 20:53 to 21:07 CST, 35 tool calls) | `<transcripts>/wf_79c71ecc-a87/agent-a2aa1e123525cb539.jsonl` |
| Transcript, run 2 (2026-11-14 01:41 to 02:01 CST, 62 tool calls) | `.../wf_79c71ecc-a87/agent-a5d93ac6b1ee2ac25.jsonl` |
| Transcript, run 3 (2026-11-14 06:41 CST, no tool calls) | `.../wf_79c71ecc-a87/agent-afa7b26ab51bbbec5.jsonl` |

All three were the same task: lens "senior geospatial and front-end engineer", review Section 6 and Appendix D by running things, no Earthdata credentials.

- **Run 1** tested D1 against live CMR (plus a 20-point sweep and a duplicate classifier), built a Python 3.12 venv, checked npm versions, tested D3 as written on a synthetic HDF5 file, tested D5 as written plus variants and wrote `d5_fixed.py`, confirmed the 8-bit encoding round trip, measured COG sizes, and tested Range requests on Python's `http.server`, the Vite dev server and `vite preview`. It was cut off by a usage limit.
- **Run 2** found run 1's files, copied the scripts into `run2/`, re-ran them, and added: a corrected D1 with tests, a corrected D3 with a 14-case pytest file, registry checks on npm and PyPI, the RGB/RGBA band-tagging trap, headless-Chrome tests of the web stack on MapLibre GL JS 5.24.1 and 6.18.0, a Range check on real GitHub Pages sites, and a re-derivation of D4 from freshly downloaded previews. It was cut off by a usage limit while trying a visual cross-check of D4.
- **Run 3** hit a limit before doing anything.

**No written conclusions survive.** In all three transcripts the only assistant text is the usage-limit notice, and the reasoning blocks are empty. Everything below is reconstructed from the scripts the runs wrote (including their comments) and the output those scripts printed. Where a statement is the earlier agent's interpretation rather than printed output, it is labelled.

**Never reached:** the manifest review (Section 6.4), the review of the schedule and plan, a visual check of D4 on a map, and anything that needs Earthdata credentials or a real NISAR file.

**No finding rises to "following the brief as written fails outright".** D1, D3 and D5 all run in their basic case. The damage is in edge cases and in results that look fine and are wrong; see Section 4.

**Provenance note.** Every script in Appendix A was written before kickoff as a throwaway test of the brief's own sketches (file times 2026-11-13 20:54 to 2026-11-14 02:01 CST). Whether the team may reuse them is a rules question outside this topic; if they are reused, say so in `AI_USE.md`.

---

## 2. Bottom line for the builder

1. **Passes at a point.** Use `nisarGranules` + `onePerPass` + `byStack` from `d1_fixed.mjs` (Appendix A1), not D1. D1 returns one row per granule, and 54 of 831 rows in the test were a second granule of a pass already listed.
2. **Reading a window.** Use `grid_window` + `read_window` from `d3_fixed.py` (Appendix A2), not D3. D3 is right for a box well inside the frame but truncates silently at frame edges, crashes or returns an empty array when the box misses the frame, and under-covers in polar projections.
3. **Writing a COG.** Use `write_cog` from `d5_fixed.py` (Appendix A3). D5 as written works for one band. For stacks, write the *source* GeoTIFF with `photometric="MINISBLACK"`, or GDAL tags a 3-band file RGB and a 4-band file RGBA and the 4-band case destroys data.
4. **Put GDAL scale and offset on the source GeoTIFF** (`scale = (hi-lo)/254`, `offset = lo - scale`). They carry into the COG. The browser library then takes colour-ramp limits in dB and returns clicks in dB. Without them, a ramp written as `#color:<ramp>,-25,0` paints one flat colour.
5. **Click history works as the brief hopes.** `locationValues(url, {latitude, longitude})` on a pixel-interleaved 11-band stack returned all 11 dates, with `NaN` only for the dates that are nodata there. Do not pass the zoom argument: it reads an averaged overview.
6. **MapLibre.** 5.24.1 works with the ordinary default import and no worker setup. 6.18.0 also works, in dev and in a production build, once three lines change (Section 5, R7). `npm install maplibre-gl` with no version gives 6.18.0.
7. **Local server.** Vite dev or `vite preview` only. Python's `http.server` ignores Range and the COG reader throws.
8. **The brief's Range check is wrong for GitHub Pages.** `curl -r 0-99 -I` sends HEAD, and Pages answers HEAD with 200 even though ranged GETs get 206. Use `curl -s -r 0-99 -o /dev/null -w '%{http_code} %{size_download}\n' <url>` and expect `206 100`.
9. **Size.** About 1.1 to 1.25 bytes per source pixel for 8-bit speckled data, overviews included. A 100 x 100 km window is about 30 MB per date per layer at 20 m and about 7 MB at 40 m.
10. **Python.** Use a fresh venv on Python 3.12 or later. The versions in Section 5, R1 were installed from wheels and exercised together.

---

## 3. Facts

### 3.1 CMR and D1

- **F1 (ran).** D1 as written runs in Node 22.15.0 against live CMR and its regular expression parsed every GCOV title it met: 831 granules at 20 points, 55 of them from the validated collection.
  Evidence: `n = 22 ms = 218` (Tonle Sap point); every line of `S/run2/d1/sweep_out.txt` has `regexFail=0`; `TOTAL granules 831 fullRegexFail 0 { counterOnly: 19, crossRelease: 0, partialPlusOther: 30, other: 5 } CRIDs { P05023: 776, P05036: 55 } orbitFlags [ 'N', 'F' ]` (`S/run2/d1/dups_out.txt`).
- **F2 (ran).** D1 returns one row per granule, not per pass. Of 831 rows, 54 were a second granule of a pass already listed (831 granules, 777 passes). The 54 pairs split into three kinds:
  - 19 differ only in the trailing counter (`..._001` and `..._002`).
  - 30 involve at least one partial-frame granule: a partial plus a full-frame granule in another mode (example: `023_047_D_084_4005_DHDH_A_..._N_P_J_001` with `023_047_D_084_2005_SHSH_M_..._N_F_J_001`), or two partials in different modes (`023_083_A_006_2005_DHDH_M_..._N_P_J_001` with `023_083_A_006_4005_DHDH_A_..._N_P_J_001`). Mekong Delta point: 22 of 43 passes. Punjab point: 8.
  - 5 are two full-frame granules of one pass in different modes (`..._2000_DHNA_M_..._F_J_001` with `..._2005_DHDH_A_..._F_J_001`, tracks 161_A_173 and 161_A_176, June and July 2026).
  - **None** was the same pass present in both the provisional and the validated collection.
  Evidence: the `TOTAL` line above and `{ total: 831, kept: 777, noH5: 0, noPrev: 0, twoRing: 20, validated: 55 }` (run 2, tool call 23).
- **F3 (ran).** `d1_fixed.mjs` gives, at all 20 points, stacks whose dates are unique and sorted after de-duplication; every granule has an `.h5` URL and a `_LATLON.png` URL; a bad request raises a readable error.
  Evidence: no `DUPLICATE DATE LEFT` or `NOT SORTED` line was printed; `noH5: 0, noPrev: 0`; `error path: CMR 400: [104.05,x] is not a valid URL encoded point`.
- **F4 (ran).** In `granules.json`, `polygons` is a list of rings, each a one-element list holding the string: `[['12.07019 105.39936 14.15457 104.89399 ...']]`. Frames that cross 180 degrees have **two** rings. D1 keeps only the first.
  Evidence: `Fiji antimeridian  hits=20 n=20 regexFail=0 noPoly=0 multiPoly=20`; `[["-18.2349 -180 -18.29501 -179.66536 ..."],["-16.07583 180 -15.78023 178.45618 ..."]]`.
- **F5 (ran).** A `granules.json` entry has exactly these keys: `producer_granule_id, time_start, updated, orbit_calculated_spatial_domains, dataset_id, data_center, title, coordinate_system, day_night_flag, time_end, id, original_format, granule_size, browse_flag, polygons, collection_concept_id, online_access_flag, links`. There are no additional attributes (no `STACK_ID`, no `FULL_FRAME`) in this format, so stack, mode, polarization, full or partial frame and counter have to come from the title. `granule_size` is a string in megabytes (`'1777.8144416809082'`).
  Evidence: `entry keys:` line in `S/run2/d1/sweep_out.txt`; run 1, tool call 13.
- **F6 (ran).** Links per granule: one own `data#` link ending `.h5`; two collection-level `data#` links marked `inherited: true` (ASF search, Earthdata search) that must be filtered out; `browse#` links for 7 PNGs on dual-pol granules and 5 on single-pol ones (`_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`, `_NATIVE_A_HHHH.png`, and so on), each listed again as `s3://`. D1's `browse` array therefore holds 5 to 7 URLs; pick the one ending `_LATLON.png`.
  Evidence: run 1, tool calls 13 and 14; `browse: 7` and `browse: 5` columns in run 2, tool call 18.
- **F7 (ran).** CMR is usable from a browser, paging included: `access-control-allow-origin: *`; `access-control-expose-headers: CMR-Hits, ..., CMR-Search-After, ...`; the preflight allows sending `CMR-Search-After`. Errors come back as HTTP 400 with `{"errors":["[104.05] is not a valid URL encoded point"]}`. `page_size` above 2000 is refused. No test point needed paging (largest result 97).
  Evidence: run 2, tool call 21.
- **F8 (ran).** The catalog changed during the night: the same 19 points returned 828 granules at 20:55 and 831 at 01:47 (validated 52 to 55).
  Evidence: `TOTAL` lines of `S/d1/dups_out.txt` and `S/run2/d1/dups_out.txt`.
- **F9 (ran).** At the brief's sample point (104.05, 12.95), stack `083_A_008` has 11 dates; the first ten are provisional (`P05023`) and the eleventh, 2026-10-29, is validated (`P05036`). The other stack there, `148_D_082`, mixes dual-pol and HH-only passes: 5 of its 11 dates are `SHSH`.
  Evidence: run 2, tool call 23 (`2026-10-17 p P05023 DHDH F` then `2026-10-29 v P05036 DHDH F`); run 2, tool call 18.

### 3.2 GIBS

- **F10 (ran).** The GIBS date is the UTC date of `time_start`. Inside the layer's date range, a date with no pass returns HTTP 200 and a 288-byte tile. The two dates tested after the brief's stated last day (2026-11-11) returned **HTTP 404** with an HTML body.
  Evidence (tile z8, y118, x201): `2026-06-18 200 288 image/png`, `2026-06-19 200 138873 image/png`, `2026-06-24 200 37962 image/png`, `2026-11-10 200 288 image/png`, `2026-11-12 404 196 text/html; charset=iso-8859-1`.

### 3.3 D3: reading a window

- **F11 (ran).** D3 as written, pointed at a local synthetic file with the Section 4.4 layout, returns correct indices and a correct geotransform when the box lies inside the grid.
  Evidence: `[T1 inside, on pixel edges] ... rows 400:600 cols 200:400 ... expected (r0,r1,c0,c1) = (400, 600, 200, 400) -> MATCH`; `geotransform maps array pixels to the file's true coordinates: True` on every non-empty case.
- **F12 (ran).** D3 as written misbehaves at the edges:
  - It keeps pixels whose *centres* are in the box, so it can fall up to one pixel short per side: `[T3b inside, box edge 1 m past a pixel centre] ... shortfall ... (9.0, 0.0, -9.0, 0.0)`.
  - A box that runs past the grid is truncated with no signal, so two dates can return different shapes: `[T4 partly outside east+south] ... shape=(250, 200) ... shortfall ... (0.0, 5000.0, 6000.0, 0.0)`.
  - A box wholly east or south of the grid crashes: `[T6 entirely outside east] RAISED: IndexError index 1200 is out of bounds for axis 0 with size 1200`.
  - A box wholly west or north, zero-width, or smaller than a pixel returns an empty array and no error: `[T7 entirely outside west] ... shape=(200, 0) ... EMPTY ARRAY returned, no error raised`.
- **F13 (ran).** Transforming only the four corners under-covers the box. In EPSG:3413, a 2 x 0.5 degree box near 70 N loses 17 rows at 20 m; in UTM the loss is at most about 51 m for a 1 degree box on the zone's central meridian and zero off-centre.
  Evidence: `as written: rows 322 3112 cols 1052 4948 south edge of window -2232240.0 true southern limit of the box -2232579.1 -> missing 339.1 m = 17.0 rows`; `(104.5, 12.5, 105.5, 13.5) corner envelope vs densified envelope, metres (W,S,E,N): [0.0, 51.3, 0.0, 0.0]`.
- **F14 (ran).** `d3_fixed.py` passes 14 pytest cases on synthetic files: UTM north, UTM south, EPSG:3413, a partial frame (padded with NaN and mask 255 to the same shape and geotransform as the full frame), a half-pixel-shifted lattice (detectable by comparing geotransforms), and four boxes outside the grid (each raises `ValueError`).
  Evidence: `14 passed in 1.13s` (run 2, tool call 28); `S/run2/d3/.pytest_cache/v/cache/lastfailed` is `{}`.
- **F15 (not run).** Nothing touched a real NISAR file. `open_remote` in `d3_fixed.py` (earthaccess fsspec session, `blockcache`, 8 MiB blocks) is copied from D3 and carries the comment `NOT RUN in review (needs Earthdata credentials)`.

### 3.4 D5 and COG behaviour

- **F16 (ran).** D5 as written runs under rio-cogeo 7.0.4, rasterio 1.5.2 (GDAL 3.12.2), and gives a valid COG in EPSG:3857 with overviews and nodata 0 kept. `rio cogeo validate` agrees. The one complaint is a deprecation warning.
  Evidence: `cog_validate: valid = True errors = [] warnings = []`; `driver GTiff crs EPSG:3857 size 2816 x 2816 count 1 dtype uint8`; `nodata 0.0 ...`; `blocks (512, 512) overviews [2, 4, 8] compress Compression.deflate interleave Interleaving.band`; ``DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option``.
- **F17 (ran).** Overviews built with `overview_resampling="average"` leave nodata out of the average: there is no dark fringe where data meets nodata, and no edge pixel turns into nodata.
  Evidence (`check_overview_edges.py` on the as-written COG): `overview /2: mixed blocks=2759  |ov - nodata-aware mean| median=0.00 max=0.50   |ov - naive mean| median=55.50   ov==0 in mixed blocks: 0`. At /4 and /8 the median difference is 0.6 to 0.8 DN, with a few edge blocks off by up to 18 to 19 DN (cause not investigated).
- **F18 (ran).** `cog_translate` carries the source's nodata, GDAL scale and offset, dataset tags and band descriptions into the COG, and `additional_cog_metadata` adds tags (used here for an AI-assistance tag).
  Evidence: `v1.tif: valid=True ... scales=(0.0984251968503937,) offsets=(-25.098425196850393,) descriptions=('2026-06-19',) tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', ...`.
- **F19 (ran).** Band-tagging trap. A 3-band uint8 GeoTIFF written with rasterio defaults is tagged red, green, blue; a 4-band one is tagged red, green, blue, **alpha**; 5-band and 11-band files were tagged gray plus undefined (2 bands with default settings was not tested). In the 4-band case, wherever band 4 is nodata, **all four bands come out 0** in the COG. Writing the source with `photometric="MINISBLACK"` fixes it. Setting `photometric` in the COG profile passed to `cog_translate` does not.
  Evidence (`alpha_trap.py`): `t_cog4.tif: colorinterp=['red', 'green', 'blue', 'alpha'] ... full res, inside the hole: band means=[0.0, 0.0, 0.0, 0.0]  rasterio masks (255=valid)=[0, 0, 0, 0]` against `t_cog4_mb.tif: colorinterp=['gray', 'undefined', 'undefined', 'undefined'] ... band means=[148.8, 150.2, 148.2, 0.0]  rasterio masks (255=valid)=[255, 255, 255, 0]`. Profile-level attempt: `[V3b] 4-band stack, photometric=MINISBLACK ... colorinterp=['red', 'green', 'blue', 'alpha']`. Warning text: `NodataAlphaMaskWarning: Input dataset has both a nodata value and internal alpha/mask band. Nodata value will be prioritized.`
- **F20 (ran).** `d5_fixed.py` writes 1, 2, 3, 4 and 11-band COGs with every warning turned into an error, and each passes its own assertions (EPSG 3857, nodata 0, overviews present, no alpha band).
  Evidence: `all variants passed with warnings treated as errors`; `f_cog1.tif is a valid cloud optimized GeoTIFF`.
- **F21 (ran).** rio-cogeo's `deflate` profile is `{'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'DEFLATE'}`. Multi-band output is pixel-interleaved by default. With 256-pixel blocks a 1536-pixel image gets overviews `[2, 4, 8]` instead of `[2, 4]`.
  Evidence: run 2, tool call 41.
- **F22 (ran, synthetic data).** Size of 8-bit dB COGs of speckled data, overviews included: 1.09 to 1.24 bytes per source pixel. Deflate and zstd are the same within a few percent (zstd slightly larger). An 11-band stack costs about what 11 single files cost (17.17 MB against 11 x 1.68 MB for 1200 x 1200 pixels).
  Evidence: `ENL20m=6.0    20 m  deflate   1.16 B/px  z13     29.1 MB       639 MB`; `ENL20m=6.0    40 m  deflate   1.10 B/px  z12      6.8 MB       151 MB`; `ENL20m=6.0    80 m  deflate   1.09 B/px  z11      1.7 MB        37 MB` (columns: MB for a 100 x 100 km window per date per layer, then times 11 dates times 2 polarizations). The speckle was simulated gamma noise, not NISAR data.

### 3.5 The 8-bit encoding (Section 6.3)

- **F23 (ran).** The formula round-trips. For lo = -25, hi = 0: step 0.0984 dB, worst error half a step, DN to dB to DN is the identity, values below lo clip to 1 and above hi to 255. NaN, negative power and zero power (minus infinity in dB) become 0. A tiny positive power (1e-12, which is -120 dB) becomes DN 1, not nodata.
  Evidence: `lo=-25.0 hi=0.0: step=0.09843 dB  max in-range error=0.04921 (step/2=0.04921)  DN->dB->DN identity=True  enc(lo)=1 enc(hi)=255 enc(lo-5)=1 enc(hi+5)=255 enc(nan)=0 enc(-inf)=0`.
- **F24 (ran).** The decoder is `dB = lo + (DN - 1) * (hi - lo) / 254`. The same thing in GDAL terms is `dB = DN * scale + offset` with `scale = (hi - lo) / 254` and `offset = lo - scale` (0.0984251969 and -25.0984251969 for -25..0). Three plausible wrong decoders (`DN/255`, `DN/254`, `(DN-1)/255`) are each off by up to one step.
  Evidence: `scale/offset form: dB = DN*scale + offset with scale=0.0984251969 offset=-25.0984251969 ; max diff vs formula 3.55e-15`; `decoder 'lo + DN/255*(hi-lo)': max abs error 0.098 dB`.

### 3.6 The web stack in a real browser (headless Chrome, Vite 8.3.8, `@geomatico/maplibre-cog-protocol` 0.10.0)

- **F25 (ran).** Colour ramps use the file's scale and offset. On a COG that declares them, `#color:BrewerYlGnBu9,-25,0,c` renders a graded image. On the same pixels without them, that ramp renders one flat colour, and `#color:BrewerYlGnBu9,1,255,c` reproduces the graded image exactly. Nodata is transparent.
  Evidence: `ramp_dB_on_scaled {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],...}`; `ramp_dB_on_unscaled {"centre":[8,29,88,255],"lake":[8,29,88,255],...}`; `ramp_DN_on_unscaled {"centre":[108,198,190,255],"lake":[243,250,189,255],...}`. Magenta `[255,0,255,255]` is the page background showing through.
- **F26 (ran).** `locationValues` applies scale and offset: on the scaled COG it returns the same dB that rasterio reads; on the unscaled COG it returns the raw DN. Nodata and points outside the image come back as `NaN`. A missing file rejects the promise.
  Evidence: `lv_fixed_centre [-12.008]` (rasterio: `hh_fixed centre ... DN 133 dB -12.008`); `lv_as_written_centre [133]`; `lv_fixed_wedge ["NaN"]`; `lv_fixed_outside ["NaN"]`; `missing "rejected: Request failed"`.
- **F27 (ran).** One call on an 11-band stack returns all 11 dates, each already in dB, with `NaN` only where that date is nodata. Passing a zoom reads an overview and returns an averaged value.
  Evidence: `lv_stack_centre [-12.008,-18.406,-13.091,-15.846,-14.961,-15.059,-11.516,-13.878,-14.764,-15.65,-12.598]` (matches rasterio's `-12.01, -18.41, -13.09, ...`); `lv_stack_hole [-14.567,"NaN",-15.846,"NaN",-15.846,"NaN",-13.189,"NaN",-15.65,"NaN",-16.732]`; `lv_fixed_centre_z10 [-14.862]` against `lv_fixed_centre [-12.008]`.
- **F28 (ran).** `setColorFunction(url, (pixel, color, metadata) => ...)` can draw any band of a multi-band COG. It receives raw DN. With no colour function and no `#color`, a multi-band MINISBLACK COG is drawn as band 1 in grey.
  Evidence: `stack_band2_colorfn {"centre":[98,0,157,255],"lake":[22,0,233,255],...,"hole":[255,0,255,255],...}`; `stack_default` equals `grey_fixed`.
- **F29 (ran).** Under a Vite base path, three URL forms render identically: absolute (`cog://http://host/base/data/x.tif`), root-relative (`cog://${import.meta.env.BASE_URL}data/x.tif`) and relative (`cog://data/x.tif`). Tested with the page at the base root, on the dev server with MapLibre 5.24.1.
  Evidence: `url_root_relative` and `url_relative` equal `ramp_dB_on_scaled`.
- **F30 (ran).** Every `.tif` request the page made was a ranged request answered 206.
  Evidence: `--- tif requests by file+status: {"hh_fixed.tif 206":{"n":5,"bytes":786432,"ranged":5}, ..., "stack11.tif 206":{"n":12,"bytes":4653056,"ranged":12}, ...}`.
- **F31 (ran).** MapLibre GL JS **5.24.1**: `import maplibregl from 'maplibre-gl'` works, no worker setup, no map errors.
  Evidence: `maplibreVersion "5.24.1"`, `mapErrors []`.
- **F32 (ran).** MapLibre GL JS **6.18.0** needs three changes, and then passes the same checks in the dev server and in a production build served by `vite preview`:
  1. `import * as maplibregl from 'maplibre-gl';` (the package has no default export),
  2. `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'; maplibregl.setWorkerUrl(workerUrl);`
  3. `maplibregl.getVersion()` instead of `maplibregl.version`.
  Without step 2 both dev and build report `Worker failed to load. Check that the worker URL is correct.` (raster COG layers still drew). With it: `mapErrors []` and a GeoJSON fill layer renders, `geojson_fill_px [0,255,0,255]`.
  Evidence: run 2, tool calls 53 to 55; screenshot `S/run2/web6/shot_v6_build.png`.
- **F33 (ran).** `@mapbox/mapbox-gl-sync-move` 0.4.0 keeps two maps in step on both MapLibre versions. It is CommonJS; `import syncMove from '@mapbox/mapbox-gl-sync-move'` works under Vite 8 in dev and build.
  Evidence: `sync {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}`.
- **F33b (ran).** The production build of the 6.18.0 test page (MapLibre, the COG protocol with geotiff.js, sync-move; no React) is a 1.43 MB main script, a 0.52 MB worker and 71 KB of CSS before compression, with geotiff.js's decoders split into small extra chunks. Vite printed its chunk-size warning.
  Evidence: `S/run2/web6/dist/assets/index-DDK41Z_i.js` 1432407 bytes, `maplibre-gl-worker-Boc9pDRP.mjs` 519547 bytes, `index-qvkd0SPb.css` 71339 bytes; build log `- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.`
- **F34 (docs).** From the COG protocol's README and source as installed (0.10.0): it throws on any projection other than EPSG:3857; it recommends 256-pixel blocks and `tileSize: 256` on the source; transparency comes from a mask band first, then declared nodata, then an alpha sample, and a file with none of these has no transparent pixels; `#color:` takes `<scheme>,<min>,<max>,<modifiers>` with `c` for continuous and `-` for reversed, scheme names being ColorBrewer and CARTOColors names such as `BrewerYlGnBu9`; scale and offset are read from the first band only and applied to every band by `locationValues`; opened files and decoded tiles are cached in memory for an hour, keyed by URL; `getCogMetadata` is marked unstable.
  Evidence: `S/web/node_modules/@geomatico/maplibre-cog-protocol/README.md` and `dist/esm/` (printed in run 2, tool calls 37, 39, 40).

### 3.7 Servers and hosting

- **F35 (ran).** Python's `http.server` ignores Range, in 3.12.2 and in 3.14.3: status 200 and the whole file. geotiff.js then refuses.
  Evidence: `== Python 3.12.2 http.server` / `GET  + Range 0-99 : HTTP/1.0 200 OK Content-Length: 3793343 | body bytes: 3793343`; same for 3.14.3; `fetch 200 Range: bytes=0-1023 content-length: 7177681` then `ERROR Error Server responded with full file` (run 1, tool call 32).
- **F36 (ran).** The Vite 8.3.8 dev server and `vite preview` both answer Range with 206, for GET and for HEAD, with `Content-Type: image/tiff` and `Accept-Ranges: bytes`, and echo the request's Origin in `Access-Control-Allow-Origin`.
  Evidence: `HEAD + Range 0-99 : HTTP/1.1 206 Partial Content Content-Length: 100 Content-Type: image/tiff Content-Range: bytes 0-99/7177681 Accept-Ranges: bytes`.
- **F37 (ran).** With `base: '/NASA-space-apps-2026/'`, a file in `public/data/` is served at `/NASA-space-apps-2026/data/...` and is 404 without the prefix. A **missing** file under the base returns `200 text/html` (the app shell) in both dev and preview.
  Evidence: `same file WITHOUT the base path: 404 text/plain`; `missing file under base (SPA fallback?): 200 text/html`.
- **F38 (ran).** GitHub Pages serves ranged GETs with 206 and `access-control-allow-origin: *`, but answers a **HEAD** carrying a Range header with 200 and the full length.
  Evidence (a COG on a Pages site, `server: GitHub.com`): `-- HEAD + Range` then `HTTP/2 200 ... content-length: 40992`; `-- GET + Range (+gzip accepted)` then `HTTP/2 206`, `access-control-allow-origin: *`, `content-range: bytes 1000-1999/40992`. Second Pages site: `HEAD+Range: HTTP/2 200 ... content-length: 121353`, `GET+Range: HTTP/2 206 ... content-range: bytes 0-99/121353`, `brief-safe check: 206 100`.

### 3.8 Packages and versions

- **F39 (ran).** One `pip install h5py numpy pyproj rasterio rio-cogeo earthaccess asf_search scipy` into a fresh Python 3.12.2 venv on macOS arm64 succeeded from wheels and resolved to: h5py 3.16.0, numpy 2.5.4, pyproj 3.8.0, rasterio 1.5.2, rio-cogeo 7.0.4, morecantile 7.1.0, earthaccess 0.19.0, asf_search 14.1.0, scipy 1.18.1, fsspec 2026.9.0, s3fs 2026.9.0, aiohttp 3.14.5, pydantic 2.14.3, shapely 2.2.0, affine 3.0.1. rasterio's bundled GDAL is 3.12.2. pytest was added later for the D3 tests. The venv is 333 MB.
  Evidence: `pip list` in run 2, tool call 17; `rio-cogeo 7.0.4 rasterio 1.5.2 GDAL 3.12.2`.
- **F40 (ran).** The machine's Anaconda base Python has h5py 3.11.0 and numpy 1.26.4, and rasterio 1.5.2 requires numpy 2 or later, so the pipeline needs its own venv. Other interpreters present: `/usr/bin/python3` 3.9.6, `/usr/local/bin/python3` 3.12.5, `/opt/homebrew/bin/python3` 3.14.3.
  Evidence: run 1, tool call 8 (`3.11.0 1.26.4`); run 2, tool calls 29 and 33.
- **F41 (docs, PyPI on 2026-11-14).** `requires_python >= 3.12`: rasterio 1.5.2, earthaccess 0.19.0, pyproj 3.8.0, numpy 2.5.4, scipy 1.18.1. `>= 3.11`: rio-cogeo 7.0.4, morecantile 7.1.0. `>= 3.10`: h5py 3.16.0, asf-search 14.1.0. rasterio 1.5.2's macOS wheels are tagged `macosx_15_0` for both arm64 and x86_64 (1.5.1 and earlier arm64 wheels were `macosx_14_0`). rio-cogeo 7.0.4 requires `morecantile<8.0,>=5.0`.
  Evidence: run 2, tool calls 33 and 34.
- **F42 (ran and docs, npm on 2026-11-14).** Installed and exercised together: vite 8.3.8, maplibre-gl 5.24.1 and 6.18.0, @geomatico/maplibre-cog-protocol 0.10.0, geotiff 3.0.5, @mapbox/mapbox-gl-sync-move 0.4.0, puppeteer-core 25.17.0, Node 22.15.0, npm 10.9.2. Registry: maplibre-gl `latest` is 6.18.0 and `latest-5` is 5.24.1, both published 2026-11-11; the COG protocol's peer range is `^4.5.0 || ^5.0.0 || ^6.0.0`; vite needs Node `^20.19.0 || >=22.12.0`; `@maplibre/maplibre-gl-compare` 0.5.0 was last published 2021-08-11. Not installed or exercised: react 19.3.1, typescript 7.0.2 (`latest`), @vitejs/plugin-react 6.3.0 (peer `vite ^8.0.0`), gh-pages 6.3.0. The test projects were plain JavaScript.
  Evidence: `S/run2/web/package-lock.json`, `S/run2/web6/package-lock.json`; run 2, tool call 32.
- **F43 (ran).** Free disk on the test machine was 31 GiB at 01:42 on 14 November (34 GiB at 20:54 the evening before).
  Evidence: `/dev/disk3s5   460Gi   393Gi    31Gi    93% ...`.

### 3.9 D4: placing a preview PNG

- **F44 (ran).** Three previews of stack `083_A_008` were downloaded again without login: HTTP 200, content type `binary/octet-stream`, final host a CloudFront domain, about 4.1 MB each, 1880 x 1847 pixels, 3 bands, about 181 m by 180 m per pixel.
  Evidence: `2026-06-19 200 binary/octet-stream 4080968 d1mv8zhcvry6x4.cloudfront.net`; `2026-06-19: 1880x1847 bands=3 footprint xl=144 xr=1804 yt=115 yb=1721 lit=52.8%`.
- **F45 (ran).** D4's formulas reproduce the brief's numbers to within one pixel on all three dates, and a cross-check using the polygon coordinate the fit does not use lands within 2 pixels.
  Evidence: `brief formulas -> west 102.3867 east 105.5263 north 14.3419 south 11.3329` (2026-06-19), `west 102.3865 east 105.5277 north 14.3415 south 11.3322` (2026-08-18), `west 102.3862 east 105.5270 north 14.3420 south 11.3330` (2026-10-29); `spread across dates (deg): west 0.00054 east 0.00142 north 0.00058 south 0.00077  -> in px: 0.32 0.85 0.36 0.47`; worst cross-check line (2026-08-18): `cross-check (predicted vs observed, px): W corner row 454.9 vs 456.0 (d=-1.1); E corner row 1402.4 vs 1401.0 (d=+1.4); N corner col 1502.6 vs 1502.5 (d=+0.1); S corner col 457.5 vs 459.5 (d=-2.0)`. Saved fit: `S/run2/d4/fit.json`.
- **F46 (ran, a calculation).** The preview's rows are evenly spaced in latitude. A four-corner image placement in Web Mercator spaces rows evenly in Mercator y. The worst north-south error in the middle of the frame is 0.5 km at 13 N and grows with latitude.
  Evidence: `stack 083_A_008 extent from the brief        498 m  =   2.8 preview px (180 m)  at lat 12.86  drawn too far north`. For a 3 degree frame the same script printed 1254 m (7.0 preview pixels) at 30 N, 2404 m (13.4) at 48 N, 4436 m (24.6) at 64 N, 5694 m (31.6) at 69 N and 8126 m (45.1) at 75 S; full output in Appendix C. That a MapLibre `image` source behaves this way is the earlier agent's premise (the script's title line says so); it was not rendered and compared.

---

## 4. Corrections to the brief

Severity: **blocks-build** = following the brief as written fails; **wrong-result** = it runs but gives wrong data or a wrong claim; **minor**. No correction here is blocks-build.

| # | Section | The brief says | What is actually true | Evidence | Severity |
|---|---|---|---|---|---|
| C1 | Appendix D1 and 4.3 | D1 maps every CMR entry to a "pass"; 4.3: "When the same acquisition appears twice, keep validated over provisional over beta, then the highest counter." | One pass often has two granules, and the stated rule covers a minority. Of 54 duplicate pairs: 19 counter-only, 30 partial-frame plus another mode, 5 two full frames in different modes, 0 across releases. A date list built from D1 shows duplicate dates (Mekong Delta point: 65 rows for 43 passes). Use `onePerPass` (validated, then full frame over partial, then counter), then check that the chosen granule's polygon covers the area. | F2, F3 | wrong-result |
| C2 | 6.3 and 6.5 | Store 8-bit DN; colour with `cog://URL#color:<ramp>,<min>,<max>`. | The ramp's min and max are in the file's units. On an 8-bit file with no scale and offset, limits written in dB paint every pixel one colour. Either declare scale and offset on the source GeoTIFF (then limits are in dB and clicks return dB), or write the limits as DN (`1,255`). | F25, F26 | wrong-result |
| C3 | 6.3 | "One multi-band COG per channel for click queries, with one band per date and pixel interleaving." | Works, but a 3-band source is tagged RGB and a 4-band source RGBA unless the source is written with `photometric="MINISBLACK"`. With RGBA, every date is zeroed wherever date 4 is nodata. Setting `photometric` in the COG profile does not help. | F19, F20, F27 | wrong-result |
| C4 | Appendix D3 | "Not run." Window from `np.searchsorted` on the pixel centres of four transformed corners. | Run on synthetic files: right for boxes inside the grid. It can fall a pixel short per side, truncates silently at the frame edge (different shapes on different dates), raises `IndexError` or returns an empty array when the box misses the frame, and loses 17 rows on a polar test box. `d3_fixed.py` fixes all four. The remote open is still not run. | F11 to F15 | wrong-result |
| C5 | 6.6 | "confirm with `curl -r 0-99 -I <url>` that you get 206" | `-I` sends HEAD. GitHub Pages answers a ranged HEAD with 200 and a ranged GET with 206, so this check reports failure on a working deployment. It does report 206 on Vite. Use `curl -s -r 0-99 -o /dev/null -w '%{http_code} %{size_download}\n' <url>` and expect `206 100`. | F36, F38 | wrong-result |
| C6 | Appendix D4 | "Method verified numerically ... not yet checked visually on a map." "this gave west 102.3865, east 105.5270, north 14.3420, south 11.3330 on all three dates." | Re-verified numerically on fresh downloads: the three dates agree to under a pixel, not exactly (west 102.3862 to 102.3867, east 105.5263 to 105.5277). Still not checked on a map. New: stretching the preview between four corners in Web Mercator misplaces the middle rows by 0.5 km at 13 N, 1.3 km at 30 N, 2.4 km at 48 N, 4.4 km at 64 N. | F45, F46 | wrong-result |
| C7 | Appendix D5 | "Not run here." `cog_translate(..., web_optimized=True, ...)` | Runs and validates for one band. `web_optimized` is deprecated; `tms=morecantile.tms.get("WebMercatorQuad")` is the replacement and gives the same result with no warning. The default profile uses 512-pixel blocks; the browser library recommends 256. D5 says nothing about scale and offset (C2) or band tagging (C3). | F16, F20, F21 | minor |
| C8 | 6.6 | "Whether Python's built-in server does is unverified; do not rely on it." | Settled: it does not, in 3.12.2 or 3.14.3, and geotiff.js throws `Server responded with full file`. | F35 | minor |
| C9 | 4.5 | `polygons` is "one string of 'lat lon lat lon ...'" | It is a list of rings, each a one-element list containing that string. Antimeridian frames have two rings. The JSON entries carry no `STACK_ID` or `FULL_FRAME`; those are only available by parsing the title (or from another format). | F4, F5 | minor |
| C10 | 4.6 | "A date with no pass over your area returns an empty 288-byte tile rather than an error" | True inside the layer's date range. Dates past its last day (2026-11-12 and 2026-11-13 were tried) return HTTP 404. Treat both as "no imagery". The GIBS date is the UTC date of `time_start`. | F10 | minor |
| C11 | 6.5 | "Start on 5.24.1 unless a quick test shows version 6 working with the COG protocol in this project." | The quick test has been done. 6.18.0 works with the COG protocol 0.10.0 under Vite 8.3.8, dev and production build, given the three changes in F32. 5.24.1 needs none of them. The claims "ESM-only", "no default export" and "needs `setWorkerUrl()`" are confirmed; "requires WebGL2" was not tested. | F31, F32 | minor |
| C12 | 6.1 | "Use a project-local Python environment with pip wheels: h5py, numpy, scipy, pyproj, rasterio, rio-cogeo, earthaccess, asf_search." | Confirmed on Python 3.12.2, macOS arm64. Add: Python must be 3.12 or later for the current rasterio, earthaccess, pyproj, numpy and scipy; rasterio 1.5.2's macOS wheels need macOS 15; `morecantile` arrives with rio-cogeo and is imported directly by the fixed D5; `pytest` is not in the list. | F39 to F41 | minor |
| C13 | 6.3 | "Aim for a few hundred megabytes in total." | Measured on synthetic speckle: about 30 MB per date per layer for 100 x 100 km at 20 m. Eleven dates of two polarizations is 640 to 680 MB before any stack file, against a 1 GB site limit. At 40 m the same set is about 150 to 160 MB. | F22 | minor |
| C14 | Appendix A, Tonle Sap row | Stack 083_A_008, 11 dates, 2026-06-19 to 2026-10-29. | The eleventh date is from the validated release (`P05036`); the first ten are provisional. A single-release series there has ten dates. | F9 | minor |
| C15 | 1.2 | "about 42 GB free disk" | 31 GiB free at 01:42 on 14 November. | F43 | minor |

---

## 5. Recommendations

- **R1. Python environment.** Fresh venv on Python 3.12 or later; `pip install h5py numpy scipy pyproj rasterio rio-cogeo earthaccess asf_search pytest`. If pins are wanted, these ran together: h5py 3.16.0, numpy 2.5.4, scipy 1.18.1, pyproj 3.8.0, rasterio 1.5.2, rio-cogeo 7.0.4, morecantile 7.1.0, earthaccess 0.19.0, asf_search 14.1.0, fsspec 2026.9.0. *Why:* several of them refuse Python below 3.12, the Anaconda base has numpy 1.26.4, and rasterio 1.5.2 wants numpy 2 or later (F39 to F41).
- **R2. Writing a COG.** Use `write_cog` from `d5_fixed.py`: `cog_profiles.get("deflate")` with `blockxsize=256, blockysize=256`; `tms=morecantile.tms.get("WebMercatorQuad")`; `nodata=0`; `resampling="nearest"`; `overview_resampling="average"`; `additional_cog_metadata={...}` for the AI-assistance tag; then assert `cog_validate` passes, EPSG is 3857, nodata is 0, overviews exist and no band is alpha. *Why:* no deprecation warning, the block size the browser library recommends, and the assertions catch C3 (F16 to F21).
- **R3. The source GeoTIFF handed to `write_cog`.** uint8, `nodata=0`, `photometric="MINISBLACK"`, `interleave="pixel"`, `scales = ((hi-lo)/254,) * n`, `offsets = (lo - (hi-lo)/254,) * n`, band description set to the date. *Why:* stops the RGB and alpha tagging, and makes ramps and clicks work in dB (F18, F19, F25 to F27).
- **R4. One decoder, written down.** `dB = lo + (DN - 1) * (hi - lo) / 254`; DN 0 is nodata. Put the formula (or the scale and offset) next to `lo` and `hi` in the manifest and test it on both sides. *Why:* the brief gives only the encoder, and each of three obvious wrong decoders is off by a full step (F24). Use one `lo`/`hi` per stack file, because the browser library applies band 1's scale and offset to every band (F34).
- **R5. Display.** Raster source `{ type: 'raster', url: 'cog://<url>#color:<Scheme>,<lo>,<hi>,c', tileSize: 256 }` with a ColorBrewer or CARTOColors scheme name; limits in dB when scale and offset are declared, otherwise `1,255`. *Why:* F25, F34.
- **R6. Click queries.** `locationValues(stackUrl, {latitude, longitude})` with no zoom argument; show `NaN` as "no data"; catch the rejection. *Why:* one call returns every date; a zoom argument returns overview averages (F26, F27).
- **R7. MapLibre.** Simplest: `npm install maplibre-gl@5.24.1`, `import maplibregl from 'maplibre-gl'`. If version 6 is wanted: `import * as maplibregl from 'maplibre-gl'`; `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'; maplibregl.setWorkerUrl(workerUrl);` and `getVersion()`. *Why:* both passed every check; a bare `npm install maplibre-gl` gives 6.18.0, whose default-import form does not exist (F31, F32, F42).
- **R8. Compare view.** Two map instances and `import syncMove from '@mapbox/mapbox-gl-sync-move'` (0.4.0); `syncMove(a, b)`. *Why:* worked on both MapLibre versions in dev and build (F33). The dragged CSS clip was not tested.
- **R9. Local serving.** `vite` or `vite preview` only. *Why:* F35, F36.
- **R10. Range check.** `curl -s -r 0-99 -o /dev/null -w '%{http_code} %{size_download}\n' <url>`, expecting `206 100`, on the local server and on the deployed URL. *Why:* C5.
- **R11. Do not trust a 200.** Vite answers a missing data file with `200 text/html`. In tests check the content type or the byte count, and let the app surface a rejected `locationValues` or a source error. *Why:* F37.
- **R12. Base path.** `defineConfig({ base: '/NASA-space-apps-2026/' })` and build every data URL from `import.meta.env.BASE_URL`. *Why:* files are 404 without the prefix (F37); all three COG URL forms work with it (F29).
- **R13. Pass listing.** Use `d1_fixed.mjs`. Take the date as `time_start.slice(0, 10)` (UTC), which is also the GIBS date. Keep every polygon ring. After `onePerPass`, confirm the area of interest is inside the chosen granule's polygon, and when two granules tie, choose on purpose (see open question 4). Freeze the chosen granule list in the repository. *Why:* F2 to F4, F8, F10.
- **R14. Window reads.** Use `d3_fixed.py`. Assert that shape and geotransform are identical across the dates of a stack. Keep `test_d3_fixed.py` and `make_synth2.py` as the pipeline's first tests. Print the tree of the first real file before trusting the dataset names. *Why:* F12 to F15.
- **R15. Resolution and budget.** For a window near 100 km across, work at 40 m (about 7 MB per date per layer); 20 m fits only for windows near 50 km. Use deflate. Count the stack file as roughly the sum of the single-date files it duplicates, or make it coarser. *Why:* F22.
- **R16. GIBS.** Take dates from CMR in UTC; treat a 404 and a 288-byte tile alike as "no imagery". *Why:* F10.
- **R17. Previews on a map.** The D4 fit is good to a pixel or two. Outside the tropics, resample the rows to Mercator in the same canvas step that makes black transparent, instead of pinning four corners. No tested code for this exists. *Why:* F45, F46.

---

## 6. Artifacts

`S` = `<scratch>/review/geo-frontend-engineer`. Top-level `d1/`, `d3/`, `d5/` hold run 1's copies; the twelve scripts that exist in both places are byte-identical. Full text of each script marked (A) is in Appendix A.

| Path | What it is | To reuse |
|---|---|---|
| `S/run2/d1/d1_fixed.mjs` (A1) | Corrected D1: `nisarGranules(lon, lat)`, `onePerPass`, `byStack`. Ran against live CMR at 20 points. | Works in Node 22 and in a browser as is. Add the beta collection id to `GCOV` if beta dates are wanted (untested). Add an area-inside-polygon check and a deliberate tie-break. |
| `S/run2/d1/d1_fixed_test.mjs` (A1) | Live test over 20 points; prints stacks, counts, the error path. | `node d1_fixed_test.mjs`. Needs network. Turn the two `console.log` checks into assertions. |
| `S/run2/d1/d1_dups.mjs`, `S/run2/d1/d1_sweep.mjs` (A1) | Duplicate classifier and field/regex sweep that produced `dups_out.txt` and `sweep_out.txt`. | Change the `pts` table to the team's places. |
| `S/run2/d1/dups_out.txt`, `S/run2/d1/sweep_out.txt`, `S/d1/dups_out.txt`, `S/d1/sweep_out.txt` | Saved output, run 2 and run 1 (Appendix C). | Evidence only. |
| `S/run2/d3/d3_fixed.py` (A2) | Corrected D3: pure `grid_window`, `read_window(h5, bbox)`, and `open_remote(url)` (not run). | Import as is. `read_window` takes an open `h5py.File`. Check dataset names against a real file first. |
| `S/run2/d3/test_d3_fixed.py` (A2) | 14 pytest cases; all pass. | Run from the folder holding the fixtures: `python -m pytest -q test_d3_fixed.py`. |
| `S/run2/d3/make_synth2.py` (A2) | Writes the synthetic fixtures. | Its `__main__` still writes the polar fixture at the wrong place. Rebuild it with `make("ps_north.h5", 3413, -60000.0, -2170000.0, 20.0, 3600, 6000, lattice_origin=(-60000.0, -2170000.0))` (Appendix B, command B5) or the polar test fails. |
| `S/d5/d5_fixed.py` (A3) | `write_cog(src, dst, tags)` plus a self-test over 1, 2, 3, 4 and 11 bands with warnings as errors. | Copy `write_cog`. The self-test needs `make_src.py` beside it. |
| `S/d5/make_src.py` (A3) | `encode_db(db, lo, hi)` (the Section 6.3 encoder) and a synthetic speckle generator. | `encode_db` is reusable as is. |
| `S/d5/check_overview_edges.py`, `S/d5/inspect_cog.py` (A3) | Overview-edge check and a one-screen COG report. | `python check_overview_edges.py file.tif`; assumes band 1 and nodata 0. |
| `S/run2/d5/alpha_trap.py`, `S/d5/size_table.py`, `S/d5/variants.py` (A3) | The RGBA trap demonstration, the size table, and the D5 variants. | Evidence; `size_table.py` can be re-pointed at real data. |
| `S/enc/roundtrip.py` (A4) | `enc` and `dec` for the 8-bit encoding plus the round-trip checks. | Lift `enc` and `dec` into the pipeline's tests. |
| `S/run2/web6/src/main.js` (A5) | Browser test page, MapLibre 6.18.0 form: protocol registration, ramp, colour function, metadata, `locationValues`, sync, GeoJSON layer. | The three lines that differ for 5.24.1 are listed in A5. Paths assume `public/data/*.tif`. |
| `S/run2/web/drive.mjs` (A5) | Headless-Chrome driver (puppeteer-core) that prints results, console lines and `.tif` requests, and takes a screenshot. | Hard-codes the macOS Chrome path. `node drive.mjs <url> <shot.png>`. A starting point for an automated check of the deployed page. |
| `S/run2/web6/package.json`, `S/run2/web/package.json`, `vite.config.js`, `index.html` (A5) | The scratch projects' configuration; `package-lock.json` beside each. | Version reference. Not a project scaffold: plain JavaScript, no React or TypeScript. |
| `S/run2/web/shot_v5.png`, `S/run2/web6/shot_v6_dev.png`, `S/run2/web6/shot_v6_build.png` | Screenshots of the two synced maps. | Evidence only. |
| `S/run2/d4/code/fetch_previews.mjs`, `S/run2/d4/code/d4_check.py` (A6) | Download previews for chosen dates of one stack; apply D4 and cross-check it. | `node fetch_previews.mjs <lon> <lat> <stack> <outDir> <date...>` then `python -I d4_check.py <meta.json> <fit.json>`. Imports `../../d1/d1_fixed.mjs`. |
| `S/run2/d4/fit.json`, `S/run2/d4/png/083_A_008_meta.json`, `S/run2/d4/png/*.png` | Fitted extents, granule metadata and the three previews (about 4.1 MB each). | Evidence only. |
| `S/run2/registry/npm_info.py`, `S/run2/registry/pypi_info.py` (A7) | Registry queries that produced the version tables. | `python npm_info.py <pkg...>`; they call `/usr/bin/curl`. |
| `S/venv` (333 MB), `S/web/node_modules`, `S/run2/web*/node_modules` | The scratch environments. The whole of `S` is 1.5 GB. | Do not build on them; recreate from R1 and the lock files. |
| Appendix B | The shell commands that ran, copied from the transcripts. | B1 to B12; each names the output block in Appendix C that it produced. |

Data URLs that answered during the runs:

- `https://cmr.earthdata.nasa.gov/search/granules.json?point=<lon>,<lat>&page_size=2000&sort_key=start_date&collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF`
- `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/<YYYY-MM-DD>/GoogleMapsCompatible_Level13/<z>/<y>/<x>.png`
- `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<granule>/<granule>_LATLON.png` (redirects to CloudFront)
- `https://registry.npmjs.org/<package>` and `https://pypi.org/pypi/<package>/json`

---

## 7. Things that were tried and did not work

| Tried | Outcome |
|---|---|
| D3 as written, box wholly east or south of the grid | `IndexError index 1200 is out of bounds for axis 0 with size 1200`; `IndexError index 1500 is out of bounds for axis 0 with size 1500`. |
| D3 as written, box wholly west or north, zero-width, or smaller than a pixel | `EMPTY ARRAY returned, no error raised` (shapes `(200, 0)`, `(0, 200)`, `(0, 0)`). |
| Fixing the RGBA tagging by adding `photometric="MINISBLACK"` (and `interleave="pixel"`) to the COG profile | No effect: `[V3b] 4-band stack ... colorinterp=['red', 'green', 'blue', 'alpha']`. Only writing the source file with it works. |
| geotiff.js `fromUrl` against Python `http.server` | `fetch 200 Range: bytes=0-1023 content-length: 7177681` then `ERROR Error Server responded with full file`. |
| MapLibre 6.18.0 under Vite with no `setWorkerUrl`, dev and build | `Worker failed to load. Check that the worker URL is correct.`; in dev also `[requestfailed] http://localhost:5493/NASA-space-apps-2026/node_modules/.vite/deps/maplibre-gl-worker.mjs?v=6.18.0 net::ERR_FAILED`. |
| `maplibregl.version` on 6.18.0 | The production build printed a diagnostic pointing at `maplibregl.version` (its message text was not captured). The run switched to `maplibregl.getVersion()`, which works on both versions. |
| First run of `test_d3_fixed.py` | `1 failed, 13 passed`: `ValueError: bbox (-46.0, 69.6, -44.0, 70.1) does not overlap this granule's grid`. The polar fixture ended about 76 km north of the test box. A test-data mistake, corrected (command B5); then `14 passed`. |
| Visual cross-check of D4 against a GIBS tile mosaic (`S/run2/d4/code/gibs_mosaic.py`) | `rasterio.errors.RasterioIOError: Dataset is closed: ../gibs/2026-06-19_10_470_805.png`. The run ended here. Three tiles were downloaded; no mosaic and no comparison exist. |
| Probing the RGBA-tagged stack in the browser (`lv_stack4_rgba_hole`) | Inconclusive: returned `[160,132,118,124]` because the probe point sat on the corner of that file's nodata hole. The browser did see the file as RGB with an alpha band (`metadata_rgba {"noData":0,"photometric":2,"alphaBand":3}`); the data loss itself is shown only by the rasterio check in F19. |
| First headless-browser run | Output cut at 150 lines by the command itself, and the "as written" test file held different pixels from the scaled one. Re-run with matching pixels; that second run is the one quoted. |
| Registry query as an inline `python3 -c` f-string | `SyntaxError: unexpected character after line continuation character`. Rewritten as `npm_info.py`. |
| Run 2's first step, reading the brief at `<official-repo>/research/` | `No such file or directory`: the research folder had moved to the `-prehackathon-temporary` repository, where the run then found it. |
| Run 3 | No tool calls: `You've hit your Fable limit`. |

---

## 8. Open questions

1. **Nothing was run with credentials or on a real NISAR file.** Unsettled: the HDF5 layout in Section 4.4, D3's remote open (earthaccess fsspec, `blockcache`, 8 MiB blocks), read times for a window, and the three-way access comparison in Section 6.2. Harmony and the GDAL 3.13 path were not touched by this lens.
2. **The manifest sketch (6.4) was never reviewed.** The tests suggest it should state the decoder or the scale and offset, and the release of each date, but no review was written.
3. **D4 has still not been seen on a map.** No tested code resamples a preview to Mercator. The preview's cross-origin headers were not re-checked from a browser in these runs (the download was done in Node).
4. **`onePerPass` breaks ties by arrival order.** Two full-frame granules of one pass (`2000_DHNA_M` and `2005_DHDH_A`) rank equal, as do two partial granules in different modes (`2005_DHDH_M` and `4005_DHDH_A`, both `P`), and the first one listed wins. It also prefers a full-frame HH-only granule (`2005_SHSH_M ... F`) over a partial dual-pol one. Which is right depends on where the area sits in the frame and which polarizations are needed. No footprint check was written.
5. **Not covered by the D1 tests:** the beta collection, urgent-response (`UR`) names, the GUNW, GOFF and SME2 name patterns, and a result set large enough to need paging.
6. **Overviews average the 8-bit dB values, not linear power.** Nobody measured how far that sits from the brief's rule of averaging in linear power. It affects what the map shows when zoomed out and what `locationValues` returns when given a zoom.
7. **Real-data file sizes.** The size table used simulated speckle.
8. **Not exercised in a browser by this lens:** D2 (the GIBS layer in MapLibre), the OpenFreeMap styles, the CSS-clip divider, a phone, React, TypeScript 7.
9. **MapLibre 6's WebGL2 requirement** was not tested; the headless runs used Chrome with software rendering flags.
10. **Hosting claims other than GitHub Pages Range and cross-origin behaviour** (Cloudflare Pages, Vercel, Netlify, Hugging Face, release assets, the 100 MiB and 1 GB limits) were not tested here.
11. **A 404 appears in the console on every browser run** (`Failed to load resource: the server responded with a status of 404 (Not Found)`). Its source was not identified; it is not one of the `.tif` files. The brief's finish line asks for a clean console.
12. **Whether one click on the stack costs one range request** was not isolated; the request log mixes rendering and queries.
13. **Reuse of pre-kickoff code** (see the provenance note in Section 1) is for the team and the rules review to decide.

---

# Appendix A. Code that ran, copied byte for byte

Each block names the file it came from. Nothing here was edited. Scripts that only reproduce the brief's own code with a driver (`d1_as_written.mjs`, `d5_as_written.py`, `test_d3_as_written.py`, `make_synth.py`) and the one script that failed (`gibs_mosaic.py`) are not copied; their paths are in Section 6 and their output is in Appendix C.

## A1. Passes at a point (replaces sketch D1)

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/d1_fixed.mjs`  
**Bytes:** 2470, sha256 starts `7dea897edf630d9d`  
**Status:** ran against live CMR at 20 points on 2026-11-14 01:48 CST; output in Appendix C3.

````js
// D1 corrected: checks the HTTP status, survives a title that does not match, keeps every polygon ring
// (antimeridian frames have two), returns the data and preview URLs, and collapses duplicate granules of one pass.
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF']; // provisional, validated
const NAME = /_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_([AM])_\d{8}T\d{6}_\d{8}T\d{6}_([A-Z]\d{5})_\w_([FP])_\w_(\d{3})$/;

export async function nisarGranules(lon, lat) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`CMR ${res.status}: ${(body.errors ?? []).join('; ')}`);
  return body.feed.entry.flatMap((e) => {
    const m = e.title.match(NAME);
    if (!m) return [];
    const own = e.links.filter((l) => !l.inherited && l.href.startsWith('https'));
    return [{
      name: e.title, start: e.time_start, date: e.time_start.slice(0, 10), // UTC date; this is also the GIBS date
      cycle: m[1], stack: `${m[2]}_${m[3]}_${m[4]}`, mode: m[5], pol: m[6], mixedMode: m[7] === 'M', version: m[8],
      release: e.collection_concept_id === GCOV[1] ? 'validated' : 'provisional',
      fullFrame: m[9] === 'F', counter: Number(m[10]),
      polygons: (e.polygons ?? []).map((ring) => ring[0]), // each "lat lon lat lon ..."; two when the frame crosses 180 degrees
      h5: own.find((l) => l.rel.endsWith('/data#') && l.href.endsWith('.h5'))?.href,
      preview: own.find((l) => l.rel.endsWith('/browse#') && l.href.endsWith('_LATLON.png'))?.href,
    }];
  });
}

// One granule per pass (cycle + stack): validated over provisional, full frame over partial, then the highest counter.
export function onePerPass(granules) {
  const rank = (g) => (g.release === 'validated' ? 1e6 : 0) + (g.fullFrame ? 1e3 : 0) + g.counter;
  const best = new Map();
  for (const g of granules) {
    const key = `${g.cycle}_${g.stack}`;
    if (!best.has(key) || rank(g) > rank(best.get(key))) best.set(key, g);
  }
  return [...best.values()];
}

// Passes grouped by stack: { '083_A_008': [granule, ...], ... }. Only dates within one stack may be compared.
export function byStack(granules) {
  const out = {};
  for (const g of onePerPass(granules)) (out[g.stack] ??= []).push(g);
  return out;
}
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/d1_fixed_test.mjs`  
**Bytes:** 2133, sha256 starts `7ff9f3117091137a`  
**Status:** ran; this is the script that printed C3. Needs network.

````js
import { nisarGranules, onePerPass, byStack } from './d1_fixed.mjs';
const pts = {
  'Tonle Sap': [104.05, 12.95], 'Mexico City': [-99.1, 19.4], 'Kilauea': [-155.28, 19.41], 'Central Valley': [-119.56, 36.1],
  'Reykjanes': [-22.4, 63.88], 'Punjab': [75.8, 30.6], 'Atchafalaya': [-91.45, 30.0], 'Grand Forks': [-97.4, 47.9],
  'Chicago': [-87.65, 41.85], 'Champaign': [-88.3, 40.2], 'Jakobshavn': [-49.6, 69.17], 'Okavango': [22.9, -19.3],
  'Rondonia': [-63.5, -10.0], 'Sudd': [30.7, 7.5], 'Mekong Delta': [105.6, 10.0], 'Mamiraua': [-65.0, -2.7],
  'Pantanal': [-57.2, -17.3], 'Fiji antimeridian': [179.9, -16.8], 'Pine Island': [-100.0, -75.1], 'Svalbard': [16.0, 78.5],
};
let total = 0, kept = 0, noH5 = 0, noPrev = 0, twoRing = 0, val = 0;
for (const [name, [lon, lat]] of Object.entries(pts)) {
  const g = await nisarGranules(lon, lat);
  const one = onePerPass(g);
  const stacks = byStack(g);
  total += g.length; kept += one.length;
  noH5 += g.filter((x) => !x.h5).length; noPrev += g.filter((x) => !x.preview).length;
  twoRing += g.filter((x) => x.polygons.length > 1).length; val += g.filter((x) => x.release === 'validated').length;
  // within each stack after dedupe, every UTC date must be unique and sorted
  for (const [s, list] of Object.entries(stacks)) {
    const dates = list.map((x) => x.date);
    if (new Set(dates).size !== dates.length) console.log('  DUPLICATE DATE LEFT in', name, s, dates.join(' '));
    if (dates.join() !== [...dates].sort().join()) console.log('  NOT SORTED', name, s);
  }
  console.log(`${name.padEnd(18)} granules=${String(g.length).padStart(3)} passes=${String(one.length).padStart(3)} stacks=${Object.keys(stacks).length}  ` +
    Object.entries(stacks).map(([s, l]) => `${s}:${l.length}`).join(' '));
}
console.log({ total, kept, noH5, noPrev, twoRing, validated: val });
const ts = byStack(await nisarGranules(104.05, 12.95))['083_A_008'];
console.log(ts.map((x) => `${x.date} ${x.release[0]} ${x.version} ${x.pol} ${x.fullFrame ? 'F' : 'P'}`).join('\n'));
console.log(ts[0]);
try { await nisarGranules(104.05, 'x'); } catch (e) { console.log('error path:', e.message); }
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/d1_dups.mjs`  
**Bytes:** 2614, sha256 starts `c46736fe1ef660d2`  
**Status:** ran in both runs; printed `dups_out.txt` (C2).

````js
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF'];
const RE = /_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_([AM])_(\d{8}T\d{6})_(\d{8}T\d{6})_([A-Z]\d{5})_([A-Z])_([FP])_([A-Z])_(\d{3})$/;
const pts = {
  'Mexico City': [-99.1, 19.4], 'Kilauea': [-155.28, 19.41], 'Central Valley': [-119.56, 36.1],
  'Reykjanes': [-22.4, 63.88], 'Punjab': [75.8, 30.6], 'Atchafalaya': [-91.45, 30.0],
  'Grand Forks': [-97.4, 47.9], 'Chicago': [-87.65, 41.85], 'Champaign': [-88.3, 40.2],
  'Jakobshavn': [-49.6, 69.17], 'Okavango': [22.9, -19.3], 'Rondonia': [-63.5, -10.0],
  'Tonle Sap': [104.05, 12.95], 'Sudd': [30.7, 7.5], 'Mekong Delta': [105.6, 10.0],
  'Mamiraua': [-65.0, -2.7], 'Pantanal': [-57.2, -17.3], 'Fiji antimeridian': [179.9, -16.8],
  'Pine Island': [-100.0, -75.1],
};
let tot = 0, totFail = 0; const cls = { counterOnly: 0, crossRelease: 0, partialPlusOther: 0, other: 0 }; const crids = new Map(); const orbitFlags = new Set();
for (const [name, [lon, lat]] of Object.entries(pts)) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const { feed } = await (await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`)).json();
  const groups = new Map();
  for (const e of feed.entry) {
    tot++;
    const m = e.title.match(RE);
    if (!m) { totFail++; console.log('FULL-REGEX FAIL', e.title); continue; }
    crids.set(m[10], (crids.get(m[10]) ?? 0) + 1); orbitFlags.add(m[11]);
    const k = `${m[2]}_${m[3]}_${m[4]}|${m[8].slice(0, 8)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ t: e.title, m, coll: e.collection_concept_id });
  }
  let nDupGroups = 0; const local = { counterOnly: 0, crossRelease: 0, partialPlusOther: 0, other: 0 };
  for (const [k, g] of groups) {
    if (g.length < 2) continue; nDupGroups++;
    const stripCounter = new Set(g.map((x) => x.t.replace(/_\d{3}$/, '')));
    const colls = new Set(g.map((x) => x.coll));
    const kind = colls.size > 1 ? 'crossRelease' : stripCounter.size === 1 ? 'counterOnly' : g.some((x) => x.m[12] === 'P') ? 'partialPlusOther' : 'other';
    local[kind]++; cls[kind]++;
    if (kind === 'other' || kind === 'crossRelease') console.log('   ', kind, g.map((x) => x.t.slice(17)).join(' | '));
  }
  console.log(`${name.padEnd(18)} granules=${feed.entry.length} passGroups=${groups.size} groupsWith>1=${nDupGroups} ${JSON.stringify(local)}`);
}
console.log('TOTAL granules', tot, 'fullRegexFail', totFail, cls, 'CRIDs', Object.fromEntries(crids), 'orbitFlags', [...orbitFlags]);
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/d1_sweep.mjs`  
**Bytes:** 2403, sha256 starts `da7d41ee7753a329`  
**Status:** ran in both runs; printed `sweep_out.txt` (C2).

````js
// Sweep: run the D1 request for many points, apply the D1 regex to every title, report failures / duplicates.
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF'];
const RE = /_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_/;
const pts = {
  'Mexico City': [-99.1, 19.4], 'Kilauea': [-155.28, 19.41], 'Central Valley': [-119.56, 36.1],
  'Reykjanes': [-22.4, 63.88], 'Punjab': [75.8, 30.6], 'Atchafalaya': [-91.45, 30.0],
  'Grand Forks': [-97.4, 47.9], 'Chicago': [-87.65, 41.85], 'Champaign': [-88.3, 40.2],
  'Jakobshavn': [-49.6, 69.17], 'Okavango': [22.9, -19.3], 'Rondonia': [-63.5, -10.0],
  'Tonle Sap': [104.05, 12.95], 'Sudd': [30.7, 7.5], 'Mekong Delta': [105.6, 10.0],
  'Mamiraua': [-65.0, -2.7], 'Pantanal': [-57.2, -17.3], 'Fiji antimeridian': [179.9, -16.8],
  'Pine Island': [-100.0, -75.1], 'Svalbard': [16.0, 78.5],
};
for (const [name, [lon, lat]] of Object.entries(pts)) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  const hits = res.headers.get('cmr-hits');
  const { feed } = await res.json();
  const es = feed.entry;
  let fail = 0, noPoly = 0, noBrowse = 0, multiPoly = 0; const modes = new Set(), pols = new Set(), seen = new Map(), dups = [];
  const keys = new Set();
  for (const e of es) {
    Object.keys(e).forEach((k) => keys.add(k));
    const m = e.title.match(RE);
    if (!m) { fail++; console.log('  REGEX FAIL', e.title); continue; }
    modes.add(m[5]); pols.add(m[6]);
    if (!e.polygons?.[0]?.[0]) noPoly++;
    if ((e.polygons?.length ?? 0) > 1 || (e.polygons?.[0]?.length ?? 0) > 1) multiPoly++;
    if (!e.links.some((l) => l.rel.endsWith('browse#') && l.href.startsWith('https'))) noBrowse++;
    const k = `${m[2]}_${m[3]}_${m[4]}|${e.time_start.slice(0, 13)}`;
    if (seen.has(k)) dups.push([seen.get(k), e.title]); else seen.set(k, e.title);
  }
  console.log(`${name.padEnd(18)} hits=${hits} n=${es.length} regexFail=${fail} noPoly=${noPoly} multiPoly=${multiPoly} noBrowse=${noBrowse} dups=${dups.length} modes=${[...modes]} pols=${[...pols]}`);
  for (const d of dups.slice(0, 4)) console.log('   DUP', d[0].slice(17), '\n      ', d[1].slice(17));
  if (name === 'Mexico City') console.log('   entry keys:', [...keys].join(','));
}
````

## A2. Reading a window from a GCOV-layout HDF5 file (replaces sketch D3)

**File:** `<scratch>/review/geo-frontend-engineer/run2/d3/d3_fixed.py`  
**Bytes:** 2877, sha256 starts `0cee5bd76975e692`  
**Status:** `grid_window` and `read_window` ran under pytest on synthetic files (14 passed). `open_remote` was NOT run.

````python
"""D3 corrected. The index arithmetic is a pure function (testable without a file); the reader takes an open
h5py.File, so the same code runs on a local, synthetic or remote file."""
import math
import h5py, numpy as np
from pyproj import Transformer


def grid_window(x, y, xmin, ymin, xmax, ymax):
    """x, y: pixel-centre coordinates of a north-up grid (x ascending, y descending). Box in the same CRS.
    Returns (r0, r1, c0, c1, geotransform) for every pixel the box touches. Indices may run past the grid."""
    dx, dy = (x[-1] - x[0]) / (len(x) - 1), (y[-1] - y[0]) / (len(y) - 1)
    if not (dx > 0 > dy and np.allclose(np.diff(x), dx) and np.allclose(np.diff(y), dy)):
        raise ValueError(f"unexpected grid: dx={dx}, dy={dy} (want x ascending, y descending, even spacing)")
    west, north = x[0] - dx / 2, y[0] - dy / 2                   # outer edge of the first pixel
    c0, c1 = math.floor((xmin - west) / dx), math.ceil((xmax - west) / dx)
    r0, r1 = math.floor((north - ymax) / -dy), math.ceil((north - ymin) / -dy)
    return r0, r1, c0, c1, (float(west + c0 * dx), float(dx), 0.0, float(north + r0 * dy), 0.0, float(dy))


def read_window(h5, bbox, freq="A", terms=("HHHH", "HVHV")):
    """bbox = (west, south, east, north) in degrees. Returns (arrays, epsg, GDAL-style geotransform).
    Where the file does not cover the window the arrays hold NaN (mask 255), so every date of one stack
    returns the same shape and the same geotransform; assert that across dates."""
    g = h5[f"/science/LSAR/GCOV/grids/frequency{freq}"]
    x, y = g["xCoordinates"][:], g["yCoordinates"][:]            # pixel centres, metres
    epsg = int(g["projection"][()])
    # densified edges: the four corners alone under-cover the box, badly so in polar stereographic
    box = Transformer.from_crs(4326, epsg, always_xy=True).transform_bounds(*bbox, densify_pts=21)
    r0, r1, c0, c1, gt = grid_window(x, y, *box)
    fr0, fr1, fc0, fc1 = max(r0, 0), min(r1, len(y)), max(c0, 0), min(c1, len(x))   # the part inside this file
    if fr0 >= fr1 or fc0 >= fc1:
        raise ValueError(f"bbox {bbox} does not overlap this granule's grid")
    inside = (slice(fr0 - r0, fr1 - r0), slice(fc0 - c0, fc1 - c0))
    out = {}
    for t in [t for t in terms if t in g] + ["mask"]:
        fill, dtype = (255, "uint8") if t == "mask" else (np.nan, "float32")
        out[t] = np.full((r1 - r0, c1 - c0), fill, dtype)
        out[t][inside] = g[t][fr0:fr1, fc0:fc1]
    return out, epsg, gt


def open_remote(url):
    """NOT RUN in review (needs Earthdata credentials). Usage: with open_remote(url) as h5: read_window(h5, bbox)"""
    import earthaccess
    fs = earthaccess.get_fsspec_https_session()                  # call earthaccess.login(strategy="netrc") first
    return h5py.File(fs.open(url, mode="rb", cache_type="blockcache", block_size=8 * 1024 * 1024), "r")
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d3/test_d3_fixed.py`  
**Bytes:** 5273, sha256 starts `a5973bf3b66aeb2e`  
**Status:** ran: `14 passed in 1.13s`. Expects the fixture files in the current folder.

````python
import h5py, numpy as np, pytest
from pyproj import Transformer
from d3_fixed import grid_window, read_window

P = 20.0
X = 400000.0 + P * (np.arange(1200) + 0.5)          # same grid as utm48_full.h5
Y = 1500000.0 - P * (np.arange(1500) + 0.5)

@pytest.mark.parametrize("box, rows, cols, origin", [
    ((404000, 1488000, 408000, 1492000), (400, 600), (200, 400), (404000, 1492000)),   # on pixel edges: exact
    ((404010, 1487990, 408010, 1491990), (400, 601), (200, 401), (404000, 1492000)),   # on pixel centres: grows outward
    ((404011, 1488000, 408011, 1492000), (400, 600), (200, 401), (404000, 1492000)),   # 1 m past a centre
    ((404019.9, 1488000.1, 404020.1, 1488019.9), (599, 600), (200, 202), (404000, 1488020)),  # tiny box across an edge
    ((404010, 1488000, 404010, 1492000), (400, 600), (200, 201), (404000, 1492000)),   # zero-width box: 1 column
    ((420000, 1465000, 430000, 1475000), (1250, 1750), (1000, 1500), (420000, 1475000)),  # runs off east and south
    ((395000, 1498000, 402000, 1503000), (-150, 100), (-250, 100), (395000, 1503000)),    # runs off west and north
])
def test_grid_window(box, rows, cols, origin):
    r0, r1, c0, c1, gt = grid_window(X, Y, *box)
    assert (r0, r1) == rows and (c0, c1) == cols
    assert gt == (origin[0], 20.0, 0.0, origin[1], 0.0, -20.0)
    # the returned window always contains the requested box
    assert gt[0] <= box[0] and gt[0] + (c1 - c0) * 20 >= box[2] and gt[3] >= box[3] and gt[3] - (r1 - r0) * 20 <= box[1]

def test_grid_window_rejects_ascending_y():
    with pytest.raises(ValueError):
        grid_window(X, Y[::-1], 404000, 1488000, 408000, 1492000)

def decode_ok(arr, gt, lattice_origin, post=20.0):
    """index-coded fixture: value = (row_index % 1000) * 1000 + (col_index % 1000) on the absolute lattice"""
    rr, cc = np.nonzero(np.isfinite(arr))
    col = np.round((gt[0] + cc * post - lattice_origin[0]) / post).astype("int64")
    row = np.round((lattice_origin[1] - (gt[3] - rr * post)) / post).astype("int64")
    return np.array_equal(arr[rr, cc], ((row % 1000) * 1000.0 + (col % 1000)).astype("float32"))

def ll_box(epsg, xmin, ymin, xmax, ymax):
    t = Transformer.from_crs(epsg, 4326, always_xy=True)
    (lo0, lo1), (la0, la1) = t.transform([xmin, xmax], [ymin, ymax])
    return (lo0, la0, lo1, la1)

def test_read_window_values_and_georeference():
    with h5py.File("utm48_full.h5") as h5:
        out, epsg, gt = read_window(h5, ll_box(32648, 404000, 1488000, 408000, 1492000))
    assert epsg == 32648 and out["HHHH"].dtype == np.float32 and out["mask"].dtype == np.uint8
    assert out["HHHH"].shape == out["HVHV"].shape == out["mask"].shape
    assert gt[0] <= 404000 and gt[3] >= 1492000 and abs(gt[0] - 404000) <= 40 and abs(gt[3] - 1492000) <= 40
    assert np.isfinite(out["HHHH"]).all() and decode_ok(out["HHHH"], gt, (400000.0, 1500000.0))
    assert np.array_equal(out["HVHV"], out["HHHH"] + 0.5)

def test_partial_frame_same_shape_and_geotransform():
    box = ll_box(32648, 402000, 1486000, 410000, 1496000)       # sticks out of the partial frame to the west and north
    with h5py.File("utm48_full.h5") as a, h5py.File("utm48_partial.h5") as b:
        fa, _, gta = read_window(a, box); fb, _, gtb = read_window(b, box)
    assert gta == gtb and fa["HHHH"].shape == fb["HHHH"].shape
    have = np.isfinite(fb["HHHH"])
    assert 0 < have.sum() < have.size                           # some filled, some not
    assert np.array_equal(fa["HHHH"][have], fb["HHHH"][have])   # same ground, same values
    assert (fb["mask"][~have] == 255).all() and (fb["mask"][have] == 1).all()
    assert decode_ok(fb["HHHH"], gtb, (400000.0, 1500000.0))

def test_shifted_lattice_is_detectable():
    box = ll_box(32648, 404000, 1488000, 408000, 1492000)
    with h5py.File("utm48_full.h5") as a, h5py.File("utm48_shifted.h5") as b:
        _, _, gta = read_window(a, box); _, _, gtb = read_window(b, box)
    assert gta != gtb                                            # the caller's cross-date assert catches it

def test_outside_raises():
    with h5py.File("utm48_full.h5") as h5:
        for box in [(430000, 1488000, 440000, 1492000), (380000, 1488000, 390000, 1492000),
                    (404000, 1400000, 408000, 1410000), (404000, 1510000, 408000, 1520000)]:
            with pytest.raises(ValueError, match="does not overlap"):
                read_window(h5, ll_box(32648, *box))

def test_southern_hemisphere_utm():
    with h5py.File("utm21s.h5") as h5:
        out, epsg, gt = read_window(h5, ll_box(32721, 504000, 8088000, 508000, 8092000))
    assert epsg == 32721 and gt[5] == -20.0 and decode_ok(out["HHHH"], gt, (500000.0, 8100000.0))

def test_polar_stereographic_covers_whole_box():
    # a 2 x 0.5 degree box straddling the central meridian of EPSG:3413 (45 W), near 70 N
    box = (-46.0, 69.6, -44.0, 70.1)
    t = Transformer.from_crs(4326, 3413, always_xy=True)
    lon = np.linspace(box[0], box[2], 2001)
    true_ymin = min(t.transform(lon, np.full_like(lon, box[1]))[1])        # southern edge is an arc
    with h5py.File("ps_north.h5") as h5:
        out, epsg, gt = read_window(h5, box)
    assert epsg == 3413 and gt[3] - out["HHHH"].shape[0] * 20 <= true_ymin
    assert decode_ok(out["HHHH"], gt, (-60000.0, -2170000.0))
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d3/make_synth2.py`  
**Bytes:** 2556, sha256 starts `51167807c6b574b7`  
**Status:** ran. CAUTION: the last `make("ps_north.h5", ...)` line in `__main__` writes the polar fixture in the wrong place for the test above. The passing run rebuilt it with `make("ps_north.h5", 3413, -60000.0, -2170000.0, 20.0, 3600, 6000, lattice_origin=(-60000.0, -2170000.0))` (command B5). The docstring's formula for the index code is also stale; the code line is what the tests decode.

````python
"""Synthetic GCOV-layout files (Section 4.4 layout). Values are index-coded against an ABSOLUTE lattice so
windows from different files can be compared: HHHH = (northing_edge_index * 10000 + easting_edge_index)."""
import h5py, numpy as np

def make(path, epsg, x_edge, y_edge, post, nrows, ncols, lattice_origin=(0.0, 0.0)):
    with h5py.File(path, "w") as h:
        g = h.create_group("/science/LSAR/GCOV/grids/frequencyA")
        x = x_edge + post * (np.arange(ncols) + 0.5)
        y = y_edge - post * (np.arange(nrows) + 0.5)
        # absolute lattice indices of each pixel (independent of where this file starts)
        ci = np.round((x - post / 2 - lattice_origin[0]) / post).astype("int64")
        ri = np.round((lattice_origin[1] - (y + post / 2)) / post).astype("int64")
        code = (ri[:, None] % 1000) * 1000.0 + (ci[None, :] % 1000)
        hh = code.astype("float32"); hv = (code + 0.5).astype("float32")
        mask = np.ones((nrows, ncols), "uint8")
        kw = dict(chunks=(min(512, nrows), min(512, ncols)), compression="gzip", compression_opts=1)
        g.create_dataset("HHHH", data=hh, fillvalue=np.nan, **kw)
        g.create_dataset("HVHV", data=hv, fillvalue=np.nan, **kw)
        g.create_dataset("mask", data=mask, fillvalue=255, **kw)
        g.create_dataset("xCoordinates", data=x.astype("float64"))
        g.create_dataset("yCoordinates", data=y.astype("float64"))
        p = g.create_dataset("projection", data=np.uint32(epsg)); p.attrs["epsg_code"] = epsg
        g.create_dataset("listOfPolarizations", data=np.array([b"HH", b"HV"]))
        g.create_dataset("listOfCovarianceTerms", data=np.array([b"HHHH", b"HVHV"]))

if __name__ == "__main__":
    make("utm48_full.h5", 32648, 400000.0, 1500000.0, 20.0, 1500, 1200, lattice_origin=(400000.0, 1500000.0))
    # a "partial frame" of the same stack: same lattice, starts 300 rows further south and 200 columns further east
    make("utm48_partial.h5", 32648, 404000.0, 1494000.0, 20.0, 700, 600, lattice_origin=(400000.0, 1500000.0))
    # same area on a lattice shifted by half a pixel (must be detected by comparing geotransforms)
    make("utm48_shifted.h5", 32648, 400010.0, 1500010.0, 20.0, 1500, 1200, lattice_origin=(400000.0, 1500000.0))
    # southern-hemisphere UTM (false northing) and polar stereographic north
    make("utm21s.h5", 32721, 500000.0, 8100000.0, 20.0, 1500, 1200, lattice_origin=(500000.0, 8100000.0))
    make("ps_north.h5", 3413, -60000.0, -2040000.0, 20.0, 3000, 6000, lattice_origin=(-60000.0, -2040000.0))
    print("written")
````

## A3. Writing a web-ready COG (replaces sketch D5), with its checks

**File:** `<scratch>/review/geo-frontend-engineer/d5/d5_fixed.py`  
**Bytes:** 3374, sha256 starts `6aa616de5d86e710`  
**Status:** ran in both runs: `all variants passed with warnings treated as errors`. Identical copy at `run2/d5/d5_fixed.py`.

````python
"""Corrected D5 + stack variant. Tested with rio-cogeo 7.0.4, rasterio 1.5.2 (GDAL 3.12.2), morecantile 7.1.0."""
import warnings, os, sys, numpy as np, rasterio, morecantile
from rasterio.enums import ColorInterp
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles

def write_cog(src, dst, tags=None):
    """src: 8-bit GeoTIFF (any CRS) with nodata=0 declared and, ideally, scale/offset set so readers see dB."""
    profile = cog_profiles.get("deflate")
    profile.update(blockxsize=256, blockysize=256)            # what the browser COG reader recommends
    cog_translate(src, dst, profile,
                  tms=morecantile.tms.get("WebMercatorQuad"), # replaces the deprecated web_optimized=True
                  nodata=0, resampling="nearest",             # nearest keeps measured values intact
                  overview_resampling="average", in_memory=False, quiet=True,
                  additional_cog_metadata=tags or {})
    ok, errors, warns = cog_validate(dst, quiet=True)
    assert ok and not errors, errors
    with rasterio.open(dst) as ds:                            # the checks that matter to the web app
        assert ds.crs.to_epsg() == 3857 and ds.nodata == 0 and ds.overviews(1), (ds.crs, ds.nodata, ds.overviews(1))
        assert ColorInterp.alpha not in ds.colorinterp, "a band was tagged alpha: write the source with photometric='MINISBLACK'"
    return dst

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from make_src import synth_db, encode_db
    warnings.simplefilter("error")                            # any warning (deprecation, alpha/nodata) fails the test
    LO, HI = -25.0, 0.0; STEP = (HI - LO) / 254.0
    for nb in (1, 2, 3, 4, 11):
        n = 1200
        prof = dict(driver="GTiff", height=n, width=n, count=nb, dtype="uint8", crs="EPSG:32648",
                    transform=from_origin(400000.0, 1500000.0, 20.0, 20.0), nodata=0, compress="deflate", tiled=True,
                    photometric="MINISBLACK", interleave="pixel")           # <- stops GDAL calling bands RGB / alpha
        with rasterio.open(f"f_src{nb}.tif", "w", **prof) as d:
            for b in range(nb):
                lin = synth_db(n, seed=b)
                if b % 2: lin[300:500, 300:500] = np.nan
                d.write(encode_db(10 * np.log10(lin), LO, HI), b + 1)
                d.set_band_description(b + 1, f"2026-06-{19 + b:02d}")
            d.scales = (STEP,) * nb; d.offsets = (LO - STEP,) * nb
        with rasterio.open(f"f_src{nb}.tif") as d:
            print(f"source {nb} band(s): colorinterp={[c.name for c in d.colorinterp]}")
        write_cog(f"f_src{nb}.tif", f"f_cog{nb}.tif", tags={"AI_ASSISTED": "processing code written with AI assistance; see AI_USE.md"})
        with rasterio.open(f"f_cog{nb}.tif") as d:
            print(f"   cog: crs={d.crs} size={d.width}x{d.height} blocks={d.block_shapes[0]} ovr={d.overviews(1)} nodata={d.nodata} "
                  f"interleave={d.interleaving.name} colorinterp={[c.name for c in d.colorinterp][:5]} scale={d.scales[0]:.6f} offset={d.offsets[0]:.6f} "
                  f"tags.AI_ASSISTED={'AI_ASSISTED' in d.tags()} MB={os.path.getsize(f'f_cog{nb}.tif')/1e6:.2f}")
    print("all variants passed with warnings treated as errors")
````

**File:** `<scratch>/review/geo-frontend-engineer/d5/make_src.py`  
**Bytes:** 1559, sha256 starts `80eea622f4c94586`  
**Status:** ran. Holds `encode_db` (the Section 6.3 encoder) and the synthetic speckle generator that `d5_fixed.py` imports.

````python
"""8-bit source raster for the D5 test: UTM 48N, 20 m, nodata 0 declared, realistic speckle statistics."""
import sys, numpy as np, rasterio
from rasterio.transform import from_origin

def encode_db(db, lo=-25.0, hi=0.0):
    """Section 6.3 formula: 1 + round(254*(dB-lo)/(hi-lo)), clipped to 1..255, 0 = nodata."""
    dn = 1 + np.rint(254.0 * (db - lo) / (hi - lo))
    dn = np.clip(dn, 1, 255)
    return np.where(np.isfinite(db), dn, 0).astype("uint8")

def synth_db(n, enl=6.0, seed=0):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n
    mean_db = -14 + 6 * np.sin(6 * xx) * np.cos(5 * yy)            # smooth land signal, -20..-8 dB
    mean_db[(xx - 0.35) ** 2 + (yy - 0.55) ** 2 < 0.02] = -23.0    # a "lake"
    lin = 10 ** (mean_db / 10) * rng.gamma(enl, 1.0 / enl, (n, n))  # multiplicative speckle, ENL looks
    lin = lin.astype("float32")
    lin[(xx - yy) > 0.75] = np.nan                                  # rotated-frame style nodata wedge
    lin[:40, :40] = np.nan
    return lin

if __name__ == "__main__":
    out, n = sys.argv[1], int(sys.argv[2])
    lin = synth_db(n)
    dn = encode_db(10 * np.log10(lin))
    prof = dict(driver="GTiff", height=n, width=n, count=1, dtype="uint8", crs="EPSG:32648",
                transform=from_origin(400000.0, 1500000.0, 20.0, 20.0), nodata=0, compress="deflate", tiled=True)
    with rasterio.open(out, "w", **prof) as dst:
        dst.write(dn, 1)
    print(out, dn.shape, "nodata px:", int((dn == 0).sum()), "min valid:", int(dn[dn > 0].min()), "max:", int(dn.max()))
````

**File:** `<scratch>/review/geo-frontend-engineer/d5/check_overview_edges.py`  
**Bytes:** 1429, sha256 starts `d5c5bdbd6c6bad27`  
**Status:** ran on the as-written COG and on the fixed one; output in C8.

````python
"""Is the 'average' overview resampling nodata-aware (no dark fringe where data meets nodata)?"""
import sys, numpy as np, rasterio
p = sys.argv[1]
with rasterio.open(p) as ds:
    full = ds.read(1)
    for ov_i, f in enumerate(ds.overviews(1)):
        with rasterio.open(p, overview_level=ov_i) as o:
            ov = o.read(1)
        h, w = ov.shape
        blk = full[: h * f, : w * f].reshape(h, f, w, f).swapaxes(1, 2).reshape(h, w, f * f).astype("float64")
        valid = blk > 0
        nvalid = valid.sum(-1)
        mean_valid = np.where(nvalid > 0, (blk * valid).sum(-1) / np.maximum(nvalid, 1), 0)   # nodata-aware mean
        mean_naive = blk.mean(-1)                                                              # zeros averaged in
        mixed = (nvalid > 0) & (nvalid < f * f)                                                # blocks straddling the nodata edge
        d_aware = np.abs(ov[mixed] - mean_valid[mixed]); d_naive = np.abs(ov[mixed] - mean_naive[mixed])
        print(f"overview /{f}: mixed blocks={int(mixed.sum())}  |ov - nodata-aware mean| median={np.median(d_aware):.2f} max={d_aware.max():.2f}   "
              f"|ov - naive mean| median={np.median(d_naive):.2f}   ov==0 in mixed blocks: {int((ov[mixed] == 0).sum())}")
        allv = nvalid == f * f
        d = np.abs(ov[allv] - mean_valid[allv]); print(f"      fully-valid blocks: |ov - mean| median={np.median(d):.2f} max={d.max():.2f}")
````

**File:** `<scratch>/review/geo-frontend-engineer/d5/inspect_cog.py`  
**Bytes:** 1296, sha256 starts `4ecf23300f7d6351`  
**Status:** ran; printed the report in C6.

````python
import sys, json, os, numpy as np, rasterio
from rio_cogeo.cogeo import cog_validate, cog_info
p = sys.argv[1]
valid, errors, warnings = cog_validate(p, quiet=True)
print("cog_validate: valid =", valid, "errors =", errors, "warnings =", warnings)
with rasterio.open(p) as ds:
    print("driver", ds.driver, "crs", ds.crs, "size", ds.width, "x", ds.height, "count", ds.count, "dtype", ds.dtypes[0])
    print("nodata", ds.nodata, "res", ds.res, "bounds", tuple(round(v, 2) for v in ds.bounds))
    print("blocks", ds.block_shapes[0], "overviews", ds.overviews(1), "compress", ds.compression, "interleave", ds.interleaving, "photometric", ds.photometric)
    print("colorinterp", ds.colorinterp, "scales", ds.scales, "offsets", ds.offsets, "mask_flags", ds.mask_flag_enums[0])
    print("tags", ds.tags(), "| band1 tags", ds.tags(1), "| IMAGE_STRUCTURE", ds.tags(ns="IMAGE_STRUCTURE"))
    a = ds.read(1)
    print("full-res: nodata px", int((a == 0).sum()), "valid min/max", int(a[a > 0].min()), int(a.max()))
    for ov in ds.overviews(1):
        o = ds.read(1, out_shape=(ds.height // ov, ds.width // ov))
        print(f"  overview /{ov}: shape {o.shape} nodata px {int((o == 0).sum())} valid min {int(o[o > 0].min())} max {int(o.max())}")
print("size MB", round(os.path.getsize(p) / 1e6, 2))
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d5/alpha_trap.py`  
**Bytes:** 3009, sha256 starts `e12a0763f21e009b`  
**Status:** ran (run 2 only); printed C7. Demonstrates the RGB / RGBA tagging trap; not something to ship.

````python
"""Does a 3- or 4-band 8-bit 'one band per date' stack get mis-tagged as RGB / RGBA, and does it change any values?"""
import warnings, numpy as np, rasterio, morecantile
from rasterio.transform import from_origin
from rasterio.warp import transform as warp_transform
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
warnings.simplefilter("ignore")
n = 1024
rng = np.random.default_rng(0)
def src(path, nb, **extra):
    prof = dict(driver="GTiff", height=n, width=n, count=nb, dtype="uint8", crs="EPSG:32648",
                transform=from_origin(400000.0, 1500000.0, 20.0, 20.0), nodata=0, compress="deflate", tiled=True, **extra)
    with rasterio.open(path, "w", **prof) as d:
        for b in range(nb):
            a = rng.integers(100, 200, (n, n)).astype("uint8")       # all valid, 100..199
            if b == nb - 1:
                a[400:600, 400:600] = 0                              # the LAST date has a nodata hole here
            d.write(a, b + 1)
    return path
def probe(p):
    with rasterio.open(p) as d:
        # centre of the hole, in the COG's CRS
        x, y = warp_transform("EPSG:32648", d.crs, [400000.0 + 500 * 20], [1500000.0 - 500 * 20])
        r, c = d.index(x[0], y[0])
        full = d.read(window=((r - 20, r + 20), (c - 20, c + 20)))
        masks = d.read_masks(window=((r - 20, r + 20), (c - 20, c + 20)))
        line = f"  {p}: colorinterp={[ci.name for ci in d.colorinterp]} photometric={d.tags(ns='IMAGE_STRUCTURE').get('PHOTOMETRIC', d.profile.get('photometric'))}"
        line += f"\n      full res, inside the hole: band means={[round(float(full[b].mean()), 1) for b in range(d.count)]}  rasterio masks (255=valid)={[int(masks[b].min()) for b in range(d.count)]}"
        for i, f in enumerate(d.overviews(1)):
            with rasterio.open(p, overview_level=i) as o:
                rr, cc = o.index(x[0], y[0])
                ov = o.read(window=((rr - 4, rr + 4), (cc - 4, cc + 4)))
                line += f"\n      overview /{f}, inside the hole: band means={[round(float(ov[b].mean()), 1) for b in range(o.count)]}"
        print(line)
tms = morecantile.tms.get("WebMercatorQuad")
for nb in (3, 4, 5):
    print(f"--- {nb} bands, source written without photometric (GDAL default)")
    s = src(f"t_src{nb}.tif", nb)
    with rasterio.open(s) as d: print("  source colorinterp:", [c.name for c in d.colorinterp])
    cog_translate(s, f"t_cog{nb}.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
    probe(f"t_cog{nb}.tif")
    print(f"--- {nb} bands, source written with photometric='MINISBLACK'")
    s = src(f"t_src{nb}_mb.tif", nb, photometric="MINISBLACK")
    with rasterio.open(s) as d: print("  source colorinterp:", [c.name for c in d.colorinterp])
    cog_translate(s, f"t_cog{nb}_mb.tif", cog_profiles.get("deflate"), tms=tms, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
    probe(f"t_cog{nb}_mb.tif")
````

**File:** `<scratch>/review/geo-frontend-engineer/d5/size_table.py`  
**Bytes:** 2178, sha256 starts `f73295571f531f76`  
**Status:** ran in both runs; printed the size table in C9. Synthetic speckle.

````python
"""How big are 8-bit dB COGs of speckled SAR? bytes per SOURCE pixel (incl. overviews), by looks and compression."""
import os, sys, warnings, numpy as np, rasterio, morecantile
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_src import encode_db
warnings.simplefilter("ignore")
rng = np.random.default_rng(1)
n = 2400
yy, xx = np.mgrid[0:n, 0:n] / n
mean_db = -14 + 6 * np.sin(6 * xx) * np.cos(5 * yy)
mean_db[(xx - 0.35) ** 2 + (yy - 0.55) ** 2 < 0.02] = -23.0
def speckled(enl): return (10 ** (mean_db / 10) * rng.gamma(enl, 1.0 / enl, (n, n))).astype("float32")
def ml(a, k): return a.reshape(a.shape[0] // k, k, a.shape[1] // k, k).mean((1, 3))
rows = []
for enl in (3.0, 6.0):
    lin = speckled(enl)
    for k, post in ((1, 20.0), (2, 40.0), (4, 80.0)):
        a = ml(lin, k); dn = encode_db(10 * np.log10(a))
        src = f"s_{enl}_{k}.tif"
        with rasterio.open(src, "w", driver="GTiff", height=a.shape[0], width=a.shape[1], count=1, dtype="uint8", crs="EPSG:32648",
                           transform=from_origin(400000.0, 1500000.0, post, post), nodata=0, photometric="MINISBLACK") as d:
            d.write(dn, 1)
        for comp in ("deflate", "zstd"):
            prof = cog_profiles.get(comp); prof.update(blockxsize=256, blockysize=256)
            dst = f"c_{enl}_{k}_{comp}.tif"
            cog_translate(src, dst, prof, tms=morecantile.tms.get("WebMercatorQuad"), nodata=0, overview_resampling="average", in_memory=False, quiet=True)
            b = os.path.getsize(dst)
            with rasterio.open(dst) as d: z = d.tags().get("TILING_SCHEME_ZOOM_LEVEL")
            rows.append((enl, post, comp, b / a.size, z))
print("single-look-equiv ENL at 20 m | posting | compression | bytes per source pixel | web zoom | MB for a 100x100 km window per date per layer | x 11 dates x 2 pols")
for enl, post, comp, bpp, z in rows:
    npx = (100000 / post) ** 2
    print(f"  ENL20m={enl:>3}  {post:>4.0f} m  {comp:8s} {bpp:5.2f} B/px  z{z}   {bpp * npx / 1e6:6.1f} MB   {bpp * npx * 22 / 1e6:7.0f} MB")
````

**File:** `<scratch>/review/geo-frontend-engineer/d5/variants.py`  
**Bytes:** 3646, sha256 starts `92cee8cb459454f2`  
**Status:** ran in both runs; printed C6b. Its `[V3b]` case is the attempted profile-level fix that does not work.

````python
"""Variants of D5: does cog_translate carry scale/offset and tags; 256 blocks; multi-band stacks (3, 4, 11 bands)."""
import os, sys, inspect, numpy as np, rasterio, rio_cogeo
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_src import synth_db, encode_db

print("rio-cogeo", rio_cogeo.__version__, "rasterio", rasterio.__version__, "GDAL", rasterio.__gdal_version__)
print("cog_translate signature:", inspect.signature(cog_translate))
print("deflate profile:", dict(cog_profiles.get("deflate")))
LO, HI = -25.0, 0.0
STEP = (HI - LO) / 254.0

def src_tif(path, nb, n=1200, with_scale=True):
    prof = dict(driver="GTiff", height=n, width=n, count=nb, dtype="uint8", crs="EPSG:32648",
                transform=from_origin(400000.0, 1500000.0, 20.0, 20.0), nodata=0, compress="deflate", tiled=True)
    with rasterio.open(path, "w", **prof) as dst:
        for b in range(nb):
            lin = synth_db(n, seed=b)
            if b % 2 == 1:
                lin[300:500, 300:500] = np.nan            # nodata on SOME dates only
            dst.write(encode_db(10 * np.log10(lin), LO, HI), b + 1)
            dst.set_band_description(b + 1, f"2026-06-{19 + b:02d}")
        if with_scale:
            dst.scales = (STEP,) * nb
            dst.offsets = (LO - STEP,) * nb               # dB = DN*STEP + (LO-STEP)  <=>  dB = LO + (DN-1)*STEP
        dst.update_tags(AI_ASSISTED="yes; see AI_USE.md", SOURCE_GRANULE="NISAR_L2_PR_GCOV_xxx", ENCODING_LO=str(LO), ENCODING_HI=str(HI))
    return path

def report(p):
    v = cog_validate(p, quiet=True)
    with rasterio.open(p) as ds:
        print(f"   {os.path.basename(p)}: valid={v[0]} warn={v[2]} crs={ds.crs} size={ds.width}x{ds.height} bands={ds.count} nodata={ds.nodatavals} "
              f"blocks={ds.block_shapes[0]} ovr={ds.overviews(1)} interleave={ds.interleaving} photometric={ds.photometric}\n"
              f"      colorinterp={[c.name for c in ds.colorinterp]} scales={ds.scales[:2]} offsets={ds.offsets[:2]} descriptions={ds.descriptions[:3]} tags={ds.tags()}\n"
              f"      size={os.path.getsize(p)/1e6:.2f} MB")

print("\n[V1] as written, source carries scale/offset, tags, band descriptions")
s = src_tif("v_src1.tif", 1)
cog_translate(s, "v1.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
report("v1.tif")

print("\n[V2] 256x256 blocks + forward_band_tags + additional_cog_metadata")
prof = cog_profiles.get("deflate"); prof.update(blockxsize=256, blockysize=256)
cog_translate(s, "v2.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True,
              forward_band_tags=True, additional_cog_metadata={"AI_ASSISTED": "yes; see AI_USE.md"})
report("v2.tif")

for nb in (3, 4, 11):
    print(f"\n[V3] {nb}-band stack, as-written call")
    s = src_tif(f"v_src_stack{nb}.tif", nb)
    cog_translate(s, f"v3_stack{nb}.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
    report(f"v3_stack{nb}.tif")
    print(f"[V3b] {nb}-band stack, photometric=MINISBLACK, interleave=pixel explicitly, 256 blocks")
    prof = cog_profiles.get("deflate"); prof.update(blockxsize=256, blockysize=256, interleave="pixel", photometric="MINISBLACK")
    cog_translate(s, f"v3b_stack{nb}.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
    report(f"v3b_stack{nb}.tif")
````

## A4. The 8-bit encoding (Section 6.3)

**File:** `<scratch>/review/geo-frontend-engineer/enc/roundtrip.py`  
**Bytes:** 2282, sha256 starts `401624cb656417e4`  
**Status:** ran in run 1; output in C10. `enc` and `dec` are the pair to reuse.

````python
"""Section 6.3 encoding: DN = 1 + round(254*(dB-lo)/(hi-lo)) clipped to 1..255, 0 = nodata."""
import numpy as np
def enc(db, lo, hi):
    dn = np.clip(1 + np.rint(254.0 * (db - lo) / (hi - lo)), 1, 255)
    return np.where(np.isfinite(db), dn, 0).astype("uint8")
def dec(dn, lo, hi):                       # the inverse the brief implies but never writes down
    return np.where(dn == 0, np.nan, lo + (dn.astype("float64") - 1) * (hi - lo) / 254.0)
for lo, hi in ((-25.0, 0.0), (-35.0, -5.0), (-25.0, -8.0), (-10.0, 10.0)):
    step = (hi - lo) / 254.0
    db = np.linspace(lo, hi, 2_000_001)
    err = np.abs(dec(enc(db, lo, hi), lo, hi) - db)
    dn_all = np.arange(1, 256, dtype="uint8")
    stable = np.array_equal(enc(dec(dn_all, lo, hi), lo, hi), dn_all)            # DN -> dB -> DN is the identity
    print(f"lo={lo} hi={hi}: step={step:.5f} dB  max in-range error={err.max():.5f} (step/2={step/2:.5f})  "
          f"DN->dB->DN identity={stable}  enc(lo)={enc(np.array([lo]),lo,hi)[0]} enc(hi)={enc(np.array([hi]),lo,hi)[0]} "
          f"enc(lo-5)={enc(np.array([lo-5]),lo,hi)[0]} enc(hi+5)={enc(np.array([hi+5]),lo,hi)[0]} enc(nan)={enc(np.array([np.nan]),lo,hi)[0]} "
          f"enc(-inf)={enc(np.array([-np.inf]),lo,hi)[0]}")
# wrong-but-plausible decoders a second session might write, and their error
lo, hi = -25.0, 0.0; dn = np.arange(1, 256).astype("float64"); true = lo + (dn - 1) * (hi - lo) / 254
for name, f in (("lo + DN/255*(hi-lo)", lo + dn / 255 * (hi - lo)), ("lo + DN/254*(hi-lo)", lo + dn / 254 * (hi - lo)), ("lo + (DN-1)/255*(hi-lo)", lo + (dn - 1) / 255 * (hi - lo))):
    print(f"   decoder '{name}': max abs error {np.abs(f - true).max():.3f} dB")
# GDAL scale/offset equivalent
scale = (hi - lo) / 254; offset = lo - scale
print("scale/offset form: dB = DN*scale + offset with scale=%.10f offset=%.10f ; max diff vs formula %.2e" % (scale, offset, np.abs(dn * scale + offset - true).max()))
# log of zero / negative linear power
with np.errstate(divide="ignore", invalid="ignore"):
    lin = np.array([0.0, -1e-3, 1e-12, np.nan, 0.05], dtype="float32"); db = 10 * np.log10(lin)
print("10*log10 of [0, -1e-3, 1e-12, nan, 0.05] ->", db, "-> DN", enc(db, lo, hi), " (0 linear power -> -inf -> isfinite False -> nodata; 1e-12 -> clipped to DN 1)")
````

## A5. The web stack test page and its driver

**File:** `<scratch>/review/geo-frontend-engineer/run2/web6/src/main.js`  
**Bytes:** 6383, sha256 starts `aaaeb352a854a1a2`  
**Status:** ran in headless Chrome against the Vite dev server and against a production build served by `vite preview`, MapLibre GL JS 6.18.0; results in C13.

````js
// Throwaway library test (review scratch). Checks the claims in Section 6.5 of the brief in a real browser.
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
maplibregl.setWorkerUrl(workerUrl);
import 'maplibre-gl/dist/maplibre-gl.css';
import { cogProtocol, locationValues, setColorFunction, getCogMetadata } from '@geomatico/maplibre-cog-protocol';
import syncMove from '@mapbox/mapbox-gl-sync-move';

const R = (window.__results = {});
const BASE = import.meta.env.BASE_URL; // '/NASA-space-apps-2026/'
R.base = BASE;
R.maplibreVersion = maplibregl.getVersion();
maplibregl.addProtocol('cog', cogProtocol);

const style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ff00ff' } }] };
const mk = (container) => new maplibregl.Map({
  container, style, center: [104.19, 13.455], zoom: 10.5, attributionControl: false, fadeDuration: 0,
  canvasContextAttributes: { preserveDrawingBuffer: true }, pixelRatio: 1,
});
const a = mk('a'), b = mk('b');
const loaded = (m) => new Promise((res) => (m.loaded() ? res() : m.once('load', res)));
const idle = (m) => new Promise((res) => m.once('idle', res));
const px = (m, lngLat) => {
  const p = m.project(lngLat); const gl = m.getCanvas().getContext('webgl2') || m.getCanvas().getContext('webgl');
  const out = new Uint8Array(4); gl.readPixels(Math.round(p.x), m.getCanvas().height - Math.round(p.y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return Array.from(out);
};
const P = { centre: [104.187007, 13.458629], lake: [104.153789, 13.44767], wedge: [104.288331, 13.558395], hole: [104.149928, 13.494672], outside: [104.03, 13.60] };
const errors = (R.mapErrors = []);
a.on('error', (e) => errors.push('A: ' + (e.error?.message ?? String(e.error))));
b.on('error', (e) => errors.push('B: ' + (e.error?.message ?? String(e.error))));

async function show(m, id, url) {
  for (const l of m.getStyle().layers) if (l.id !== 'bg') m.removeLayer(l.id);
  for (const s of Object.keys(m.getStyle().sources)) m.removeSource(s);
  m.addSource(id, { type: 'raster', url, tileSize: 256 });
  m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  await idle(m);
  return Object.fromEntries(Object.entries(P).map(([k, v]) => [k, px(m, v)]));
}

(async () => {
  try {
    await Promise.all([loaded(a), loaded(b)]);
    const abs = new URL(BASE + 'data/', location.href).href; // absolute URL of the data folder

    // 1. colour ramp on a COG that declares scale/offset: min,max given in dB
    R.ramp_dB_on_scaled = await show(a, 's1', `cog://${abs}hh_fixed.tif#color:BrewerYlGnBu9,-25,0,c`);
    // 2. same ramp given in dB on the as-written COG (no scale/offset): expect saturation
    R.ramp_dB_on_unscaled = await show(a, 's2', `cog://${abs}as_written.tif#color:BrewerYlGnBu9,-25,0,c`);
    // 3. ramp given in DN on the as-written COG
    R.ramp_DN_on_unscaled = await show(a, 's3', `cog://${abs}as_written.tif#color:BrewerYlGnBu9,1,255,c`);
    // 4. plain grey rendering (no #color)
    R.grey_fixed = await show(a, 's4', `cog://${abs}hh_fixed.tif`);
    // 5. URL forms
    R.url_root_relative = await show(a, 's5', `cog://${BASE}data/hh_fixed.tif#color:BrewerYlGnBu9,-25,0,c`).catch((e) => 'THROW ' + e.message);
    R.url_relative = await show(a, 's6', `cog://data/hh_fixed.tif#color:BrewerYlGnBu9,-25,0,c`).catch((e) => 'THROW ' + e.message);
    // 6. multi-band stack: default rendering, then a colour function choosing a band
    R.stack_default = await show(a, 's7', `cog://${abs}stack11.tif`);
    setColorFunction(`${abs}stack11.tif`, (pixel, color, md) => {
      const v = pixel[1]; // band 2 (has the hole)
      if (v === md.noData) color.set([0, 0, 0, 0]); else color.set([v, 0, 255 - v, 255]);
    });
    R.stack_band2_colorfn = await show(a, 's8', `cog://${abs}stack11.tif`);
    R.metadata_fixed = await getCogMetadata(`${abs}hh_fixed.tif`).then((m) => ({ scale: m.scale, offset: m.offset, noData: m.noData, bbox: m.bbox, photometric: m.photometricInterpretation, alphaBand: m.alphaBand, images: m.images }));
    R.metadata_as_written = await getCogMetadata(`${abs}as_written.tif`).then((m) => ({ scale: m.scale, offset: m.offset, noData: m.noData, images: m.images }));
    R.metadata_rgba = await getCogMetadata(`${abs}stack4_rgba.tif`).then((m) => ({ noData: m.noData, photometric: m.photometricInterpretation, alphaBand: m.alphaBand }));

    // 7. pixel queries
    const q = (f, p, z) => locationValues(`${abs}${f}`, { latitude: p[1], longitude: p[0] }, z).then((v) => v.map((x) => (Number.isNaN(x) ? 'NaN' : Math.round(x * 1000) / 1000)));
    R.lv_fixed_centre = await q('hh_fixed.tif', P.centre);
    R.lv_fixed_centre_z10 = await q('hh_fixed.tif', P.centre, 10);
    R.lv_fixed_centre_z5 = await q('hh_fixed.tif', P.centre, 5);
    R.lv_fixed_lake = await q('hh_fixed.tif', P.lake);
    R.lv_fixed_wedge = await q('hh_fixed.tif', P.wedge);
    R.lv_fixed_outside = await q('hh_fixed.tif', P.outside);
    R.lv_as_written_centre = await q('as_written.tif', P.centre);
    R.lv_stack_centre = await q('stack11.tif', P.centre);
    R.lv_stack_hole = await q('stack11.tif', P.hole);
    R.lv_stack4_fixed_hole = await q('stack4_fixed.tif', P.hole);
    R.lv_stack4_rgba_hole = await q('stack4_rgba.tif', P.hole);

    // 8. two maps kept in sync
    await show(b, 'sb', `cog://${abs}hh_fixed.tif#color:BrewerYlGnBu9,-25,0,c`);
    syncMove(a, b);
    a.jumpTo({ center: [104.2, 13.47], zoom: 11.2 });
    await idle(b);
    R.sync = { a: [a.getCenter().lng, a.getCenter().lat, a.getZoom()], b: [b.getCenter().lng, b.getCenter().lat, b.getZoom()] };

    a.addSource('gj', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[104.1, 13.4], [104.3, 13.4], [104.3, 13.5], [104.1, 13.5], [104.1, 13.4]]] }, properties: {} } });
    a.addLayer({ id: 'gj', type: 'fill', source: 'gj', paint: { 'fill-color': '#00ff00' } });
    await idle(a);
    R.geojson_fill_px = px(a, [104.2, 13.47]);
    // 9. missing file (Vite answers 200 + index.html)
    R.missing = await locationValues(`${abs}nope.tif`, { latitude: 13.45, longitude: 104.19 }).then((v) => 'resolved ' + JSON.stringify(v), (e) => 'rejected: ' + e.message);
  } catch (e) {
    R.fatal = String(e?.stack ?? e);
  }
  window.__done = true;
})();
````

**The MapLibre 5.24.1 version of the same page** is `<scratch>/review/geo-frontend-engineer/run2/web/src/main.js`. It ran too (results in C12). It differs from the file above only as this diff shows (computed here from the two files; lines starting `-` are the 6.18.0 form, `+` the 5.24.1 form):

````diff
--- run2/web6/src/main.js (MapLibre 6.18.0)
+++ run2/web/src/main.js (MapLibre 5.24.1)
@@ -2,3 +2 @@
-import * as maplibregl from 'maplibre-gl';
-import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
-maplibregl.setWorkerUrl(workerUrl);
+import maplibregl from 'maplibre-gl';
@@ -12 +10 @@
-R.maplibreVersion = maplibregl.getVersion();
+R.maplibreVersion = maplibregl.getVersion?.() ?? maplibregl.version;
@@ -90,4 +87,0 @@
-    a.addSource('gj', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[104.1, 13.4], [104.3, 13.4], [104.3, 13.5], [104.1, 13.5], [104.1, 13.4]]] }, properties: {} } });
-    a.addLayer({ id: 'gj', type: 'fill', source: 'gj', paint: { 'fill-color': '#00ff00' } });
-    await idle(a);
-    R.geojson_fill_px = px(a, [104.2, 13.47]);
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/web/drive.mjs`  
**Bytes:** 1838, sha256 starts `70b4173f6a4b2341`  
**Status:** ran; the same file drove both versions (`run2/web6/drive.mjs` is identical). Hard-codes the macOS Chrome path.

````js
import puppeteer from 'puppeteer-core';
const url = process.argv[2]; const shot = process.argv[3];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1100,600'] });
const page = await browser.newPage();
await page.setViewport({ width: 1040, height: 520, deviceScaleFactor: 1 });
const logs = [], reqs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
page.on('pageerror', (e) => logs.push('[pageerror] ' + String(e).slice(0, 400)));
page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url().slice(0, 200) + ' ' + r.failure()?.errorText));
page.on('response', (r) => { const u = r.url(); if (/\.(tif|h5)(\?|$)/.test(u)) reqs.push([u.split('/').pop(), r.status(), r.request().headers()['range'] ?? '', r.headers()['content-length'] ?? '']); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__done === true', { timeout: 120000 }).catch((e) => logs.push('TIMEOUT ' + e.message));
const results = await page.evaluate(() => window.__results);
for (const [k, v] of Object.entries(results)) console.log(k.padEnd(24), JSON.stringify(v));
console.log('--- console/log lines:'); for (const l of logs) console.log(l);
const byFile = {};
for (const [f, s, range, len] of reqs) { const k = `${f} ${s}`; (byFile[k] ??= { n: 0, bytes: 0, ranged: 0 }); byFile[k].n++; byFile[k].bytes += Number(len || 0); if (range) byFile[k].ranged++; }
console.log('--- tif requests by file+status:', JSON.stringify(byFile));
console.log('--- first 6 requests:', JSON.stringify(reqs.slice(0, 6)));
if (shot) await page.screenshot({ path: shot });
await browser.close();
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/web/package.json`  
**Bytes:** 272, sha256 starts `f91dcfedb7f67fe9`  
**Status:** the 5.24.1 scratch project. Installed with `npm ci` from the lock file beside it.

````json
{"name":"review-scratch-throwaway","private":true,"version":"0.0.0","type":"module","dependencies":{"@geomatico/maplibre-cog-protocol":"^0.10.0","@mapbox/mapbox-gl-sync-move":"^0.4.0","geotiff":"^3.0.5","maplibre-gl":"^5.24.1","puppeteer-core":"^25.17.0","vite":"^8.3.8"}}
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/web6/package.json`  
**Bytes:** 271, sha256 starts `0f021fbca0047bb3`  
**Status:** the 6.18.0 scratch project.

````json
{"name":"review-scratch-throwaway","private":true,"version":"0.0.0","type":"module","dependencies":{"@geomatico/maplibre-cog-protocol":"^0.10.0","@mapbox/mapbox-gl-sync-move":"^0.4.0","geotiff":"^3.0.5","maplibre-gl":"6.18.0","puppeteer-core":"^25.17.0","vite":"^8.3.8"}}
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/web/vite.config.js`  
**Bytes:** 163, sha256 starts `4a3aaf278cc98d7c`  
**Status:** used by both scratch projects.

````js
import { defineConfig } from 'vite';
// mirrors a GitHub Pages project site served under /<repo>/
export default defineConfig({ base: '/NASA-space-apps-2026/' });
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/web/index.html`  
**Bytes:** 316, sha256 starts `cce46d8c8014ebd3`  
**Status:** used by both scratch projects.

````html
<!doctype html>
<html><head><meta charset="utf-8"><title>scratch range/cog test</title>
<style>html,body{margin:0}#a,#b{position:absolute;top:0;width:512px;height:512px}#a{left:0}#b{left:512px}</style></head>
<body><div id="a"></div><div id="b"></div><script type="module" src="/src/main.js"></script></body></html>
````

## A6. Preview PNGs (sketch D4)

**File:** `<scratch>/review/geo-frontend-engineer/run2/d4/code/fetch_previews.mjs`  
**Bytes:** 1050, sha256 starts `cdf957ad9bbb4219`  
**Status:** ran; downloaded three previews without login (C14). Imports `../../d1/d1_fixed.mjs`.

````js
// Download the public _LATLON.png previews for chosen dates of one stack (no login). Usage: node fetch_previews.mjs lon lat stack outDir date...
import { writeFile } from 'node:fs/promises';
import { nisarGranules, byStack } from '../../d1/d1_fixed.mjs';
const [lon, lat, stack, outDir, ...dates] = process.argv.slice(2);
const list = byStack(await nisarGranules(Number(lon), Number(lat)))[stack] ?? [];
const meta = [];
for (const g of list.filter((x) => dates.length === 0 || dates.includes(x.date))) {
  const res = await fetch(g.preview);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${outDir}/${stack}_${g.date}.png`;
  await writeFile(file, buf);
  meta.push({ date: g.date, name: g.name, polygons: g.polygons, file, bytes: buf.length, status: res.status, type: res.headers.get('content-type'), finalUrlHost: new URL(res.url).host });
  console.log(g.date, res.status, res.headers.get('content-type'), buf.length, new URL(res.url).host);
}
await writeFile(`${outDir}/${stack}_meta.json`, JSON.stringify(meta, null, 1));
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d4/code/d4_check.py`  
**Bytes:** 2978, sha256 starts `81aab3b48468f88f`  
**Status:** ran; printed C14. The four lines between the `# ---- the brief's formulas, verbatim ----` markers are D4 itself.

````python
"""D4 as written in the brief, applied to freshly downloaded previews. Usage: python -I d4_check.py meta.json"""
import json, sys, warnings
import numpy as np, rasterio
warnings.simplefilter("ignore")
meta = json.load(open(sys.argv[1]))
out = []
for m in meta:
    with rasterio.open(m["file"]) as d:
        im = d.read()                                   # (bands, H, W)
    H, W = im.shape[1:]
    lit = im[:3].max(axis=0) > 0
    ys, xs = np.nonzero(lit)
    xl, xr, yt, yb = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    pts = np.array(m["polygons"][0].split(), float).reshape(-1, 2)[:-1]      # (lat, lon) pairs, closing point dropped
    lat, lon = pts[:, 0], pts[:, 1]
    lon_min, lon_max, lat_min, lat_max = lon.min(), lon.max(), lat.min(), lat.max()
    # ---- the brief's formulas, verbatim ----
    dlon = (lon_max - lon_min) / (xr - xl); west = lon_min - xl * dlon; east = west + W * dlon
    dlat = (lat_max - lat_min) / (yb - yt); north = lat_max + yt * dlat; south = north - H * dlat
    # ----
    print(f"{m['date']}: {W}x{H} bands={im.shape[0]} footprint xl={xl} xr={xr} yt={yt} yb={yb} lit={100*lit.mean():.1f}%")
    print(f"   polygon lon {lon_min}..{lon_max} lat {lat_min}..{lat_max}")
    print(f"   brief formulas -> west {west:.4f} east {east:.4f} north {north:.4f} south {south:.4f}   dlon {dlon:.7f} dlat {dlat:.7f} deg/px  ({dlon*111320*np.cos(np.radians((north+south)/2)):.1f} m x {dlat*110574:.1f} m)")
    # independent check, using the coordinate NOT used by the fit: each polygon corner is an extreme in one axis;
    # where does the footprint's extreme pixel sit along the other axis, and where does the fit predict it?
    col = lambda lo: (lo - west) / dlon
    row = lambda la: (north - la) / dlat
    res = []
    i = lon.argmin(); res.append(("W corner row", row(lat[i]), float(np.median(ys[xs == xl]))))
    i = lon.argmax(); res.append(("E corner row", row(lat[i]), float(np.median(ys[xs == xr]))))
    i = lat.argmax(); res.append(("N corner col", col(lon[i]), float(np.median(xs[ys == yt]))))
    i = lat.argmin(); res.append(("S corner col", col(lon[i]), float(np.median(xs[ys == yb]))))
    print("   cross-check (predicted vs observed, px):", "; ".join(f"{n} {p:.1f} vs {o:.1f} (d={p-o:+.1f})" for n, p, o in res))
    out.append(dict(date=m["date"], W=W, H=H, xl=xl, xr=xr, yt=yt, yb=yb, west=west, east=east, north=north, south=south, dlon=dlon, dlat=dlat))
json.dump(out, open(sys.argv[2], "w"), indent=1)
w = [o["west"] for o in out]; e = [o["east"] for o in out]; n = [o["north"] for o in out]; s = [o["south"] for o in out]
print("spread across dates (deg): west %.5f east %.5f north %.5f south %.5f  -> in px: %.2f %.2f %.2f %.2f" % (max(w)-min(w), max(e)-min(e), max(n)-min(n), max(s)-min(s), (max(w)-min(w))/out[0]["dlon"], (max(e)-min(e))/out[0]["dlon"], (max(n)-min(n))/out[0]["dlat"], (max(s)-min(s))/out[0]["dlat"]))
print("brief quotes: west 102.3865, east 105.5270, north 14.3420, south 11.3330")
````

## A7. Registry queries

**File:** `<scratch>/review/geo-frontend-engineer/run2/registry/npm_info.py`  
**Bytes:** 1257, sha256 starts `1addabd35645f12c`  
**Status:** ran; printed C16.

````python
import json, re, subprocess, sys, urllib.parse
def key(s):
    m = re.match(r"(\d+)\.(\d+)\.(\d+)$", s)
    return tuple(map(int, m.groups())) if m else None
for pkg in sys.argv[1:]:
    raw = subprocess.run(["/usr/bin/curl", "-s", "https://registry.npmjs.org/" + urllib.parse.quote(pkg, safe="@")], capture_output=True, text=True).stdout
    d = json.loads(raw)
    tags = d.get("dist-tags", {}); t = d.get("time", {}); latest = tags.get("latest"); v = d["versions"][latest]
    print(f"{d.get('name')}: dist-tags={tags}")
    print(f"   latest {latest} published {t.get(latest, '?')[:10]}; type={v.get('type')} main={v.get('main')} module={v.get('module')} "
          f"exports={'yes' if v.get('exports') else 'no'} peerDeps={v.get('peerDependencies')} license={v.get('license')} engines={v.get('engines')}")
    print(f"   deps={v.get('dependencies')}")
    majors = {}
    for s in d["versions"]:
        k = key(s)
        if k: majors[k[0]] = max(majors.get(k[0], (0, 0, 0)), k)
    print("   newest stable per major:", {m: ".".join(map(str, k)) + " (" + t.get(".".join(map(str, k)), "?")[:10] + ")" for m, k in sorted(majors.items())[-4:]})
    json.dump({"latest": latest, "exports": v.get("exports")}, open(pkg.replace("/", "__") + ".json", "w"))
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/registry/pypi_info.py`  
**Bytes:** 829, sha256 starts `a82166e0ca996c15`  
**Status:** ran; printed C16.

````python
import json, subprocess, sys
for pkg in sys.argv[1:]:
    raw = subprocess.run(["/usr/bin/curl", "-s", f"https://pypi.org/pypi/{pkg}/json"], capture_output=True, text=True).stdout
    d = json.loads(raw); info = d["info"]; ver = info["version"]
    files = d["releases"].get(ver, [])
    up = min((f["upload_time"][:10] for f in files), default="?")
    wheels = sorted({f["filename"].split("-", 2)[2] for f in files if f["filename"].endswith(".whl")})
    mac = [w for w in wheels if "macosx" in w and "arm64" in w]
    print(f"{pkg}: latest {ver} ({up}) requires_python={info.get('requires_python')} wheels={len(wheels)} mac-arm64-wheels={mac[:6]}")
    if pkg in ("rio-cogeo", "earthaccess", "asf-search", "rasterio"):
        print("    requires_dist:", [r for r in (info.get("requires_dist") or []) if "extra ==" not in r])
````

---

# Appendix B. Shell commands that ran, copied from the transcripts

These are the commands exactly as the earlier runs issued them, so they contain that machine's paths. `SP` and `R` are the scratch folder. Output for each is in Appendix C.

### B1. CMR cross-origin headers, preflight, error shape

Source: run 2, tool call 21 (2026-11-14 07:47:15 UTC). What it did: Check CMR cross-origin headers, preflight and error response shape.  
Output: C4.

````bash
cd /tmp; U='https://cmr.earthdata.nasa.gov/search/granules.json?point=104.05,12.95&page_size=2&sort_key=start_date&collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF'; echo "== GET with Origin"; /usr/bin/curl -s -D - -o /dev/null -H 'Origin: http://localhost:5173' "$U" | grep -i -E '^(HTTP|access-control|cmr-|content-type|content-encoding|cache-control|vary)'; echo "== OPTIONS preflight for CMR-Search-After header"; /usr/bin/curl -s -D - -o /dev/null -X OPTIONS -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: cmr-search-after' "$U" | grep -i -E '^(HTTP|access-control|allow)'; echo "== bad request shape"; /usr/bin/curl -s -H 'Origin: http://localhost:5173' 'https://cmr.earthdata.nasa.gov/search/granules.json?point=104.05&collection_concept_id=C2854338529-ASF' | head -c 400; echo; echo "== page_size 2001"; /usr/bin/curl -s 'https://cmr.earthdata.nasa.gov/search/granules.json?point=104.05,12.95&page_size=2001&collection_concept_id=C2854338529-ASF' | head -c 300; echo
````

### B2. Which dates the GIBS NISAR layer holds at one tile

Source: run 2, tool call 22 (2026-11-14 07:47:45 UTC). What it did: Check which UTC dates the GIBS NISAR layer holds data for at the test point.  
Output: C5.

````bash
cd /tmp; /opt/anaconda3/bin/python3 - <<'EOF'
import math, subprocess
lon, lat, z = 104.05, 12.95, 8
n = 2**z
x = int((lon + 180) / 360 * n)
y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
print("tile", z, y, x)
for d in ["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-24", "2026-10-29", "2026-10-30", "2026-11-03", "2026-11-10", "2026-11-12", "2026-11-13"]:
    url = f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{d}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png"
    r = subprocess.run(["/usr/bin/curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{size_download} %{content_type}", url], capture_output=True, text=True)
    print(d, r.stdout)
EOF
````

### B3. Does Python's http.server honour Range (3.12 and 3.14)

Source: run 2, tool call 30 (2026-11-14 07:51:23 UTC). What it did: Test whether Python's http.server honours Range requests (3.12 and 3.14).  
Output: C11.

````bash
SP=<scratch>/review/geo-frontend-engineer; mkdir -p $SP/run2/range/site && cd $SP/run2/range && cp ../d3/utm48_full.h5 site/test.bin && ls -la site/test.bin | awk '{print $5}';
probe() { # $1 label, $2 url
  echo "== $1";
  echo -n "  HEAD + Range 0-99 : "; /usr/bin/curl -s -r 0-99 -I "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|accept-ranges)' | tr '\n' ' '; echo
  echo -n "  GET  + Range 0-99 : "; /usr/bin/curl -s -r 0-99 -D - -o out.bin "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|accept-ranges)' | tr '\n' ' '; echo "| body bytes: $(wc -c < out.bin | tr -d ' ')"
  echo -n "  GET  + Range 1000-1999 with Origin: "; /usr/bin/curl -s -r 1000-1999 -H 'Origin: http://localhost:9999' -D - -o out.bin "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-range|access-control)' | tr '\n' ' '; echo "| body bytes: $(wc -c < out.bin | tr -d ' ')"
}
for PY in /opt/anaconda3/bin/python3 /opt/homebrew/bin/python3.14; do
  PORT=$((8611 + RANDOM % 200));
  ( cd site && exec $PY -m http.server $PORT --bind 127.0.0.1 > ../py_$(basename $PY).log 2>&1 ) &
  PID=$!
  /usr/bin/curl -s -o /dev/null --retry 20 --retry-connrefused --retry-delay 1 http://127.0.0.1:$PORT/
  probe "$($PY --version) http.server" http://127.0.0.1:$PORT/test.bin
  kill $PID 2>/dev/null; wait $PID 2>/dev/null
done; rm -f out.bin
````

### B4. Range behaviour of the Vite dev server and vite preview

Source: run 2, tool call 47 (2026-11-14 07:56:15 UTC). What it did: Test Range request handling of the Vite dev server and vite preview.  
Output: C11.

````bash
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/web && mkdir -p public/data src && cp ../d5/cog_as_written.tif public/data/as_written.tif && cp ../d5/f_cog1.tif public/data/hh_fixed.tif && cp ../d5/f_cog11.tif public/data/stack11.tif && cp ../d5/f_cog4.tif public/data/stack4_fixed.tif && cp ../d5/t_cog4.tif public/data/stack4_rgba.tif && cp ../d3/utm48_full.h5 public/data/synth.h5 && cat > index.html <<'EOF'
<!doctype html>
<html><head><meta charset="utf-8"><title>scratch range/cog test</title>
<style>html,body{margin:0}#a,#b{position:absolute;top:0;width:512px;height:512px}#a{left:0}#b{left:512px}</style></head>
<body><div id="a"></div><div id="b"></div><script type="module" src="/src/main.js"></script></body></html>
EOF
echo "console.log('placeholder');" > src/main.js
probe() {
  echo "== $1";
  echo -n "  HEAD + Range 0-99 : "; /usr/bin/curl -s -r 0-99 -I "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|accept-ranges|content-type|content-encoding)' | tr '\n' ' '; echo
  echo -n "  GET  + Range 0-99 : "; /usr/bin/curl -s -r 0-99 -D - -o out.bin "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|accept-ranges|cache-control|etag)' | tr '\n' ' '; echo "| body bytes: $(wc -c < out.bin | tr -d ' ')"
  echo -n "  GET  + Range 1000-1999 + Origin + gzip: "; /usr/bin/curl -s -r 1000-1999 -H 'Origin: http://localhost:9999' -H 'Accept-Encoding: gzip, br' -D - -o out.bin "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-range|access-control|content-encoding)' | tr '\n' ' '; echo "| body bytes: $(wc -c < out.bin | tr -d ' ')"
  echo -n "  GET multi-range 0-9,100-109: "; /usr/bin/curl -s -r 0-9,100-109 -D - -o out.bin "$2" | tr -d '\r' | grep -i -E '^(HTTP|content-type|content-range)' | tr '\n' ' '; echo "| body bytes: $(wc -c < out.bin | tr -d ' ')"
}
npx vite --port 5491 --strictPort > vite-dev.log 2>&1 &
DEV=$!
/usr/bin/curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5491/NASA-space-apps-2026/
probe "vite dev (8.3.8), file in public/, with base path" http://localhost:5491/NASA-space-apps-2026/data/as_written.tif
echo -n "  same file WITHOUT the base path: "; /usr/bin/curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:5491/data/as_written.tif
echo -n "  missing file under base (SPA fallback?): "; /usr/bin/curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:5491/NASA-space-apps-2026/data/nope.tif
kill $DEV 2>/dev/null; wait $DEV 2>/dev/null
npx vite build > vite-build.log 2>&1; tail -4 vite-build.log
npx vite preview --port 5492 --strictPort > vite-preview.log 2>&1 &
PRE=$!
/usr/bin/curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5492/NASA-space-apps-2026/
probe "vite preview (8.3.8), file copied to dist/, with base path" http://localhost:5492/NASA-space-apps-2026/data/as_written.tif
echo -n "  missing file under base (SPA fallback?): "; /usr/bin/curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:5492/NASA-space-apps-2026/data/nope.tif
kill $PRE 2>/dev/null; wait $PRE 2>/dev/null; rm -f out.bin; cat vite-dev.log | head -8
````

### B5. Rebuild the polar fixture, re-run the D3 tests, measure D3-as-written's shortfall

Source: run 2, tool call 28 (2026-11-14 07:50:51 UTC). What it did: Re-run D3 tests with a correct polar fixture and measure the corner-only shortfall.  
Output: C5b. This is the step that makes `test_d3_fixed.py` pass.

````bash
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/d3 && ../../venv/bin/python - <<'EOF'
from make_synth2 import make
make("ps_north.h5", 3413, -60000.0, -2170000.0, 20.0, 3600, 6000, lattice_origin=(-60000.0, -2170000.0))
EOF
sed -i '' 's/decode_ok(out\["HHHH"\], gt, (-60000.0, -2040000.0))/decode_ok(out["HHHH"], gt, (-60000.0, -2170000.0))/' test_d3_fixed.py && ../../venv/bin/python -m pytest -q test_d3_fixed.py 2>&1 | tail -5
echo "--- as-written D3 on the same polar box: how much of the box does it miss?"
../../venv/bin/python - <<'EOF'
import h5py, numpy as np
from pyproj import Transformer
box = (-46.0, 69.6, -44.0, 70.1)
with h5py.File("ps_north.h5") as h5:
    g = h5["/science/LSAR/GCOV/grids/frequencyA"]
    x, y = g["xCoordinates"][:], g["yCoordinates"][:]
    epsg = int(g["projection"][()])
    w, s, e, n = box
    xs, ys = Transformer.from_crs(4326, epsg, always_xy=True).transform([w, e, w, e], [s, s, n, n])
    c0, c1 = np.searchsorted(x, [min(xs), max(xs)])
    r0, r1 = np.searchsorted(-y, [-max(ys), -min(ys)])
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    south_edge = y[r0] - dy / 2 + (r1 - r0) * dy
    t = Transformer.from_crs(4326, 3413, always_xy=True)
    lon = np.linspace(w, e, 2001); true_ymin = min(t.transform(lon, np.full_like(lon, s))[1])
    print("as written: rows", r0, r1, "cols", c0, c1, "south edge of window", south_edge, "true southern limit of the box", round(true_ymin, 1), "-> missing", round(south_edge - true_ymin, 1), "m =", round((south_edge - true_ymin) / 20, 1), "rows")
# and in UTM: a 1 x 1 degree box at 13 N in zone 48N, centred on the zone's central meridian (105 E) and off-centre
for box in [(104.5, 12.5, 105.5, 13.5), (103.0, 12.5, 104.0, 13.5), (102.2, 12.0, 103.2, 13.0)]:
    t = Transformer.from_crs(4326, 32648, always_xy=True)
    w, s, e, n = box
    xs, ys = t.transform([w, e, w, e], [s, s, n, n])
    tb = t.transform_bounds(*box, densify_pts=21)
    print(box, "corner envelope vs densified envelope, metres (W,S,E,N):", [round(a - b, 1) for a, b in zip((min(xs), min(ys), max(xs), max(ys)), tb)])
EOF
````

### B6. Run D5 exactly as written and inspect the result

Source: run 2, tool call 36 (2026-11-14 07:52:54 UTC). What it did: Create an 8-bit UTM raster and run the D5 COG call exactly as written.  
Output: C6.

````bash
SP=<scratch>/review/geo-frontend-engineer; mkdir -p $SP/run2/d5 && cd $SP/run2/d5 && cp ../../d5/make_src.py ../../d5/d5_as_written.py ../../d5/inspect_cog.py ../../d5/check_overview_edges.py . && PY=../../venv/bin/python && $PY make_src.py src_utm_20m.tif 2500 && echo "--- run D5 as written (warnings shown)" && $PY -W always d5_as_written.py src_utm_20m.tif cog_as_written.tif 2>&1 | tail -20; echo "exit ${PIPESTATUS[0]}"; echo "--- rio cogeo validate"; ../../venv/bin/rio cogeo validate cog_as_written.tif; echo "--- inspect"; $PY inspect_cog.py cog_as_written.tif; echo "--- rio cogeo info"; ../../venv/bin/rio cogeo info cog_as_written.tif | head -60
````

### B7. Do values outside the nodata hole survive in the RGBA-tagged stack

Source: run 2, tool call 43 (2026-11-14 07:55:15 UTC). What it did: Check whether values outside the nodata hole survive in the RGBA-tagged stack.  
Output: C7.

````bash
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/d5 && ../../venv/bin/python - <<'EOF'
import numpy as np, rasterio
from rasterio.warp import transform as wt
rng = np.random.default_rng(1)
for name in ("t_cog4.tif", "t_cog4_mb.tif"):
    src = "t_src4.tif" if name == "t_cog4.tif" else "t_src4_mb.tif"
    with rasterio.open(src) as s, rasterio.open(name) as d:
        A = s.read(); B = d.read()
        ok = bad = 0
        for _ in range(4000):
            r, c = rng.integers(5, 1019, 2)
            if 395 <= r < 605 and 395 <= c < 605: continue      # skip the hole and its edge
            x, y = s.xy(r, c)                                   # centre of a source pixel
            X, Y = wt(s.crs, d.crs, [x], [y])
            rr, cc = d.index(X[0], Y[0])
            # nearest-neighbour warp: the COG pixel under a source pixel centre should hold that pixel or a direct neighbour
            neigh = A[:, max(r - 1, 0):r + 2, max(c - 1, 0):c + 2].reshape(4, -1)
            hit = all(B[b, rr, cc] in neigh[b] for b in range(4))
            ok += hit; bad += (not hit)
        print(name, "outside the hole: samples matching the source (nearest neighbour):", ok, "not matching:", bad,
              "| zeros in bands 1-3 outside hole+padding:", int((B[:3, 100:900, 100:900] == 0).sum() - 0))
EOF
````

### B8a. Range and cross-origin headers on a COG hosted on GitHub Pages

Source: run 2, tool call 48 (2026-11-14 07:56:31 UTC). What it did: Check Range and cross-origin headers on a real GitHub Pages hosted COG.  
Output: C11.

````bash
cd /tmp; for U in https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif https://geomatico.github.io/maplibre-cog-protocol/data/kriging.tif; do echo "== $U"; echo "-- HEAD + Range"; /usr/bin/curl -s -r 0-99 -I -H 'Origin: http://localhost:5173' "$U" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|accept-ranges|content-type|access-control|cache-control|server|location|x-github|via|age|etag|last-modified|content-encoding|vary)'; echo "-- GET + Range (+gzip accepted)"; /usr/bin/curl -s -r 1000-1999 -H 'Origin: http://localhost:5173' -H 'Accept-Encoding: gzip, deflate, br' -D - -o /dev/null -w 'body bytes: %{size_download}\n' "$U" | tr -d '\r' | grep -i -E '^(HTTP|content-length|content-range|access-control|content-encoding|body bytes|location)'; done
````

### B8b. HEAD against GET with Range on other GitHub Pages sites

Source: run 2, tool call 49 (2026-11-14 07:56:43 UTC). What it did: Confirm HEAD versus GET Range behaviour on other GitHub Pages sites.  
Output: C11. The last `curl` in the loop is the check recommended in R10.

````bash
cd /tmp; for U in 'https://protomaps.github.io/PMTiles/protomaps(vector)ODbL_firenze.pmtiles' 'https://maplibre.org/maplibre-gl-js/docs/assets/osgeo-logo.svg' 'https://geotiffjs.github.io/geotiff.js/index.html'; do echo "== $U"; echo -n "  HEAD+Range: "; /usr/bin/curl -s -g -r 0-99 -I "$U" | tr -d '\r' | grep -i -E '^(HTTP|server|content-range|content-length|accept-ranges)' | tr '\n' ' '; echo; echo -n "  GET+Range:  "; /usr/bin/curl -s -g -r 0-99 -o /dev/null -D - -w 'body=%{size_download}' "$U" | tr -d '\r' | grep -i -E '^(HTTP|server|content-range|content-length|access-control|body=)' | tr '\n' ' '; echo; echo -n "  brief-safe check: "; /usr/bin/curl -s -g -r 0-99 -o /dev/null -w '%{http_code} %{size_download}\n' "$U"; done
````

### B9. Headless-Chrome run, MapLibre 5.24.1 (second attempt, the one quoted)

Source: run 2, tool call 52 (2026-11-14 07:58:12 UTC). What it did: Re-run the headless browser test with a matching as-written COG and compact output.  
Output: C12. The first part rewrites the test file so it holds the same pixels as the scaled COG but no scale or offset.

````bash
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/d5 && ../../venv/bin/python - <<'EOF'
import warnings, rasterio
warnings.simplefilter("ignore")
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
# same pixels as f_src1.tif, but written the way the brief describes: 8-bit, nodata=0, nothing else
with rasterio.open("f_src1.tif") as s:
    prof = dict(driver="GTiff", height=s.height, width=s.width, count=1, dtype="uint8", crs=s.crs, transform=s.transform, nodata=0)
    with rasterio.open("plain_src1.tif", "w", **prof) as d:
        d.write(s.read(1), 1)
src, dst = "plain_src1.tif", "plain_as_written.tif"
cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False, quiet=True)
with rasterio.open(dst) as d:
    print(dst, d.crs, d.nodata, d.scales, d.offsets, d.block_shapes[0], d.overviews(1))
EOF
cp plain_as_written.tif ../web/public/data/as_written.tif && cd ../web && sed -i '' 's/outside: \[104.40, 13.20\]/outside: [104.03, 13.60]/' src/main.js && sed -i '' 's/console.log(JSON.stringify(results, null, 1));/for (const [k, v] of Object.entries(results)) console.log(k.padEnd(24), JSON.stringify(v));/' drive.mjs && npx vite --port 5491 --strictPort > vite-dev.log 2>&1 &
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/web; /usr/bin/curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5491/NASA-space-apps-2026/
node drive.mjs http://localhost:5491/NASA-space-apps-2026/ shot_v5.png 2>&1 | cut -c1-600
pkill -f "vite --port 5491" ; echo done
````

### B10. MapLibre 6.18.0 with setWorkerUrl, dev server then production build

Source: run 2, tool call 55 (2026-11-14 07:59:23 UTC). What it did: Test MapLibre 6 with setWorkerUrl under Vite dev and build, exercising the worker.  
Output: C13. The embedded Python edits `main.js` into the form shown in A5.

````bash
SP=<scratch>/review/geo-frontend-engineer; cd $SP/run2/web6 && /opt/anaconda3/bin/python3 - <<'EOF'
s = open("src/main.js").read()
s = s.replace("import * as maplibregl from 'maplibre-gl';", "import * as maplibregl from 'maplibre-gl';\nimport workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';\nmaplibregl.setWorkerUrl(workerUrl);")
s = s.replace("R.maplibreVersion = maplibregl.getVersion?.() ?? maplibregl.version;", "R.maplibreVersion = maplibregl.getVersion();")
# add a vector source test so the worker is actually exercised: a tiny inline GeoJSON layer
s = s.replace("    // 9. missing file", "    a.addSource('gj', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[104.1, 13.4], [104.3, 13.4], [104.3, 13.5], [104.1, 13.5], [104.1, 13.4]]] }, properties: {} } });\n    a.addLayer({ id: 'gj', type: 'fill', source: 'gj', paint: { 'fill-color': '#00ff00' } });\n    await idle(a);\n    R.geojson_fill_px = px(a, [104.2, 13.47]);\n    // 9. missing file")
open("src/main.js", "w").write(s)
EOF
(npx vite --port 5493 --strictPort > vite-dev.log 2>&1 &) ; /usr/bin/curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5493/NASA-space-apps-2026/; node drive.mjs http://localhost:5493/NASA-space-apps-2026/ shot_v6_dev.png 2>&1 | cut -c1-300 | grep -E '^(maplibreVersion|mapErrors|ramp_dB_on_scaled|lv_fixed_centre |sync|fatal|geojson|\[|TIMEOUT)'; pkill -f "vite --port 5493"; echo "=== production build + preview"; npx vite build 2>&1 | tail -4 | cut -c1-200; (npx vite preview --port 5494 --strictPort > vite-preview.log 2>&1 &); /usr/bin/curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:5494/NASA-space-apps-2026/; node drive.mjs http://localhost:5494/NASA-space-apps-2026/ shot_v6_build.png 2>&1 | cut -c1-300 | grep -E '^(maplibreVersion|mapErrors|ramp_dB_on_scaled|lv_fixed_centre |sync|fatal|geojson|\[|TIMEOUT)'; pkill -f "vite preview --port 5494"; echo done
````

### B11. Misplacement when a lat/lon preview is stretched between four corners in Web Mercator

Source: run 2, tool call 60 (2026-11-14 08:00:51 UTC). What it did: Compute the misplacement when a lat/lon preview is stretched linearly in Web Mercator.  
Output: C15.

````bash
/opt/anaconda3/bin/python3 - <<'EOF'
import numpy as np
def merc(lat): return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
def err(south, north, n=20001):
    lat = np.linspace(south, north, n)                       # true latitude of each image row (plate carree image)
    f = (lat - south) / (north - south)                      # fractional position of the row in the image
    y_lin = merc(south) + f * (merc(north) - merc(south))    # where a 4-corner image source draws that row (linear in Mercator y)
    lat_drawn = np.degrees(2 * np.arctan(np.exp(y_lin)) - np.pi / 2)
    d = (lat_drawn - lat) * 110574.0                         # metres north-south on the ground
    i = np.abs(d).argmax()
    return d[i], lat[i]
print("Placing a lat/lon-gridded preview with a 4-corner MapLibre image source: worst north-south misplacement")
for name, s, n in [("stack 083_A_008 extent from the brief", 11.3330, 14.3420), ("3 deg frame at 30 N", 28.5, 31.5), ("3 deg frame at 48 N", 46.4, 49.4), ("3 deg frame at 64 N", 62.4, 65.4), ("3 deg frame at 69 N", 67.6, 70.6), ("3 deg frame at 75 S", -76.5, -73.5)]:
    d, at = err(s, n)
    print(f"  {name:40s} {abs(d):7.0f} m  = {abs(d)/180:5.1f} preview px (180 m)  at lat {at:.2f}  drawn too far {'north' if d > 0 else 'south'}")
EOF
````

### B12. Python 3.14 http.server, then geotiff.js against a server that ignores Range

Source: run 1, tool call 32 (2026-11-14 03:06:21 UTC). What it did: Test Python 3.14 server and geotiff.js without Range.  
Output: C11. `range_probe.mjs` is written by this command.

````bash
R=<scratch>/review/geo-frontend-engineer; cd $R/range/site && /opt/homebrew/bin/python3.14 --version && (/opt/homebrew/bin/python3.14 -m http.server 8732 --bind 127.0.0.1 > ../pyserver314.log 2>&1 &) ; sleep 1.5; echo "== Python 3.14 http.server, GET with Range: bytes=0-99"; /usr/bin/curl -s -r 0-99 -D - -o ../py314_out.bin http://127.0.0.1:8732/test.tif | grep -i -E "^HTTP|content-length|content-range|accept-ranges|server"; echo "bytes received: $(wc -c < ../py314_out.bin)"; pkill -f "http.server 8732"; echo; echo "== what geotiff.js does against a server that ignores Range (Python 3.12)"; cd $R/web && cat > range_probe.mjs <<'EOF'
import { fromUrl } from 'geotiff';
const url = process.argv[2];
let n = 0, bytes = 0;
const origFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { const r = await origFetch(u, o); n++; const range = o?.headers?.Range ?? o?.headers?.range ?? (o?.headers?.get?.('Range')); console.log('  fetch', r.status, 'Range:', range, 'content-length:', r.headers.get('content-length')); return r; };
try {
  const t0 = Date.now();
  const tiff = await fromUrl(url);
  const img = await tiff.getImage(0);
  console.log('image', img.getWidth(), img.getHeight(), 'samples', img.getSamplesPerPixel());
  const d = await img.readRasters({ window: [1000, 1000, 1001, 1001] });
  console.log('pixel values', Array.from(d, (b) => b[0]), 'requests', n, 'ms', Date.now() - t0);
} catch (e) { console.log('ERROR', e.constructor.name, String(e.message).slice(0, 300)); }
EOF
cd $R/range/site && (/opt/anaconda3/bin/python3 -m http.server 8731 --bind 127.0.0.1 > ../pyserver312.log 2>&1 &) ; sleep 1.5; cd $R/web && node range_probe.mjs http://127.0.0.1:8731/test.tif 2>&1 | tail -12; pkill -f "http.server 8731"
````

---

# Appendix C. Printed output

Copied from the saved files and from the transcripts' tool results. Lines longer than the stated limit are cut and say so. Nothing else is altered. Dumps of third-party README and library source that the runs printed are not copied.

## C1. D1 as written, one point

### C1. D1 as written at lon 104.05, lat 12.95

Source: run 2, tool call 18 (2026-11-14 07:46:21 UTC). Step: Run D1 exactly as written against live CMR for Tonle Sap.

````text
exit 0
n = 22 ms = 218
2026-06-19T22:36:37.000Z 083_A_008 023 2005 DHDH 23711_P05023_N_F_J_001 poly: string 10 browse: 7
2026-06-24T11:31:10.000Z 148_D_082 023 2005 DHDH 13144_P05023_N_F_J_001 poly: string 10 browse: 7
2026-07-01T22:36:36.000Z 083_A_008 024 2005 DHDH 23711_P05023_N_F_J_001 poly: string 10 browse: 7
2026-07-06T11:31:09.000Z 148_D_082 024 2005 SHSH 13144_P05023_N_F_J_001 poly: string 10 browse: 5
2026-07-13T22:36:36.000Z 083_A_008 025 2005 DHDH 23710_P05023_N_F_J_001 poly: string 10 browse: 7
2026-07-18T11:31:08.000Z 148_D_082 025 2005 DHDH 13143_P05023_N_F_J_001 poly: string 10 browse: 7
2026-07-25T22:36:35.000Z 083_A_008 026 2005 DHDH 23709_P05023_N_F_J_001 poly: string 10 browse: 7
2026-08-11T11:31:07.000Z 148_D_082 027 2005 DHDH 13142_P05023_N_F_J_001 poly: string 10 browse: 7
2026-08-18T22:36:34.000Z 083_A_008 028 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-08-23T11:31:07.000Z 148_D_082 028 2005 SHSH 13141_P05023_N_F_J_001 poly: string 10 browse: 5
2026-08-30T22:36:33.000Z 083_A_008 029 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-09-04T11:31:06.000Z 148_D_082 029 2005 DHDH 13141_P05023_N_F_J_001 poly: string 10 browse: 7
2026-09-11T22:36:33.000Z 083_A_008 030 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-09-16T11:31:06.000Z 148_D_082 030 2005 SHSH 13141_P05023_N_F_J_001 poly: string 10 browse: 5
2026-09-23T22:36:33.000Z 083_A_008 031 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-09-28T11:31:06.000Z 148_D_082 031 2005 DHDH 13141_P05023_N_F_J_001 poly: string 10 browse: 7
2026-10-05T22:36:33.000Z 083_A_008 032 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-10-10T11:31:06.000Z 148_D_082 032 2005 SHSH 13141_P05023_N_F_J_001 poly: string 10 browse: 5
2026-10-17T22:36:33.000Z 083_A_008 033 2005 DHDH 23708_P05023_N_F_J_001 poly: string 10 browse: 7
2026-10-22T11:31:06.000Z 148_D_082 033 2005 DHDH 13141_P05036_N_F_J_001 poly: string 10 browse: 7
2026-10-29T22:36:34.000Z 083_A_008 034 2005 DHDH 23708_P05036_N_F_J_001 poly: string 10 browse: 7
2026-11-03T11:31:07.000Z 148_D_082 034 2005 SHSH 13141_P05036_N_F_J_001 poly: string 10 browse: 5
````

## C2. D1 sweep and duplicate classification (saved files)

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/sweep_out.txt`  
**Bytes:** 7376, sha256 starts `812db8a53fe62e33`  
**Status:** saved output of run 2 (2026-11-14 01:46 to 01:47 CST).

````text
Mexico City        hits=59 n=59 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=1 modes=4005 pols=DHDH
   DUP 023_113_D_079_4005_DHDH_A_20260622T011332_20260622T011407_P05023_N_F_J_001 
       023_113_D_079_4005_DHDH_A_20260622T011332_20260622T011407_P05023_N_F_J_002
   entry keys: producer_granule_id,time_start,updated,orbit_calculated_spatial_domains,dataset_id,data_center,title,coordinate_system,day_night_flag,time_end,id,original_format,granule_size,browse_flag,polygons,collection_concept_id,online_access_flag,links
Kilauea            hits=58 n=58 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=2 modes=4005 pols=DHDH
   DUP 023_072_D_079_4005_DHDH_A_20260619T045817_20260619T045836_P05023_N_P_J_001 
       023_072_D_079_4005_DHDH_A_20260619T045817_20260619T045836_P05023_N_P_J_002
   DUP 023_151_A_011_4005_DHDH_A_20260624T155042_20260624T155100_P05023_N_P_J_001 
       023_151_A_011_4005_DHDH_A_20260624T155042_20260624T155100_P05023_N_P_J_002
Central Valley     hits=52 n=52 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=1 modes=4005,0005 pols=DHDH,NADV
   DUP 023_114_D_070_4005_DHDH_A_20260622T024823_20260622T024857_P05023_N_F_J_001 
       023_114_D_070_4005_DHDH_A_20260622T024823_20260622T024857_P05023_N_F_J_002
Reykjanes          hits=97 n=97 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=3 modes=4005 pols=DHDH
   DUP 023_082_D_056_4005_DHDH_A_20260619T212402_20260619T212431_P05023_N_F_J_001 
       023_082_D_056_4005_DHDH_A_20260619T212402_20260619T212431_P05023_N_F_J_002
   DUP 023_159_A_034_4005_DHDH_A_20260625T052238_20260625T052310_P05023_N_F_J_001 
       023_159_A_034_4005_DHDH_A_20260625T052238_20260625T052310_P05023_N_F_J_002
   DUP 029_159_A_034_4005_DHDH_A_20260905T052235_20260905T052307_P05023_N_F_J_001 
       029_159_A_034_4005_DHDH_A_20260905T052235_20260905T052307_P05023_N_F_J_002
Punjab             hits=60 n=60 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=10 modes=4005,2005 pols=DHDH,QPDH
   DUP 006_034_D_073_2005_QPDH_A_20251124T133917_20251124T133941_P05023_N_P_J_001 
       006_034_D_073_2005_DHDH_M_20251124T133917_20251124T133951_P05023_N_F_J_001
   DUP 013_156_A_017_4005_DHDH_A_20260225T001315_20260225T001349_P05023_N_F_J_001 
       013_156_A_017_4005_DHDH_A_20260225T001315_20260225T001349_P05023_N_F_J_002
   DUP 019_034_D_073_2005_DHDH_M_20260429T133921_20260429T133956_P05023_N_F_J_001 
       019_034_D_073_2005_QPDH_A_20260429T133921_20260429T133945_P05023_N_P_J_001
   DUP 021_034_D_073_2005_DHDH_M_20260523T133920_20260523T133955_P05023_N_F_J_001 
       021_034_D_073_2005_QPDH_A_20260523T133920_20260523T133945_P05023_N_P_J_001
Atchafalaya        hits=51 n=51 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=2 modes=4005 pols=DHDH
   DUP 029_156_D_073_4005_DHDH_A_20260905T004509_20260905T004544_P05023_N_F_J_001 
       029_156_D_073_4005_DHDH_A_20260905T004509_20260905T004544_P05023_N_F_J_002
   DUP 029_156_D_074_4005_DHDH_A_20260905T004543_20260905T004615_P05023_N_F_J_001 
       029_156_D_074_4005_DHDH_A_20260905T004543_20260905T004615_P05023_N_F_J_002
Grand Forks        hits=43 n=43 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=1 modes=4005 pols=DHDH
   DUP 030_004_A_026_4005_DHDH_A_20260906T111548_20260906T111627_P05023_N_F_J_001 
       030_004_A_026_4005_DHDH_A_20260906T111548_20260906T111627_P05023_N_F_J_002
Chicago            hits=34 n=34 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes=2005 pols=QPDH
Champaign          hits=22 n=22 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes=2005 pols=QPDH
Jakobshavn         hits=44 n=44 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=1 modes=7700 pols=SHNA
   DUP 029_170_D_053_7700_SHNA_A_20260905T235201_20260905T235238_P05023_N_P_J_001 
       029_170_D_053_7700_SHNA_A_20260905T235201_20260905T235238_P05023_N_P_J_002
Okavango           hits=23 n=23 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=3 modes=2005 pols=DHDH,SHSH
   DUP 027_151_D_098_2005_DHDH_A_20260811T163942_20260811T164016_P05023_N_F_J_001 
       027_151_D_098_2005_DHDH_A_20260811T163942_20260811T164016_P05023_N_F_J_002
   DUP 029_151_D_098_2005_DHDH_A_20260904T163941_20260904T164016_P05023_N_F_J_001 
       029_151_D_098_2005_DHDH_A_20260904T163941_20260904T164016_P05023_N_F_J_002
   DUP 029_172_A_168_2005_DHDH_A_20260906T041714_20260906T041748_P05023_N_F_J_001 
       029_172_A_168_2005_DHDH_A_20260906T041714_20260906T041748_P05023_N_F_J_002
Rondonia           hits=30 n=30 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=3 modes=2005,2000 pols=DHDH,DHNA,SHSH
   DUP 023_161_A_173_2000_DHNA_M_20260625T100121_20260625T100159_P05023_N_F_J_001 
       023_161_A_173_2005_DHDH_A_20260625T100121_20260625T100155_P05023_N_F_J_001
   DUP 024_161_A_173_2000_DHNA_M_20260707T100120_20260707T100158_P05023_N_F_J_001 
       024_161_A_173_2005_DHDH_A_20260707T100120_20260707T100155_P05023_N_F_J_001
   DUP 029_161_A_173_2005_DHDH_A_20260905T100117_20260905T100152_P05023_N_F_J_001 
       029_161_A_173_2005_DHDH_A_20260905T100117_20260905T100152_P05023_N_F_J_002
Tonle Sap          hits=22 n=22 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes=2005 pols=DHDH,SHSH
Sudd               hits=21 n=21 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes=2005 pols=SHSH,DHDH
Mekong Delta       hits=65 n=65 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=22 modes=4005,2005 pols=DHDH,SHSH
   DUP 023_047_D_084_4005_DHDH_A_20260617T112357_20260617T112404_P05023_N_P_J_001 
       023_047_D_084_2005_SHSH_M_20260617T112357_20260617T112428_P05023_N_F_J_001
   DUP 023_083_A_006_2005_DHDH_M_20260619T223539_20260619T223604_P05023_N_P_J_001 
       023_083_A_006_4005_DHDH_A_20260619T223559_20260619T223604_P05023_N_P_J_001
   DUP 024_047_D_084_4005_DHDH_A_20260629T112357_20260629T112403_P05023_N_P_J_001 
       024_047_D_084_2005_DHDH_M_20260629T112357_20260629T112431_P05023_N_F_J_001
   DUP 024_083_A_006_2005_DHDH_M_20260701T223534_20260701T223604_P05023_N_F_J_001 
       024_083_A_006_4005_DHDH_A_20260701T223558_20260701T223604_P05023_N_P_J_001
Mamiraua           hits=22 n=22 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=4 modes=0005,2000,2005 pols=NASV,DHNA,DHDH,SHSH
   DUP 023_161_A_176_2000_DHNA_M_20260625T100301_20260625T100336_P05023_N_F_J_001 
       023_161_A_176_2005_DHDH_A_20260625T100308_20260625T100336_P05023_N_F_J_001
   DUP 024_161_A_176_2000_DHNA_M_20260707T100301_20260707T100335_P05023_N_F_J_001 
       024_161_A_176_2005_DHDH_A_20260707T100307_20260707T100335_P05023_N_F_J_001
   DUP 025_161_A_176_2000_DHNA_M_20260719T100300_20260719T100334_P05023_N_F_J_001 
       025_161_A_176_2005_DHDH_A_20260719T100307_20260719T100334_P05023_N_F_J_001
   DUP 029_161_A_176_2005_DHDH_A_20260905T100258_20260905T100332_P05023_N_F_J_001 
       029_161_A_176_2005_DHDH_A_20260905T100258_20260905T100332_P05023_N_F_J_002
Pantanal           hits=18 n=18 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes=2005 pols=DHDH,SHSH
Fiji antimeridian  hits=20 n=20 regexFail=0 noPoly=0 multiPoly=20 noBrowse=0 dups=0 modes=2005 pols=DHDH,SHSH
Pine Island        hits=90 n=90 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=1 modes=4005 pols=SHSH
   DUP 030_019_A_140_4005_SHSH_A_20260907T131850_20260907T131927_P05023_N_F_J_001 
       030_019_A_140_4005_SHSH_A_20260907T131850_20260907T131927_P05023_N_F_J_002
Svalbard           hits=0 n=0 regexFail=0 noPoly=0 multiPoly=0 noBrowse=0 dups=0 modes= pols=
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d1/dups_out.txt`  
**Bytes:** 3369, sha256 starts `6967f1c96f1b90e3`  
**Status:** saved output of run 2 (2026-11-14 01:46 to 01:47 CST).

````text
Mexico City        granules=59 passGroups=58 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
Kilauea            granules=58 passGroups=56 groupsWith>1=2 {"counterOnly":2,"crossRelease":0,"partialPlusOther":0,"other":0}
Central Valley     granules=52 passGroups=51 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
Reykjanes          granules=97 passGroups=94 groupsWith>1=3 {"counterOnly":3,"crossRelease":0,"partialPlusOther":0,"other":0}
Punjab             granules=60 passGroups=50 groupsWith>1=10 {"counterOnly":2,"crossRelease":0,"partialPlusOther":8,"other":0}
Atchafalaya        granules=51 passGroups=49 groupsWith>1=2 {"counterOnly":2,"crossRelease":0,"partialPlusOther":0,"other":0}
Grand Forks        granules=43 passGroups=42 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
Chicago            granules=34 passGroups=34 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Champaign          granules=22 passGroups=22 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Jakobshavn         granules=44 passGroups=43 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
Okavango           granules=23 passGroups=20 groupsWith>1=3 {"counterOnly":3,"crossRelease":0,"partialPlusOther":0,"other":0}
    other 023_161_A_173_2000_DHNA_M_20260625T100121_20260625T100159_P05023_N_F_J_001 | 023_161_A_173_2005_DHDH_A_20260625T100121_20260625T100155_P05023_N_F_J_001
    other 024_161_A_173_2000_DHNA_M_20260707T100120_20260707T100158_P05023_N_F_J_001 | 024_161_A_173_2005_DHDH_A_20260707T100120_20260707T100155_P05023_N_F_J_001
Rondonia           granules=30 passGroups=27 groupsWith>1=3 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":2}
Tonle Sap          granules=22 passGroups=22 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Sudd               granules=21 passGroups=21 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Mekong Delta       granules=65 passGroups=43 groupsWith>1=22 {"counterOnly":0,"crossRelease":0,"partialPlusOther":22,"other":0}
    other 023_161_A_176_2000_DHNA_M_20260625T100301_20260625T100336_P05023_N_F_J_001 | 023_161_A_176_2005_DHDH_A_20260625T100308_20260625T100336_P05023_N_F_J_001
    other 024_161_A_176_2000_DHNA_M_20260707T100301_20260707T100335_P05023_N_F_J_001 | 024_161_A_176_2005_DHDH_A_20260707T100307_20260707T100335_P05023_N_F_J_001
    other 025_161_A_176_2000_DHNA_M_20260719T100300_20260719T100334_P05023_N_F_J_001 | 025_161_A_176_2005_DHDH_A_20260719T100307_20260719T100334_P05023_N_F_J_001
Mamiraua           granules=22 passGroups=18 groupsWith>1=4 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":3}
Pantanal           granules=18 passGroups=18 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Fiji antimeridian  granules=20 passGroups=20 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Pine Island        granules=90 passGroups=89 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
TOTAL granules 831 fullRegexFail 0 { counterOnly: 19, crossRelease: 0, partialPlusOther: 30, other: 5 } CRIDs { P05023: 776, P05036: 55 } orbitFlags [ 'N', 'F' ]
````

Last line of run 1's `<scratch>/review/geo-frontend-engineer/d1/dups_out.txt` (2026-11-13 20:55 CST), for comparison:

````text
TOTAL granules 828 fullRegexFail 0 { counterOnly: 19, crossRelease: 0, partialPlusOther: 29, other: 5 } CRIDs { P05023: 776, P05036: 52 } orbitFlags [ 'N', 'F' ]
````

### C2b. An antimeridian granule's polygons and links

Source: run 2, tool call 20 (2026-11-14 07:46:56 UTC). Step: Classify duplicate passes and inspect an antimeridian granule's polygons and links.

````text
exit 0
Fiji antimeridian  granules=20 passGroups=20 groupsWith>1=0 {"counterOnly":0,"crossRelease":0,"partialPlusOther":0,"other":0}
Pine Island        granules=90 passGroups=89 groupsWith>1=1 {"counterOnly":1,"crossRelease":0,"partialPlusOther":0,"other":0}
TOTAL granules 831 fullRegexFail 0 { counterOnly: 19, crossRelease: 0, partialPlusOther: 30, other: 5 } CRIDs { P05023: 776, P05036: 55 } orbitFlags [ 'N', 'F' ]
---
NISAR_L2_PR_GCOV_024_015_D_097_2005_DHDH_A_20260627T061454_20260627T061528_P05023_N_F_J_001 [["-18.2349 -180 -18.29501 -179.66536 -16.21502 -179.25099 -16.07583 -180 -18.2349 -180"],["-16.07583 180 -15.78023 178.45618 -17.86783 178.02568 -18.2349 180 -16.07583 180"]] 1333.5273809432983 2026-06-27T06:14:54.000Z 2026-06-27T06:15:28.999Z C2854338529-ASF NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)
NISAR_L2_PR_GCOV_024_036_A_169_2005_DHDH_A_20260628T175330_20260628T175407_P05023_N_F_J_001 [["-18.22639 -180 -18.11765 -179.42542 -15.85397 -179.90772 -15.87192 -180 -18.22639 -180"],["-15.87192 180 -16.28665 177.80836 -18.54492 178.25805 -18.22639 180 -15.87192 180"]] 1426.0953979492188 2026-06-28T17:53:30.000Z 2026-06-28T17:54:07.999Z C2854338529-ASF NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)
[["data#","https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCO...7T061528_P05023_N_F_J_001.h5",""],["s3#","s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISI...7T061528_P05023_N_F_J_001.h5",""],["browse#","https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GC..._P05023_N_F_J_001_LATLON.png",""],["browse#","s3://sds-n-cumulus-prod-nisar-browse/NISAR_L2_GCOV_PROVISION..._P05023_N_F_J_001_LATLON.png",""],["browse#","https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GC...F_J_001_LATLON [... 5137 more characters on this line not copied]
````

### C2c. One entry's fields and first links (first 28 lines)

Source: run 1, tool call 13 (2026-11-14 02:56:01 UTC). Step: Check CMR CORS headers and one entry's fields.

````text
HTTP/2 200 
content-type: application/json;charset=utf-8
access-control-allow-origin: *
cmr-search-after: [1781908597000,4250743928]
cmr-hits: 22
access-control-expose-headers: CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
x-content-type-options: nosniff
---
producer_granule_id = 'NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001'
time_start = '2026-06-19T22:36:37.000Z'
updated = '2026-07-17T18:06:18.450Z'
orbit_calculated_spatial_domains = [{'orbit_number': '4680'}]
dataset_id = 'NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)'
data_center = 'ASF'
title = 'NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001'
coordinate_system = 'CARTESIAN'
day_night_flag = 'UNSPECIFIED'
time_end = '2026-06-19T22:37:11.999Z'
id = 'G4250743928-ASF'
original_format = 'UMM_JSON'
granule_size = '1777.8144416809082'
browse_flag = True
polygons = [['12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936']]
collection_concept_id = 'C2854338529-ASF'
online_access_flag = True
  link http://esipfed.org/ns/fedsearch/1.1/data# https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_ None None
  link http://esipfed.org/ns/fedsearch/1.1/s3# s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T None None
  link http://esipfed.org/ns/fedsearch/1.1/browse# https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M None None
[... 49 more lines not copied]
````

### C2d. https data and browse links of one granule

Source: run 1, tool call 14 (2026-11-14 02:56:10 UTC). Step: List https browse and data link suffixes for one granule.

````text
data# None 5_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5
browse# None _20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png
browse# None 223637_20260619T223711_P05023_N_F_J_001_LATLON_thumbnail.png
browse# None _20260619T223637_20260619T223711_P05023_N_F_J_001_NATIVE.png
browse# None 19T223637_20260619T223711_P05023_N_F_J_001_NATIVE_A_HHHH.png
browse# None 19T223637_20260619T223711_P05023_N_F_J_001_NATIVE_A_HVHV.png
browse# None 19T223637_20260619T223711_P05023_N_F_J_001_NATIVE_B_HHHH.png
browse# None 19T223637_20260619T223711_P05023_N_F_J_001_NATIVE_B_HVHV.png
data# True https://search.asf.alaska.edu/
data# True granules?p=C2854338529-ASF
````

## C3. Corrected D1

### C3. d1_fixed_test.mjs

Source: run 2, tool call 23 (2026-11-14 07:48:13 UTC). Step: Write and run a corrected D1 with duplicate handling against live CMR.

````text
Tonle Sap          granules= 22 passes= 22 stacks=2  083_A_008:11 148_D_082:11
Mexico City        granules= 59 passes= 58 stacks=2  019_A_011:31 113_D_079:27
Kilauea            granules= 58 passes= 56 stacks=2  072_D_079:28 151_A_011:28
Central Valley     granules= 52 passes= 51 stacks=2  034_A_020:27 114_D_070:24
Reykjanes          granules= 97 passes= 94 stacks=6  082_D_056:28 159_A_034:27 087_A_034:11 111_D_056:9 010_D_056:9 015_A_034:10
Punjab             granules= 60 passes= 50 stacks=2  156_A_017:26 034_D_073:24
Atchafalaya        granules= 51 passes= 49 stacks=5  084_D_073:11 105_A_017:11 156_D_073:7 156_D_074:10 033_A_017:10
Grand Forks        granules= 43 passes= 42 stacks=4  099_D_064:11 105_A_026:10 171_D_064:10 004_A_026:11
Chicago            granules= 34 passes= 34 stacks=4  047_A_023:11 084_D_067:11 148_A_022:1 148_A_023:11
Champaign          granules= 22 passes= 22 stacks=2  084_D_068:11 148_A_022:11
Jakobshavn         granules= 44 passes= 43 stacks=4  059_A_037:11 069_D_053:11 131_A_037:11 170_D_053:10
Okavango           granules= 23 passes= 20 stacks=2  151_D_098:10 172_A_168:10
Rondonia           granules= 30 passes= 27 stacks=4  068_D_094:11 161_A_172:4 161_A_173:9 169_D_093:3
Sudd               granules= 21 passes= 21 stacks=2  050_D_085:11 086_A_005:10
Mekong Delta       granules= 65 passes= 43 stacks=4  047_D_083:11 047_D_084:11 083_A_006:11 083_A_007:10
Mamiraua           granules= 22 passes= 18 stacks=2  097_D_090:9 161_A_176:9
Pantanal           granules= 18 passes= 18 stacks=2  111_D_097:9 132_A_169:9
Fiji antimeridian  granules= 20 passes= 20 stacks=2  015_D_097:10 036_A_169:10
Pine Island        granules= 90 passes= 89 stacks=10  040_D_126:10 048_A_140:10 083_D_126:11 091_A_140:10 112_D_126:9 120_A_140:10 149_A_140:9 011_D_126:9 019_A_140:9 091_A_141:2
Svalbard           granules=  0 passes=  0 stacks=0  
{
  total: 831,
  kept: 777,
  noH5: 0,
  noPrev: 0,
  twoRing: 20,
  validated: 55
}
2026-06-19 p P05023 DHDH F
2026-07-01 p P05023 DHDH F
2026-07-13 p P05023 DHDH F
2026-07-25 p P05023 DHDH F
2026-08-18 p P05023 DHDH F
2026-08-30 p P05023 DHDH F
2026-09-11 p P05023 DHDH F
2026-09-23 p P05023 DHDH F
2026-10-05 p P05023 DHDH F
2026-10-17 p P05023 DHDH F
2026-10-29 v P05036 DHDH F
{
  name: 'NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001',
  start: '2026-06-19T22:36:37.000Z',
  date: '2026-06-19',
  cycle: '023',
  stack: '083_A_008',
  mode: '2005',
  pol: 'DHDH',
  mixedMode: true,
  version: 'P05023',
  release: 'provisional',
  fullFrame: true,
  counter: 1,
  polygons: [
    '12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936'
  ],
  h5: 'https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5',
  preview: 'https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png'
}
error path: CMR 400: [104.05,x] is not a valid URL encoded point
````

## C4. CMR headers

### C4. CMR cross-origin, preflight, errors

Source: run 2, tool call 21 (2026-11-14 07:47:15 UTC). Step: Check CMR cross-origin headers, preflight and error response shape.

````text
== GET with Origin
HTTP/2 200 
content-type: application/json;charset=utf-8
vary: Accept-Encoding
access-control-allow-origin: *
cmr-request-id: dae04fdf-bdbe-44a8-9b5c-e9f6814d2a57
cmr-request-id: dae04fdf-bdbe-44a8-9b5c-e9f6814d2a57
cmr-search-after: [1782300670000,4244848584]
cmr-hits: 22
access-control-expose-headers: CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
cmr-took: 54
== OPTIONS preflight for CMR-Search-After header
HTTP/2 200 
access-control-allow-headers: Echo-Token, Accept, Content-Type, Client-Id, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, Authorization
access-control-max-age: 2592000
access-control-allow-origin: *
access-control-allow-methods: POST, GET, OPTIONS
== bad request shape
{"errors":["[104.05] is not a valid URL encoded point"]}
== page_size 2001
{"errors":["page_size must be a number between 0 and 2000"]}
````

## C5. GIBS dates, and D3

### C5. GIBS tile z8 y118 x201 on ten dates

Source: run 2, tool call 22 (2026-11-14 07:47:45 UTC). Step: Check which UTC dates the GIBS NISAR layer holds data for at the test point.

````text
tile 8 118 201
2026-06-18 200 288 image/png
2026-06-19 200 138873 image/png
2026-06-20 200 288 image/png
2026-06-24 200 37962 image/png
2026-10-29 200 143297 image/png
2026-10-30 200 288 image/png
2026-11-03 200 39971 image/png
2026-11-10 200 288 image/png
2026-11-12 404 196 text/html; charset=iso-8859-1
2026-11-13 404 196 text/html; charset=iso-8859-1
````

### C5a. D3 as written on the synthetic file

Source: run 2, tool call 24 (2026-11-14 07:48:28 UTC). Step: Build the synthetic GCOV-layout HDF5 and run D3 as written against it.

````text
science  
science/LSAR  
science/LSAR/GCOV  
science/LSAR/GCOV/grids  
science/LSAR/GCOV/grids/frequencyA  
science/LSAR/GCOV/grids/frequencyA/HHHH (1500, 1200) float32
science/LSAR/GCOV/grids/frequencyA/HVHV (1500, 1200) float32
science/LSAR/GCOV/grids/frequencyA/listOfCovarianceTerms (2,) |S4
science/LSAR/GCOV/grids/frequencyA/listOfPolarizations (2,) |S2
science/LSAR/GCOV/grids/frequencyA/mask (1500, 1200) uint8
science/LSAR/GCOV/grids/frequencyA/projection () uint32
science/LSAR/GCOV/grids/frequencyA/xCoordinates (1200,) float64
science/LSAR/GCOV/grids/frequencyA/yCoordinates (1500,) float64
science/LSAR/GCOV/grids/frequencyB  
science/LSAR/GCOV/grids/frequencyB/HHHH (375, 300) float32
science/LSAR/GCOV/grids/frequencyB/HVHV (375, 300) float32
science/LSAR/GCOV/grids/frequencyB/listOfCovarianceTerms (2,) |S4
science/LSAR/GCOV/grids/frequencyB/listOfPolarizations (2,) |S2
science/LSAR/GCOV/grids/frequencyB/mask (375, 300) uint8
science/LSAR/GCOV/grids/frequencyB/projection () uint32
science/LSAR/GCOV/grids/frequencyB/xCoordinates (300,) float64
science/LSAR/GCOV/grids/frequencyB/yCoordinates (375,) float64

[T1 inside, on pixel edges] bounds=(404000, 1488000, 408000, 1492000)
   rows 400:600 cols 200:400 shape=(200, 200) gt=(404000.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (404000.0, 1488000.0, 408000.0, 1492000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (0.0, 0.0, 0.0, 0.0)
   expected (r0,r1,c0,c1) = (400, 600, 200, 400) -> MATCH

[T2 inside, on pixel centres] bounds=(404010, 1487990, 408010, 1491990)
   rows 400:600 cols 200:400 shape=(200, 200) gt=(404000.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (404000.0, 1488000.0, 408000.0, 1492000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (-10.0, 10.0, 10.0, -10.0)

[T3 inside, mid-pixel (5 m into the pixel)] bounds=(404005, 1488005, 408005, 1492005)
   rows 400:600 cols 200:400 shape=(200, 200) gt=(404000.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (404000.0, 1488000.0, 408000.0, 1492000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (-5.0, -5.0, 5.0, 5.0)

[T3b inside, box edge 1 m past a pixel centre] bounds=(404011, 1488000, 408011, 1492000)
   rows 400:600 cols 201:401 shape=(200, 200) gt=(404020.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (404020.0, 1488000.0, 408020.0, 1492000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (9.0, 0.0, -9.0, 0.0)

[T4 partly outside east+south] bounds=(420000, 1465000, 430000, 1475000)
   rows 1250:1500 cols 1000:1200 shape=(250, 200) gt=(420000.0, 20.0, 0.0, 1475000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (420000.0, 1470000.0, 424000.0, 1475000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (0.0, 5000.0, 6000.0, 0.0)

[T5 partly outside west+north] bounds=(395000, 1498000, 402000, 1503000)
   rows 0:100 cols 0:100 shape=(100, 100) gt=(400000.0, 20.0, 0.0, 1500000.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (400000.0, 1498000.0, 402000.0, 1500000.0)
   shortfall vs requested box, metres (W,S,E,N; positive = requested area NOT returned): (5000.0, 0.0, 0.0, 3000.0)

[T6 entirely outside east] bounds=(430000, 1488000, 440000, 1492000)
   RAISED: IndexError index 1200 is out of bounds for axis 0 with size 1200

[T7 entirely outside west] bounds=(380000, 1488000, 390000, 1492000)
   rows 400:600 cols 0:0 shape=(200, 0) gt=(400000.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   EMPTY ARRAY returned, no error raised

[T8 entirely outside south] bounds=(404000, 1400000, 408000, 1410000)
   RAISED: IndexError index 1500 is out of bounds for axis 0 with size 1500

[T9 entirely outside north] bounds=(404000, 1510000, 408000, 1520000)
   rows 0:0 cols 200:400 shape=(0, 200) gt=(404000.0, 20.0, 0.0, 1500000.0, 0.0, -20.0) gt types=float64
   EMPTY ARRAY returned, no error raised

[T10 degenerate (zero-width) box] bounds=(404010, 1488000, 404010, 1492000)
   rows 400:600 cols 200:200 shape=(200, 0) gt=(404000.0, 20.0, 0.0, 1492000.0, 0.0, -20.0) gt types=float64
   EMPTY ARRAY returned, no error raised

[T11 box smaller than a pixel, between centres] bounds=(404012, 1491972, 404028, 1491988)
   rows 401:401 cols 201:201 shape=(0, 0) gt=(404020.0, 20.0, 0.0, 1491980.0, 0.0, -20.0) gt types=float64
   EMPTY ARRAY returned, no error raised

lon/lat of the T1 projected corners: (104.11310477871135, 13.458379288191308, 104.14992803675894, 13.494672390605487)

[T12 degrees bbox built from T1's SW and NE corners] bounds=(104.11310477871135, 13.458379288191308, 104.14992803675894, 13.494672390605487)
   rows 399:601 cols 200:400 shape=(202, 200) gt=(404000.0, 20.0, 0.0, 1492020.0, 0.0, -20.0) gt types=float64
   geotransform maps array pixels to the file's true coordinates: True
   window outer extent (xmin, ymin, xmax, ymax): (404000.0, 1487980.0, 408000.0, 1492020.0)
````

### C5a-2. First pytest run of the corrected D3 (fixture mistake)

Source: run 2, tool call 26 (2026-11-14 07:50:22 UTC). Step: Split D3 into testable parts and run its tests on the synthetic files.

````text
[... 17 earlier lines not copied]
        if fr0 >= fr1 or fc0 >= fc1:
>           raise ValueError(f"bbox {bbox} does not overlap this granule's grid")
E           ValueError: bbox (-46.0, 69.6, -44.0, 70.1) does not overlap this granule's grid

d3_fixed.py:32: ValueError
=========================== short test summary info ============================
FAILED test_d3_fixed.py::test_polar_stereographic_covers_whole_box - ValueErr...
1 failed, 13 passed in 0.35s
````

### C5a-3. Where the polar test box really is in EPSG:3413

Source: run 2, tool call 27 (2026-11-14 07:50:35 UTC). Step: Locate the polar test box in EPSG:3413 coordinates.

````text
corners: [(-38963.9, -2232239.1), (-37989.9, -2176441.6), (38963.9, -2232239.1), (37989.9, -2176441.6)]
transform_bounds densify 21: [-38963.9, -2232579.1, 38963.9, -2176441.6]
south arc: ymin -2232579.1 at lon -45.0
north arc: ymax -2176441.6 ymin -2176773.1
````

### C5b. Corrected D3 tests pass; D3-as-written shortfall

Source: run 2, tool call 28 (2026-11-14 07:50:51 UTC). Step: Re-run D3 tests with a correct polar fixture and measure the corner-only shortfall.

````text
..............                                                           [100%]
14 passed in 1.13s
--- as-written D3 on the same polar box: how much of the box does it miss?
as written: rows 322 3112 cols 1052 4948 south edge of window -2232240.0 true southern limit of the box -2232579.1 -> missing 339.1 m = 17.0 rows
(104.5, 12.5, 105.5, 13.5) corner envelope vs densified envelope, metres (W,S,E,N): [0.0, 51.3, 0.0, 0.0]
(103.0, 12.5, 104.0, 13.5) corner envelope vs densified envelope, metres (W,S,E,N): [0.0, 0.0, 0.0, 0.0]
(102.2, 12.0, 103.2, 13.0) corner envelope vs densified envelope, metres (W,S,E,N): [0.0, 0.0, 0.0, 0.0]
````

## C6. D5 as written, and variants

### C6. D5 as written: warnings, validation, inspection

Source: run 2, tool call 36 (2026-11-14 07:52:54 UTC). Step: Create an 8-bit UTM raster and run the D5 COG call exactly as written.

````text
src_utm_20m.tif (2500, 2500) nodata px: 196600 min valid: 1 max: 233
--- run D5 as written (warnings shown)
<scratch>/review/geo-frontend-engineer/run2/d5/d5_as_written.py:7: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
Reading input: src_utm_20m.tif

Adding overviews...
Updating dataset tags...
Writing output to: cog_as_written.tif
exit 
--- rio cogeo validate
<scratch>/review/geo-frontend-engineer/run2/d5/cog_as_written.tif is a valid cloud optimized GeoTIFF
--- inspect
cog_validate: valid = True errors = [] warnings = []
driver GTiff crs EPSG:3857 size 2816 x 2816 count 1 dtype uint8
nodata 0.0 res (19.109257071294063, 19.109257071294063) bounds (11584184.51, 1472482.91, 11637996.18, 1526294.58)
blocks (512, 512) overviews [2, 4, 8] compress Compression.deflate interleave Interleaving.band photometric None
colorinterp (<ColorInterp.gray: 1>,) scales (1.0,) offsets (0.0,) mask_flags [<MaskFlags.nodata: 8>]
tags {'OVERVIEW_RESAMPLING': 'AVERAGE', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'} | band1 tags {} | IMAGE_STRUCTURE {'LAYOUT': 'COG', 'COMPRESSION': 'DEFLATE', 'INTERLEAVE': 'BAND'}
full-res: nodata px 879534 valid min/max 1 233
  overview /2: shape (1408, 1408) nodata px 218487 valid min 1 max 213
  overview /4: shape (704, 704) nodata px 53950 valid min 6 max 188
  overview /8: shape (352, 352) nodata px 13104 valid min 13 max 178
size MB 7.18
--- rio cogeo info
Driver: GTiff
File: <scratch>/review/geo-frontend-engineer/run2/d5/cog_as_written.tif
COG: True
Compression: DEFLATE
ColorSpace: None

Profile
    Width:            2816
    Height:           2816
    Bands:            1
    Tiled:            True
    Dtype:            uint8
    NoData:           0.0
    Alpha Band:       False
    Internal Mask:    False
    Interleave:       BAND
    ColorMap:         False
    ColorInterp:      ('gray',)
    Scales:           (1.0,)
    Offsets:          (0.0,)

Geo
    Crs:              EPSG:3857
    Origin:           (11584184.510675032, 1526294.5807983987)
    Resolution:       (19.109257071294063, -19.109257071294063)
    BoundingBox:      (11584184.510675032, 1472482.9128856347, 11637996.178587796, 1526294.5807983987)
    MinZoom:          9
    MaxZoom:          13

Image Metadata
    OVERVIEW_RESAMPLING: AVERAGE
    TILING_SCHEME_NAME: WebMercatorQuad
    TILING_SCHEME_ZOOM_LEVEL: 13
    AREA_OR_POINT: Area

Image Structure
    LAYOUT: COG
    COMPRESSION: DEFLATE
    INTERLEAVE: BAND

Band 1
    ColorInterp: gray

IFD
    Id      Size           BlockSize     Decimation
    0       2816x2816      512x512       0
    1       1408x1408      512x512       2
    2       704x704        512x512       4
    3       352x352        512x512       8
````

### C6b. variants.py

Source: run 2, tool call 41 (2026-11-14 07:54:23 UTC). Step: Run D5 variants: scale/offset carry-over, 256 blocks, multi-band stacks.

````text
rio-cogeo 7.0.4 rasterio 1.5.2 GDAL 3.12.2
cog_translate signature: (source: Union[str, pathlib.PurePath, rasterio.io.DatasetReader, rasterio.io.DatasetWriter, rasterio.vrt.WarpedVRT], dst_path: Union[str, pathlib.PurePath], dst_kwargs: Dict, indexes: Optional[Sequence[int]] = None, nodata: Union[str, int, float, NoneType] = None, dtype: Optional[str] = None, add_mask: bool = False, overview_level: Optional[int] = None, overview_resampling: Literal['nearest', 'bilinear', 'cubic', 'cubic_spline', 'lanczos', 'average', 'mode', 'gauss', 'rms'] = 'nearest', web_optimized: bool = False, tms: Optional[morecantile.models.TileMatrixSet] = None, zoom_level_strategy: str = 'auto', zoom_level: Optional[int] = None, aligned_levels: Optional[int] [... 200 more characters on this line not copied]
deflate profile: {'driver': 'GTiff', 'interleave': 'pixel', 'tiled': True, 'blockxsize': 512, 'blockysize': 512, 'compress': 'DEFLATE'}

[V1] as written, source carries scale/offset, tags, band descriptions
   v1.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=1 nodata=(0.0,) blocks=(512, 512) ovr=[2, 4] interleave=Interleaving.band photometric=None
      colorinterp=['gray'] scales=(0.0984251968503937,) offsets=(-25.098425196850393,) descriptions=('2026-06-19',) tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=1.71 MB

[V2] 256x256 blocks + forward_band_tags + additional_cog_metadata
   v2.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=1 nodata=(0.0,) blocks=(256, 256) ovr=[2, 4, 8] interleave=Interleaving.band photometric=None
      colorinterp=['gray'] scales=(0.0984251968503937,) offsets=(-25.098425196850393,) descriptions=('2026-06-19',) tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=1.68 MB

[V3] 3-band stack, as-written call
   v3_stack3.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=3 nodata=(0.0, 0.0, 0.0) blocks=(512, 512) ovr=[2, 4] interleave=Interleaving.pixel photometric=None
      colorinterp=['red', 'green', 'blue'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=4.90 MB
[V3b] 3-band stack, photometric=MINISBLACK, interleave=pixel explicitly, 256 blocks
   v3b_stack3.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=3 nodata=(0.0, 0.0, 0.0) blocks=(256, 256) ovr=[2, 4, 8] interleave=Interleaving.pixel photometric=None
      colorinterp=['red', 'green', 'blue'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=4.79 MB

[V3] 4-band stack, as-written call
   v3_stack4.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=4 nodata=(0.0, 0.0, 0.0, 0.0) blocks=(512, 512) ovr=[2, 4] interleave=Interleaving.pixel photometric=None
      colorinterp=['red', 'green', 'blue', 'alpha'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=6.33 MB
[V3b] 4-band stack, photometric=MINISBLACK, interleave=pixel explicitly, 256 blocks
   v3b_stack4.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=4 nodata=(0.0, 0.0, 0.0, 0.0) blocks=(256, 256) ovr=[2, 4, 8] interleave=Interleaving.pixel photometric=None
      colorinterp=['red', 'green', 'blue', 'alpha'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=6.18 MB

[V3] 11-band stack, as-written call
   v3_stack11.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=11 nodata=(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0) blocks=(512, 512) ovr=[2, 4] interleave=Interleaving.pixel photometric=None
      colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=17.61 MB
[V3b] 11-band stack, photometric=MINISBLACK, interleave=pixel explicitly, 256 blocks
   v3b_stack11.tif: valid=True warn=[] crs=EPSG:3857 size=1536x1536 bands=11 nodata=(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0) blocks=(256, 256) ovr=[2, 4, 8] interleave=Interleaving.pixel photometric=None
      colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined'] scales=(0.0984251968503937, 0.0984251968503937) offsets=(-25.098425196850393, -25.098425196850393) descriptions=('2026-06-19', '2026-06-20', '2026-06-21') tags={'AI_ASSISTED': 'yes; see AI_USE.md', 'ENCODING_HI': '0.0', 'ENCODING_LO': '-25.0', 'OVERVIEW_RESAMPLING': 'AVERAGE', 'SOURCE_GRANULE': 'NISAR_L2_PR_GCOV_xxx', 'TILING_SCHEME_NAME': 'WebMercatorQuad', 'TILING_SCHEME_ZOOM_LEVEL': '13', 'AREA_OR_POINT': 'Area'}
      size=17.17 MB
````

### C6c. The same script's warnings in run 1 (first 16 lines)

Source: run 1, tool call 26 (2026-11-14 03:04:09 UTC). Step: Test D5 variants for tags, scale, blocks, stacks.

````text
<scratch>/review/geo-frontend-engineer/d5/variants.py:41: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, "v1.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:46: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, "v2.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True,
<scratch>/review/geo-frontend-engineer/d5/variants.py:53: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, f"v3_stack{nb}.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:57: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, f"v3b_stack{nb}.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:53: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, f"v3_stack{nb}.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:53: NodataAlphaMaskWarning: Input dataset has both a nodata value and internal alpha/mask band. Nodata value will be prioritized.
  cog_translate(s, f"v3_stack{nb}.tif", cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:57: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(s, f"v3b_stack{nb}.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
<scratch>/review/geo-frontend-engineer/d5/variants.py:57: NodataAlphaMaskWarning: Input dataset has both a nodata value and internal alpha/mask band. Nodata value will be prioritized.
  cog_translate(s, f"v3b_stack{nb}.tif", prof, web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
[... 44 more lines not copied]
````

## C7. The RGB / RGBA tagging trap

### C7. alpha_trap.py

Source: run 2, tool call 42 (2026-11-14 07:54:56 UTC). Step: Test whether 3- and 4-band date stacks get tagged RGB or RGBA and corrupt values.

````text
--- 3 bands, source written without photometric (GDAL default)
  source colorinterp: ['red', 'green', 'blue']
  t_cog3.tif: colorinterp=['red', 'green', 'blue'] photometric=None
      full res, inside the hole: band means=[149.7, 149.8, 0.0]  rasterio masks (255=valid)=[255, 255, 0]
      overview /2, inside the hole: band means=[146.6, 149.5, 0.0]
      overview /4, inside the hole: band means=[149.4, 149.6, 0.0]
--- 3 bands, source written with photometric='MINISBLACK'
  source colorinterp: ['gray', 'undefined', 'undefined']
  t_cog3_mb.tif: colorinterp=['gray', 'undefined', 'undefined'] photometric=None
      full res, inside the hole: band means=[149.5, 149.8, 0.0]  rasterio masks (255=valid)=[255, 255, 0]
      overview /2, inside the hole: band means=[151.0, 149.9, 0.0]
      overview /4, inside the hole: band means=[149.0, 151.1, 0.0]
--- 4 bands, source written without photometric (GDAL default)
  source colorinterp: ['red', 'green', 'blue', 'alpha']
  t_cog4.tif: colorinterp=['red', 'green', 'blue', 'alpha'] photometric=None
      full res, inside the hole: band means=[0.0, 0.0, 0.0, 0.0]  rasterio masks (255=valid)=[0, 0, 0, 0]
      overview /2, inside the hole: band means=[0.0, 0.0, 0.0, 0.0]
      overview /4, inside the hole: band means=[0.0, 0.0, 0.0, 0.0]
--- 4 bands, source written with photometric='MINISBLACK'
  source colorinterp: ['gray', 'undefined', 'undefined', 'undefined']
  t_cog4_mb.tif: colorinterp=['gray', 'undefined', 'undefined', 'undefined'] photometric=None
      full res, inside the hole: band means=[148.8, 150.2, 148.2, 0.0]  rasterio masks (255=valid)=[255, 255, 255, 0]
      overview /2, inside the hole: band means=[149.6, 149.8, 148.8, 0.0]
      overview /4, inside the hole: band means=[150.2, 151.2, 149.5, 0.0]
--- 5 bands, source written without photometric (GDAL default)
  source colorinterp: ['gray', 'undefined', 'undefined', 'undefined', 'undefined']
  t_cog5.tif: colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined'] photometric=None
      full res, inside the hole: band means=[149.9, 148.8, 150.8, 148.7, 0.0]  rasterio masks (255=valid)=[255, 255, 255, 255, 0]
      overview /2, inside the hole: band means=[150.9, 149.2, 154.4, 151.9, 0.0]
      overview /4, inside the hole: band means=[150.0, 149.1, 151.6, 148.7, 0.0]
--- 5 bands, source written with photometric='MINISBLACK'
  source colorinterp: ['gray', 'undefined', 'undefined', 'undefined', 'undefined']
  t_cog5_mb.tif: colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined'] photometric=None
      full res, inside the hole: band means=[149.7, 149.7, 151.4, 149.7, 0.0]  rasterio masks (255=valid)=[255, 255, 255, 255, 0]
      overview /2, inside the hole: band means=[148.8, 151.6, 151.3, 148.1, 0.0]
      overview /4, inside the hole: band means=[150.5, 150.3, 151.2, 149.5, 0.0]
````

### C7b. Values outside the hole

Source: run 2, tool call 43 (2026-11-14 07:55:15 UTC). Step: Check whether values outside the nodata hole survive in the RGBA-tagged stack.

````text
t_cog4.tif outside the hole: samples matching the source (nearest neighbour): 3827 not matching: 0 | zeros in bands 1-3 outside hole+padding: 139875
t_cog4_mb.tif outside the hole: samples matching the source (nearest neighbour): 3835 not matching: 0 | zeros in bands 1-3 outside hole+padding: 0
````

## C8. Corrected D5 and overview edges

### C8. d5_fixed.py, rio cogeo validate, check_overview_edges.py

Source: run 2, tool call 44 (2026-11-14 07:55:24 UTC). Step: Run the corrected D5 with warnings as errors and check overview nodata handling.

````text
source 1 band(s): colorinterp=['gray']
   cog: crs=EPSG:3857 size=1536x1536 blocks=(256, 256) ovr=[2, 4, 8] nodata=0.0 interleave=band colorinterp=['gray'] scale=0.098425 offset=-25.098425 tags.AI_ASSISTED=True MB=1.68
source 2 band(s): colorinterp=['gray', 'undefined']
   cog: crs=EPSG:3857 size=1536x1536 blocks=(256, 256) ovr=[2, 4, 8] nodata=0.0 interleave=pixel colorinterp=['gray', 'undefined'] scale=0.098425 offset=-25.098425 tags.AI_ASSISTED=True MB=3.29
source 3 band(s): colorinterp=['gray', 'undefined', 'undefined']
   cog: crs=EPSG:3857 size=1536x1536 blocks=(256, 256) ovr=[2, 4, 8] nodata=0.0 interleave=pixel colorinterp=['gray', 'undefined', 'undefined'] scale=0.098425 offset=-25.098425 tags.AI_ASSISTED=True MB=4.79
source 4 band(s): colorinterp=['gray', 'undefined', 'undefined', 'undefined']
   cog: crs=EPSG:3857 size=1536x1536 blocks=(256, 256) ovr=[2, 4, 8] nodata=0.0 interleave=pixel colorinterp=['gray', 'undefined', 'undefined', 'undefined'] scale=0.098425 offset=-25.098425 tags.AI_ASSISTED=True MB=6.32
source 11 band(s): colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined']
   cog: crs=EPSG:3857 size=1536x1536 blocks=(256, 256) ovr=[2, 4, 8] nodata=0.0 interleave=pixel colorinterp=['gray', 'undefined', 'undefined', 'undefined', 'undefined'] scale=0.098425 offset=-25.098425 tags.AI_ASSISTED=True MB=17.17
all variants passed with warnings treated as errors
--- validate + overview edges for the 1-band fixed COG
f_cog1.tif is a valid cloud optimized GeoTIFF
overview /2: mixed blocks=1255  |ov - nodata-aware mean| median=0.00 max=0.50   |ov - naive mean| median=56.50   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.25 max=0.50
overview /4: mixed blocks=942  |ov - nodata-aware mean| median=0.58 max=19.40   |ov - naive mean| median=52.16   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.31 max=1.00
overview /8: mixed blocks=555  |ov - nodata-aware mean| median=0.83 max=6.88   |ov - naive mean| median=49.64   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.39 max=1.31
--- same check on the as-written COG
overview /2: mixed blocks=2759  |ov - nodata-aware mean| median=0.00 max=0.50   |ov - naive mean| median=55.50   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.25 max=0.50
overview /4: mixed blocks=2058  |ov - nodata-aware mean| median=0.62 max=18.00   |ov - naive mean| median=53.50   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.31 max=1.00
overview /8: mixed blocks=1224  |ov - nodata-aware mean| median=0.82 max=18.00   |ov - naive mean| median=57.85   ov==0 in mixed blocks: 0
      fully-valid blocks: |ov - mean| median=0.39 max=1.34
````

## C9. Size table

### C9. size_table.py

Source: run 2, tool call 45 (2026-11-14 07:55:36 UTC). Step: Measure 8-bit COG bytes per pixel for speckled data at several resolutions.

````text
single-look-equiv ENL at 20 m | posting | compression | bytes per source pixel | web zoom | MB for a 100x100 km window per date per layer | x 11 dates x 2 pols
  ENL20m=3.0    20 m  deflate   1.23 B/px  z13     30.8 MB       679 MB
  ENL20m=3.0    20 m  zstd      1.24 B/px  z13     30.9 MB       680 MB
  ENL20m=3.0    40 m  deflate   1.15 B/px  z12      7.2 MB       158 MB
  ENL20m=3.0    40 m  zstd      1.18 B/px  z12      7.4 MB       162 MB
  ENL20m=3.0    80 m  deflate   1.14 B/px  z11      1.8 MB        39 MB
  ENL20m=3.0    80 m  zstd      1.21 B/px  z11      1.9 MB        42 MB
  ENL20m=6.0    20 m  deflate   1.16 B/px  z13     29.1 MB       639 MB
  ENL20m=6.0    20 m  zstd      1.17 B/px  z13     29.2 MB       643 MB
  ENL20m=6.0    40 m  deflate   1.10 B/px  z12      6.8 MB       151 MB
  ENL20m=6.0    40 m  zstd      1.14 B/px  z12      7.1 MB       156 MB
  ENL20m=6.0    80 m  deflate   1.09 B/px  z11      1.7 MB        37 MB
  ENL20m=6.0    80 m  zstd      1.19 B/px  z11      1.9 MB        41 MB
````

## C10. Encoding round trip

### C10. roundtrip.py

Source: run 1, tool call 29 (2026-11-14 03:05:33 UTC). Step: Verify 8-bit dB encoding round trip and step.

````text
lo=-25.0 hi=0.0: step=0.09843 dB  max in-range error=0.04921 (step/2=0.04921)  DN->dB->DN identity=True  enc(lo)=1 enc(hi)=255 enc(lo-5)=1 enc(hi+5)=255 enc(nan)=0 enc(-inf)=0
lo=-35.0 hi=-5.0: step=0.11811 dB  max in-range error=0.05906 (step/2=0.05906)  DN->dB->DN identity=True  enc(lo)=1 enc(hi)=255 enc(lo-5)=1 enc(hi+5)=255 enc(nan)=0 enc(-inf)=0
lo=-25.0 hi=-8.0: step=0.06693 dB  max in-range error=0.03346 (step/2=0.03346)  DN->dB->DN identity=True  enc(lo)=1 enc(hi)=255 enc(lo-5)=1 enc(hi+5)=255 enc(nan)=0 enc(-inf)=0
lo=-10.0 hi=10.0: step=0.07874 dB  max in-range error=0.03937 (step/2=0.03937)  DN->dB->DN identity=True  enc(lo)=1 enc(hi)=255 enc(lo-5)=1 enc(hi+5)=255 enc(nan)=0 enc(-inf)=0
   decoder 'lo + DN/255*(hi-lo)': max abs error 0.098 dB
   decoder 'lo + DN/254*(hi-lo)': max abs error 0.098 dB
   decoder 'lo + (DN-1)/255*(hi-lo)': max abs error 0.098 dB
scale/offset form: dB = DN*scale + offset with scale=0.0984251969 offset=-25.0984251969 ; max diff vs formula 3.55e-15
10*log10 of [0, -1e-3, 1e-12, nan, 0.05] -> [       -inf         nan -120.               nan  -13.010301] -> DN [  0   0   1   0 123]  (0 linear power -> -inf -> isfinite False -> nodata; 1e-12 -> clipped to DN 1)
````

## C11. Range requests

### C11a. Python http.server, 3.12.2 and 3.14.3

Source: run 2, tool call 30 (2026-11-14 07:51:23 UTC). Step: Test whether Python's http.server honours Range requests (3.12 and 3.14).

````text
3793343
== Python 3.12.2 http.server
  HEAD + Range 0-99 : HTTP/1.0 200 OK Content-Length: 3793343 
  GET  + Range 0-99 : HTTP/1.0 200 OK Content-Length: 3793343 | body bytes: 3793343
  GET  + Range 1000-1999 with Origin: HTTP/1.0 200 OK | body bytes: 3793343
== Python 3.14.3 http.server
  HEAD + Range 0-99 : HTTP/1.0 200 OK Content-Length: 3793343 
  GET  + Range 0-99 : HTTP/1.0 200 OK Content-Length: 3793343 | body bytes: 3793343
  GET  + Range 1000-1999 with Origin: HTTP/1.0 200 OK | body bytes: 3793343
````

### C11b. Python 3.12 http.server, first test

Source: run 1, tool call 31 (2026-11-14 03:06:08 UTC). Step: Test Range support of Python 3.12 http.server.

````text
== Python Python 3.12.2 http.server, GET with Range: bytes=0-99
HTTP/1.0 200 OK
Server: SimpleHTTP/0.6 Python/3.12.2
Content-Length: 7177681
bytes received:  7177681  (file is  7177681)
== HEAD with Range (the brief's 'curl -r 0-99 -I' check)
HTTP/1.0 200 OK
Content-Length: 7177681
[... 13 more lines not copied]
````

### C11c. Python 3.14 http.server, then geotiff.js against Python 3.12's

Source: run 1, tool call 32 (2026-11-14 03:06:21 UTC). Step: Test Python 3.14 server and geotiff.js without Range.

````text
Python 3.14.3
== Python 3.14 http.server, GET with Range: bytes=0-99
HTTP/1.0 200 OK
Server: SimpleHTTP/0.6 Python/3.14.3
Content-Length: 7177681
bytes received:  7177681

== what geotiff.js does against a server that ignores Range (Python 3.12)
  fetch 200 Range: bytes=0-1023 content-length: 7177681
ERROR Error Server responded with full file
````

### C11d. Vite dev server and vite preview

Source: run 2, tool call 47 (2026-11-14 07:56:15 UTC). Step: Test Range request handling of the Vite dev server and vite preview.

````text
== vite dev (8.3.8), file in public/, with base path
  HEAD + Range 0-99 : HTTP/1.1 206 Partial Content Content-Length: 100 Content-Type: image/tiff Content-Range: bytes 0-99/7177681 Accept-Ranges: bytes 
  GET  + Range 0-99 : HTTP/1.1 206 Partial Content Content-Length: 100 ETag: W/"7177681-1794642975739" Cache-Control: no-cache Content-Range: bytes 0-99/7177681 Accept-Ranges: bytes | body bytes: 100
  GET  + Range 1000-1999 + Origin + gzip: HTTP/1.1 206 Partial Content Access-Control-Allow-Origin: http://localhost:9999 Content-Range: bytes 1000-1999/7177681 | body bytes: 1000
  GET multi-range 0-9,100-109: HTTP/1.1 206 Partial Content Content-Type: image/tiff Content-Range: bytes 0-9/7177681 | body bytes: 10
  same file WITHOUT the base path: 404 text/plain
  missing file under base (SPA fallback?): 200 text/html
dist/index.html                0.36 kB │ gzip: 0.27 kB
dist/assets/index-CxtCzZPg.js  0.69 kB │ gzip: 0.40 kB

✓ built in 423ms
== vite preview (8.3.8), file copied to dist/, with base path
  HEAD + Range 0-99 : HTTP/1.1 206 Partial Content Content-Length: 100 Content-Type: image/tiff Content-Range: bytes 0-99/7177681 Accept-Ranges: bytes 
  GET  + Range 0-99 : HTTP/1.1 206 Partial Content Content-Length: 100 ETag: W/"7177681-1794642978473" Cache-Control: no-cache Content-Range: bytes 0-99/7177681 Accept-Ranges: bytes | body bytes: 100
  GET  + Range 1000-1999 + Origin + gzip: HTTP/1.1 206 Partial Content Access-Control-Allow-Origin: http://localhost:9999 Content-Range: bytes 1000-1999/7177681 | body bytes: 1000
  GET multi-range 0-9,100-109: HTTP/1.1 206 Partial Content Content-Type: image/tiff Content-Range: bytes 0-9/7177681 | body bytes: 10
  missing file under base (SPA fallback?): 200 text/html

  VITE v8.3.8  ready in 626 ms

  ➜  Local:   http://localhost:5491/NASA-space-apps-2026/
  ➜  Network: use --host to expose
````

### C11e. A COG on GitHub Pages

Source: run 2, tool call 48 (2026-11-14 07:56:31 UTC). Step: Check Range and cross-origin headers on a real GitHub Pages hosted COG.

````text
== https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif
-- HEAD + Range
HTTP/2 200 
server: GitHub.com
content-type: image/tiff
last-modified: Fri, 18 Sep 2026 16:32:54 GMT
access-control-allow-origin: *
etag: "6aad67b6-a020"
cache-control: max-age=600
x-github-request-id: 7F62:C3EC0:15F02B5:17AB1C0:6AF8142F
x-github-edge-region: iad
accept-ranges: bytes
age: 0
via: 1.1 varnish
vary: Accept-Encoding
content-length: 40992
-- GET + Range (+gzip accepted)
HTTP/2 206 
access-control-allow-origin: *
content-range: bytes 1000-1999/40992
content-length: 1000
body bytes: 1000
== https://geomatico.github.io/maplibre-cog-protocol/data/kriging.tif
-- HEAD + Range
HTTP/2 301 
server: GitHub.com
content-type: text/html
location: https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif
x-github-request-id: 9FA6:1CC1:CC9172:DC631F:6AF8142F
x-github-edge-region: iad
accept-ranges: bytes
age: 0
via: 1.1 varnish
vary: Accept-Encoding
content-length: 162
-- GET + Range (+gzip accepted)
HTTP/2 301 
location: https://labs.geomatico.es/maplibre-cog-protocol/data/kriging.tif
content-length: 162
body bytes: 162
````

### C11f. Other GitHub Pages sites

Source: run 2, tool call 49 (2026-11-14 07:56:43 UTC). Step: Confirm HEAD versus GET Range behaviour on other GitHub Pages sites.

````text
== https://protomaps.github.io/PMTiles/protomaps(vector)ODbL_firenze.pmtiles
  HEAD+Range: HTTP/2 301  server: GitHub.com accept-ranges: bytes content-length: 162 
  GET+Range:  HTTP/2 301  server: GitHub.com content-length: 162 body=162 
  brief-safe check: 301 162
== https://maplibre.org/maplibre-gl-js/docs/assets/osgeo-logo.svg
  HEAD+Range: HTTP/2 404  server: GitHub.com accept-ranges: bytes content-length: 9379 
  GET+Range:  HTTP/2 404  server: GitHub.com access-control-allow-origin: * content-length: 9379 body=9379 
  brief-safe check: 404 9379
== https://geotiffjs.github.io/geotiff.js/index.html
  HEAD+Range: HTTP/2 200  server: GitHub.com accept-ranges: bytes content-length: 121353 
  GET+Range:  HTTP/2 206  server: GitHub.com access-control-allow-origin: * content-range: bytes 0-99/121353 content-length: 100 body=100 
  brief-safe check: 206 100
````

## C12. Browser run, MapLibre 5.24.1

### C12a. Probe points and the values rasterio reads there

Source: run 2, tool call 50 (2026-11-14 07:57:12 UTC). Step: Compute probe coordinates and expected pixel values for the browser test.

````text
public/data/hh_fixed.tif 1536 1536 1 lonlat bounds [104.0625, 13.32548, 104.32617, 13.58192]
public/data/as_written.tif 2816 2816 1 lonlat bounds [104.0625, 13.11158, 104.5459, 13.58192]
public/data/stack11.tif 1536 1536 11 lonlat bounds [104.0625, 13.32548, 104.32617, 13.58192]
fixed: centre valid (104.187007, 13.458629) | NE wedge nodata (104.288331, 13.558395) | NW square nodata (104.077592, 13.564939) | hole on odd bands (stack) (104.149928, 13.494672) | lake (104.153789, 13.44767)
hh_fixed centre (104.187007, 13.458629) DN 133 dB -12.008
hh_fixed lake (104.153789, 13.44767) DN 18 dB -23.327
hh_fixed wedge (104.288331, 13.558395) DN 0 dB None
stack11 centre DN [133, 68, 122, 94, 103, 102, 138, 114, 105, 96, 127] dB [-12.01, -18.41, -13.09, -15.85, -14.96, -15.06, -11.52, -13.88, -14.76, -15.65, -12.6]
stack11 hole DN [107, 0, 94, 0, 94, 0, 121, 0, 96, 0, 85]
as_written centre DN 137
````

### C12. Results (Vite dev server)

Source: run 2, tool call 52 (2026-11-14 07:58:12 UTC). Step: Re-run the headless browser test with a matching as-written COG and compact output. Each colour is [r,g,b,a] read from the map canvas at a probe point; [255,0,255,255] is the page's magenta background, meaning the layer is transparent there; "outside" lies off the canvas.

````text
plain_as_written.tif EPSG:3857 0.0 (1.0,) (0.0,) (512, 512) [2, 4]
base                     "/NASA-space-apps-2026/"
maplibreVersion          "5.24.1"
mapErrors                []
ramp_dB_on_scaled        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
ramp_dB_on_unscaled      {"centre":[8,29,88,255],"lake":[8,29,88,255],"wedge":[255,0,255,255],"hole":[8,29,88,255],"outside":[0,0,0,0]}
ramp_DN_on_unscaled      {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
grey_fixed               {"centre":[106,106,106,255],"lake":[23,23,23,255],"wedge":[255,0,255,255],"hole":[96,96,96,255],"outside":[0,0,0,0]}
url_root_relative        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
url_relative             {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
stack_default            {"centre":[106,106,106,255],"lake":[23,23,23,255],"wedge":[255,0,255,255],"hole":[96,96,96,255],"outside":[0,0,0,0]}
stack_band2_colorfn      {"centre":[98,0,157,255],"lake":[22,0,233,255],"wedge":[255,0,255,255],"hole":[255,0,255,255],"outside":[0,0,0,0]}
metadata_fixed           {"scale":0.0984251968503937,"offset":-25.098425196850393,"noData":0,"bbox":[104.0625,13.325484885597923,104.326171875,13.581920900545844],"photometric":1,"images":[{"zoom":13,"isOverview":false,"isMask":false},{"zoom":12,"isOverview":true,"isMask":false},{"zoom":11,"isOverview":true,"isMask":false},{"zoom":10,"isOverview":true,"isMask":false}]}
metadata_as_written      {"scale":1,"offset":0,"noData":0,"images":[{"zoom":13,"isOverview":false,"isMask":false},{"zoom":12,"isOverview":true,"isMask":false},{"zoom":11,"isOverview":true,"isMask":false}]}
metadata_rgba            {"noData":0,"photometric":2,"alphaBand":3}
lv_fixed_centre          [-12.008]
lv_fixed_centre_z10      [-14.862]
lv_fixed_centre_z5       [-14.961]
lv_fixed_lake            [-23.327]
lv_fixed_wedge           ["NaN"]
lv_fixed_outside         ["NaN"]
lv_as_written_centre     [133]
lv_stack_centre          [-12.008,-18.406,-13.091,-15.846,-14.961,-15.059,-11.516,-13.878,-14.764,-15.65,-12.598]
lv_stack_hole            [-14.567,"NaN",-15.846,"NaN",-15.846,"NaN",-13.189,"NaN",-15.65,"NaN",-16.732]
lv_stack4_fixed_hole     [-14.567,"NaN",-15.846,"NaN"]
lv_stack4_rgba_hole      [160,132,118,124]
sync                     {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}
missing                  "rejected: Request failed"
--- console/log lines:
[debug] [vite] connecting...
[debug] [vite] connected.
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
--- tif requests by file+status: {"hh_fixed.tif 206":{"n":5,"bytes":786432,"ranged":5},"as_written.tif 206":{"n":3,"bytes":720896,"ranged":3},"hh_fixed.tif 304":{"n":4,"bytes":0,"ranged":4},"stack11.tif 206":{"n":12,"bytes":4653056,"ranged":12},"stack4_rgba.tif 206":{"n":2,"bytes":786432,"ranged":2},"stack4_fixed.tif 206":{"n":2,"bytes":327680,"ranged":2},"nope.tif 200":{"n":1,"bytes":413,"ranged":1}}
--- first 6 requests: [["hh_fixed.tif",206,"bytes=0-65535","65536"],["hh_fixed.tif",206,"bytes=65536-458751","393216"],["as_written.tif",206,"bytes=0-65535","65536"],["as_written.tif",206,"bytes=65536-458751","393216"],["hh_fixed.tif",304,"bytes=0-65535",""],["hh_fixed.tif",304,"bytes=65536-458751",""]]
done
````

## C13. Browser run, MapLibre 6.18.0

### C13a. The 6.18.0 package

Source: run 2, tool call 53 (2026-11-14 07:58:44 UTC). Step: Install MapLibre GL JS 6.18.0 in a separate scratch folder and inspect its package.

````text
added 86 packages in 3s
  "version": "6.18.0",
maplibre-gl-dev.mjs
maplibre-gl-dev.mjs.map
maplibre-gl-shared-dev.mjs
maplibre-gl-shared.mjs
maplibre-gl-worker-dev.mjs
maplibre-gl-worker-dev.mjs.map
maplibre-gl-worker.mjs
maplibre-gl-worker.mjs.map
maplibre-gl.css
maplibre-gl.d.ts
maplibre-gl.mjs
maplibre-gl.mjs.map
type: module | main: None | module: dist/maplibre-gl.mjs | exports: {".": {"types": "./dist/maplibre-gl.d.ts", "import": "./dist/maplibre-gl.mjs"}, "./dist/*": "./dist/*", "./package.json": "./package.json"}
0
export{Fn as AJAXError,VF as AttributionControl,zP as BoxZoomHandler,Rx as CanvasSource,wF as CooperativeGesturesHandler,vF as DoubleClickZoomHandler,xF as DragPanHandler,SF as DragRotateHandler,N as EXTENT,jO as EdgeInsets,R as ErrorEvent,qn as Event,Jn as Evented,FI as FullscreenControl,PI as FullscreenEvent,yP as GPUInitializationError,bx as GeoJSONSource,DI as GeolocateControl,EI as GeolocateErrorEvent,wI as Geol [... 1080 more characters on this line not copied]
````

### C13b. Without setWorkerUrl (dev, then build)

Source: run 2, tool call 54 (2026-11-14 07:58:58 UTC). Step: Run the same browser checks with MapLibre GL JS 6.18.0 in dev and production build. Lines containing terminal colour codes (a build diagnostic pointing at `maplibregl.version`) are left out. The run's own filter also hid some result rows.

````text
2:import * as maplibregl from 'maplibre-gl';
base                     "/NASA-space-apps-2026/"
maplibreVersion          "6.18.0"
mapErrors                ["A: Worker failed to load. Check that the worker URL is correct.","B: Worker failed to load. Check that the worker URL is correct."]
ramp_dB_on_scaled        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
ramp_dB_on_unscaled      {"centre":[8,29,88,255],"lake":[8,29,88,255],"wedge":[255,0,255,255],"hole":[8,29,88,255],"outside":[0,0,0,0]}
stack_band2_colorfn      {"centre":[98,0,157,255],"lake":[22,0,233,255],"wedge":[255,0,255,255],"hole":[255,0,255,255],"outside":[0,0,0,0]}
lv_fixed_centre          [-12.008]
lv_fixed_centre_z10      [-14.862]
lv_fixed_centre_z5       [-14.961]
lv_fixed_lake            [-23.327]
lv_fixed_wedge           ["NaN"]
lv_fixed_outside         ["NaN"]
lv_as_written_centre     [133]
lv_stack_centre          [-12.008,-18.406,-13.091,-15.846,-14.961,-15.059,-11.516,-13.878,-14.764,-15.65,-12.598]
lv_stack_hole            [-14.567,"NaN",-15.846,"NaN",-15.846,"NaN",-13.189,"NaN",-15.65,"NaN",-16.732]
lv_stack4_fixed_hole     [-14.567,"NaN",-15.846,"NaN"]
lv_stack4_rgba_hole      [160,132,118,124]
sync                     {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}
missing                  "rejected: Request failed"
--- console/log lines:
[debug] [vite] connecting...
[requestfailed] http://localhost:5493/NASA-space-apps-2026/node_modules/.vite/deps/maplibre-gl-worker.mjs?v=6.18.0 net::ERR_FAILED
[error] Error: Worker failed to load. Check that the worker URL is correct.
[debug] [vite] connected.
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
--- tif requests by file+status: {"hh_fixed.tif 206":{"n":9,"bytes":1703936,"ranged":9},"as_written.tif 206":{"n":3,"bytes":720896,"ranged":3},"stack11.tif 206":{"n":12,"bytes":4653056,"ranged":12},"stack4_rgba.tif 206":{"n":2,"bytes":786432,"ranged":2},"stack4_fixed.tif 206":{"n":2,"bytes":327680,"ranged":2},"nope.tif 200":{"n"
--- first 6 requests: [["hh_fixed.tif",206,"bytes=0-65535","65536"],["hh_fixed.tif",206,"bytes=65536-458751","393216"],["as_written.tif",206,"bytes=0-65535","65536"],["as_written.tif",206,"bytes=65536-458751","393216"],["hh_fixed.tif",206,"bytes=0-65535","65536"],["hh_fixed.tif",206,"bytes=65536-458751","393216"]]
=== now a production build + preview

✓ built in 607ms
maplibreVersion          "6.18.0"
mapErrors                ["A: Worker failed to load. Check that the worker URL is correct.","B: Worker failed to load. Check that the worker URL is correct."]
ramp_dB_on_scaled        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
lv_fixed_centre          [-12.008]
sync                     {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}
--- console/log lines:
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
[error] Error: Worker failed to load. Check that the worker URL is correct.
--- tif requests by file+status: {"hh_fixed.tif 206":{"n":9,"bytes":1703936,"ranged":9},"as_written.tif 206":{"n":3,"bytes":720896,"ranged":3},"stack11.tif 206":{"n":12,"bytes":4653056,"ranged":12},"stack4_rgba.tif 206":{"n":2,"bytes":786432,"ranged":2},"stack4_fixed.tif 206":{"n":2,"bytes":327680,"ranged":2},"nope.tif 200":{"n"
--- first 6 requests: [["hh_fixed.tif",206,"bytes=0-65535","65536"],["hh_fixed.tif",206,"bytes=65536-458751","393216"],["as_written.tif",206,"bytes=0-65535","65536"],["as_written.tif",206,"bytes=65536-458751","393216"],["hh_fixed.tif",206,"bytes=0-65535","65536"],["hh_fixed.tif",206,"bytes=65536-458751","393216"]]
done
````

### C13. With setWorkerUrl (dev, then build)

Source: run 2, tool call 55 (2026-11-14 07:59:23 UTC). Step: Test MapLibre 6 with setWorkerUrl under Vite dev and build, exercising the worker.

````text
maplibreVersion          "6.18.0"
mapErrors                []
ramp_dB_on_scaled        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
lv_fixed_centre          [-12.008]
sync                     {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}
geojson_fill_px          [0,255,0,255]
[debug] [vite] connecting...
[debug] [vite] connected.
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
[debug] [vite] connecting...
[debug] [vite] connected.
=== production build + preview
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 257ms
maplibreVersion          "6.18.0"
mapErrors                []
ramp_dB_on_scaled        {"centre":[108,198,190,255],"lake":[243,250,189,255],"wedge":[255,0,255,255],"hole":[128,205,187,255],"outside":[0,0,0,0]}
lv_fixed_centre          [-12.008]
sync                     {"a":[104.2,13.47,11.2],"b":[104.2,13.47,11.2]}
geojson_fill_px          [0,255,0,255]
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
done
````

## C14. Preview PNGs and D4

### C14a. Download

Source: run 2, tool call 58 (2026-11-14 08:00:11 UTC). Step: Download three public preview PNGs of the test stack into an empty folder.

````text
2026-06-19 200 binary/octet-stream 4080968 d1mv8zhcvry6x4.cloudfront.net
2026-08-18 200 binary/octet-stream 4072341 d1mv8zhcvry6x4.cloudfront.net
2026-10-29 200 binary/octet-stream 4101143 d1mv8zhcvry6x4.cloudfront.net
total 23960
drwxr-xr-x@ 6 <user>  wheel      192 Nov 14 02:00 .
drwxr-xr-x@ 4 <user>  wheel      128 Nov 14 02:00 ..
-rw-r--r--@ 1 <user>  wheel  4080968 Nov 14 02:00 083_A_008_2026-06-19.png
-rw-r--r--@ 1 <user>  wheel  4072341 Nov 14 02:00 083_A_008_2026-08-18.png
-rw-r--r--@ 1 <user>  wheel  4101143 Nov 14 02:00 083_A_008_2026-10-29.png
-rw-r--r--@ 1 <user>  wheel     1267 Nov 14 02:00 083_A_008_meta.json
````

### C14. d4_check.py

Source: run 2, tool call 59 (2026-11-14 08:00:34 UTC). Step: Apply the D4 formulas to the fresh previews and cross-check the fit.

````text
2026-06-19: 1880x1847 bands=3 footprint xl=144 xr=1804 yt=115 yb=1721 lit=52.8%
   polygon lon 102.62722..105.39936 lat 11.53813..14.15457
   brief formulas -> west 102.3867 east 105.5263 north 14.3419 south 11.3329   dlon 0.0016700 dlat 0.0016292 deg/px  (181.3 m x 180.1 m)
   cross-check (predicted vs observed, px): W corner row 447.0 vs 448.0 (d=-1.0); E corner row 1394.4 vs 1394.5 (d=-0.1); N corner col 1501.4 vs 1500.0 (d=+1.4); S corner col 456.2 vs 457.0 (d=-0.8)
2026-08-18: 1880x1847 bands=3 footprint xl=146 xr=1805 yt=123 yb=1729 lit=52.8%
   polygon lon 102.63044..105.40238 lat 11.52448..14.14106
   brief formulas -> west 102.3865 east 105.5277 north 14.3415 south 11.3322   dlon 0.0016708 dlat 0.0016293 deg/px  (181.4 m x 180.2 m)
   cross-check (predicted vs observed, px): W corner row 454.9 vs 456.0 (d=-1.1); E corner row 1402.4 vs 1401.0 (d=+1.4); N corner col 1502.6 vs 1502.5 (d=+0.1); S corner col 457.5 vs 459.5 (d=-2.0)
2026-10-29: 1880x1847 bands=3 footprint xl=151 xr=1810 yt=142 yb=1748 lit=52.8%
   polygon lon 102.63847..105.41001 lat 11.49428..14.1107
   brief formulas -> west 102.3862 east 105.5270 north 14.3420 south 11.3330   dlon 0.0016706 dlat 0.0016292 deg/px  (181.3 m x 180.1 m)
   cross-check (predicted vs observed, px): W corner row 473.9 vs 475.0 (d=-1.1); E corner row 1421.5 vs 1420.5 (d=+1.0); N corner col 1507.7 vs 1507.0 (d=+0.7); S corner col 462.6 vs 463.5 (d=-0.9)
spread across dates (deg): west 0.00054 east 0.00142 north 0.00058 south 0.00077  -> in px: 0.32 0.85 0.36 0.47
brief quotes: west 102.3865, east 105.5270, north 14.3420, south 11.3330
````

**File:** `<scratch>/review/geo-frontend-engineer/run2/d4/fit.json`  
**Bytes:** 892, sha256 starts `66d98f5a2f09bc67`  
**Status:** saved by `d4_check.py`.

````json
[
 {
  "date": "2026-06-19",
  "W": 1880,
  "H": 1847,
  "xl": 144,
  "xr": 1804,
  "yt": 115,
  "yb": 1721,
  "west": 102.38674520481928,
  "east": 105.52627725301205,
  "north": 14.34192404732254,
  "south": 11.33285513075965,
  "dlon": 0.0016699638554216912,
  "dlat": 0.0016291656288916557
 },
 {
  "date": "2026-08-18",
  "W": 1880,
  "H": 1847,
  "xl": 146,
  "xr": 1805,
  "yt": 123,
  "yb": 1729,
  "west": 102.38649591320072,
  "east": 105.5276937432188,
  "north": 14.34145809464508,
  "south": 11.332228169364882,
  "dlon": 0.0016708499095840872,
  "dlat": 0.0016292528019925274
 },
 {
  "date": "2026-10-29",
  "W": 1880,
  "H": 1847,
  "xl": 151,
  "xr": 1810,
  "yt": 142,
  "yb": 1748,
  "west": 102.38620807112719,
  "east": 105.52695261603375,
  "north": 14.342039750933997,
  "south": 11.332993835616438,
  "dlon": 0.0016706088004822192,
  "dlat": 0.0016291531755915317
 }
]
````

## C15. Four-corner placement error in Web Mercator

### C15. Calculation

Source: run 2, tool call 60 (2026-11-14 08:00:51 UTC). Step: Compute the misplacement when a lat/lon preview is stretched linearly in Web Mercator.

````text
Placing a lat/lon-gridded preview with a 4-corner MapLibre image source: worst north-south misplacement
  stack 083_A_008 extent from the brief        498 m  =   2.8 preview px (180 m)  at lat 12.86  drawn too far north
  3 deg frame at 30 N                         1254 m  =   7.0 preview px (180 m)  at lat 30.01  drawn too far north
  3 deg frame at 48 N                         2404 m  =  13.4 preview px (180 m)  at lat 47.90  drawn too far north
  3 deg frame at 64 N                         4436 m  =  24.6 preview px (180 m)  at lat 63.89  drawn too far north
  3 deg frame at 69 N                         5694 m  =  31.6 preview px (180 m)  at lat 69.09  drawn too far north
  3 deg frame at 75 S                         8126 m  =  45.1 preview px (180 m)  at lat -74.98  drawn too far south
````

### C15b. The GIBS mosaic attempt that ended run 2

Source: run 2, tool call 61 (2026-11-14 08:01:24 UTC). Step: Fetch the GIBS NISAR tile mosaic for one date as an independent georeference. The tool call ended with an error status.

````text
Exit code 1
Traceback (most recent call last):
  File "<scratch>/review/geo-frontend-engineer/run2/d4/code/gibs_mosaic.py", line 24, in <module>
    if a.shape[0] == 1 and d.colormap(1):           # paletted PNG
                           ^^^^^^^^^^^^^
  File "rasterio/_base.pyx", line 1341, in rasterio._base.DatasetBase.colormap
  File "rasterio/_base.pyx", line 385, in rasterio._base.DatasetBase.band
  File "rasterio/_base.pyx", line 378, in rasterio._base.DatasetBase.handle
rasterio.errors.RasterioIOError: Dataset is closed: ../gibs/2026-06-19_10_470_805.png
````

## C16. Registries and local interpreters

### C16a. npm

Source: run 2, tool call 32 (2026-11-14 07:51:48 UTC). Step: Query the npm registry for current versions of the web libraries.

````text
maplibre-gl: dist-tags={'v1': '1.15.3', 'next': '6.0.0-22', 'latest': '6.18.0', 'latest-5': '5.24.1'}
   latest 6.18.0 published 2026-11-11; type=module main=None module=dist/maplibre-gl.mjs exports=yes peerDeps=None license=BSD-3-Clause engines={'npm': '>=8.1.0', 'node': '>=16.14.0'}
   deps={'pbf': '^5.1.2', 'earcut': '^3.2.4', 'kdbush': '^4.1.0', 'bidi-js': '^1.1.0', 'potpack': '^2.1.0', 'gl-matrix': '^3.4.4', 'tinyqueue': '^3.0.0', 'quickselect': '^3.0.0', '@maplibre/mlt': '^1.3.0', 'murmurhash-js': '^1.0.0', '@types/geojson': '^7946.0.16', '@mapbox/tiny-sdf': '^2.3.0', '@maplibre/vt-pbf': '^4.3.3', '@mapbox/unitbezier': '^1.0.0', '@mapbox/vector-tile': '^3.0.0', '@maplibre/geojson-vt': '^6.3.0', '@mapbox/point-geometry': '^1.1.0', '@maplibre/maplibre-gl-style-spec': '^26.6.0'}
   newest stable per major: {3: '3.6.2 (2023-11-23)', 4: '4.7.1 (2024-09-23)', 5: '5.24.1 (2026-11-11)', 6: '6.18.0 (2026-11-11)'}
@geomatico/maplibre-cog-protocol: dist-tags={'latest': '0.10.0'}
   latest 0.10.0 published 2026-09-18; type=None main=./dist/index.js module=./dist/esm/index.js exports=yes peerDeps={'maplibre-gl': '^4.5.0 || ^5.0.0 || ^6.0.0'} license=MIT engines=None
   deps={'geotiff': '^3.0.5', 'd3-scale': '^4.0.2', 'quick-lru': '^7.1.0', '@mapbox/sphericalmercator': '^2.0.2'}
   newest stable per major: {0: '0.10.0 (2026-09-18)'}
geotiff: dist-tags={'beta': '3.1.0-beta.0', 'latest': '3.0.5'}
   latest 3.0.5 published 2026-03-11; type=module main=dist-node/geotiff.js module=dist-module/geotiff.js exports=yes peerDeps=None license=MIT engines={'node': '>=10.19'}
   deps={'lerc': '^3.0.0', 'pako': '^2.0.4', 'zstddec': '^0.2.0', 'quick-lru': '^6.1.1', 'xml-utils': '^1.10.2', 'web-worker': '^1.5.0', 'parse-headers': '^2.0.2', '@petamoriken/float16': '^3.9.3'}
   newest stable per major: {0: '0.4.1 (2017-04-05)', 1: '1.0.9 (2021-11-30)', 2: '2.1.3 (2024-02-06)', 3: '3.0.5 (2026-03-11)'}
@mapbox/mapbox-gl-sync-move: dist-tags={'latest': '0.4.0', 'prerelease': '0.3.2-de9ffac'}
   latest 0.4.0 published 2026-11-09; type=None main=index.js module=None exports=no peerDeps=None license=ISC engines=None
   deps=None
   newest stable per major: {0: '0.4.0 (2026-11-09)'}
@maplibre/maplibre-gl-compare: dist-tags={'latest': '0.5.0'}
   latest 0.5.0 published 2021-08-11; type=None main=index.js module=None exports=no peerDeps={'maplibre-gl': '>=1.14.0'} license=ISC engines=None
   deps={'@mapbox/mapbox-gl-sync-move': '^0.3.0'}
   newest stable per major: {0: '0.5.0 (2021-08-11)'}
vite: dist-tags={'alpha': '6.0.0-alpha.24', 'beta': '8.3.0-beta.1', 'latest': '8.3.8', 'previous': '6.4.6'}
   latest 8.3.8 published 2026-11-11; type=module main=None module=None exports=yes peerDeps={'tsx': '^4.8.1', 'jiti': '>=1.21.0', 'less': '^4.0.0', 'sass': '^1.70.0', 'yaml': '^2.4.2', 'stylus': '>=0.54.8', 'terser': '^5.16.0', 'esbuild': '^0.27.0 || ^0.28.0', 'sugarss': '^5.0.0', '@types/node': '^20.19.0 || >=22.12.0', 'sass-embedded': '^1.70.0', '@vitejs/devtools': '^0.7.1 || ^0.8.0'} license=MIT engines={'node': '^20.19.0 || >=22.12.0'}
   deps={'postcss': '^8.5.32', 'rolldown': '~1.2.18', 'picomatch': '^4.0.7', 'tinyglobby': '^0.2.17', 'lightningcss': '^1.33.0'}
   newest stable per major: {5: '5.4.21 (2025-10-20)', 6: '6.4.6 (2026-11-09)', 7: '7.3.8 (2026-11-09)', 8: '8.3.8 (2026-11-11)'}
@vitejs/plugin-react: dist-tags={'alpha': '3.0.0-alpha.2', 'beta': '6.0.0-beta.0', 'latest': '6.3.0'}
   latest 6.3.0 published 2026-11-09; type=module main=None module=None exports=yes peerDeps={'vite': '^8.0.0', 'oxc-transform-react': '>=0.152.0 <0.157.0', '@rolldown/plugin-babel': '^0.1.7 || ^0.2.0 || ^0.3.0', 'babel-plugin-react-compiler': '^1.0.0'} license=MIT engines={'node': '^20.19.0 || >=22.12.0'}
   deps={'@rolldown/pluginutils': '^1.0.1'}
   newest stable per major: {3: '3.1.0 (2023-02-02)', 4: '4.7.0 (2025-07-18)', 5: '5.2.0 (2026-03-12)', 6: '6.3.0 (2026-11-09)'}
react: dist-tags={'beta': '19.0.0-beta-26f2496093-20240514', 'rc': '19.0.0-rc.1', 'next': '19.3.0-canary-d5736f09-20260507', 'latest': '19.3.1', 'backport': '19.1.10', 'experimental': '0.0.0-experimental-df6aa4ec-20261112', 'canary': '19.3.0-canary-df6aa4ec-20261112'}
   latest 19.3.1 published 2026-10-14; type=None main=index.js module=None exports=yes peerDeps=None license=MIT engines={'node': '>=0.10.0'}
   deps=None
   newest stable per major: {16: '16.14.0 (2020-10-14)', 17: '17.0.2 (2021-03-22)', 18: '18.3.1 (2024-04-26)', 19: '19.3.1 (2026-10-14)'}
typescript: dist-tags={'dev': '3.9.4', 'tag-for-publishing-older-releases': '4.1.6', 'insiders': '4.6.2-insiders.20220225', 'rc': '7.0.1-rc', 'latest': '7.0.2', 'beta': '7.1.0-beta', 'next': '7.1.0-dev.20261113.1'}
   latest 7.0.2 published 2026-07-08; type=module main=None module=None exports=yes peerDeps=None license=Apache-2.0 engines={'node': '>=16.20.0'}
   deps={'@typescript/typescript-aix-ppc64': '7.0.2', '@typescript/typescript-linux-arm': '7.0.2', '@typescript/typescript-linux-x64': '7.0.2', '@typescript/typescript-sunos-x64': '7.0.2', '@typescript/typescript-win32-x64': '7.0.2', '@typescript/typescript-darwin-x64': '7.0.2', '@typescript/typescript-netbsd-x64': '7.0.2', '@typescript/typescript-freebsd-x64': '7.0.2', '@typescript/typescript-linux-arm64': '7.0.2', '@typescript/typescript-linux-ppc64': '7.0.2', '@typescript/typescript-linux-s390x': '7.0.2', '@type [... 380 more characters on this line not copied]
   newest stable per major: {4: '4.9.5 (2023-01-30)', 5: '5.9.3 (2025-09-30)', 6: '6.0.3 (2026-04-16)', 7: '7.0.2 (2026-07-08)'}
gh-pages: dist-tags={'beta': '1.0.0-beta.1', 'latest': '6.3.0'}
   latest 6.3.0 published 2025-01-02; type=None main=lib/index.js module=None exports=no peerDeps=None license=MIT engines={'node': '>=10'}
   deps={'async': '^3.2.4', 'globby': '^11.1.0', 'fs-extra': '^11.1.1', 'commander': '^13.0.0', 'filenamify': '^4.3.0', 'find-cache-dir': '^3.3.1', 'email-addresses': '^5.0.0'}
   newest stable per major: {3: '3.2.3 (2021-06-21)', 4: '4.0.0 (2022-05-10)', 5: '5.0.0 (2023-01-20)', 6: '6.3.0 (2025-01-02)'}
````

### C16b. PyPI

Source: run 2, tool call 33 (2026-11-14 07:52:12 UTC). Step: Query PyPI for current versions of the pipeline libraries.

````text
rio-cogeo: latest 7.0.4 (2026-10-09) requires_python=>=3.11 wheels=1 mac-arm64-wheels=[]
    requires_dist: ['click>=7.0', 'morecantile<8.0,>=5.0', 'pydantic~=2.0', 'rasterio>=1.3.3']
rasterio: latest 1.5.2 (2026-09-30) requires_python=>=3.12 wheels=36 mac-arm64-wheels=['cp312-cp312-macosx_15_0_arm64.whl', 'cp313-cp313-macosx_15_0_arm64.whl', 'cp314-cp314-macosx_15_0_arm64.whl', 'cp314-cp314t-macosx_15_0_arm64.whl', 'cp315-cp315-macosx_15_0_arm64.whl', 'cp315-cp315t-macosx_15_0_arm64.whl']
    requires_dist: ['affine', 'attrs', 'certifi', 'click!=8.2.*,>=4.0', 'numpy>=2', 'pyparsing>=3.0']
earthaccess: latest 0.19.0 (2026-09-04) requires_python=>=3.12 wheels=1 mac-arm64-wheels=[]
    requires_dist: ['fsspec>=2025.2', 'importlib-resources>=6.3.2', 'multimethod>=1.8', 'pqdm>=0.1', 'python-cmr>=0.10.0', 'requests>=2.26', 's3fs>=2025.2', 'tenacity>=8.0', 'tinynetrc>=1.3.1', 'typing-extensions>=4.10.0']
asf-search: latest 14.1.0 (2026-10-14) requires_python=>=3.10 wheels=1 mac-arm64-wheels=[]
    requires_dist: ['requests', 'shapely', 'pytz', 'numpy', 'dateparser', 'python-dateutil', 'tenacity>=8.2.2']
h5py: latest 3.16.0 (2026-03-06) requires_python=>=3.10 wheels=47 mac-arm64-wheels=['cp310-cp310-macosx_11_0_arm64.whl', 'cp311-cp311-macosx_11_0_arm64.whl', 'cp312-cp312-macosx_11_0_arm64.whl', 'cp313-cp313-macosx_11_0_arm64.whl', 'cp314-cp314-macosx_11_0_arm64.whl', 'cp314-cp314t-macosx_11_0_arm64.whl']
pyproj: latest 3.8.0 (2026-09-05) requires_python=>=3.12 wheels=54 mac-arm64-wheels=['cp312-cp312-macosx_14_0_arm64.whl', 'cp313-cp313-macosx_14_0_arm64.whl', 'cp314-cp314-macosx_14_0_arm64.whl', 'cp314-cp314t-macosx_14_0_arm64.whl', 'cp315-cp315-macosx_14_0_arm64.whl', 'cp315-cp315t-macosx_14_0_arm64.whl']
numpy: latest 2.5.4 (2026-10-10) requires_python=>=3.12 wheels=65 mac-arm64-wheels=['cp312-cp312-macosx_11_0_arm64.whl', 'cp312-cp312-macosx_14_0_arm64.whl', 'cp313-cp313-macosx_11_0_arm64.whl', 'cp313-cp313-macosx_14_0_arm64.whl', 'cp314-cp314-macosx_11_0_arm64.whl', 'cp314-cp314-macosx_14_0_arm64.whl']
scipy: latest 1.18.1 (2026-08-21) requires_python=>=3.12 wheels=60 mac-arm64-wheels=['cp312-cp312-macosx_12_0_arm64.whl', 'cp312-cp312-macosx_14_0_arm64.whl', 'cp313-cp313-macosx_12_0_arm64.whl', 'cp313-cp313-macosx_14_0_arm64.whl', 'cp314-cp314-macosx_12_0_arm64.whl', 'cp314-cp314-macosx_14_0_arm64.whl']
fsspec: latest 2026.9.0 (2026-09-18) requires_python=>=3.10 wheels=1 mac-arm64-wheels=[]
morecantile: latest 7.1.0 (2026-09-16) requires_python=>=3.11 wheels=1 mac-arm64-wheels=[]
aiohttp: latest 3.14.5 (2026-10-11) requires_python=>=3.10 wheels=160 mac-arm64-wheels=['cp310-cp310-macosx_11_0_arm64.whl', 'cp311-cp311-macosx_11_0_arm64.whl', 'cp312-cp312-macosx_11_0_arm64.whl', 'cp313-cp313-macosx_11_0_arm64.whl', 'cp314-cp314-macosx_11_0_arm64.whl', 'cp314-cp314t-macosx_11_0_arm64.whl']
harmony-py: latest 1.8.0 (2026-10-06) requires_python=<4,>=3.10 wheels=1 mac-arm64-wheels=[]
h5netcdf: latest 1.8.3 (2026-11-11) requires_python=>=3.9 wheels=1 mac-arm64-wheels=[]
xarray: latest 2026.9.0 (2026-09-29) requires_python=>=3.11 wheels=1 mac-arm64-wheels=[]
````

### C16c. rasterio wheel platforms; this machine

Source: run 2, tool call 34 (2026-11-14 07:52:28 UTC). Step: List rasterio wheel platform tags and this machine's macOS version.

````text
1.5.2 2026-09-30 requires_python {'>=3.12'} pythons ['cp312', 'cp313', 'cp314', 'cp315']
    platforms: ['macosx_15_0_arm64.whl', 'macosx_15_0_x86_64.whl', 'manylinux_2_28_aarch64.whl', 'manylinux_2_28_x86_64.whl', 'win_amd64.whl', 'win_arm64.whl']
1.5.1 2026-08-08 requires_python {'>=3.12'} pythons ['cp312', 'cp313', 'cp314', 'cp315']
    platforms: ['macosx_14_0_arm64.whl', 'macosx_15_0_x86_64.whl', 'manylinux_2_28_aarch64.whl', 'manylinux_2_28_x86_64.whl', 'win_amd64.whl', 'win_arm64.whl']
1.5.0 2026-01-05 requires_python {'>=3.12'} pythons ['cp312', 'cp313', 'cp314']
    platforms: ['macosx_14_0_arm64.whl', 'macosx_15_0_x86_64.whl', 'manylinux_2_28_aarch64.whl', 'manylinux_2_28_x86_64.whl', 'win_amd64.whl', 'win_arm64.whl']
1.4.4 2025-12-12 requires_python {'>=3.10'} pythons ['cp310', 'cp311', 'cp312', 'cp313', 'cp314']
    platforms: ['macosx_14_0_arm64.whl', 'macosx_15_0_x86_64.whl', 'manylinux_2_28_aarch64.whl', 'manylinux_2_28_x86_64.whl', 'win_amd64.whl', 'win_arm64.whl']
1.4.3 2024-12-02 requires_python {'>=3.9'} pythons ['cp310', 'cp311', 'cp312', 'cp313', 'cp39']
    platforms: ['macosx_10_15_x86_64.whl', 'macosx_14_0_arm64.whl', 'manylinux_2_17_x86_64.manylinux2014_x86_64.whl', 'win_amd64.whl']
ProductName:		macOS
ProductVersion:		26.6.2
BuildVersion:		25G83
arm64
````

### C16d. What the scratch venv holds (first 80 lines)

Source: run 2, tool call 17 (2026-11-14 07:46:11 UTC). Step: Check which packages the existing scratch venv and node_modules hold.

````text
Activate.ps1
__pycache__
activate
activate.csh
activate.fish
dateparser-download
f2py
idna
jp.py
morecantile
normalizer
numpy-config
pip
pip3
pip3.12
pyproj
python
python3
python3.12
rio
tqdm
Python 3.12.2
Package               Version
--------------------- -----------
affine                3.0.1
aiobotocore           3.10.0
aiohappyeyeballs      2.7.1
aiohttp               3.14.5
aioitertools          0.13.0
aiosignal             1.4.0
annotated-types       0.8.0
asf_search            14.1.0
attrs                 26.1.0
botocore              1.43.117
bounded-pool-executor 0.0.3
certifi               2026.10.23
charset-normalizer    3.5.2
click                 8.5.1
dateparser            1.5.0
earthaccess           0.19.0
frozenlist            1.8.0
fsspec                2026.9.0
h5py                  3.16.0
idna                  3.20
importlib_resources   7.1.0
jmespath              1.1.0
morecantile           7.1.0
multidict             7.2.1
multimethod           2.1
numpy                 2.5.4
pip                   26.3
pqdm                  0.2.0
propcache             0.5.4
pydantic              2.14.3
pydantic_core         2.50.4
pyparsing             3.3.3
pyproj                3.8.0
python-cmr            0.13.0
python-dateutil       2.9.0.post0
pytz                  2026.6
rasterio              1.5.2
regex                 2026.11.9
requests              2.34.2
rio-cogeo             7.0.4
s3fs                  2026.9.0
scipy                 1.18.1
shapely               2.2.0
six                   1.17.0
tenacity              9.2.1
tinynetrc             1.3.1
tqdm                  4.70.1
typing_extensions     4.16.0
typing-inspection     0.4.5
tzlocal               5.4.5
urllib3               2.8.0
wrapt                 2.5.2
yarl                  1.25.1

@emnapi
@geomatico
[... 81 more lines not copied]
````

### C16e. Python interpreters on the machine

Source: run 2, tool call 29 (2026-11-14 07:51:04 UTC). Step: Find which Python interpreters exist on this machine.

````text
/opt/anaconda3/bin/python3
/opt/anaconda3/bin/python3-config
/opt/anaconda3/bin/python3.1
/opt/anaconda3/bin/python3.12
/opt/anaconda3/bin/python3.12-config
/opt/homebrew/bin/python3
/opt/homebrew/bin/python3-config
/opt/homebrew/bin/python3.14
/opt/homebrew/bin/python3.14-config
/usr/bin/python3
/usr/local/bin/python3
/usr/local/bin/python3-config
/usr/local/bin/python3-intel64
/usr/local/bin/python3.12
/usr/local/bin/python3.12-config
/usr/local/bin/python3.12-intel64
/opt/anaconda3/bin/python3 -> Python 3.12.2
/usr/bin/python3 -> Python 3.9.6
/usr/local/bin/python3 -> Python 3.12.5
/opt/homebrew/bin/python3 -> Python 3.14.3
/opt/homebrew/bin/python3.14 -> Python 3.14.3
/opt/anaconda3/bin/python3
/opt/homebrew/bin/python3
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
/usr/local/bin/python3
/usr/bin/python3
~/.pyenv/shims/python3
/opt/homebrew/bin/python3.14
~/.pyenv/shims/python3.14
````

### C16f. Tool versions, Anaconda base h5py and numpy, free disk (last 6 lines)

Source: run 1, tool call 8 (2026-11-14 02:54:24 UTC). Step: Inspect scratchpad folders and tool versions.

````text
[... 56 earlier lines not copied]

v22.15.0
10.9.2
Python 3.12.2
3.11.0 1.26.4
/dev/disk3s5   460Gi   386Gi    34Gi    93%    3.5M  351M    1%   /System/Volumes/Data
````

### C16g. npm publish history

Source: run 1, tool call 16 (2026-11-14 02:58:20 UTC). Step: Check npm registry versions for web stack packages.

````text
== maplibre-gl
{  "version": "6.18.0",  "dist-tags": {    "v1": "1.15.3",    "next": "6.0.0-22",    "latest": "6.18.0",    "latest-5": "5.24.1"  },  "time.modified": "2026-11-11T21:28:04.702Z"}
== @geomatico/maplibre-cog-protocol
{  "version": "0.10.0",  "dist-tags": {    "latest": "0.10.0"  },  "time.modified": "2026-09-18T16:33:31.794Z"}
== geotiff
{  "version": "3.0.5",  "dist-tags": {    "beta": "3.1.0-beta.0",    "latest": "3.0.5"  },  "time.modified": "2026-03-30T16:00:06.852Z"}
== @mapbox/mapbox-gl-sync-move
{  "version": "0.4.0",  "dist-tags": {    "latest": "0.4.0",    "prerelease": "0.3.2-de9ffac"  },  "time.modified": "2026-11-09T14:52:33.321Z"}
== @maplibre/maplibre-gl-compare
{  "version": "0.5.0",  "dist-tags": {    "latest": "0.5.0"  },  "time.modified": "2026-10-23T11:59:23.866Z"}
== vite
{  "version": "8.3.8",  "dist-tags": {    "alpha": "6.0.0-alpha.24",    "beta": "8.3.0-beta.1",    "latest": "8.3.8",    "previous": "6.4.6"  },  "time.modified": "2026-11-11T02:49:46.745Z"}
== react
{  "version": "19.3.1",  "dist-tags": {    "beta": "19.0.0-beta-26f2496093-20240514",    "rc": "19.0.0-rc.1",    "next": "19.3.0-canary-d5736f09-20260507",    "latest": "19.3.1",    "backport": "19.1.10",    "experimental": "0.0.0-experimental-df6aa4ec-20261112",    "canary": "19.3.0-canary-df6aa4ec-20261112"  },  "time.modified": "2026-11-12T16:22:01.415Z"}
== typescript
{  "version": "7.0.2",  "dist-tags": {    "dev": "3.9.4",    "tag-for-publishing-older-releases": "4.1.6",    "insiders": "4.6.2-insiders.20220225",    "rc": "7.0.1-rc",    "latest": "7.0.2",    "beta": "7.1.0-beta",    "next": "7.1.0-dev.20261113.1"  },  "time.modified": "2026-11-13T08:12:43.757Z"}

== maplibre-gl recent versions
6.9.0 2026-09-09T12:51:01.315Z
6.9.1 2026-09-14T17:30:03.066Z
6.10.0 2026-09-15T20:31:00.778Z
6.11.0 2026-09-22T22:08:48.289Z
6.11.1 2026-09-23T09:51:47.377Z
6.11.2 2026-09-24T12:44:57.542Z
6.12.0 2026-10-03T21:45:26.768Z
6.13.0 2026-10-06T19:55:16.665Z
6.14.0 2026-10-11T14:34:38.733Z
6.15.0 2026-10-18T13:01:20.618Z
6.16.0 2026-10-25T13:17:01.849Z
6.17.0 2026-11-07T23:03:58.965Z
5.24.1 2026-11-11T13:44:55.218Z
6.18.0 2026-11-11T21:28:03.738Z
latest 5.x: ('2026-11-11T13:44:55.218Z', '5.24.1')
latest 4.x: ('2024-09-23T09:02:58.039Z', '4.7.1')
first 6.x: ('2026-04-27T20:06:33.066Z', '6.0.0-0') count 6.x 46
````

