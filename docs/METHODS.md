# Methods

What was done to the data, with the numbers, so a scientist can judge it and someone else can repeat it.
The method texts in the app (with each layer, the fire overlay and the fire charts) are short versions of
this page. Keep it true: change it in the same commit that changes the processing.

> **Status.** Sections 1 to 3 describe the processing chain as built in the scaffold, demonstrated on
> the sample site (retired from the public app on 14 November 2026) and run on the team's site
> `tarn-taran` on 14 November 2026. Section 4 describes the harvest analysis as built ("Analysis: harvest
> pairs") and section 6 the comparison with NASA's fire detections and the test that chooses the marker
> ("Choosing the marker") as built, with the first results for `tarn-taran`.
> Section 5 and the site-specific limitations of section 7 are for the team and are **not written yet**.

## 1. Data

| Site | Product | Stack | Release | Dates | Granules |
|---|---|---|---|---|---|
| `sample` (not NISAR observations; retired from the public app on 14 November 2026) | NISAR-format L2 GCOV sample product made from ALOS-1 PALSAR | 030_A_019 | sample | 2008-10-12, 2008-11-27 | `pipeline/sites/sample.granules.json` |
| `tarn-taran` | NISAR L2 GCOV, frequency A, HH and HV | 156_A_017 | mixed: provisional (22 dates, version P05023) and validated (2 dates, P05036) | 24 dates from 2025-11-21 to 2026-11-04; 6 missing passes listed in `site.json` | `pipeline/sites/tarn-taran.granules.json` |

For every site the exact granules, their processing versions and their source URLs are recorded in
`pipeline/sites/<site>.granules.json` and repeated in `web/public/data/manifest.json` (`dates`).

Product facts relied on (NISAR L2 GCOV): geocoded, radiometrically terrain-corrected gamma-naught
backscatter in linear power, on a UTM grid (polar stereographic beyond 60° latitude), with pixel-centre
coordinates and a validity mask.

## 2. Processing chain

Every step is a function with a test; file names refer to `pipeline/`.

1. **Selection** (`cmr.py`, `discover.py`). One stack per site (track, direction, frame). When the catalog
   holds more than one granule for a pass, one is kept and the others are listed as excluded with the
   reason. Dates lacking the needed polarization are excluded, not filled.
2. **Window read** (`access.py`, `gcov.py`). Only the site's bounding box is read from each granule. File
   coordinates are pixel centres with a descending y axis; the raster origin is the first centre minus
   half a pixel. What the file contains (frequencies, polarizations, covariance terms, projection) is read
   from the file, not assumed.
3. **Validity** (`process.py`). A sample is kept only if the product mask marks it valid, it is finite and
   its power is above a floor (`power_floor` in the site config, default 1e-5, which is -50 dB: far
   below anything physical, but above the ~1e-14 values real files carry at scene edges). Everything else
   becomes NaN before any averaging. The meaning of the mask values is taken from the file's product
   specification version, and the unique mask values of every file are recorded. The input-data exception
   flag (`hasInputDataException`) is recorded for every file, both as set or not and as the code it holds
   (2 means a "qFSP-H1 sample slip" somewhere in the granule). When it is set, `fetch` also reads the file's
   `inputDataExceptionMask` over the window, records in the window's sidecar how many pixels carry an
   anomaly code and, only if that file's mask carries focus bits, how many are not fully focused in each
   polarization, and prints a warning with those counts, again on every re-run. The mask's layout differs
   between specification versions, so it is read from each file (its description attribute, type and
   `_FillValue`), not from the version number. Seen on real files of one site on 14 November 2026:
   specification 1.5.0 has a uint8 mask with anomaly codes only (a good pixel is 0, no fill value, no focus
   information at all); specification 1.6.0 has a uint16 mask that adds one "fully focused" bit per
   polarization (a good pixel of an HH and HV file holds 768, not 0; fill 65535). This mask never removes a
   pixel: whether flagged pixels should go is the team's decision (`docs/TASKS.md`, T2).
4. **Multilooking** (`process.py`). Block mean in **linear power** from the product posting to the site's
   `working_resolution_m`, ignoring NaN. A block needs at least `min_valid_fraction` (default 0.5) of its
   samples valid, otherwise it is no data. The working resolution must be a whole multiple of the posting.
5. **Grid check** (`process.py`). Every date of a site must sit on one identical grid (same projection,
   origin, spacing and shape). The run stops if not.
6. **Reprojection** (`export.py`). Linear power is resampled to EPSG:3857 on the web map tile grid
   (averaging when coarsening, bilinear otherwise, NaN-aware). With `display_zoom: auto` the zoom level is
   the one whose ground pixel at the site's latitude is closest to the working resolution. The raster's
   top-left corner sits on a tile corner, so the file is written without a second resampling.
7. **Decibels and encoding** (`encode.py`). `dB = 10 log10(power)`, then stored as 8-bit codes:
   `code = 1 + round(254 (dB - lo) / (hi - lo))`, clipped to 1..255, 0 for no data. `lo` and `hi` are in the
   manifest. The share of valid pixels clipped at either end is logged.
8. **Packaging** (`export.py`). Cloud-Optimized GeoTIFF, DEFLATE with predictor 2 (lossless), internal
   overviews by averaging. Overviews are for zoomed-out display only.
9. **Click-query stack** (`export.py`). One band per date, `stack_zoom_offset` zoom levels coarser than the
   display files (default 2, so cells four times as wide), each band resampled from linear power by
   averaging, so a charted point is a cell mean of power expressed in dB.
10. **Statistics** (`stats.py`). Per-date mean over the window: mean of linear power on the multilooked
    grid in the product's own projection (not the web map grid), then dB, with the pixel count. Every date
    is averaged over the same pixels, those valid on all dates of the series; a date with too little
    coverage is published as missing instead.

### Building block: pair log-ratio

For each pair of consecutive dates of the stack: `10 log10(P_later / P_earlier)`, where each `P` is linear
power on the display grid after a boxcar mean (`change_boxcar_px` pixels wide, default 3). Positive values
mean higher backscatter on the later date. This is a difference image, not a change detection: see
section 4. Remove the `change` block from a site's config to switch it off.

### Check: stable target

A time series of backscatter can only be trusted if ground that should not change reads the same on every
date. The `qa` stage (`qa.py`) tests this when the site config names a `stable_target`: a name and a lon/lat
box inside the site's box (see `pipeline/sites/_template.yaml`). Which ground to use is the team's choice:
something that should not change between the site's dates, such as dense forest or a city. Without the
setting the check is skipped and `qa` says so.

- **Pixels.** Pixels of the processed rasters (masked, multilooked linear power on the product's own grid,
  steps 3 and 4) whose centres lie inside the box. A date with fewer than 100 of them valid (in every
  polarization), such as a partial frame that misses the box, is left out of the check and named ("target
  not covered on this date"), as the statistics series leaves out a date with too little coverage. Of the
  dates that remain, only the pixels valid on every one of them and in every polarization are used, so
  every number compares the same ground. Fewer than 100 such pixels give "not enough pixels" instead of a
  number; `qa` advises a larger box only when no date has 100 valid pixels in it, and otherwise says that
  the dates cover different parts of the box. A box that the processed rasters do not reach at all stops
  `qa` as a configuration error; a box only partly on them is used for the part that is, and `qa` says so.
- **Value per date and polarization.** The mean of linear gamma-naught power over those pixels, converted
  to dB as the last step. (The mean of the dB values would read lower, by an amount that depends on the
  speckle and on how mixed the target is.)
- **Reference and deviation.** The reference is the median of the dates' mean powers, in dB. A date's
  deviation is `10 log10(P_date / P_reference)`, stored to 0.001 dB.
- **Flag.** A date whose stored deviation exceeds `tolerance_db` (default 1.0 dB) is flagged. With an even
  number of dates the median lies between the two middle dates, closer in dB to the higher one; when those
  two differ by more than the tolerance there is no single reference, and blaming the dates far from the
  median would always blame the lower half. The dates are then reported as two halves that disagree: every
  date is flagged, each date's deviation is taken from the closest date of the other half, and the warning
  blames neither half. With exactly two dates this compares them directly: when they differ by more than
  the tolerance both are flagged and the warning says the two disagree without blaming either. A single
  date has nothing to compare.
- **What a flag means.** On ground that should not change, a jump points to a calibration, mode or release
  problem with that date, not to a change on the ground. A flag is a printed warning: it does not stop the
  run and changes nothing that is published. What to do with the date is the team's decision
  (`docs/TASKS.md`, T4).
- **Output.** `work/<site>/qa/stable_target.json` (target, tolerance, pixel counts, the dates left out and,
  per polarization, every date's value, deviation and flag) and a table printed by `qa`. Like every stage
  output it is redone when the target, the tolerance, the dates or a processed raster change.

## 3. What has and has not been checked

| Check | State |
|---|---|
| Window arithmetic, mask handling, multilook, encoding round trip, reprojection placement, COG properties | Automated tests on synthetic NISAR-format files (`npm test`) |
| Whole chain on real NISAR-format files | Run on NASA's public sample product (the `sample` site) |
| Whole chain on real NISAR observations | Run on the team's site `tarn-taran` on 14 November 2026 (Earthdata login verified the same day): all 26 windows fetched and processed onto one grid by 15:59 CT, 24 dates exported and published at 16:10 CT, the two products unusable here listed as missing passes. Re-run through the hardened pipeline (recorded at 16:42 CT): every display raster and both stacks came out byte for byte the same |
| Mask values and exception mask in real files | Seen in one 31 km window of one validated granule of specification 1.6.0 on 14 November 2026: `mask` 1 and 0 only (0 on 65 pixels that are NaN in the data anyway), every `inputDataExceptionMask` pixel 768 (HH and HV fully focused, no anomaly), `hasInputDataException` 0. Seen the same day on one site's 24 dates: 22 in specification 1.5.0, whose `inputDataExceptionMask` is uint8 with no focus bits and no `_FillValue` (a good pixel is 0), and 2 in 1.6.0 with the layout above. Five 1.5.0 files hold `hasInputDataException` 2 (sample slip), yet their exception mask is 0 over the whole site window and their `mask` is 1 (valid) there: the slip is elsewhere in the granule. Until that day the code read every file with the 1.6.0 layout and reported those five windows 100 % "not fully focused", which was false; it now reads the layout from each file. **Not yet observed:** other windows (a swath edge: mask 2 to 5 and 255) |
| Stable-target check (`qa`) | Automated tests on synthetic files. Run on `tarn-taran` on 14 November 2026 (16:42 CT) with the target Patti town: 3660 pixels valid on every date, every date within 1 dB of the median (HH -4.38 dB, HV -11.47 dB), no jump across the release boundary |
| Harvest analysis (`analyse`, section 4) and its layer | Automated tests on synthetic files (`pipeline/tests/test_harvest.py`, `test_end_to_end.py`). First run as a stage on `tarn-taran` on 14 November 2026 (19:15 CT); the published layer, from HV, made at 20:29 CT. Results: section 6, "Results for `tarn-taran`" |
| Fire detections (`fires`, section 6): fetching, the overlay, the fire bars | Automated tests with a fake FIRMS server and SYNTHETIC detections (`pipeline/tests/test_fires.py`). Run against the real FIRMS API on 14 November 2026: 39 requests at 19:15 CT, 452 detections in the box from 15 September to 14 November; fetched once more at 20:28 CT, unchanged. The overlay and the fire bars looked at on the real data in the browser at 20:39 CT. The answer to a bad key is taken from FIRMS's documentation, not from a real answer |
| The marker test (`marker`, section 6, "Choosing the marker") | Automated tests on hand-built SYNTHETIC class grids and detections and on the synthetic harvest site (`pipeline/tests/test_marker.py`), including a bootstrap written out by hand and an independent computation of every weight. Built before any real fire data was analysed; run once on `tarn-taran` on 14 November 2026 at 20:28 CT: HV, by rule item 4 (section 6, "Results for `tarn-taran`") |
| Agreement with an independent source | First results: section 6, "Results for `tarn-taran`" (run of 14 November 2026) |

## 4. Analysis *(to be written by the team with the builder)*

For each derived layer: what question it answers, the exact computation, every threshold with how it was
chosen from this site's data, and the false-alarm rate over an area that should not change.

Guard rails from NASA's training material and our own checks:

- Compare only one stack and one release.
- At native resolution the difference of two unchanged pixels has a standard deviation of 2 to 4 dB.
  Average to roughly 50 to 100 looks before thresholding. (The 2 to 4 dB is from our own simulation of
  speckle, not from NISAR files: `research/digests/science.md`, section 1, item 1.)
- A two-sided "1.5 standard deviations of the difference image" rule flags about 13 % of pixels where
  nothing changed. Threshold one-sided in the expected direction and report the share flagged over a
  stable area. (The rule is from NASA ARSET exercises on Sentinel-1 C-band dB images, where it is used
  one-sided: `research/digests/science.md`, row D15. The 13 % is from our own simulation of an unchanged
  pair: its section 1, item 2.)
- There is no universal threshold for water or flooded vegetation; it varies by site.
- Usual confusions to rule out: radar shadow, wind-roughened or very calm water, smooth fields (against
  open water); cities and steep terrain (against flooded vegetation); a moisture difference (against a
  change in vegetation structure).

### Analysis: harvest pairs

The `analyse` stage (`harvest.py`) finds, for every rice cell, the pair of consecutive passes in which the
radar first saw its backscatter fall by more than a threshold taken from the site's own data. This section
describes the method as built. It makes no claim about any site: the numbers of a run are in
`work/<site>/analysis/harvest.json` and in `stats.json`. Which passes count as the flood, the canopy and
the harvest is set in the site file's `harvest` block (`pipeline/sites/_template.yaml`) and is the team's
choice.

1. **Cells.** The processed rasters (masked linear power on the product's own grid, section 2, steps 3
   and 4) are averaged in **linear power** over square cells of `cell_m` metres (default 100 m, a whole
   multiple of the working resolution: 5 x 5 pixels at 20 m). A cell has a value on a date only when at
   least half of its pixels are valid on that date. Rows and columns at the bottom and right edge that do
   not fill a whole cell are left out. Averaging 25 pixels damps speckle before any threshold is applied,
   as the guard rails above ask. Only cells whose centres lie inside the site's box take part: the
   processed window is the UTM rectangle around the box and so reaches a little beyond it, and the cells
   outside the box get no class (no data). The rice area, the harvest series and the class areas behind
   the fire bars (section 6) therefore all describe the same ground.
2. **Rice cells.** For each cell, from HH: the rise is the dB of its mean power over the `peak_dates`
   (mean of linear power first) minus its lowest dB over the `flood_dates`. A cell needs a value on every
   flood and peak date to have a rise. It is rice when its rise is at least the rice threshold, and "not
   rice" when its rise is below it. The threshold is the site file's `rice_rise_db`, or, with `auto`,
   Otsu's threshold on the rises of all cells that have one: a histogram of 400 bins of 0.1 dB from -10 to
   +30 dB (rises outside that range are counted in the end bins), split at the bin edge that makes the two
   groups most different (the largest variance between the groups). When several edges split equally well,
   as across an empty gap between two groups, the middle of them is used. Recorded: the threshold, where it
   came from, the number of rice cells and their area in km² (cells times the cell's area on the product's
   own grid, never on the web map's).
3. **Stable cells.** Cells whose centres lie inside one of the `stable_boxes` (lon/lat boxes; by default
   the box of the site's `stable_target`) and that are not rice.
4. **Change.** For each consecutive pair of the `passes` and for HH and HV separately: change =
   10 log10(later / earlier) of the cell's mean power. A cell takes part only when it has a value on every
   pass of the list, so every pair compares the same cells.
5. **Threshold**, one per polarization, the same for every pair. It is the more negative of two numbers:
   - (a) on stable cells, the `false_alarm` quantile (default 0.02) of the change, taken for each pair, and
     the lowest of these: on ground that should not change, at most 2 % of cells fall further than this
     between any two passes;
   - (b) on rice cells, the `false_alarm` quantile of the change in the **first** pair of the list. The site
     file must choose that pair before the harvest starts, so it measures how much standing rice varies
     from pass to pass. A town is steadier than a crop; (a) alone would call ordinary variation of the crop a
     harvest.

   A quantile here is the smallest observed change with at least that share of the cells at or below it, so
   at most that share of the cells falls strictly below it. A cell "falls" in a pair when its change is
   strictly below the threshold. Each reference needs at least 1/`false_alarm` cells (50 at 0.02); with
   fewer the run stops and says so. Recorded: both numbers, which one was used, the quantile of every pair,
   and, at the final threshold, the share of stable cells and of rice cells below it in every pair (for rice
   in the first pair, that is the false-alarm rate on standing rice).
6. **Classes.** A rice cell's harvest pair is the first pair, from the second pair of the list on, in which
   it falls. A rice cell that falls in no pair is "no harvest seen" by the last pass. A rice cell that falls
   already in the first pair is its own class, "fell before" the second pass, and is not hidden. Cells
   without a value on a pass they need (a flood or peak date, or, for rice, any pass of the list) have no
   class: no data. In the class raster and the map, harvest pair k (counted from the second pair) has value
   k; then come "no harvest seen", "fell before" and "not rice"; 0 is no data. The value of "fell before"
   stays reserved even when no cell has it, so a value always means the same class.
7. **Diagnostics**, all in `harvest.json`, for HH and HV: the share of the counted rice cells with a
   harvest pair by each pass; a table of every rice cell's HH class against its HV class; the share of
   cells that "came back" (on the pass after their harvest pair, their value is above the value before
   the pair minus half the threshold's size; cells harvested in the last pair cannot be checked); for
   cells whose value fell by more than 4 dB from the first pass to the last, the largest fall between two
   consecutive passes as a fraction of that total fall (near 1: in one step); and the mean of rice and of
   stable cells on every pass (mean of linear power, then dB).
8. **Outputs.** `work/<site>/analysis/harvest.json` (every number above and the settings used) and
   `harvest_classes.tif` (the classes of HH and of HV, one band each, on the product's grid at cell size,
   0 = no data). `export` then publishes:
   - the static layer `harvest-wave`, the classes of the `marker` polarization (default HH), as a
     `categorical-uint8` file: warped to the web map's grid by nearest neighbour and with overviews built
     by nearest neighbour, so no pixel at any zoom holds an average of two classes (`validate` checks this,
     rule 10 of `docs/DATA_CONTRACT.md`). Its colours are colour-blind safe and run in time order: viridis
     colours for the harvest pairs, yellow for "no harvest seen", lilac for "fell before", grey for "not
     rice";
   - two series in `stats.json`, HH and HV: the share of the counted rice cells, in %, with a harvest pair
     ending on or before each pass from the third pass of the list on. The counted cells are the rice
     cells with a class (the same cells for every point); cells that fell before the second pass count in
     the total and never as harvested. The series' texts give both thresholds, the rice area and the
     false-alarm rates.

   Like every stage output, the analysis is redone when a setting, a date or a processed raster changes,
   and `export` refuses an analysis made from other settings.

**Limits of this method.**

- A 100 m cell holds several fields. Its value is the mean over all of them; a cell crosses the threshold
  only when enough of its power falls, so a partly harvested cell may be dated late or not at all.
- There are 12 days between looks. A harvest pair says between which two passes the fall happened, not on
  which day.
- HH and HV disagree about timing, and the team has not settled which of them marks the harvest. Both are
  computed and published; the `marker` setting only chooses which one draws the map.
- Draining a field before the harvest may lower HH (less water under the stems to bounce the signal) before
  the crop is cut, so an HH fall can come before the harvest.
- A series can mix two data releases, and a calibration step between them is neither corrected nor flagged
  by this method. The threshold is one number for every pair. A step that lowers every value across the
  boundary makes that pair's stable-ground quantile more negative, and so makes the threshold stricter for
  all pairs: harvests are missed in every pair. A step that raises every value shrinks the falls measured
  in that pair without changing the threshold, so harvests in that pair are under-counted. (A step inside
  the first pair moves the standing-rice reference as well.) If a step moves crops and stable ground by
  different amounts, the stable ground does not even show its size. `harvest.json` lists each pair's
  stable-ground quantile, where such a pair may stand out, and the stable-target check (`qa`) is the test
  for a jump across the boundary.
- The threshold lets about `false_alarm` of unchanged cells fall in each pair, by design. Over several
  harvest pairs these false alarms add up, so a small share of standing rice is given a harvest pair it did
  not have. The quantile of a small stable area is coarse: with 150 cells, 0.02 is about the third-lowest
  change.
- The rice mask rests on one season's HH rise and on Otsu's assumption of two groups. Another crop or
  surface with a deep low on a flood date and a strong rise by the peak would be classed as rice.
- Zoomed out, the map shows nearest-neighbour samples of the cells: some cells are skipped, none is
  averaged.

## 5. Interpretation *(the team's, written as hypotheses)*

Physical drivers we think explain what we see, which polarization shows it and why, and what would confirm
or refute it.

## 6. Comparison with an independent source *(method built; first results at the end of this section)*

Which source, for which dates, where it agrees and where it does not. The results belong here once the team
has run and read them; the method as built follows.

### Fire detections and the harvest map

The `fires` stage (`fires.py`) fetches NASA FIRMS active fire detections from VIIRS (375 m pixels, on Suomi
NPP, NOAA-20 and NOAA-21) for the site's box, and `export` publishes them as the `fires` overlay and compares
them with the `harvest-wave` map. This section describes the method as built. It makes no claim about any
site: the numbers of a run are in `work/<site>/fires/detections.json` and in `stats.json`. Which days and
periods to use is set in the site file's `fires` block (`pipeline/sites/_template.yaml`) and is the team's
choice.

1. **Fetching.** FIRMS's area API, as its page describes it
   (https://firms.modaps.eosdis.nasa.gov/api/area/, read on 14 November 2026): one CSV per source and per
   request of 1 to 5 days, for a west, south, east, north box. The stage asks for every day from `start` to
   `end` that has ended in UTC, in requests of at most 5 days, for each source in `sources` (for example
   `VIIRS_NOAA20_NRT`; NRT sources cover recent weeks, SP sources arrive months after the pass). Every answer
   is cached in `work/<site>/fires/`; a re-run asks only for what is missing, and again for a request made
   less than two days after its last day, because near-real-time detections keep arriving for some hours
   after each pass. The free map key (`FIRMS_MAP_KEY` in `.env`) is part of the request URL, so no URL that
   holds it is printed, logged or stored. Without a key the stage says how to get one and the run goes on
   without fire data. When FIRMS fails (a wrong key, the rate limit, an outage), `run` prints a warning and
   goes on: `export` then uses detections fetched before with the same settings, if any, and otherwise
   leaves the overlay and the fire bars out. The `fires` command on its own stops with the error.
2. **Detections.** From each CSV row: the UTC date and time of the pass, the satellite, the confidence (low,
   nominal or high), the fire radiative power (MW), day or night, and the source. The point is the centre
   of the 375 m pixel. A row that cannot be read stops the run. The same detection found in two sources
   (same satellite, UTC date and time, latitude and longitude, for example in an NRT and an SP source) is
   kept once, from the source listed first, and the number dropped is recorded. Detections whose centre lies
   outside the site's box are left out and counted.
3. **The overlay.** `<site>/fires.geojson`: one point per detection, coordinates rounded to 5 decimals
   (about 1 m), with the properties above. Its `date_range` is the range of days asked for, not the range
   of the points found, so the app can tell "no detection" from "not fetched".
4. **The fire bars.** For each period of the `fires` block (a first and a last UTC day), one entry in
   `stats.json`'s `bars`: detections per km² on each class of the `harvest-wave` layer (the `marker`
   polarization's classes, on the product's own grid at cell size). Only cells whose centres lie inside the
   site's box take part: detections are fetched for the box alone, and the product grid around it is a
   slightly larger rectangle.
   - A detection stands for a 375 m square (the nominal VIIRS pixel) centred on it and aligned with the
     product grid. It is shared among the classes by the area of that square on each class's 100 m cells,
     so a detection on the edge between two classes counts partly for each. The parts that lie on cells
     without a class (no data), outside the box or outside the analysis grid are not counted; the bar's
     region text gives their share of the detections.
   - The density of a class is the detections attributed to it divided by its area in km² inside the box,
     counted on the product's own grid (cells times the cell's area). A class with no cells has no density
     (null).
   - The interval comes from Garwood's chi-square formula for a 95 % Poisson interval (exact for whole
     counts), applied to the attributed count n: from chi2(0.025; 2n)/2 to chi2(0.975; 2n+2)/2 (0 at the
     low end when n is 0), using scipy's chi-square quantiles; then divided by the area. The attributed
     count is a sum of shares and is rarely a whole number. For such a count the formula is a smooth
     interpolation between the intervals of the whole counts on either side, not an exact interval, and a
     sum of shares is not itself a Poisson count. `n` in the file is the attributed count rounded to a whole
     number, for display only.
   - When a period runs past the last day fetched, the bar covers only the fetched days and its region text
     says so; a period with no fetched day has no values.
   - Each bar names NASA FIRMS in its title and ends its method text with FIRMS's acknowledgement (the
     overlay's credit), because the bars stay on screen when the overlay is off.

**Limits of this method.**

- A detection is one 375 m pixel flagged at the time of a satellite pass. It is not a fire's exact place,
  its size, or a count of burning fields. Fires that burn between passes, or under thick smoke or cloud, can
  be missed. VIIRS passes over a site a few times a day, at roughly fixed local times.
- Neighbouring detections are not independent: one fire can fill several pixels and be seen by more than one
  satellite on the same day. The Poisson interval treats them as independent, so it is a lower bound on the
  real uncertainty.
- The 375 m square is the nominal pixel. Real VIIRS pixels grow towards the edge of the swath (the CSV's
  `scan` and `track` columns give their size) and are not aligned with the product grid.
- Along the edge of the box, part of a detection's square lies outside it and is not counted, and
  detections just outside the box are not fetched at all, so cells within about 190 m of the edge receive a
  little less than their share. For a box tens of kilometres wide that is a few per cent of its area or less.
- A detection is counted on the class its square overlaps on the `harvest-wave` map, which is the state of
  the last pass of the harvest series. A field harvested after that pass is counted on "no harvest seen".
- Densities are per km² of a class, not per field and not per farmer. A 100 m cell holds several fields, and
  the harvest map has its own limits (section 4).
- The comparison is a hindcast: the radar data were recorded before the fires, but the analysis is done
  afterwards.

### Choosing the marker

The `harvest-wave` map is drawn from the harvest pairs of one polarization, the marker (`harvest.marker` in the
site file, HH or HV); both polarizations are always computed and both series are published (section 4). HH and
HV disagree about when the harvest happens, so the team asked for the choice to be made on numbers, by a rule
written down before any fire data was analysed: `PROGRESS.md`, "The marker rule", fixed on Saturday
14 November 2026 at 16:37 CT. Its items 2 to 4, in its own words:

> **The test: fire detections on standing rice.** Stubble can only burn after the crop is cut. Take every NASA
> FIRMS detection (VIIRS, 375 m) from 11 October to 14 November 2026 that falls on rice cells. For each
> polarization, compute the share of those detections, weighted by the part of each 375 m square that lies on
> rice, that sits on cells that polarization still calls "not harvested" at the last pass on or before the day
> of the detection. A marker that sees the harvest late leaves many fires on rice it calls standing.
>
> **The decision.** The marker with the smaller share wins, if the 95 % interval of the difference between the
> two shares excludes zero. The interval comes from a bootstrap over detection days (whole days are resampled,
> because detections of one day are not independent).
>
> **If the interval includes zero:** the marker that gives a harvest pass to more rice cells by 4 November wins,
> since both were held to the same false-alarm rate.

Item 1, the same strictness for both, is the threshold of section 4, step 5 (one false-alarm threshold per
polarization, set the same way). Item 5 asks for the numbers to be published whatever the outcome.

The `marker` command (`marker.py`) carries the rule out as follows. It is not part of `run`: the choice is made
deliberately, once, after the fire data is in, and the command never changes the site file.

1. **Inputs.** The harvest analysis (`work/<site>/analysis/harvest.json` and `harvest_classes.tif`) made with
   the current settings, and the fire detections (`work/<site>/fires/detections.json`) fetched with the current
   `fires` settings. Without them the command stops and names the command to run first (`analyse` or
   `fires`). Nothing is fetched.
2. **Window.** Detections whose UTC date lies from the third of the harvest `passes`, the first pass at which a
   harvest pair can end, to the `end` of the `fires` block, both days included (for the team's site, 11 October
   to 14 November 2026). Before the third pass neither polarization can have shown a harvest pair, so earlier
   detections cannot tell the two apart. The test needs every day of the window: the rule takes every detection
   in it, and the detections of a day not fetched are unknown, not absent. `fires` fetches a day only once it has
   ended in UTC, so when `detections.json` does not hold every day of the window (`fires` ran before the window's
   last day had ended in UTC, or the `fires` block starts after the window's first day), the command stops
   before computing anything, with or without `--force`, writes no result, names the days missing and says what
   to run: `fires` again once the window's last day has ended in UTC (for the team's site, from 00:00 UTC on
   15 November 2026), then `marker`. A `fires` block that ends before the third pass leaves the window without
   a day; the command then stops and says so.
3. **Rice cells of the test.** Cells whose centres lie inside the site's box and whose class is a rice class (a
   harvest pair, "no harvest seen" or "fell before") in both HH and HV. A cell without a class in either band
   carries no weight for either, so the two are scored on the same cells and the same detections.
4. **Weights.** Each detection stands for a 375 m square centred on it and aligned with the product grid, shared
   among the cells by area exactly as in the fire bars above (the same code). Its weight r is the share of the
   square on the test's rice cells. A detection with no part on them (r = 0; in the code, below 1e-9 of the
   square, about 1e-4 m², which only the rounding along the edge of a cell the square merely touches produces)
   is not used and is counted apart; a day without a detection used is not a day of the test.
5. **Not harvested.** For each polarization, s is the share of the square on the test's rice cells that the
   polarization still calls "not harvested" on the detection's UTC date: "no harvest seen", or a harvest pair
   whose later pass comes after that date. A pass on the detection's own date counts as on or before it (the
   rule's "last pass on or before the day"). Cells that "fell before" the first harvest pass are rice, so they
   count in r, but neither polarization calls them not harvested, so they never count in s.
6. **Scores.** The score of a polarization is the sum of s over the sum of r of the detections used: the mean,
   weighted by r, of the share of each detection's rice that it leaves standing. The difference is the HV score
   minus the HH score.
7. **Interval.** A bootstrap over whole UTC days: 2000 replicates, each drawing as many of the days of the
   detections used as there are, with replacement (numpy's `default_rng(20261114)`, one call
   `integers(0, days, size=days)` per replicate, the days in date order), taking every detection used of each
   day drawn as often as the day was drawn, and computing both scores again. The 95 % interval runs from the
   2.5th to the 97.5th percentile of the replicates' differences (numpy's `percentile`, linear interpolation).
   With fewer than 2 days there is no interval.
8. **Decision.** An interval wholly above zero chooses HH, since HV then leaves more fires on rice it calls
   standing; wholly below zero, HV (rule item 3). Otherwise rule item 4 decides: when the interval includes zero
   (a bound at exactly zero counts as including it), when the detections used fall on fewer than 2 days, or when
   no detection of the window lies on rice, the marker is the polarization that gives a harvest pair (not "fell
   before") to more of the test's rice cells by the last pass. Equal counts decide nothing: the choice is then
   the team's. The result says which branch applied and why.
9. **Outputs.** `work/<site>/analysis/marker.json`: the window and the days it covers, the bootstrap settings,
   the detections in the window, used and not used, the number of days, the rice weight, both scores, the
   difference, the interval, the decision with its rule item, branch and reason, the harvest-pair counts of both
   polarizations, a table by day, and the harvested share per pass of both polarizations as the analysis has
   it. Its record of inputs holds a SHA-256 of the class raster's content (its values, shape, transform, CRS and
   band names), the harvest settings without `marker`, a SHA-256 of `detections.json` and the days it holds.
   The command prints a short report and whether the site file's `marker` is the one chosen; setting it is the
   person's step, followed by `analyse` and `export`. Like every stage it is skipped when its inputs are
   unchanged, printing the result again, and made again with `--force`. The classes do not depend on `marker`,
   so running `analyse` again after changing only `marker` leaves the test valid.
10. **Published.** `export` adds one sentence to the `harvest-wave` layer's method text: both scores as
    percentages, the difference and its 95 % interval in percentage points, the detections and days used, the
    decision and the rule item that made it. Percentage points are given to one decimal; a value that is not zero
    but would read 0.0 is given to two significant digits instead, so a bound of the interval reads as zero only
    when it is zero. `export` adds the sentence only when `marker.json` was made from the class raster it
    publishes and on every day of the window; otherwise it leaves the sentence out and warns that `marker.json`
    is stale or was made on part of the window (as the command could write it before it checked the window). It
    also warns when the decision names another polarization than the site file's `marker`, and notes when
    `detections.json` changed after the test. The results belong in this section once the team has run and read
    them.

**What the test cannot do.**

- Say anything about false alarms: a harvested field need not burn, so calling standing rice harvested too
  early costs a polarization nothing here. Rule item 1 (the same false-alarm rate for both) is what holds both
  to the same strictness.
- See fires lit between satellite passes, or under thick smoke or cloud.
- Place a detection better than its 375 m pixel. The square is the nominal pixel, real pixels grow towards the
  swath edge and are not aligned with the product grid, and a 100 m cell holds several fields, so a fire can be
  weighted onto a neighbouring field.
- Use detections before the third pass: no pass can yet have shown a harvest pair, so they cannot tell the two
  apart and are left out.
- Date a harvest more finely than its pair of passes, 12 days apart: a field cut and burned between the two
  passes of its pair is still "not harvested" on the day of the fire for both polarizations, which counts the
  same against both.
- Treat neighbouring days as anything but independent: the bootstrap resamples whole days, but one burning
  season links consecutive days, so the interval may be somewhat too narrow.

### Results for `tarn-taran` (run of Saturday 14 November 2026)

The numbers come from the pipeline: `harvest.json`, `marker.json` and the published `stats.json` and
`site.json` of the run of 20:28 to 20:29 CT; the `harvest-wave` layer's method text carries the marker test's
numbers. **Every reading of them below is AI-written.**

#### Which polarization draws the map: HV, by rule item 4

- The window, UTC dates from 2026-10-11 to 2026-11-14, was fetched in full (`detections.json` holds
  2026-09-15 to 2026-11-14). The detections were fetched once more just before the test, after 14 November
  had ended in UTC, and did not change (452 in the box). The test was run once.
- 424 VIIRS detections fall in the window; 417 have a part on the test's 45,928 rice cells (together 270.2
  squares of 375 m on rice), on 31 UTC days; 7 have no part on rice and are not used.
- The share of that weight on rice that each polarization still called not harvested on the detection's date:
  **HH 68.4 %, HV 72.2 %**. HV minus HH: +3.8 percentage points, **95 % interval -5.7 to +10.9** (2000
  bootstrap replicates over days, seed 20261114).
- The interval includes zero, so the fire detections cannot tell HH from HV, and rule item 3 does not decide.
  Rule item 4 does: HV gives a harvest pair to more of the test's rice cells by 4 November (31,192 against
  20,503 for HH). **The marker is HV.**
- The harvested share per pass that the rule asks to publish (rice cells with a harvest pair by each pass, of
  45,928): HH 9.9 % by 11 October, 22.7 % by 23 October, 44.6 % by 4 November; HV 6.3 %, 9.2 % and 67.9 %.
- Reading: both polarizations leave about seven in ten fire detections on rice (by weight) on cells they
  still call not harvested. Stubble burns only after the cut, so both maps see much of the harvest late or not
  at all. The official figures below say the same.

#### Fire density by harvest class: the concept's Hypothesis 2

The hypothesis (`docs/CONCEPT.md`): from 5 to 14 November, fires are densest where the 4 November map shows
harvest since 23 October, less dense where the harvest came before 11 October, and least dense where rice was
still standing; the test is repeated for the two earlier windows; it is wrong if the densities do not differ
by more than their uncertainty. VIIRS detections per km² on each class of the HV map, with their 95 % intervals
(a lower bound on the real uncertainty, as said above), from the published `stats.json`:

| Class of the HV map | 12 to 23 Oct (99 detections) | 24 Oct to 4 Nov (235) | 5 to 14 Nov (90) |
|---|---|---|---|
| Harvested 29 Sep to 11 Oct | 0.27 (0.11 to 0.53) | 0.28 (0.12 to 0.55) | 0.12 (0.03 to 0.33) |
| Harvested 11 to 23 Oct | 0.25 (0.06 to 0.69) | 0.53 (0.22 to 1.09) | 0.10 (0.01 to 0.45) |
| Harvested 23 Oct to 4 Nov | 0.10 (0.07 to 0.15) | 0.35 (0.28 to 0.43) | 0.12 (0.08 to 0.17) |
| Rice, no harvest seen by 4 Nov | 0.12 (0.07 to 0.20) | 0.31 (0.23 to 0.42) | 0.14 (0.09 to 0.22) |
| Fell before 29 Sep | 0.14 (0.01 to 0.65) | 0.28 (0.05 to 0.88) | 0.08 (0.00 to 0.55) |
| Not rice | 0.11 (0.08 to 0.15) | 0.21 (0.17 to 0.27) | 0.09 (0.06 to 0.13) |

- **5 to 14 November: Hypothesis 2 is not supported.** The three rice classes it names (0.12, 0.12 and 0.14 per
  km²) do not differ by more than their uncertainty, and they are not in the predicted order. By the concept's
  own test the hypothesis is wrong for this map at this scale.
- The two earlier windows do not show the predicted order either. From 12 to 23 October the cells harvested by
  11 October have the highest density (0.27), as "the fires follow the harvest" would expect, but its interval
  overlaps the others'.
- One difference is larger than its uncertainty: from 24 October to 4 November, the peak of the burning, rice
  harvested between 23 October and 4 November has 0.35 detections per km² (0.28 to 0.43) and ground that is not
  rice 0.21 (0.17 to 0.27). Reading: at the peak, fires sit on rice more than on other ground, as stubble
  burning would, but the map's harvest dates do not sort them.
- Reading, not tested: "no harvest seen" is not standing rice (next part), so fires on it do not argue
  against a harvest. With much of the harvest missed or dated late, the classes cannot separate as the
  hypothesis expects.

#### Official harvest figures: where they disagree

Reported harvest progress, from press reports of official figures, each opened at its source on 14 November
2026 (links in `docs/SOURCES.md`), set against the share of the box's rice cells with a harvest pair. Areas
are given as the reports give them, in lakh hectares (lakh ha): one lakh is 100,000, so 32.87 lakh ha is
3,287,000 hectares.

| By | Reported | Radar, HH | Radar, HV |
|---|---|---|---|
| 11 October | no figure found | 9.9 % | 6.3 % |
| 23 October | Punjab: 34.82 % of 34.506 lakh ha, "harvested till October 23"; Tarn Taran district 73 % and Amritsar 83 %, in the same report without a date of their own (PTI, 24 October) | 22.7 % | 9.2 % |
| 4 November | Punjab: 85.10 % of 32.87 lakh ha, from the Punjab Pollution Control Board's report as of 4 November (ANI, 5 November) | 44.6 % | 67.9 % |

A further report: more than 90 % of the paddy area of Tarn Taran and Amritsar together was harvested (PTI,
2 November, without a date of its own).

- **Where they agree:** the harvest moves on across the passes in all three series.
- **Where they disagree:** both radar maps call far less rice harvested than the official figures: by
  23 October 9 to 23 % of the rice cells, against 73 % for the district; by 4 November 45 to 68 %, against 85 %
  for the state and more than 90 % for Tarn Taran and Amritsar. **A cell with "no harvest seen" is therefore not
  necessarily a standing field, and the map cannot say how much rice still stood on 4 November.** The fire test above points
  the same way.
- Possible reasons, hypotheses. The optical cross-check below now measures how much of "no harvest seen"
  an optical index calls cut; the reasons themselves remain untested: the threshold is strict by design (at most 2 %
  of unchanging ground may cross it, so a fall of less than 3.52 dB in HH or 1.59 dB in HV between two passes is
  not counted, and the go/no-go exploration in `PROGRESS.md` found a cell's fall often spread over several
  passes); a 100 m cell holds several fields and crosses only when most of it falls at once; straw left lying
  after a combine may keep part of the backscatter until it is baled, burned or ploughed in; the box is not the
  district (it holds part of Ferozepur district and the edge of the Harike wetland), while the figures cover a
  district or the state; and the official figures come from field reports, with the state's paddy area itself
  given as 32.76, 32.87 or 34.51 lakh ha by different sources.
- Not done: the concept's check of the rice mask against the district's official rice area. No official 2025 or
  2026 figure for the district was found.

#### Optical cross-check: what Sentinel-2 says about the same cells

An optical satellite sees a cut field as a loss of green, so the vegetation index NDVI was measured on the same
100 m cells to find how much of the radar's "no harvest seen" has lost its green. The method was fixed in
`docs/OPTICAL_CHECK_BRIEF.md` (written at 20:45 CT on Saturday 14 November), and its ambiguous points were settled
in `research/optical_check/README.md`, before any optical value for the site was read: that is the team's record
of the order, not a proof of it. A workflow of AI agents built, reviewed and ran it (`AI_USE.md`). The data are
Copernicus Sentinel-2 Level-2A surface reflectance (ESA): red (B04) and near-infrared (B08) at 10 m and the scene
classification at 20 m, of tile 43RDQ, read from the Earth Search catalog by Element 84 (`docs/SOURCES.md`), only
within the product grid. The catalog listed 38 scenes over the box from 10 September to 14 November; the 19 on
tile 43REQ were left out, which leaves 19 on 16 dates from 13 September to 12 November (on 25 September,
15 October and 4 November two datastrips of one datatake were joined). A cell has a value on a date when at least
50 of its 100 Sentinel-2 pixels are valid (both bands hold data, and the scene classification does not mark the
pixel as cloud, cloud shadow, cirrus, snow or defective); its NDVI is computed from its mean near-infrared and red
reflectance. A date is usable when at least 80 % of the test's 45,928 rice cells (a rice class in both HH and HV,
as in the marker test) have a value. Eleven dates are usable: 13, 18 and 23 September; 3, 8, 18, 23 and
28 October; 2, 4 and 7 November. Five are not, with 70.6 % (25 September), 39.1 % (28 September), 65.9 %
(13 October), 8.6 % (15 October) and 20.3 % (12 November) of the rice cells with a value: on each, the scene
classification marks much of the window as cloud, cirrus or cloud shadow. The catalog has no scene of the tile
from 10 to 12 September or after 12 November. The analysis ran once, from 23:01 to 23:03 CT on Saturday
14 November (05:01 to 05:03 UTC on 15 November). Every number below is in `research/optical_check/results.json`;
the full tables, for every usable date and both polarizations, are in `research/optical_check/RESULTS.md`, and
its figure `ndvi_by_class.png` draws the HV classes over time.

**The result that needs no threshold: median NDVI by class of the HV map.** On 3 October, before the first pass
on which a harvest pair can end (11 October), the medians of HV classes 1 to 4 are 0.52, 0.63, 0.66 and 0.71; on
the clear 18 October they are 0.24, 0.30, 0.41 and 0.51. On both dates the medians rise from class 1 to class 4:
the later the radar dated a cell's harvest, the greener the cell still was, and "no harvest seen" (class 4) was
the greenest; it loses its green later, but it does not stay green. In HH, classes 3 and 4 are not apart on
3 October (0.70 and 0.68). On the last usable date, the clear 7 November, the medians of HV classes 1 to 4 are
0.17, 0.15, 0.18 and 0.23 (HH class 4: 0.22), the stable target's box in Patti town is at 0.23 (0.25 on
3 October), and the cells that are not rice are at 0.27: by then class 4 is as little green as the town. Ripe
rice still standing is not green either, so this alone does not show that class 4 was cut.

**Cut or not, with two thresholds fixed in advance.** A cell is "cut by day D" when its NDVI is below the
threshold on some usable date from 29 September to D, after being at or above it on an earlier usable date;
cells never at or above it are "never green" and counted apart (at most 0.5 % of the rice cells in the table
below).

- `T_pooled` = 0.4650 is Otsu's threshold on the NDVI of the test's rice cells pooled over the usable dates from
  15 September on (442,369 values on 10 dates): it separates green from not green, and since ripening rice loses
  green before it is cut, it calls some standing, ripe rice "cut".
- `T_strict` = 0.1945 is the 75 % quantile of the NDVI of the 3,193 cells that both HH and HV call harvested by
  23 October, pooled over the usable dates from 24 October to 4 November (9,505 values on 28 October, 2 November
  and 4 November): three quarters of the values of these confidently cut cells lie at or below it, so it asks a
  cell to fall about as low as they did; one of its three dates, 2 November, is hazy (below).

Share of the test's 45,928 rice cells the index calls cut by the usable date on or before and on or after each
pass (the same date when the pass date is itself usable), beside the share of rice cells with a harvest pair by
the pass and the official figures quoted above:

| Radar pass | Optical day | `T_pooled`: cut | `T_strict`: cut | Radar, HH | Radar, HV | Reported |
|---|---|---|---|---|---|---|
| 11 October | 8 October (on or before; hazy) | 56.2 % | 0.7 % | 9.9 % | 6.3 % | no figure found |
| 11 October | 18 October (on or after) | 70.5 % | 4.5 % | 9.9 % | 6.3 % | no figure found |
| 23 October | 23 October (both; hazy) | 98.8 % | 28.3 % | 22.7 % | 9.2 % | Punjab 34.82 % till 23 October; Tarn Taran district 73 %, Amritsar 83 % (undated, same report) |
| 4 November | 4 November (both) | 99.6 % | 88.9 % | 44.6 % | 67.9 % | Punjab 85.10 % as of 4 November; more than 90 % of Tarn Taran and Amritsar together (PTI, 2 November, undated) |

Of the cells each polarization calls "no harvest seen by 4 November", the share the index calls cut by 4 November
(the usable date on or before and on or after that pass is 4 November itself) and by 7 November, the last usable
date, with the cells in brackets:

| "No harvest seen by 4 November" | `T_pooled`: cut by 4 November | `T_pooled`: cut by 7 November | `T_strict`: cut by 4 November | `T_strict`: cut by 7 November |
|---|---|---|---|---|
| HH, 25,136 cells | 99.4 % (24,997) | 99.4 % (24,997) | 83.7 % (21,045) | 84.1 % (21,133) |
| HV, 13,818 cells | 99.4 % (13,735) | 99.4 % (13,735) | 78.9 % (10,905) | 79.3 % (10,960) |

The rest are not cut (by 4 November HH 0.1 % and HV 0.2 % under `T_pooled`, HH 16.2 % and HV 21.0 % under
`T_strict`) or never green (0.4 % under `T_pooled`, 0.1 % under `T_strict`, in both).

**Agreement at 4 November** (cells where the radar map and the index both say harvested or both say not; cells
that fell before 29 September and never-green cells left out; 95 % interval from a block bootstrap, blocks of 10
by 10 cells, 2000 replicates, seed 20261115): under `T_strict` HV 71.6 % (70.5 % to 72.6 %, 44,996 cells) and HH
51.8 % (50.7 % to 52.9 %, 45,625 cells); under `T_pooled` HV 69.4 % (68.1 % to 70.7 %, 44,898 cells) and HH 45.1 %
(43.8 % to 46.2 %, 45,508 cells). Of the cells called cut by each day, the share at or above the threshold again
on the next usable date ("back to green") is 14.1 % to 18.6 % under `T_pooled` and 8.0 % to 64.9 % under
`T_strict` (64.9 % of the cells cut by 23 October, 46.2 % of those cut by 4 November).

**What was odd, and what was done about it.**

- **Three usable dates look hazy: 8 October, 23 October and 2 November.** On each, the scene classification puts
  no pixel of the window in its vegetation class, so the guard that checks the reflectance offset recorded them
  as "not checked", and the cells that are not rice, class 5 and the town box dip on each of them and recover on
  the next clear date. Haze, smoke or thin cloud that the classification did not flag is a hypothesis; the
  scenes' aerosol band was not read. The method keeps these dates, as fixed: they pass the 80 % rule and it has
  no haze test. Many cut days fall on them: of the 45,744 rice cells `T_pooled` calls cut by 7 November, 22,563
  were cut on 8 October; of the 40,958 that `T_strict` calls cut by 7 November, 26,811 were cut on 2 November.
- ***Exploratory, added after seeing the data*** (`exploratory_unit_check.py`, `exploratory_results.json`; not a
  result of the method). On the three hazy dates the darkest pixels are 600 to 1,200 values brighter than on the
  clear dates around them. A reflectance offset left in the values would add 1,000 to every value of both bands;
  instead the cell means differ from the clear neighbouring dates by +286 to +639 in red and -160 to +413 in
  near-infrared (medians, in the files' digital numbers), unevenly across the window, so a unit error is
  unlikely. The method's steps, unchanged (the thresholds set again by the same rules), without the dates the
  offset guard could not check (25 September, 8 October, 23 October, 2 November and 12 November; the first and
  the last were not usable anyway), give `T_pooled` 0.480 and `T_strict` 0.2111. Of the "no harvest seen" cells
  the index then calls cut by 4 November 97.8 % (HH) and 97.1 % (HV) under `T_pooled`, and 57.4 % (HH) and
  48.5 % (HV) under `T_strict` (65.0 % and 56.0 % by 7 November); of all the test's rice cells, 98.6 %
  (`T_pooled`) and 69.4 % (`T_strict`) by 4 November. These numbers show how much the hazy dates weigh; they do
  not replace the result above.
- **The five dates that are not usable** (above) are left out, as the rule says; "cut by day D" is therefore
  measured only on the dates that happen to be usable.
- **4 November** is joined from two datastrips of one datatake that together leave 749,741 of the window's
  8,236,800 pixels (9.1 %) without data; 90.3 % of the rice cells still have a value, so the date is usable.

**What this cannot do** (the brief's step 10). An optical index sees green, not stems: ripening, weeds, a second
crop and smoke haze all move it. A 100 m cell holds several fields. Cloud and smoke leave gaps, so "cut by day D"
depends on which dates happen to be usable. Sentinel-2 passes at about 11:00 local time and NISAR at 05:43, days
apart. The comparison is made after the fact, like the fire check. The marker decision (HV) is not reopened by
it: it was made by a rule fixed beforehand, and the numbers are reported for HH and HV without recommending a
change.

**Reading. AI-written; each sentence is a hypothesis, and none reopens the
marker decision or recommends a change of it.**

- Much of "no harvest seen" may be rice that had lost its green by 4 November without the radar giving it a
  harvest pair: `T_strict` calls 83.7 % (HH) and 78.9 % (HV) of it cut, the exploratory look without the hazy
  dates about half (57.4 % and 48.5 %), and `T_pooled`'s 99.4 % is likely an upper bound, since it also counts
  ripening; the share may lie anywhere from about half to four fifths, and greenness alone cannot tell a cut
  field from a ripe one, which field reports or more clear dates would have to settle.
- The radar's classes may be in the right order even where its dates come late: HV's classes are ordered by
  greenness as the radar dated them before the first harvest pair could end (0.52 to 0.71 on 3 October), so
  "no harvest seen" may be mostly rice that ripened and was cut last rather than rice the radar cannot see at
  all; in HH, classes 3 and 4 are not apart, so HH's order may be less clear.
- HV may match the optical state at 4 November better than HH (71.6 % against 51.8 % under `T_strict`, 69.4 %
  against 45.1 % under `T_pooled`), but with the index calling most rice cells cut by then, the agreement may
  mostly follow the share each map calls harvested (HV 67.9 %, HH 44.6 %).
- HH's "no harvest seen" class is larger than HV's (25,136 cells against 13,818) and the index calls more of it
  cut (83.7 % against 78.9 % under `T_strict`), which may mean that HH misses more of the harvest by 4 November.

## 7. Limitations

Known before the analysis:

- The public record is short and uneven: worldwide coverage begins 2026-06-17; there is a gap from
  2026-07-27 to 2026-08-10; releases differ in calibration.
- Provisional products can be defocused or misplaced in 1 to 2 % of cases; every date must be looked at.
- Values in the 8-bit files are quantised to 0.157 dB (for a -35 to +5 dB range) and clipped outside it.
  Bright point targets exceed +5 dB (on the retired sample site 0.1 % of pixels, up to 17 dB before
  clipping); the app shows such values as "or more". Statistics are not affected: they are computed before encoding.
- Zoomed-out views average encoded decibel values and read slightly low; numbers are never taken from them.

*(Add the site-specific limitations here.)*
