# Optical cross-check of the harvest map

What Sentinel-2's NDVI says about the 100 m cells of each radar harvest class, from the brief
`docs/OPTICAL_CHECK_BRIEF.md`. **Status: built, tested and reviewed; run once on every scene on 15 November 2026,
05:01 to 05:03 UTC, with no change to the method (`results.json`, `RESULTS.md`, `ndvi_by_class.png`). Three usable
dates look hazy; the look at them is exploratory, added after seeing the data (`exploratory_unit_check.py`,
`exploratory_results.json`).** The code and this file are AI-written (Claude Opus 5.5, Anthropic).

The method below was fixed in the brief before any optical value for this site was read. It is stated here as
the code applies it, with every reading taken where the brief is ambiguous. Both were committed before the run, so
that no definition can be shaped by a result. A change after the run is listed in `REPORT.md` under "Changed after
the first real run" (bug fixes only), and any other look at the data goes under "Exploratory, added after seeing
the data".

## How to run

From the repository root, with the pipeline's virtual environment (no new dependency):

```
python research/optical_check/optical_check.py probe   # access probe: catalog, one scene, no NDVI
python research/optical_check/optical_check.py run     # every scene; writes results.json, RESULTS.md,
                                                       # ndvi_by_class.png in this folder
python -m pytest research/optical_check                # the tests (SYNTHETIC arrays only)
```

(On the build PC: `.venv\Scripts\python.exe` in place of `python`.)

- `run` queries the catalog again (its time is recorded) and saves it to `work/optical/catalog.json`;
  `run --saved-catalog` reuses that file instead.
- Each date's cell sums (valid-pixel count and sums of the red and NIR values per cell) are cached in
  `work/optical/scenes/<granule ids>.npz`, so a second run reads no imagery again. The cache is keyed to the
  granules, the grid and `READER_VERSION`; raise that constant (or delete the folder) after a change to the
  reading or the sums. The reflectance conversion is applied after the cache, so a fix to it needs no new read.
- `run` prints one line per date: the granules, read or cached, seconds and megabytes, the share of rice cells
  with a value, usable or not, and the offset check. Two guards stop it (they change no definition): a date whose
  granules are not datastrips of one datatake ("Readings", 1), and a scene taken as offset-free whose vegetation
  pixels still look offset ("Readings", 2).
- A re-run rewrites `RESULTS.md` but keeps the text between its `reading:start` and `reading:end` markers.
- Network: only `https://earth-search.aws.element84.com/v1` (the box and the dates, nothing else) and the
  `https://sentinel-cogs.s3.us-west-2.amazonaws.com` files its items point to, read through GDAL's `/vsicurl/`,
  only the window of the product grid. No credentials.

## The method (the brief's steps 1 to 10, as applied)

1. **Inputs** (`inputs/`, copies from the pipeline run of Saturday 20:29 at commit `5f73b8d`):
   `harvest_classes.tif`, the class of every 100 m cell on the product grid (EPSG:32643, 286 columns by 288 rows,
   upper left x 479010, y 3467310; band 1 HH, band 2 HV; 1, 2, 3 = harvest pair ending on the pass of
   2026-10-11, 2026-10-23, 2026-11-04; 4 = rice, no harvest seen by 2026-11-04; 5 = fell before 2026-09-29;
   6 = not rice; 0 = no data); `harvest.json` and `marker.json`. The site box and the stable target (Patti town)
   come from `pipeline/sites/tarn-taran.yaml` through `pipeline.config.load_site`. `read_inputs` checks that the
   raster's grid, bands and passes are harvest.json's, that the stable box is the one harvest.json used, that it
   holds the same 156 cell centres, and that harvest.json's rice-cell and harvest-pair counts match the raster.
2. **Optical data:** Sentinel-2 Level-2A surface reflectance, collection `sentinel-2-l2a` of the Earth Search
   catalog, assets `red` (B04, 10 m), `nir` (B08, 10 m) and `scl` (20 m), every scene from 2026-09-10 to
   2026-11-14, tile 43RDQ only (one tile per date), only the window of the product grid, true reflectance.
3. **Valid pixels** (`valid_pixels`): both bands hold data (value not 0) and the SCL class is 2, 4, 5, 6 or 7
   (dark area, vegetation, not vegetated, water, unclassified). 0, 1, 3, 8, 9, 10, 11 are dropped. Dark-area
   pixels stay in on purpose (a burned field is dark). A 20 m SCL pixel covers the 2 by 2 pixels of 10 m under
   it (`coarse_window`, `to_fine`).
4. **Cells** (`grid_window`, `cell_sums`, `cell_means`, `ndvi`): a cell is exactly 10 by 10 Sentinel-2 pixels;
   `grid_window` asserts that both grids are north up, that their corners sit on multiples of 10 m, that pixels
   are 10 m and cells 100 m, and that the product grid lies wholly inside the tile. A cell has a value on a date
   when at least 50 of its 100 pixels are valid. NDVI = (N - R) / (N + R), N and R the means of the NIR and red
   reflectance over the valid pixels: the ratio of the means.
5. **Usable dates** (`value_share`, `usable`): a date is usable when at least 80 % of the test's rice cells have
   a value. Every date is listed with its share, usable or not.
6. **The test's rice cells** (`rice_cells`): a rice class (1 to 5) in both bands, as in the marker test
   (45,928 cells).
7. **Primary result, no threshold** (`class_groups`, `summary`): for each usable date, the median, quartiles and
   number of cells of NDVI for classes 1, 2, 3, 4 and 5 of the HV map and of the HH map, for the cells that are
   not rice, and for the cells of the stable target's box. One table per polarization; one figure drawn by code
   from `results.json` (HV classes as lines over time, the radar passes marked).
8. **Secondary result, two thresholds fixed in advance:**
   - `T_pooled` (`pooled_threshold`): Otsu's threshold, `pipeline.harvest.otsu_threshold` with 240 bins from -0.2
     to 1.0, on the NDVI of the test's rice cells pooled over all usable dates from 2026-09-15 on. It separates
     green from not green. Caveat stated with the results: ripening rice loses green before it is cut, so this
     threshold calls some standing, ripe rice "cut".
   - `T_strict` (`strict_cells`, `strict_threshold`): the 0.75 quantile (numpy, `inverted_cdf`) of the NDVI of
     the cells with harvest pair 1 or 2 in both HH and HV, pooled over the usable dates from 2026-10-24 to
     2026-11-04. No usable date in that span: no strict result, said so.
   - "Cut by day D" (`first_cut`, `cut_by`): NDVI below the threshold on some usable date from 2026-09-29 to D,
     having been at or above it on an earlier usable date from 2026-09-10 on. Cells never at or above it are
     "never green" (`never_green_by`) and counted apart. Later dates are not looked at.
   - For each radar pass P (2026-10-11, 2026-10-23, 2026-11-04), the last usable date on or before P and the
     first usable date on or after P (`days_around`), named in the results.
9. **Tables** (`analyse`), for each threshold and both days of each pass:
   - the share of the test's rice cells cut by that day, beside the radar's share with a harvest pair by P (HH
     and HV, from `harvest.json`) and the official figures quoted in `docs/METHODS.md`;
   - of the cells each polarization calls "no harvest seen by 4 November": the share cut by the days around
     4 November and by the last usable date of the series (the number the team needs);
   - of the cells each polarization gives a harvest pair ending on P: the share cut by the day on or after P, and
     the share still not cut then;
   - agreement of each polarization with the optical state at each pass, with a 95 % interval from a block
     bootstrap (`block_ids`, `block_bootstrap`, `interval`): blocks of 10 by 10 cells, 2000 replicates,
     `numpy.random.default_rng(20261115)`, the 2.5th and 97.5th percentiles;
   - how often a cut cell is at or above the threshold again on the next usable date (`back_to_green`).
10. **What this cannot do**, said with the results (`LIMITS`, printed in `RESULTS.md`): an optical index sees green,
    not stems (ripening, weeds, a second crop and smoke haze all move it); a 100 m cell holds several fields;
    cloud and smoke leave gaps, so "cut by day D" depends on which dates are usable; Sentinel-2 passes at about
    11:00 local time and NISAR at 05:43, days apart; the comparison is made afterwards. The marker decision (HV)
    is not reopened: the numbers are reported for HH and HV without recommending a change.

The HLS 2.0 repeat (the brief's optional second table) is not built: it may start only after the Sentinel-2 run.

## Readings taken where the brief is ambiguous

Fixed here before the run; each is the most literal reading that could be found.

1. **One tile per date, split granules.** On 2026-09-25, 2026-10-15 and 2026-11-04 tile 43RDQ comes as two
   granules from the same datatake (Sentinel-2A, two datastrips; about 20 % and 60 % of the tile without data;
   their catalog footprints each cover part of the box). "One tile per date" is read as one tile, 43RDQ, with all
   its granules of that date: they are mosaicked (`mosaic`), each pixel from the first granule that holds data in
   both bands there, its SCL from the same granule; granules in order of fewest nodata pixels
   (`s2:nodata_pixel_percentage`), then id. No pixel is chosen for being clear. Tile 43REQ is never used. The
   pixels each granule gave are recorded per date. The reading is checked on every date before any read
   (`split_granules`): the granules must share `s2:datatake_id` and have distinct `s2:datastrip_id` values with
   distinct sensing starts, or the run stops. A reprocessed copy of a granule (Earth Search reissues items: 10-08
   and 10-28 exist only as sequence 1) would have a new datastrip id but the same sensing start, so it is not
   mosaicked silently. The saved catalog passes on all 16 dates; each date's datatake and datastrips go into
   `results.json`.
2. **Reflectance offset.** Every item has `earthsearch:boa_offset_applied: true` (processing baselines 05.12 and
   05.13), while the assets' `raster:bands` also list `scale 0.0001, offset -0.1` and the files carry no GDAL
   scale or offset. The probe's values show the offset already removed (below): reflectance = DN x 0.0001, and
   the -0.1 is not applied, which would remove the offset a second time. Where the property is false on a
   baseline from 04.00 on, -0.1 is applied; older baselines have no offset; a newer baseline without the
   property stops the run (`reflectance_params`). The scene's own `product_metadata` could not be checked: its
   link is `s3://` in a requester-pays bucket, outside the public https files. Every scene is checked against its
   values (`offset_check`, a guard, not a definition): vegetation (SCL 4) reflects little red, so with the offset
   removed many of its red values lie below 1000, and with it still in none can. A scene taken as offset-free
   with under 1 % of its vegetation pixels below 1000 stops the run. With fewer than 1000 vegetation pixels (a
   cloudy date) it is recorded as not checked. Vegetation alone is used because clouds, haze and bare ground have
   high red either way, so a share over all pixels could stop a correct run on a cloudy date. `results.json`
   keeps, per scene, the flag, the `raster:bands` offset, the share over all pixels (as in the probe), the
   vegetation share and the check's finding.
3. **Dates.** A scene's date is the UTC date of its `datetime` (about 05:50 UTC, the same date in India). The
   dates are those of the 43RDQ scenes from 2026-09-10 to 2026-11-14; the catalog has none from 09-10 to 09-12.
4. **"Has a value"** is the 50-pixel rule alone (step 5's share uses it). A cell with a value but N + R not
   positive would have no defined NDVI; it is left out of the NDVI-based steps and counted per date
   (`cells_with_value_but_no_ndvi`).
5. **Quartiles** use numpy's default percentile method (linear): the brief names a method only for `T_strict`.
6. **Groups of step 7.** "Class k of the HV map" is every cell with value k in band 2 (all of them are test rice
   cells: the rice mask is shared by the bands); "not rice" is value 6 of that band; "the cells of the stable
   target's box" are all cells whose centres lie in the box (156, `pipeline.harvest.cells_in_boxes`, as
   harvest.json's `cells_in_boxes`), including the 2 rice cells there (harvest.json's "stable cells", 154, leave
   them out).
7. **Pooling.** `T_pooled` and `T_strict` pool every finite cell value of every date in their span (one value
   per cell and date). A value outside -0.2 to 1.0 goes to an end bin of Otsu's histogram, as
   `otsu_threshold` does.
8. **Cut, not cut, never green.** Shares are of all cells of the group: cut + not cut + never green = all. "Never
   green by D" includes cells with no value on any usable date up to D (counted separately as
   `no_value_at_all`). "Not cut" and "still not cut" mean: at or above the threshold on some usable date, and
   not cut since. A cell without a value on a date simply does not count on that date.
9. **Days around a pass.** When P is itself a usable date, both days are P. Tables give both rows even then.
10. **Agreement.** Radar "harvested by P": a harvest pair ending on or before P (classes 1 to k for the k-th
    pass); "not harvested": a later pair or no harvest seen. Class 5 (fell before 29 September) gets no harvest
    pair from the radar and is left out, as are the never-green cells (counted apart): the optical series makes
    no call on them. Optical "harvested": cut by the day; "not": not cut. Agreement = cells where both say
    harvested or both say not, over the cells where both make a call.
11. **Bootstrap.** Blocks of 10 by 10 cells counted from the grid's upper left corner (the last row of blocks is
    8 cells tall, the last column 6 wide). The units are the blocks with at least one used cell; each replicate
    draws as many of them as there are, with replacement (one call `integers(0, n, size=n)`), and counts every
    used cell of a block as often as the block was drawn. A fresh `default_rng(20261115)` is made for each
    interval, so each is reproducible alone. Percentiles: numpy's default (linear), as in the marker test.
12. **Back to green.** For each threshold and each day of each pass: of the cells cut by that day, those at or
    above the threshold on the usable date following their own cut day (which may come after the day); cells
    without a value on that date, or cut on the last usable date, are counted apart.
13. **Radar shares by P** are harvest.json's `cumulative.by_pass` (harvest pairs only, not "fell before");
    `read_inputs` checks them against the class raster.
14. **Official figures** are quoted as text from `docs/METHODS.md`, section 6 (none for 11 October).
15. **Figure.** The HV classes 1 to 5 as median lines over the usable dates, in the map's class colours
    (`pipeline.harvest`); not rice and the stable box as grey reference lines; all five passes of the radar
    analysis (09-17 to 11-04) marked; dates that are not usable as ticks on the axis; NDVI axis from -0.2 to 1.0
    (the brief's Otsu range).

## The access probe (Saturday 14 November 2026, 22:09 and 22:16 CT, one scene)

`probe` lists the catalog and reads the window of one scene; it computes no NDVI, no share and looks at no radar
class. Its full record is `work/optical/probe.json` (not committed).

- **Catalog:** 38 items over the box from 2026-09-10 to 2026-11-14, as the brief says: 19 on tile 43RDQ on 16
  dates (09-13, 09-18, 09-23, 09-25, 09-28, 10-03, 10-08, 10-13, 10-15, 10-18, 10-23, 10-28, 11-02, 11-04,
  11-07, 11-12) and 19 on 43REQ, left out. The split dates are 09-25, 10-15 and 11-04 (Sentinel-2A).
- **Scene:** `S2C_43RDQ_20260913_0_L2A` (the first date), processing baseline 05.12.
- **Tile and grid:** red and nir 10980 x 10980 pixels on (10, 0, 399960, 0, -10, 3500040) in EPSG:32643, blocks of
  1024; SCL 5490 x 5490 on the same corner with 20 m pixels, blocks of 512. The product grid lies at row 3273,
  column 7905 of the tile, 2880 x 2860 pixels, wholly inside it; both corners are on multiples of 10 m. It starts
  in the middle of a 20 m SCL pixel: the SCL window is 1441 x 1431 pixels from row 1636, column 3952, cut one
  10 m pixel in from its top and left after repeating each SCL pixel over 2 x 2.
- **Offset:** the values are free of it. Red median 402 and 1st percentile 83 over a scene that is 78 % vegetation
  pixels; 82.8 % of the red values below 1000 (with the offset still in, each would be a negative reflectance);
  water (SCL 6) NIR median 604, which would be -0.04 after a second -0.1. So reflectance = DN x 0.0001.
- **SCL codes seen** in the window: 3 (6.7 %), 4 (77.9 %), 5 (6.0 %), 6 (1.5 %), 7 (0.6 %), 8 (4.5 %),
  9 (2.8 %); none of 0, 1, 2, 10, 11. 54 of 8,236,800 pixels have no data in a band.
- **Values:** red 1 to 16,777, NIR 1 to 16,210 where both hold data.
- **Time and size per scene:** 5.5 s and 9.0 s on the two reads (red and NIR about 2.5 to 4.5 s each, SCL 0.3 s);
  44.4 MB of compressed image blocks touched (red 20.9, NIR 23.3, SCL 0.26). The full run reads 19 granules: about
  850 MB, a few minutes.

## Tests

`test_optical_check.py`, 35 tests on SYNTHETIC arrays, among them the ones the brief lists: a 10 by 10 block maps
to its cell and to no other; the ratio of means, not the mean of ratios; a masked class is left out; "cut by day"
needs an earlier green date; the day on or before and on or after a pass; the bootstrap repeats with its seed.
Two tests run steps 5 to 9 on a small synthetic site, one writing the three outputs and one with no usable date
after the last pass, so the real run cannot fail on their form. A third checks every number of steps 5 to 9
against a 13-cell site worked out by hand: the usable shares, the step 7 groups, both thresholds and the cells
they pool, and tables (a) to (e) under both thresholds. One test drives `run()` with synthetic stand-ins for the
inputs, catalog and scenes. Each test was checked to fail by breaking its function once (29 breaks at the build,
all caught but one that cannot change a result: marking a cell green before the same date's cut test, while one
value cannot be both at or above and below the threshold).

**Independent review, before the run.** A reviewer found 28 breaks that the 24 tests of the build missed: nothing
checked the numbers of the step 9 tables, which cells T_strict pools, the NIR mask, the usable share over rice
cells only, T_pooled's bins, a value equal to a threshold, the bootstrap's units, later replicates and
percentiles, the SCL window's rows against its columns, a pixel with red but no NIR in the mosaic, or the order
and dates of the granules. Each now has a test, and all 28 breaks fail it. The review also found three faults in
the code, now fixed, each with a test that fails on the code before the fix: `results.json` described the
reflectance conversion as coming from `raster:bands` (it does not); the offset check only printed a warning and its
evidence was left out of `results.json` (now a guard that stops the run, its evidence kept per scene); and nothing
checked that a date's several granules are datastrips of one datatake (now `split_granules`). No definition,
threshold rule or date rule was changed. No NDVI was computed for the review or the fixes.

## Files

- `optical_check.py`: the script (pure functions of steps 3 to 9, then the catalog, reads, cache and report).
- `test_optical_check.py`: the tests.
- `inputs/`: the radar analysis's outputs it compares with.
- After the run: `results.json` (every number, the scenes and their ids, the thresholds, the settings),
  `RESULTS.md` (the tables, the dates, then at most ten lines of reading as hypotheses, marked as AI-written),
  `ndvi_by_class.png` (drawn by code from `results.json`), `REPORT.md` (what the brief wants in a pull
  request's description).
- Exploratory, added after seeing the data: `exploratory_unit_check.py` and its output `exploratory_results.json`
  (dark targets and the change of the cell means on the dates the offset guard could not check, and steps 5 to 9
  without those dates). Not a result of the method; it changes no number of `results.json`.

Contains modified Copernicus Sentinel data 2026. Catalog: Earth Search by Element 84.
