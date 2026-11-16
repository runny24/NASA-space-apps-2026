# Optical cross-check of the harvest map: report

What the brief (`docs/OPTICAL_CHECK_BRIEF.md`, "What to deliver") asks for in the pull request's description, kept here on branch `optical-check`. **AI-written.** A comparison made after the fact; not for the public site. The tables are in `RESULTS.md`, every number in `results.json`, the method in `README.md`.

## Who made it

- **This run and this report:** Claude Opus 5.5 (Anthropic, model id `claude-opus-5-5`), as the run stage of a workflow (build, independent review, fixes, run).
- **The code** (`optical_check.py`, `test_optical_check.py`, `README.md`) was built and fixed in that workflow's earlier stages. Its header and `results.json`'s `generator` say Claude Opus 5.5. It was reviewed by an agent of the same workflow, not by a person.
- The run changed no definition and no code of `optical_check.py`.

## The answer: "no harvest seen by 4 November" against the optical index

The day on or before 4 November and the day on or after it are both 4 November itself, a usable date. The last usable date of the series is 7 November.

- **T_pooled (Otsu, 0.4650):** the index calls 99.4 % of HH's 25,136 "no harvest seen" cells cut by 4 November, and 99.4 % by 7 November. It also calls 99.4 % of HV's 13,818 such cells cut by 4 November, and 99.4 % by 7 November.
- **T_strict (0.1945):** the index calls 83.7 % of HH's "no harvest seen" cells cut by 4 November (21,045 of 25,136), and 84.1 % by 7 November. It calls 78.9 % of HV's cut by 4 November (10,905 of 13,818), and 79.3 % by 7 November.

**The caveat that goes with this answer.** Three of the eleven usable dates look hazy: 8 October, 23 October and 2 November (see "Exploratory, added after seeing the data"). Many cut days fall on them:

- under T_pooled, 22,563 of 45,744 cut days fall on 8 October;
- under T_strict, 26,811 of 40,958 fall on 2 November.

Exploratory, and not a result of the method: run the same steps without the dates the offset guard could not check. T_strict then becomes 0.2111, and the index calls 57.4 % (HH) and 48.5 % (HV) of the "no harvest seen" cells cut by 4 November. The same look gives T_pooled 0.48 and 97.8 % (HH) and 97.1 % (HV).

T_pooled marks the loss of green, and ripening rice loses green before it is cut (the brief's caveat). So T_pooled's shares are an upper bound.

### Share of the test's 45,928 rice cells cut, beside the radar and the official figures

| Pass | Optical day | T_pooled: cut | T_strict: cut | Radar HH: harvest pair by pass | Radar HV: harvest pair by pass | Official (from `docs/METHODS.md`) |
|---|---|---|---|---|---|---|
| 2026-10-11 | 2026-10-08 (on or before) | 56.2 % | 0.7 % | 9.9 % | 6.3 % | none found |
| 2026-10-11 | 2026-10-18 (on or after) | 70.5 % | 4.5 % | 9.9 % | 6.3 % | none found |
| 2026-10-23 | 2026-10-23 (both) | 98.8 % | 28.3 % | 22.7 % | 9.2 % | Punjab 34.82 % till 23 October; Tarn Taran 73 %, Amritsar 83 % (undated, same report) |
| 2026-11-04 | 2026-11-04 (both) | 99.6 % | 88.9 % | 44.6 % | 67.9 % | Punjab 85.10 % as of 4 November; more than 90 % of Tarn Taran and Amritsar together (undated) |

## The run

- **When:** once, from 05:01:24 to 05:03:13 UTC on 15 November 2026 (Saturday 14 November, 23:01 to 23:03 CT). That is 1 minute 49 seconds, all on code commit `cf206a9`.
- **Before the run:** 35 tests passed and ruff was clean.
- **Command:** `optical_check.py run`, which queries the catalog again.
- **Catalog:** queried at 05:01:26 UTC. It listed 38 items, the same as the probe and the brief. 19 are on tile 43RDQ over 16 dates, and the 19 on 43REQ were left out. No scene from 13 or 14 November was listed.
- **Reads:**
  - 19 granules, 766 MB of compressed image blocks, 99.6 s of reading;
  - 3 dates mosaicked from two datastrips of one datatake: 09-25, 10-15 and 11-04, each checked by `split_granules`;
  - every item is on baseline 05.12 or 05.13, with `earthsearch:boa_offset_applied` true, so reflectance = DN x 0.0001.
- **Inputs:** the sha256 of the three files in `inputs/` are in `results.json`. `read_inputs` checks passed: the grid, the 45,928 rice cells, the stable box's 156 cells, and harvest.json's counts by pass.
- **Afterwards:**
  - `exploratory_unit_check.py` (1 minute 10 seconds) wrote `exploratory_results.json`;
  - the reading was written into `RESULTS.md` by hand, between its markers;
  - the status line of `README.md` was updated.

### Dates used and not used

The rule (step 5): a date is usable when at least 80 % of the test's rice cells have a value. The catalog's cloud cover is for the whole tile and is given only as context.

| Date | Rice cells with a value | Used | Reason, and the catalog's tile cloud cover |
|---|---|---|---|
| 2026-09-13 | 90.6 % | yes | (19.0 %) |
| 2026-09-18 | 92.5 % | yes | (3.3 %) |
| 2026-09-23 | 98.2 % | yes | (3.4 %) |
| 2026-09-25 | 70.6 % | no | under 80 % (28.8 % and 70.7 %, two granules) |
| 2026-09-28 | 39.1 % | no | under 80 % (69.1 %) |
| 2026-10-03 | 100.0 % | yes | (0.0 %) |
| 2026-10-08 | 84.1 % | yes | (8.1 %); looks hazy, see below |
| 2026-10-13 | 65.9 % | no | under 80 % (56.0 %, of which thin cirrus 35.9 %) |
| 2026-10-15 | 8.6 % | no | under 80 % (52.1 % and 81.7 %, two granules) |
| 2026-10-18 | 100.0 % | yes | (0.0 %) |
| 2026-10-23 | 98.1 % | yes | (32.8 %); looks hazy, see below |
| 2026-10-28 | 100.0 % | yes | (0.0 %) |
| 2026-11-02 | 99.9 % | yes | (0.0 %); looks hazy, see below |
| 2026-11-04 | 90.3 % | yes | (0.0 %); the two granules leave 9.1 % of the window without data |
| 2026-11-07 | 100.0 % | yes | (0.0 %) |
| 2026-11-12 | 20.3 % | no | under 80 % (53.4 %) |

No scene exists from 10 to 12 September.

## Sanity checks made after the run

Each one was computed, not eyeballed.

**Counts and shares**
- Every share in `results.json` lies between 0 and 1.
- Both bands' classes 1 to 5 add up to the 45,928 rice cells. The not-rice cells are 36,378 and the stable box holds 156 cells.
- In every row of the step 9 tables, cut + not cut + never green = cells.
- Agreement:
  - both say harvested + both say not = cells that agree;
  - those cells plus the two kinds of disagreement = cells used;
  - every agreement lies inside its 95 % interval.
- Back to green: the cells measured, plus those without a value on the next date, plus those cut on the last usable date, add up to the cut cells.
- The cut-day counts add up to the cells cut by 4 November, plus 2 (T_pooled) or 148 (T_strict) cut on 7 November.
- T_strict pooled 9,505 values from 3,193 strict cells on 3 dates. That is at most 9,579, so 74 values had none.

**Usable dates**
- The usable dates are plausible against the catalog's cloud cover: the five dates left out are the five cloudiest (28.8 % to 81.7 %).

**Figure**
- `ndvi_by_class.png` was looked at. It is readable: five HV classes plus two grey reference lines, the five radar passes, and ticks at the five unusable dates. The x axis has no tick at 29 October (matplotlib's weekly ticks), which is harmless.

**Odd, reported and not adjusted**
1. **Three usable dates look hazy**, and the offset guard could not check them: 8 October, 23 October and 2 November. On each, the scene classification gives no vegetation pixel in the window, and the share of red values below 1000 is low: 9.4 %, 2.2 % and 0.1 %, against 30 % to 83 % on the other usable dates.
   - Two causes were possible:
     - a unit bug, with the offset still in the values;
     - the scenes themselves are brighter, from haze, smoke or thin cloud the classification did not flag.
   - The evidence (the exploratory section) rules out a missed offset. ESA's own tile classification shows the same loss of vegetation, and the brightening is not the same everywhere.
   - So nothing was changed. The method keeps those dates, as fixed.
   - Their effect on the cut shares is large; see the answer above.
2. **The agreement table's "left out" counts overlap.** A cell can be both "fell before" and "never green". So the cells used exceed rice minus fell-before minus never-green by that overlap. Example: T_pooled, 8 October, HH: 45,442 cells used against 45,408.
3. **4 November mosaic.** The two datastrips of the 4 November datatake together leave 749,741 pixels of the window (9.1 %) without data. 90.3 % of the rice cells still have a value, so the date is usable.
4. **The stable box on 13 September.** Only 60 of its 156 cells have a value that day, so the box's median of 0.14 then rests on fewer cells.
5. **25 September** is not usable anyway. Its larger granule has 28 vegetation pixels in the window, and ESA's tile figure for that granule is 2.4 %. It probably looks hazy too.

## Ambiguities and what was done

Readings 1 to 15 were fixed in `README.md` before the run, and the run applied them unchanged:

1. split granules of one tile and date are mosaicked;
2. reflectance = DN x 0.0001, without the `raster:bands` offset, because `boa_offset_applied` is true;
3. a scene's date is its UTC date;
4. "has a value" is the 50-pixel rule alone;
5. quartiles use numpy's linear method;
6. the step 7 groups: class k of each band, value 6 for not rice, and all 156 cells of the stable box, including its 2 rice cells;
7. both thresholds pool one value per cell and date;
8. shares are of all cells of a group, and never-green cells are counted apart;
9. when a pass date is usable, both of its days are that date, and both rows are shown;
10. agreement leaves out fell-before cells and never-green cells;
11. bootstrap blocks are counted from the upper-left corner, with a fresh generator per interval;
12. back to green is measured on the usable date after each cell's own cut day;
13. the radar shares are harvest.json's `cumulative.by_pass`;
14. the official figures are quoted from `docs/METHODS.md`;
15. the figure's layout.

New at the run:

16. **Hazy usable dates.** The method has no haze test.
    - Its valid classes include 5 (not vegetated) and 7 (unclassified), and the brief keeps dark areas in.
    - A hazy date that the classification does not flag therefore passes the 80 % rule.
    - Taken literally, those dates were used. The effect is shown apart, as exploratory.
17. **The catalog was queried again at the run.** This is the script's default, and the brief asks for "every scene from 2026-09-10 to 2026-11-14". It returned the same 38 items as the probe.
18. **The offset guard.** It recorded "not checked" for the dates with fewer than 1000 vegetation pixels (09-25, 10-08, 10-23, 11-02, 11-12). The run did not stop for them, as the guard was built.

## What could not be done

- **The scenes' own `product_metadata`** (BOA_ADD_OFFSET) was not read. Its link is `s3://` in a requester-pays bucket, outside the public https files. The offset rule rests on the catalog's flag, the probe's values, the guard on 11 scenes, and the exploratory evidence for the 3 hazy usable dates.
- **No aerosol or haze mask.** The items carry an `aot` asset (aerosol optical thickness), but it is outside the brief's three assets and was not read. A haze rule now, after seeing the data, would be a new definition.
- **No field data.** The optical index sees green, not stems (step 10's limits, printed in `RESULTS.md`).
- **The HLS 2.0 repeat** was not started, as instructed.
- **The pull request** was not opened. This file holds its description.

## Changed after the first real run

Nothing. The run ran once and did not crash, and no bug was found. The definitions, threshold rules and date rules are those of commit `cf206a9`, and `results.json`, the tables and the figure are that run's.

Only these were added after the run:
- the reading in `RESULTS.md`;
- this file;
- the status line of `README.md`;
- the exploratory script and its output below. They change no number of the run.

## Exploratory, added after seeing the data

**Everything in this section was looked at after the run's results were seen. None of it is a result of the method.** Code: `exploratory_unit_check.py`. Numbers: `exploratory_results.json`. Both are labelled the same way.

### 1. Dark targets on the usable dates

The scenes were read again. This table checks whether the values on the three unchecked dates still hold the +1000 offset.

| Date | Vegetation pixels in the window (SCL 4) | ESA tile vegetation % | Water (SCL 6) NIR median | Water NIR below 1000 | All pixels: red 1st percentile / median | All pixels: NIR 1st percentile / median |
|---|---|---|---|---|---|---|
| 2026-09-13 | 6,415,040 | 52.9 | 604 | 81.2 % | 83 / 402 | 402 / 3691 |
| 2026-09-18 | 6,529,782 | 65.7 | 992 | 50.7 % | 219 / 497 | 840 / 4015 |
| 2026-09-23 | 4,424,339 | 38.4 | 946 | 51.9 % | 266 / 588 | 595 / 3779 |
| 2026-10-03 | 6,443,655 | 60.0 | 570 | 79.1 % | 229 / 695 | 469 / 3313 |
| **2026-10-08** | **0** | **13.7** | **1749** | **0.0 %** | **853 / 1293** | **1265 / 3191** |
| 2026-10-18 | 2,849,016 | 37.9 | 192 | 90.8 % | 75 / 963 | 53 / 2759 |
| **2026-10-23** | **0** | **0.3** | **1863** | **10.6 %** | **928 / 1667** | **1115 / 2769** |
| 2026-10-28 | 984,016 | 18.5 | 150 | 88.6 % | 192 / 1296 | 127 / 2605 |
| **2026-11-02** | **0** | **0.0** | **2052** | **8.6 %** | **1154 / 1814** | **1151 / 2605** |
| 2026-11-04 | 92,158 | 0.7, 2.2 | 682 | 62.0 % | 537 / 1376 | 529 / 2190 |
| 2026-11-07 | 558,146 | 11.1 | 260 | 86.4 % | 236 / 1172 | 197 / 1936 |

### 2. The change of the cell means against clear neighbouring dates

This uses the run's cache, in DN.

| Date minus clear date | Cell-mean red, median | Cell-mean NIR, median | Red by quarter of the window, smallest to largest | NIR by quarter, smallest to largest |
|---|---|---|---|---|
| 2026-10-08 minus 2026-10-03 | +506 | -160 | +441 to +913 | -248 to +263 |
| 2026-10-08 minus 2026-10-18 | +286 | +366 | +172 to +653 | +226 to +959 |
| 2026-10-23 minus 2026-10-18 | +639 | -3 | +281 to +953 | -114 to +78 |
| 2026-10-23 minus 2026-10-28 | +339 | +123 | +190 to +520 | +13 to +232 |
| 2026-11-02 minus 2026-10-28 | +543 | +69 | +377 to +796 | -80 to +217 |
| 2026-11-02 minus 2026-11-07 | +592 | +413 | +499 to +678 | +308 to +487 |

**What this suggests (hypotheses).** A missed offset would add the same 1000 to every pixel of both bands. Instead:
- the shifts of the cell means are smaller than 1000 and differ between red and NIR and across the window;
- on 10-08 the brightening is about twice as strong in the south-west quarters as in the north;
- the darkest pixels are lifted most, by 600 to 1,200 against medians lifted by 300 to 650. That is what scattered light does to an image, not a constant offset;
- the scene classification that finds no vegetation is ESA's own, computed before any storage offset, and ESA's tile figures show the same drop.

So the values are taken to be correct reflectances of hazy scenes: smoke haze, smog or thin cloud the classification did not flag. This is a hypothesis; the scenes' aerosol band was not read. Water's NIR is not a clean test on its own: on the clear 18 and 23 September it was already near 1000.

### 3. Sensitivity

Steps 5 to 9 were rerun with `optical_check.analyse` unchanged, without the dates the offset guard could not check. That guard's rule, "fewer than 1000 vegetation pixels", was fixed before the run.

- **Dates left out:** 09-25, 10-08, 10-23, 11-02 and 11-12. The first and last were not usable anyway.
- **Usable dates left:** 09-13, 09-18, 09-23, 10-03, 10-18, 10-28, 11-04 and 11-07.
- **Days around the passes:**
  - 10-11: 10-03 and 10-18;
  - 10-23: 10-18 and 10-28;
  - 11-04: 11-04.
- **Thresholds:** T_pooled 0.480 (312,768 values). T_strict 0.2111, from 6,313 values on 10-28 and 11-04.

| Threshold | "No harvest seen" cells cut | HH by 4 Nov | HH by 7 Nov | HV by 4 Nov | HV by 7 Nov |
|---|---|---|---|---|---|
| T_pooled | method (all usable dates) | 99.4 % | 99.4 % | 99.4 % | 99.4 % |
| T_pooled | exploratory (hazy dates left out) | 97.8 % | 98.6 % | 97.1 % | 98.4 % |
| T_strict | method (all usable dates) | 83.7 % | 84.1 % | 78.9 % | 79.3 % |
| T_strict | exploratory (hazy dates left out) | 57.4 % | 65.0 % | 48.5 % | 56.0 % |

The share of all rice cells cut by 4 November becomes 98.6 % (T_pooled) and 69.4 % (T_strict), against 99.6 % and 88.9 % under the method. By 23 October's later day (28 October) it is 95.8 % and 19.6 %.

## What should change outside this folder (for the lead to do)

### `docs/SOURCES.md`, in "Data"

| What | Used for | Where | Terms |
|---|---|---|---|
| Copernicus Sentinel-2 Level-2A surface reflectance (ESA): bands B04 and B08 (10 m) and the scene classification SCL (20 m), tile 43RDQ, 16 dates from 2026-09-13 to 2026-11-12 (11 usable), read as Cloud-Optimized GeoTIFFs, only the window of the product grid | The optical cross-check of the harvest map (`research/optical_check/`): NDVI of the 100 m cells by radar class. Not on the public site | Earth Search catalog by Element 84, collection `sentinel-2-l2a`, https://earth-search.aws.element84.com/v1 ; files on https://sentinel-cogs.s3.us-west-2.amazonaws.com (no login) | Copernicus Sentinel data, free and open under the Legal Notice on the use of Copernicus Sentinel Data and Service Information: https://sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice (the collection record's `license` link; not opened in this run). Credit: "Contains modified Copernicus Sentinel data 2026". Collection citation (the record's `cite-as` link): Copernicus Sentinel-2 MSI Level-2A, https://doi.org/10.5270/S2_-742ikth. **Corrected on 15 November 2026, after the run:** the host sentinel.esa.int no longer resolves, and the notice is at https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice. The `cite-as` DOI is registered to Level-1C. The Level-2A data used (processing baselines 05.12 and 05.13) is ESA's Collection 1, https://doi.org/10.5270/S2_-znk9xsj (`docs/SOURCES.md`) |

### `docs/SOURCES.md`, in "Services"

| What | Used for | Where | Terms |
|---|---|---|---|
| Earth Search STAC API, by Element 84 | Listing the Sentinel-2 scenes over the site box (only the box and the dates are sent) | https://earth-search.aws.element84.com/v1 | Public, no login. The catalog's providers are ESA (producer), Sinergise and Element 84 (processors), and AWS (host). The service's own terms were not checked |

HLS was not used, so no HLS line is needed.

### `docs/METHODS.md`, section 6

The lead writes the agreed numbers there. Above all, it needs the answer above with its caveat: the three hazy dates and the exploratory range.

### `AI_USE.md`

Suggested line: "Optical cross-check (`research/optical_check/`): code, tests, run, tables, figure and report written by Claude Opus 5.5 (Anthropic) in an agent workflow (build, independent review by an agent, fixes, run), from the brief `docs/OPTICAL_CHECK_BRIEF.md`."

## Files

| File | What it is |
|---|---|
| `optical_check.py`, `test_optical_check.py` | Unchanged since `cf206a9`; 35 tests on SYNTHETIC arrays |
| `results.json`, `RESULTS.md`, `ndvi_by_class.png` | The run's output. The figure was drawn by code from `results.json` |
| `exploratory_unit_check.py`, `exploratory_results.json` | Exploratory, added after seeing the data |
| `REPORT.md` | This file |

The cache of cell sums is in `work/optical/scenes/`, git-ignored, and was not committed. No imagery was committed.

Contains modified Copernicus Sentinel data 2026. Catalog: Earth Search by Element 84.

## Corrections by the lead builder (Saturday 14 November 2026, after the run)

Two figures in the text above do not match the run's own files; the files are right, and the methods page
(`docs/METHODS.md`, section 6) uses neither figure.

- "Red below 1000 on ... 30 to 83 % on the other usable dates": `results.json` gives 14.7 % for 4 November
  (`red_below_offset_share` 0.147), so the range is 14.7 % to 82.8 %.
- "the medians [lifted] 300 to 650": `exploratory_results.json` gives rises of the red median of 330 to 704.

The reviewer's count: eleven defects were reported (D1 to D11: one major, that no test checked the numbers
of the step 9 tables, and ten minor); the fix stage added tests for them (35 tests in all) before the run.
