# Brief: an optical cross-check of the harvest map

Written Saturday 14 November 2026, 20:45 Central Time, by the build session (the lead builder), at the
team's request. **You are a further agent, run by a teammate under another account.** Your task is a small,
self-contained analysis. It touches no code of the pipeline or the app.

## Why

The app's harvest map says when the radar saw each 100 m rice cell fall. Two checks have been made, and both
say the map misses much of the harvest (`docs/METHODS.md`, section 6, "Results for `tarn-taran` (run of Saturday 14 November 2026)"):

- Officials report 85 % of Punjab's rice harvested by 4 November and more than 90 % in Tarn Taran and Amritsar; the
  radar gives a harvest pair to 45 % (HH) or 68 % (HV) of the box's rice cells by then.
- About seven in ten fire detections on rice lie on cells the radar still calls "not harvested".

So **"no harvest seen" is not "still standing"**, but nobody has measured how wrong it is, cell by cell.
Optical satellites see a cut field as a loss of green. Your job: measure, on the same cells, what an optical
vegetation index says about the cells of each radar class. This is the judges' likely first question ("why
does your map disagree with the state's figures?"), and today the answer is a list of untested guesses.

## The method is fixed here, before anyone has looked at optical data for this site

The team fixes its tests before seeing results (see "The marker rule" in `PROGRESS.md`). The same holds
here: the definitions below were committed before any optical value was read. Follow them exactly. If
something is ambiguous, take the most literal reading and report it. You may add other looks at the data, but
only in a section headed "Exploratory, added after seeing the data".

1. **Inputs, in this repository** (`research/optical_check/inputs/`, copies from the pipeline run of
   Saturday 20:29 at commit `5f73b8d`):
   - `harvest_classes.tif`: the class of every 100 m cell on the product's own grid (EPSG:32643, 286 columns
     by 288 rows, upper left corner x 479010, y 3467310). Band 1 is HH, band 2 is HV. Values: 1, 2, 3 = harvest
     pair ending on the pass of 2026-10-11, 2026-10-23, 2026-11-04; 4 = rice, no harvest seen by 2026-11-04;
     5 = fell before 2026-09-29; 6 = not rice; 0 = no data.
   - `harvest.json` and `marker.json`: every number of the radar analysis and of the marker test.
   - The site box and the stable target (Patti town) are in `pipeline/sites/tarn-taran.yaml`.
2. **Optical data: Sentinel-2 Level-2A surface reflectance** (ESA Copernicus), read as Cloud-Optimized
   GeoTIFFs over https from the public Earth Search catalog, no login:
   `https://earth-search.aws.element84.com/v1`, collection `sentinel-2-l2a`, assets `red` (B04, 10 m), `nir`
   (B08, 10 m) and `scl` (scene classification, 20 m). A catalog query on 14 November listed 38 scenes over
   the box from 10 September to 14 November 2026, on tiles 43RDQ and 43REQ, both in EPSG:32643, the product
   grid's own projection. The box should lie wholly inside tile 43RDQ: check it on your first scene, and use
   one tile per date. Read only the window of the box. Mind the reflectance offset of newer processing
   baselines (the item property `earthsearch:boa_offset_applied`, or the scene's metadata): use true
   reflectance. Dates: every scene from 2026-09-10 to 2026-11-14.
3. **Valid pixels.** A 10 m pixel is valid when both bands hold data and its SCL class is 2, 4, 5, 6 or 7
   (dark area, vegetation, not vegetated, water, unclassified). Classes 0, 1, 3, 8, 9, 10 and 11 (no data,
   defective, cloud shadow, clouds, cirrus, snow) are dropped. Dark-area pixels stay in on purpose: a burned
   field is dark. A 20 m SCL pixel covers the 2 by 2 pixels of 10 m under it.
4. **Cells.** The same 100 m cells as the radar analysis: a cell is exactly 10 by 10 Sentinel-2 pixels (both
   grids sit on multiples of 10 m; assert this). A cell has a value on a date when at least 50 of its 100
   pixels are valid. Its NDVI is (N - R) / (N + R), where N and R are the means of the near-infrared and the
   red reflectance over its valid pixels (the ratio of the means, as the radar averages power, not decibels).
5. **Usable dates.** A date is usable when at least 80 % of the test's rice cells have a value. List every
   date with its share, usable or not.
6. **The test's rice cells:** cells with a rice class (1 to 5) in both bands, as in the marker test.
7. **Primary result, no threshold involved: NDVI by radar class and date.** For each usable date, the
   median, the quartiles and the number of cells of NDVI, for each class of the HV map and of the HH map
   (classes 1 to 4 and 5), for the cells that are not rice, and for the cells of the stable target's box.
   One table per polarization, and one figure drawn by code from those numbers (HV classes as lines over
   time, the radar passes marked). This alone shows whether "no harvest seen" cells lose their green like
   the others, later, or not at all.
8. **Secondary result: cut or not, per cell, with two thresholds fixed in advance.**
   - `T_pooled`: Otsu's threshold on the NDVI of the test's rice cells pooled over all usable dates from
     2026-09-15 on (a histogram of 240 bins from -0.2 to 1.0; `pipeline.harvest.otsu_threshold` takes a
     range and a bin count). It separates green from not green. **Caveat to state:** ripening rice loses
     green before it is cut, so this threshold calls some standing, ripe rice "cut".
   - `T_strict`: the 75 % quantile (numpy, method `inverted_cdf`) of the NDVI of the cells that have
     harvest pair 1 or 2 in **both** HH and HV (cut by 23 October by both), pooled over the usable dates
     from 2026-10-24 to 2026-11-04. Three quarters of the confidently cut cells lie at or below it. If there
     is no usable date in that span, say so and give no strict result.
   - A cell is "cut by day D" under a threshold when its NDVI is below the threshold on some usable date
     from 2026-09-29 to D, having been at or above it on an earlier usable date from 2026-09-10 on. Cells
     that were never at or above it are "never green" and are counted apart. Later dates are not looked at
     (wheat sown after the harvest turns fields green again).
   - For each radar pass P (2026-10-11, 2026-10-23, 2026-11-04) take two days: the last usable date on or
     before P and the first usable date on or after P. Name them.
9. **The tables to report**, for each threshold and both days of each pass:
   - The share of the test's rice cells cut by that day, beside the radar's share with a harvest pair by P
     (HH and HV, from `harvest.json`) and the official figures quoted in `docs/METHODS.md`.
   - **Of the cells each polarization calls "no harvest seen by 4 November": the share that is cut by the
     days around 4 November, and by the last usable date of the series.** This is the number the team needs.
   - Of the cells each polarization gives a harvest pair ending on P: the share cut by the day on or after
     P (the radar was right or early), and the share still not cut then (the radar's early calls).
   - Agreement of each polarization with the optical state at each pass (cells where both say harvested or
     both say not), with a 95 % interval from a block bootstrap: blocks of 10 by 10 cells (1 km), 2000
     replicates, `numpy.random.default_rng(20261115)`, the 2.5th and 97.5th percentiles.
   - How often a "cut" cell is at or above the threshold again on the next usable date.
10. **What this cannot do**, to be said with the results: an optical index sees green, not stems, so
    ripening, weeds, a second crop and smoke haze all move it; a 100 m cell holds several fields; cloud and
    smoke leave gaps, so "cut by day D" depends on which dates are usable; Sentinel-2 passes at about
    11:00 local time and NISAR at 05:43, days apart; and the comparison is made afterwards, like the fire
    check. **The marker decision (HV) is not reopened by this**: it was made by a rule fixed beforehand.
    Report what the numbers say about HH and HV, without recommending a change.

If time is left after the above is done and checked, repeat steps 7 to 9 with NASA's Harmonized Landsat
Sentinel-2 product (HLS 2.0, 30 m, which adds Landsat dates; the collections `hls2-s30` and `hls2-l30` on
Microsoft's Planetary Computer catalog, whose asset links need its public signing endpoint), as a second
table. It is the NASA product the concept names. Do not start it before the Sentinel-2 run is finished.

## What to deliver

Everything in `research/optical_check/`, on a branch `optical-check`:

- `optical_check.py`: one script, small pure functions (the cell means, NDVI, the masks, the thresholds, the
  cut day, the bootstrap), with the reading and the report around them. Python only, with the libraries the
  pipeline already pins (`numpy`, `rasterio`, `pyproj`, `matplotlib`, the standard library for the catalog
  requests). No new dependency. Cache what you download under `work/optical/` (git ignores `work/`); commit
  no imagery.
- `test_optical_check.py`: tests of the pure functions on small made-up arrays, labelled SYNTHETIC, each able
  to fail (a 10 by 10 block maps to its cell and to no other; the ratio of means, not the mean of ratios; a
  masked class is left out; "cut by day" needs an earlier green date; the day on or before and on or after a
  pass; the bootstrap repeats with its seed). Run them with `python -m pytest research/optical_check`.
- `results.json` (every number, the scenes used with their ids, the thresholds, the settings), `RESULTS.md`
  (the tables, the dates, then at most ten lines of reading, written as hypotheses and marked as
  AI-written and unchecked) and `ndvi_by_class.png` (drawn by code from `results.json`; say so in its caption).
- A pull request to `main` titled "Optical cross-check of the harvest map", by **Sunday 06:00 CT**. In its
  description: which model you are, the answer to step 9's second table in one sentence, everything that was
  ambiguous and what you did, what could not be done, and the lines `docs/SOURCES.md` needs (Copernicus
  Sentinel data with its legal notice and the credit "Contains modified Copernicus Sentinel data 2026"; the
  Earth Search catalog by Element 84; HLS and its citation if used). The lead builder reviews it, writes the
  agreed numbers into `docs/METHODS.md`, and records your work in `AI_USE.md`.

## Rules

- Read `CLAUDE.md` first; its rules apply. Honest numbers: nothing invented, nothing tuned after seeing
  the result, missing dates shown as missing. These results do not go on the public site; they go into the
  methods page and the pitch as a comparison made after the fact.
- Change only `research/optical_check/` (and `work/`, which git ignores). Do not edit `pipeline/`, `web/`,
  `contract/`, `docs/`, `PROGRESS.md` or `AI_USE.md`; describe in the pull request what should change there.
- Requests go to the public catalog and its public files only. Put nothing about the team or the project in
  a request beyond the box and the dates. No credentials are needed; do not look for any.
- Commit small, messages say what and why, **no `Co-Authored-By` line**. A Windows or a Mac machine: build
  paths with `pathlib`, no shell scripts.
- The pitch agent (branch `pitch-prep`) will quote your result once the lead has agreed it. Do not edit
  its files.
