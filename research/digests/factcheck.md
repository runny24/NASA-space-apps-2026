# Recovered digest: fact-check of the NISAR build brief

Topic: `factcheck`. Written 2026-11-14 about 11:30 CST by a recovery pass over the interrupted fact-checker
runs. Nothing was re-run and no network request was made for this digest. It reports what the saved outputs
show. Where the digest author did a small local read of a saved file to settle something the runs left open,
the line is tagged **[local read]**.

## 0. Sources, and how to read this file

Sections 0 to 7 are the digest (about 55 KB, the first 410 lines). Section 8 holds the raw outputs that back
it and Section 9 the scripts and commands to copy from; read those two selectively.

Brief that was checked (still "version 1", 58,558 bytes, 851 lines, unchanged since the runs):
`<prehackathon-repo>/research/BUILD_PROMPT.md`

Scratch folder of the fact-checker (abbreviated `$FC` below):
`<scratch>/review/fact-checker`
It is under `/private/tmp`, so a reboot can erase it. That is why Section 9 of this file embeds every
script verbatim and Section 8 embeds the raw outputs.

Transcripts (folder
`<transcripts>/wf_79c71ecc-a87/`):

| Run | Transcript | When (CST) | What it did | How it ended |
|---|---|---|---|---|
| 1 | `agent-a5f13a3de1ea8fff6.jsonl` | 2026-11-13 20:53 to 21:07 | CMR ids, coverage for all 17 places, CMR date ranges and name census, browse PNG, GIBS capabilities and tiles, tile-health survey. Files in `$FC/scripts`, `$FC/out`, `$FC/dl_*` | "You've hit your 5-hour limit" |
| 2 | `agent-a3d2f3e920e4f323e.jsonl` | 2026-11-14 01:41 to 02:01 | Repeated run 1's core checks, then data-guide pages, rule quotes, live challenge page, Appendix C URLs, Cookbook, benchmark gist, hosting docs, npm and PyPI, a throwaway venv, the asf_search snippet live, the D4, D5 and D3 sketches. Files in `$FC/run2` | "You've hit your 5-hour limit" |
| 3 | `agent-a656b175738fa854f.jsonl` | 2026-11-14 06:41 | Nothing: limit hit on the first turn | "You've hit your Fable limit" |

Neither working run wrote a single sentence of conclusion: every assistant turn was a tool call. So every
fact below rests on a tool output (`ran`) or on a documentation or registry page the runs fetched and saved
(`docs`). There are no agent assertions to report as `belief`. The rankings, the corrections' wording and the
recommendations are this digest's reading of that evidence.

Evidence kinds: **ran** = a saved output or transcript tool result shows the command and what it printed;
**docs** = read in documentation, a package registry or the saved rule pages; **belief** = asserted without
evidence (none found).

## 1. How far the runs got

The fact-checker's Step 2 (live re-checks) was done almost completely across the two runs: CMR, coverage,
GIBS, browse previews, data-guide statements, rule quotes, challenge page, Appendix C URLs, hosting, package
versions, and three of the brief's code sketches run in a scratch venv. Step 1 (a claim-by-claim comparison
of the brief with `CHECKPOINT.md`) was never reported, Appendix B was not checked at all, and no final
report was written. Nothing needing Earthdata credentials was run, so the HDF5 layout (Section 4.4) and the
three windowed-access paths are still untested against real data.

## 2. Corrections to the brief, most damaging first

Severity: **blocks-build** = following the brief as written fails; **wrong-result** = it runs but gives
wrong data or a wrong claim; **minor** = sharpening. No blocks-build item was found.

### C1 (wrong-result). GIBS NISAR tiles are not reliable above zoom 8
- Brief, Section 4.6 and sketch D2: "Tiles are 256 px, maximum zoom 13"; `maxzoom: 13`.
- Actual: zoom 14 is rejected (HTTP 400), so 13 is the nominal maximum, but on the `epsg3857/best` endpoint
  only zoom 3 to 8 behaved. Run 1 sampled 5 place-dates at zoom 3 to 13 (55 tiles). Zoom 3 to 8: 30 of 30
  were normal RGB tiles. Zoom 9 to 13: of 25 tiles, 10 were palette PNGs whose 256-entry palette is entirely
  black (they render fully transparent, or as opaque black when the `tRNS` chunk has length 1), 3 were
  grayscale-plus-alpha instead of colour, 1 was HTTP 500, and 11 were good. All five zoom-13 tiles failed.
  The same URL returned different encodings a minute apart (zoom 10, tile 474/807, 2026-10-17: RGBA 181,897
  bytes, then an all-black palette of 45,900 bytes). Run 2, five hours later, got the Tonle Sap zoom-13 tile
  again: still an all-black palette (43,381 bytes) **[local read of the saved PNG header]**.
- Evidence (ran): `$FC/out/gibs_survey.txt`, for example
  `z13 3798/6463: PAL  bytes= 43636 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)`
  and `z13 3095/2086: ERROR HTTP Error 500: Internal Server Error`; chunk dump in run 1,
  `ts_z9.png | IHDR 256x256 bitdepth=8 colortype=3 ; PLTE entries=256 nonblack=0 ... ; tRNS len=256 zero-alpha=256`.
- Consequence: the H1 to H3 "thin slice on no-login imagery" will show blank or black squares as soon as a
  visitor zooms in. Reliable GIBS detail is zoom 8, about 600 m per pixel.

### C2 (wrong-result). The colour key for the GIBS NISAR layer is not what the brief says
- Brief, Section 4.6: "red = HH, green = HV, blue = HH/HV ratio (water blue, forest green, flooded
  vegetation yellow)", marked as inferred.
- Actual (docs, data guide page `/worldview`, paraphrased): for dual-pol and quad-pol products the
  co-polarized backscatter (HH or VV) drives both the red and the blue channel and the cross-polarized
  backscatter (HV or VH) drives green. In that scale vegetation looks green, urban and sparsely vegetated
  ground orange or yellow, calm water, dry sand and frozen ground blue, and rough water can look red.
  Single-pol products get their own colour bar running blue, green, orange, yellow from low to high
  backscatter. The mosaics are resampled to 15.625 m and mix VALIDATED (from 2026-10-21) with PROVISIONAL
  (before). No ratio channel is documented, and yellow is documented for urban or sparse vegetation, not for
  flooded vegetation.
- Evidence: `$FC/run2/dl/docs/worldview.txt` lines 26, 46, 47 and 49.

### C3 (wrong-result). "The data guide says not to mix releases" overstates the guide
- Brief, Section 4.1: "The data guide says not to mix releases in one time series."
- Actual (docs): the guide's advice, on two pages, concerns BETA with PROVISIONAL only. The NISAR Data User
  Guide's provisional known-issues page says "Users should exercise caution if they analyze BETA products
  together with PROVISIONAL products", giving the change of processing software as the reason. A search of
  all 31 saved guide pages for mix/combine/together found nothing about PROVISIONAL with VALIDATED, and
  NASA's own Worldview mosaic combines those two. Keeping a series within one release is still the cautious
  choice; it just cannot be attributed to the guide as a rule.
- Evidence: `$FC/run2/dl/docs/provisional-known-issues.txt:49`, `availability-overview.txt:37` and `:43`.

### C4 (wrong-result). The link filter "rel ends in data#" also matches metadata links
- Brief, Section 4.5: "`links` (those whose `rel` ends in `data#`, `s3#` or `browse#`)".
- Actual **[local read of the saved CMR response]**: each granule carries 52 links with rels `data#`,
  `s3#`, `browse#`, `metadata#`, `documentation#`. `rel.endswith('data#')` matches 35 of them (every
  `metadata#` link: `.iso.xml`, `.kml`, QA files). `rel.endswith('/data#')` matches 3: the `.h5` and two
  collection-level links flagged `inherited`. Sketch D1 only uses `browse#`, so it is unaffected; that
  filter returns 7 https PNGs per granule, not 2.
- Evidence: `$FC/run2/dl/tonle.json`.

### C5 (minor, but it bites a time slider). GIBS dates: three extra gaps, and 404 instead of an empty tile
- Brief, Section 4.6: "Dates available: 2025-10-29 to 2026-11-11 with the gaps above. A date with no pass
  over your area returns an empty 288-byte tile rather than an error".
- Actual (ran): the capabilities list five ranges: `2025-10-29/2026-03-01`, `2026-03-04/2026-03-29`,
  `2026-04-01/2026-04-12`, `2026-04-14/2026-07-27`, `2026-08-10/2026-11-11`. So 2026-03-02, 03-03, 03-30,
  03-31 and 04-13 are missing too. A date inside a range with no pass returns HTTP 200 and the empty
  288-byte tile (2026-10-18). A date outside every range returns HTTP 404 with an HTML body (2026-08-01,
  2026-11-12, 2026-11-13).
- Evidence: run 2 tile output, `nisar_z8_0801_ingap.png -> 404 196 text/html` and
  `nisar_z8_1018_nopass.png -> 200 288 image/png`.

### C6 (minor). Browse PNGs already declare black as transparent
- Brief, Section 4.6: "RGB on black, no transparency"; D4: "Black pixels must be made transparent in a
  canvas before display."
- Actual (ran): the live `_LATLON.png` and thumbnail are 8-bit RGB with a `tRNS` chunk `000000000000`.
  PIL reports `info.transparency = (0, 0, 0)`; after conversion to RGBA all 1,587,140 pure-black pixels have
  alpha 0 and "black but opaque" is 0. A browser shows the collar as transparent with no canvas work. (The
  copies in `research/evidence/previews/` were re-encoded as RGBA without `tRNS`, which is probably where
  the brief's statement came from.)
- Evidence: `browse_latlon.png | bytes 4247472 | IHDR w,h,bitdepth,colortype = (1880, 1847, 8, 2) | chunk types ['IHDR', 'tRNS', 'IDAT', 'IEND'] | tRNS 000000000000`.

### C7 (minor). Urgent-response duplicates only appear when `dataMaturity` is left out
- Brief, Section 4.5: "Without `productionConfiguration='PR'` you also get urgent-response duplicates."
- Actual (ran): with `dataMaturity='PROVISIONAL'` the result is the same with or without the PR filter
  (Tonle Sap 10 and 10; Kilauea 54 and 54, all PR). With no `dataMaturity` at all, Kilauea returns 90:
  71 PR plus 19 UR from the separate collection `NISAR_UR_L2`, and beta comes along too.
- Evidence: `Kilauea, no dataMaturity, no productionConfiguration: 90 results | PR/UR by name: {'UR': 19, 'PR': 71} | collections: {'NISAR_UR_L2': 19, 'NISAR_L2_GCOV_V1': 4, 'NISAR_L2_GCOV_PROVISIONAL_V1': 54, 'NISAR_L2_GCOV_BETA_V1': 13}`.

### C8 (minor). Harmony cannot deliver Web Mercator
- Brief, Section 4.5: Harmony extracts layers as COGs "with bounding-box subsetting and reprojection".
- Actual (docs): output projections are EPSG:4326, 3031, 3413 and the UTM zones (32601 to 32660, 32701 to
  32760). EPSG:3857 is not offered, and the browser COG library requires 3857, so the pipeline must warp in
  every case. The documented subsetting clips to the spatial filter set in Earthdata Search.
- Evidence: `$FC/run2/dl/docs/harmony.txt` lines 32 and 35 to 39.

### C9 (minor). More public previews exist than the brief lists
- Brief, Section 4.6: `_LATLON.png` and `_LATLON_thumbnail.png`.
- Actual (ran): CMR lists five more PNGs in the same public folder: `_NATIVE.png`, `_NATIVE_A_HHHH.png`,
  `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png` (the native-projection composite and one
  image per polarization and frequency). Three were fetched without login and returned 200: `_NATIVE.png`
  (4,727,200 bytes), `_NATIVE_A_HHHH.png` (1,601,869), `_NATIVE_B_HVHV.png` (871,202).
- Evidence: run 1, `_NATIVE_A_HHHH.png: http=200 redirects=1 size=1601869`.

### C10 (minor). Appendix A and the paragraph under it: four sharpenings
All 17 rows reproduce (Section 8.2). Differences:
- Reykjanes: the brief's `159_A_034` still has 27 dates, but `082_D_056` now has 28 (2025-11-03 to
  2026-10-29); it had 27 during run 1 and gained a validated date between the runs.
- Rondonia `068_D_094`: polarization is `HH/HH+HV` (some dates are HH only), not "HH+HV".
- Interferograms: "22 to 27 at Kilauea, the Central Valley and Reykjanes" is 26 and 25, 25 and 22, 25 and
  25. Mexico City's "28 consecutive 12-day pairs" are 27 twelve-day pairs plus one 24-day pair across the
  data gap (2026-07-21 to 2026-08-14).
- Evidence: `$FC/run2/out/coverage_b.txt`, `coverage_c.txt`, `coverage_gunw.txt`; run 1 pair listing.

### C11 (minor). How thin the newest data is, and where the releases meet
- Brief, Section 4.1: "Production paused from 23 October to 6 November. Validated products for 7 to 13
  November are still thin."
- Actual (ran, by acquisition day, 2026-11-14 01:50 CST): validated GCOV is full through 10-30 (1,096 to
  1,365 a day), then 708 (10-31), 596, 434, 261, 249, 311, 463 (11-06), then 57, 52, 33, 19, 32 (11-07 to
  11-11), and zero from 11-12. The collection was still being back-filled: 14,085 granules at 20:59 on
  13 November, 14,683 at 01:43 on 14 November. Provisional ends at 2026-10-21T20:37:40Z and validated starts
  at 2026-10-21T17:07:21Z (on 10-21: 1,142 provisional, 367 validated), although the guide's timeline text
  has provisional running into 23 October. The pause itself was not checked.
- Evidence: `$FC/run2/scripts/cmr_daily.py` output (Section 8.4), `$FC/out/cmr_ranges.txt`.

### C12 (minor). File-name codes the brief leaves out
- Brief, Section 4.3: modes `2005`, `4005`, `7700`, `0005`; polarizations `SH`, `DH`, `QP`, `NA`.
- Actual (ran, census of 163,672 provisional GCOV names): modes also `0500` (419), `2000` (82), `4000`
  (13). Polarization codes also `SV` and `DV` (VV and VV+VH): `NASV` 41,946, `NADV` 4,575, `DVDV` 772.
  Mode `0005` (frequency A absent, 80 m only) is 46,762 granules, 29 percent of the collection. Partial
  frames (`_N_P_J_`) are 43,299, 26 percent. Counter `_002` occurs 2,057 times and `_003` once.
- Evidence: `$FC/out/cmr_crid.txt`.

### C13 (minor). Free disk is 33 GB, not 42 GB
- Brief, Section 1.2: "about 42 GB free disk".
- Actual (ran, 2026-11-13 20:59 CST): `Container Free Space: 33.4 GB`.

### C14 (minor). Soil moisture is not on the Level 2 grids
- Brief, Section 4.4: projections are UTM, EPSG:3413 or EPSG:3031.
- Actual (docs): that is Level 2. The Level 3 soil-moisture product is on the global EASE-Grid 2.0,
  EPSG:6933, at 200 m spacing (500 m over the Sahara).
- Evidence: `$FC/run2/dl/docs/projections.txt:48`.

### C15 (minor). The benchmark behind "blockcache" was measured inside AWS, and ASF's own notebooks use "background"
- Brief, Section 4.5, way 1: `cache_type="blockcache", block_size=8*1024*1024`; "2 seconds ... against
  52 seconds and 4.3 GB".
- Actual (docs): the numbers are right (2.07 s against 51.98 s; 4,262 MB requested by the equivalent naive
  reader). But the gist measured `s3fs` on S3 from compute next to the files in AWS us-west-2, and it
  suggests a smaller block size when working outside that region.
  The Cookbook notebooks use `cache_type="background"` with 8 MB, and the data guide's earthaccess and
  asf_search pages use `background` with 16 MB. Nobody measured HTTPS from a laptop.
- Evidence: `$FC/run2/dl/gist/nisar-remote-read-benchmark.ipynb`; `$FC/run2/dl/docs/earthaccess.txt:134`.

### C16 (minor). Two quotes and one limit without support in the saved rule pages
- The Team box's second quoted sentence (working ahead can lead to disqualification) is not in any of the
  four saved rule pages. `CHECKPOINT.md` line 35 attributes it to a GO Team answer at
  `github.com/nasa/spaceapps/discussions/1827`; the runs did not open that page. **[local read]**
- Section 9, "The form accepts JPG, PNG and GIF up to 10 MB": no match in the saved rule pages or in
  `CHECKPOINT.md`. **[local read]**
- Every other quoted rule sentence was found (Section 3.9).

### C17 (minor). D5 runs, with a deprecation warning and 512-pixel blocks
- Brief, D5: `cog_translate(..., web_optimized=True, ...)`.
- Actual (ran, rio-cogeo 7.0.4): it works and validates, but prints `DeprecationWarning: 'web_optomized'
  option is deprecated and will be removed in 6.0. Please use the `tms` option`. The output has 512 x 512
  blocks; the COG-protocol README recommends the Google Maps tiling scheme with 256-pixel blocks.

### C18 (minor). Appendix C
- All 15 URLs as written return HTTP 200. Four are the redirect targets of what the live Resources tab
  links to (fine). The live tab has one more entry than the brief: "SAOCOM Catalogue Registration",
  `https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible`.
- Not found on the pages fetched: "Harnessing NISAR" on the ARSET landing page (the title does appear in
  the data guide, without a month); the credit string "Courtesy NASA/JPL-Caltech" on the UAVSAR postcards
  page; the bucket name `s3://radarsat-r1-l1-cog/` on the RADARSAT-1 page. Treat those three as unchecked.

## 3. Facts the runs established

Status: CONFIRMED = the brief is right; SHARPENED = right but incomplete (see the correction);
NEW = not in the brief.

### 3.1 CMR search
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 1 | All 11 collection ids in Section 4.2 exist with the stated short names and hold granules: GCOV V/P/B 14,683 / 163,672 / 23,527; GUNW 140 / 94,150 / 10,217; GOFF 32 / 27,717 / 3,666; SME2 P/B 103,943 / 13,881 | CONFIRMED | ran | `$FC/run2/out/cmr_collections.txt`: `C3622241360-ASF hits=14683  NISAR_L2_GCOV_V1` |
| 2 | The brief's granule query needs no login, allows cross-origin requests and exposes the paging headers to browser code | CONFIRMED | ran | `access-control-allow-origin: *`, `cmr-hits: 11`, `access-control-expose-headers: CMR-Hits, ..., CMR-Search-After` (`$FC/run2/dl/tonle_hdr.txt`) |
| 3 | Entry shape: `title`, `time_start`, `granule_size` (about MiB), `polygons` as `[["lat lon lat lon ..."]]`, `links`; `attribute[]=string,STACK_ID,083_A_008` returns exactly that stack. The response is about 25 KB per granule (276,697 bytes for 11) | CONFIRMED | ran | `polygons repr: [['12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936']]` |
| 4 | `rel.endswith('data#')` matches 35 of 52 links; `'/data#'` matches 3, two of them `inherited` | SHARPENED (C4) | ran [local read] | `$FC/run2/dl/tonle.json` |
| 5 | Tonle Sap `083_A_008`: provisional (P05023) on 2026-06-19, 07-01, 07-13, 07-25, 08-18, 08-30, 09-11, 09-23, 10-05, 10-17; validated (P05036) on 10-29; start 22:36 UTC; `granule_size` 1,774 to 1,826 | CONFIRMED | ran | titles in Section 8.1 |
| 6 | The file-name example in Section 4.3 is a real granule | CONFIRMED | ran | `NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 2026-10-17T22:36:33.000Z` |
| 7 | Tracks run 001 to 173 and frames 001 to 176 | CONFIRMED | ran | `track 173 779 / track 174 0 / frame 176 666 / frame 177 0` |
| 8 | CRIDs: all validated GCOV is P05036; 163,648 of 163,672 provisional are P05023; beta is X05008 (98), X05009 (15,851), X05010 (7,572) | CONFIRMED | ran | `$FC/out/cmr_crid.txt` |

### 3.2 The record
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 9 | Provisional GCOV spans 2025-10-29T11:11:30Z to 2026-10-21T20:37:40Z; validated 2026-10-21T17:07:21Z to 2026-11-11T23:35:57Z; beta 2025-10-12T18:25:08Z to 2026-01-20T15:59:30Z. Zero validated granules start on or after 2026-11-12 (checked 2026-11-14 07:48 UTC) | CONFIRMED (beta starts 5 days before the guide's 10-17) | ran | `$FC/out/cmr_ranges.txt`; `temporal>=2026-11-12T00:00:00Z, cmr-hits: 0` |
| 10 | The data gap is real in the catalog: zero GCOV granules in any release from 2026-07-27T22:04Z to 2026-08-10T00:54Z; the last before ends 21:17:13Z, the first after starts 00:55:32Z | CONFIRMED | ran | `2026-07-27T22:03Z..2026-08-10T00:55Z GCOV_P: hits=0` |
| 11 | Before mid-June 2026 only selected frames exist: provisional GCOV per month is 44, 557, 721, 748, 729, 667, 790, 856 (Oct 2025 to May 2026), then 20,467 / 36,912 / 29,883 / 42,430 / 28,870 (Jun to Oct 2026) | CONFIRMED | ran | `$FC/out/cmr_ranges.txt` |
| 12 | Validated GCOV per acquisition day and the back-fill in progress | SHARPENED (C11) | ran | Section 8.4 |
| 13 | Guide statements: launch 2025-07-30; VALIDATED released 2026-11-06 for acquisitions from 2026-10-21, CRID P05036, no validated SME2; PROVISIONAL released 2026-07-20, CRID P05023, all acquisitions from 2026-06-17, plus longer series for selected frames; BETA is a subset from 2025-10-17 to 2026-01-20, up to 8 acquisitions per track; gap 2026-07-27T22:03:25Z to 2026-08-10T00:55:27Z | CONFIRMED | docs | `$FC/run2/dl/docs/availability-overview.txt` |
| 14 | Standard interferograms stop at pairs beginning 2026-10-09 | CONFIRMED | ran | `GUNW_P ... last=2026-10-09T20:37:40.000Z`, `GUNW_V ... last=2026-10-09T23:53:35.000Z` |
| 15 | Standard products appear 36 to 72 hours after acquisition; urgent-response Level 2 in about 6 hours, kept 30 days, with lower-quality orbits. `NISAR_UR_L2` (`C2887502657-ASF`) holds 6,785 granules up to 2026-11-13T23:58:12Z | NEW | docs + ran | `$FC/run2/dl/docs/urgent-response.txt`; `NISAR_L2_UR_GCOV_035_127_A_020_4005_DHDH_A_20261113T235812_..._P05036_F_P_J_001` |
| 16 | Mode changes inside a frame give partial granules (`P`) plus, where possible, a mixed-mode full granule (`M`, `F`) | CONFIRMED | docs | `$FC/run2/dl/docs/observation-plan.txt:23-28` |

### 3.3 Coverage (Appendix A)
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 17 | All 17 rows reproduce: stack, number of dates, span, mode and median file size | CONFIRMED, two rows SHARPENED (C10) | ran | `$FC/run2/out/coverage_a.txt`, `coverage_b.txt`, `coverage_c.txt`; Section 8.2 |
| 18 | Other products: GUNW Mexico City 28 and Tonle Sap 9; SME2 26 (Central Valley), 24 (Punjab), 16 (Champaign); GOFF 14 (Jakobshavn), 15 (Pine Island), 15 (Hubbard) | CONFIRMED | ran | `$FC/run2/out/coverage_gunw.txt`, `coverage_other.txt` |
| 19 | Polarization and bandwidth do change inside one stack (for example `pol=HH/HH+HV`, `bw=20+5/40+5 MHz`), and one date can have several granules | CONFIRMED | ran | `047_D_084 11 dates ... pol=HH/HH+HV bw=20+5/40+5 MHz ... releases={'P': 20, 'V': 2}` |
| 20 | `research/nisar_coverage.py` runs without login or dependencies in about one second per place; its `releases` field counts granules, not dates | CONFIRMED | ran | 56 runs, 28 in each session (17 GCOV, 5 GUNW, 3 SME2, 3 GOFF) |

### 3.4 Access
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 21 | Without login the `.h5`, the provisional `_LATLON.kml`, `_QA_SUMMARY.csv`, `_QA_REPORT.pdf` and `.h5.iso.xml` all answer HTTP 302 to `urs.earthdata.nasa.gov` | CONFIRMED | ran | run 1: `HTTP/2 302 / location: https://urs.earthdata.nasa.gov/oauth/authorize?...` |
| 22 | The account must accept the "Alaska Satellite Facility Data Access" EULA | CONFIRMED | docs | Cookbook `notebooks/set_up_Earthdata_Login.md:5` states the requirement; lines 21 to 38 give the steps (EULAs tab, Accept New EULAs, the ASF entry). Saved at `$FC/run2/dl/cookbook/notebooks_set_up_Earthdata_Login.md` |
| 23 | S3 links work only inside AWS us-west-2 | CONFIRMED | docs | `$FC/run2/dl/docs/aws-s3-access.txt:77-78` and `:202` |
| 24 | `asf_search` 14.1.0: the brief's snippet returns the 10 provisional Tonle Sap granules in 0.2 s with no login; `dataMaturity='VALIDATED'` returns the 11th | CONFIRMED | ran | `brief snippet -> results: 10 in 0.2s` |
| 25 | `earthaccess` 0.19.0: `DataGranule.size` is a property; `get_fsspec_https_session` exists; `login(strategy='all', persist=False, ...)` | CONFIRMED | ran | `DataGranule.size is property: True` |
| 26 | The data guide's own HTTPS streaming recipe is `earthaccess.get_fsspec_https_session()` then `fs.open(url, cache_type='background', block_size=16*1024*1024)` into `xr.open_datatree(..., engine='h5netcdf', decode_timedelta=False, phony_dims="access")`. The Cookbook uses `fsspec.filesystem("http", headers={"Authorization": f"Bearer {token}"}, cache_type="background", block_size=8*1024*1024)` | NEW | docs | `$FC/run2/dl/docs/earthaccess.txt:123-143`; Cookbook `NISAR_GCOV_Time_Series_Example.ipynb` cell 12 |
| 27 | Benchmark gist: fsspec read-ahead 50 MB 51.98 s to open the tree, block cache 8 MB 2.07 s; a 2000 x 2000 window 48.40 s against 1.18 s; the naive reader made 152 requests for 4,262 MB, the block reader 8 requests for 56 MB. Further tuning: `driver_kwds={"page_buf_size": 16 * MB, "rdcc_nbytes": 4 * MB}` | CONFIRMED, context SHARPENED (C15) | docs | Section 8.9 |
| 28 | Harmony handles GCOV, GUNW, GOFF and SME2, outputs COGs, needs login; no EPSG:3857 output | SHARPENED (C8) | docs | `$FC/run2/dl/docs/harmony.txt` |
| 29 | GDAL: the HDF5 driver handles NISAR only from version 3.13.0; older versions must prepend `NETCDF:`; subdataset form `HDF5:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH`; the guide's config block is in Section 4, R8 | CONFIRMED | docs | `$FC/run2/dl/docs/gdal.txt:50-67,119` |
| 30 | `pip install rasterio` gives rasterio 1.5.2 bundling GDAL 3.12.2, with HDF5, netCDF, COG and GTiff drivers present | CONFIRMED | ran | `rasterio 1.5.2 \| bundled GDAL 3.12.2` / `drivers present -> HDF5: True \| netCDF: True \| COG: True \| GTiff: True` |
| 31 | ASF's loader reads `/science/LSAR/identification/listOfFrequencies`, `/science/LSAR/GCOV/grids/frequency{A,B}`, `xCoordinates`, `yCoordinates`, `projection` (cast to int as the EPSG code), and `HHHH`, `VVVV`, `HVHV`, `VHVH`, `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor`. This corroborates Section 4.4 from source code, not from a real file | CONFIRMED at source level | docs | Cookbook `util/load_gcov.py:176-196`, `util/subset_h5.py:31` |
| 32 | Level 2 projections: UTM (EPSG 32601 to 32660, 32701 to 32760) between 60 S and 60 N, 3413 north, 3031 south. GCOV spacing 10, 20 or 80 m; GUNW 80 m unwrapped and 20 m wrapped; GOFF 80 m; SME2 200 m at `/science/LSAR/SME2/grids/soilMoisture` | CONFIRMED (the per-bandwidth spacing rule was not checked) | docs | `projections.txt`, `products-overview.txt`, `product-known-issues.txt` |
| 33 | Provisional known issues match Section 4.7: ionosphere at high latitude, residual RFI, weaker frequency B calibration, 1 to 2 percent of products defocused or misplaced, tracks/frames 161/174, 161/175, 169/090, 169/091 unusable before August 2026. Two more that the brief omits: an uncalibrated 59 degree phase between polarimetric channels (off-diagonal terms only), and visible radiometric bands in joint L+S 40 MHz products. For beta, the quick-look browse images can be off by kilometres | CONFIRMED + NEW | docs | `$FC/run2/dl/docs/provisional-known-issues.txt:33-41`, `product-known-issues.txt:70` |

### 3.5 GIBS tiles
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 34 | Layer `NISAR_L2_Geocoded_Polarimetric_Covariance`, title "NISAR Normalized Radar Backscatter (False Color, GCOV, Best)", `image/png`, `GoogleMapsCompatible_Level13`, default date 2026-11-11, capabilities served with `access-control-allow-origin: *` | CONFIRMED | ran | Section 8.5 |
| 35 | The brief's tile URL with `{z}/{y}/{x}` returns a 256 x 256 PNG with `access-control-allow-origin: *` and `cache-control: max-age=0, no-store, no-cache, must-revalidate`. Swapping x and y returns HTTP 200 and an empty 288-byte tile (a silent failure). Zoom 14 gives 400. The wrong matrix set gives 400 "TILEMATRIXSET is invalid for LAYER". The extension is ignored (`.jpg` returns the PNG) | CONFIRMED | ran | Section 8.6 |
| 36 | Zoom 9 to 13 tiles are unreliable | WRONG in brief (C1) | ran | Section 8.7 |
| 37 | Date ranges and the 404 behaviour | SHARPENED (C5) | ran | Section 8.5, 8.6 |
| 38 | NISAR tiles are RGB with `tRNS` (black transparent); the empty tile is 288 bytes. RGBA layers (HLS, RTC-S1) use a 334-byte empty tile | NEW | ran | `nisar_z8_1018_nopass.png \| size 288 \| ct 2 \| ... tRNS 000000000000 \| raw all zero`; `HLS_S30... -> 200 334 image/png` |
| 39 | The other layers exist exactly as named, on `GoogleMapsCompatible_Level12` as PNG; MODIS Terra on `Level9` as JPEG (`.jpg` and `.jpeg` both work). Last date ranges: RTC-S1 2026-01-05 to 2026-11-13; DSWx-S1 2025-10-24 to 2026-11-13; DSWx-HLS 2025-08-08 to 2026-11-05; DIST-ALERT-HLS 2026-02-10 to 2026-11-05; HLS S30 2026-03-02 to 2026-11-06; HLS L30 2026-03-02 to 2026-11-05; MODIS 2025-11-10 to 2026-11-14 | CONFIRMED | ran | Section 8.5 |
| 40 | Also on GIBS: `OPERA_L3_DIST-ANN-HLS_Color_Index`, and vector-tile layers `OrbitTracks_NISAR_Ascending` and `OrbitTracks_NISAR_Descending` (`.mvt`, `GoogleMapsCompatible_Level6`, 2025-07-30 to 2026-11-13). No OPERA layer on GIBS is derived from NISAR | NEW | ran | `All OPERA layer ids: [...]` in Section 8.5 |
| 41 | Worldview offers the layer as daily and rolling 12-day mosaics with time slider, 12-day custom step, GIF animation, and a comparison tool with swipe, opacity and spy modes; NISAR layers are unavailable in the polar views | CONFIRMED + NEW | docs | `$FC/run2/dl/docs/worldview.txt` |

### 3.6 Browse previews
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 42 | `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/<collection>/<granule>/<granule>_LATLON.png` answers 303 to a signed CloudFront URL (`cache-control: private, max-age=3540`), then 200. Both hops send `access-control-allow-origin: *`. Content type `binary/octet-stream`, `accept-ranges: bytes`. The image is 1880 x 1847, 4,247,472 bytes, about 181 m per pixel; the thumbnail is 100 x 100 | CONFIRMED | ran | `final_status=200 redirects=1 size=4247472 ctype=binary/octet-stream` |
| 43 | Black is declared transparent in the PNG | WRONG in brief (C6) | ran | see C6 |
| 44 | D4's formula reproduces the brief's extent on the 2026-10-17 granule to within half a pixel: west 102.3866, east 105.5272, north 14.3421, south 11.3323 (brief: 102.3865, 105.5270, 14.3420, 11.3330) | CONFIRMED | ran | `D4 formula -> west 102.3866 east 105.5272 north 14.3421 south 11.3323` |
| 45 | For a provisional granule the KML is listed under `/NISAR/` (login) and `/BROWSE/..._LATLON.kml` is 404. For the validated granule CMR lists the KML under `/BROWSE/NISAR_L2_GCOV_V1/`; nobody fetched it | NEW, half open | ran + [local read] | run 1: `_LATLON.kml: http=404`; `$FC/run2/dl/tonle.json` |

### 3.7 Python stack
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 46 | On this Mac (arm64, Python 3.12.2) `pip install rasterio rio-cogeo h5py numpy pyproj asf_search earthaccess` resolves cleanly to rasterio 1.5.2, rio-cogeo 7.0.4, h5py 3.16.0, numpy 2.5.4, pyproj 3.8.0, asf_search 14.1.0, earthaccess 0.19.0, fsspec 2026.9.0, s3fs 2026.9.0, aiohttp 3.14.5, morecantile 7.1.0, pydantic 2.14.3, affine 3.0.1 | NEW | ran | pip list in Section 8.10 |
| 47 | Python 3.12 is the floor: `requires_python >=3.12` for earthaccess 0.19.0, rasterio 1.5.2, pyproj 3.8.0, numpy 2.5.4 and scipy 1.18.1 (rio-cogeo 7.0.4 needs 3.11, h5py 3.16.0 and asf-search 14.1.0 need 3.10) | NEW | docs | PyPI JSON, Section 8.10 |
| 48 | D5 as written produces a valid COG in EPSG:3857 with nodata 0 kept, overviews 2/4/8, deflate, and no valid pixel turned into 0 | CONFIRMED (C17 for the warning) | ran | `cog_validate -> (True, [], [])`; `... is a valid cloud optimized GeoTIFF` |
| 49 | D3's index arithmetic is right on a synthetic file built to Section 4.4's layout (pixel centres, y descending): the window's first value encodes the expected row and column, and the returned geotransform covers the requested box | CONFIRMED for the logic only | ran | `first value encodes (row, col) = (497, 500) == (r0, c0)? True` |

### 3.8 Web stack and hosting
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 50 | `maplibre-gl`: dist-tag `latest` is 6.18.0 (2026-11-11) and `latest-5` is 5.24.1 (2026-11-11). 6.18.0 has no `main`, only `module: dist/maplibre-gl.mjs`; 5.24.1 has `main: dist/maplibre-gl.js` | CONFIRMED | docs | npm registry, Section 8.11 |
| 51 | `@geomatico/maplibre-cog-protocol` 0.10.0 (2026-09-18), MIT, peer `maplibre-gl ^4.5.0 \|\| ^5.0.0 \|\| ^6.0.0`, depends on `geotiff ^3.0.5`. README: a COG must be in EPSG:3857 and any other projection throws; a COG without a mask band, a declared noData or an alpha sample has no transparent pixels; `#color:<colorScheme>,<minValue>,<maxValue>,<modifiers>`; `setColorFunction(cogUrl, (pixel, color, metadata) => ...)`; `locationValues(url, {latitude, longitude}, zoom?)` returns one number per band and NaN where nothing is drawn; nodata must be declared on the source before the warp | CONFIRMED | docs | `$FC/run2/dl/npm/cog_readme.md` |
| 52 | `geotiff` latest is 3.0.5 (ESM, `type: module`). `@maplibre/maplibre-gl-compare` last release 0.5.0 on 2021-08-11. `@mapbox/mapbox-gl-sync-move` 0.4.0 published 2026-11-09 (CommonJS `index.js`). `vite` latest 8.3.8 needs Node `^20.19.0 \|\| >=22.12.0`; the laptop has 22.15.0 | CONFIRMED + NEW | docs (vite: [local read]) | Section 8.11 |
| 53 | GitHub Pages answers a range request with 206 and sends `access-control-allow-origin: *` | CONFIRMED | ran | `HTTP/2 206  server: GitHub.com ... access-control-allow-origin: * accept-ranges: bytes content-range: bytes 0-99/435382` |
| 54 | GitHub limits: published site at most 1 GB; files over 100 MiB blocked (warning above 50 MiB); deployment times out after 10 minutes; soft 100 GB a month bandwidth | CONFIRMED + NEW | docs | `$FC/run2/dl/hosting/gh_pages_limits.txt:55-57`, `gh_large_files.txt:160` |
| 55 | Cloudflare Pages answers range requests with 200, not 206 (its docs say a fix is planned); single asset limit 25 MiB | CONFIRMED | docs | `$FC/run2/dl/hosting/cf_serving.txt:145`, `cf_limits.txt:158` |
| 56 | This laptop: macOS 26.6.2, arm64, Node 22.15.0, npm 10.9.2, Anaconda Python 3.12.2 (base has numpy 1.26.4, h5py 3.11.0, Pillow 10.4.0), no `gdalinfo`, 33.4 GB free | CONFIRMED except disk (C13) | ran | run 1 machine check |

### 3.9 Rules, challenge page, Appendix C
| # | Fact | Status | Kind | Evidence |
|---|---|---|---|---|
| 57 | Dates: submission opens Saturday 14 November at 9:00 a.m. and closes Sunday 15 November at 11:59 p.m., both in the time zone of the team's Local Event. Teams have at most six members | CONFIRMED | docs [local read] | `research/evidence/rules/project-submission-guide.txt` |
| 58 | The brief's quoted rule sentences are in the saved rule pages word for word: the AI-use rules (own idea, where-and-how disclosure, watermark, text-and-metadata acknowledgement, the "SI" term, no NASA branding in generated content), the five judging criteria, the advice on presentation, the sentence on judges relying on the project page, the 7-slide or 30-second demo limit and the Global Judging consequence, the form questions, the one-NASA-resource requirement, the no-login requirement for links, and the no-early-start sentence. Also present: English subtitles for a video in another language, the Apache 2.0 default licence, the FortiGuard form | CONFIRMED | docs (script output plus [local read] for six quotes the script missed because the brief puts a comma or full stop inside the quotation marks) | `$FC/run2/scripts/quotes.py` output; saved rule pages |
| 59 | The live challenge page returns 200 and contains the three statement quotes in Section 0 word for word, and names the features listed in Section 1.1 (change-detection maps, time-series animations, dashboards, image sliders, web maps, story map, personal context) | CONFIRMED | ran | `$FC/run2/dl/sa/challenge_statement.txt` |
| 60 | The live Resources tab has 14 links (Section 8.12); all 15 Appendix C URLs and the two "also worth knowing" GitHub URLs return 200 | CONFIRMED, one entry missing (C18) | ran | Section 8.12 |
| 61 | Page content checks: StoryMaps page lists Floods, Wildfires, Oil Slicks, Glacial Motion, Land Subsidence; the white papers are two-page briefs; ARSET lists the surface-water SAR training for Oct. 20-27, 2026 and the NISAR surface-displacement training for Nov. 12-19, 2026; the SAR intro ties double bounce to HH and volume scattering to the cross-polarized channels; the Cookbook repo is Apache-2.0, pushed 2026-11-14, and contains the two notebooks and `util/load_gcov.py` named in the brief | CONFIRMED | ran + docs | `$FC/run2/dl/appc/*.txt`, `$FC/run2/dl/cookbook/` |

## 4. Recommendations that follow

| # | Decision | Choice | Why |
|---|---|---|---|
| R1 | Zoom range for the GIBS NISAR quick-look layer | Give the raster source `maxzoom: 8` so the map overzooms good tiles, or probe a tile with the classifier in `gibs_survey.py` before trusting zoom 9 to 13 for a place and date. Do not make the zoomed-in view depend on this layer. (The `maxzoom: 8` workaround was not itself tried in MapLibre.) | 30 of 30 tiles good at zoom 3 to 8; 14 of 25 bad at zoom 9 to 13, all five at zoom 13; results change between requests |
| R2 | Dates for the GIBS layer | Dates from CMR, as the brief says, and also drop any date outside the five capability ranges (2026-03-02, 03-03, 03-30, 03-31, 04-13, 07-28 to 08-09, and after the layer's current end). Re-read the capabilities for the end date. Detect "no pass" by content, not status: 288 bytes for this layer | Out-of-range dates return 404, in-range dates without a pass return 200 and an empty tile, and swapped x/y also returns the empty tile |
| R3 | No-login imagery sharper than 600 m | Use the public browse PNGs: `_LATLON.png` (about 181 m per pixel) placed with D4, or the per-polarization `_NATIVE_A_HHHH.png` and `_NATIVE_A_HVHV.png`. Load them as they are; the collar is already transparent. Fetch as a blob because the content type is `binary/octet-stream`. Always start from the `nisar.asf.earthdatacloud.nasa.gov/BROWSE/...` URL, never a stored redirect target | Verified public with cross-origin headers on both hops; the signed redirect is cached for only 3540 s; `tRNS` makes black transparent |
| R4 | Picking URLs out of a CMR entry | Data: `l.rel.endsWith('/data#') && l.href.startsWith('https') && l.href.endsWith('.h5')`. Previews: `l.rel.endsWith('/browse#') && l.href.startsWith('https')`, then choose by suffix (`_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE*.png`) | `metadata#` ends in `data#`; inherited collection links share the `data#` rel; there are 7 https browse links per granule |
| R5 | Building a date list for a stack | Per stack and start date keep validated over provisional over beta, then the highest counter; expect several granules for one date (partial frames); require a frequency-A mode (not `0005`, polarization code not starting `NA`) if 10 or 20 m data is needed; check the polarization of every date. Re-run the coverage query just before freezing the list | 26 percent partial frames, 2,058 re-issued granules, 29 percent frequency-B-only granules, mixed `HH/HH+HV` stacks, and the validated back-fill still adding dates |
| R6 | Python environment | Python 3.12 or newer for everyone. `python -m venv .venv` then `pip install rasterio rio-cogeo h5py numpy pyproj asf_search earthaccess`, pinned to rasterio 1.5.2, rio-cogeo 7.0.4, h5py 3.16.0, numpy 2.5.4, pyproj 3.8.0, asf_search 14.1.0, earthaccess 0.19.0 (scipy 1.18.1 was not in the test install) | That exact set installed and imported together on this laptop; five of the packages refuse Python below 3.12 |
| R7 | Cache setting for partial reads over HTTPS | Start with D3 as written (`blockcache`, 8 MB) and, in the bake-off, also time `cache_type="background"` with 8 and 16 MB. Never the fsspec default. Keep one open reader per file | The benchmark shows about 25 times faster than the default but was measured in-region on S3; ASF's notebooks and guide use `background`; the gist notes the cache persists across operations on one reader |
| R8 | GDAL route with the pip wheels | rasterio's GDAL is 3.12.2, so use the older form `NETCDF:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH`, with the guide's options: `GDAL_HTTP_NETRC=YES`, `GDAL_HTTP_COOKIEFILE=/tmp/gdal_cookies.txt`, `GDAL_HTTP_COOKIEJAR=/tmp/gdal_cookies.txt`, `CPL_VSIL_CURL_CHUNK_SIZE=2097152`, `CPL_VSIL_CURL_CACHE_SIZE=67108864`, `GDAL_CACHEMAX=64000000`, `GDAL_DISABLE_READDIR_ON_OPEN=TRUE`, `GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES`, `GDAL_HTTP_MULTIPLEX=YES`, `GDAL_NUM_THREADS=ALL_CPUS`. For a window, `gdal_translate -projwin` is the guide's fastest route. Untested here | The guide: HDF5 driver support starts at 3.13.0; both HDF5 and netCDF drivers are in the wheel |
| R9 | Reprojection | Always warp to EPSG:3857 in the pipeline, whichever access path wins | Harmony does not offer 3857 and the COG library throws on anything else |
| R10 | Writing COGs | Use D5's call unchanged; ignore the deprecation warning for the weekend. Set nodata 0 on the source first. If tile loading is slow, try 256 x 256 blocks (`prof = cog_profiles.get("deflate"); prof.update(blockxsize=256, blockysize=256)`; this variant was not run) | D5 ran and validated; the README recommends 256-pixel blocks and says a warp does not carry `-dstnodata` into the file |
| R11 | `asf_search` filters | Always pass `dataMaturity` (`'PROVISIONAL'` or `'VALIDATED'`). Keeping `productionConfiguration='PR'` is harmless | Without `dataMaturity` the search mixes in beta and urgent-response products |
| R12 | What the app says about releases | Label each date with its release (CRID P05023 or P05036) and check a stable target across the 2026-10-21 boundary, as the brief says. Word the source claim as "ASF advises caution when combining BETA with PROVISIONAL products" | That is what the guide actually says (C3) |
| R13 | Legend for the GIBS layer | Use the guide's key: red and blue from co-pol, green from cross-pol; vegetation green, urban or sparse vegetation orange to yellow, calm water, dry sand and frozen ground blue, rough water possibly red; single-pol scenes use a different colour bar | Official layer documentation |
| R14 | npm installs | `maplibre-gl@5.24.1` by exact version (a bare install gives 6.18.0), `@geomatico/maplibre-cog-protocol@0.10.0`, `@mapbox/mapbox-gl-sync-move@0.4.0`; Vite 8.3.8 is fine on Node 22.15.0 | Registry dist-tags; v6 ships no `main` entry; the COG library's peer range covers 4.5 to 6 |
| R15 | Stepping through dates with the COG library | Two documented idioms: after `setColorFunction(url, fn)`, `map.removeLayer(id)` then `map.addLayer(...)` to refresh; and the README's `examples/timeseries.html` animates the bands of one multi-band COG this way. `locationValues` returns NaN for nodata, so test with `Number.isNaN` | README text; tiles already rendered are not recoloured otherwise |
| R16 | Newest dates | Do not promise anything after 2026-11-11 from the standard collections, and treat 10-31 onward as incomplete. If the concept needs this week's passes, the urgent-response collection has them, with lower-quality orbits and 30-day retention; say so in the app | 36 to 72 hour latency plus the back-fill; UR granules exist to 2026-11-13T23:58Z |
| R17 | Hosting | GitHub Pages as planned: every file under 100 MiB, site under 1 GB, deployment under 10 minutes. No COGs on Cloudflare Pages | 206 and CORS verified live on GitHub Pages; limits from the docs |
| R18 | Disk | Plan for 33 GB free. An 11-date 20+5 MHz stack (about 21 GB) just fits; a 40+5 MHz stack does not | `df` on 13 November |
| R19 | Soil moisture, if used | Read the CRS from the file; expect EPSG:6933 at 200 m | Guide projections page |

## 5. Artifacts worth reusing

All paths absolute. Everything under `/private/tmp` can vanish; the scripts are copied in Section 9.

| Path | What | To reuse |
|---|---|---|
| `<prehackathon-repo>/research/nisar_coverage.py` | Stacks and dates at a point, no login, standard library only | `python3 nisar_coverage.py <lon> <lat> [GCOV\|GUNW\|GOFF\|GSLC\|SME2]`. The GSLC ids in it were not checked |
| `<scratch>/review/fact-checker/run2/out/coverage_a.txt` (also `coverage_b.txt`, `coverage_c.txt`, `coverage_gunw.txt`, `coverage_other.txt` beside it) | Coverage output for all 17 places and the other products, 2026-11-14 01:44 CST | Date lists per stack; validated dates were still being added |
| `<scratch>/review/fact-checker/run2/dl/tonle.json` | A real CMR `granules.json` response: 11 granules of stack 083_A_008, 276,697 bytes | Fixture for the web session's CMR parser and for D1 |
| `<scratch>/review/fact-checker/dl_cmr/mex_gunw.json` | CMR response for Mexico City GUNW pairs (28 granules) | Fixture for pair-name parsing |
| `<scratch>/review/fact-checker/scripts/cmr_ranges.py`, `.../scripts/cmr_crid.py`, `.../run2/scripts/cmr_daily.py` | First and last granule per collection, gap check, monthly and daily counts, name-pattern census | Change the collection ids or dates; `readable_granule_name[]` with `options[readable_granule_name][pattern]=true` counts names by wildcard |
| `<scratch>/review/fact-checker/run2/dl/gibs/WMTSCapabilities.xml` with `.../run2/scripts/gibs_caps.py` and `gibs_caps2.py` | GIBS capabilities (5.8 MB, 1,330 layers) and parsers that print a layer's formats, matrix set and date ranges | `python3 gibs_caps.py WMTSCapabilities.xml NISAR`; re-download the XML for today's end date |
| `<scratch>/review/fact-checker/scripts/gibs_survey.py` and `.../out/gibs_survey.txt` | Tile-health classifier (detects all-black palettes) and its findings | Pass a JSON list of `[name, lon, lat, date]`; needs Pillow and numpy |
| `<scratch>/review/fact-checker/run2/scripts/tile.py` | lon/lat to tile indices, URL builder, fetch with header capture | Change `lon, lat`, layer and dates; uses `/usr/bin/curl` |
| `<scratch>/review/fact-checker/run2/scripts/d4check.py` with `.../run2/dl/browse_latlon.png` | D4 run on a real browse PNG and its CMR polygon | Point it at another PNG and the matching CMR entry; needs Pillow and numpy |
| `<scratch>/review/fact-checker/run2/scripts/d5test.py` | D5 on a synthetic 8-bit UTM raster, with read-back checks | Replace the synthetic source with a real 8-bit GeoTIFF that has nodata 0 |
| `<scratch>/review/fact-checker/run2/scripts/d3test.py` with `.../run2/out/d3/fake_gcov.h5` | D3's window logic against a synthetic GCOV-shaped HDF5 file | Use the file-writing half as a unit-test fixture; swap `fsspec.filesystem('file')` for `earthaccess.get_fsspec_https_session()` |
| `<scratch>/review/fact-checker/run2/dl/docs/` | Text of 31 NISAR data-guide pages fetched 2026-11-14 01:49 CST (`*.txt`) | Grep instead of re-fetching: `worldview.txt`, `harmony.txt`, `gdal.txt`, `earthaccess.txt`, `provisional-known-issues.txt` |
| `<scratch>/review/fact-checker/run2/dl/cookbook/` | ASF NISAR Cookbook files (Apache-2.0): `util_load_gcov.py`, `util_subset_h5.py`, `util_aoi_coverage.py`, eight notebooks | Reference implementations of windowed GCOV reading; cite the repository if code is adapted |
| `<scratch>/review/fact-checker/run2/dl/gist/nisar-remote-read-benchmark.ipynb` | The read benchmark the brief cites | Source for the cache settings and `driver_kwds` |
| `<scratch>/review/fact-checker/run2/dl/npm/cog_readme.md` | README of `@geomatico/maplibre-cog-protocol` 0.10.0 | API reference for the web session |
| `<scratch>/review/fact-checker/run2/dl/sa/challenge_statement.txt` | The live challenge statement and Resources text | Quote source for the project page |
| `<scratch>/review/fact-checker/run2/dl/tiles/` and `.../dl_tiles/` | Sample tiles, including the broken `ts_z9.png` and `ts_z13.png` | Test images for a tile-health check |

Data URLs that worked (all without login):
- `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=104.05,12.95&page_size=2000&attribute[]=string,STACK_ID,083_A_008` (with curl, add `-g`)
- `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=<id>&temporal=<t0>,<t1>&page_size=0` and read the `CMR-Hits` header
- `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`
- `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/8/118/201.png`
- `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png`
- `https://pages.github.com/images/dashboard@2x.png` (range-request test target)

## 6. Things that were tried and did not work

| Tried | Outcome |
|---|---|
| GIBS NISAR tiles at zoom 9 to 13 | Intermittently broken: all-black palette PNGs, grayscale-alpha tiles, one `HTTP Error 500: Internal Server Error` |
| GIBS tile at zoom 14 | `400 Bad Request` (HTML body) |
| GIBS tile with `GoogleMapsCompatible_Level12` for the NISAR layer, and for MODIS | 400 with `<Exception exceptionCode="InvalidParameterValue" locator="TILEMATRIXSET"><ExceptionText>TILEMATRIXSET is invalid for LAYER</ExceptionText>` |
| GIBS tile for 2026-08-01, 2026-11-12, 2026-11-13 | `404 Not Found` (HTML body) |
| GIBS tile with x and y swapped | HTTP 200 and the empty 288-byte tile: no error to catch |
| `/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/<granule>/<granule>_LATLON.kml` | `http=404` |
| `/NISAR/.../<granule>_LATLON.kml`, `.h5`, `_QA_SUMMARY.csv`, `_QA_REPORT.pdf`, `.h5.iso.xml` without login | `HTTP/2 302` to `https://urs.earthdata.nasa.gov/oauth/authorize?...` |
| `curl -w "$p status=..."` where `$p` begins with `@` (scoped npm package names) | `curl: option -w: error encountered when reading a file`, then `FileNotFoundError: ... 'dl/npm/_geomatico_maplibre-cog-protocol.json'`. Fixed by not starting the `-w` string with `@` |
| Plain HTML-to-text of the Space Apps challenge page and challenge list | 1,143 characters and `challenge links: 0`: the content is client-rendered. Worked after decoding the `self.__next_f.push([1,"..."])` chunks in the HTML |
| `quotes.py` exact matching of the brief's quotes | Six false "NOT FOUND" results, because the brief puts a trailing comma or full stop inside the quotation marks |
| Searching the Cookbook for `blockcache` | No hit in any notebook or module; they all use `cache_type = "background"` |
| Searching the ARSET landing page for "Harnessing", the UAVSAR postcards page for "Courtesy" or "NASA/JPL", the RADARSAT-1 page for `s3://` | No match |
| Searching the data guide for the EULA name | No match in the guide; it is in the Cookbook |
| `cog_translate(..., web_optimized=True)` | Works, with `DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option` |
| `mcp__ccd_turn__update_plan` from the subagent | `hook error: Not shown: you are a subagent` (harmless) |
| The runs themselves | Run 1: "You've hit your 5-hour limit · resets 1:40am". Run 2: "You've hit your 5-hour limit · resets 6:40am". Run 3: "You've hit your Fable limit · resets 2pm" before any work |

## 7. Open questions the runs did not settle

1. Step 1 of the fact-checker's task, the claim-by-claim comparison of the brief with `CHECKPOINT.md`, was never reported.
2. Appendix B (events, dates, "data found", and its ten source URLs) was not checked by either run.
3. Section 4.4 is still unverified against a real file: dataset names are corroborated only by ASF's loader source. Not checked at all: the mask values (0, 1 to 5, 255), the chunking and "4 MiB metadata pages", the GUNW dataset paths, `FULL_FRAME` and `PRODUCTION_PIPELINE` attributes.
4. No authenticated read was made. Unknown: how long a windowed read takes over HTTPS from this network, whether `blockcache` beats `background` there, whether a Harmony job is quick, whether rasterio's GDAL 3.12.2 reads a NISAR subdataset through `NETCDF:"/vsicurl/..."` with netrc cookies.
5. Why GIBS zoom 9 to 13 tiles break, whether it is still happening, and whether the `epsg4326` endpoint, WMS, or the other layers behave better. Only the NISAR layer was sampled above zoom 8.
6. Whether a validated granule's `_LATLON.kml`, which CMR lists under the public `/BROWSE/` path, can be fetched without login. If so, D4's fitting step is unnecessary for validated dates.
7. The capabilities advertise a "Domains" resource (`.../1.0.0/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{TileMatrixSet}/{BBOX}/all.xml`) that may list dates with data for a bounding box. Not tried.
8. MapLibre 6 claims (no default export, WebGL2 required, `setWorkerUrl()`), "maplibre-gl-compare breaks with ESM builds", and whether the COG library works with 5.24.1 or 6.18.0 in a Vite build: not run by this lens.
9. Not checked: Vercel, Netlify, Hugging Face and GitHub-release-asset behaviour; Python's built-in server and range requests; the OpenFreeMap style URLs; conda-forge `libgdal-hdf5`; `login()` having to be called explicitly; GSLC collection ids and sizes; the pixel spacing per bandwidth (77 MHz giving 20 m); the frame pixel dimensions; "seams show between tracks"; OPERA-from-NISAR availability beyond its absence on GIBS; "Production paused from 23 October to 6 November".
10. 24 provisional GCOV granules do not match `*_P05023_*`, and 6,314 match neither `_N_F_J_` nor `_N_P_J_`: what their CRID and orbit flag are was not looked at.
11. Rule details without support in the saved pages: the "Working ahead ..." quote (source is a GitHub discussion, not re-opened) and the "JPG, PNG and GIF up to 10 MB" image limit.
12. Section 6.6 fixes the Pages base path for a repository named `NASA-space-apps-2026` (the local clone's remote is `https://github.com/runny24/NASA-space-apps-2026.git`). Confirm that this is the repository the team calls official before setting Vite's `base`.
13. D1 and D2 (the JavaScript sketches) were not executed by this lens.

## 8. Raw outputs (machine output only, copied from the saved files and transcripts)

`$FC` is the fact-checker scratch folder named in Section 0. Transcript line numbers are zero-based line indices in the `.jsonl` file. Some long lines are cut.


### 8.1 The brief's CMR query (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 110; first lines, link list cut)

````
exit=0
HTTP/2 200 
content-type: application/json;charset=utf-8
access-control-allow-origin: *
cmr-search-after: ["asf",1793313394000,4407934813]
cmr-hits: 11
access-control-expose-headers: CMR-Hits, CMR-Request-Id, X-Request-Id, CMR-Scroll-Id, CMR-Search-After, CMR-Timed-Out, CMR-Shapefile-Original-Point-Count, CMR-Shapefile-Simplified-Point-Count
cmr-took: 41
entries 11
keys ['browse_flag', 'collection_concept_id', 'coordinate_system', 'data_center', 'dataset_id', 'day_night_flag', 'granule_size', 'id', 'links', 'online_access_flag', 'orbit_calculated_spatial_domains', 'original_format', 'polygons', 'producer_granule_id', 'time_end', 'time_start', 'title', 'updated']
NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001 2026-06-19T22:36:37.000Z 1777.8144416809082 C2854338529-ASF
NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001 2026-07-01T22:36:36.000Z 1822.1190118789673 C2854338529-ASF
NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001 2026-07-13T22:36:36.000Z 1777.733983039856 C2854338529-ASF
NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001 2026-07-25T22:36:35.000Z 1773.7372798919678 C2854338529-ASF
NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001 2026-08-18T22:36:34.000Z 1777.774748802185 C2854338529-ASF
NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001 2026-08-30T22:36:33.000Z 1822.0899095535278 C2854338529-ASF
NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001 2026-09-11T22:36:33.000Z 1826.1750535964966 C2854338529-ASF
NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001 2026-09-23T22:36:33.000Z 1826.3813009262085 C2854338529-ASF
NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001 2026-10-05T22:36:33.000Z 1826.2941913604736 C2854338529-ASF
NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 2026-10-17T22:36:33.000Z 1826.3494901657104 C2854338529-ASF
NISAR_L2_PR_GCOV_034_083_A_008_2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001 2026-10-29T22:36:34.000Z 1777.87868309021 C3622241360-ASF
polygons repr: [['12.07019 105.39936 14.15457 104.89399 13.61372 102.62722 11.53813 103.14859 12.07019 105.39936']]
   http://esipfed.org/ns/fedsearch/1.1/data# | https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5 | None | Download N
   http://esipfed.org/ns/fedsearch/1.1/s3# | s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001.h5 | None | This link provides di
   http://esipfed.org/ns/fedsearch/1.1/browse# | https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001/NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001_LATLON.png | None |
````

The remaining 49 links of that entry are in `$FC/run2/dl/tonle.json`.


### 8.2 Coverage for the 17 places of Appendix A (GCOV): one line per stack

From `$FC/run2/out/coverage_a.txt`, `coverage_b.txt`, `coverage_c.txt` (2026-11-14 01:43 to 01:44 CST). The files also hold the full date list of every stack. `releases` counts granules. In the date lists a date printed without a year belongs to the year of the stack's first date (2025 when the span starts in 2025, otherwise 2026).

````
### Mexico City (-99.1, 19.4) 
  019_A_011   31 dates  2025-10-30 .. 2026-11-06  pol=HH+HV  bw=40+5 MHz  ~6992 MB/file  releases={'B': 6, 'P': 29, 'V': 2}
  113_D_079   28 dates  2025-10-25 .. 2026-10-20  pol=HH+HV  bw=40+5 MHz  ~7151 MB/file  releases={'B': 8, 'P': 28}
### Kilauea (-155.28, 19.41) 
  072_D_079   29 dates  2025-10-22 .. 2026-11-10  pol=HH+HV  bw=40+5 MHz  ~2844 MB/file  releases={'B': 7, 'P': 27, 'V': 2}
  151_A_011   28 dates  2025-11-08 .. 2026-11-03  pol=HH+HV  bw=40+5 MHz  ~2642 MB/file  releases={'B': 6, 'P': 27, 'V': 2}
### Tonle Sap (104.05, 12.95) 
  083_A_008   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 10, 'V': 1}
  148_D_082   11 dates  2026-06-24 .. 2026-11-03  pol=HH/HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 9, 'V': 2}
### Chicago (-87.65, 41.85) 
  148_A_023   18 dates  2025-11-08 .. 2026-11-03  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8223 MB/file  releases={'B': 7, 'P': 9, 'V': 2}
  084_D_067   16 dates  2025-11-04 .. 2026-10-30  pol=HH+HV+VH+VV  bw=20+5 MHz  ~7606 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
  047_A_023   11 dates  2026-06-17 .. 2026-10-27  pol=HH+HV+VH+VV  bw=20+5 MHz  ~7944 MB/file  releases={'P': 10, 'V': 1}
  148_A_022    1 dates  2026-06-24 .. 2026-06-24  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8095 MB/file  releases={'P': 1}
### Central Valley (-119.56, 36.1) 
  034_A_020   27 dates  2025-11-24 .. 2026-10-26  pol=HH+HV  bw=40+5 MHz  ~7109 MB/file  releases={'B': 3, 'P': 26, 'V': 1}
  114_D_070   24 dates  2025-11-30 .. 2026-10-20  pol=?/HH+HV  bw=40+5/5 MHz  ~7244 MB/file  releases={'B': 4, 'P': 25}
### Reykjanes (-22.4, 63.88) 
  082_D_056   28 dates  2025-11-03 .. 2026-10-29  pol=HH+HV  bw=40+5 MHz  ~4849 MB/file  releases={'P': 28, 'V': 1}
  159_A_034   27 dates  2025-11-09 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~5314 MB/file  releases={'P': 28, 'V': 1}
  087_A_034   11 dates  2026-06-20 .. 2026-10-30  pol=HH+HV  bw=40+5 MHz  ~5365 MB/file  releases={'P': 10, 'V': 1}
  015_A_034   10 dates  2026-06-27 .. 2026-10-25  pol=HH+HV  bw=40+5 MHz  ~3785 MB/file  releases={'P': 9, 'V': 1}
  111_D_056    9 dates  2026-06-21 .. 2026-10-19  pol=HH+HV  bw=40+5 MHz  ~1900 MB/file  releases={'P': 9}
  010_D_056    9 dates  2026-06-26 .. 2026-10-24  pol=HH+HV  bw=40+5 MHz  ~3297 MB/file  releases={'P': 8, 'V': 1}
### Punjab (75.8, 30.6) 
  156_A_017   26 dates  2025-11-21 .. 2026-11-04  pol=HH+HV  bw=40+5 MHz  ~6942 MB/file  releases={'B': 3, 'P': 26, 'V': 2}
  034_D_073   24 dates  2025-11-24 .. 2026-11-07  pol=HH+HV/HH+HV+VH+VV  bw=20+5/40+5 MHz  ~6138 MB/file  releases={'B': 2, 'P': 30, 'V': 2}
### Atchafalaya (-91.45, 30.0) 
  084_D_073   19 dates  2025-10-23 .. 2026-10-30  pol=HH+HV  bw=40+5 MHz  ~6346 MB/file  releases={'B': 8, 'P': 10, 'V': 1}
  105_A_017   17 dates  2025-11-17 .. 2026-10-31  pol=HH+HV  bw=40+5 MHz  ~6560 MB/file  releases={'B': 6, 'P': 10, 'V': 1}
  156_D_074   16 dates  2025-11-21 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~4580 MB/file  releases={'B': 6, 'P': 10, 'V': 1}
  033_A_017   15 dates  2025-11-24 .. 2026-10-26  pol=HH+HV  bw=40+5 MHz  ~6572 MB/file  releases={'B': 5, 'P': 9, 'V': 1}
  156_D_073   11 dates  2025-11-21 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~6480 MB/file  releases={'B': 4, 'P': 7, 'V': 1}
### Grand Forks (-97.4, 47.9) 
  099_D_064   19 dates  2025-10-24 .. 2026-10-31  pol=HH+HV  bw=40+5 MHz  ~7076 MB/file  releases={'B': 8, 'P': 10, 'V': 1}
  105_A_026   18 dates  2025-10-24 .. 2026-10-19  pol=HH+HV  bw=40+5 MHz  ~6958 MB/file  releases={'B': 8, 'P': 10}
  004_A_026   16 dates  2025-10-29 .. 2026-11-05  pol=HH+HV  bw=40+5 MHz  ~7474 MB/file  releases={'B': 5, 'P': 10, 'V': 2}
  171_D_064   12 dates  2025-12-16 .. 2026-10-24  pol=HH+HV  bw=40+5 MHz  ~7403 MB/file  releases={'B': 2, 'P': 9, 'V': 1}
### Champaign (-88.3, 40.2) 
  148_A_022   18 dates  2025-11-08 .. 2026-11-03  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8196 MB/file  releases={'B': 7, 'P': 9, 'V': 2}
  084_D_068   16 dates  2025-11-04 .. 2026-10-30  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8252 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
### Jakobshavn (-49.6, 69.17) 
  170_D_053   17 dates  2025-10-28 .. 2026-10-23  pol=HH  bw=77 MHz  ~935 MB/file  releases={'B': 7, 'P': 10, 'V': 1}
  069_D_053   16 dates  2025-11-14 .. 2026-10-28  pol=HH  bw=77 MHz  ~935 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
  059_A_037   15 dates  2025-11-26 .. 2026-10-28  pol=HH  bw=77 MHz  ~893 MB/file  releases={'B': 4, 'P': 10, 'V': 1}
  131_A_037   14 dates  2025-12-13 .. 2026-11-02  pol=HH  bw=77 MHz  ~988 MB/file  releases={'B': 3, 'P': 10, 'V': 1}
### Okavango (22.9, -19.3) 
  172_A_168   15 dates  2025-11-22 .. 2026-10-24  pol=HH+HV  bw=20+5 MHz  ~1879 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
  151_D_098   10 dates  2026-06-24 .. 2026-10-22  pol=HH/HH+HV  bw=20+5 MHz  ~1934 MB/file  releases={'P': 11, 'V': 1}
### Rondonia (-63.5, -10.0) 
  068_D_094   13 dates  2025-11-02 .. 2026-10-28  pol=HH/HH+HV  bw=20+5 MHz  ~1564 MB/file  releases={'B': 2, 'P': 10, 'V': 1}
  161_A_173    9 dates  2026-06-25 .. 2026-10-23  pol=HH+HV  bw=20/20+5 MHz  ~1959 MB/file  releases={'P': 11, 'V': 1}
  161_A_172    4 dates  2026-06-25 .. 2026-08-24  pol=HH+HV  bw=20+5 MHz  ~1942 MB/file  releases={'P': 4}
  169_D_093    3 dates  2026-07-07 .. 2026-10-11  pol=HH+HV  bw=20+5 MHz  ~2005 MB/file  releases={'P': 3}
### Sudd (30.7, 7.5) 
  050_D_085   11 dates  2026-06-17 .. 2026-10-27  pol=HH/HH+HV  bw=20+5 MHz  ~1812 MB/file  releases={'P': 10, 'V': 1}
  086_A_005   10 dates  2026-06-20 .. 2026-10-18  pol=HH/HH+HV  bw=20+5 MHz  ~1822 MB/file  releases={'P': 10}
### Mekong Delta (105.6, 10.0) 
  047_D_083   11 dates  2026-06-17 .. 2026-10-27  pol=HH+HV  bw=40+5 MHz  ~6359 MB/file  releases={'P': 10, 'V': 1}
  047_D_084   11 dates  2026-06-17 .. 2026-10-27  pol=HH/HH+HV  bw=20+5/40+5 MHz  ~1363 MB/file  releases={'P': 20, 'V': 2}
  083_A_006   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5/40+5 MHz  ~1145 MB/file  releases={'P': 20, 'V': 2}
  083_A_007   10 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=40+5 MHz  ~5914 MB/file  releases={'P': 9, 'V': 1}
### Mamiraua (-65.0, -2.7) 
  097_D_090   10 dates  2025-11-04 .. 2026-10-06  pol=?/HH/HH+HV  bw=20+5/5 MHz  ~1497 MB/file  releases={'B': 1, 'P': 9}
  161_A_176    9 dates  2026-06-25 .. 2026-10-23  pol=HH+HV  bw=20/20+5 MHz  ~1892 MB/file  releases={'P': 12, 'V': 1}
### Pantanal (-57.2, -17.3) 
  111_D_097    9 dates  2026-06-21 .. 2026-10-19  pol=HH/HH+HV  bw=20+5 MHz  ~1925 MB/file  releases={'P': 9}
  132_A_169    9 dates  2026-07-05 .. 2026-10-21  pol=HH+HV  bw=20+5 MHz  ~1934 MB/file  releases={'P': 9}
````

Full date lists for the stack the brief names at each place (same files):

````
Mexico City (-99.1, 19.4)   019_A_011  (31 dates)
  10-30 11-11 11-23 12-05 12-17 12-29 2026-01-10 2026-01-22 2026-02-03 2026-02-15 2026-02-27 2026-03-11 2026-03-23 2026-04-04 2026-04-16 2026-04-28 2026-05-10 2026-05-22 2026-06-03 2026-06-15 2026-06-27 2026-07-09 2026-07-21 2026-08-14 2026-08-26 2026-09-07 2026-09-19 2026-10-01 2026-10-13 2026-10-25 2026-11-06
Kilauea (-155.28, 19.41)   072_D_079  (29 dates)
  10-22 11-03 11-15 11-27 12-09 12-21 2026-01-02 2026-01-14 2026-01-26 2026-02-07 2026-02-19 2026-03-15 2026-03-27 2026-04-08 2026-04-20 2026-05-02 2026-05-14 2026-05-26 2026-06-19 2026-07-01 2026-07-13 2026-08-18 2026-08-30 2026-09-11 2026-09-23 2026-10-05 2026-10-17 2026-10-29 2026-11-10
Tonle Sap (104.05, 12.95)   083_A_008  (11 dates)
  06-19 07-01 07-13 07-25 08-18 08-30 09-11 09-23 10-05 10-17 10-29
Chicago (-87.65, 41.85)   148_A_023  (18 dates)
  11-08 11-20 12-02 12-14 12-26 2026-01-07 2026-01-19 2026-06-24 2026-07-06 2026-07-18 2026-08-11 2026-08-23 2026-09-04 2026-09-16 2026-09-28 2026-10-10 2026-10-22 2026-11-03
Central Valley (-119.56, 36.1)   034_A_020  (27 dates)
  11-24 12-06 12-18 12-30 2026-01-11 2026-01-23 2026-02-04 2026-02-16 2026-02-28 2026-03-12 2026-03-24 2026-04-05 2026-04-17 2026-04-29 2026-05-11 2026-05-23 2026-06-04 2026-06-16 2026-06-28 2026-07-10 2026-07-22 2026-08-15 2026-08-27 2026-09-08 2026-09-20 2026-10-14 2026-10-26
Reykjanes (-22.4, 63.88)   082_D_056  (28 dates)
  11-03 11-15 11-27 12-09 12-21 2026-01-02 2026-01-14 2026-01-26 2026-02-07 2026-02-19 2026-03-15 2026-04-08 2026-04-20 2026-05-02 2026-05-14 2026-05-26 2026-06-07 2026-06-19 2026-07-01 2026-07-13 2026-07-25 2026-08-18 2026-08-30 2026-09-11 2026-09-23 2026-10-05 2026-10-17 2026-10-29
Reykjanes (-22.4, 63.88)   159_A_034  (27 dates)
  11-09 11-21 12-03 12-15 12-27 2026-01-08 2026-01-20 2026-02-13 2026-02-25 2026-03-09 2026-03-21 2026-04-02 2026-04-26 2026-05-08 2026-05-20 2026-06-01 2026-06-13 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23
Punjab (75.8, 30.6)   156_A_017  (26 dates)
  11-21 12-03 12-15 12-27 2026-01-08 2026-01-20 2026-02-01 2026-02-25 2026-03-09 2026-03-21 2026-04-26 2026-05-08 2026-05-20 2026-06-01 2026-06-13 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23 2026-11-04
Atchafalaya (-91.45, 30.0)   084_D_073  (19 dates)
  10-23 11-04 11-16 11-28 12-10 12-22 2026-01-03 2026-01-15 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06 2026-10-18 2026-10-30
Grand Forks (-97.4, 47.9)   099_D_064  (19 dates)
  10-24 11-05 11-17 11-29 12-11 12-23 2026-01-04 2026-01-16 2026-06-21 2026-07-03 2026-07-15 2026-07-27 2026-08-20 2026-09-01 2026-09-13 2026-09-25 2026-10-07 2026-10-19 2026-10-31
Champaign (-88.3, 40.2)   148_A_022  (18 dates)
  11-08 11-20 12-02 12-14 12-26 2026-01-07 2026-01-19 2026-06-24 2026-07-06 2026-07-18 2026-08-11 2026-08-23 2026-09-04 2026-09-16 2026-09-28 2026-10-10 2026-10-22 2026-11-03
Jakobshavn (-49.6, 69.17)   170_D_053  (17 dates)
  10-28 11-09 11-21 12-03 12-15 12-27 2026-01-08 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23
Okavango (22.9, -19.3)   172_A_168  (15 dates)
  11-22 12-04 12-16 12-28 2026-01-09 2026-06-26 2026-07-08 2026-07-20 2026-08-13 2026-08-25 2026-09-06 2026-09-18 2026-09-30 2026-10-12 2026-10-24
Rondonia (-63.5, -10.0)   068_D_094  (13 dates)
  11-02 11-14 2026-06-18 2026-06-30 2026-07-12 2026-07-24 2026-08-17 2026-08-29 2026-09-10 2026-09-22 2026-10-04 2026-10-16 2026-10-28
Sudd (30.7, 7.5)   050_D_085  (11 dates)
  06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
Mekong Delta (105.6, 10.0)   047_D_083  (11 dates)
  06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
Mamiraua (-65.0, -2.7)   097_D_090  (10 dates)
  11-04 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06
Pantanal (-57.2, -17.3)   111_D_097  (9 dates)
  06-21 07-03 07-15 08-20 09-01 09-13 09-25 10-07 10-19
````


### 8.3 Coverage for the other products: one line per stack

From `$FC/run2/out/coverage_gunw.txt` and `coverage_other.txt`. The two glacier coordinates were the checker's own guesses.

````
### Mexico City (-99.1, 19.4) GUNW
  019_A_011   28 dates  2025-10-30 .. 2026-10-01  pol=HH  bw=40 MHz  ~2303 MB/file  releases={'B': 5, 'P': 28}
  113_D_079   27 dates  2025-10-25 .. 2026-10-08  pol=HH  bw=40 MHz  ~2353 MB/file  releases={'B': 7, 'P': 26}
### Kilauea (-155.28, 19.41) GUNW
  072_D_079   26 dates  2025-10-22 .. 2026-10-05  pol=HH  bw=40 MHz  ~1590 MB/file  releases={'B': 6, 'P': 25}
  151_A_011   25 dates  2025-11-08 .. 2026-09-28  pol=HH  bw=40 MHz  ~1489 MB/file  releases={'B': 5, 'P': 25}
### Central Valley (-119.56, 36.1) GUNW
  034_A_020   25 dates  2025-11-24 .. 2026-09-20  pol=HH  bw=40 MHz  ~2332 MB/file  releases={'B': 2, 'P': 25}
  114_D_070   22 dates  2025-11-30 .. 2026-10-08  pol=HH  bw=40 MHz  ~2387 MB/file  releases={'B': 2, 'P': 22}
### Reykjanes (-22.4, 63.88) GUNW
  082_D_056   25 dates  2025-11-03 .. 2026-10-05  pol=HH  bw=40 MHz  ~2003 MB/file  releases={'P': 26}
  159_A_034   25 dates  2025-11-09 .. 2026-09-29  pol=HH  bw=40 MHz  ~2437 MB/file  releases={'P': 26}
  087_A_034    9 dates  2026-06-20 .. 2026-10-06  pol=HH  bw=40 MHz  ~2613 MB/file  releases={'P': 9}
  111_D_056    9 dates  2026-06-21 .. 2026-10-07  pol=HH  bw=40 MHz  ~1300 MB/file  releases={'P': 10}
  015_A_034    8 dates  2026-06-27 .. 2026-10-01  pol=HH  bw=40 MHz  ~2208 MB/file  releases={'P': 8}
  010_D_056    7 dates  2026-06-26 .. 2026-09-30  pol=HH  bw=40 MHz  ~1665 MB/file  releases={'P': 7}
### Tonle Sap (104.05, 12.95) GUNW
  083_A_008    9 dates  2026-06-19 .. 2026-10-05  pol=HH  bw=20 MHz  ~2294 MB/file  releases={'P': 9}
  148_D_082    8 dates  2026-06-24 .. 2026-09-28  pol=HH  bw=20 MHz  ~2330 MB/file  releases={'P': 8}
### Central Valley (-119.56, 36.1) SME2
  034_A_020   26 dates  2025-11-24 .. 2026-10-14  pol=HH+HV  bw=? MHz  ~128 MB/file  releases={'B': 3, 'P': 26}
  114_D_070   24 dates  2025-11-30 .. 2026-10-20  pol=?/HH+HV  bw=? MHz  ~130 MB/file  releases={'B': 4, 'P': 24}
### Punjab (75.8, 30.6) SME2
  156_A_017   24 dates  2025-11-21 .. 2026-10-11  pol=HH+HV  bw=? MHz  ~124 MB/file  releases={'B': 3, 'P': 25}
  034_D_073   19 dates  2025-11-24 .. 2026-10-02  pol=HH+HV/HH+HV+VH+VV  bw=? MHz  ~107 MB/file  releases={'B': 2, 'P': 27}
### Champaign (-88.3, 40.2) SME2
  148_A_022   16 dates  2025-11-08 .. 2026-10-10  pol=HH+HV+VH+VV  bw=? MHz  ~118 MB/file  releases={'B': 7, 'P': 9}
  084_D_068   15 dates  2025-11-04 .. 2026-10-18  pol=HH+HV+VH+VV  bw=? MHz  ~117 MB/file  releases={'B': 5, 'P': 10}
### Jakobshavn (-49.6, 69.17) GOFF
  170_D_053   14 dates  2025-10-28 .. 2026-09-29  pol=HH  bw=77 MHz  ~954 MB/file  releases={'B': 6, 'P': 9}
  069_D_053   13 dates  2025-11-14 .. 2026-10-04  pol=HH  bw=77 MHz  ~919 MB/file  releases={'B': 4, 'P': 9}
  059_A_037   12 dates  2025-11-26 .. 2026-10-04  pol=HH  bw=77 MHz  ~937 MB/file  releases={'B': 3, 'P': 9}
  131_A_037   11 dates  2025-12-13 .. 2026-10-09  pol=HH  bw=77 MHz  ~942 MB/file  releases={'B': 2, 'P': 9}
### Pine Island Glacier (my guess at coords) (-100.0, -75.17) GOFF
  149_A_140   15 dates  2025-10-27 .. 2026-09-28  pol=HH  bw=40/77 MHz  ~1037 MB/file  releases={'B': 14, 'P': 8}
  120_A_140   13 dates  2025-10-25 .. 2026-10-08  pol=HH  bw=40/77 MHz  ~1178 MB/file  releases={'B': 6, 'P': 8}
  083_D_126   13 dates  2025-11-03 .. 2026-10-05  pol=HH  bw=40/77 MHz  ~1089 MB/file  releases={'B': 5, 'P': 9}
  048_A_140   12 dates  2025-11-01 .. 2026-10-03  pol=HH  bw=40/77 MHz  ~1204 MB/file  releases={'B': 4, 'P': 9}
  011_D_126   12 dates  2025-11-22 .. 2026-09-30  pol=HH  bw=40/77 MHz  ~919 MB/file  releases={'B': 9, 'P': 8}
  040_D_126    9 dates  2026-06-17 .. 2026-10-03  pol=HH  bw=40 MHz  ~1072 MB/file  releases={'P': 9}
  091_A_140    9 dates  2026-06-20 .. 2026-10-06  pol=HH  bw=40 MHz  ~780 MB/file  releases={'P': 9}
  112_D_126    8 dates  2026-06-22 .. 2026-10-08  pol=HH  bw=40 MHz  ~1066 MB/file  releases={'P': 8}
  019_A_140    8 dates  2026-06-27 .. 2026-10-01  pol=HH  bw=40 MHz  ~1185 MB/file  releases={'P': 9}
### Hubbard Glacier (my guess at coords) (-139.5, 60.02) GOFF
  101_D_058   15 dates  2025-10-24 .. 2026-10-07  pol=HH  bw=40 MHz  ~1422 MB/file  releases={'B': 6, 'P': 10}
  029_D_058   14 dates  2025-10-19 .. 2026-10-02  pol=HH  bw=40 MHz  ~1257 MB/file  releases={'B': 6, 'P': 8}
  173_D_058   14 dates  2025-10-29 .. 2026-09-30  pol=HH  bw=40 MHz  ~1366 MB/file  releases={'B': 6, 'P': 8}
  063_A_032   14 dates  2025-11-14 .. 2026-10-04  pol=HH  bw=40 MHz  ~1329 MB/file  releases={'B': 5, 'P': 9}
  164_A_032   12 dates  2025-11-09 .. 2026-09-29  pol=HH  bw=40 MHz  ~1252 MB/file  releases={'B': 4, 'P': 9}
````

Mexico City interferogram pairs, stack 019_A_011 (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 106):

````
28 granules
NISAR_L2_PR_GUNW_004_019_A_011_005_4000_SH_20251030T120539_2 20251030 -> 20251111 12 days 2202 MB
NISAR_L2_PR_GUNW_005_019_A_011_006_4000_SH_20251111T120539_2 20251111 -> 20251123 12 days 2181 MB
NISAR_L2_PR_GUNW_006_019_A_011_007_4000_SH_20251123T120540_2 20251123 -> 20251205 12 days 2169 MB
NISAR_L2_PR_GUNW_007_019_A_011_008_4000_SH_20251205T120540_2 20251205 -> 20251217 12 days 2177 MB
NISAR_L2_PR_GUNW_008_019_A_011_009_4000_SH_20251217T120541_2 20251217 -> 20251229 12 days 2165 MB
NISAR_L2_PR_GUNW_009_019_A_011_010_4000_SH_20251229T120541_2 20251229 -> 20260110 12 days 2177 MB
NISAR_L2_PR_GUNW_010_019_A_011_011_4000_SH_20260110T120542_2 20260110 -> 20260122 12 days 2165 MB
NISAR_L2_PR_GUNW_011_019_A_011_012_4000_SH_20260122T120542_2 20260122 -> 20260203 12 days 2221 MB
NISAR_L2_PR_GUNW_012_019_A_011_013_4000_SH_20260203T120543_2 20260203 -> 20260215 12 days 2165 MB
NISAR_L2_PR_GUNW_013_019_A_011_014_4000_SH_20260215T120544_2 20260215 -> 20260227 12 days 2161 MB
NISAR_L2_PR_GUNW_014_019_A_011_015_4000_SH_20260227T120544_2 20260227 -> 20260311 12 days 2169 MB
NISAR_L2_PR_GUNW_015_019_A_011_016_4000_SH_20260311T120544_2 20260311 -> 20260323 12 days 2225 MB
NISAR_L2_PR_GUNW_016_019_A_011_017_4000_SH_20260323T120544_2 20260323 -> 20260404 12 days 2178 MB
NISAR_L2_PR_GUNW_017_019_A_011_018_4000_SH_20260404T120545_2 20260404 -> 20260416 12 days 2190 MB
NISAR_L2_PR_GUNW_018_019_A_011_019_4000_SH_20260416T120544_2 20260416 -> 20260428 12 days 2225 MB
NISAR_L2_PR_GUNW_019_019_A_011_020_4000_SH_20260428T120544_2 20260428 -> 20260510 12 days 2218 MB
NISAR_L2_PR_GUNW_020_019_A_011_021_4000_SH_20260510T120543_2 20260510 -> 20260522 12 days 2206 MB
NISAR_L2_PR_GUNW_021_019_A_011_022_4000_SH_20260522T120543_2 20260522 -> 20260603 12 days 2226 MB
NISAR_L2_PR_GUNW_022_019_A_011_023_4000_SH_20260603T120542_2 20260603 -> 20260615 12 days 2258 MB
NISAR_L2_PR_GUNW_023_019_A_011_024_4000_SH_20260615T120541_2 20260615 -> 20260627 12 days 2230 MB
NISAR_L2_PR_GUNW_024_019_A_011_025_4000_SH_20260627T120541_2 20260627 -> 20260709 12 days 2222 MB
NISAR_L2_PR_GUNW_025_019_A_011_026_4000_SH_20260709T120540_2 20260709 -> 20260721 12 days 2258 MB
NISAR_L2_PR_GUNW_026_019_A_011_028_4000_SH_20260721T120539_2 20260721 -> 20260814 24 days 2262 MB
NISAR_L2_PR_GUNW_028_019_A_011_029_4000_SH_20260814T120538_2 20260814 -> 20260826 12 days 2218 MB
NISAR_L2_PR_GUNW_029_019_A_011_030_4000_SH_20260826T120538_2 20260826 -> 20260907 12 days 2222 MB
NISAR_L2_PR_GUNW_030_019_A_011_031_4000_SH_20260907T120538_2 20260907 -> 20260919 12 days 2222 MB
NISAR_L2_PR_GUNW_031_019_A_011_032_4000_SH_20260919T120538_2 20260919 -> 20261001 12 days 2222 MB
NISAR_L2_PR_GUNW_032_019_A_011_033_4000_SH_20261001T120538_2 20261001 -> 20261013 12 days 2202 MB
````


### 8.4 CMR counts and date ranges

`$FC/run2/out/cmr_collections.txt` (2026-11-14 01:43 CST):

````
C3622241360-ASF hits=14683  NISAR_L2_GCOV_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Validated Geocoded Polarimetric Covariance Product (Version 1)
C2854338529-ASF hits=163672  NISAR_L2_GCOV_PROVISIONAL_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Provisional Geocoded Polarimetric Covariance Product (Version 1)
C3622214170-ASF hits=23527  NISAR_L2_GCOV_BETA_V1 |v 1 | 2025-10-01T00:00:00.000Z .. None | NISAR Beta Geocoded Polarimetric Covariance Product (Version 1)
C3622247503-ASF hits=140  NISAR_L2_GUNW_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Validated Geocoded Unwrapped Interferogram Product (Version 1)
C2854335566-ASF hits=94150  NISAR_L2_GUNW_PROVISIONAL_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Provisional Geocoded Unwrapped Interferogram Product (Version 1)
C2850261892-ASF hits=10217  NISAR_L2_GUNW_BETA_V1 |v 1 | 2025-10-01T00:00:00.000Z .. None | NISAR Beta Geocoded Unwrapped Interferogram Product (Version 1)
C3622250865-ASF hits=32  NISAR_L2_GOFF_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Validated Geocoded Pixel Offsets (Version 1)
C2854341702-ASF hits=27717  NISAR_L2_GOFF_PROVISIONAL_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Provisional Geocoded Pixel Offsets (Version 1)
C2850263910-ASF hits=3666  NISAR_L2_GOFF_BETA_V1 |v 1 | 2025-10-01T00:00:00.000Z .. None | NISAR Beta Geocoded Pixel Offsets (Version 1)
C2854344945-ASF hits=103943  NISAR_L3_SME2_PROVISIONAL_V1 |v 1 | 2025-10-28T00:00:00.000Z .. None | NISAR Provisional Soil Moisture (Version 1)
C2850265000-ASF hits=13881  NISAR_L3_SME2_BETA_V1 |v 1 | 2025-10-01T00:00:00.000Z .. None | NISAR Beta Soil Moisture (Version 1)
````

`$FC/out/cmr_ranges.txt` (2026-11-13 21:02 CST):

````
GCOV_V C3622241360-ASF hits=14088 first=2026-10-21T17:07:21.000Z last=2026-11-11T23:35:57.000Z
    first: NISAR_L2_PR_GCOV_033_137_D_073_2005_DHDH_A_20261021T170721_20261021T170733_P05036_N_P_J_001
    last:  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001
GCOV_P C2854338529-ASF hits=163672 first=2025-10-29T11:11:30.000Z last=2026-10-21T20:37:40.000Z
    first: NISAR_L2_PR_GCOV_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001
    last:  NISAR_L2_PR_GCOV_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001
GCOV_B C3622214170-ASF hits=23527 first=2025-10-12T18:25:08.000Z last=2026-01-20T15:59:30.000Z
    first: NISAR_L2_PR_GCOV_002_109_D_063_4005_DHDH_A_20251012T182508_20251012T182531_X05010_N_P_J_001
    last:  NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001
GUNW_V C3622247503-ASF hits=140 first=2026-09-27T23:50:27.000Z last=2026-10-09T23:53:35.000Z
    first: NISAR_L2_PR_GUNW_031_141_D_079_033_2000_SH_20260927T235027_20260927T235044_20261021T235028_20261021T235045_P05036_N_P_J_001
    last:  NISAR_L2_PR_GUNW_032_141_D_085_033_2000_SH_20261009T235335_20261009T235349_20261021T235335_20261021T235349_P05036_N_P_J_001
GUNW_P C2854335566-ASF hits=94150 first=2025-10-29T11:11:30.000Z last=2026-10-09T20:37:40.000Z
    first: NISAR_L2_PR_GUNW_004_004_A_018_006_4000_SH_20251029T111130_20251029T111153_20251122T111119_20251122T111153_P05023_N_P_J_001
    last:  NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001
SME2_P C2854344945-ASF hits=103943 first=2025-10-29T11:11:30.000Z last=2026-10-21T20:37:40.000Z
    first: NISAR_L3_PR_SME2_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001
    last:  NISAR_L3_PR_SME2_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001
--- gap check, all three GCOV collections, temporal windows
  2026-07-27T00:00Z..2026-07-27T23:59Z GCOV_P: hits=1215 ('2026-07-26T23:59:46.000Z', '2026-07-27T21:17:13.999Z')
  2026-07-27T00:00Z..2026-07-27T23:59Z GCOV_V: hits=0 
  2026-07-27T00:00Z..2026-07-27T23:59Z GCOV_B: hits=0 
  2026-07-27T22:03Z..2026-08-10T00:55Z GCOV_P: hits=0 
  2026-07-27T22:03Z..2026-08-10T00:55Z GCOV_V: hits=0 
  2026-07-27T22:03Z..2026-08-10T00:55Z GCOV_B: hits=0 
  2026-08-10T00:00Z..2026-08-10T23:59Z GCOV_P: hits=1352 ('2026-08-10T00:55:32.000Z', '2026-08-10T23:53:45.999Z')
  2026-08-10T00:00Z..2026-08-10T23:59Z GCOV_V: hits=0 
  2026-08-10T00:00Z..2026-08-10T23:59Z GCOV_B: hits=0 
--- provisional GCOV per month
   2025-10 GCOV_B=1675 GCOV_P=44 GCOV_V=0
   2025-11 GCOV_B=7141 GCOV_P=557 GCOV_V=0
   2025-12 GCOV_B=8818 GCOV_P=721 GCOV_V=0
   2026-01 GCOV_B=5893 GCOV_P=748 GCOV_V=0
   2026-02 GCOV_B=0 GCOV_P=729 GCOV_V=0
   2026-03 GCOV_B=0 GCOV_P=667 GCOV_V=0
   2026-04 GCOV_B=0 GCOV_P=790 GCOV_V=0
   2026-05 GCOV_B=0 GCOV_P=856 GCOV_V=0
   2026-06 GCOV_B=0 GCOV_P=20467 GCOV_V=0
   2026-07 GCOV_B=0 GCOV_P=36912 GCOV_V=0
   2026-08 GCOV_B=0 GCOV_P=29883 GCOV_V=0
   2026-09 GCOV_B=0 GCOV_P=42430 GCOV_V=0
   2026-10 GCOV_B=0 GCOV_P=28870 GCOV_V=11583
   2026-11 GCOV_B=0 GCOV_P=0 GCOV_V=2505
--- validated GCOV per day in November 2026 and late October
   2026-10-20: provisional=1351 validated=0
   2026-10-21: provisional=1142 validated=367
   2026-10-22: provisional=0 validated=1318
   2026-10-23: provisional=0 validated=1365
   2026-10-24: provisional=0 validated=1279
   2026-10-30: provisional=0 validated=1024
   2026-11-05: provisional=0 validated=311
   2026-11-06: provisional=0 validated=463
   2026-11-07: provisional=0 validated=57
   2026-11-08: provisional=0 validated=52
   2026-11-09: provisional=0 validated=33
   2026-11-10: provisional=0 validated=19
   2026-11-11: provisional=0 validated=31
   2026-11-12: provisional=0 validated=0
   2026-11-13: provisional=0 validated=0
````

`$FC/out/cmr_crid.txt` (2026-11-13 21:04 CST):

````
GCOV_P total 163672 {'*_P05023_*': 163648, '*_P050*': 163648, '*_PR_*': 163672, '*_UR_*': 0, '*_N_F_J_*': 114059, '*_N_P_J_*': 43299, '*_J_001': 161614, '*_J_002': 2057, '*_J_003': 1}
GCOV_V total 14090 {'*_P05036_*': 14090, '*_P050*': 14090, '*_PR_*': 14090, '*_N_F_J_*': 10020, '*_N_P_J_*': 3994, '*_J_001': 14090, '*_J_002': 0}
GCOV_B total 23527 {'*_X050*': 23527, '*_X05010_*': 7572, '*_X05009_*': 15851, '*_X05008_*': 98, '*_PR_*': 23527, '*_J_001': 23516, '*_J_002': 11}
--- mode codes, provisional GCOV
  mode 2005 56977
  mode 4005 47464
  mode 7700 6418
  mode 0005 46762
  mode 2000 82
  mode 4000 13
  mode 7705 0
  mode 0500 419
  mode 2020 0
  mode 4040 0
--- pol codes, provisional GCOV (freq A code + freq B code)
  pol SHSH 21288
  pol DHDH 80620
  pol QPDH 1748
  pol SHNA 6830
  pol NASH 241
  pol SVSV 14
  pol DVDV 772
  pol NASV 41946
  pol NADV 4575
  pol DHNA 14
  pol SVNA 9
  pol DVNA 79
--- track and frame extremes
  track 173 779
  track 174 0
  track 001 672
  track 000 0
  frame 176 666
  frame 177 0
  frame 001 606
  frame 000 0
````

GCOV granules per UTC acquisition day around the release boundary (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 173, 2026-11-14 01:50 CST):

````
GCOV granules whose acquisition overlaps each UTC day (provisional | validated):
  2026-10-17  P=  1430  V=     0
  2026-10-18  P=  1305  V=     0
  2026-10-19  P=  1374  V=     0
  2026-10-20  P=  1351  V=     0
  2026-10-21  P=  1142  V=   367
  2026-10-22  P=     0  V=  1318
  2026-10-23  P=     0  V=  1365
  2026-10-24  P=     0  V=  1354
  2026-10-25  P=     0  V=  1267
  2026-10-26  P=     0  V=  1200
  2026-10-27  P=     0  V=  1191
  2026-10-28  P=     0  V=  1202
  2026-10-29  P=     0  V=  1096
  2026-10-30  P=     0  V=  1129
  2026-10-31  P=     0  V=   708
  2026-11-01  P=     0  V=   596
  2026-11-02  P=     0  V=   434
  2026-11-03  P=     0  V=   261
  2026-11-04  P=     0  V=   249
  2026-11-05  P=     0  V=   311
  2026-11-06  P=     0  V=   463
  2026-11-07  P=     0  V=    57
  2026-11-08  P=     0  V=    52
  2026-11-09  P=     0  V=    33
  2026-11-10  P=     0  V=    19
  2026-11-11  P=     0  V=    32
  2026-11-12  P=     0  V=     0
  2026-11-13  P=     0  V=     0
  2026-11-14  P=     0  V=     0
== latest provisional GCOV granules
NISAR_L2_PR_GCOV_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001 2026-10-21T20:37:40.000Z updated 2026-10-23T12:37:16.331Z
NISAR_L2_PR_GCOV_033_139_D_092_4005_DHDH_A_20261021T203740_20261021T203818_P05023_N_F_J_001 2026-10-21T20:37:40.000Z updated 2026-10-23T15:23:28.681Z
== earliest provisional GCOV granules
NISAR_L2_PR_GCOV_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001 2025-10-29T11:11:30.000Z updated 2026-08-07T10:32:41.061Z
NISAR_L2_PR_GCOV_004_004_A_136_7700_SHNA_A_20251029T121824_20251029T121857_P05023_N_P_J_001 2025-10-29T12:18:24.000Z updated 2026-08-06T16:36:17.623Z
== beta GCOV earliest / latest
NISAR_L2_PR_GCOV_002_109_D_063_4005_DHDH_A_20251012T182508_20251012T182531_X05010_N_P_J_001 2025-10-12T18:25:08.000Z
NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001 2026-01-20T15:59:30.000Z
````

Newest and oldest validated GCOV, and counts after the GIBS end date (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 146, second half):

````
== CMR: validated GCOV granules with start after GIBS end date (2026-11-11)
temporal>=2026-11-12T00:00:00Z, cmr-hits: 0
temporal>=2026-11-13T00:00:00Z, cmr-hits: 0
temporal>=2026-11-14T00:00:00Z, cmr-hits: 0
== latest validated GCOV granule
NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001 2026-11-11T23:35:57.000Z 2026-11-13T14:40:32.050Z
NISAR_L2_PR_GCOV_035_098_A_009_0005_NASV_A_20261111T233524_20261111T233558_P05036_N_F_J_001 2026-11-11T23:35:24.000Z 2026-11-13T14:35:33.609Z
NISAR_L2_PR_GCOV_035_098_A_008_0005_NASV_A_20261111T233450_20261111T233525_P05036_N_F_J_001 2026-11-11T23:34:50.000Z 2026-11-13T14:40:38.835Z
== earliest validated GCOV granule
NISAR_L2_PR_GCOV_033_137_D_073_2005_DHDH_A_20261021T170721_20261021T170733_P05036_N_P_J_001 2026-10-21T17:07:21.000Z 2026-11-07T01:59:56.459Z
NISAR_L2_PR_GCOV_033_137_D_073_2005_DHDH_A_20261021T170740_20261021T170755_P05036_N_P_J_001 2026-10-21T17:07:40.000Z 2026-11-07T02:02:55.099Z
NISAR_L2_PR_GCOV_033_137_D_074_2005_DHDH_A_20261021T170754_20261021T170805_P05036_N_P_J_001 2026-10-21T17:07:54.000Z 2026-11-07T02:53:36.166Z
````

Urgent-response check (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 324):

````
Kilauea, dataMaturity=PROVISIONAL, no productionConfiguration: 54 results | PR/UR by name: {'PR': 54} | collections: {'NISAR_L2_GCOV_PROVISIONAL_V1': 54}
Kilauea, dataMaturity=PROVISIONAL, productionConfiguration=PR: 54 results | PR/UR by name: {'PR': 54} | collections: {'NISAR_L2_GCOV_PROVISIONAL_V1': 54}
Kilauea, dataMaturity=VALIDATED, no productionConfiguration: 4 results | PR/UR by name: {'PR': 4} | collections: {'NISAR_L2_GCOV_V1': 4}
Kilauea, no dataMaturity, no productionConfiguration: 90 results | PR/UR by name: {'UR': 19, 'PR': 71} | collections: {'NISAR_UR_L2': 19, 'NISAR_L2_GCOV_V1': 4, 'NISAR_L2_GCOV_PROVISIONAL_V1': 54, 'NISAR_L2_GCOV_BETA_V1': 13}
UR examples: ['NISAR_L2_UR_GCOV_035_072_D_079_4005_DHDH_A_20261110T045814_20261110T045834_P05036_F_P_J_001', 'NISAR_L2_UR_GCOV_034_151_A_011_4005_DHDH_A_20261103T155041_20261103T155057_P05036_F_P_J_001', 'NISAR_L2_UR_GCOV_034_151_A_011_4005_DHDH_A_20261103T155041_20261103T155057_P05023_F_P_J_001']
== CMR UR L2 collection granule count and date range
NISAR_L2_UR_GOFF_023_054_A_013_031_4000_SH_20260617T222246_20260617T222251_20260921T222242_20260921T222248_P05023_F_P_J_001 2026-06-17T22:22:46.000Z
NISAR_L2_UR_GCOV_035_127_A_020_4005_DHDH_A_20261113T235812_20261113T235821_P05036_F_P_J_001 2026-11-13T23:58:12.000Z
cmr-hits: 6785
````


### 8.5 GIBS capabilities

NISAR layers (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 118; `Domains` resource lines dropped):

````
status=200 size=5842320 time=0.578743
HTTP/2 200 
content-type: text/xml; charset=UTF-8
access-control-allow-origin: *
cache-control: public, max-age=1800
total layers 1330
--- NISAR_L2_Geocoded_Polarimetric_Covariance
  title  : NISAR Normalized Radar Backscatter (False Color, GCOV, Best)
  formats: ['image/png']  tms: ['GoogleMapsCompatible_Level13']
  default: 2026-11-11
  values : 5 ranges; first ['2025-10-29/2026-03-01/P1D'] last ['2026-04-01/2026-04-12/P1D', '2026-04-14/2026-07-27/P1D', '2026-08-10/2026-11-11/P1D']
      2025-10-29/2026-03-01/P1D
      2026-03-04/2026-03-29/P1D
      2026-04-01/2026-04-12/P1D
      2026-04-14/2026-07-27/P1D
      2026-08-10/2026-11-11/P1D
  res    : ('tile', 'image/png', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png')
  res    : ('tile', 'image/png', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png')
  res    : ('tile', 'image/png', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png')
--- OrbitTracks_NISAR_Ascending
  title  : Orbit Tracks (Ascending, NISAR)
  formats: ['application/vnd.mapbox-vector-tile']  tms: ['GoogleMapsCompatible_Level6']
  default: 2026-11-13
  values : 1 ranges; first ['2025-07-30/2026-11-13/P1D'] last ['2025-07-30/2026-11-13/P1D']
      2025-07-30/2026-11-13/P1D
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Ascending/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Ascending/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Ascending/default/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
--- OrbitTracks_NISAR_Descending
  title  : Orbit Tracks (Descending, NISAR)
  formats: ['application/vnd.mapbox-vector-tile']  tms: ['GoogleMapsCompatible_Level6']
  default: 2026-11-13
  values : 1 ranges; first ['2025-07-30/2026-11-13/P1D'] last ['2025-07-30/2026-11-13/P1D']
      2025-07-30/2026-11-13/P1D
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Descending/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Descending/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
  res    : ('tile', 'application/vnd.mapbox-vector-tile', 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OrbitTracks_NISAR_Descending/default/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.mvt')
````

The other layers named in Section 4.6, and the tile matrix sets (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 122):

````
--- OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1
  title: OPERA Radiometric Terrain Corrected SAR Backscatter from Sentinel-1 (False Color, Validated, v1.0, Best) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-13
  time ranges: 19 | first: ['2025-01-10/2025-01-10/P1D'] | last: ['2026-01-05/2026-11-13/P1D']
  template ext: png
--- OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1
  title: Dynamic Surface Water Extent (Best, OPERA_L3_DSWx-S1) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-13
  time ranges: 12 | first: ['2023-12-15/2023-12-15/P1D'] | last: ['2025-10-24/2026-11-13/P1D']
  template ext: png
--- OPERA_L3_Dynamic_Surface_Water_Extent-HLS
  title: Dynamic Surface Water Extent (Best, OPERA_L3_DSWx-HLS) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-05
  time ranges: 5 | first: ['2016-01-07/2020-08-15/P1D'] | last: ['2025-08-08/2026-11-05/P1D']
  template ext: png
--- OPERA_L3_DIST-ALERT-HLS_Color_Index
  title: Vegetation Disturbance Status (Color Index, OPERA_L3_DIST-ALERT-HLS) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-05
  time ranges: 6 | first: ['2023-01-01/2025-06-02/P1D'] | last: ['2026-02-10/2026-11-05/P1D']
  template ext: png
--- HLS_S30_Nadir_BRDF_Adjusted_Reflectance
  title: Reflectance (Nadir BRDF-Adjusted,  Sentinel-2 / MSI) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-06
  time ranges: 17 | first: ['2015-11-28/2015-12-11/P1D'] | last: ['2026-03-02/2026-11-06/P1D']
  template ext: png
--- HLS_L30_Nadir_BRDF_Adjusted_Reflectance
  title: Reflectance (Nadir BRDF-Adjusted,  Landsat-8/9 / OLI) | formats: ['image/png'] | tms: ['GoogleMapsCompatible_Level12'] | default: 2026-11-05
  time ranges: 13 | first: ['2013-03-22/2013-03-22/P1D'] | last: ['2026-03-02/2026-11-05/P1D']
  template ext: png
--- MODIS_Terra_CorrectedReflectance_TrueColor
  title: Corrected Reflectance (True Color, MODIS, Terra) | formats: ['image/jpeg'] | tms: ['GoogleMapsCompatible_Level9'] | default: 2026-11-14
  time ranges: 11 | first: ['2000-02-24/2000-04-25/P1D'] | last: ['2025-11-10/2026-11-14/P1D']
  template ext: jpeg

All OPERA layer ids: ['OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1', 'OPERA_L3_DIST-ALERT-HLS_Color_Index', 'OPERA_L3_DIST-ANN-HLS_Color_Index', 'OPERA_L3_Dynamic_Surface_Water_Extent-HLS', 'OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1']
All HLS layer ids: ['HLS_L30_Nadir_BRDF_Adjusted_Reflectance', 'HLS_MGRS_Granule_Grid', 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance']
TMS GoogleMapsCompatible_Level3 levels 4 maxzoom 3 tile 256 x 256
TMS GoogleMapsCompatible_Level6 levels 7 maxzoom 6 tile 256 x 256
TMS GoogleMapsCompatible_Level7 levels 8 maxzoom 7 tile 256 x 256
TMS GoogleMapsCompatible_Level8 levels 9 maxzoom 8 tile 256 x 256
TMS GoogleMapsCompatible_Level9 levels 10 maxzoom 9 tile 256 x 256
TMS GoogleMapsCompatible_Level12 levels 13 maxzoom 12 tile 256 x 256
TMS GoogleMapsCompatible_Level13 levels 14 maxzoom 13 tile 256 x 256
````


### 8.6 GIBS tile requests

NISAR layer, Tonle Sap point (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 126):

````
z8 tile for Tonle Sap point: x=201 y=118
nisar_z8_1017.png            -> 200 146467 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_1029.png            -> 200 143297 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-29/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_0619.png            -> 200 138873 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-06-19/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_1018_nopass.png     -> 200 288 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-18/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_0801_ingap.png      -> 404 196 text/html; charset=iso-8859-1 | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | BODY: <!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"> <html><head> <title>404 Not Found</title> </head><body> <h1>Not Found</h1> <p>The requested URL was not found
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-08-01/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_1112_after.png      -> 404 196 text/html; charset=iso-8859-1 | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | BODY: <!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"> <html><head> <title>404 Not Found</title> </head><body> <h1>Not Found</h1> <p>The requested URL was not found
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-11-12/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_1113_after.png      -> 404 196 text/html; charset=iso-8859-1 | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | BODY: <!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"> <html><head> <title>404 Not Found</title> </head><body> <h1>Not Found</h1> <p>The requested URL was not found
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-11-13/GoogleMapsCompatible_Level13/8/118/201.png
nisar_z8_swapped.png         -> 200 288 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/8/201/118.png
nisar_z13_1017.png           -> 200 43381 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=3
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/13/3798/6463.png
nisar_z14_1017.png           -> 400 226 text/html; charset=iso-8859-1 | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | BODY: <!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"> <html><head> <title>400 Bad Request</title> </head><body> <h1>Bad Request</h1> <p>Your browser sent a request
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/14/7597/12927.png
nisar_z8_wrongtms.png        -> 400 431 text/xml | acao=['*'] cache=[] | BODY: <?xml version="1.0" encoding="UTF-8"?> <ExceptionReport xmlns="http://www.opengis.net/ows/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaL
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level12/8/118/201.png
nisar_z8_jpg.jpg             -> 200 146467 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=2
    https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/2026-10-17/GoogleMapsCompatible_Level13/8/118/201.jpg
````

Other layers, same zoom-8 tile, 2026-10-17 unless named (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 130):

````
OPERA_L2_Radiometric_T_inel-1.png -> 200 49950 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
OPERA_L3_Dynamic_Surfa_inel-1.png -> 200 3229 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=3
OPERA_L3_Dynamic_Surfa_nt-HLS.png -> 200 1430 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=3
OPERA_L3_DIST-ALERT-HL__Index.png -> 200 7319 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=3
HLS_S30_Nadir_BRDF_Adj_ctance.png -> 200 334 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
HLS_L30_Nadir_BRDF_Adj_ctance.png -> 200 334 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
modis.jpg                    -> 200 18497 image/jpeg | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | JPEG
modis.jpeg                   -> 200 18497 image/jpeg | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | JPEG
modis_as_png.png             -> 200 18497 image/jpeg | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | JPEG
rtc_2026-10-16.png           -> 200 168147 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
rtc_2026-10-18.png           -> 200 334 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
rtc_2026-10-20.png           -> 200 102269 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
rtc_2026-10-22.png           -> 200 167161 image/png | acao=['*'] cache=['max-age=0, no-store, no-cache, must-revalidate'] | PNG 256x256 bitdepth=8 colortype=6
````

Transparency of the tiles and the two error bodies (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 118):

````
nisar_z8_1017.png mode= RGB size= (256, 256) info= {'transparency': (0, 0, 0)} | black px 0.0% | alpha==0 px 0.0% | unique colours 47294
nisar_z13_1017.png mode= P size= (256, 256) info= {'transparency': '<256 bytes>'} | black px 100.0% | alpha==0 px 100.0% | unique colours 1
nisar_z8_1018_nopass.png mode= RGB size= (256, 256) info= {'transparency': (0, 0, 0)} | black px 100.0% | alpha==0 px 100.0% | unique colours 1
nisar_z8_1029.png mode= RGB size= (256, 256) info= {'transparency': (0, 0, 0)} | black px 0.0% | alpha==0 px 0.0% | unique colours 48722
rtc_s1.png mode= RGBA size= (256, 256) info= {} | black px 72.0% | alpha==0 px 70.1% | unique colours 8647
dswx_s1.png mode= P size= (256, 256) info= {'transparency': 255} | black px 28.5% | alpha==0 px 28.5% | unique colours 6
hls_s30.png mode= RGBA size= (256, 256) info= {} | black px 100.0% | alpha==0 px 100.0% | unique colours 1

<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
</body></html>

<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>400 Bad Request</title>
</head><body>
<h1>Bad Request</h1>
<p>Your browser sent a request that this server could not understand.<br />
</p>
</body></html>
````

PNG chunks of NISAR tiles and of the browse thumbnail (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 134):

````
nisar_z8_1018_nopass.png | size 288 | ct 2 | chunks [('IHDR', 13), ('tRNS', 6), ('IEND', 0)] | tRNS 000000000000 | PLTE entries None | raw all zero | filters [0]
nisar_z8_1017.png | size 146467 | ct 2 | chunks [('IHDR', 13), ('tRNS', 6), ('IEND', 0)] | tRNS 000000000000 | PLTE entries None | has nonzero data | filters [1, 3, 4]
nisar_z13_1017.png | size 43381 | ct 3 | chunks [('IHDR', 13), ('PLTE', 768), ('tRNS', 1), ('IEND', 0)] | tRNS 00 | PLTE entries 256 | has nonzero data | filters [0]
nisar_z8_swapped.png | size 288 | ct 2 | chunks [('IHDR', 13), ('tRNS', 6), ('IEND', 0)] | tRNS 000000000000 | PLTE entries None | raw all zero | filters [0]
browse_thumb.png | size 14600 | ct 2 | chunks [('IHDR', 13), ('tRNS', 6), ('IEND', 0)] | tRNS 000000000000 | PLTE entries None | has nonzero data | filters [0, 1, 2, 4]
````


### 8.7 GIBS tile-health survey, zoom 3 to 13

`$FC/out/gibs_survey.txt` (2026-11-13 21:06 CST), complete:

````
## TonleSap 104.05,12.95 2026-10-17
  z 3 3/6: RGB  bytes= 22088 plte_nonblack=None tRNS=(6, 0) visible=12.3% nonblack=12.3%
  z 4 7/12: RGB  bytes= 20522 plte_nonblack=None tRNS=(6, 0) visible=12.9% nonblack=12.9%
  z 5 14/25: RGB  bytes= 43958 plte_nonblack=None tRNS=(6, 0) visible=32.0% nonblack=32.0%
  z 6 29/50: RGB  bytes= 78228 plte_nonblack=None tRNS=(6, 0) visible=57.6% nonblack=57.6%
  z 7 59/100: RGB  bytes=111936 plte_nonblack=None tRNS=(6, 0) visible=93.1% nonblack=93.1%
  z 8 118/201: RGB  bytes=146467 plte_nonblack=None tRNS=(6, 0) visible=100.0% nonblack=100.0%
  z 9 237/403: PAL  bytes= 50656 plte_nonblack=0 tRNS=(1, 0) visible=100.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z10 474/807: PAL  bytes= 45900 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z11 949/1615: GRAYA bytes= 79973 plte_nonblack=None tRNS=None visible=100.0% nonblack=100.0%
  z12 1899/3231: RGBA bytes=155857 plte_nonblack=None tRNS=None visible=99.2% nonblack=100.0%
  z13 3798/6463: PAL  bytes= 43636 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
## TonleSap 104.05,12.95 2026-06-19
  z 3 3/6: RGB  bytes= 22190 plte_nonblack=None tRNS=(6, 0) visible=12.3% nonblack=12.3%
  z 4 7/12: RGB  bytes= 20582 plte_nonblack=None tRNS=(6, 0) visible=12.8% nonblack=12.8%
  z 5 14/25: RGB  bytes= 44748 plte_nonblack=None tRNS=(6, 0) visible=31.9% nonblack=31.9%
  z 6 29/50: RGB  bytes= 78629 plte_nonblack=None tRNS=(6, 0) visible=57.6% nonblack=57.6%
  z 7 59/100: RGB  bytes=105388 plte_nonblack=None tRNS=(6, 0) visible=93.1% nonblack=93.1%
  z 8 118/201: RGB  bytes=138873 plte_nonblack=None tRNS=(6, 0) visible=100.0% nonblack=100.0%
  z 9 237/403: RGBA bytes=222404 plte_nonblack=None tRNS=None visible=98.4% nonblack=99.2%
  z10 474/807: RGBA bytes=182996 plte_nonblack=None tRNS=None visible=98.3% nonblack=99.2%
  z11 949/1615: RGBA bytes=149696 plte_nonblack=None tRNS=None visible=93.4% nonblack=94.9%
  z12 1899/3231: GRAYA bytes= 94730 plte_nonblack=None tRNS=None visible=100.0% nonblack=100.0%
  z13 3798/6463: PAL  bytes= 44422 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
## TonleSap-land 103.4,13.4 2026-10-17
  z 3 3/6: RGB  bytes= 22088 plte_nonblack=None tRNS=(6, 0) visible=12.3% nonblack=12.3%
  z 4 7/12: RGB  bytes= 20522 plte_nonblack=None tRNS=(6, 0) visible=12.9% nonblack=12.9%
  z 5 14/25: RGB  bytes= 43958 plte_nonblack=None tRNS=(6, 0) visible=32.0% nonblack=32.0%
  z 6 29/50: RGB  bytes= 78228 plte_nonblack=None tRNS=(6, 0) visible=57.6% nonblack=57.6%
  z 7 59/100: RGB  bytes=111936 plte_nonblack=None tRNS=(6, 0) visible=93.1% nonblack=93.1%
  z 8 118/201: RGB  bytes=146467 plte_nonblack=None tRNS=(6, 0) visible=100.0% nonblack=100.0%
  z 9 236/403: RGBA bytes=198118 plte_nonblack=None tRNS=None visible=99.2% nonblack=100.0%
  z10 473/806: PAL  bytes= 60160 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z11 947/1612: PAL  bytes= 64101 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z12 1894/3224: PAL  bytes= 62910 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z13 3788/6448: PAL  bytes= 64352 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
## MexicoCity -99.1,19.4 2026-10-13
  z 3 3/1: RGB  bytes= 18307 plte_nonblack=None tRNS=(6, 0) visible=10.3% nonblack=10.3%
  z 4 7/3: RGB  bytes=  8710 plte_nonblack=None tRNS=(6, 0) visible= 5.3% nonblack= 5.3%
  z 5 14/7: RGB  bytes= 28309 plte_nonblack=None tRNS=(6, 0) visible=20.6% nonblack=20.6%
  z 6 28/14: RGB  bytes= 91037 plte_nonblack=None tRNS=(6, 0) visible=74.1% nonblack=74.1%
  z 7 56/28: RGB  bytes=113948 plte_nonblack=None tRNS=(6, 0) visible=85.1% nonblack=85.1%
  z 8 113/57: RGB  bytes=130958 plte_nonblack=None tRNS=(6, 0) visible=94.7% nonblack=94.7%
  z 9 227/115: RGB  bytes=142516 plte_nonblack=None tRNS=(6, 0) visible=99.2% nonblack=99.2%
  z10 455/230: RGBA bytes=207894 plte_nonblack=None tRNS=None visible=90.3% nonblack=92.1%
  z11 911/460: PAL  bytes= 64587 plte_nonblack=0 tRNS=(256, 0) visible= 0.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
  z12 1822/920: GRAYA bytes=128385 plte_nonblack=None tRNS=None visible=100.0% nonblack=100.0%
  z13 3645/1840: PAL  bytes= 62180 plte_nonblack=0 tRNS=(1, 0) visible=100.0% nonblack= 0.0%  <== ALL-BLACK PALETTE WITH DATA (renders invisible)
## Champaign -88.3,40.2 2026-10-10
  z 3 3/2: RGB  bytes= 16654 plte_nonblack=None tRNS=(6, 0) visible= 9.0% nonblack= 9.0%
  z 4 6/4: RGB  bytes= 20135 plte_nonblack=None tRNS=(6, 0) visible=12.1% nonblack=12.1%
  z 5 12/8: RGB  bytes= 39568 plte_nonblack=None tRNS=(6, 0) visible=25.0% nonblack=25.0%
  z 6 24/16: RGB  bytes= 86749 plte_nonblack=None tRNS=(6, 0) visible=47.7% nonblack=47.7%
  z 7 48/32: RGB  bytes=115965 plte_nonblack=None tRNS=(6, 0) visible=63.2% nonblack=63.2%
  z 8 96/65: RGB  bytes=151834 plte_nonblack=None tRNS=(6, 0) visible=86.1% nonblack=86.1%
  z 9 193/130: RGB  bytes=140930 plte_nonblack=None tRNS=(6, 0) visible=83.3% nonblack=83.3%
  z10 386/260: RGB  bytes=109061 plte_nonblack=None tRNS=(6, 0) visible=68.3% nonblack=68.3%
  z11 773/521: RGB  bytes=158522 plte_nonblack=None tRNS=(6, 0) visible=99.3% nonblack=99.3%
  z12 1547/1043: RGBA bytes=233598 plte_nonblack=None tRNS=None visible=97.0% nonblack=97.8%
  z13 3095/2086: ERROR HTTP Error 500: Internal Server Error
````

The same Tonle Sap tiles fetched about a minute earlier (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 122):

````
z9 y237 x403 http=200 size=50911
z10 y474 x807 http=200 size=181897
z11 y949 x1615 http=200 size=162155
z12 y1899 x3231 http=200 size=158332
z13 y3798 x6463 http=200 size=43636
ts_z9.png P-mode: distinct indices 247 palette entries 256 tRNS [0, 0, 0, 0, 0, 0, 0, 0] nonzero-alpha entries 0
   first palette rows [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] top indices [(1, 133), (2, 20), (3, 16), (4, 22), (5, 27)]
   RGB mean [0.0, 0.0, 0.0] distinct RGB 1
ts_z10.png RGBA RGB mean [55.1, 55.5, 57.6, 97.4] {}
ts_z11.png RGBA RGB mean [56.7, 57.1, 55.9, 61.4] {}
ts_z12.png RGBA RGB mean [42.6, 42.7, 41.6, 41.6] {}
ts_z13.png P-mode: distinct indices 114 palette entries 256 tRNS [0, 0, 0, 0, 0, 0, 0, 0] nonzero-alpha entries 0
   first palette rows [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] top indices [(1, 230), (2, 107), (3, 150), (4, 184), (5, 252)]
   RGB mean [0.0, 0.0, 0.0] distinct RGB 1
````

Their raw chunks (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 126):

````
ts_z9.png | IHDR 256x256 bitdepth=8 colortype=3 ; PLTE entries=256 nonblack=0 sample=[(0, 0, 0), (0, 0, 0), (0, 0, 0)]..[(0, 0, 0), (0, 0, 0)] ; tRNS len=256 zero-alpha=256 full-alpha=0 first=[0, 0, 0, 0, 0, 0] ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(582) ; IEND(0)
ts_z13.png | IHDR 256x256 bitdepth=8 colortype=3 ; PLTE entries=256 nonblack=0 sample=[(0, 0, 0), (0, 0, 0), (0, 0, 0)]..[(0, 0, 0), (0, 0, 0)] ; tRNS len=256 zero-alpha=256 full-alpha=0 first=[0, 0, 0, 0, 0, 0] ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(1511) ; IEND(0)
ts_z10.png | IHDR 256x256 bitdepth=8 colortype=6 ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8
nisar_z8_1017.png | IHDR 256x256 bitdepth=8 colortype=2 ; tRNS len=6 zero-alpha=6 full-alpha=0 first=[0, 0, 0, 0, 0, 0] ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; IDAT(8192) ; 
nisar_z8_1018_nopass.png | IHDR 256x256 bitdepth=8 colortype=2 ; tRNS len=6 zero-alpha=6 full-alpha=0 first=[0, 0, 0, 0, 0, 0] ; IDAT(213) ; IEND(0)
````


### 8.8 Browse previews

Fetch without login (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 114):

````
== GET (follow redirects, no credentials, Origin header set) https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png
final_status=200 redirects=1 size=4247472 ctype=binary/octet-stream
final_url_host=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png?<signed-query-removed>
-- response header blocks:
HTTP/2 303 
content-type: application/json
content-length: 0
location: https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001_LATLON.png?<signed-query-removed>
cache-control: private, max-age=3540
access-control-allow-origin: *
access-control-expose-headers: *
HTTP/2 200 
content-type: binary/octet-stream
content-length: 4247472
accept-ranges: bytes
access-control-allow-origin: *
access-control-expose-headers: *
dl/browse_latlon.png: PNG image data, 1880 x 1847, 8-bit/color RGB, non-interlaced
== thumbnail
final_status=200 redirects=1 size=14600 ctype=binary/octet-stream
dl/browse_thumb.png: PNG image data, 100 x 100, 8-bit/color RGB, non-interlaced
== KML without login
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.
== data .h5 without login
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=qpa3q_b7OJ32gGjwA9DxHg&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=%2FNISAR%2FNISAR_L2_GCOV
````

Which files need login and which are public (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 86):

````
=== /NISAR/.../_LATLON.kml (no login, no redirect following)
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
access-control-allow-origin: *
http=302
=== /NISAR/.../.h5 (no login, no redirect following)
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
access-control-allow-origin: *
http=302
=== /NISAR/.../_QA_SUMMARY.csv (no login, no redirect following)
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
access-control-allow-origin: *
http=302
=== /NISAR/.../_QA_REPORT.pdf (no login, no redirect following)
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
access-control-allow-origin: *
http=302
=== /NISAR/.../.h5.iso.xml (no login, no redirect following)
HTTP/2 302 
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
access-control-allow-origin: *
http=302
=== BROWSE variants
_NATIVE.png: http=200 redirects=1 size=4727200 final=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2_GCOV_
_NATIVE_A_HHHH.png: http=200 redirects=1 size=1601869 final=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L
_NATIVE_B_HVHV.png: http=200 redirects=1 size=871202 final=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISAR_L2
_LATLON.kml: http=404 redirects=0 size=244697 final=https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T22
````

PNG headers of the live browse files and of the copies in `research/evidence/previews/` (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 138):

````
browse_latlon.png | bytes 4247472 | IHDR w,h,bitdepth,colortype = (1880, 1847, 8, 2) | chunk types ['IHDR', 'tRNS', 'IDAT', 'IEND'] | tRNS 000000000000
browse_thumb.png | bytes 14600 | IHDR w,h,bitdepth,colortype = (100, 100, 8, 2) | chunk types ['IHDR', 'tRNS', 'IDAT', 'IEND'] | tRNS 000000000000
browse_tonlesap_2026-06-19.png | bytes 1225992 | IHDR w,h,bitdepth,colortype = (1000, 982, 8, 6) | chunk types ['IHDR', 'sRGB', 'eXIf', 'IDAT', 'IEND'] | tRNS ABSENT
browse_tonlesap_2026-10-29.png | bytes 1220703 | IHDR w,h,bitdepth,colortype = (1000, 982, 8, 6) | chunk types ['IHDR', 'sRGB', 'eXIf', 'IDAT', 'IEND'] | tRNS ABSENT
browse_illinois_quadpol_2026-08-11.png | bytes 1122436 | IHDR w,h,bitdepth,colortype = (900, 881, 8, 6) | chunk types ['IHDR', 'sRGB', 'eXIf', 'IDAT', 'IEND'] | tRNS ABSENT
gunw_mexicocity_2026-03-11.png | bytes 928059 | IHDR w,h,bitdepth,colortype = (900, 883, 8, 6) | chunk types ['IHDR', 'sRGB', 'eXIf', 'pHYs', 'iTXt', 'IDAT', 'IEND'] | tRNS ABSENT
gibs_tonlesap_2026-06-19.png | bytes 320691 | IHDR w,h,bitdepth,colortype = (1024, 512, 8, 2) | chunk types ['IHDR', 'IDAT', 'IEND'] | tRNS ABSENT
````

D4 on the 2026-10-17 granule (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 142):

````
PIL mode RGB size (1880, 1847) info.transparency = (0, 0, 0)
pixels: total 3472360 | pure black 1587140 | alpha==0 after RGBA conversion 1587140 | black but opaque 0
footprint bbox xl,xr,yt,yb = 147 1815 127 1769 W,H = 1880 1847
polygon lon 102.63217 105.41857 lat 11.45942 14.13511
D4 formula -> west 102.3866 east 105.5272 north 14.3421 south 11.3323
deg/px lon 0.001671 lat 0.001630  -> approx m/px lon 181.3 lat 180.2
````


### 8.9 Read benchmark from the gist linked by the Cookbook (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 265)

Results table of `https://gist.github.com/hrodmn/5a377531c19da6f6d2c2bb149c450b3d` (updated 2026-06-02). Times in seconds. `array` is a 2000 x 2000 window. Measured with S3 access from inside AWS.

````
text/plain
        backend cache strategy block size  driver tuned  datatree load time  \\
0        fsspec     read ahead      50 MB         False           51.978538   
2        fsspec     read ahead      50 MB          True            8.422840   
1        fsspec          block        8MB         False            2.066248   
3        fsspec          block        8MB          True            2.549520   
4  obspec-utils     read ahead      50 MB         False           50.193109   
6  obspec-utils     read ahead      50 MB          True            8.198940   
5  obspec-utils          block        8MB         False            1.978188   
7  obspec-utils          block        8MB          True            1.948724   

   datatree requests  datatree MB requested  dataset load time  \\
0                NaN                    NaN          41.552898   
2                NaN                    NaN           3.475283   
1                NaN                    NaN           0.407014   
3                NaN                    NaN           0.654317   
4              152.0            4262.487081          41.363285   
6               16.0             590.000000           3.205525   
5                8.0              56.000000           0.391535   
7                8.0              56.000000           0.401180   

   dataset requests  dataset MB requested  array load time  array requests  \\
0               NaN                   NaN        48.401785             NaN   
2               NaN                   NaN         4.107010             NaN   
1               NaN                   NaN         1.178678             NaN   
3               NaN                   NaN         1.429531             NaN   
4             124.0           3637.396122        47.917127           135.0   
6               8.0            270.000000         3.891575             9.0   
5               4.0             24.000000         1.201178            11.0   
7               4.0             24.000000         1.178114            11.0   

   array MB requested  
0                 NaN  
2                 NaN  
1                 NaN  
3                 NaN  
4         4187.396122  
6          320.000000  
5           80.000000  
7           80.000000
````


### 8.10 Python stack

Scratch venv, `pip list` excerpt (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 313):

````
affine                3.0.1
aiohttp               3.14.5
asf_search            14.1.0
earthaccess           0.19.0
fsspec                2026.9.0
h5py                  3.16.0
morecantile           7.1.0
numpy                 2.5.4
pydantic              2.14.3
pyproj                3.8.0
rasterio              1.5.2
rio-cogeo             7.0.4
s3fs                  2026.9.0
````

Introspection (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 316; one docstring line dropped):

````
rasterio 1.5.2 | bundled GDAL 3.12.2
drivers present -> HDF5: True | netCDF: True | COG: True | GTiff: True
earthaccess 0.19.0
DataGranule.size is property: True
has get_fsspec_https_session: True
login signature: (strategy: str = 'all', persist: bool = False, system: earthaccess.system.System = System(cmr_base_url='https://cmr.earthdata.nasa.gov/search/', status_url='https://status.earthdata.nasa.gov/', status_api_url='https://status.earthdata.nasa.gov/api/v1/statuses', edl_hostname='urs.earthdata.nasa.gov')) -> earthaccess.auth.Auth
asf_search 14.1.0
DATASET.NISAR = NISAR | PRODUCT_TYPE.GCOV = GCOV
   asf.search param dataset -> True
   asf.search param processingLevel -> True
   asf.search param dataMaturity -> True
   asf.search param productionConfiguration -> True
   asf.search param intersectsWith -> True
   asf.search param relativeOrbit -> True
   asf.search param frame -> True
   asf.search param start -> True
   asf.search param end -> True
````

The brief's `asf_search` snippet live (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 320):

````
brief snippet -> results: 10 in 0.2s
   NISAR_L2_PR_GCOV_023_083_A_008_2005_DHDH_M_20260619T223637_20260619T223711_P05023_N_F_J_001 2026-06-19T22:36:37Z | url: 3637_20260619T223711_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_024_083_A_008_2005_DHDH_M_20260701T223636_20260701T223711_P05023_N_F_J_001 2026-07-01T22:36:36Z | url: 3636_20260701T223711_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_025_083_A_008_2005_DHDH_M_20260713T223636_20260713T223710_P05023_N_F_J_001 2026-07-13T22:36:36Z | url: 3636_20260713T223710_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_026_083_A_008_2005_DHDH_M_20260725T223635_20260725T223709_P05023_N_F_J_001 2026-07-25T22:36:35Z | url: 3635_20260725T223709_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_028_083_A_008_2005_DHDH_M_20260818T223634_20260818T223708_P05023_N_F_J_001 2026-08-18T22:36:34Z | url: 3634_20260818T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_029_083_A_008_2005_DHDH_M_20260830T223633_20260830T223708_P05023_N_F_J_001 2026-08-30T22:36:33Z | url: 3633_20260830T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_030_083_A_008_2005_DHDH_M_20260911T223633_20260911T223708_P05023_N_F_J_001 2026-09-11T22:36:33Z | url: 3633_20260911T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_031_083_A_008_2005_DHDH_M_20260923T223633_20260923T223708_P05023_N_F_J_001 2026-09-23T22:36:33Z | url: 3633_20260923T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_032_083_A_008_2005_DHDH_M_20261005T223633_20261005T223708_P05023_N_F_J_001 2026-10-05T22:36:33Z | url: 3633_20261005T223708_P05023_N_F_J_001.h5
   NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001 2026-10-17T22:36:33Z | url: 3633_20261017T223708_P05023_N_F_J_001.h5
property keys: ['additionalUrls', 'beamModeType', 'browse', 'bytes', 'centerLat', 'centerLon', 'collectionName', 'conceptID', 'crid', 'fileID', 'fileName', 'flightDirection', 'frameCoverage', 'frameNumber', 'granuleType', 'groupID', 'jointObservation', 'mainBandPolarization', 'md5sum', 'orbit', 'orbitType', 'pathNumber', 'pgeVersion', 'platform', 'polarization', 'processingDate', 'processingLevel'
without productionConfiguration -> 10 results; 0 urgent-response names
VALIDATED -> 1 ['2005_DHDH_M_20261029T223634_20261029T223708_P05036_N_F_J_001']
````

D5 on a synthetic raster (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 328):

````
<scratch>/review/fact-checker/run2/scripts/d5test.py:15: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
Reading input: out/d5/src_utm.tif

Adding overviews...
Updating dataset tags...
Writing output to: out/d5/dst_cog.tif
cog_translate signature: (source: Union[str, pathlib.PurePath, rasterio.io.DatasetReader, rasterio.io.DatasetWriter, rasterio.vrt.WarpedVRT], dst_path: Union[str, pathlib.PurePath], dst_kwargs: Dict, indexes: Optional[Sequence[int]] = None, nodata: Union[str, int, float, NoneType] = None, dtype: Optional[str] = None, add_mask: bool = False, overview_level: Optional[int] = None, overview_resampling: Literal['nearest', 'bilinear', 'cubic', 'cubic_spline', 'lanczos', 'average', 'mode', 'gauss', 'rms'] = 'nearest', web_optimized: bool = False, tms: Optional[morecantile.models.TileMatrixSet] = None, zoom_level_strategy: str = 'auto', zoom_level: Optional[int] = None, aligned_levels: Optional[int] = None, resampling: Literal['nearest', 'bilinear', 'cubic', 'cubic_spline', 'lanczos', 'average', 'mode', 'sum', 'rms'] = 'nearest', in_memory: Optional[bool] = None, config: Optional[Dict] = None, a
output: crs EPSG:3857 | size 2816 2816 | dtype ('uint8',) | nodata 0.0 | block [(512, 512)] | overviews [2, 4, 8] | compress Compression.deflate | res (38.219, 38.219) | interleave Interleaving.band
   zero (nodata) fraction: 0.097 | min valid 1 max 255
   mask flags ([<MaskFlags.nodata: 8>],)
cog_validate -> (True, [], [])
size MB src 6.2 dst 8.8
<scratch>/review/fact-checker/run2/out/d5/dst_cog.tif is a valid cloud optimized GeoTIFF
````

D3 logic on a synthetic HDF5 file (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 332):

````
epsg 32648 | keys ['HHHH', 'mask'] | window rows 497 2003 cols 500 1500 | shape (1506, 1000)
geotransform (410000.0, 20.0, 0.0, 1490060.0, 0.0, -20.0)
first value encodes (row, col) = (497, 500) == (r0, c0)? True
x of col c0 centre 410010.0 y of row r0 centre 1490050.0 | y descending in window: True
requested UTM bbox x 410000.0..430000.0 y 1459941.3..1490059.8
covered  UTM extent x 410000.0..430000.0 y 1459940.0..1490060.0
````

PyPI (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 309):

````
asf_search status=200 bytes=230634
earthaccess status=200 bytes=51356
rasterio status=200 bytes=1533864
rio-cogeo status=200 bytes=92433
h5py status=200 bytes=655489
pyproj status=200 bytes=1158806
numpy status=200 bytes=3729122
scipy status=200 bytes=2293924
fsspec status=200 bytes=149919
aiohttp status=200 bytes=9472099
== asf-search latest=14.1.0 (2026-10-14) requires_python=>=3.10 | last 4: [('14.0.2', '2026-09-23'), ('14.0.3', '2026-09-24'), ('14.0.4', '2026-10-12'), ('14.1.0', '2026-10-14')]
== earthaccess latest=0.19.0 (2026-09-04) requires_python=>=3.12 | last 4: [('0.16.0', '2026-01-30'), ('0.17.0', '2026-04-02'), ('0.18.0', '2026-05-12'), ('0.19.0', '2026-09-04')]
== rasterio latest=1.5.2 (2026-09-30) requires_python=>=3.12 | last 4: [('1.4.4', '2025-12-12'), ('1.5.0', '2026-01-05'), ('1.5.1', '2026-08-08'), ('1.5.2', '2026-09-30')]
   wheel python tags: ['cp312', 'cp313', 'cp314', 'cp315'] | platforms: ['linux', 'macos-arm64', 'macos-x86_64', 'win']
== rio-cogeo latest=7.0.4 (2026-10-09) requires_python=>=3.11 | last 4: [('7.0.1', '2025-12-15'), ('7.0.2', '2026-03-27'), ('7.0.3', '2026-09-24'), ('7.0.4', '2026-10-09')]
== h5py latest=3.16.0 (2026-03-06) requires_python=>=3.10 | last 4: [('3.14.0', '2025-06-06'), ('3.15.0', '2025-10-13'), ('3.15.1', '2025-10-16'), ('3.16.0', '2026-03-06')]
   wheel python tags: ['cp310', 'cp311', 'cp312', 'cp313', 'cp314'] | platforms: ['linux', 'macos-arm64', 'macos-x86_64', 'other', 'win']
== pyproj latest=3.8.0 (2026-09-05) requires_python=>=3.12 | last 4: [('3.7.0', '2024-10-01'), ('3.7.1', '2025-02-16'), ('3.7.2', '2025-08-14'), ('3.8.0', '2026-09-05')]
== numpy latest=2.5.4 (2026-10-10) requires_python=>=3.12 | last 4: [('2.5.1', '2026-07-04'), ('2.5.2', '2026-08-09'), ('2.5.3', '2026-09-06'), ('2.5.4', '2026-10-10')]
== scipy latest=1.18.1 (2026-08-21) requires_python=>=3.12 | last 4: [('1.17.0', '2026-01-10'), ('1.17.1', '2026-02-23'), ('1.18.0', '2026-06-19'), ('1.18.1', '2026-08-21')]
````


### 8.11 npm registry

`maplibre-gl` (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 289; the command then failed on the scoped packages, see Section 6):

````
== maplibre-gl | dist-tags: {'v1': '1.15.3', 'next': '6.0.0-22', 'latest': '6.18.0', 'latest-5': '5.24.1'}
   latest 4 stable by semver: [('6.15.0', '2026-10-18'), ('6.16.0', '2026-10-25'), ('6.17.0', '2026-11-07'), ('6.18.0', '2026-11-11')]
   last v5: [('5.23.0', '2026-04-13'), ('5.24.0', '2026-04-23'), ('5.24.1', '2026-11-11')] | first v6: [('6.0.0', '2026-07-22'), ('6.1.0', '2026-07-30')] | last v6: [('6.16.0', '2026-10-25'), ('6.17.0', '2026-11-07'), ('6.18.0', '2026-11-11')]
    6.18.0 type: module | main: None | module: dist/maplibre-gl.mjs | exports keys: ['.', './dist/*', './package.json'] | engines: {'npm': '>=8.1.0', 'node': '>=16.14.0'}
    5.24.1 type: module | main: dist/maplibre-gl.js | module: None | exports keys: [] | engines: {'npm': '>=8.1.0', 'node': '>=16.14.0'}
````

Scoped packages and geotiff (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 293):

````
pkg status=200 bytes=83919
pkg status=200 bytes=11918
pkg status=200 bytes=21492
== @geomatico/maplibre-cog-protocol | dist-tags: {'latest': '0.10.0'}
   latest 5 stable by semver: [('0.9.0', '2026-05-29'), ('0.9.1', '2026-07-30'), ('0.9.2', '2026-08-17'), ('0.9.3', '2026-09-10'), ('0.10.0', '2026-09-18')]
   latest pkg: type: None | main: ./dist/index.js | module: ./dist/esm/index.js | peerDependencies: {'maplibre-gl': '^4.5.0 || ^5.0.0 || ^6.0.0'} | license: MIT | deps: {'geotiff': '^3.0.5', 'd3-scale': '^4.0.2', 'quick-lru': '^7.1.0', '@mapbox/sphericalmercator': '^2.0.2'}
   readme chars: 28483
== geotiff | dist-tags: {'beta': '3.1.0-beta.0', 'latest': '3.0.5'}
   latest 5 stable by semver: [('3.0.1', '2026-02-08'), ('3.0.2', '2026-02-10'), ('3.0.3', '2026-02-12'), ('3.0.4', '2026-03-02'), ('3.0.5', '2026-03-11')]
   latest pkg: type: module | main: dist-node/geotiff.js | module: dist-module/geotiff.js | peerDependencies: None | license: MIT | deps: {'lerc': '^3.0.0', 'pako': '^2.0.4', 'zstddec': '^0.2.0', 'quick-lru': '^6.1.1', 'xml-utils': '^1.10.2', 'web-worker': '^1.5.0', 'parse-headers': '^2.0.2', '@petamoriken/float16': '^3.9.3'}
   v3 releases: [('3.0.0', '2026-01-25'), ('3.0.1', '2026-02-08'), ('3.0.2', '2026-02-10'), ('3.0.3', '2026-02-12'), ('3.0.4', '2026-03-02'), ('3.0.5', '2026-03-11')]
== @maplibre/maplibre-gl-compare | dist-tags: {'latest': '0.5.0'}
   latest 5 stable by semver: [('0.5.0', '2021-08-11')]
   latest pkg: type: None | main: index.js | module: None | peerDependencies: {'maplibre-gl': '>=1.14.0'} | license: ISC | deps: {'@mapbox/mapbox-gl-sync-move': '^0.3.0'}
== @mapbox/mapbox-gl-sync-move | dist-tags: {'latest': '0.4.0', 'prerelease': '0.3.2-de9ffac'}
   latest 5 stable by semver: [('0.2.0', '2017-01-24'), ('0.3.0', '2019-06-05'), ('0.3.1', '2022-08-26'), ('0.4.0', '2026-11-09')]
   latest pkg: type: None | main: index.js | module: None | peerDependencies: None | license: ISC | deps: None
````

`vite`, read by the digest author from the saved `$FC/run2/dl/npm/vite.json`: dist-tags latest 8.3.8 (2026-11-11), previous 6.4.6, beta 8.3.0-beta.1; `engines.node` of 8.3.8 is `^20.19.0 || >=22.12.0`.


### 8.12 Hosting, Resources tab, Appendix C

Range request on GitHub Pages (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 285):

````
== find a file on a github.io site
pages.github.com status=200 bytes=14446
href="/css/pages.css"
src="/images/logo.svg"
src="/images/slideshow/bootstrap.png"
src="images/dashboard@2x.png"
src="images/repo-settings@2x.png"
src="images/launch-theme-chooser@2x.png"
src="images/theme-chooser@2x.png"
src="images/code-editor@2x.png"
== range request test on GitHub Pages (pages.github.com)
HTTP/2 206  server: GitHub.com content-type: image/png access-control-allow-origin: * accept-ranges: bytes content-range: bytes 0-99/435382 content-length: 100  <- https://pages.github.com/images/dashboard@2x.png
HTTP/2 206  server: GitHub.com content-type: text/css; charset=utf-8 access-control-allow-origin: * accept-ranges: bytes content-range: bytes 0-99/12226 content-length: 100  <- https://pages.github.com/css/pages.css
````

Links on the challenge's live Resources tab (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 222; link lines only):

````
NASA Earthdata Search -> https://search.earthdata.nasa.gov/search
ASF Data Search Vertex -> https://search.asf.alaska.edu/
NISAR Data User Guide -> https://nisar-docs.asf.alaska.edu/
Intro to Remote Sensing -> https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing
Intro to Synthetic Aperture Radar (SAR) -> https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar
NASA ARSET Trainings -> https://appliedsciences.nasa.gov/get-involved/training
NISAR StoryMaps -> https://nisar.jpl.nasa.gov/applications/arcgis-storymaps/
NISAR Applications White Papers -> https://nisar.jpl.nasa.gov/applications/societal-benefit/
UAVSAR Postcards -> https://uavsar.jpl.nasa.gov/education/postcards.html
Radarsat Constellation Mission (RCM) - Data -> https://donnees-data.asc-csa.gc.ca/en/dataset/rcm
Synthetic Aperture Radar python Tutorial -> https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial
RADARSAT 1 - Data -> https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1
SAOCOM Catalogue -> https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html
SAOCOM Catalogue Registration -> https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible
````

HTTP status of the Appendix C URLs (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 226):

````
== Appendix C URLs as written in the brief
c01_eds | status=200 | redirects=0 | bytes=14874 | final=https://search.earthdata.nasa.gov/search
c02_vertex | status=200 | redirects=0 | bytes=90083 | final=https://search.asf.alaska.edu/
c03_guide | status=200 | redirects=0 | bytes=106036 | final=https://nisar-docs.asf.alaska.edu/
c04_cookbook | status=200 | redirects=0 | bytes=292906 | final=https://github.com/ASFOpenSARlab/NISAR_Cookbook
c05_sar | status=200 | redirects=0 | bytes=184751 | final=https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar
c05b_sar_interp | status=200 | redirects=0 | bytes=148683 | final=https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar/image-interpretation
c06_rs | status=200 | redirects=0 | bytes=223538 | final=https://www.earthdata.nasa.gov/learn/earth-observation-data-basics
c07_arset | status=200 | redirects=0 | bytes=189354 | final=https://www.earthdata.nasa.gov/data/projects/arset
c08_storymaps | status=200 | redirects=0 | bytes=288726 | final=https://science.nasa.gov/mission/nisar/arcgis-storymaps/
c09_whitepapers | status=200 | redirects=0 | bytes=318472 | final=https://science.nasa.gov/mission/nisar/societal-benefits/
c10_uavsar | status=200 | redirects=0 | bytes=23842 | final=https://uavsar.jpl.nasa.gov/education/postcards.html
c11_rcm | status=200 | redirects=0 | bytes=52262 | final=https://donnees-data.asc-csa.gc.ca/en/dataset/rcm
c12_csatut | status=200 | redirects=0 | bytes=264331 | final=https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial
c13_r1 | status=200 | redirects=0 | bytes=49704 | final=https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1
c14_saocom | status=200 | redirects=0 | bytes=7382 | final=https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html
== Live Resources-tab URLs that differ from the brief
t06_rs | status=200 | redirects=1 | bytes=223538 | final=https://www.earthdata.nasa.gov/learn/earth-observation-data-basics
t07_arset | status=200 | redirects=1 | bytes=189354 | final=https://www.earthdata.nasa.gov/data/projects/arset
t08_storymaps | status=200 | redirects=1 | bytes=288720 | final=https://science.nasa.gov/mission/nisar/arcgis-storymaps/
t09_whitepapers | status=200 | redirects=1 | bytes=318466 | final=https://science.nasa.gov/mission/nisar/societal-benefits/
t15_saocomreg | status=200 | redirects=0 | bytes=41735 | final=https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible
== 'Also worth knowing' repos
w1_nsa | status=200 | redirects=0 | bytes=205664 | final=https://github.com/NISAR-Science-Algorithms
w2_hyp3cv | status=200 | redirects=0 | bytes=239103 | final=https://github.com/ASFHyP3/hyp3-nisar-cv
````


### 8.13 The laptop (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, lines 66 and 70)

````
---machine
ProductName:		macOS
ProductVersion:		26.6.2
BuildVersion:		25G83
arm64
v22.15.0
10.9.2
Python 3.12.2
gdalinfo not found
gdal_translate not found
/dev/disk3s1s1   460Gi    12Gi    31Gi    28%    459k  327M    0%   /
Fri Nov 13 20:59:04 CST 2026
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1    494G     13G     33G    28%    459k  327M    0%   /
/dev/disk3s5      494G    417G     33G    93%    3.5M  327M    1%   /System/Volumes/Data

   Container Total Space:     494.4 GB (494384795648 Bytes) (exactly 965595304 512-Byte-Units)
   Container Free Space:      33.4 GB (33446146048 Bytes) (exactly 65324504 512-Byte-Units)
   APFS Container:            disk3

/opt/anaconda3/bin/curl
curl 8.7.1 (x86_64-apple-darwin25.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.68.1
PIL 10.4.0 numpy 1.26.4 h5py 3.11.0
````


## 9. Code that was shown to work, verbatim

Every script below ran to completion in the interrupted sessions and produced the outputs quoted above. They are copied byte for byte from the files named. Scripts from run 2 were run from `$FC/run2` with relative paths (`dl/...`, `out/...`, `scripts/...`); run 1 scripts take their paths as arguments. Network scripts call `/usr/bin/curl` or `urllib` with the user agent `fact-check-script` and no credentials.


### 9.1 `research/nisar_coverage.py` (the team's own helper; ran 56 times)

Source: `<prehackathon-repo>/research/nisar_coverage.py`

````python
"""Check NISAR coverage for any point on Earth. No login, no dependencies beyond Python 3.
Usage:  python3 nisar_coverage.py <lon> <lat> [GCOV|GUNW|GOFF|GSLC|SME2]
Prints one line per repeat-pass stack (track_direction_frame): how many dates, date range,
polarizations, bandwidth mode, median file size, and which release (B=beta, P=provisional, V=validated).
"""
import collections, json, statistics, sys, urllib.parse, urllib.request

COLLECTIONS = {  # CMR concept ids, verified 2026-11-13
    "GCOV": {"B": "C3622214170-ASF", "P": "C2854338529-ASF", "V": "C3622241360-ASF"},
    "GUNW": {"B": "C2850261892-ASF", "P": "C2854335566-ASF", "V": "C3622247503-ASF"},
    "GOFF": {"B": "C2850263910-ASF", "P": "C2854341702-ASF", "V": "C3622250865-ASF"},
    "GSLC": {"B": "C2850259510-ASF", "P": "C2854332392-ASF", "V": "C3622244601-ASF"},
    "SME2": {"B": "C2850265000-ASF", "P": "C2854344945-ASF"},
}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"


def granules(concept_id, lon, lat):
    search_after = None
    while True:
        query = urllib.parse.urlencode({"collection_concept_id": concept_id, "point": f"{lon},{lat}", "page_size": 2000})
        headers = {"User-Agent": "nisar-coverage-check"}
        if search_after:
            headers["CMR-Search-After"] = search_after
        with urllib.request.urlopen(urllib.request.Request(f"{CMR}?{query}", headers=headers), timeout=90) as resp:
            search_after = resp.headers.get("CMR-Search-After")
            items = json.load(resp).get("items", [])
        yield from items
        if len(items) < 2000 or not search_after:
            return


def main(lon, lat, product="GCOV"):
    stacks = collections.defaultdict(lambda: {"dates": set(), "rel": collections.Counter(), "mb": [], "pol": set(), "bw": set()})
    for release, concept_id in COLLECTIONS[product].items():
        for item in granules(concept_id, lon, lat):
            umm = item["umm"]
            attrs = {a["Name"]: a["Values"][0] for a in umm.get("AdditionalAttributes", [])}
            s = stacks[attrs.get("STACK_ID", "?")]
            s["dates"].add(umm["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10])
            s["rel"][release] += 1
            s["pol"].add(attrs.get("FREQUENCY_A_POLARIZATION_CONCAT", "?"))
            s["bw"].add(attrs.get("RANGE_BANDWIDTH_CONCAT", "?"))
            for f in umm["DataGranule"]["ArchiveAndDistributionInformation"]:
                if f["Name"].endswith(".h5") and "QA_STATS" not in f["Name"]:
                    s["mb"].append(f.get("SizeInBytes", 0) / 1e6)
    print(f"{product} at lon={lon} lat={lat}: {len(stacks)} stack(s)")
    for stack_id, s in sorted(stacks.items(), key=lambda kv: -len(kv[1]["dates"])):
        dates = sorted(s["dates"])
        print(f"  {stack_id:10s} {len(dates):3d} dates  {dates[0]} .. {dates[-1]}  pol={'/'.join(sorted(s['pol']))}  "
              f"bw={'/'.join(sorted(s['bw']))} MHz  ~{statistics.median(s['mb']):.0f} MB/file  releases={dict(s['rel'])}")
        print("             " + " ".join(d[5:] if d[:4] == dates[0][:4] else d for d in dates))


if __name__ == "__main__":
    main(float(sys.argv[1]), float(sys.argv[2]), sys.argv[3].upper() if len(sys.argv) > 3 else "GCOV")
````


### 9.2 Scripts from run 2 (`$FC/run2/scripts/`)


#### `run2/scripts/d5test.py`

D5 (COG writing) on a synthetic 8-bit UTM raster. Ran with rasterio 1.5.2 and rio-cogeo 7.0.4. To reuse: keep the `cog_translate` call, replace the synthetic source. Source: `<scratch>/review/fact-checker/run2/scripts/d5test.py`

````python
import numpy as np, rasterio, inspect, sys, os
from rasterio.transform import from_origin
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles
print('cog_translate signature:', inspect.signature(cog_translate))
src = 'out/d5/src_utm.tif'; dst = 'out/d5/dst_cog.tif'
# synthetic 8-bit raster, UTM 48N, 40 m pixels, 2500 x 2500 (100 km), nodata 0, values 1..255, with a nodata corner
rng = np.random.default_rng(0)
a = rng.integers(1, 256, size=(2500, 2500), dtype=np.uint8)
a[:300, :300] = 0
with rasterio.open(src, 'w', driver='GTiff', height=2500, width=2500, count=1, dtype='uint8', crs='EPSG:32648',
                   transform=from_origin(400000, 1500000, 40, 40), nodata=0, compress='deflate') as d:
    d.write(a, 1)
# exactly the call in D5
cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False)
with rasterio.open(dst) as d:
    print('output: crs', d.crs, '| size', d.width, d.height, '| dtype', d.dtypes, '| nodata', d.nodata, '| block', d.block_shapes, '| overviews', d.overviews(1),
          '| compress', d.compression, '| res', tuple(round(x, 3) for x in d.res), '| interleave', d.interleaving)
    b = d.read(1); print('   zero (nodata) fraction: %.3f' % (b == 0).mean(), '| min valid', b[b > 0].min(), 'max', b.max())
    print('   mask flags', d.mask_flag_enums)
print('cog_validate ->', cog_validate(dst))
print('size MB src %.1f dst %.1f' % (os.path.getsize(src) / 1e6, os.path.getsize(dst) / 1e6))
````


#### `run2/scripts/d3test.py`

D3 (window read) on a synthetic GCOV-shaped HDF5 file, using a local fsspec filesystem. To reuse against real data: `fs = earthaccess.get_fsspec_https_session()` after `earthaccess.login()`, and pass the granule's https `.h5` URL. Not yet run against a real file. Source: `<scratch>/review/fact-checker/run2/scripts/d3test.py`

````python
import h5py, numpy as np, fsspec
from pyproj import Transformer
# synthetic GCOV-like file (structure per brief Section 4.4): UTM 48N, 20 m, y descending, pixel centres
ny, nx = 3000, 2600
x = 400010.0 + 20.0 * np.arange(nx); y = 1500010.0 - 20.0 * np.arange(ny) - 20.0
path = 'out/d3/fake_gcov.h5'
with h5py.File(path, 'w') as f:
    g = f.create_group('/science/LSAR/GCOV/grids/frequencyA')
    g['xCoordinates'] = x; g['yCoordinates'] = y
    g.create_dataset('projection', data=np.uint32(32648))
    rows, cols = np.indices((ny, nx))
    g.create_dataset('HHHH', data=(rows * 10000 + cols).astype('float32'), chunks=(512, 512), compression='gzip')
    g.create_dataset('mask', data=np.ones((ny, nx), 'uint8'), chunks=(512, 512), compression='gzip')
fs = fsspec.filesystem('file')
def read_window(url, bbox, freq="A", terms=("HHHH", "HVHV")):
    with fs.open(url, mode="rb", cache_type="blockcache", block_size=8 * 1024 * 1024) as f, \
         h5py.File(f, "r") as h5:
        g = h5[f"/science/LSAR/GCOV/grids/frequency{freq}"]
        x, y = g["xCoordinates"][:], g["yCoordinates"][:]
        epsg = int(g["projection"][()])
        w, s, e, n = bbox
        xs, ys = Transformer.from_crs(4326, epsg, always_xy=True).transform([w, e, w, e], [s, s, n, n])
        c0, c1 = np.searchsorted(x, [min(xs), max(xs)])
        r0, r1 = np.searchsorted(-y, [-max(ys), -min(ys)])
        out = {t: g[t][r0:r1, c0:c1] for t in terms if t in g}
        out["mask"] = g["mask"][r0:r1, c0:c1]
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
        return out, epsg, (x[c0] - dx / 2, dx, 0.0, y[r0] - dy / 2, 0.0, dy), (r0, r1, c0, c1)
# bbox inside the file: convert chosen projected corners back to degrees
tinv = Transformer.from_crs(32648, 4326, always_xy=True)
w, s = tinv.transform(410000, 1460000); e, n = tinv.transform(430000, 1490000)
out, epsg, gt, idx = read_window(path, (w, s, e, n))
r0, r1, c0, c1 = idx
print('epsg', epsg, '| keys', list(out), '| window rows', r0, r1, 'cols', c0, c1, '| shape', out['HHHH'].shape)
print('geotransform', tuple(float(v) for v in gt))
print('first value encodes (row, col) =', divmod(int(out['HHHH'][0, 0]), 10000), '== (r0, c0)?', divmod(int(out['HHHH'][0, 0]), 10000) == (r0, c0))
print('x of col c0 centre', x[c0], 'y of row r0 centre', y[r0], '| y descending in window:', bool(y[r0] > y[r1 - 1]))
# compare with expected window from the projected corner box (bbox corners are skewed in UTM, so the window is the bounding box of 4 corners)
xs, ys = Transformer.from_crs(4326, 32648, always_xy=True).transform([w, e, w, e], [s, s, n, n])
print('requested UTM bbox x %.1f..%.1f y %.1f..%.1f' % (min(xs), max(xs), min(ys), max(ys)))
print('covered  UTM extent x %.1f..%.1f y %.1f..%.1f' % (gt[0], gt[0] + gt[1] * out['HHHH'].shape[1], gt[3] + gt[5] * out['HHHH'].shape[0], gt[3]))
````


#### `run2/scripts/d4check.py`

D4 (placing a browse PNG from its CMR polygon). Needs Pillow and numpy. Reads `dl/browse_latlon.png` and `dl/tonle.json`. Source: `<scratch>/review/fact-checker/run2/scripts/d4check.py`

````python
import json, sys
import numpy as np
from PIL import Image
im = Image.open('dl/browse_latlon.png')
print('PIL mode', im.mode, 'size', im.size, 'info.transparency =', im.info.get('transparency'))
rgba = np.asarray(im.convert('RGBA'))
rgb = rgba[..., :3]
black = (rgb.sum(axis=2) == 0)
transp = (rgba[..., 3] == 0)
print('pixels: total', black.size, '| pure black', int(black.sum()), '| alpha==0 after RGBA conversion', int(transp.sum()),
      '| black but opaque', int((black & ~transp).sum()))
H, W = black.shape
cols = np.where((~black).any(axis=0))[0]; rows = np.where((~black).any(axis=1))[0]
xl, xr, yt, yb = cols[0], cols[-1], rows[0], rows[-1]
print('footprint bbox xl,xr,yt,yb =', xl, xr, yt, yb, 'W,H =', W, H)
E = json.load(open('dl/tonle.json'))['feed']['entry']
e = [x for x in E if '20261017' in x['title']][0]
vals = list(map(float, e['polygons'][0][0].split()))
lats, lons = vals[0::2], vals[1::2]
lon_min, lon_max, lat_min, lat_max = min(lons), max(lons), min(lats), max(lats)
print('polygon lon', lon_min, lon_max, 'lat', lat_min, lat_max)
dlon = (lon_max - lon_min) / (xr - xl); west = lon_min - xl * dlon; east = west + W * dlon
dlat = (lat_max - lat_min) / (yb - yt); north = lat_max + yt * dlat; south = north - H * dlat
print('D4 formula -> west %.4f east %.4f north %.4f south %.4f' % (west, east, north, south))
print('deg/px lon %.6f lat %.6f  -> approx m/px lon %.1f lat %.1f' % (dlon, dlat, dlon * 111320 * np.cos(np.radians((north + south) / 2)), dlat * 110574))
````


#### `run2/scripts/tile.py`

lon/lat to tile indices, GIBS URL building, fetch with header capture. Writes into `dl/tiles`. Source: `<scratch>/review/fact-checker/run2/scripts/tile.py`

````python
import math, subprocess, sys, struct, zlib, os
def xyz(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y
def fetch(name, url):
    out = os.path.join('dl/tiles', name)
    r = subprocess.run(['/usr/bin/curl', '-s', '-m', '60', '-A', 'fact-check-script', '-H', 'Origin: https://example.org',
                        '-D', out + '.hdr', '-o', out, '-w', '%{http_code} %{size_download} %{content_type}', url],
                       capture_output=True, text=True)
    hdr = open(out + '.hdr', errors='replace').read().lower()
    acao = [l.split(':', 1)[1].strip() for l in hdr.splitlines() if l.startswith('access-control-allow-origin')]
    cc = [l.split(':', 1)[1].strip() for l in hdr.splitlines() if l.startswith('cache-control')]
    info = ''
    data = open(out, 'rb').read()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        w, h, bd, ct = struct.unpack('>IIBB', data[16:26])
        info = f'PNG {w}x{h} bitdepth={bd} colortype={ct}'
    elif data[:2] == b'\xff\xd8':
        info = 'JPEG'
    else:
        info = 'BODY: ' + data[:160].decode('utf8', 'replace').replace('\n', ' ')
    print(f'{name:28s} -> {r.stdout} | acao={acao} cache={cc} | {info}')
    print(f'    {url}')
base = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
L = 'NISAR_L2_Geocoded_Polarimetric_Covariance'
lon, lat = 104.05, 12.95
x8, y8 = xyz(lon, lat, 8)
print('z8 tile for Tonle Sap point: x=%d y=%d' % (x8, y8))
fetch('nisar_z8_1017.png', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_1029.png', f'{base}/{L}/default/2026-10-29/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_0619.png', f'{base}/{L}/default/2026-06-19/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_1018_nopass.png', f'{base}/{L}/default/2026-10-18/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_0801_ingap.png', f'{base}/{L}/default/2026-08-01/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_1112_after.png', f'{base}/{L}/default/2026-11-12/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_1113_after.png', f'{base}/{L}/default/2026-11-13/GoogleMapsCompatible_Level13/8/{y8}/{x8}.png')
fetch('nisar_z8_swapped.png', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level13/8/{x8}/{y8}.png')
x13, y13 = xyz(lon, lat, 13)
fetch('nisar_z13_1017.png', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level13/13/{y13}/{x13}.png')
x14, y14 = xyz(lon, lat, 14)
fetch('nisar_z14_1017.png', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level13/14/{y14}/{x14}.png')
fetch('nisar_z8_wrongtms.png', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level12/8/{y8}/{x8}.png')
fetch('nisar_z8_jpg.jpg', f'{base}/{L}/default/2026-10-17/GoogleMapsCompatible_Level13/8/{y8}/{x8}.jpg')
````


#### `run2/scripts/tile2.py`

Same fetch for the other GIBS layers; it re-uses the top of `tile.py` by `exec`. Source: `<scratch>/review/fact-checker/run2/scripts/tile2.py`

````python
import sys, os
sys.path.insert(0, os.path.join(os.getcwd(), 'scripts'))
import importlib.util
src = open('scripts/tile.py').read().split("base = 'https://gibs")[0]
exec(src)
base = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
lon, lat = 104.05, 12.95
x8, y8 = xyz(lon, lat, 8)
d = '2026-10-17'
for lyr in ['OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1', 'OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1',
            'OPERA_L3_Dynamic_Surface_Water_Extent-HLS', 'OPERA_L3_DIST-ALERT-HLS_Color_Index',
            'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance']:
    fetch(lyr[:22] + '_' + lyr[-6:] + '.png', f'{base}/{lyr}/default/{d}/GoogleMapsCompatible_Level12/8/{y8}/{x8}.png')
M = 'MODIS_Terra_CorrectedReflectance_TrueColor'
fetch('modis.jpg', f'{base}/{M}/default/{d}/GoogleMapsCompatible_Level9/8/{y8}/{x8}.jpg')
fetch('modis.jpeg', f'{base}/{M}/default/{d}/GoogleMapsCompatible_Level9/8/{y8}/{x8}.jpeg')
fetch('modis_as_png.png', f'{base}/{M}/default/{d}/GoogleMapsCompatible_Level9/8/{y8}/{x8}.png')
# S1 RTC on a few dates near Tonle Sap to see non-empty
for dd in ['2026-10-16', '2026-10-18', '2026-10-20', '2026-10-22']:
    fetch(f'rtc_{dd}.png', f'{base}/OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1/default/{dd}/GoogleMapsCompatible_Level12/8/{y8}/{x8}.png')
````


#### `run2/scripts/gibs_caps.py`

Print formats, tile matrix set, default date and date ranges of every layer whose id contains one of the arguments. Usage: `python3 gibs_caps.py WMTSCapabilities.xml NISAR`. Source: `<scratch>/review/fact-checker/run2/scripts/gibs_caps.py`

````python
import sys, xml.etree.ElementTree as ET
path = sys.argv[1]
ns = {'w': 'http://www.opengis.net/wmts/1.0', 'ows': 'http://www.opengis.net/ows/1.1'}
root = ET.parse(path).getroot()
layers = root.findall('.//w:Contents/w:Layer', ns)
print('total layers', len(layers))
want = sys.argv[2:]
for L in layers:
    ident = L.find('ows:Identifier', ns).text
    if not any(w in ident for w in want):
        continue
    title = L.find('ows:Title', ns).text
    fmts = [f.text for f in L.findall('w:Format', ns)]
    tms = [t.find('w:TileMatrixSet', ns).text for t in L.findall('w:TileMatrixSetLink', ns)]
    dim = L.find('w:Dimension', ns)
    default = dim.find('w:Default', ns).text if dim is not None else None
    values = [v.text for v in dim.findall('w:Value', ns)] if dim is not None else []
    res = [(r.get('resourceType'), r.get('format'), r.get('template')) for r in L.findall('w:ResourceURL', ns)]
    print('---', ident)
    print('  title  :', title)
    print('  formats:', fmts, ' tms:', tms)
    print('  default:', default)
    print('  values :', len(values), 'ranges; first', values[:1], 'last', values[-3:])
    if 'NISAR' in ident:
        for v in values: print('     ', v)
    for r in res: print('  res    :', r)
````


#### `run2/scripts/gibs_caps2.py`

Same for an exact list of layer ids, plus all OPERA and HLS ids and the tile matrix sets. Source: `<scratch>/review/fact-checker/run2/scripts/gibs_caps2.py`

````python
import sys, xml.etree.ElementTree as ET
path = sys.argv[1]
ns = {'w': 'http://www.opengis.net/wmts/1.0', 'ows': 'http://www.opengis.net/ows/1.1'}
root = ET.parse(path).getroot()
layers = {L.find('ows:Identifier', ns).text: L for L in root.findall('.//w:Contents/w:Layer', ns)}
exact = ['OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1', 'OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1',
         'OPERA_L3_Dynamic_Surface_Water_Extent-HLS', 'OPERA_L3_DIST-ALERT-HLS_Color_Index',
         'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance',
         'MODIS_Terra_CorrectedReflectance_TrueColor']
for ident in exact:
    L = layers.get(ident)
    if L is None:
        print('--- MISSING:', ident)
        print('    near matches:', [k for k in layers if ident.split('_')[0] in k and any(p in k for p in ident.split('_')[2:4])][:12])
        continue
    title = L.find('ows:Title', ns).text
    fmts = [f.text for f in L.findall('w:Format', ns)]
    tms = [t.find('w:TileMatrixSet', ns).text for t in L.findall('w:TileMatrixSetLink', ns)]
    dim = L.find('w:Dimension', ns)
    default = dim.find('w:Default', ns).text if dim is not None else None
    values = [v.text for v in dim.findall('w:Value', ns)] if dim is not None else []
    tmpl = [r.get('template') for r in L.findall('w:ResourceURL', ns) if r.get('resourceType') == 'tile'][:1]
    print('---', ident)
    print('  title:', title, '| formats:', fmts, '| tms:', tms, '| default:', default)
    print('  time ranges:', len(values), '| first:', values[:1], '| last:', values[-1:])
    print('  template ext:', tmpl[0].rsplit('.', 1)[-1] if tmpl else None)
print()
print('All OPERA layer ids:', sorted(k for k in layers if k.startswith('OPERA')))
print('All HLS layer ids:', sorted(k for k in layers if k.startswith('HLS')))
# tile matrix sets
for t in root.findall('.//w:Contents/w:TileMatrixSet', ns):
    tid = t.find('ows:Identifier', ns).text
    tm = t.findall('w:TileMatrix', ns)
    print('TMS', tid, 'levels', len(tm), 'maxzoom', tm[-1].find('ows:Identifier', ns).text, 'tile', tm[-1].find('w:TileWidth', ns).text, 'x', tm[-1].find('w:TileHeight', ns).text)
````


#### `run2/scripts/cmr_daily.py`

Granule counts per UTC day for two collections, via the `CMR-Hits` header with `page_size=0`. Source: `<scratch>/review/fact-checker/run2/scripts/cmr_daily.py`

````python
import json, subprocess, sys, datetime as dt
def hits(cid, t0, t1):
    url = f'https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id={cid}&temporal={t0},{t1}&page_size=0'
    out = subprocess.run(['/usr/bin/curl', '-s', '-g', '-m', '60', '-A', 'fact-check-script', '-D', '-', '-o', '/dev/null', url], capture_output=True, text=True).stdout
    for l in out.splitlines():
        if l.lower().startswith('cmr-hits'):
            return int(l.split(':')[1])
    return None
P, V = 'C2854338529-ASF', 'C3622241360-ASF'
print('GCOV granules whose acquisition overlaps each UTC day (provisional | validated):')
d = dt.date(2026, 10, 17)
while d <= dt.date(2026, 11, 14):
    t0 = f'{d}T00:00:00Z'; t1 = f'{d}T23:59:59Z'
    print(f'  {d}  P={hits(P, t0, t1):6d}  V={hits(V, t0, t1):6d}')
    d += dt.timedelta(days=1)
````


#### `run2/scripts/pngchunks.py`

PNG chunk and transparency inspector (standard library only). Source: `<scratch>/review/fact-checker/run2/scripts/pngchunks.py`

````python
import struct, sys, zlib
for p in sys.argv[1:]:
    d = open(p, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        print(p, 'not png'); continue
    i = 8; chunks = []; idat = b''; ihdr = None; trns = None; plte = None
    while i < len(d):
        ln, typ = struct.unpack('>I4s', d[i:i+8]); body = d[i+8:i+8+ln]
        chunks.append((typ.decode(), ln))
        if typ == b'IHDR': ihdr = struct.unpack('>IIBBBBB', body)
        if typ == b'IDAT': idat += body
        if typ == b'tRNS': trns = body
        if typ == b'PLTE': plte = body
        i += 12 + ln
    w, h, bd, ct = ihdr[:4]
    raw = zlib.decompress(idat)
    bpp = {2: 3, 6: 4, 3: 1, 0: 1}[ct]
    # count distinct raw bytes ignoring filter bytes roughly
    stride = w * bpp + 1
    rows = [raw[r*stride+1:(r+1)*stride] for r in range(h)]
    filt = set(raw[r*stride] for r in range(h))
    allzero = all(set(r) <= {0} for r in rows)
    print(p.split('/')[-1], '| size', len(d), '| ct', ct, '| chunks', [c for c in chunks if c[0] != 'IDAT'], '| tRNS', trns.hex() if trns else None,
          '| PLTE entries', (len(plte)//3 if plte else None), '| raw all zero' if allzero else '| has nonzero data', '| filters', sorted(filt))
````


#### `run2/scripts/pngchunks2.py`

Shorter PNG header and `tRNS` printer. Source: `<scratch>/review/fact-checker/run2/scripts/pngchunks2.py`

````python
import struct, sys
for p in sys.argv[1:]:
    d = open(p, 'rb').read()
    i = 8; chunks = {}; order = []
    while i < len(d):
        ln, typ = struct.unpack('>I4s', d[i:i+8]); t = typ.decode('latin1')
        if t not in chunks: order.append(t)
        chunks.setdefault(t, []).append(d[i+8:i+8+min(ln, 64)])
        i += 12 + ln
    ihdr = struct.unpack('>IIBBBBB', chunks['IHDR'][0][:13])
    print(p.split('/')[-1], '| bytes', len(d), '| IHDR w,h,bitdepth,colortype =', ihdr[:4], '| chunk types', order,
          '| tRNS', chunks['tRNS'][0].hex() if 'tRNS' in chunks else 'ABSENT')
````


#### `run2/scripts/page2text.py`

Crude HTML to text, used on the saved documentation pages. Source: `<scratch>/review/fact-checker/run2/scripts/page2text.py`

````python
import re, html, sys
def text(path):
    t = open(path, errors='replace').read()
    t = re.sub(r'(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>', ' ', t)
    t = re.sub(r'(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|td|th|section|article|pre)>', '\n', t)
    t = re.sub(r'(?s)<[^>]+>', ' ', t)
    t = html.unescape(t)
    t = re.sub(r'[ \t\r\f\v]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    return t.strip()
if __name__ == '__main__':
    for p in sys.argv[1:]:
        out = p.rsplit('.', 1)[0] + '.txt'
        open(out, 'w').write(text(p))
        print(out, len(open(out).read()))
````


#### `run2/scripts/nbgrep.py`

Regex search over the source of Jupyter notebook cells. Source: `<scratch>/review/fact-checker/run2/scripts/nbgrep.py`

````python
import json, re, sys
pat = re.compile(sys.argv[1], re.I)
for p in sys.argv[2:]:
    try:
        nb = json.load(open(p))
    except Exception as e:
        print(p, 'not json', e); continue
    for i, c in enumerate(nb.get('cells', [])):
        src = ''.join(c.get('source', []))
        if pat.search(src):
            lines = src.splitlines()
            for j, l in enumerate(lines):
                if pat.search(l):
                    ctx = lines[max(0, j-2): j+3]
                    print(f"--- {p.split('/')[-1]} cell {i} ({c['cell_type']})")
                    for x in ctx: print('    ', x[:330])
````


#### `run2/scripts/quotes.py`

Matches every quoted string of the brief against the saved rule pages and CHECKPOINT.md. Caveat: exact matching gives false negatives when the brief puts a comma or full stop inside the quotation marks. Source: `<scratch>/review/fact-checker/run2/scripts/quotes.py`

````python
import re, glob, sys
R = '<prehackathon-repo>/research'
def norm(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('‑', '-').replace('‐', '-').replace('–', '-').replace('—', '-').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()
brief = open(R + '/BUILD_PROMPT.md').read()
# join lines, strip blockquote markers
flat = re.sub(r'\n>\s?', '\n', brief)
flat = re.sub(r'\s+', ' ', flat)
rules = {p.split('/')[-1]: norm(open(p).read()) for p in glob.glob(R + '/evidence/rules/*.txt')}
ckpt = norm(open(R + '/CHECKPOINT.md').read())
quotes = re.findall(r'"([^"]{12,400})"', flat)
seen = set()
for q in quotes:
    if q in seen: continue
    seen.add(q)
    n = norm(q)
    parts = [p.strip() for p in n.split('...') if p.strip()]
    where = [name for name, txt in rules.items() if all(p in txt for p in parts)]
    in_ck = all(p in ckpt for p in parts)
    tag = ('RULES:' + ','.join(where)) if where else ('checkpoint-only' if in_ck else 'NOT FOUND in rules or checkpoint')
    print(f'[{tag}] "{q[:150]}"')
````


### 9.3 Scripts from run 1 (`$FC/scripts/`)


#### `scripts/gibs_survey.py`

Tile-health survey: fetches zoom 3 to 13 for a list of places and classifies each PNG; flags palette tiles whose palette is all black. Needs Pillow and numpy. Argument: a JSON list of `[name, lon, lat, date]`. Source: `<scratch>/review/fact-checker/scripts/gibs_survey.py`

````python
import io, math, struct, sys, urllib.request, json
from PIL import Image
import numpy as np
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{d}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png"
def tile(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
def classify(b):
    if b[:8] != b"\x89PNG\r\n\x1a\n": return "NOT-PNG"
    i = 8; ct = None; plte_nonblack = None; trns = None
    while i < len(b):
        n, typ = struct.unpack(">I4s", b[i:i+8]); data = b[i+8:i+8+n]; i += 12 + n
        if typ == b"IHDR": ct = data[9]
        elif typ == b"PLTE": plte_nonblack = sum(1 for k in range(0, n, 3) if data[k:k+3] != b"\0\0\0")
        elif typ == b"tRNS": trns = (n, sum(1 for v in data if v))
    im = Image.open(io.BytesIO(b)).convert("RGBA"); a = np.array(im)
    vis = float((a[..., 3] > 0).mean()); nonblack = float((a[..., :3].sum(axis=2) > 0).mean())
    kind = {2: "RGB", 3: "PAL", 6: "RGBA", 0: "GRAY", 4: "GRAYA"}.get(ct, str(ct))
    tag = ""
    if ct == 3 and plte_nonblack == 0 and len(b) > 1000: tag = "  <== ALL-BLACK PALETTE WITH DATA (renders invisible)"
    return f"{kind:4s} bytes={len(b):6d} plte_nonblack={plte_nonblack} tRNS={trns} visible={vis:5.1%} nonblack={nonblack:5.1%}{tag}"
places = json.loads(sys.argv[1])
for name, lon, lat, d in places:
    print(f"## {name} {lon},{lat} {d}")
    for z in range(3, 14):
        x, y = tile(lon, lat, z)
        url = BASE.format(d=d, z=z, y=y, x=x)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "fact-check-script"}), timeout=60) as r:
                b = r.read()
            print(f"  z{z:2d} {y}/{x}: {classify(b)}")
        except Exception as e:
            print(f"  z{z:2d} {y}/{x}: ERROR {e}")
````


#### `scripts/cmr_ranges.py`

First and last granule of six collections, the data-gap check, monthly and daily counts. Source: `<scratch>/review/fact-checker/scripts/cmr_ranges.py`

````python
import json, sys, urllib.parse, urllib.request
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
def q(params):
    url = CMR + "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"User-Agent": "fact-check-script"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return int(r.headers.get("CMR-Hits")), json.load(r)["feed"]["entry"]
COL = {"GCOV_V": "C3622241360-ASF", "GCOV_P": "C2854338529-ASF", "GCOV_B": "C3622214170-ASF",
       "GUNW_V": "C3622247503-ASF", "GUNW_P": "C2854335566-ASF", "SME2_P": "C2854344945-ASF"}
for name, cid in COL.items():
    h, first = q({"collection_concept_id": cid, "page_size": 1, "sort_key": "start_date"})
    _, last = q({"collection_concept_id": cid, "page_size": 1, "sort_key": "-start_date"})
    print(f"{name} {cid} hits={h} first={first[0]['time_start']} last={last[0]['time_start']}")
    print("    first:", first[0]["title"]); print("    last: ", last[0]["title"])
print("--- gap check, all three GCOV collections, temporal windows")
for label, t in [("2026-07-27T00:00Z..2026-07-27T23:59Z", "2026-07-27T00:00:00Z,2026-07-27T23:59:59Z"),
                 ("2026-07-27T22:03Z..2026-08-10T00:55Z", "2026-07-27T22:04:00Z,2026-08-10T00:54:00Z"),
                 ("2026-08-10T00:00Z..2026-08-10T23:59Z", "2026-08-10T00:00:00Z,2026-08-10T23:59:59Z")]:
    for name in ("GCOV_P", "GCOV_V", "GCOV_B"):
        h, e = q({"collection_concept_id": COL[name], "temporal": t, "page_size": 1, "sort_key": "start_date"})
        _, e2 = q({"collection_concept_id": COL[name], "temporal": t, "page_size": 1, "sort_key": "-start_date"}) if h else (0, [])
        print(f"  {label} {name}: hits={h}", (e[0]["time_start"], e2[0]["time_end"]) if h else "")
print("--- provisional GCOV per month")
months = ["2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11"]
import calendar
for m in months:
    y, mo = map(int, m.split("-")); last = calendar.monthrange(y, mo)[1]
    t = f"{m}-01T00:00:00Z,{m}-{last:02d}T23:59:59Z"
    row = []
    for name in ("GCOV_B", "GCOV_P", "GCOV_V"):
        h, _ = q({"collection_concept_id": COL[name], "temporal": t, "page_size": 0})
        row.append(f"{name}={h}")
    print("  ", m, " ".join(row))
print("--- validated GCOV per day in November 2026 and late October")
for d in ["2026-10-20","2026-10-21","2026-10-22","2026-10-23","2026-10-24","2026-10-30","2026-11-05","2026-11-06","2026-11-07","2026-11-08","2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13"]:
    t = f"{d}T00:00:00Z,{d}T23:59:59Z"
    hp, _ = q({"collection_concept_id": COL["GCOV_P"], "temporal": t, "page_size": 0})
    hv, _ = q({"collection_concept_id": COL["GCOV_V"], "temporal": t, "page_size": 0})
    print(f"   {d}: provisional={hp} validated={hv}")
````


#### `scripts/cmr_crid.py`

Counts granule names by wildcard pattern (`readable_granule_name[]` with `options[readable_granule_name][pattern]=true`): CRIDs, modes, polarization codes, track and frame extremes. Source: `<scratch>/review/fact-checker/scripts/cmr_crid.py`

````python
import json, sys, urllib.parse, urllib.request
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
def q(params):
    url = CMR + "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"User-Agent": "fact-check-script"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return int(r.headers.get("CMR-Hits")), json.load(r)["feed"]["entry"]
COL = {"GCOV_V": "C3622241360-ASF", "GCOV_P": "C2854338529-ASF", "GCOV_B": "C3622214170-ASF"}
def pat(cid, p):
    h, _ = q({"collection_concept_id": cid, "readable_granule_name[]": p, "options[readable_granule_name][pattern]": "true", "page_size": 0})
    return h
for name, pats in [("GCOV_P", ["*_P05023_*", "*_P050*", "*_PR_*", "*_UR_*", "*_N_F_J_*", "*_N_P_J_*", "*_J_001", "*_J_002", "*_J_003"]),
                   ("GCOV_V", ["*_P05036_*", "*_P050*", "*_PR_*", "*_N_F_J_*", "*_N_P_J_*", "*_J_001", "*_J_002"]),
                   ("GCOV_B", ["*_X050*", "*_X05010_*", "*_X05009_*", "*_X05008_*", "*_PR_*", "*_J_001", "*_J_002"])]:
    tot, _ = q({"collection_concept_id": COL[name], "page_size": 0})
    print(name, "total", tot, {p: pat(COL[name], p) for p in pats})
# mode / pol code census for provisional GCOV
print("--- mode codes, provisional GCOV")
for mode in ["2005", "4005", "7700", "0005", "2000", "4000", "7705", "0500", "2020", "4040"]:
    print("  mode", mode, pat(COL["GCOV_P"], f"NISAR_L2_PR_GCOV_???_???_?_???_{mode}_*"))
print("--- pol codes, provisional GCOV (freq A code + freq B code)")
for pol in ["SHSH", "DHDH", "QPDH", "QPQP", "SHNA", "NASH", "NADH", "SVSV", "DVDV", "NASV", "NADV", "CLCL", "CRCR", "QDDH", "QPNA", "DHNA", "SVNA", "DVNA", "SHDH", "DHSH"]:
    h = pat(COL["GCOV_P"], f"NISAR_L2_PR_GCOV_???_???_?_???_????_{pol}_*")
    if h: print("  pol", pol, h)
print("--- track and frame extremes")
for t in ["173", "174", "001", "000"]:
    print("  track", t, pat(COL["GCOV_P"], f"NISAR_L2_PR_GCOV_???_{t}_*"))
for f in ["176", "177", "001", "000"]:
    print("  frame", f, pat(COL["GCOV_P"], f"NISAR_L2_PR_GCOV_???_???_?_{f}_*"))
````


#### `scripts/gibs_caps.py`

Capabilities parser, first version (prints the named layers and every id containing NISAR, OPERA, HLS_, Sentinel-1 or SAR). Source: `<scratch>/review/fact-checker/scripts/gibs_caps.py`

````python
import sys, xml.etree.ElementTree as ET
ns = {"w": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}
root = ET.parse(sys.argv[1]).getroot()
layers = root.findall(".//w:Contents/w:Layer", ns)
print("total layers:", len(layers))
want = sys.argv[2:]
byid = {l.find("ows:Identifier", ns).text: l for l in layers}
def show(l):
    ident = l.find("ows:Identifier", ns).text
    title = l.find("ows:Title", ns).text
    fmt = [f.text for f in l.findall("w:Format", ns)]
    tms = [t.find("w:TileMatrixSet", ns).text for t in l.findall("w:TileMatrixSetLink", ns)]
    dim = l.find("w:Dimension", ns)
    default = dim.find("w:Default", ns).text if dim is not None else None
    vals = [v.text for v in dim.findall("w:Value", ns)] if dim is not None else []
    res = [(r.get("resourceType"), r.get("format"), r.get("template")) for r in l.findall("w:ResourceURL", ns)]
    print(f"\n{ident}\n  title: {title}\n  format: {fmt}\n  tms: {tms}\n  default: {default}\n  values({len(vals)}): {vals if len(vals) <= 12 else vals[:4] + ['...'] + vals[-6:]}")
    for r in res: print("  resource:", r)
for w in want:
    if w in byid: show(byid[w])
    else: print(f"\n{w}\n  ** NOT FOUND as an exact identifier")
print("\n--- all identifiers containing NISAR / OPERA / HLS_ / OrbitTracks_NISAR:")
for i in sorted(byid):
    if any(k in i for k in ("NISAR", "OPERA", "HLS_", "Sentinel-1", "SAR")):
        l = byid[i]
        tms = [t.find("w:TileMatrixSet", ns).text for t in l.findall("w:TileMatrixSetLink", ns)]
        fmt = [f.text for f in l.findall("w:Format", ns)]
        print("  ", i, tms, fmt, "|", l.find("ows:Title", ns).text)
````


#### `scripts/tile.py`

Prints `z y x` for a lon, lat and zoom. Source: `<scratch>/review/fact-checker/scripts/tile.py`

````python
import math, sys
lon, lat, z = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
n = 2 ** z
x = int((lon + 180) / 360 * n)
y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
print(z, y, x)
````


#### `scripts/pnginfo.py`

Pillow-based summary of mode, transparency and share of black or transparent pixels. Source: `<scratch>/review/fact-checker/scripts/pnginfo.py`

````python
import sys
from PIL import Image
import numpy as np
for p in sys.argv[1:]:
    im = Image.open(p)
    info = {k: (v if not isinstance(v, (bytes, bytearray)) or len(v) < 20 else f"<{len(v)} bytes>") for k, v in im.info.items()}
    a = np.array(im.convert("RGBA"))
    rgb = a[..., :3]
    black = (rgb.sum(axis=2) == 0)
    transp = (a[..., 3] == 0)
    print(p.split("/")[-1], "mode=", im.mode, "size=", im.size, "info=", info,
          "| black px %.1f%%" % (100 * black.mean()), "| alpha==0 px %.1f%%" % (100 * transp.mean()),
          "| unique colours", len(np.unique(a.reshape(-1, 4), axis=0)))
````


#### `scripts/pngdeep.py`

Palette-aware look at a tile: distinct indices, palette entries, alpha entries. Source: `<scratch>/review/fact-checker/scripts/pngdeep.py`

````python
import sys
from PIL import Image
import numpy as np
for p in sys.argv[1:]:
    im = Image.open(p)
    if im.mode == "P":
        idx = np.array(im)
        pal = np.array(im.getpalette()).reshape(-1, 3)
        tr = im.info.get("transparency")
        u, c = np.unique(idx, return_counts=True)
        print(p.split("/")[-1], "P-mode: distinct indices", len(u), "palette entries", len(pal),
              "tRNS", (list(tr[:8]) if isinstance(tr, (bytes, bytearray)) else tr),
              "nonzero-alpha entries", (sum(1 for b in tr if b) if isinstance(tr, (bytes, bytearray)) else None))
        print("   first palette rows", pal[:5].tolist(), "top indices", list(zip(u[:5].tolist(), c[:5].tolist())))
        rgb = pal[idx]
        print("   RGB mean", rgb.reshape(-1, 3).mean(axis=0).round(1).tolist(), "distinct RGB", len(np.unique(rgb.reshape(-1, 3), axis=0)))
    else:
        a = np.array(im)
        print(p.split("/")[-1], im.mode, "RGB mean", a.reshape(-1, a.shape[-1]).mean(axis=0).round(1).tolist(), im.info)
````


#### `scripts/pngchunks.py`

PNG chunk dump: IHDR, PLTE (non-black entries), tRNS. Source: `<scratch>/review/fact-checker/scripts/pngchunks.py`

````python
import struct, sys, zlib
for p in sys.argv[1:]:
    b = open(p, "rb").read()
    assert b[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    i = 8; out = []
    while i < len(b):
        n, typ = struct.unpack(">I4s", b[i:i+8]); data = b[i+8:i+8+n]; i += 12 + n
        t = typ.decode()
        if t == "IHDR":
            w, h, bd, ct, cm, fm, im = struct.unpack(">IIBBBBB", data)
            out.append(f"IHDR {w}x{h} bitdepth={bd} colortype={ct}")
        elif t == "PLTE":
            ents = [tuple(data[k:k+3]) for k in range(0, n, 3)]
            nz = sum(1 for e in ents if e != (0, 0, 0))
            out.append(f"PLTE entries={len(ents)} nonblack={nz} sample={ents[:3]}..{ents[-2:]}")
        elif t == "tRNS":
            out.append(f"tRNS len={n} zero-alpha={sum(1 for x in data if x == 0)} full-alpha={sum(1 for x in data if x == 255)} first={list(data[:6])}")
        elif t in ("tEXt", "iTXt", "zTXt"):
            out.append(f"{t} {data[:80]!r}")
        else:
            out.append(f"{t}({n})")
    print(p.split("/")[-1], "|", " ; ".join(out))
````


### 9.4 Shell commands that worked, verbatim from the transcripts

Each block is the exact `command` of one tool call. `S=...` is the scratch folder; change it. On this Mac the runs used `/usr/bin/curl` and `/opt/anaconda3/bin/python3`.


#### CMR: granule count and short name of each collection id (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 85)

````bash
S="<scratch>/review/fact-checker/run2"; mkdir -p "$S/scripts" "$S/dl" "$S/out"; cd "$S"
for id in C3622241360-ASF C2854338529-ASF C3622214170-ASF C3622247503-ASF C2854335566-ASF C2850261892-ASF C3622250865-ASF C2854341702-ASF C2850263910-ASF C2854344945-ASF C2850265000-ASF; do
  hits=$(/usr/bin/curl -s -m 60 -A "fact-check-script" -D - -o /dev/null "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=${id}&page_size=1" | tr -d '\r' | grep -i '^cmr-hits:' | awk '{print $2}')
  meta=$(/usr/bin/curl -s -m 60 -A "fact-check-script" "https://cmr.earthdata.nasa.gov/search/collections.json?concept_id=${id}" | /opt/anaconda3/bin/python3 -c "import sys,json; e=json.load(sys.stdin)['feed']['entry']; print(e[0]['short_name'], '|v', e[0].get('version_id'), '|', e[0].get('time_start'), '..', e[0].get('time_end'), '|', e[0].get('title')) if e else print('NO COLLECTION')")
  echo "$id hits=$hits  $meta"
done | tee out/cmr_collections.txt
````


#### Coverage script wrapper (one of five such calls) (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 89)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
SCRIPT=<prehackathon-repo>/research/nisar_coverage.py
run() { echo "### $1 ($2, $3) $4"; /opt/anaconda3/bin/python3 -B "$SCRIPT" "$2" "$3" ${4:-GCOV} 2>&1; echo; }
{
run "Mexico City" -99.1 19.4
run "Kilauea" -155.28 19.41
run "Tonle Sap" 104.05 12.95
run "Chicago" -87.65 41.85
} | tee out/coverage_a.txt
````


#### The brief's CMR granule query, headers and entry structure (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 109)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
URL='https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=104.05,12.95&page_size=2000&attribute[]=string,STACK_ID,083_A_008'
/usr/bin/curl -s -g -m 90 -A "fact-check-script" -H "Origin: https://example.org" -D dl/tonle_hdr.txt -o dl/tonle.json "$URL"; echo "exit=$?"
cat dl/tonle_hdr.txt | tr -d '\r' | grep -iE '^(HTTP|cmr-hits|cmr-search-after|access-control|content-type|cmr-took)'
/opt/anaconda3/bin/python3 - <<'EOF'
import json
d=json.load(open('dl/tonle.json'))
E=d['feed']['entry']
print('entries',len(E))
e=E[0]
print('keys',sorted(e.keys()))
for e in E:
    print(e['title'], e['time_start'], e.get('granule_size'), e.get('collection_concept_id'))
e=E[0]
print('polygons repr:', repr(e.get('polygons'))[:300])
for l in e['links']:
    print('  ', l.get('rel'), '|', l.get('href'), '|', l.get('type'), '|', l.get('title'))
EOF
````


#### Browse PNG without login: redirect, CORS, content type; KML and .h5 without login (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 113)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001
C=NISAR_L2_GCOV_PROVISIONAL_V1
B="https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/$C/$G/${G}_LATLON.png"
echo "== GET (follow redirects, no credentials, Origin header set) $B"
/usr/bin/curl -s -m 120 -L -A "fact-check-script" -H "Origin: https://example.org" -D dl/browse_hdr.txt -o dl/browse_latlon.png -w 'final_status=%{http_code} redirects=%{num_redirects} size=%{size_download} ctype=%{content_type}\nfinal_url_host=%{url_effective}\n' "$B" | sed -E 's/\?.*$/?<signed-query-removed>/'
echo "-- response header blocks:"
tr -d '\r' < dl/browse_hdr.txt | grep -iE '^(HTTP/|location:|access-control|content-type|content-length|cache-control|accept-ranges)' | sed -E 's/(location: [^?]*)\?.*/\1?<signed-query-removed>/'
file dl/browse_latlon.png
echo "== thumbnail"
/usr/bin/curl -s -m 120 -L -A "fact-check-script" -o dl/browse_thumb.png -w 'final_status=%{http_code} redirects=%{num_redirects} size=%{size_download} ctype=%{content_type}\n' "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/$C/$G/${G}_LATLON_thumbnail.png"
file dl/browse_thumb.png
echo "== KML without login"
/usr/bin/curl -s -m 60 -A "fact-check-script" -o /dev/null -D - "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/$C/$G/${G}_LATLON.kml" | tr -d '\r' | grep -iE '^(HTTP/|location:)' | cut -c1-160
echo "== data .h5 without login"
/usr/bin/curl -s -m 60 -A "fact-check-script" -o /dev/null -D - "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/$C/$G/${G}.h5" | tr -d '\r' | grep -iE '^(HTTP/|location:)' | cut -c1-200
````


#### Which granule files need login, which browse variants are public (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 85)

````bash
S="<scratch>/review/fact-checker"; G=NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001; C=NISAR_L2_GCOV_PROVISIONAL_V1;
for suffix in "_LATLON.kml" ".h5" "_QA_SUMMARY.csv" "_QA_REPORT.pdf" ".h5.iso.xml"; do
echo "=== /NISAR/.../${suffix} (no login, no redirect following)"; /usr/bin/curl -s -A "fact-check-script" -H "Origin: https://example.org" -r 0-99 -D - -o /dev/null -w "http=%{http_code}\n" "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/$C/$G/${G}${suffix}" | tr -d '\r' | grep -iE "^HTTP|^location:|access-control-allow-origin|^http=" | sed -E 's/(client_id=)[^&]*/\1.../; s/(state=)[^&]*/\1.../' | cut -c1-230
done
echo "=== BROWSE variants"; for suffix in "_NATIVE.png" "_NATIVE_A_HHHH.png" "_NATIVE_B_HVHV.png" "_LATLON.kml"; do /usr/bin/curl -s -A "fact-check-script" -L -o /dev/null -w "${suffix}: http=%{http_code} redirects=%{num_redirects} size=%{size_download} final=%{url_effective}\n" "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/$C/$G/${G}${suffix}" | cut -c1-200; done
````


#### Browse response headers; validated GCOV after the GIBS end date; newest and oldest validated granule (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 145)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
tr -d '\r' < dl/browse_hdr.txt | grep -viE '^(location|set-cookie|x-amz-cf-id|x-amz-request-id|x-amz-id-2|x-amzn|via|x-cache|x-amz-cf-pop)' | cut -c1-200
echo; echo "== CMR: validated GCOV granules with start after GIBS end date (2026-11-11)"
for t in "2026-11-12T00:00:00Z," "2026-11-13T00:00:00Z," "2026-11-14T00:00:00Z,"; do
 /usr/bin/curl -s -g -m 60 -A "fact-check-script" -D - -o /dev/null "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C3622241360-ASF&temporal=$t&page_size=1" | tr -d '\r' | grep -i '^cmr-hits' | sed "s/^/temporal>=$t /"
done
echo "== latest validated GCOV granule"
/usr/bin/curl -s -g -m 60 -A "fact-check-script" "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C3622241360-ASF&sort_key=-start_date&page_size=3" | /opt/anaconda3/bin/python3 -c "import sys,json; [print(e['title'], e['time_start'], e['updated']) for e in json.load(sys.stdin)['feed']['entry']]"
echo "== earliest validated GCOV granule"
/usr/bin/curl -s -g -m 60 -A "fact-check-script" "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C3622241360-ASF&sort_key=start_date&page_size=3" | /opt/anaconda3/bin/python3 -c "import sys,json; [print(e['title'], e['time_start'], e['updated']) for e in json.load(sys.stdin)['feed']['entry']]"
````


#### Mexico City interferogram pairs with their time spans (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 105)

````bash
S="<scratch>/review/fact-checker"; /usr/bin/curl -s -g -A "fact-check-script" "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854335566-ASF&point=-99.1,19.4&page_size=200&attribute[]=string,STACK_ID,019_A_011&sort_key=start_date" -o "$S/dl_cmr/mex_gunw.json"; /opt/anaconda3/bin/python3 -I - "$S/dl_cmr/mex_gunw.json" <<'EOF'
import json, sys, re, datetime
e = json.load(open(sys.argv[1]))['feed']['entry']
print(len(e), 'granules')
for x in e:
    m = re.search(r'_(\d{8})T\d{6}_\d{8}T\d{6}_(\d{8})T\d{6}_', x['title'])
    a = datetime.datetime.strptime(m.group(1), '%Y%m%d'); b = datetime.datetime.strptime(m.group(2), '%Y%m%d')
    print(x['title'][:60], m.group(1), '->', m.group(2), (b-a).days, 'days', round(float(x['granule_size'])), 'MB')
EOF
````


#### GIBS tiles through a small shell helper (first run) (run 1, `agent-a5f13a3de1ea8fff6.jsonl`, line 113)

````bash
S="<scratch>/review/fact-checker"; mkdir -p "$S/dl_tiles"; cat > "$S/scripts/tile.py" <<'EOF'
import math, sys
lon, lat, z = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
n = 2 ** z
x = int((lon + 180) / 360 * n)
y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
print(z, y, x)
EOF
T() { /opt/anaconda3/bin/python3 -I "$S/scripts/tile.py" "$@"; }
base="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
fetch() { # layer date tms z y x ext label
  out="$S/dl_tiles/$8"; /usr/bin/curl -s -A "fact-check-script" -H "Origin: https://example.org" -D "$out.hdr" -o "$out" -w "$8: http=%{http_code} size=%{size_download} ctype=%{content_type}" "$base/$1/default/$2/$3/$4/$5/$6.$7"; echo "  | $(tr -d '\r' < "$out.hdr" | grep -iE '^(access-control-allow-origin|cache-control):' | tr '\n' ' ')| $(file -b "$out" | cut -c1-60)"; }
L=NISAR_L2_Geocoded_Polarimetric_Covariance
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-10-17 GoogleMapsCompatible_Level13 $z $y $x png nisar_z8_1017.png
read z y x <<< "$(T 104.05 12.95 13)"; fetch $L 2026-10-17 GoogleMapsCompatible_Level13 $z $y $x png nisar_z13_1017.png
read z y x <<< "$(T 104.05 12.95 14)"; fetch $L 2026-10-17 GoogleMapsCompatible_Level13 $z $y $x png nisar_z14_1017.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-10-18 GoogleMapsCompatible_Level13 $z $y $x png nisar_z8_1018_nopass.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-08-01 GoogleMapsCompatible_Level13 $z $y $x png nisar_z8_0801_ingap.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-11-12 GoogleMapsCompatible_Level13 $z $y $x png nisar_z8_1112_afterend.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-10-29 GoogleMapsCompatible_Level13 $z $y $x png nisar_z8_1029.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png nisar_z8_wrongtms.png
read z y x <<< "$(T 104.05 12.95 8)";  fetch $L 2026-10-17 GoogleMapsCompatible_Level13 $z $x $y png nisar_z8_xy_swapped.png
echo "--- other layers (z=8 over Tonle Sap unless noted)"
read z y x <<< "$(T 104.05 12.95 8)"
fetch OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png rtc_s1.png
fetch OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png dswx_s1.png
fetch OPERA_L3_Dynamic_Surface_Water_Extent-HLS 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png dswx_hls.png
fetch OPERA_L3_DIST-ALERT-HLS_Color_Index 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png dist_alert.png
fetch HLS_S30_Nadir_BRDF_Adjusted_Reflectance 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png hls_s30.png
fetch HLS_L30_Nadir_BRDF_Adjusted_Reflectance 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x png hls_l30.png
fetch MODIS_Terra_CorrectedReflectance_TrueColor 2026-10-17 GoogleMapsCompatible_Level9 $z $y $x jpg modis_jpg.jpg
fetch MODIS_Terra_CorrectedReflectance_TrueColor 2026-10-17 GoogleMapsCompatible_Level9 $z $y $x jpeg modis_jpeg.jpeg
fetch MODIS_Terra_CorrectedReflectance_TrueColor 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x jpg modis_wrongtms.jpg
fetch HLS_S30_Nadir_BRDF_Adjusted_Reflectance 2026-10-17 GoogleMapsCompatible_Level12 $z $y $x jpg hls_s30_as_jpg.jpg
````


#### Range request and CORS on a live GitHub Pages site (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 284)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
echo "== find a file on a github.io site"
/usr/bin/curl -s -L -m 30 -A "fact-check-script" -o dl/hosting/pages_home.html -w "pages.github.com status=%{http_code} bytes=%{size_download}\n" "https://pages.github.com/"
grep -o -E '(src|href)="[^"]+\.(png|jpg|svg|css|js|mp4|webm)"' dl/hosting/pages_home.html | head -8
echo "== range request test on GitHub Pages (pages.github.com)"
for u in "https://pages.github.com/images/dashboard@2x.png" "https://pages.github.com/css/pages.css"; do
  /usr/bin/curl -s -m 30 -A "fact-check-script" -H "Origin: https://example.org" -r 0-99 -D - -o /dev/null "$u" | tr -d '\r' | grep -iE '^(HTTP/|content-range|content-length|accept-ranges|access-control-allow-origin|server|content-type)' | tr '\n' ' '; echo " <- $u"
done
````


#### npm registry: versions of the scoped packages and geotiff (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 292)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
for p in @geomatico/maplibre-cog-protocol @maplibre/maplibre-gl-compare @mapbox/mapbox-gl-sync-move; do
  o="dl/npm/$(echo $p | tr '/@' '__').json"
  /usr/bin/curl -s -m 60 -A "fact-check-script" -o "$o" -w "pkg status=%{http_code} bytes=%{size_download}\n" "https://registry.npmjs.org/$(echo $p | sed 's#/#%2f#')"
done
/opt/anaconda3/bin/python3 -I - <<'EOF'
import json, glob, re
def load(n): return json.load(open(f'dl/npm/{n}.json'))
def ver_key(v):
    m = re.match(r'(\d+)\.(\d+)\.(\d+)(.*)', v); return (int(m[1]), int(m[2]), int(m[3]), m[4] == '', m[4]) if m else (0,0,0,False,v)
for n in ['_geomatico_maplibre-cog-protocol', 'geotiff', '_maplibre_maplibre-gl-compare', '_mapbox_mapbox-gl-sync-move']:
    d = load(n); t = d['time']; tags = d['dist-tags']
    print('==', d['name'], '| dist-tags:', tags)
    stable = sorted([v for v in d['versions'] if re.fullmatch(r'\d+\.\d+\.\d+', v)], key=ver_key)
    print('   latest 5 stable by semver:', [(v, t[v][:10]) for v in stable[-5:]])
    pk = d['versions'][tags['latest']]
    print('   latest pkg: type:', pk.get('type'), '| main:', pk.get('main'), '| module:', pk.get('module'), '| peerDependencies:', pk.get('peerDependencies'), '| license:', pk.get('license'), '| deps:', pk.get('dependencies'))
    if 'cog-protocol' in d['name']:
        open('dl/npm/cog_readme.md', 'w').write(d.get('readme') or ''); print('   readme chars:', len(d.get('readme') or ''))
    if d['name'] == 'geotiff':
        open('dl/npm/geotiff_readme.md', 'w').write(d.get('readme') or '')
        three = [v for v in stable if v.startswith('3.')]; print('   v3 releases:', [(v, t[v][:10]) for v in three])
EOF
````


#### PyPI: versions, requires_python, wheel tags (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 308)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"; mkdir -p dl/pypi
for p in asf_search earthaccess rasterio rio-cogeo h5py pyproj numpy scipy fsspec aiohttp; do
  /usr/bin/curl -s -m 60 -A "fact-check-script" -o "dl/pypi/$p.json" -w "$p status=%{http_code} bytes=%{size_download}\n" "https://pypi.org/pypi/$p/json"
done
/opt/anaconda3/bin/python3 -I - <<'EOF'
import json, re
for p in ['asf_search', 'earthaccess', 'rasterio', 'rio-cogeo', 'h5py', 'pyproj', 'numpy', 'scipy']:
    d = json.load(open(f'dl/pypi/{p}.json'))
    info = d['info']
    rel = d['releases']
    def up(v):
        f = rel.get(v) or []
        return f[0]['upload_time'][:10] if f else '?'
    vers = [v for v in rel if re.fullmatch(r'\d+(\.\d+)*', v) and rel[v]]
    vers.sort(key=lambda v: tuple(int(x) for x in v.split('.')))
    print(f"== {info['name']} latest={info['version']} ({up(info['version'])}) requires_python={info.get('requires_python')} | last 4: {[(v, up(v)) for v in vers[-4:]]}")
    if p in ('rasterio', 'h5py'):
        files = d['urls']
        tags = sorted(set(re.search(r'-(cp\d+|pp\d+)-', f['filename']).group(1) for f in files if f['filename'].endswith('.whl') and re.search(r'-(cp\d+|pp\d+)-', f['filename'])))
        plats = sorted(set('macos-arm64' if 'macosx' in f['filename'] and 'arm64' in f['filename'] else 'macos-x86_64' if 'macosx' in f['filename'] else 'linux' if 'manylinux' in f['filename'] else 'win' if 'win' in f['filename'] else 'other' for f in files if f['filename'].endswith('.whl')))
        print('   wheel python tags:', tags, '| platforms:', plats)
EOF
````


#### Scratch virtualenv and pip install (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 312)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
/opt/anaconda3/bin/python3 -m venv venv 2>&1 | tail -2
./venv/bin/python -m pip install --quiet --disable-pip-version-check --no-input rasterio rio-cogeo h5py numpy pyproj asf_search earthaccess 2>&1 | tail -5
./venv/bin/python -m pip list --disable-pip-version-check 2>/dev/null | grep -iE "^(rasterio|rio-cogeo|h5py|numpy|pyproj|asf.search|earthaccess|fsspec|aiohttp|morecantile|pydantic|s3fs|affine) " 
````


#### Introspection of rasterio, earthaccess, asf_search (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 315)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
./venv/bin/python - <<'EOF' 2>&1 | cut -c1-600
import rasterio, inspect
print('rasterio', rasterio.__version__, '| bundled GDAL', rasterio.__gdal_version__)
from rasterio.drivers import raster_driver_extensions
import rasterio.env
with rasterio.Env() as env:
    drv = env.drivers()
    print('drivers present -> HDF5:', 'HDF5' in drv, '| netCDF:', 'netCDF' in drv, '| COG:', 'COG' in drv, '| GTiff:', 'GTiff' in drv)
import earthaccess
print('earthaccess', earthaccess.__version__)
from earthaccess.results import DataGranule
print('DataGranule.size is property:', isinstance(inspect.getattr_static(DataGranule, 'size'), property))
print('has get_fsspec_https_session:', hasattr(earthaccess, 'get_fsspec_https_session'))
print('login signature:', inspect.signature(earthaccess.login))
print('get_fsspec_https_session doc:', (earthaccess.get_fsspec_https_session.__doc__ or '').strip().splitlines()[:6])
import asf_search as asf
print('asf_search', asf.__version__)
print('DATASET.NISAR =', getattr(asf.DATASET, 'NISAR', 'MISSING'), '| PRODUCT_TYPE.GCOV =', getattr(asf.PRODUCT_TYPE, 'GCOV', 'MISSING'))
sig = inspect.signature(asf.search)
for k in ['dataset', 'processingLevel', 'dataMaturity', 'productionConfiguration', 'intersectsWith', 'relativeOrbit', 'frame', 'start', 'end']:
    print('   asf.search param', k, '->', k in sig.parameters)
EOF
````


#### The brief's asf_search snippet, live, no login (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 319)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
./venv/bin/python - <<'EOF' 2>&1 | cut -c1-400 | tail -40
import asf_search as asf, time
t = time.time()
results = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
                     dataMaturity='PROVISIONAL', productionConfiguration='PR',
                     intersectsWith='POINT(104.05 12.95)', relativeOrbit=83, frame=8)
print('brief snippet -> results:', len(results), 'in %.1fs' % (time.time() - t))
for r in sorted(results, key=lambda r: r.properties['startTime']):
    p = r.properties
    print('  ', p.get('sceneName') or p.get('fileID'), p.get('startTime'), '| url:', (p.get('url') or '')[-40:])
print('property keys:', sorted(results[0].properties.keys())[:60])
# without productionConfiguration
r2 = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, dataMaturity='PROVISIONAL',
                intersectsWith='POINT(104.05 12.95)', relativeOrbit=83, frame=8)
print('without productionConfiguration ->', len(r2), 'results;', sum('_UR_' in (x.properties.get('sceneName') or '') for x in r2), 'urgent-response names')
# VALIDATED
r3 = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, dataMaturity='VALIDATED', productionConfiguration='PR',
                intersectsWith='POINT(104.05 12.95)', relativeOrbit=83, frame=8)
print('VALIDATED ->', len(r3), [x.properties.get('sceneName')[-60:] for x in r3])
EOF
````


#### asf_search with and without dataMaturity and productionConfiguration; urgent-response collection (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 323)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
./venv/bin/python - <<'EOF' 2>&1 | cut -c1-330 | tail -30
import asf_search as asf, collections
def summarize(tag, **kw):
    r = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, intersectsWith='POINT(-155.28 19.41)', **kw)
    names = [x.properties.get('sceneName') or '' for x in r]
    kinds = collections.Counter(n.split('_')[2] if n.count('_') > 3 else '?' for n in names)
    colls = collections.Counter(x.properties.get('collectionName') or x.properties.get('conceptID') for x in r)
    print(f'{tag}: {len(r)} results | PR/UR by name: {dict(kinds)} | collections: {dict(colls)}')
    return r
summarize('Kilauea, dataMaturity=PROVISIONAL, no productionConfiguration', dataMaturity='PROVISIONAL')
summarize('Kilauea, dataMaturity=PROVISIONAL, productionConfiguration=PR', dataMaturity='PROVISIONAL', productionConfiguration='PR')
summarize('Kilauea, dataMaturity=VALIDATED, no productionConfiguration', dataMaturity='VALIDATED')
r = summarize('Kilauea, no dataMaturity, no productionConfiguration')
ur = [x.properties.get('sceneName') for x in r if '_UR_' in (x.properties.get('sceneName') or '')]
print('UR examples:', ur[:3])
EOF
echo "== CMR UR L2 collection granule count and date range"
for k in start_date -start_date; do /usr/bin/curl -s -g -m 60 -A "fact-check-script" "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2887502657-ASF&sort_key=$k&page_size=1" | /opt/anaconda3/bin/python3 -c "import sys,json; [print(e['title'], e['time_start']) for e in json.load(sys.stdin)['feed']['entry']]"; done
/usr/bin/curl -s -g -m 60 -A "fact-check-script" -D - -o /dev/null "https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2887502657-ASF&page_size=0" | tr -d '\r' | grep -i '^cmr-hits'
````


#### Space Apps challenge page: decode the embedded page data (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 213)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
F=dl/sa/www.spaceappschallenge.org_2026_challenges_dancing-with-the-sars_.html
/opt/anaconda3/bin/python3 -I - "$F" <<'EOF'
import re, sys, json, html
t = open(sys.argv[1], errors='replace').read()
print('len', len(t))
print('script tags:', len(re.findall(r'<script', t)), '| __NEXT_DATA__' , '__NEXT_DATA__' in t, '| next_f', t.count('__next_f'))
for kw in ['interactive application', 'actionable insights', 'Hypothesize', 'polarization', 'future applications', 'image sliders', 'time-series', 'dashboard', 'story map', 'Objectives', 'Considerations', 'Background']:
    idx = [m.start() for m in re.finditer(re.escape(kw), t)]
    print(kw, '->', len(idx), 'hits')
# dump text of script payloads that mention NISAR
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', t, re.S)
print('rsc chunks', len(chunks))
out = []
for c in chunks:
    try:
        s = json.loads('"' + c + '"')
    except Exception as e:
        s = c
    out.append(s)
full = '\n'.join(out)
open('dl/sa/challenge_rsc.txt', 'w').write(full)
print('rsc text len', len(full))
EOF
grep -o -iE ".{300}interactive application.{700}" dl/sa/challenge_rsc.txt | head -2 | cut -c1-1200
````


#### Space Apps challenge page: list the Resources tab links (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 221)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"
/opt/anaconda3/bin/python3 -I - <<'EOF'
import re, html
t = open('dl/sa/challenge_rsc.txt', errors='replace').read()
i = t.find('NASA does not endorse any non-U.S. Government entity')
seg = t[i-50: i + 9000]
# list anchors: href + text
for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', seg, re.S):
    print(html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip()[:70], '->', html.unescape(m.group(1)))
print('-----')
txt = re.sub(r'(?i)</(p|h[1-6]|li|ul|ol)>', '\n', seg); txt = html.unescape(re.sub(r'<[^>]+>', '', txt)); txt = re.sub(r'\n\s*\n+', '\n', txt)
j = txt.find('RADARSAT 1 - Data')
print(txt[j: j + 2500])
EOF
````


#### HTTP status of the Appendix C URLs (run 2, `agent-a3d2f3e920e4f323e.jsonl`, line 225)

````bash
S="<scratch>/review/fact-checker/run2"; cd "$S"; mkdir -p dl/appc
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
chk() { n="$1"; u="$2"; /usr/bin/curl -s -L -m 45 -A "$UA" -o "dl/appc/$n.html" -w "$n | status=%{http_code} | redirects=%{num_redirects} | bytes=%{size_download} | final=%{url_effective}\n" "$u" || echo "$n | CURL FAILED ($?) for $u"; }
echo "== Appendix C URLs as written in the brief"
chk c01_eds "https://search.earthdata.nasa.gov/search"
chk c02_vertex "https://search.asf.alaska.edu/"
chk c03_guide "https://nisar-docs.asf.alaska.edu/"
chk c04_cookbook "https://github.com/ASFOpenSARlab/NISAR_Cookbook"
chk c05_sar "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar"
chk c05b_sar_interp "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar/image-interpretation"
chk c06_rs "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics"
chk c07_arset "https://www.earthdata.nasa.gov/data/projects/arset"
chk c08_storymaps "https://science.nasa.gov/mission/nisar/arcgis-storymaps/"
chk c09_whitepapers "https://science.nasa.gov/mission/nisar/societal-benefits/"
chk c10_uavsar "https://uavsar.jpl.nasa.gov/education/postcards.html"
chk c11_rcm "https://donnees-data.asc-csa.gc.ca/en/dataset/rcm"
chk c12_csatut "https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial"
chk c13_r1 "https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1"
chk c14_saocom "https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html"
echo "== Live Resources-tab URLs that differ from the brief"
chk t06_rs "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing"
chk t07_arset "https://appliedsciences.nasa.gov/get-involved/training"
chk t08_storymaps "https://nisar.jpl.nasa.gov/applications/arcgis-storymaps/"
chk t09_whitepapers "https://nisar.jpl.nasa.gov/applications/societal-benefit/"
chk t15_saocomreg "https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible"
echo "== 'Also worth knowing' repos"
chk w1_nsa "https://github.com/NISAR-Science-Algorithms"
chk w2_hyp3cv "https://github.com/ASFHyP3/hyp3-nisar-cv"
````


### 9.5 Access parameters taken from documentation (docs; not run by the fact-checker)

These are the call parameters the saved documentation uses, restated here so the bake-off can try them. None was run with credentials. The saved pages hold the full examples.

- Data guide, earthaccess page (`$FC/run2/dl/docs/earthaccess.txt`, lines 123 to 143): `earthaccess.login()`; search with `earthaccess.search_data(short_name='NISAR_L2_GCOV_PROVISIONAL_V1', ...)`; take `results[0].data_links(access='external')[0]`; open it with `earthaccess.get_fsspec_https_session().open(url, cache_type='background', block_size=16*1024*1024)`; hand the file object to `xr.open_datatree(f, engine='h5netcdf', decode_timedelta=False, phony_dims='access')`.
- Cookbook, `NISAR_GCOV_Time_Series_Example.ipynb` cell 12 (`$FC/run2/dl/cookbook/`): `fsspec.filesystem("http", headers={"Authorization": f"Bearer {token}"}, cache_type="background", block_size=8*1024*1024)`, then `fs.open(url, "rb")` and `xr.open_datatree(f, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group="/science/LSAR/GCOV/grids/frequencyA")`. So an Earthdata bearer token in a header is an accepted way to authenticate the HTTPS endpoint.
- Data guide, asf_search page (`$FC/run2/dl/docs/asf-search.txt`, lines 55 to 80): `fsspec.filesystem(protocol='https', client_kwargs={'auth': aiohttp.BasicAuth(user, password)})` with the same `background`, 16 MB settings.
- Benchmark gist (`$FC/run2/dl/gist/nisar-remote-read-benchmark.ipynb`): `cache_type="blockcache", block_size=8*1024*1024` on the reader, and for the h5netcdf driver `driver_kwds={"page_buf_size": 16 * MB, "rdcc_nbytes": 4 * MB}`.
- Data guide, GDAL page (`$FC/run2/dl/docs/gdal.txt`, lines 50 to 67 and 84 to 99): the option list in recommendation R8; `gdalinfo "/vsicurl/https://<download URL>"` lists subdatasets named `HDF5:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH`; before GDAL 3.13.0 prepend `NETCDF:` instead.
- COG protocol README (`$FC/run2/dl/npm/cog_readme.md`): register with `maplibregl.addProtocol('cog', cogProtocol)`; raster source `url: 'cog://<https url>'`, optionally `#color:<scheme>,<min>,<max>,<modifiers>` (`c` continuous, `-` reversed); `setColorFunction(cogUrl, (pixel, color, metadata) => { ... })` with the plain URL, then remove and re-add the layer to refresh; `locationValues(url, {latitude, longitude}, zoom?)`; `getCogMetadata(url)`; `setRequestHeaders(headers)`. For nodata on a warped COG it says to declare the value on the source (`gdal_edit.py -a_nodata 0 source.tif`) because the warp does not carry `-dstnodata` into the output.
