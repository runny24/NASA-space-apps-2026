# Recovered digest: science (SAR science and NISAR data facts)

Recovered 2026-11-14 from the interrupted "review:science" runs of the night of 2026-11-13.
Brief that was being checked: `<prehackathon-repo>/research/BUILD_PROMPT.md`
(Sections 4 and 5, Appendices A, B and D).

Path shorthands used below (every one is an absolute path on this Mac; `/private/tmp` can be wiped by a reboot):

- `SCR` = `<scratch>`
- `RS`  = `SCR/review/sar-remote-sensing-scientist` (scratch of the second run, the one that got furthest)
- `R1`  = `SCR/review/sar-science` (scratch of the first run)
- `TR`  = `<transcripts>/wf_79c71ecc-a87`
  - run 1 transcript: `TR/agent-a9dcce0dd3b0b3b97.jsonl` (2026-11-13 20:53 to 21:08 local, 56 tool calls)
  - run 2 transcript: `TR/agent-a0f06a78b06d4e4f5.jsonl` (2026-11-14 01:41 to 02:01 local, 72 tool calls)
  - run 3 transcript: `TR/agent-acba21a300cee8e04.jsonl` (2026-11-14 06:41 local, no tool calls)

Evidence classes: **ran** = a saved output or a transcript tool result shows it being run and what it printed;
**docs** = read in documentation, a specification, a notebook or a package registry; **belief** = no evidence found.

---

## 0. How far the runs got, and how to read this file

- Three attempts ran the same task ("SAR remote-sensing scientist" review of Sections 4, 5 and Appendices A, B, D).
  Runs 1 and 2 each worked for 15 to 20 minutes and were stopped by the usage limit **before writing any finding**.
  The only assistant text in each transcript is the limit message. Run 3 stopped before its first tool call.
- The agents' reasoning was not recorded (thinking blocks are empty). So there is **no reviewer-written conclusion
  anywhere**. Everything below is reconstructed from what the runs saved: script outputs, script comments and print
  labels, the documents they opened, and the quotations run 2 chose to re-confirm on the live data-guide pages.
  Where a corrected statement is my reading of that evidence rather than something a script printed, it says so.
- **No real NISAR file was opened** in any run (no Earthdata credentials). Every numeric check is on simulated speckle,
  a synthetic HDF5 file or a synthetic GeoTIFF. The public CMR catalog queries are real.
- Nothing in Appendix B (events) and nothing in the Section 5 surface-response table was checked by these runs.

---

## 1. The ten changes a builder should make because of this evidence

1. **Do not threshold native-resolution pixels.** A native GCOV pixel has only about 2.5 to 9 looks. Two dates of an
   unchanged pixel differ by 2 to 4 dB (one standard deviation); 95% of no-change differences lie within about
   ±4 to ±8.5 dB. The brief's "1 to 2 dB is noise" understates this by a factor of three or more. Average **linear
   power** to roughly 50 to 100 looks first (for 20 m data a 4x4 or 5x5 block; for 10 m data 8x8 to 10x10).
2. **A "k standard deviations of the difference image" threshold is not a change detector.** On a pair where nothing
   changed it still flags 13% of pixels at 1.5 sd (two-sided), 4.6% at 2 sd, 0.3% at 3 sd, whatever the filtering.
   Use it one-sided, on multilooked data, and publish the share it flags over an area that should not have changed.
3. **Never read numbers back from COG overviews.** `overview_resampling="average"` averages 8-bit dB codes. Uniform
   areas decode 0.2 to 0.4 dB low; mixed pixels are off by several dB. Numbers on screen must come from
   full-resolution pixels or from statistics the pipeline computed in linear power.
4. **Never compute an area by counting pixels of the EPSG:3857 COG.** The count is inflated by 1/cos²(latitude):
   1.06 at 13°N, 2.2 at 48°N, 5.1 at 64°N. Compute areas in the pipeline on the native grid.
5. **Harden sketch D3 before trusting it.** Its arithmetic is right, but it silently drops a missing polarization,
   silently truncates a window that overhangs the frame, and returns an empty array with a plausible georeference
   when the window is west of the frame.
6. **Mask harder than "finite and greater than zero".** ASF's own notebook output shows valid-looking values of
   2e-14 to 8e-14 (about -131 to -137 dB) in a provisional HH layer, and layer attributes with minimum 1e-17 and
   maximum 2e5. Apply `mask` in 1..5, then a floor and a cap, before any log or mean.
7. **Fix the GIBS legend text.** The data guide says co-pol is in red *and* blue and cross-pol in green. The brief's
   "blue = HH/HV ratio" and "flooded vegetation yellow" are not what the guide says.
8. **A lat/lon preview PNG pinned by four corners on a Web-Mercator map is misplaced** mid-frame: 0.5 km at Tonle Sap,
   2.4 km at 48°N, 4.5 km at 64°N. Warp it or label it approximate.
9. **Check polarization per date, not per stack.** Rondonia `068_D_094` is listed as HH+HV in Appendix A but half its
   provisional dates are HH only. Sudd, Pantanal and Mamiraua are also mixed.
10. **Word the release rule honestly.** The data guide asks for caution when combining maturities; it does not forbid
    it. And every Appendix A date count mixes up to three releases: a single-release series is 8 to 10 dates from
    mid-June 2026 for most places, 24 to 29 dates for the five long-record sites.

---

## 2. Facts

### 2.1 Ran (numeric checks and live catalog queries)

- **R1.** Speckle of L-look intensity in dB. At 5 looks: sd of one image 2.04 dB; sd of a two-date difference 2.89 dB; 95% of no-change differences below 5.70 dB; 47.9% exceed 2 dB. At 2.5 looks: 3.04 / 4.30 / 8.54 dB / 62.6%. It takes about 50 looks for a 95% bound of 1.71 dB, 100 for 1.21 dB, 400 for 0.60 dB.
  - Evidence: `RS/out/speckle_stats.txt`: `    5 |  2.04 |  2.89 |  5.70 |  47.9% |  -0.45` and `  100 |  0.44 |  0.62 |  1.21 |   0.1% |  -0.02`
- **R2.** Nominal looks per native GCOV pixel (computed, not measured; assumes 7 m azimuth resolution, slant resolution c/2B, 40° incidence): 20 MHz at 20 m about 4.9; 40 MHz at 10 m about 2.5; 77 MHz at 20 m about 18.9; 5 MHz at 80 m about 19.6.
  - Evidence: `RS/out/speckle_stats.txt`: `  20 MHz @20 m: ground-range res  11.7 m -> ~ 4.9 looks`, `  40 MHz @10 m: ground-range res   5.8 m -> ~ 2.5 looks`
- **R3.** A 5x5 mean filter in linear power on 5-look data cuts the sd of a no-change log-ratio from 2.89 dB to 0.55 dB (simulated independent pixels).
  - Evidence: `ENL 5, 5x5 mean filter: sd=0.55 dB, flagged at 1.5 sd: 13.4%`
- **R4.** A k-sigma threshold on the difference image flags a fixed share of an unchanged scene: 13.1 to 13.4% at 1.5 sd two-sided (6.6% one-sided), 4.5 to 4.7% at 2 sd, 0.3 to 0.4% at 3 sd, independent of looks and filtering.
  - Evidence: `ENL 5, 1x1 mean filter: sd=2.89 dB, flagged at 1.5 sd: 13.1%`; run 1 transcript: `No-change scene, 1.5 sigma rule: flagged two-sided = 13.3%, one-sided = 6.6%`
- **R5.** Averaging dB instead of linear power is biased: -0.45 dB at 5 looks and -0.93 dB at 2.5 looks in uniform areas; at a -22/-8 dB edge the dB mean is 4.16 dB below the linear mean.
  - Evidence: `linear mean -> -10.84 dB ; mean of dB values -> -15.00 dB ; difference 4.16 dB`
- **R6.** A linear mean is not robust to point targets: one +20 dB pixel among 100 at -15 dB gives a linear mean of +0.13 dB while the median stays at -15 dB.
  - Evidence: run 1 transcript: `100-pixel field at -15 dB with ONE +20 dB pixel: linear mean = 0.13 dB ; median = -15.00 dB`
- **R7.** Sketch D3's window arithmetic is correct on a synthetic GCOV-shaped HDF5 file (pixel-centre coordinates, y descending): the returned geotransform is the top-left corner of the first pixel read.
  - Evidence: `RS/out/d3_window_test.txt`: `expected top-left corner of that pixel: (np.float64(420000.0), np.float64(1524000.0)) -> match: True`
- **R8.** D3 fails silently off the happy path: an absent term is dropped without notice; a window overhanging the frame is truncated; a window east of the frame raises IndexError; a window west of the frame returns an empty array with a plausible geotransform.
  - Evidence: `'HVHV' requested but absent from file -> keys returned: ['HHHH', 'mask']`; `overhanging east edge: shape (201, 99) (asked for ~ 350 columns; no error, no warning)`; `entirely outside the frame -> IndexError index 3000 is out of bounds for axis 0 with size 3000`; `entirely west of the frame -> shape (205, 0) geotransform origin 400000.0 1524040.0`
- **R9.** D3's four-corner bbox transform lost 0 m against a densified transform for the four boxes tried (UTM 48N, EPSG:3413 twice, EPSG:3031). None of those boxes straddles the projection's central meridian, so the case where corners under-cover was not exercised (my note).
  - Evidence: `RS/out/geom_checks.txt`: `D3 corners-only vs densified, Jakobshavn, EPSG:3413: window short by up to 0 m on one side`
- **R10.** A lat/lon-linear preview PNG pinned by its four corners on a Web-Mercator map is misplaced north-south at mid-frame by 0.50 km at Tonle Sap (2.8 preview pixels), 1.26 km at 30°N, 2.42 km at 48°N, 4.47 km at 64°N.
  - Evidence: `D4 four-corner image overlay, Tonle Sap frame (brief's extent): max north-south misplacement  0.50 km (=  2.8 preview pixels of 180 m), at mid-frame`
- **R11.** Sketch D5 runs as written on rasterio 1.5.2 (GDAL 3.12.2) and rio-cogeo 7.0.4 and the result validates: EPSG:3857, nodata 0, overviews 2/4/8. `web_optimized=True` prints a DeprecationWarning pointing to the `tms` option. cog_translate's defaults are `resampling='nearest'`, `overview_resampling='nearest'`, `nodata=None`.
  - Evidence: run 1 transcript: `validate A: True` and `A crs EPSG:3857 res (19.109257071294063, 19.109257071294063) shape (2560, 2304) overviews [2, 4, 8] nodata 0.0`; `RS/out/cog_domain_test.txt` line 1
- **R12.** The web-optimized COG's pixel snaps to a web-mercator zoom level: 20 m native became 18.62 m on the ground at 13°N, **25.62 m at 47.9°N (coarser than native)**, 16.81 m at 63.9°N.
  - Evidence: `[47.9N (UTM 14N)] native 20.0 m -> COG EPSG:3857 pixel 38.219 projected m = 25.62 ground m; size 1792x1792; overviews [2, 4]`
- **R13.** Overviews built by averaging 8-bit dB codes decode low by 0.2 to 0.4 dB in uniform 5-look areas and are wrong by several dB where classes mix.
  - Evidence: `overview x8 decoded: water -22.27 dB (truth -22.00), land -8.41 dB (truth -8.00)`; `overview x8 shoreline (mixed) columns decoded: [-17.08] dB`; run 1: `    2 | dark  -22.34 vs  -22.06 | bright   -6.40 vs   -6.06 | max |diff| anywhere  13.3 dB, 99th pct  1.9 dB`
- **R14.** Counting pixels of the EPSG:3857 COG overstates area by 1/cos²(latitude).
  - Evidence: `area by pixel counting: native UTM 1661.7 km2 ; EPSG:3857 raster 3697.4 km2 ; ratio 2.225 (1/cos^2(lat) = 2.225)` (ratio 1.060 at 13°N, 5.149 at 63.9°N)
- **R15.** With the brief's -25 to 0 dB 8-bit encoding, a 5-look scene of -22 dB water, -8 dB land and a +3 dB strip had 2.67% of valid pixels clipped at code 255 and 5.64% at code 1.
  - Evidence: `share of codes saturated at 255 (>= 0.0 dB): 2.67% ; at 1 (<= -25.0 dB): 5.64%`
- **R16.** The coverage helper, re-run 2026-11-14 about 01:56 local, reproduced every Appendix A stack, date count, span and file size.
  - Evidence: `RS/out/coverage4.txt`: `  083_A_008   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 10, 'V': 1}`; `RS/out/coverage_all.txt`
- **R17.** Release split of the Appendix A stacks: no date exists in both provisional and validated; validated dates start between 2026-10-22 and 10-31; every stack has 8 to 10 provisional dates since 2026-06-17. Five sites have a provisional record back to autumn 2025: Mexico City (29 provisional dates), Central Valley (26) and Punjab (24) have every beta date superseded by a provisional product, Reykjanes (26) has no beta at all, and Kilauea (26) has one beta-only date (2025-10-22). At Atchafalaya, Grand Forks, Chicago, Champaign, Jakobshavn, Okavango, Rondonia and Mamiraua every pre-June date is beta only.
  - Evidence: `RS/out/release_split.json`, e.g. `{"name": "Atchafalaya", "stack": "084_D_073", "total": 19, "B": 8, "P": 10, "V": 1, "B_only": 8, ... "overlap_PV": []}`
- **R18.** Polarization is not constant across the provisional dates of several listed stacks: Rondonia `068_D_094` 5 HH+HV and 5 HH; Sudd `050_D_085` 5 and 5; Pantanal `111_D_097` 5 HH+HV and 4 HH; Mamiraua `097_D_090` 2 HH+HV, 3 HH and 4 dates with a 5 MHz band only.
  - Evidence: `RS/out/release_split.json`: `"P_modes": {"HH+HV 20+5": 5, "HH 20+5": 5}` (Rondonia), `"P_modes": {"? 5": 4, "HH 20+5": 3, "HH+HV 20+5": 2}` (Mamiraua)
- **R19.** Acquisition times in the catalog are UTC, and the local calendar date can differ: Tonle Sap 22:36 UTC, Mexico City 12:05, Kilauea 04:58, Punjab 00:13, Central Valley 13:08.
  - Evidence: `RS/out/release_split.json` field `times` (the conversion to local dates is my arithmetic)
- **R20.** A public CMR UMM-G record of a GCOV granule carries `STACK_ID`, `FULL_FRAME`, `FREQUENCY_A_POLARIZATION_CONCAT`, `RANGE_BANDWIDTH_CONCAT`, `JOINT_OBSERVATION`, `ORBIT_TYPE`, `PRODUCT_VERSION`, `PRODUCTION_PIPELINE`, look direction LEFT and PGE version R05.02.3. It has **no projection or EPSG field**. It lists browse PNGs `_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`, `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png`, and sidecars `.rc.yaml`, `.h5.iso.xml`, `_QA_REPORT.pdf`, `_QA_STATS.h5`, `_QA_SUMMARY.csv`, KML files.
  - Evidence: `RS/out/iceland_umm.json` (92 hits at -22.4, 63.88; first granule `NISAR_L2_PR_GCOV_033_111_D_056_4005_DHDH_A_20261019T214037_20261019T214049_P05023_N_P_J_001`)
- **R21.** Every sidecar tried needs login: `.rc.yaml`, `.h5.iso.xml`, `_QA_SUMMARY.csv`, `_QA_REPORT.pdf`, `_LATLON.kml`, `_QA_STATS.h5`.
  - Evidence: run 2 transcript: `== .rc.yaml` / `302 -> https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...` for all six
- **R22.** A Python 3.12 venv with `pip install numpy scipy h5py pyproj rasterio rio-cogeo` installs cleanly on this Mac. Versions: numpy 2.5.4, scipy 1.18.1, h5py 3.16.0, pyproj 3.8.0, rasterio 1.5.2 with GDAL 3.12.2, rio-cogeo 7.0.4. The base Anaconda Python lacks rasterio, rio_cogeo and earthaccess.
  - Evidence: run 2: `2.5.4 1.18.1 3.16.0 3.8.0 1.5.2 3.12.2 7.0.4`; run 1: `rasterio MISSING ModuleNotFoundError`
- **R23.** The saved preview images in `research/evidence/previews/` are RGBA (1000 x 982 and 900 x 881), not RGB. A local read I made today shows their alpha channel spans 0 to 255, so they contain fully transparent pixels.
  - Evidence: run 2: `browse_tonlesap_2026-06-19.png (1000, 982) RGBA`; my read: `extrema per band: ((0, 255), (0, 255), (0, 255), (0, 255))`

### 2.2 Docs (read, not run)

Paths are given instead of quotations. Line numbers refer to the saved copies.

| # | Claim | Where it was read |
|---|---|---|
| D1 | The GCOV specification (Rev F, version 1.5.0, 8 July 2026, release R05.02.3) confirms the brief's Section 4.4 table: `mask` is unsigned 8-bit with 0 = invalid or partially focused, 1 to 5 = valid (sub-swath number), 255 = fill; diagonal covariance terms are float32 with NaN fill; `xCoordinates`/`yCoordinates` are pixel centres (attribute `pixel_coordinate_convention` = center, added in Rev F); the grid is north-up; frequency A and B share the top-left corner with an integer spacing ratio; chunks are nominally 512 x 512 in a paged file. | `SCR/nisar/specs/gcov_spec.txt` lines 1186-1190, 1223, 1468-1492, 2026, 2048-2057 |
| D2 | The specification lists items the brief omits: per-pixel `inputDataExceptionMask` and granule flag `/science/LSAR/identification/hasInputDataException` (0 = none, 2 = sample slip); `/science/LSAR/identification/isJointObservation`; scalar `xCoordinateSpacing` / `yCoordinateSpacing`; per-term attributes `isReceiveOnlyChannel1/2` (a layer can be a receive-only, noise-only channel); a noise-equivalent backscatter grid at `/science/LSAR/GCOV/metadata/calibrationInformation/frequencyA/noiseEquivalentBackscatter/<pol>`; and flags `noiseCorrectionApplied`, `validSamplesSubSwathMaskingApplied`, `shadowMaskingApplied`, `polarimetricSymmetrizationApplied` under `/science/LSAR/GCOV/metadata/processingInformation/parameters/`. | same file, lines 1940-1950, 1975, 2058-2062, 2082-2090, 3967-4012 |
| D3 | The ISCE3 default GCOV run configuration has noise correction off, sub-swath masking off, shadow masking marked not implemented, no minimum or maximum clipping, no minimum RTC area factor, and geocoding by area projection (adaptive multilooking). | `SCR/nisar/isce3/share_nisar_defaults_gcov.yaml` lines 250, 262, 294, 323-326, 369, 391-395, 554-556 |
| D4 | Posting by bandwidth (confirms the brief): 5 MHz 80 m, 20 MHz 20 m, 40 MHz 10 m, 77 MHz 20 m. Source spacing is about 5 m in azimuth and about 36.3 / 9.1 / 4.5 / 2.27 m in ground range. Counting source pixels per output pixel from that table gives about 35 / 8.8 / 4.4 / 35 (my arithmetic); this is the upper bound next to R2's resolution-based 19.6 / 4.9 / 2.5 / 18.9. | `SCR/nisar/specs/gcov_spec.txt` lines 615-627; `RS/dl/nisar-docs/data-products/level-2/gcov.md` lines 83-93 |
| D5 | On combining releases the data guide asks users to "use caution when including multiple data maturities" (NISAR Data User Guide, products overview). It is a caution, not a prohibition. Two other pages give a similar caution for beta with provisional. | `RS/dl/nisar-docs/data-products/products-overview.md` line 39; `data-availability/availability-overview.md` line 51; `data-availability/provisional-known-issues.md` line 72 |
| D6 | The guide's amplitude page says terrain-corrected products from different paths may be suitable for one time-series analysis where acquisitions overlap. | `RS/dl/nisar-docs/applications/amplitude.md` line 22 |
| D7 | GIBS/Worldview NISAR layer: for dual-pol and quad-pol products co-pol goes to the red and blue channels and cross-pol to green; single-pol products use a separate colour bar running blue, green, orange, yellow; the guide reads the colours as vegetation green, urban or sparse vegetation orange to yellow, calm water / dry sand / frozen ground blue, rough water possibly red; mosaics are resampled to 15.625 m; the layer shows validated products from 2026-10-21 and provisional products before that; overlapping same-day images have no enforced order. | `RS/dl/nisar-docs/tools-services/worldview.md` lines 28, 30, 78-106, 111; live copy `RS/dl/live/worldview.html` (fetched 2026-11-14) |
| D8 | Projections per the guide: UTM between 60°S and 60°N, EPSG:3413 north of 60°N, EPSG:3031 south of 60°S; SME2 on EASE-Grid 2.0 (EPSG:6933) at 200 m. The guide's figure shows the switch near 60° (my reading of the image). The GCOV page speaks only of UTM, and the specification's appendix scopes EPSG:3413 to Greenland and northern sea ice. | `RS/dl/nisar-docs/data-products/projections.md` lines 7-18, 43; `RS/dl/nisar-docs/assets/projections-ascending.png`; `SCR/nisar/specs/gcov_spec.txt` lines 4922-4953 |
| D9 | Provisional known issues beyond the brief's list: the interference filter can leave residue or remove real features in high-contrast areas; low-level ripples on dark backgrounds; products acquired jointly with S-band at 40 MHz show larger residual radiometric bands; an inter-channel phase offset that matters only for complex off-diagonal terms. Confirmed from the brief's list: high-latitude ionosphere, weaker frequency B calibration, about 1 to 2% of products affected by incomplete raw data, the four diagnostic-mode track/frames, three to six gaps across quad-pol swaths. | `RS/dl/nisar-docs/data-availability/provisional-known-issues.md` lines 19-64 |
| D10 | Validated products: the incomplete-raw-data issue behind most provisional defects is listed as resolved with CRID P05036; the July/August data gap is permanent. Beta: masks misaligned, radiometric banding, and browse products that can be mislocated by kilometres because of projection limits in the KML browse files. | `RS/dl/nisar-docs/data-availability/nisar-known-issues.md` lines 30-52; `data-availability/product-known-issues.md` line 198 |
| D11 | GUNW: co-pol, frequency A, nearest 12-day pairs only; unwrapped phase and coherence at 80 m, wrapped interferogram at 20 m; the ionosphere screen is included but not applied; solid-Earth-tide and wet/hydrostatic troposphere lookup tables are included but not removed; the mask is a three-digit code (water flag, reference sub-swath, secondary sub-swath; a zero sub-swath digit means invalid; fill 255); `connectedComponents` is uint16 with fill 65535; the dataset paths match the brief. The specification text contains no statement of the phase sign convention. GOFF offsets are unfiltered and may contain outliers. | `RS/dl/nisar-docs/data-products/level-2/gunw.md` lines 12-20; `SCR/nisar/specs/gunw_spec.txt` lines 553, 1341-1343, 1748-1758, 1943-1963, 2130-2160; `RS/dl/nisar-docs/data-products/level-2/goff.md` line 16 |
| D12 | ASF change-detection notebook: uses HVHV linear power of a 3000 x 3000 pixel window from six **beta** dates of stack `042_A_019` (20 m; the full frame is 17496 x 17748 pixels and the six-date dataset is 37 GB); per-pixel time-series metrics (percentile range, standard deviation, coefficient of variation) are each thresholded at the top 5% of pixels; the pair-wise method is 10*log10(date2/date1) on unfiltered pixels with a hand-picked -2 dB threshold, and the 1st and 99th percentiles of that ratio were -6.18 and +3.55 dB; no mask, no multilook, no speckle filter; export goes through the `osgeo.gdal` bindings and builds the geotransform from the first pixel-centre coordinates. | `RS/out/NISAR_GCOV_SARChangeDetectionMethods.txt` lines 96-101, 169, 200, 288-311, 558-590, 688, 722-737, 822, 850 |
| D13 | ASF time-series notebook: `asf_search` with provisional maturity and production pipeline `PR`; keeps the highest CRID per product; **drops 2 of 5 provisional dates** of stack `026_A_016` for visible processing problems; opens files over HTTPS with an fsspec `http` filesystem carrying a Bearer token, `cache_type="background"`, 8 MB blocks, then `xr.open_datatree` (h5netcdf engine, `phony_dims="access"`, group `frequencyA`); subsets with rioxarray `clip_box` in EPSG:4326; converts with a `> 0` guard; takes means in linear power then converts to dB. Recorded timings: 17.1 s to open three remote files, 1 min 59 s to save a three-date 5784 x 3909 HH subset. | `RS/out/NISAR_GCOV_Time_Series_Example.txt` lines 90-95, 126, 169, 227-249, 309, 439-442, 529, 725-751 |
| D14 | The same notebook's printed output contains HH values of 2e-14 to 8e-14 inside the subset, and the layer attributes give minimum 1.2e-17 and maximum 2.1e5. Its three area means over a 58 x 39 km window were -2.56, -2.83 and -2.46 dB. | same file, lines 325-327, 597-619, 751 |
| D15 | Provenance of the brief's method numbers. All come from ARSET exercises on **Sentinel-1 C-band in Google Earth Engine, on dB images**: display ranges VV -15 to 0 and VH -25 to 0, with -25 to -8 used only for three-date VH colour composites; the speckle filter is a focal mean of 50 m radius applied to dB images; the forest exercise subtracts before minus after and thresholds one-sided at 2.35 and 2.95 dB, described as 1.5 times the standard deviation of the difference; the flood exercise divides two dB images and thresholds the quotient at 1.25; the caution about not mixing angles is stated for temporal change detection. The flood StoryMap line about site-dependent thresholds and the ARSET line about flooded vegetation at L-band are in the saved texts as the brief quotes them. | `SCR/txt/sl_forest_p1_clean.txt` lines 451-493, 505-510, 572-576; `SCR/txt/sl_lc_p1_clean.txt` lines 281-344; `SCR/txt/sl_lc_p2_clean.txt` lines 69-70; `SCR/txt/sm_floods.txt` line 51; `SCR/txt/arset_sw_p1.txt` lines 450, 706-716 |
| D16 | ISCE3 quality-assurance defaults for browse images: multilooked in linear units to at most 2048 pixels on the long side, clipped to **each image's own** 5th to 95th percentile, gamma 0.5, missing data drawn transparent. | `SCR/nisar/isce3/share_nisar_defaults_gcov.yaml` lines 620, 645, 650, 661, 667 |
| D17 | SME2 specification (Rev C, 2024, older than the released products): the grids hold three algorithm candidates (DSG, PMI, TSR), each with soil moisture, uncertainty and a quality flag; ancillary land cover, local incidence angle and water-body fraction; and 200 m sigma-naught per polarization under `radarData`; fill -9999. The guide names `/science/LSAR/SME2/grids/soilMoisture` as the baseline layer and says the provisional SME2 collection now mixes CRIDs P05023 and P05036. | `SCR/nisar/specs/sme2_spec.txt` lines 968-1711; `RS/dl/nisar-docs/data-availability/product-known-issues.md` line 189; `RS/dl/nisar-docs/data-products/level-3/sme2.md` |
| D18 | File-name details beyond the brief: processing type can also be `OD`; polarization codes also include SV, DV, CL, CR; the orbit flag is P, M, N or F (precise, medium, near-real-time, forecast); the source flag is `A` (single mode) or `M` (mixed). Mixed-mode granules cover the full frame at the coarser of the two resolutions with only the common polarizations. | `RS/dl/nisar-docs/data-products/level-2/gcov.md` lines 119-200; `data-availability/observation-plan.md` line 11 |
| D19 | The guide confirms GDAL 3.13.0 as the first version that reads NISAR HDF5 georeferencing, and the mission geometry in the brief (left-looking, 24 cm wavelength, about 240 km swath, 7 m along-track resolution). | `RS/dl/nisar-docs/data-products/data-format.md` line 11; `about-nisar/nisar-intro.md` lines 119, 137, 139 |

### 2.3 Parts of Sections 4 and 5 that the runs checked and found correct as written

A builder can rely on these without re-checking (source class in brackets).

- Release table in 4.1: beta covers a subset of 2025-10-17 to 2026-01-20; provisional (CRID P05023) covers every
  acquisition from 2026-06-17 plus longer series at selected frames; validated (CRID P05036) was released 2026-11-06
  and covers acquisitions from 2026-10-21; no validated soil moisture. One guide page puts the end of provisional
  part of the way through 23 October rather than on the 21st; no stack checked had a date in both releases (R17).
  [docs: `RS/dl/nisar-docs/data-availability/availability-overview.md` lines 16, 30, 39, 51, 67, 106, 113]
- The permanent data gap, 2026-07-27T22:03:25Z to 2026-08-10T00:55:27Z. [docs: same file line 47; `nisar-known-issues.md` line 44]
- Posting per bandwidth (20 MHz 20 m, 40 MHz 10 m, 77 MHz 20 m, 5 MHz 80 m). [docs: D4]
- `mask` values 0 / 1 to 5 / 255, NaN fill for covariance terms, pixel-centre coordinates with y descending, EPSG code in `projection`. [docs: D1]
- Cycle of 12 days, tracks 001 to 173, frames 001 to 176; the diagnostic-mode track/frames 161/174, 161/175, 169/090, 169/091. [docs: `RS/dl/nisar-docs/data-products/level-2/gcov.md` lines 131-150; `data-availability/provisional-known-issues.md` line 53]
- GUNW dataset paths, 80 m unwrapped phase, 20 m wrapped interferogram, ionosphere screen not applied. [docs: D11]
- Left-looking, 24 cm wavelength, about 240 km swath [docs: D19]; half a wavelength per fringe is therefore about 12 cm.
- `pip install rasterio` gives GDAL 3.12, older than the 3.13.0 needed for the HDF5 driver route. [ran: R22; docs: D19]
- Every stack, date count, span and file size in Appendix A (with the per-date polarization caveat in R18). [ran: R16]
- The ARSET caution on mixing angles, the StoryMap sentence on site-dependent thresholds, and the ARSET line on flooded vegetation at L-band are quoted accurately. [docs: D15]

### 2.4 Belief (no evidence found; treat as open)

| # | Claim | Why it is only belief |
|---|---|---|
| B1 | Production GCOV files were made with the ISCE3 defaults in D3 (no noise subtraction, values present under mask 0, no shadow masking). | Only the defaults file was read. The flags in D2 exist precisely so this can be checked in a real file; nobody opened one. |
| B2 | The nominal look counts in R2 and D4 describe real data. | Neighbouring geocoded pixels are probably correlated, so effective looks may be lower. Nobody measured the equivalent number of looks on a real layer. |
| B3 | There is no radiometric step between provisional (P05023) and validated (P05036), or between beta and provisional. | No measurement exists. The guide only says to be careful. |
| B4 | Land frames north of 60°N (Iceland, Scandinavia, Alaska) are in EPSG:3413. | Guide page and figure say so; the specification's wording and the GCOV page suggest UTM for land outside Greenland; the catalog has no projection field. |

---

## 3. Corrections to the brief

Severity: **blocks-build** = following the brief as written fails; **wrong-result** = it runs but gives wrong data or a
wrong claim; **minor** = wording, attribution or a missing guardrail.

| # | Section | The brief says | What the evidence shows | Evidence | Severity |
|---|---|---|---|---|---|
| C1 | 5, "Respect speckle" | "A single-pixel change of 1 to 2 dB is noise" | At native posting a two-date difference of an unchanged pixel has a standard deviation of 2 to 4.3 dB and a 95% bound of ±4 to ±8.5 dB (2.5 to 9 looks). 1 to 2 dB only becomes meaningful per pixel after averaging to about 50 to 100 looks. | R1, R2, R3, D4 | wrong-result |
| C2 | 5, "There is no universal threshold" | The log-ratio method: subtract two dB images after a roughly 50 m mean filter and flag pixels beyond about 1.5 standard deviations of the difference image | (a) That rule flags about 13% of pixels two-sided (6.6% one-sided) on a pair where nothing changed. (b) In the ARSET source it is one-sided, on Sentinel-1 VH, after a focal mean of 50 m *radius* applied to dB images, and it produced thresholds of 2.35 and 2.95 dB. (c) The "after/before ratio" in the ARSET flood exercise divides two dB images and thresholds at 1.25; it is not a ratio of linear power. For NISAR: filter in linear power, threshold one-sided in the expected direction, and report the false-alarm share over a stable area. | R4, D15 | wrong-result |
| C3 | 6.3 and D5 (bears on Section 5) | Display COGs are 8-bit dB codes with `overview_resampling="average"`; the browser turns pixel values back into dB | Overview levels average dB codes: uniform areas decode 0.2 to 0.4 dB low, mixed pixels are off by several dB (up to 10 to 13 dB at edges). The base level is nearest-neighbour reprojected, and at 47.9°N the 20 m data came out at 25.6 m. Values shown to users must come from full-resolution reads or pipeline statistics, never from an overview. | R11, R12, R13 | wrong-result |
| C4 | 6.3, "Small JSON ... areas, class counts" | No statement of the grid in which areas are computed, while every web raster is EPSG:3857 | Counting EPSG:3857 pixels overstates area by 1.06 at 13°N, 2.2 at 48°N and 5.1 at 64°N. Areas must be computed on the native grid in the pipeline (or scaled by cos²(latitude)). | R14 | wrong-result |
| C5 | Appendix D, sketch D3 | A complete-looking `read_window` | Arithmetic verified, but a missing term, an overhanging window and a window off the west edge all return without any error; only a window off the east edge raises. On HH-only dates and partial frames this yields silently short or empty arrays. | R7, R8 | wrong-result |
| C6 | 4.6, GIBS rendering | "looks like red = HH, green = HV, blue = HH/HV ratio (water blue, forest green, flooded vegetation yellow)" | The data guide: co-pol in red and blue, cross-pol in green; urban and sparse vegetation appear orange to yellow; calm water, dry sand and frozen ground all appear blue; single-pol products use a different colour bar; the layer mixes validated and provisional products. | D7 | wrong-result |
| C7 | 4.6 and sketch D4 | Preview extent recovered from the CMR polygon, then the PNG is placed on the map | The PNG is linear in latitude. Pinned by four corners on a Web-Mercator map its middle rows sit 0.5 km (Tonle Sap) to 4.5 km (64°N) from where they belong. The guide separately warns that browse products can be mislocated by kilometres. | R10, D10 | wrong-result |
| C8 | Appendix A, row "Rondonia, Brazil" | "HH+HV, 20+5", 13 dates | 5 of its 10 provisional dates are HH only; 2 dates are beta only. An HV series there has 5 dates. | R18 | wrong-result |
| C9 | Appendix A, "Dates" column and "How to read it" | One date count per stack | Each count mixes releases. Examples: Tonle Sap 11 = 10 provisional + 1 validated; Atchafalaya 19 = 8 beta-only + 10 provisional + 1 validated; Mexico City 31 = 29 provisional + 2 validated (all 6 beta dates superseded). Reykjanes has a longer stack than the one listed (`082_D_056`, 28 dates). The Tonle Sap preview comparison of 19 June with 29 October is provisional against validated. | R16, R17 | minor |
| C10 | 4.1 | "The data guide says not to mix releases in one time series." | The guide asks for caution because differences may come from processing. Not a ban. | D5 | minor |
| C11 | 4.3 and 5, "Compare like with like" | A stack "is the only kind you may compare directly" | That is the ARSET caution for change detection, a sound default for pixel differencing. The data guide itself says terrain-corrected products from different paths may suit one time series. Keep the rule for differencing; do not present it as a NISAR requirement. | D6, D15 | minor |
| C12 | 5, "Work in linear power, show in decibels" | "the ARSET examples stretch -25 to -8 dB" | That range is for Sentinel-1 C-band VH colour composites. ARSET used -15 to 0 for VV and -25 to 0 for VH single bands. ASF's NISAR HH example has area means near -2.5 dB, which a -25 to -8 stretch would saturate. Pick a fixed range per polarization from this stack's histogram. | D15, D14, R15 | minor |
| C13 | 6.2 step 3 | "Mask invalid pixels (keep `mask` 1 to 5, finite, greater than zero)" | Necessary but not sufficient: real layers contain positive values around 1e-14 and attributes show a minimum near 1e-17 and maximum near 2e5. Add a floor and a cap, and check the exception mask. | D14, D2 | wrong-result |
| C14 | 4.4, GCOV table | Lists covariance terms, `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor`, coordinates, `projection`, lists | Matches the specification. Missing: `inputDataExceptionMask`, `hasInputDataException`, `isJointObservation`, `isReceiveOnlyChannel*`, the noise-equivalent backscatter grid, the processing flags, coordinate-spacing scalars. There is no layover or shadow layer. | D1, D2, D3 | minor |
| C15 | 4.7 and 5, deformation | Ionosphere screen "provided but not applied"; needs a crop, a ramp removed, a reference point, a coherence mask | Also not removed: tropospheric and solid-Earth-tide phase (lookup tables are in the file). The GUNW mask is a three-digit code, not a 0/1 mask. The specification states no sign convention, so the brief's instruction to test the sign stands. | D11 | minor |
| C16 | 4.6, preview PNGs | "RGB on black, no transparency"; "Black pixels must be made transparent" | The saved copies are RGBA with transparent pixels, and the processor's defaults draw missing data transparent. The defaults also stretch each preview to its own 5th to 95th percentile with gamma 0.5, so brightness differences between two dates' previews are not measurements (the Appendix A sentence about vegetation "brightening" rests on such previews). | R23, D16 | minor |
| C17 | 4.2 | "16704 x 17064 pixels at 20 m" as the frame size | Raster size varies by frame: ASF's example frame is 17496 x 17748 at 20 m. | D12 | minor |
| C18 | 4.7 | "1 to 2 percent of products defocused or misplaced" | The guide does say 1 to 2%, but ASF's own five-date example stack lost two dates. The brief also omits the joint-mode 40 MHz banding issue. Budget for dropped dates per stack. | D9, D13 | minor |
| C19 | Appendix D, sketch D5 | `web_optimized=True` | Works on rio-cogeo 7.0.4 but is deprecated in favour of `tms`. The replacement was not tested. | R11 | minor |
| C20 | Appendix C | Cookbook notebooks described as "working notebooks" | Working, but not a model for this project's processing: the change-detection notebook uses beta data, no mask, no speckle reduction, a top-5% rule that always flags 5%, and a geotransform built from pixel-centre coordinates (half a pixel off, per D1's centre convention; my inference). Its export needs the GDAL Python bindings, which the pip environment does not have. | D12, D1 | minor |
| C21 | 4.5, path 1 | `cache_type="blockcache"` | ASF's notebook uses `cache_type="background"` with the same 8 MB block size. Neither was timed here. Try both in the bake-off. | D13 | minor |

No correction of class **blocks-build** was found by these runs.

### Replacement wording a builder can paste (my wording from the evidence above)

- **Speckle (Section 5).** "A native GCOV pixel has only a few looks (about 2.5 to 9). Between two dates an unchanged
  pixel moves by 2 to 4 dB, and occasionally by 6 to 8 dB. Never threshold native pixels. Average linear power to at
  least 50 to 100 looks first (20 m data: 4x4 or 5x5 pixels; 10 m data: 8x8 to 10x10). After that, 95% of no-change
  differences are within about ±1.2 to ±1.7 dB. For polygons report the median next to the linear mean: one bright
  target can move a linear mean by 15 dB."
- **Thresholds (Section 5).** "A threshold of k standard deviations of the difference image always flags the same
  share of pixels (13% two-sided at 1.5, 4.6% at 2) whether or not anything changed. If you use one, apply it
  one-sided in the direction you expect, on multilooked linear-power data, and state the share it flags over an area
  that did not change. Prefer an absolute threshold taken from sampled classes at this site and larger than the
  measured no-change spread."
- **Releases (Section 4.1).** "The data guide advises caution when combining maturities, because differences can come
  from the processing rather than the ground. Default to one release per series. If you cross the 21 October 2026
  boundary, mark the validated dates and check a stable target for a step."
- **GIBS legend (Section 4.6).** "Dual-pol and quad-pol: co-pol in red and blue, cross-pol in green. Vegetation
  green; urban and sparse vegetation orange to yellow; calm water, dry sand and frozen ground blue; rough water can
  look red. Single-pol scenes use a different colour bar. Do not read flooded vegetation from this layer's colour."

---

## 4. Recommendations

| Decision | Choice | Why |
|---|---|---|
| Resolution at which change is thresholded | Multilook linear power to 80 to 100 m before any per-pixel threshold (20 m data: 4x4 or 5x5; 10 m data: 8x8 or 10x10). Display layers may stay finer. | R1 to R3: 5 looks gives a 95% no-change bound of ±5.7 dB; a 5x5 block brings the difference sd to 0.55 dB. |
| Order of operations | mask, then floor/cap, then average in linear power, then 10*log10, then difference. Never average dB. | R5: -0.45 to -0.93 dB bias in uniform areas, 4 dB at edges. |
| Polygon and area statistics | Report median (or a trimmed mean) beside the linear mean. | R6: one bright target moved a 100-pixel mean from -15 to +0.13 dB. D14: real layers have maxima near 2e5. |
| Threshold rule | One-sided, physically motivated, on multilooked data; publish the share flagged over a stable area or a no-event pair as the false-alarm baseline; drop isolated pixels. Do not use "top 5%" or "1.5 sd" alone. | R4, D12: both rules flag a fixed share by construction. |
| Masking | Keep `mask` in 1..5; drop non-finite and non-positive; then set values below a stated floor to missing and cap extreme highs (choose and record the numbers; the runs did not establish them); skip granules or pixels with a non-zero exception flag. | D1, D2, D14. |
| First real file | Print the HDF5 tree, then read and log: `projection`, `listOfPolarizations`, `xCoordinateSpacing`, the processing flags in D2, `hasInputDataException`, `isJointObservation`, and the `min_value` / `max_value` attributes of each term. Estimate looks as mean²/variance of linear power over a uniform patch. | B1, B2, B4 are all settled by this one read. |
| Window read (D3) | Keep the arithmetic. Add: fail if any requested term is absent; fail if `c0 >= c1` or `r0 >= r1`; fail or warn if the window is not fully inside (`min(xs) < x[0] - dx/2`, `max(xs) > x[-1] + dx/2`, same for y); compare the shape read with the shape expected. Replace the four-corner transform by `Transformer.transform_bounds(w, s, e, n, densify_pts=21)`. (Guards not run; `transform_bounds` ran in `geom_checks.py`.) | R8, R9. ASF's notebook also densifies. |
| Numbers shown in the app | From full-resolution pixels of the stack COG or from pipeline JSON computed in linear power. Never from an overview level. | R13. |
| Areas | Pixel count times posting squared on the native UTM grid, in the pipeline, written to JSON. For polar-stereographic frames apply the projection's scale factor as well (not tested here). | R14. |
| 8-bit encoding range | Choose `lo`/`hi` per polarization from the multilooked stack's histogram, keep them fixed for all dates, record them, and render codes 1 and 255 as "at or below" and "at or above". Do not take -25 to -8 dB from the brief. | R15, D14, D15. |
| COG writing | Use the D5 call on rasterio 1.5.2 + rio-cogeo 7.0.4 (tested, validates). Multilook to the web resolution in linear power *before* encoding so the nearest-neighbour reprojection does not decimate. Check the output ground resolution at your latitude. | R11, R12. |
| Stack choice | Run the release split (script below) for the team's place and pick on: number of dates in one release, constant polarization on those dates, no multi-granule dates. Treat validated dates (from 2026-10-21) as a second release in the manifest. Drop beta. | R17, R18. |
| Catalog screening | Use the UMM attributes `FULL_FRAME`, `FREQUENCY_A_POLARIZATION_CONCAT`, `RANGE_BANDWIDTH_CONCAT`, `JOINT_OBSERVATION` before downloading anything. | R20, D9. |
| Dates | Store the UTC start time and the local date for each pass. | R19: Tonle Sap's 22:36 UTC pass is the next morning locally. |
| GIBS layer | Use it as context only; write the legend from D7; say in the app that it mixes two releases. | D7. |
| Preview PNGs | Use the alpha channel, not "non-black", to find the footprint; warp rows to Mercator or mark the overlay approximate; never compare brightness between dates. | R10, R23, D16. |
| Bake-off | Add ASF's own pattern as a candidate: fsspec `http` filesystem with a Bearer token, `cache_type="background"`, 8 MB blocks, `xr.open_datatree`, rioxarray `clip_box`. Its recorded cost was about 40 s per date for a 58 x 39 km single-polarization window at 10 m. | D13. |
| Deformation, if chosen | Subtract the ionosphere screen; consider the troposphere and tide tables; decode the three-digit mask; mask by connected component and coherence; reference to a stable point; test the sign on a known signal. | D11. |
| Python environment | `python3 -m venv venv && ./venv/bin/python -m pip install numpy scipy h5py pyproj rasterio rio-cogeo` (plus earthaccess and asf_search). | R22: this exact set installed and ran here. |
| Shell | In zsh, split a "lon lat" string with `${=pt}`, quote globs passed to grep, and do not `echo =====`. | Section 8 failures. |

Looks after block averaging (my arithmetic from the R1 table, assuming independent pixels, so optimistic):

| Mode | Native looks | Block | Posting | Looks | 95% no-change bound |
|---|---|---|---|---|---|
| 20 MHz, 20 m | about 5 | 2x2 | 40 m | about 20 | ±2.7 dB |
| 20 MHz, 20 m | about 5 | 3x3 | 60 m | about 45 | about ±1.9 dB |
| 20 MHz, 20 m | about 5 | 5x5 | 100 m | about 120 | about ±1.1 dB |
| 40 MHz, 10 m | about 2.5 | 4x4 | 40 m | about 40 | ±1.9 dB |
| 40 MHz, 10 m | about 2.5 | 8x8 | 80 m | about 160 | about ±1.0 dB |
| 5 MHz, 80 m (frequency B) | about 20 | none | 80 m | about 20 | ±2.7 dB |

---

## 5. Numeric outputs, verbatim

### 5.1 `RS/out/speckle_stats.txt` (run 2; script in 7.1)

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/speckle_stats.txt`

```text
ENL | sd of one image [dB] | sd of date2-date1 [dB] | 95% of |diff| below [dB] | P(|diff|>2 dB) | bias of dB-mean vs linear mean [dB]
  2.5 |  3.04 |  4.30 |  8.54 |  62.6% |  -0.93
    5 |  2.04 |  2.89 |  5.70 |  47.9% |  -0.45
    8 |  1.58 |  2.24 |  4.41 |  36.7% |  -0.28
   10 |  1.41 |  1.99 |  3.92 |  31.1% |  -0.22
   20 |  0.98 |  1.39 |  2.73 |  15.0% |  -0.11
   50 |  0.62 |  0.87 |  1.71 |   2.2% |  -0.04
  100 |  0.44 |  0.62 |  1.21 |   0.1% |  -0.02
  400 |  0.22 |  0.31 |  0.60 |   0.0% |  -0.01

Nominal looks per GCOV pixel (az res 7 m; slant res c/2B; incidence 40 deg):
  20 MHz @20 m: ground-range res  11.7 m -> ~ 4.9 looks
  40 MHz @10 m: ground-range res   5.8 m -> ~ 2.5 looks
  77 MHz @20 m: ground-range res   3.0 m -> ~18.9 looks
  5 MHz @80 m: ground-range res  46.6 m -> ~19.6 looks

No-change pair, log-ratio thresholded at k x its own standard deviation (two-sided):
  ENL 5, 1x1 mean filter: sd=2.89 dB, flagged at 1.5 sd: 13.1%
  ENL 5, 1x1 mean filter: sd=2.89 dB, flagged at 2 sd: 4.7%
  ENL 5, 1x1 mean filter: sd=2.89 dB, flagged at 3 sd: 0.4%
  ENL 5, 5x5 mean filter: sd=0.55 dB, flagged at 1.5 sd: 13.4%
  ENL 5, 5x5 mean filter: sd=0.55 dB, flagged at 2 sd: 4.5%
  ENL 5, 5x5 mean filter: sd=0.55 dB, flagged at 3 sd: 0.3%
  ENL 10, 5x5 mean filter: sd=0.39 dB, flagged at 1.5 sd: 13.4%
  ENL 10, 5x5 mean filter: sd=0.39 dB, flagged at 2 sd: 4.6%
  ENL 10, 5x5 mean filter: sd=0.39 dB, flagged at 3 sd: 0.3%

Order of operations at a water/land edge (true linear mean of a 50/50 window):
  linear mean -> -10.84 dB ; mean of dB values -> -15.00 dB ; difference 4.16 dB
```

### 5.2 Output of `R1/scripts/speckle.py` (run 1; printed to the transcript only; script in 7.6)

```text
ENL  std(dB) one image | std(dB) difference of two dates | 95% interval of difference | bias of mean-of-dB vs dB-of-mean
  1.0   5.57 (theory  5.57) |  7.87 | [-15.90, 15.87] |  -2.51 (theory  -2.51)
  2.4   3.11 (theory  3.12) |  4.41 | [ -8.76,  8.76] |  -0.97 (theory  -0.97)
  4.4   2.19 (theory  2.19) |  3.10 | [ -6.12,  6.12] |  -0.51 (theory  -0.51)
  9.0   1.49 (theory  1.49) |  2.10 | [ -4.13,  4.15] |  -0.25 (theory  -0.25)
 20.0   0.98 (theory  0.98) |  1.39 | [ -2.73,  2.73] |  -0.11 (theory  -0.11)
 40.0   0.69 (theory  0.69) |  0.98 | [ -1.92,  1.92] |  -0.05 (theory  -0.05)
 90.0   0.46 (theory  0.46) |  0.65 | [ -1.27,  1.27] |  -0.02 (theory  -0.02)
100.0   0.44 (theory  0.44) |  0.62 | [ -1.21,  1.21] |  -0.02 (theory  -0.02)
400.0   0.22 (theory  0.22) |  0.31 | [ -0.60,  0.60] |  -0.01 (theory  -0.01)

No-change scene, 1.5 sigma rule: flagged two-sided = 13.3%, one-sided = 6.6%

50/50 mix of -25 dB and -5 dB: mean in linear = -7.97 dB ; mean of dB = -15.00 dB
100-pixel field at -15 dB with ONE +20 dB pixel: linear mean = 0.13 dB ; median = -15.00 dB
```

### 5.3 `RS/out/d3_window_test.txt` (run 2; script in 7.2)

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/d3_window_test.txt`

```text
inside: shape (201, 201) first pixel (row, col) = (1300, 1000) geotransform (420000.0, 20.0, 0.0, 1524000.0, 0.0, -20.0)
   expected top-left corner of that pixel: (np.float64(420000.0), np.float64(1524000.0)) -> match: True
   'HVHV' requested but absent from file -> keys returned: ['HHHH', 'mask']
overhanging east edge: shape (201, 99) (asked for ~ 350 columns; no error, no warning)
entirely outside the frame -> IndexError index 3000 is out of bounds for axis 0 with size 3000
entirely west of the frame -> shape (205, 0) geotransform origin 400000.0 1524040.0 (empty array, plausible-looking georeference, no error)
```

### 5.4 `RS/out/geom_checks.txt` (run 2; script in 7.3)

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/geom_checks.txt`

```text
D3 corners-only vs densified, Tonle Sap, UTM 48N: window short by up to 0 m on one side
D3 corners-only vs densified, Jakobshavn, EPSG:3413: window short by up to 0 m on one side
D3 corners-only vs densified, Reykjanes, EPSG:3413 (if >60N is polar): window short by up to 0 m on one side
D3 corners-only vs densified, Antarctic Peninsula, EPSG:3031: window short by up to 0 m on one side

D4 four-corner image overlay, Tonle Sap frame (brief's extent): max north-south misplacement  0.50 km (=  2.8 preview pixels of 180 m), at mid-frame
D4 four-corner image overlay, 30N frame: max north-south misplacement  1.26 km (=  7.0 preview pixels of 180 m), at mid-frame
D4 four-corner image overlay, 48N frame: max north-south misplacement  2.42 km (= 13.4 preview pixels of 180 m), at mid-frame
D4 four-corner image overlay, Reykjanes-like 64N frame: max north-south misplacement  4.47 km (= 24.8 preview pixels of 180 m), at mid-frame
```

### 5.5 `RS/out/cog_domain_test.txt` (run 2; script in 7.4)

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/cog_domain_test.txt`

```text
cog_translate signature defaults: {'nodata': None, 'add_mask': False, 'overview_resampling': 'nearest', 'web_optimized': False, 'zoom_level_strategy': 'auto', 'aligned_levels': None, 'resampling': 'nearest'}

[13N (UTM 48N)] native 20.0 m -> COG EPSG:3857 pixel 19.109 projected m = 18.62 ground m; size 2304x2304; overviews [2, 4, 8]
   area by pixel counting: native UTM 1661.7 km2 ; EPSG:3857 raster 1761.9 km2 ; ratio 1.060 (1/cos^2(lat) = 1.053)
   share of codes saturated at 255 (>= 0.0 dB): 2.67% ; at 1 (<= -25.0 dB): 5.64%
   overview x8 decoded: water -22.27 dB (truth -22.00), land -8.41 dB (truth -8.00)
   overview x8 shoreline (mixed) columns decoded: [-17.08] dB

[47.9N (UTM 14N)] native 20.0 m -> COG EPSG:3857 pixel 38.219 projected m = 25.62 ground m; size 1792x1792; overviews [2, 4]
   area by pixel counting: native UTM 1661.7 km2 ; EPSG:3857 raster 3697.4 km2 ; ratio 2.225 (1/cos^2(lat) = 2.225)
   share of codes saturated at 255 (>= 0.0 dB): 2.65% ; at 1 (<= -25.0 dB): 5.63%
   overview x4 decoded: water -22.29 dB (truth -22.00), land -8.43 dB (truth -8.00)
   overview x4 shoreline (mixed) columns decoded: [-15.41] dB

[63.9N (UTM 27N)] native 20.0 m -> COG EPSG:3857 pixel 38.219 projected m = 16.81 ground m; size 2560x2560; overviews [2, 4, 8]
   area by pixel counting: native UTM 1661.7 km2 ; EPSG:3857 raster 8556.8 km2 ; ratio 5.149 (1/cos^2(lat) = 5.167)
   share of codes saturated at 255 (>= 0.0 dB): 2.65% ; at 1 (<= -25.0 dB): 5.63%
   overview x8 decoded: water -22.27 dB (truth -22.00), land -8.41 dB (truth -8.00)
   overview x8 shoreline (mixed) columns decoded: [-10.14] dB
```

On-disk size of the three COGs this test wrote (8-bit, deflate, 2048 x 2048 source of pure 5-look speckle, with
overviews): `RS/work/cog_32648.tif` 4,679,764 bytes (2304 x 2304), `cog_32614.tif` 2,610,777 bytes (1792 x 1792),
`cog_32627.tif` 5,406,735 bytes (2560 x 2560). Speckle compresses poorly: roughly 0.8 byte per pixel.

### 5.6 Output of `R1/scripts/cog_test.py` (run 1; printed to the transcript only; script in 7.7)

```text
<scratch>/review/sar-science/scripts/cog_test.py:35: DeprecationWarning: 'web_optomized' option is deprecated and will be removed in 6.0. Please use the `tms` option
  cog_translate(src8, dstA, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
validate A: True
A crs EPSG:3857 res (19.109257071294063, 19.109257071294063) shape (2560, 2304) overviews [2, 4, 8] nodata 0.0

level | dark-half median dB: D5 overview vs linear truth | boundary column (50/50 mix) | bright patch
    1 | dark  -22.24 vs  -22.29 | bright   -6.30 vs   -6.29 | max |diff| anywhere  24.8 dB, 99th pct  4.2 dB
    2 | dark  -22.34 vs  -22.06 | bright   -6.40 vs   -6.06 | max |diff| anywhere  13.3 dB, 99th pct  1.9 dB
    4 | dark  -22.24 vs  -22.02 | bright   -6.40 vs   -6.02 | max |diff| anywhere  11.7 dB, 99th pct  1.1 dB
    8 | dark  -22.24 vs  -22.01 | bright   -6.40 vs   -6.01 | max |diff| anywhere  10.4 dB, 99th pct  0.8 dB
```

Reading: "D5 overview" is the 8-bit dB-coded COG decoded at that overview level; "linear truth" is linear power
averaged onto the same grid. Level 1 differences come from clipping at -25 and 0 dB; levels 2 to 8 show the
dB-averaging bias.

### 5.7 `RS/out/release_split.json` as a table (run 2; script in 7.5; public CMR, 2026-11-14 about 01:57 local)

Columns: dates in any release; beta dates (of which beta only); provisional dates (of which since 2026-06-17);
first and last provisional date; validated dates; polarization and bandwidth of provisional granules (granule
counts); provisional dates with more than one granule; UTC time of the pass. No stack has a date in both provisional
and validated.

| Place | Stack | Dates | Beta (beta only) | Provisional (since 06-17) | Provisional first to last | Validated dates | Provisional modes (granules) | Multi-granule dates | UTC |
|---|---|---|---|---|---|---|---|---|---|
| Mexico City | `019_A_011` | 31 | 6 (0) | 29 (9) | 2025-10-30 to 2026-10-13 | 2026-10-25, 2026-11-06 | HH+HV 40+5: 29 | 0 | 12:05 |
| Kilauea | `072_D_079` | 29 | 7 (1) | 26 (9) | 2025-11-03 to 2026-10-17 | 2026-10-29, 2026-11-10 | HH+HV 40+5: 27 | 1 | 04:58 |
| Central Valley | `034_A_020` | 27 | 3 (0) | 26 (8) | 2025-11-24 to 2026-10-14 | 2026-10-26 | HH+HV 40+5: 26 | 0 | 13:08, 13:09 |
| Reykjanes | `159_A_034` | 27 | 0 (0) | 26 (9) | 2025-11-09 to 2026-10-11 | 2026-10-23 | HH+HV 40+5: 28 | 2 | 05:22 |
| Reykjanes alt | `082_D_056` | 28 | 0 (0) | 27 (10) | 2025-11-03 to 2026-10-17 | 2026-10-29 | HH+HV 40+5: 28 | 1 | 21:23, 21:24 |
| Punjab | `156_A_017` | 26 | 3 (0) | 24 (9) | 2025-11-21 to 2026-10-11 | 2026-10-23, 2026-11-04 | HH+HV 40+5: 26 | 2 | 00:13 |
| Atchafalaya | `084_D_073` | 19 | 8 (8) | 10 (10) | 2026-06-20 to 2026-10-18 | 2026-10-30 | HH+HV 40+5: 10 | 0 | 00:53 |
| Grand Forks | `099_D_064` | 19 | 8 (8) | 10 (10) | 2026-06-21 to 2026-10-19 | 2026-10-31 | HH+HV 40+5: 10 | 0 | 01:46 |
| Chicago | `148_A_023` | 18 | 7 (7) | 9 (9) | 2026-06-24 to 2026-10-10 | 2026-10-22, 2026-11-03 | HH+HV+VH+VV 20+5: 9 | 0 | 10:57 |
| Champaign | `148_A_022` | 18 | 7 (7) | 9 (9) | 2026-06-24 to 2026-10-10 | 2026-10-22, 2026-11-03 | HH+HV+VH+VV 20+5: 9 | 0 | 10:56 |
| Jakobshavn | `170_D_053` | 17 | 7 (7) | 9 (9) | 2026-06-25 to 2026-10-11 | 2026-10-23 | HH 77: 10 | 1 | 23:52 |
| Okavango | `172_A_168` | 15 | 5 (5) | 9 (9) | 2026-06-26 to 2026-10-12 | 2026-10-24 | HH+HV 20+5: 10 | 1 | 04:17 |
| Rondonia | `068_D_094` | 13 | 2 (2) | 10 (10) | 2026-06-18 to 2026-10-16 | 2026-10-28 | HH+HV 20+5: 5; HH 20+5: 5 | 0 | 22:27 |
| Tonle Sap | `083_A_008` | 11 | 0 (0) | 10 (10) | 2026-06-19 to 2026-10-17 | 2026-10-29 | HH+HV 20+5: 10 | 0 | 22:36 |
| Sudd | `050_D_085` | 11 | 0 (0) | 10 (10) | 2026-06-17 to 2026-10-15 | 2026-10-27 | HH 20+5: 5; HH+HV 20+5: 5 | 0 | 16:24 |
| Mekong Delta | `047_D_083` | 11 | 0 (0) | 10 (10) | 2026-06-17 to 2026-10-15 | 2026-10-27 | HH+HV 40+5: 10 | 0 | 11:23 |
| Mamiraua | `097_D_090` | 10 | 1 (1) | 9 (9) | 2026-06-20 to 2026-10-06 | none | ? 5: 4; HH 20+5: 3; HH+HV 20+5: 2 | 0 | 22:41 |
| Pantanal | `111_D_097` | 9 | 0 (0) | 9 (9) | 2026-06-21 to 2026-10-19 | none | HH+HV 20+5: 5; HH 20+5: 4 | 0 | 22:03 |

### 5.8 `RS/out/coverage4.txt` and `RS/out/coverage_all.txt` (run 2; output of `research/nisar_coverage.py`)

`releases={...}` counts **granules** per release (B beta, P provisional, V validated), not dates.

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/coverage4.txt`

```text
GCOV at lon=-99.1 lat=19.4: 2 stack(s)
  019_A_011   31 dates  2025-10-30 .. 2026-11-06  pol=HH+HV  bw=40+5 MHz  ~6992 MB/file  releases={'B': 6, 'P': 29, 'V': 2}
             10-30 11-11 11-23 12-05 12-17 12-29 2026-01-10 2026-01-22 2026-02-03 2026-02-15 2026-02-27 2026-03-11 2026-03-23 2026-04-04 2026-04-16 2026-04-28 2026-05-10 2026-05-22 2026-06-03 2026-06-15 2026-06-27 2026-07-09 2026-07-21 2026-08-14 2026-08-26 2026-09-07 2026-09-19 2026-10-01 2026-10-13 2026-10-25 2026-11-06
  113_D_079   28 dates  2025-10-25 .. 2026-10-20  pol=HH+HV  bw=40+5 MHz  ~7151 MB/file  releases={'B': 8, 'P': 28}
             10-25 11-06 11-18 11-30 12-12 12-24 2026-01-05 2026-01-17 2026-01-29 2026-02-10 2026-02-22 2026-03-06 2026-03-18 2026-04-11 2026-04-23 2026-05-05 2026-05-17 2026-05-29 2026-06-10 2026-06-22 2026-07-04 2026-07-16 2026-08-21 2026-09-02 2026-09-14 2026-09-26 2026-10-08 2026-10-20

GCOV at lon=104.05 lat=12.95: 2 stack(s)
  083_A_008   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 10, 'V': 1}
             06-19 07-01 07-13 07-25 08-18 08-30 09-11 09-23 10-05 10-17 10-29
  148_D_082   11 dates  2026-06-24 .. 2026-11-03  pol=HH/HH+HV  bw=20+5 MHz  ~1896 MB/file  releases={'P': 9, 'V': 2}
             06-24 07-06 07-18 08-11 08-23 09-04 09-16 09-28 10-10 10-22 11-03

GCOV at lon=-91.45 lat=30.0: 5 stack(s)
  084_D_073   19 dates  2025-10-23 .. 2026-10-30  pol=HH+HV  bw=40+5 MHz  ~6346 MB/file  releases={'B': 8, 'P': 10, 'V': 1}
             10-23 11-04 11-16 11-28 12-10 12-22 2026-01-03 2026-01-15 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06 2026-10-18 2026-10-30
  105_A_017   17 dates  2025-11-17 .. 2026-10-31  pol=HH+HV  bw=40+5 MHz  ~6560 MB/file  releases={'B': 6, 'P': 10, 'V': 1}
             11-17 11-29 12-11 12-23 2026-01-04 2026-01-16 2026-06-21 2026-07-03 2026-07-15 2026-07-27 2026-08-20 2026-09-01 2026-09-13 2026-09-25 2026-10-07 2026-10-19 2026-10-31
  156_D_074   16 dates  2025-11-21 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~4580 MB/file  releases={'B': 6, 'P': 10, 'V': 1}
             11-21 12-03 12-15 12-27 2026-01-08 2026-01-20 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23
  033_A_017   15 dates  2025-11-24 .. 2026-10-26  pol=HH+HV  bw=40+5 MHz  ~6572 MB/file  releases={'B': 5, 'P': 9, 'V': 1}
             11-24 12-06 12-18 12-30 2026-01-11 2026-06-28 2026-07-10 2026-07-22 2026-08-15 2026-08-27 2026-09-08 2026-09-20 2026-10-02 2026-10-14 2026-10-26
  156_D_073   11 dates  2025-11-21 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~6480 MB/file  releases={'B': 4, 'P': 7, 'V': 1}
             11-21 12-15 12-27 2026-01-20 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-10-23

GCOV at lon=-88.3 lat=40.2: 2 stack(s)
  148_A_022   18 dates  2025-11-08 .. 2026-11-03  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8196 MB/file  releases={'B': 7, 'P': 9, 'V': 2}
             11-08 11-20 12-02 12-14 12-26 2026-01-07 2026-01-19 2026-06-24 2026-07-06 2026-07-18 2026-08-11 2026-08-23 2026-09-04 2026-09-16 2026-09-28 2026-10-10 2026-10-22 2026-11-03
  084_D_068   16 dates  2025-11-04 .. 2026-10-30  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8252 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
             11-04 11-16 12-22 2026-01-03 2026-01-15 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06 2026-10-18 2026-10-30
```

Source file: `<scratch>/review/sar-remote-sensing-scientist/out/coverage_all.txt`

```text
GCOV at lon=-155.28 lat=19.41: 2 stack(s)
  072_D_079   29 dates  2025-10-22 .. 2026-11-10  pol=HH+HV  bw=40+5 MHz  ~2844 MB/file  releases={'B': 7, 'P': 27, 'V': 2}
             10-22 11-03 11-15 11-27 12-09 12-21 2026-01-02 2026-01-14 2026-01-26 2026-02-07 2026-02-19 2026-03-15 2026-03-27 2026-04-08 2026-04-20 2026-05-02 2026-05-14 2026-05-26 2026-06-19 2026-07-01 2026-07-13 2026-08-18 2026-08-30 2026-09-11 2026-09-23 2026-10-05 2026-10-17 2026-10-29 2026-11-10
  151_A_011   28 dates  2025-11-08 .. 2026-11-03  pol=HH+HV  bw=40+5 MHz  ~2642 MB/file  releases={'B': 6, 'P': 27, 'V': 2}
             11-08 11-20 12-02 12-14 12-26 2026-01-07 2026-01-19 2026-01-31 2026-02-12 2026-02-24 2026-03-08 2026-03-20 2026-04-25 2026-05-07 2026-05-19 2026-05-31 2026-06-12 2026-06-24 2026-07-06 2026-07-18 2026-08-11 2026-08-23 2026-09-04 2026-09-16 2026-09-28 2026-10-10 2026-10-22 2026-11-03

GCOV at lon=-119.56 lat=36.1: 2 stack(s)
  034_A_020   27 dates  2025-11-24 .. 2026-10-26  pol=HH+HV  bw=40+5 MHz  ~7109 MB/file  releases={'B': 3, 'P': 26, 'V': 1}
             11-24 12-06 12-18 12-30 2026-01-11 2026-01-23 2026-02-04 2026-02-16 2026-02-28 2026-03-12 2026-03-24 2026-04-05 2026-04-17 2026-04-29 2026-05-11 2026-05-23 2026-06-04 2026-06-16 2026-06-28 2026-07-10 2026-07-22 2026-08-15 2026-08-27 2026-09-08 2026-09-20 2026-10-14 2026-10-26
  114_D_070   24 dates  2025-11-30 .. 2026-10-20  pol=?/HH+HV  bw=40+5/5 MHz  ~7244 MB/file  releases={'B': 4, 'P': 25}
             11-30 12-12 12-24 2026-01-17 2026-01-29 2026-02-10 2026-02-22 2026-03-06 2026-03-18 2026-04-11 2026-04-23 2026-05-05 2026-05-17 2026-05-29 2026-06-10 2026-06-22 2026-07-04 2026-07-16 2026-08-21 2026-09-02 2026-09-14 2026-09-26 2026-10-08 2026-10-20

GCOV at lon=-22.4 lat=63.88: 6 stack(s)
  082_D_056   28 dates  2025-11-03 .. 2026-10-29  pol=HH+HV  bw=40+5 MHz  ~4849 MB/file  releases={'P': 28, 'V': 1}
             11-03 11-15 11-27 12-09 12-21 2026-01-02 2026-01-14 2026-01-26 2026-02-07 2026-02-19 2026-03-15 2026-04-08 2026-04-20 2026-05-02 2026-05-14 2026-05-26 2026-06-07 2026-06-19 2026-07-01 2026-07-13 2026-07-25 2026-08-18 2026-08-30 2026-09-11 2026-09-23 2026-10-05 2026-10-17 2026-10-29
  159_A_034   27 dates  2025-11-09 .. 2026-10-23  pol=HH+HV  bw=40+5 MHz  ~5314 MB/file  releases={'P': 28, 'V': 1}
             11-09 11-21 12-03 12-15 12-27 2026-01-08 2026-01-20 2026-02-13 2026-02-25 2026-03-09 2026-03-21 2026-04-02 2026-04-26 2026-05-08 2026-05-20 2026-06-01 2026-06-13 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23
  087_A_034   11 dates  2026-06-20 .. 2026-10-30  pol=HH+HV  bw=40+5 MHz  ~5365 MB/file  releases={'P': 10, 'V': 1}
             06-20 07-02 07-14 07-26 08-19 08-31 09-12 09-24 10-06 10-18 10-30
  015_A_034   10 dates  2026-06-27 .. 2026-10-25  pol=HH+HV  bw=40+5 MHz  ~3785 MB/file  releases={'P': 9, 'V': 1}
             06-27 07-09 07-21 08-14 08-26 09-07 09-19 10-01 10-13 10-25
  111_D_056    9 dates  2026-06-21 .. 2026-10-19  pol=HH+HV  bw=40+5 MHz  ~1900 MB/file  releases={'P': 9}
             06-21 07-03 07-15 08-20 09-01 09-13 09-25 10-07 10-19
  010_D_056    9 dates  2026-06-26 .. 2026-10-24  pol=HH+HV  bw=40+5 MHz  ~3297 MB/file  releases={'P': 8, 'V': 1}
             06-26 07-08 07-20 08-13 09-06 09-18 09-30 10-12 10-24

GCOV at lon=75.8 lat=30.6: 2 stack(s)
  156_A_017   26 dates  2025-11-21 .. 2026-11-04  pol=HH+HV  bw=40+5 MHz  ~6942 MB/file  releases={'B': 3, 'P': 26, 'V': 2}
             11-21 12-03 12-15 12-27 2026-01-08 2026-01-20 2026-02-01 2026-02-25 2026-03-09 2026-03-21 2026-04-26 2026-05-08 2026-05-20 2026-06-01 2026-06-13 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23 2026-11-04
  034_D_073   24 dates  2025-11-24 .. 2026-11-07  pol=HH+HV/HH+HV+VH+VV  bw=20+5/40+5 MHz  ~6138 MB/file  releases={'B': 2, 'P': 30, 'V': 2}
             11-24 12-18 2026-01-11 2026-01-23 2026-02-04 2026-02-16 2026-02-28 2026-03-12 2026-04-05 2026-04-17 2026-04-29 2026-05-11 2026-05-23 2026-06-04 2026-06-16 2026-06-28 2026-07-10 2026-07-22 2026-08-15 2026-08-27 2026-09-08 2026-09-20 2026-10-02 2026-11-07

GCOV at lon=-97.4 lat=47.9: 4 stack(s)
  099_D_064   19 dates  2025-10-24 .. 2026-10-31  pol=HH+HV  bw=40+5 MHz  ~7076 MB/file  releases={'B': 8, 'P': 10, 'V': 1}
             10-24 11-05 11-17 11-29 12-11 12-23 2026-01-04 2026-01-16 2026-06-21 2026-07-03 2026-07-15 2026-07-27 2026-08-20 2026-09-01 2026-09-13 2026-09-25 2026-10-07 2026-10-19 2026-10-31
  105_A_026   18 dates  2025-10-24 .. 2026-10-19  pol=HH+HV  bw=40+5 MHz  ~6958 MB/file  releases={'B': 8, 'P': 10}
             10-24 11-05 11-17 11-29 12-11 12-23 2026-01-04 2026-01-16 2026-06-21 2026-07-03 2026-07-15 2026-07-27 2026-08-20 2026-09-01 2026-09-13 2026-09-25 2026-10-07 2026-10-19
  004_A_026   16 dates  2025-10-29 .. 2026-11-05  pol=HH+HV  bw=40+5 MHz  ~7474 MB/file  releases={'B': 5, 'P': 10, 'V': 2}
             10-29 11-22 12-16 12-28 2026-01-09 2026-06-26 2026-07-08 2026-07-20 2026-08-13 2026-08-25 2026-09-06 2026-09-18 2026-09-30 2026-10-12 2026-10-24 2026-11-05
  171_D_064   12 dates  2025-12-16 .. 2026-10-24  pol=HH+HV  bw=40+5 MHz  ~7403 MB/file  releases={'B': 2, 'P': 9, 'V': 1}
             12-16 12-28 2026-06-26 2026-07-08 2026-07-20 2026-08-13 2026-08-25 2026-09-06 2026-09-18 2026-09-30 2026-10-12 2026-10-24

GCOV at lon=-87.65 lat=41.85: 4 stack(s)
  148_A_023   18 dates  2025-11-08 .. 2026-11-03  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8223 MB/file  releases={'B': 7, 'P': 9, 'V': 2}
             11-08 11-20 12-02 12-14 12-26 2026-01-07 2026-01-19 2026-06-24 2026-07-06 2026-07-18 2026-08-11 2026-08-23 2026-09-04 2026-09-16 2026-09-28 2026-10-10 2026-10-22 2026-11-03
  084_D_067   16 dates  2025-11-04 .. 2026-10-30  pol=HH+HV+VH+VV  bw=20+5 MHz  ~7606 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
             11-04 11-16 12-22 2026-01-03 2026-01-15 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06 2026-10-18 2026-10-30
  047_A_023   11 dates  2026-06-17 .. 2026-10-27  pol=HH+HV+VH+VV  bw=20+5 MHz  ~7944 MB/file  releases={'P': 10, 'V': 1}
             06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
  148_A_022    1 dates  2026-06-24 .. 2026-06-24  pol=HH+HV+VH+VV  bw=20+5 MHz  ~8095 MB/file  releases={'P': 1}
             06-24

GCOV at lon=-49.6 lat=69.17: 4 stack(s)
  170_D_053   17 dates  2025-10-28 .. 2026-10-23  pol=HH  bw=77 MHz  ~935 MB/file  releases={'B': 7, 'P': 10, 'V': 1}
             10-28 11-09 11-21 12-03 12-15 12-27 2026-01-08 2026-06-25 2026-07-07 2026-07-19 2026-08-12 2026-08-24 2026-09-05 2026-09-17 2026-09-29 2026-10-11 2026-10-23
  069_D_053   16 dates  2025-11-14 .. 2026-10-28  pol=HH  bw=77 MHz  ~935 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
             11-14 11-26 12-08 2026-01-01 2026-01-13 2026-06-18 2026-06-30 2026-07-12 2026-07-24 2026-08-17 2026-08-29 2026-09-10 2026-09-22 2026-10-04 2026-10-16 2026-10-28
  059_A_037   15 dates  2025-11-26 .. 2026-10-28  pol=HH  bw=77 MHz  ~893 MB/file  releases={'B': 4, 'P': 10, 'V': 1}
             11-26 12-08 12-20 2026-01-01 2026-06-18 2026-06-30 2026-07-12 2026-07-24 2026-08-17 2026-08-29 2026-09-10 2026-09-22 2026-10-04 2026-10-16 2026-10-28
  131_A_037   14 dates  2025-12-13 .. 2026-11-02  pol=HH  bw=77 MHz  ~988 MB/file  releases={'B': 3, 'P': 10, 'V': 1}
             12-13 12-25 2026-01-18 2026-06-23 2026-07-05 2026-07-17 2026-08-10 2026-08-22 2026-09-03 2026-09-15 2026-09-27 2026-10-09 2026-10-21 2026-11-02

GCOV at lon=22.9 lat=-19.3: 2 stack(s)
  172_A_168   15 dates  2025-11-22 .. 2026-10-24  pol=HH+HV  bw=20+5 MHz  ~1879 MB/file  releases={'B': 5, 'P': 10, 'V': 1}
             11-22 12-04 12-16 12-28 2026-01-09 2026-06-26 2026-07-08 2026-07-20 2026-08-13 2026-08-25 2026-09-06 2026-09-18 2026-09-30 2026-10-12 2026-10-24
  151_D_098   10 dates  2026-06-24 .. 2026-10-22  pol=HH/HH+HV  bw=20+5 MHz  ~1934 MB/file  releases={'P': 11, 'V': 1}
             06-24 07-06 07-18 08-11 08-23 09-04 09-16 09-28 10-10 10-22

GCOV at lon=-63.5 lat=-10.0: 4 stack(s)
  068_D_094   13 dates  2025-11-02 .. 2026-10-28  pol=HH/HH+HV  bw=20+5 MHz  ~1564 MB/file  releases={'B': 2, 'P': 10, 'V': 1}
             11-02 11-14 2026-06-18 2026-06-30 2026-07-12 2026-07-24 2026-08-17 2026-08-29 2026-09-10 2026-09-22 2026-10-04 2026-10-16 2026-10-28
  161_A_173    9 dates  2026-06-25 .. 2026-10-23  pol=HH+HV  bw=20/20+5 MHz  ~1959 MB/file  releases={'P': 11, 'V': 1}
             06-25 07-07 07-19 08-24 09-05 09-17 09-29 10-11 10-23
  161_A_172    4 dates  2026-06-25 .. 2026-08-24  pol=HH+HV  bw=20+5 MHz  ~1942 MB/file  releases={'P': 4}
             06-25 07-07 07-19 08-24
  169_D_093    3 dates  2026-07-07 .. 2026-10-11  pol=HH+HV  bw=20+5 MHz  ~2005 MB/file  releases={'P': 3}
             07-07 08-24 10-11

GCOV at lon=30.7 lat=7.5: 2 stack(s)
  050_D_085   11 dates  2026-06-17 .. 2026-10-27  pol=HH/HH+HV  bw=20+5 MHz  ~1812 MB/file  releases={'P': 10, 'V': 1}
             06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
  086_A_005   10 dates  2026-06-20 .. 2026-10-18  pol=HH/HH+HV  bw=20+5 MHz  ~1822 MB/file  releases={'P': 10}
             06-20 07-02 07-14 07-26 08-19 08-31 09-12 09-24 10-06 10-18

GCOV at lon=105.6 lat=10.0: 4 stack(s)
  047_D_083   11 dates  2026-06-17 .. 2026-10-27  pol=HH+HV  bw=40+5 MHz  ~6359 MB/file  releases={'P': 10, 'V': 1}
             06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
  047_D_084   11 dates  2026-06-17 .. 2026-10-27  pol=HH/HH+HV  bw=20+5/40+5 MHz  ~1363 MB/file  releases={'P': 20, 'V': 2}
             06-17 06-29 07-11 07-23 08-16 08-28 09-09 09-21 10-03 10-15 10-27
  083_A_006   11 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=20+5/40+5 MHz  ~1145 MB/file  releases={'P': 20, 'V': 2}
             06-19 07-01 07-13 07-25 08-18 08-30 09-11 09-23 10-05 10-17 10-29
  083_A_007   10 dates  2026-06-19 .. 2026-10-29  pol=HH+HV  bw=40+5 MHz  ~5914 MB/file  releases={'P': 9, 'V': 1}
             06-19 07-13 07-25 08-18 08-30 09-11 09-23 10-05 10-17 10-29

GCOV at lon=-65.0 lat=-2.7: 2 stack(s)
  097_D_090   10 dates  2025-11-04 .. 2026-10-06  pol=?/HH/HH+HV  bw=20+5/5 MHz  ~1497 MB/file  releases={'B': 1, 'P': 9}
             11-04 2026-06-20 2026-07-02 2026-07-14 2026-07-26 2026-08-19 2026-08-31 2026-09-12 2026-09-24 2026-10-06
  161_A_176    9 dates  2026-06-25 .. 2026-10-23  pol=HH+HV  bw=20/20+5 MHz  ~1892 MB/file  releases={'P': 12, 'V': 1}
             06-25 07-07 07-19 08-24 09-05 09-17 09-29 10-11 10-23

GCOV at lon=-57.2 lat=-17.3: 2 stack(s)
  111_D_097    9 dates  2026-06-21 .. 2026-10-19  pol=HH/HH+HV  bw=20+5 MHz  ~1925 MB/file  releases={'P': 9}
             06-21 07-03 07-15 08-20 09-01 09-13 09-25 10-07 10-19
  132_A_169    9 dates  2026-07-05 .. 2026-10-21  pol=HH+HV  bw=20+5 MHz  ~1934 MB/file  releases={'P': 9}
             07-05 07-17 08-10 08-22 09-03 09-15 09-27 10-09 10-21
```

---

## 6. What the official ASF notebooks actually do for change detection

Sources: `RS/out/NISAR_GCOV_SARChangeDetectionMethods.txt` and `RS/out/NISAR_GCOV_Time_Series_Example.txt` (text dumps
made by `nb2txt.py` from the notebooks in `RS/dl/cookbook/notebooks/`, repository `ASFOpenSARlab/NISAR_Cookbook`,
Apache-2.0, downloaded 2026-11-14). Described here in my words; read the dumps for the code.

**Notebook 1: NISAR_GCOV_SARChangeDetectionMethods (an introduction to SAR change-detection methods)**

1. Input: six locally downloaded **beta** granules of one stack (`042_A_019`, mode 2005, dual-pol, 1 November to
   31 December 2025, CRIDs X05009/X05010). The notebook says it needs dual-pol data.
2. Opens the `frequencyA` group of each file with xarray's data-tree reader and concatenates along time. The full
   cube is 6 x 17496 x 17748 and 37 GB, so it immediately takes a 3000 x 3000 pixel slice of `HVHV` by index.
   xarray decodes `mask` to float32.
3. Converts to dB only for display. The animation uses one stretch for all dates: the 5th and 95th percentile of the
   whole dB stack.
4. Time-series methods, all on **linear power**, per pixel across the six dates: minimum, maximum, range, mean,
   variance, standard deviation, coefficient of variation (standard deviation over mean), 5th/50th/95th percentiles
   and the 95th minus 5th range. It then thresholds three of them (percentile range, standard deviation, coefficient
   of variation) at the value that leaves the top 5% of pixels. By construction each mask flags 5% of the window.
5. Pair-wise method: picks the two acquisitions nearest two given dates (13 and 25 November 2025), computes
   10*log10(later/earlier) on the unfiltered pixels, prints the 1st and 99th percentiles (-6.18 and +3.55 dB), and
   applies a manual threshold of -2 dB, flagging values below it. It then asks the reader whether the threshold looks appropriate.
6. No mask is applied, no multilooking, no speckle filter anywhere in the notebook.
7. Export: GeoTIFFs written with the `osgeo.gdal` bindings; the geotransform takes the minimum x and maximum y
   coordinate values as the upper-left corner although those are pixel centres.

**Notebook 2: NISAR_GCOV_Time_Series_Example (an example GCOV backscatter time series)**

1. Search with `asf_search`: provisional maturity, production pipeline `PR`, one frame, one relative orbit, one
   flight direction, an area polygon; a filename filter removes the QA_STATS files. It keeps the highest CRID per
   product name.
2. It removes two of the five dates it found (9 and 21 July 2026) because the products show processing problems.
3. Access: the user pastes an Earthdata bearer token; files are opened over HTTPS through an fsspec `http`
   filesystem with that token in the header, `cache_type="background"` and 8 MB blocks; then the same data-tree
   reader as above. Opening three files took 17.1 s.
4. Subset: writes the CRS from the file's `projection` value and clips with a lat/lon box (rioxarray). Result 5784 x
   3909 pixels at 10 m. Saving the three-date subset to a local Zarr store took 1 min 59 s; the notebook recommends
   doing that once because remote reads are slow.
5. dB conversion guarded only by a greater-than-zero test. The printed arrays include values near 1e-14 and missing
   values at one edge.
6. States that statistics, filters and block averages must be computed in power, not dB; computes the window mean
   per date in power, then converts: -2.56, -2.83, -2.46 dB.

What this means for the build: the notebooks are a good pattern for **opening, subsetting and the linear-then-dB
rule**, and a real example of **dropping bad provisional dates**. They are not a pattern for thresholds, speckle
handling, masking or georeferenced export.

Also in the downloaded Cookbook and **not read by these runs**: `RS/dl/cookbook/notebooks/load_subset_reproject_xr.ipynb`,
`load_subset_reproject_isce3.ipynb`, `search_stream_NISAR_GCOV_asf_search.ipynb`, `NISAR_Pixel_Conversion.ipynb`,
`NISAR_data_access.ipynb`, `RS/dl/cookbook/util/subset_h5.py`, `util/aoi_coverage.py`. The loader
`RS/dl/cookbook/util/load_gcov.py` was read: it takes the grid from the first file only and raises a ValueError when
a coordinate range is outside the dataset.

---

## 7. Code that was shown to work, verbatim

All of these ran to completion in the scratch virtual environments (Python 3.12; versions in R22). They use
synthetic data only, except `release_split.py`, which queries the public CMR catalog (no login).

How they were run:

```sh
W=<scratch>/review/sar-remote-sensing-scientist
cd $W && /opt/anaconda3/bin/python3 -m venv venv
./venv/bin/python -m pip install --quiet --disable-pip-version-check numpy scipy h5py pyproj rasterio rio-cogeo
./venv/bin/python -I scripts/speckle_stats.py | tee out/speckle_stats.txt
./venv/bin/python -I scripts/d3_window_test.py $W/work/synth_gcov.h5 2>&1 | tee out/d3_window_test.txt
./venv/bin/python -I scripts/geom_checks.py | tee out/geom_checks.txt
./venv/bin/python -I scripts/cog_domain_test.py $W/work 2>&1 | tee out/cog_domain_test.txt
/opt/anaconda3/bin/python3 -I scripts/release_split.py out/release_split.json
# coverage helper in a zsh loop (note ${=pt}):
R=<prehackathon-repo>/research/nisar_coverage.py
for pt in "-99.1 19.4" "104.05 12.95"; do /opt/anaconda3/bin/python3 -I $R ${=pt} GCOV; done
```

### 7.1 `RS/scripts/speckle_stats.py`

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/speckle_stats.py`

```python
"""Speckle numbers for L-look intensity (gamma, shape L, mean 1). Pure numpy/scipy; no project data."""
import numpy as np
from scipy import special, stats
rng = np.random.default_rng(42)
K = 10 / np.log(10)
print("ENL | sd of one image [dB] | sd of date2-date1 [dB] | 95% of |diff| below [dB] | P(|diff|>2 dB) | bias of dB-mean vs linear mean [dB]")
for L in (2.5, 5, 8, 10, 20, 50, 100, 400):
    sd1 = K * np.sqrt(special.polygamma(1, L))
    sdd = np.sqrt(2) * sd1
    # ratio of two independent gamma(L) intensities ~ F(2L, 2L)
    q = stats.f.ppf(0.975, 2 * L, 2 * L)
    p2 = 2 * stats.f.sf(10 ** 0.2, 2 * L, 2 * L)
    bias = K * (special.digamma(L) - np.log(L))
    print(f"{L:5g} | {sd1:5.2f} | {sdd:5.2f} | {10*np.log10(q):5.2f} | {p2:6.1%} | {bias:6.2f}")

print("\nNominal looks per GCOV pixel (az res 7 m; slant res c/2B; incidence 40 deg):")
for name, bw, post in (("20 MHz @20 m", 20e6, 20), ("40 MHz @10 m", 40e6, 10), ("77 MHz @20 m", 77e6, 20), ("5 MHz @80 m", 5e6, 80)):
    gr = 299792458 / (2 * bw) / np.sin(np.radians(40))
    print(f"  {name}: ground-range res {gr:5.1f} m -> ~{(post/gr)*(post/7):4.1f} looks")

# k-sigma rule on a NO-CHANGE pair: what fraction is flagged?
print("\nNo-change pair, log-ratio thresholded at k x its own standard deviation (two-sided):")
for L, win in ((5, 1), (5, 5), (10, 5)):
    n = 1500
    a = rng.gamma(L, 1 / L, (n, n)); b = rng.gamma(L, 1 / L, (n, n))
    if win > 1:  # boxcar in LINEAR power
        from scipy.ndimage import uniform_filter
        a = uniform_filter(a, win); b = uniform_filter(b, win)
    d = 10 * np.log10(b / a)
    for k in (1.5, 2, 3):
        print(f"  ENL {L}, {win}x{win} mean filter: sd={d.std():.2f} dB, flagged at {k} sd: {np.mean(np.abs(d - d.mean()) > k * d.std()):.1%}")

# filter-then-log versus log-then-filter on a shoreline (water -22 dB, land -8 dB)
print("\nOrder of operations at a water/land edge (true linear mean of a 50/50 window):")
w, l = 10 ** -2.2, 10 ** -0.8
print(f"  linear mean -> {10*np.log10((w+l)/2):.2f} dB ; mean of dB values -> {(-22-8)/2:.2f} dB ; difference {10*np.log10((w+l)/2)-(-15):.2f} dB")
```

### 7.2 `RS/scripts/d3_window_test.py`

`read_window_local` is the brief's sketch D3 with only the file-opening line changed. To reuse it against a real
file, restore `fs.open(url, ...)` and add the guards listed in Section 4.

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/d3_window_test.py`

```python
"""Exercise the window arithmetic of sketch D3 on a synthetic GCOV-shaped HDF5 file (local, no network).
Only the file-opening line differs from the brief (local path instead of fs.open(url))."""
import sys, numpy as np, h5py
from pyproj import Transformer

def read_window_local(path, bbox, freq="A", terms=("HHHH", "HVHV")):
    with h5py.File(path, "r") as h5:
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
        return out, epsg, (x[c0] - dx / 2, dx, 0.0, y[r0] - dy / 2, 0.0, dy)

path = sys.argv[1]
epsg, px, nx, ny = 32648, 20.0, 3000, 2500
x0, y0 = 400010.0, 1500010.0 + (ny - 1) * px          # centre of top-left pixel
x = x0 + px * np.arange(nx); y = y0 - px * np.arange(ny)  # y descends
rr, cc = np.meshgrid(np.arange(ny), np.arange(nx), indexing="ij")
with h5py.File(path, "w") as f:
    g = f.create_group("/science/LSAR/GCOV/grids/frequencyA")
    g["xCoordinates"] = x; g["yCoordinates"] = y
    g.create_dataset("projection", data=np.uint32(epsg))
    g.create_dataset("HHHH", data=(rr * 10000 + cc).astype("float32"), chunks=(512, 512), compression="gzip")  # value encodes (row, col)
    g.create_dataset("mask", data=np.ones((ny, nx), "uint8"), chunks=(512, 512), compression="gzip")

tf = Transformer.from_crs(epsg, 4326, always_xy=True)
# 1) window inside the frame
w, s = tf.transform(x[1000] - 3, y[1500] + 3); e, n = tf.transform(x[1200] + 3, y[1300] - 3)
out, ep, gt = read_window_local(path, (w, s, e, n))
a = out["HHHH"]; r0 = int(a[0, 0] // 10000); c0 = int(a[0, 0] % 10000)
print("inside: shape", a.shape, "first pixel (row, col) =", (r0, c0), "geotransform", tuple(round(float(v), 2) for v in gt))
print("   expected top-left corner of that pixel:", (x[c0] - px / 2, y[r0] + px / 2), "-> match:", abs(gt[0] - (x[c0] - px / 2)) < 1e-6 and abs(gt[3] - (y[r0] + px / 2)) < 1e-6)
print("   'HVHV' requested but absent from file -> keys returned:", sorted(out))
# 2) window hanging over the east edge: silently truncated?
w, s = tf.transform(x[2900], y[1500]); e, n = tf.transform(x[-1] + 5000, y[1300])
out, ep, gt = read_window_local(path, (w, s, e, n)); print("overhanging east edge: shape", out["HHHH"].shape, "(asked for ~", int((5000 + 100 * px) / px), "columns; no error, no warning)")
# 3) window entirely east of the frame
w, s = tf.transform(x[-1] + 20000, y[1500]); e, n = tf.transform(x[-1] + 30000, y[1300])
try:
    out, ep, gt = read_window_local(path, (w, s, e, n)); print("outside: shape", out["HHHH"].shape, gt)
except Exception as ex:
    print("entirely outside the frame ->", type(ex).__name__, ex)
# 4) window entirely west of the frame
w, s = tf.transform(x[0] - 30000, y[1500]); e, n = tf.transform(x[0] - 20000, y[1300])
try:
    out, ep, gt = read_window_local(path, (w, s, e, n)); print("entirely west of the frame -> shape", out["HHHH"].shape, "geotransform origin", gt[0], gt[3], "(empty array, plausible-looking georeference, no error)")
except Exception as ex:
    print("entirely west ->", type(ex).__name__, ex)
```

### 7.3 `RS/scripts/geom_checks.py`

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/geom_checks.py`

```python
import numpy as np
from pyproj import Transformer
# (a) D3: 4-corner transform versus densified bounds
for name, epsg, box in (("Tonle Sap, UTM 48N", 32648, (103.5, 12.5, 104.6, 13.4)),
                        ("Jakobshavn, EPSG:3413", 3413, (-51.0, 68.8, -48.0, 69.5)),
                        ("Reykjanes, EPSG:3413 (if >60N is polar)", 3413, (-23.0, 63.6, -21.5, 64.2)),
                        ("Antarctic Peninsula, EPSG:3031", 3031, (-64.0, -66.0, -60.0, -65.0))):
    tf = Transformer.from_crs(4326, epsg, always_xy=True)
    w, s, e, n = box
    xs, ys = tf.transform([w, e, w, e], [s, s, n, n])
    b4 = (min(xs), min(ys), max(xs), max(ys))
    bd = tf.transform_bounds(w, s, e, n, densify_pts=51)
    miss = [abs(a - b) for a, b in zip(b4, bd)]
    print(f"D3 corners-only vs densified, {name}: window short by up to {max(miss):,.0f} m on one side")

# (b) D4: an equirectangular (lat/lon-linear) PNG pinned by its four corners in MapLibre is stretched linearly in Web Mercator y
def merc(lat): return np.degrees(np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)))
def invmerc(y): return np.degrees(2 * np.arctan(np.exp(np.radians(y))) - np.pi / 2)
print()
for name, s, n in (("Tonle Sap frame (brief's extent)", 11.3330, 14.3420), ("30N frame", 28.5, 31.5), ("48N frame", 46.4, 49.4), ("Reykjanes-like 64N frame", 62.4, 65.4)):
    f = np.linspace(0, 1, 2001)                       # fractional row position from north to south
    lat_true = n - f * (n - s)                        # where that image row really is (image is linear in latitude)
    lat_drawn = invmerc(merc(n) - f * (merc(n) - merc(s)))  # where MapLibre draws it (linear in Mercator y)
    err_deg = np.abs(lat_true - lat_drawn).max()
    print(f"D4 four-corner image overlay, {name}: max north-south misplacement {err_deg*111.32:5.2f} km (= {err_deg*111320/180:4.1f} preview pixels of 180 m), at mid-frame")
```

### 7.4 `RS/scripts/cog_domain_test.py`

To reuse on real data: replace the synthetic `lin` array and transform by a real window in linear power, keep the
`encode` / `decode` pair (it is the brief's formula), and compare decoded overview values with linear-power block
means.

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/cog_domain_test.py`

```python
"""What the brief's 8-bit + cog_translate(web_optimized=True, overview_resampling='average') recipe does to values.
Synthetic scene only (simulated speckle); nothing from the team's project."""
import inspect, sys, warnings
warnings.simplefilter('ignore')
import numpy as np, rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
out = sys.argv[1]
rng = np.random.default_rng(7)
print("cog_translate signature defaults:", {k: v.default for k, v in inspect.signature(cog_translate).parameters.items()
      if k in ("resampling", "overview_resampling", "web_optimized", "zoom_level_strategy", "aligned_levels", "nodata", "add_mask")})

def encode(db, lo, hi):
    code = 1 + np.round(254 * (db - lo) / (hi - lo))
    code = np.clip(code, 1, 255)
    code = np.where(np.isfinite(db) | np.isneginf(db), code, 0)
    return code.astype("uint8")
def decode(code, lo, hi):
    return np.where(code == 0, np.nan, lo + (code.astype("float32") - 1) * (hi - lo) / 254)

for lat0, epsg, label in ((13.0, 32648, "13N (UTM 48N)"), (47.9, 32614, "47.9N (UTM 14N)"), (63.9, 32627, "63.9N (UTM 27N)")):
    n, px = 2048, 20.0
    # scene: left half "water" -22 dB, right half "land" -8 dB, a bright strip +3 dB ("double bounce"), ENL 5 speckle; top-left corner nodata
    truth = np.full((n, n), 10 ** -0.8, "float64"); truth[:, : n // 2] = 10 ** -2.2; truth[:, n // 2 + 200 : n // 2 + 260] = 10 ** 0.3
    lin = truth * rng.gamma(5, 1 / 5, (n, n))
    lin[:200, :200] = np.nan
    from pyproj import Transformer
    e0, n0 = Transformer.from_crs(4326, epsg, always_xy=True).transform({32648: 105.0, 32614: -99.0, 32627: -21.0}[epsg], lat0)
    tr = from_origin(e0 - n * px / 2, n0 + n * px / 2, px, px)
    lo, hi = -25.0, 0.0
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        code = encode(10 * np.log10(lin), lo, hi)
    src = f"{out}/src_{epsg}.tif"
    with rasterio.open(src, "w", driver="GTiff", height=n, width=n, count=1, dtype="uint8", crs=f"EPSG:{epsg}", transform=tr, nodata=0) as d:
        d.write(code, 1)
    dst = f"{out}/cog_{epsg}.tif"
    cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0, overview_resampling="average", in_memory=False, quiet=True)
    with rasterio.open(dst) as d:
        a = d.read(1); ovr = d.overviews(1)
        res = d.res[0]
        print(f"\n[{label}] native {px} m -> COG {d.crs} pixel {res:.3f} projected m = {res*np.cos(np.radians(lat0)):.2f} ground m; size {d.width}x{d.height}; overviews {ovr}")
        # area: count valid pixels x pixel area in each grid
        native_km2 = np.isfinite(lin).sum() * px * px / 1e6
        merc_km2 = (a != 0).sum() * res * res / 1e6
        print(f"   area by pixel counting: native UTM {native_km2:.1f} km2 ; EPSG:3857 raster {merc_km2:.1f} km2 ; ratio {merc_km2/native_km2:.3f} (1/cos^2(lat) = {1/np.cos(np.radians(lat0))**2:.3f})")
        # bright strip clipped?
        print(f"   share of codes saturated at 255 (>= {hi} dB): {np.mean(a[a != 0] == 255):.2%} ; at 1 (<= {lo} dB): {np.mean(a[a != 0] == 1):.2%}")
        # overview level 3 (factor 8): decoded mean vs truth
        f = ovr[-1]
        o = d.read(1, out_shape=(d.height // f, d.width // f))  # reads from the overview
        od = decode(o, lo, hi)
        h, w = od.shape
        # homogeneous land region (right quarter), homogeneous water (left quarter), and the shoreline column
        land = np.nanmean(od[h // 4 : 3 * h // 4, int(w * 0.80) : int(w * 0.95)]); water = np.nanmean(od[h // 4 : 3 * h // 4, int(w * 0.10) : int(w * 0.40)])
        print(f"   overview x{f} decoded: water {water:.2f} dB (truth -22.00), land {land:.2f} dB (truth -8.00)")
        col = od[h // 4 : 3 * h // 4, :]
        prof = np.nanmean(col, axis=0)
        ok = np.isfinite(prof); idx = np.where(ok)[0]
        inter = [(i, prof[i]) for i in idx if -21.0 < prof[i] < -9.5]
        print(f"   overview x{f} shoreline (mixed) columns decoded: {[round(float(v), 2) for _, v in inter][:4]} dB")
```

### 7.5 `RS/scripts/release_split.py`

To reuse: edit `PLACES` (name, lon, lat, stack id) and pass an output path. Needs only the standard library.

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/release_split.py`

```python
"""Per-release unique-date counts for named stacks (public CMR, no login)."""
import collections, json, sys, urllib.parse, urllib.request
COLL = {"B": "C3622214170-ASF", "P": "C2854338529-ASF", "V": "C3622241360-ASF"}
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
PLACES = [
 ("Mexico City", -99.1, 19.4, "019_A_011"), ("Kilauea", -155.28, 19.41, "072_D_079"),
 ("Central Valley", -119.56, 36.1, "034_A_020"), ("Reykjanes", -22.4, 63.88, "159_A_034"),
 ("Reykjanes alt", -22.4, 63.88, "082_D_056"),
 ("Punjab", 75.8, 30.6, "156_A_017"), ("Atchafalaya", -91.45, 30.0, "084_D_073"),
 ("Grand Forks", -97.4, 47.9, "099_D_064"), ("Chicago", -87.65, 41.85, "148_A_023"),
 ("Champaign", -88.3, 40.2, "148_A_022"), ("Jakobshavn", -49.6, 69.17, "170_D_053"),
 ("Okavango", 22.9, -19.3, "172_A_168"), ("Rondonia", -63.5, -10.0, "068_D_094"),
 ("Tonle Sap", 104.05, 12.95, "083_A_008"), ("Sudd", 30.7, 7.5, "050_D_085"),
 ("Mekong Delta", 105.6, 10.0, "047_D_083"), ("Mamiraua", -65.0, -2.7, "097_D_090"),
 ("Pantanal", -57.2, -17.3, "111_D_097"),
]
def fetch(cid, lon, lat, stack):
    q = [("collection_concept_id", cid), ("point", f"{lon},{lat}"), ("page_size", "2000"),
         ("attribute[]", f"string,STACK_ID,{stack}")]
    req = urllib.request.Request(CMR + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "nisar-coverage-check"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r).get("items", [])
out = []
for name, lon, lat, stack in PLACES:
    per = {}
    detail = collections.defaultdict(list)
    for rel, cid in COLL.items():
        items = fetch(cid, lon, lat, stack)
        dates = set()
        for it in items:
            u = it["umm"]
            a = {x["Name"]: x["Values"][0] for x in u.get("AdditionalAttributes", [])}
            d = u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            dates.add(d)
            detail[d].append((rel, a.get("FREQUENCY_A_POLARIZATION_CONCAT", "?"), a.get("RANGE_BANDWIDTH_CONCAT", "?"),
                              a.get("FULL_FRAME", "?"), u["GranuleUR"].split("_")[10], u["GranuleUR"].split("_")[13],
                              u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][11:16]))
        per[rel] = dates
    allp = per["P"]
    modes = collections.Counter((p, b) for d in sorted(allp) for (r, p, b, *_ ) in detail[d] if r == "P")
    multi = sum(1 for d in allp if sum(1 for x in detail[d] if x[0] == "P") > 1)
    onlyB = per["B"] - per["P"] - per["V"]
    row = dict(name=name, stack=stack, total=len(per["B"] | per["P"] | per["V"]), B=len(per["B"]), P=len(per["P"]), V=len(per["V"]),
               B_only=len(onlyB), P_first=min(allp) if allp else None, P_last=max(allp) if allp else None,
               P_since_jun17=len([d for d in allp if d >= "2026-06-17"]), P_modes=dict((f"{k[0]} {k[1]}", v) for k, v in modes.items()),
               P_dates_with_multiple_granules=multi, V_dates=sorted(per["V"]),
               overlap_PV=sorted(per["P"] & per["V"]), times=sorted({x[6] for d in detail for x in detail[d]})[:4])
    out.append(row)
    print(json.dumps(row))
json.dump(out, open(sys.argv[1], "w"), indent=1)
```

### 7.6 `R1/scripts/speckle.py` (run 1)

Source file: `<scratch>/review/sar-science/scripts/speckle.py`

```python
"""Speckle statistics for multilooked intensity: how big is 'noise' in dB?"""
import numpy as np
from scipy.special import polygamma, digamma
rng = np.random.default_rng(0)
N = 2_000_000
print("ENL  std(dB) one image | std(dB) difference of two dates | 95% interval of difference | bias of mean-of-dB vs dB-of-mean")
for L in (1, 2.4, 4.4, 9, 20, 40, 90, 100, 400):
    a = rng.gamma(L, 1.0 / L, N)   # unit-mean intensity with L looks
    b = rng.gamma(L, 1.0 / L, N)
    da, db = 10 * np.log10(a), 10 * np.log10(b)
    d = db - da
    theo = 10 / np.log(10) * np.sqrt(float(polygamma(1, L)))
    bias = 10 / np.log(10) * (float(digamma(L)) - np.log(L))
    lo, hi = np.percentile(d, [2.5, 97.5])
    print(f"{L:5.1f}  {da.std():5.2f} (theory {theo:5.2f}) | {d.std():5.2f} | [{lo:6.2f}, {hi:5.2f}] | {da.mean():6.2f} (theory {bias:6.2f})")

# false-alarm rate of 'beyond 1.5 standard deviations of the difference image' when NOTHING changed
L = 40
a = rng.gamma(L, 1.0 / L, N); b = rng.gamma(L, 1.0 / L, N)
d = 10 * np.log10(b / a)
s = d.std()
print("\nNo-change scene, 1.5 sigma rule: flagged two-sided = %.1f%%, one-sided = %.1f%%" %
      (100 * np.mean(np.abs(d - d.mean()) > 1.5 * s), 100 * np.mean(d - d.mean() > 1.5 * s)))

# mixed pixel example: water (-25 dB) next to flooded vegetation (-5 dB), averaged 50/50
w, f = 10 ** (-25 / 10), 10 ** (-5 / 10)
print("\n50/50 mix of -25 dB and -5 dB: mean in linear = %.2f dB ; mean of dB = %.2f dB" %
      (10 * np.log10((w + f) / 2), (-25 - 5) / 2))
# one bright point target in a field polygon
field = np.full(100, 10 ** (-15 / 10)); field[0] = 10 ** (20 / 10)
print("100-pixel field at -15 dB with ONE +20 dB pixel: linear mean = %.2f dB ; median = %.2f dB" %
      (10 * np.log10(field.mean()), 10 * np.log10(np.median(field))))
```

### 7.7 `R1/scripts/cog_test.py` (run 1)

Source file: `<scratch>/review/sar-science/scripts/cog_test.py`

```python
"""Follow sketch D5 literally on a synthetic 8-bit dB-coded raster and compare with a linear-power truth."""
import sys, warnings, numpy as np, rasterio
from rasterio.transform import from_origin
from rasterio.enums import Resampling
from rasterio.warp import reproject, calculate_default_transform
from rio_cogeo.cogeo import cog_translate, cog_validate
from rio_cogeo.profiles import cog_profiles
work = sys.argv[1]
rng = np.random.default_rng(1)
LO, HI = -25.0, 0.0
def encode(db, valid):
    code = 1 + np.round(254 * (db - LO) / (HI - LO))
    code = np.clip(code, 1, 255)
    return np.where(valid, code, 0).astype("uint8")
def decode(dn):
    return np.where(dn == 0, np.nan, LO + (dn.astype("float32") - 1) * (HI - LO) / 254)

n = 2048
truth_db = np.full((n, n), -22.0); truth_db[:, n // 2:] = -6.0         # dark surface | bright surface
truth_db[900:1100, 200:400] = -3.0                                     # a bright patch inside the dark half
lin = 10 ** (truth_db / 10) * rng.gamma(5.0, 1 / 5.0, (n, n))          # 5-look speckle
valid = np.ones((n, n), bool); valid[:300, :300] = False               # a nodata corner
lin = np.where(valid, lin, np.nan).astype("float32")
tf = from_origin(400000.0, 1500000.0, 20.0, 20.0)                      # UTM 48N, 20 m
prof = dict(driver="GTiff", height=n, width=n, count=1, crs="EPSG:32648", transform=tf)

# --- path A: the brief's D5, literally: 8-bit dB codes in UTM -> cog_translate(web_optimized)
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    db = 10 * np.log10(lin)
src8 = f"{work}/src8.tif"
with rasterio.open(src8, "w", dtype="uint8", nodata=0, **prof) as d:
    d.write(encode(db, valid), 1)
dstA = f"{work}/cogA.tif"
cog_translate(src8, dstA, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False, quiet=True)
print("validate A:", cog_validate(dstA)[0])
with rasterio.open(dstA) as d:
    print("A crs", d.crs, "res", d.res, "shape", d.shape, "overviews", d.overviews(1), "nodata", d.nodata)
    full = d.read(1)
    ovr_levels = d.overviews(1)
    resA = d.res[0]
    trA = d.transform
    shapeA = d.shape

# --- truth at each overview level: average LINEAR power on the same 3857 grid
def lin_on_grid(shape, transform, resampling):
    out = np.full(shape, np.nan, "float32")
    reproject(lin, out, src_transform=tf, src_crs="EPSG:32648", src_nodata=np.nan,
              dst_transform=transform, dst_crs="EPSG:3857", dst_nodata=np.nan, resampling=resampling)
    return out
print("\nlevel | dark-half median dB: D5 overview vs linear truth | boundary column (50/50 mix) | bright patch")
for f in [1] + ovr_levels:
    with rasterio.open(dstA, overview_level=None if f == 1 else ovr_levels.index(f)) as d:
        dn = d.read(1); t = d.transform
    a = decode(dn)
    truth = 10 * np.log10(lin_on_grid(dn.shape, t, Resampling.average if f > 1 else Resampling.nearest))
    h, w = a.shape
    # sample regions by map coordinates: dark half interior, boundary, bright half interior
    def col_of(x_utm_frac):  # fraction across the valid image
        return int(w * x_utm_frac)
    dark = (slice(int(h * .55), int(h * .9)), slice(int(w * .1), int(w * .35)))
    bright = (slice(int(h * .55), int(h * .9)), slice(int(w * .65), int(w * .9)))
    print(f"{f:5d} | dark {np.nanmedian(a[dark]):7.2f} vs {np.nanmedian(truth[dark]):7.2f} | "
          f"bright {np.nanmedian(a[bright]):7.2f} vs {np.nanmedian(truth[bright]):7.2f} | "
          f"max |diff| anywhere {np.nanmax(np.abs(a - truth)):5.1f} dB, 99th pct {np.nanpercentile(np.abs(a - truth), 99):4.1f} dB")
```

### 7.8 Helpers: `RS/scripts/nb2txt.py` and `RS/scripts/grepdoc.py`

`nb2txt.py` dumps a notebook's cells (and, with a second argument, the first 1500 characters of each text output).
`grepdoc.py` strips an HTML page to text and prints context around each regular expression given.

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/nb2txt.py`

```python
import json, sys
nb = json.load(open(sys.argv[1]))
for i, c in enumerate(nb["cells"]):
    src = "".join(c["source"])
    print(f"\n##### [{i}] {c['cell_type']}")
    print(src)
    if c["cell_type"] == "code" and len(sys.argv) > 2:
        for o in c.get("outputs", []):
            t = o.get("text") or o.get("data", {}).get("text/plain")
            if t:
                print("--- output:")
                print("".join(t)[:1500])
```

Source file: `<scratch>/review/sar-remote-sensing-scientist/scripts/grepdoc.py`

```python
import sys, re, html
p, pats = sys.argv[1], sys.argv[2:]
t = open(p, encoding="utf-8", errors="replace").read()
t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
t = html.unescape(re.sub(r"<[^>]+>", " ", t))
t = re.sub(r"\s+", " ", t)
for pat in pats:
    ms = list(re.finditer(pat, t, flags=re.I))
    print(f"--- {pat!r}: {len(ms)} hit(s)")
    for m in ms[:3]:
        print("   ...", t[max(0, m.start()-160): m.end()+260], "...")
```

### 7.9 Requests that worked (no login, no personal data sent)

```sh
# one granule's full UMM-G record (attributes, browse and sidecar URLs)
/usr/bin/curl -sS -A "nisar-coverage-check" "https://cmr.earthdata.nasa.gov/search/granules.umm_json?collection_concept_id=C2854338529-ASF&point=-22.4,63.88&page_size=3&sort_key=-start_date"
# every granule of one stack in one release (as release_split.py does): add
#   &attribute[]=string,STACK_ID,083_A_008&page_size=2000
# data guide source (266 MB) and Cookbook (122 MB)
/usr/bin/curl -sSL -A "docs-reader" -o nisar-docs.tar.gz https://codeload.github.com/ua-asf/nisar-docs/tar.gz/refs/heads/main
/usr/bin/curl -sSL -A "docs-reader" -o cookbook.tar.gz https://codeload.github.com/ASFOpenSARlab/NISAR_Cookbook/tar.gz/refs/heads/main
# single notebooks
https://raw.githubusercontent.com/ASFOpenSARlab/NISAR_Cookbook/main/notebooks/NISAR_GCOV_SARChangeDetectionMethods.ipynb
https://raw.githubusercontent.com/ASFOpenSARlab/NISAR_Cookbook/main/notebooks/NISAR_GCOV_Time_Series_Example.ipynb
https://raw.githubusercontent.com/ASFOpenSARlab/NISAR_Cookbook/main/util/load_gcov.py
# live data-guide pages, all HTTP 200 on 2026-11-14: https://nisar-docs.asf.alaska.edu/<page>/ for
#   worldview gcov gunw projections provisional-known-issues product-known-issues nisar-known-issues
#   availability-overview amplitude products-overview observation-plan harmony naming-conventions sme2 goff data-format
```

Specification PDFs, as linked from the data-guide product pages (not fetched by these runs; the text copies under
`SCR/nisar/specs/` were saved by the earlier research session and vanish if `/private/tmp` is wiped):

```text
GCOV Rev F:  https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf
GUNW Rev E:  https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-102272_RevE_NASA_SDS_Product_Specification_L2_GUNW_Nov8_2024_w-sigs.pdf
GOFF Rev C:  https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-105010_RevC_NASA_SDS_Product_Specification_L2_GOFF_Nov8_2024_w-sigs.pdf
SME2 Rev C:  https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-107677_RevC_NASA_SDS_Product_Specification_L3_SME2_Nov8_2024_w-sigs.pdf
```

---

## 8. Things that were tried and did not work

| Tried | Outcome |
|---|---|
| Finishing the review (run 1) | Cut off after 56 tool calls, before any finding was written: `You've hit your 5-hour limit · resets 1:40am (America/Chicago)` |
| Finishing the review (run 2) | Cut off after 72 tool calls, just after listing the preview images: `You've hit your 5-hour limit · resets 6:40am (America/Chicago)` |
| Third attempt (run 3) | No work done: `You've hit your Fable limit · resets 2pm (America/Chicago). Switch to another model to continue.` |
| First version of `cog_domain_test.py` | `IndexError: list index out of range` at `f = ovr[2]` (the 47.9°N COG has only two overview levels) and the shoreline column printed `nan`. Fixed with `ovr[-1]` and a value-range filter; the saved script is the fixed one. |
| `nisar_coverage.py` in a zsh loop over "lon lat" strings | `ValueError: could not convert string to float: '-99.1 19.4'`. zsh does not split unquoted variables. Fixed with `${=pt}`. |
| `grep --include=*.md` in zsh | `(eval):1: no matches found: --include=*.md`. Quote the glob. |
| `...; echo =====; ...` in zsh | `(eval):1: ===== not found`, which also cut off the commands after it. |
| Reading granule sidecars without login | Six of six returned `302` to the Earthdata login page (R21). |
| Finding the phase sign convention in the GUNW specification | A search for sign, positive, negative, toward, away and convention found only file-naming and coordinate conventions. Not stated. |
| Settling the projection of Iceland frames from the catalog | The UMM-G record has no EPSG or projection attribute; the question stayed open. |
| Looking for a rolling 12-day NISAR layer in the saved GIBS WMTS capabilities (run 1) | No layer name containing `12Day` is in `SCR/nisar/gibs/wmts_epsg3857.xml` (saved 2026-11-13); the only NISAR imagery layer there is `NISAR_L2_Geocoded_Polarimetric_Covariance`, although Worldview offers a 12-day mosaic. |
| Reading the brief at the path given in the task (run 2) | `<official-repo>/research/` no longer existed (the repository held only `.git`); the agent found the files in the sibling folder `NASA-space-apps-2026-prehackathon-temporary`. |

---

## 9. Open questions

1. What does a real GCOV file contain? Tree, processing flags (noise correction, sub-swath masking, shadow masking),
   exception mask, whether pixels under `mask` 0 hold values, the noise floor, `min_value`/`max_value`. Not opened.
2. What is the real equivalent number of looks per mode, and how correlated are neighbouring pixels?
3. Is there a radiometric step between provisional (P05023) and validated (P05036), or between beta and provisional?
4. Are land frames north of 60°N in EPSG:3413 or UTM? (Guide and figure say 3413; specification wording differs.)
5. Do the original preview PNGs carry alpha, and what stretch does production use? (The saved copies are resized.)
6. Which remote-read setting is faster on the team's network: `blockcache` or `background`? No authenticated read
   was timed. Harmony was not tried by these runs.
7. What floor and cap should the mask use? The runs showed the need, not the numbers.
8. Does `tms=` reproduce `web_optimized=True` in rio-cogeo 7, and which `zoom_level_strategy` avoids the coarsening
   seen at 47.9°N? Not tested.
9. Does the browser COG reader's pixel query read full resolution or the overview for the current zoom?
10. GUNW phase sign convention; whether the troposphere and tide tables are worth applying at a 12-day, local scale.
11. Is the SME2 layout in the 2024 specification what the released files contain?
12. Appendix B (events) and the Section 5 surface-response table were not checked by these runs at all.
13. The reviewers never ranked their findings. The order in Section 1 is mine.

---

## 10. Artifacts on disk

| Path | What | Reuse notes |
|---|---|---|
| `RS/scripts/speckle_stats.py`, `RS/out/speckle_stats.txt` | Speckle statistics, nominal looks, k-sigma false alarms | Pure numpy/scipy. Change the `L` tuples for other look counts. |
| `RS/scripts/d3_window_test.py`, `RS/out/d3_window_test.txt`, `RS/work/synth_gcov.h5` | Sketch D3 on a synthetic GCOV-shaped HDF5 | Pass a path for the synthetic file. Contains the verified `read_window_local`. |
| `RS/scripts/geom_checks.py`, `RS/out/geom_checks.txt` | Corner-versus-densified bounds; lat/lon overlay error | Edit the box and frame tuples for the team's place. |
| `RS/scripts/cog_domain_test.py`, `RS/out/cog_domain_test.txt`, `RS/work/src_*.tif`, `RS/work/cog_*.tif` | The 8-bit + `cog_translate` recipe on a simulated scene at three latitudes | Pass an output folder. |
| `RS/scripts/release_split.py`, `RS/out/release_split.json` | Per-release date counts, modes and times for named stacks | Edit `PLACES`. Standard library only; public CMR. |
| `RS/out/coverage_all.txt`, `RS/out/coverage4.txt` | Output of `research/nisar_coverage.py` for the 17 Appendix A points | Regenerate with the helper for a new point. |
| `RS/out/iceland_umm.json` | Raw UMM-G JSON of three provisional GCOV granules at Reykjanes | Shows every attribute name and related URL. |
| `RS/out/NISAR_GCOV_SARChangeDetectionMethods.txt`, `RS/out/NISAR_GCOV_Time_Series_Example.txt` | Text dumps of the two ASF notebooks, with outputs | Read these instead of the 12 MB and 2 MB notebooks. |
| `RS/dl/cookbook/` (and `RS/dl/cookbook.tar.gz`) | Full NISAR Cookbook repository, Apache-2.0 | Several notebooks and `util/subset_h5.py` unread. |
| `RS/dl/nisar-docs/` (and `RS/dl/nisar-docs.tar.gz`) | Source of the NISAR Data User Guide (markdown), fetched 2026-11-14 | Grep here before fetching web pages. |
| `RS/dl/live/*.html` | 16 live data-guide pages fetched 2026-11-14 | Use `grepdoc.py` to search them. |
| `R1/scripts/speckle.py`, `R1/scripts/cog_test.py`, `R1/work/cogA.tif`, `R1/work/src8.tif` | Run 1's versions of the speckle and COG tests | Outputs are in Section 5.2 and 5.6 only. |
| `R1/dl/cd_methods.ipynb`, `R1/dl/ts_example.ipynb`, `R1/dl/load_gcov.py`, `R1/out/cd_methods.txt`, `R1/out/ts_example.txt` | Run 1's copies of the same notebooks and dumps | Same content as the `RS` dumps. |
| `SCR/nisar/specs/gcov_spec.txt`, `gunw_spec.txt`, `sme2_spec.txt`, `goff_spec.txt`, `gslc_spec.txt` (with PDFs) | Product specifications as text (saved by the earlier research session) | GCOV is Rev F, July 2026; GUNW, GOFF and SME2 are 2024 revisions; the GSLC revision was not checked. |
| `SCR/nisar/isce3/share_nisar_defaults_gcov.yaml` | ISCE3 default GCOV run configuration | Defaults, not the production configuration. |
| `SCR/txt/sl_forest_p1_clean.txt`, `sl_lc_p1_clean.txt`, `sl_lc_p2_clean.txt`, `arset_sw_p1.txt`, `sm_floods.txt` | Text of the ARSET trainings and the flood StoryMap | Source of the brief's method numbers. |
| `RS/venv`, `R1/venv` | Scratch virtual environments with the versions in R22 | Rebuild rather than reuse. |
