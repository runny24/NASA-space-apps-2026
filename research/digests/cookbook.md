# Recovered digest: topic "cookbook"

NISAR HDF5 layout, public sample files, working read code (h5py and xarray), HTTPS streaming settings, GDAL behaviour, and the Earthdata Login boundary.

Recovered on 2026-11-14 from an interrupted verification run of 2026-11-13/14. No experiment was re-run for this digest: every "ran" item below quotes a saved log, a script in the scratch folder, or a tool result in a transcript. The single exception is one read-only header read of the two local sample files (fact S2b), marked as such.

- Brief that was being checked: `<prehackathon-repo>/research/BUILD_PROMPT.md` (Sections 4.4, 4.5, 4.6, sketch D3, Appendix C).
- Scratch folder (called `$CB` below): `<scratch>/verify/cookbook`
- Transcripts (called `$TR` below): `<transcripts>/wf_0472d927-435/` files `agent-ac94e95675fc167ec.jsonl` (attempt 1), `agent-a91301b9806b1c8fb.jsonl` (attempt 2), `agent-a68a2c2519b12f742.jsonl` (attempt 3).

`$CB` is under `/private/tmp` and can vanish on reboot. Everything a builder needs from it (scripts, decisive logs, URL lists) is reproduced verbatim in Parts B and C of this file.

Evidence classes used throughout:

- **ran**: a saved log, script output, or transcript tool result shows it being executed and what it printed.
- **docs**: read in documentation, a product specification, a package registry, or in output cells that the data provider (ASF) saved inside its own notebooks. Not executed by the verification agents.
- **belief**: asserted or inferred with no evidence found.

---

## 1. How far the interrupted runs got

Three attempts at the same task; all three ended with the message "You've hit your 5-hour limit" before writing any final report, so there is no agent-written conclusion. All findings are in tool calls, logs and scripts.

| Attempt | UTC window (2026-11-14) | Tool calls | What it did |
|---|---|---|---|
| 1 `agent-ac94e9...` | 01:38 to 01:46 | 98 | Cloned the Cookbook and `nisar-docs`, read notebooks and docs. No tests run. |
| 2 `agent-a91301...` | 02:41 to 03:08 | 121 | Built the venv, found and downloaded the public sample files, wrote every test script and ran each once. |
| 3 `agent-a68a2c...` | 07:41 to 08:01 | 116 | Re-ran every script from scratch (the logs in `$CB/notes` are from this run), added spec-version diffs, browse/KML checks, CRID lookup, conda GDAL search. Stopped while reading the SME2 specification. |

The second and third runs agree on every deterministic value they both produced (array statistics, HTTP status codes, cache request counts except one). Their timings differ by fractions of a second to a few seconds (largest gap: fsspec-default open, 28.4 s against 24.7 s). The logs under `$CB/notes` were rewritten by attempt 3, except `download_samples.log`, `sample_data_urls.txt`, `related_urls.txt` and `clone_log.txt`, which are from attempt 2.

---

## 2. Bottom line for the builder

1. **You can build and test the whole read path today without credentials.** NASA/JPL publish NISAR-format sample products with no login and with HTTP range support. Two GCOV dates on one identical grid are 172 MB each. URLs in Section 8.1.
2. **Those samples are not NISAR observations.** They are 2008 ALOS-1 PALSAR scenes (Rosamond, California) written in NISAR format with an older product specification (1.2.1; real provisional data is 1.5.0). Use them for plumbing (paths, window arithmetic, georeferencing, COG export, tests). Do not use them to tune radiometry, masks or thresholds, and never show them as NISAR data.
3. **The brief's Section 4.4 GCOV table is correct** for every path and dtype it lists (checked against the sample file and against output cells ASF saved from real provisional files). It is missing `inputDataExceptionMask`, `numberOfSubSwaths`, `xCoordinateSpacing`, `yCoordinateSpacing`.
4. **Mask trap.** In the sample files every in-image pixel has `mask == 0` and outside is 255. The brief's rule "keep mask 1 to 5" throws away the entire sample image. The 1-to-5 rule comes from the specification for real data and was never observed on a real file. On the first real file print `np.unique(mask)` before filtering.
5. **Streaming works and the cache setting matters.** On the public sample over HTTPS: fsspec defaults took 25 to 28 s and pulled 111 MB of a 172 MB file just to open it; `cache_type="blockcache", block_size=4 MiB` with h5py took 1.7 to 2.0 s and 12.6 MB. With xarray always pass `group=`; opening the whole tree costs 12 to 13 s and 109 MB.
6. **GDAL through the `rasterio` pip wheel is not a streaming option on macOS.** The wheel has GDAL 3.12.2. `NETCDF:"/vsicurl/..."` fails with a userfaultfd error; `HDF5:"/vsicurl/..."` reads pixels but returns no CRS and no geotransform. Read with h5py, write with rasterio.
7. **Login boundary, measured:** search (CMR), browse PNGs, sample data and specification PDFs are public. Every real `.h5`, the QA files, the ISO XML and `/s3credentials` redirect to Earthdata Login. Browse KML was public for the validated GCOV granule tested and protected for the provisional ones tested.
8. **Do not construct data URLs.** Validated GUNW lives under `/NISAR/L2_L_GUNW/`, not `/NISAR/NISAR_L2_GUNW_V1/`. Take URLs from CMR.
9. **Do not assume frequency A or HH.** The newest validated GCOV granule on 2026-11-11 was frequency-B-only, VV-only (`0005_NASV`).
10. **Not settled:** nothing behind the login was exercised. Authenticated streaming speed on a real multi-GB file, real mask values, and the specification version of validated (P05036) files are open (Section 7).

---

## 3. Facts

Paths are relative to `$CB` unless absolute.

### 3.1 Public sample files

| # | Claim | Kind | Evidence |
|---|---|---|---|
| S1 | NISAR-format sample products download with no login. GCOV date 1: HTTP 200, 171,966,464 bytes in 12.9 s. | ran | `notes/download_samples.log`: `200 171966464 bytes 12.892212s 13338786 B/s  NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5` |
| S2 | The sample host answers a ranged request with 303 to CloudFront, then 206 with `accept-ranges: bytes`. No Earthdata redirect. | ran | `notes/login_boundary.log` last entry: `HTTP/2 303 ... location: https://d1mv8zhcvry6x4.cloudfront.net/.../sds-n-cumulus-prod-nisar-sample-data.s3.us-west-2.amazonaws.com/GCOV/...`; attempt 2 tool 91 (on the older `ALOS1_Rosamond_20081012` sample): `HTTP/2 206 ... accept-ranges: bytes ... content-range: bytes 0-1023/254549256`; the D00404 files were range-read by `sample_sizes.sh`, fsspec and GDAL |
| S2b | The two sample GCOV dates are on one identical grid: shape (6220, 4545), x 365490.0 to 456370.0, y 3913610.0 to 3789230.0, EPSG 32611 in both files. | ran (shape: attempt logs; coordinates: one read-only header read of the two local files made while writing this digest) | `notes/test_local_gcov.log` block [3]: `dims: {'time': 2, 'frequency': 1, 'y': 6220, 'x': 4545}`; recovery read printed `x 365490.0 456370.0 4545 y 3913610.0 3789230.0 6220 epsg 32611` for both files |
| S3 | The samples are not NISAR observations: ALOS-1 PALSAR, 2008-10-12 and 2008-11-27, HH only, 28 MHz, right-looking, processed 2025-01 with ISCE3 0.24.1 to product specification 1.2.1, release id D00404. | ran | `notes/h5_GCOV_sample_tree.log`: `missionId ... = 'ALOS'`, `instrumentName ... = 'PALSAR'`, `productSpecificationVersion ... = '1.2.1'`, `softwareVersion ... = '0.24.1'`, `lookDirection ... = 'Right'`, `compositeReleaseId ... = 'D00404'`, `processingDateTime ... = '2025-01-29T06:30:54'` |
| S4 | The SME2 sample comes from ALOS-2 PALSAR-2 (2019-08-29), specification 1.0.0. | ran | `notes/h5_SME2_sample_tree.log`: `missionId ... = 'ALOS-2'`, `instrumentName ... = 'PALSAR-2'`, `productSpecificationVersion ... = '1.0.0'` |
| S5 | Sizes (bytes): GCOV 171,966,464 each (two dates); GUNW 264,241,152; GOFF 104,857,600; SME2 7,340,032; GSLC 562,036,736 each; RSLC 503,316,480 and 541,065,216; RIFG 117,440,512; ROFF 60,817,408. | ran | `notes/sample_sizes.log` (1-byte range requests) |
| S6 | The URL list was scraped from NASA's sample-data page; 74 links under `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/`. The bare directory URL returns 404 (no listing). | ran | attempt 2 tool 93: `200 297007 https://science.nasa.gov/mission/nisar/sample-data/`; tool 90: `== https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/ HTTP/2 404`; list in `notes/sample_data_urls.txt` |
| S7 | The two sample dates are not radiometrically comparable: scene mean gamma-naught is -12.23 dB and -8.57 dB; the log-ratio median is +3.95 dB and 78 percent of pixels exceed +2 dB. | ran | `notes/test_local_gcov.log`: `mean gamma0 power per date: [0.05983698 0.1391174 ] -> dB: [-12.230303  -8.566185]`; `log-ratio dB: n=16948207 p01=-2.32 p50=3.95 p99=9.74 \| frac < -2 dB: 0.0130 \| frac > +2 dB: 0.7833` |
| S8 | `rtcGammaToSigmaFactor` in the sample is tiny (mean 0.0174), not a plausible multiplicative gamma-to-sigma factor. | ran | `notes/test_local_gcov.log`: `rtcGammaToSigmaFactor stats (sample file): min 0.0013 mean 0.0174 max 0.0214` |

### 3.2 GCOV layout

| # | Claim | Kind | Evidence |
|---|---|---|---|
| G1 | Sample GCOV `/science/LSAR/GCOV/grids/frequencyA/` holds: `HHHH` float32 (6220, 4545), chunks (512, 512), gzip level 1 plus shuffle, fill NaN, units "1"; `mask` uint8, gzip 9, fill 255; `numberOfLooks` and `rtcGammaToSigmaFactor` float32 fill NaN; `xCoordinates` (4545,) and `yCoordinates` (6220,) float64 metres; `xCoordinateSpacing` 20.0; `yCoordinateSpacing` -20.0; `projection` uint32 scalar 32611; `listOfPolarizations` ['HH']; `listOfCovarianceTerms` ['HHHH']; `numberOfSubSwaths` uint8. | ran | `notes/h5_GCOV_sample_tree.log` lines 10 to 21 (reproduced in Part C) |
| G2 | The file uses the paged file-space strategy with 4 MiB pages (GCOV and GUNW samples). GOFF sample 2 MiB, SME2 sample 1 MiB. | ran | `notes/h5_GCOV_sample_tree.log`: `file_space_strategy: PAGE (1, 0, 1) \| file_space_page_size: 4194304`; attempt 2 tool 111: GOFF `file_space_page_size: 2097152`; `notes/h5_SME2_sample_tree.log`: `file_space_page_size: 1048576` |
| G3 | Coordinates are pixel centres, y descends, spacing is exactly regular. GDAL-style origin is `x[0] - dx/2`, `y[0] - dy/2`. Round trip verified. | ran | `notes/test_local_gcov.log`: `np.diff(x) unique: [20.] np.diff(y) unique: [-20.]`; `pixel-centre of (row0,col0) from transform: (365490.0, 3913610.0) vs xCoordinates[0], yCoordinates[0]: (365490.0, 3913610.0)` |
| G4 | `projection` holds the EPSG code as its value and also as attribute `epsg_code`. | ran | `notes/test_local_gcov.log`: `projection value 32611 uint32 \| attrs['epsg_code'] 32611` |
| G5 | Sample mask values are only 0 and 255. Covariance is NaN on 100 percent of `mask == 255` pixels and on 0.086 percent of the rest. No zeros in HHHH. | ran | `notes/test_local_gcov.log`: `mask dtype uint8 unique values: (array([  0, 255], dtype=uint8), array([17004130, 11265770]))`; `NaN where mask==255: 1.0 \| NaN where mask!=255: 0.0008647310976803871`; `HHHH==0 count: 0` |
| G6 | Specification for real data (Rev F, version 1.5.0, 2026-07-08): mask 0 = invalid or partially focused, 1 to 5 = valid (sub-swath number), 255 = outside the image. | docs | `notes/specs_txt/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.txt` section 4.3.3; `notes/spec_tables/GCOV_1.5.0_grids.txt` |
| G7 | A real provisional GCOV (P05023, 20+5 MHz dual-pol) lists 14 members in `frequencyA`: `HHHH, HVHV, inputDataExceptionMask, listOfCovarianceTerms, listOfPolarizations, mask, numberOfLooks, numberOfSubSwaths, projection, rtcGammaToSigmaFactor, xCoordinateSpacing, xCoordinates, yCoordinateSpacing, yCoordinates`. Shape (16704, 17064), dtype `<f4`, fill NaN, `valid_min` 0.0, spacing 20.0 and -20.0, projection `np.uint32(32637)`. | docs | Output cells saved by ASF in `notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt` (granule `NISAR_L2_PR_GCOV_006_172_A_008_2005_DHDH_A_20251204T024618_20251204T024653_P05023_N_F_J_001`) |
| G8 | Real grid dimensions vary by frame: 16704 x 17064 and 17568 x 17820 at 20 m; 34632 x 35208 and 35928 x 36288 at 10 m; frequency B 4392 x 4455 at 80 m (exactly one quarter of its frequency A). Frequency B has its own coordinate arrays, mask and projection. | docs | Saved outputs in `notes/cookbook_nb_txt/search_NISAR_GCOV_earthaccess.ipynb.txt`, `search_stream_NISAR_asf_search.ipynb.txt`; `repos/nisar-docs/accessing-nisar/gdal.md` (`SUBDATASET_1_DESC=[35928x36288]`) |
| G9 | `inputDataExceptionMask` first appears in specification 1.5.0 as uint8 ("Bitwise OR of input data exception codes ... 0: no anomaly, 2: NISAR LSAR qFSP-H1 sample slip") and becomes uint16 with fill 65535 in 1.6.0. Beta files (X05010) do not have it; provisional files do (uint8). | ran (spec diff) and docs | `notes/spec_diff_GCOV_grids.log`: `== 1.4.0 -> 1.5.0: 50 datasets \| +2 -0 ~0  + .../frequencyA/inputDataExceptionMask ('uint8', ...)` and `== 1.5.0 -> 1.6.0 ... ('uint8', ..., '') -> ('uint16', ..., '65535')`; ASF outputs cited in G7 and G8 |
| G10 | Provisional data (CRID P05023) is written by ISCE3 v0.25.16 to product specification 1.5.0. ISCE3 tags v0.25.20 to v0.25.23 write 1.6.0. Which one validated data (P05036, PGE R05.03.2) uses was not determined: the CRID page had no P05036 entry. | docs (CRID CSV) and ran (tag scan) | `downloads/web_recheck/NISAR_LSAR_CRID_P05023.csv`: `ISCE3 (l1_l2),ISCE3 SW,v0.25.16`, `PSpec_L2_L_GCOV,Product Specification Version,1.5.0`; `notes/isce3_tag_specver.log`; attempt 3 tool 101: only `P05023` matched on the CRID page |
| G11 | Units and scale: gamma-naught, linear power, dB = 10*log10(term). | ran (sample metadata) and docs | `notes/h5_GCOV_sample_tree.log`: `outputBackscatterNormalizationConvention ... = 'gamma0'`, `outputBackscatterExpressionConvention ... = 'Linear power'`, `outputBackscatterDecibelConversionFormula ... = '10*log10(<GCOV_TERM>)'` |
| G12 | Pixel spacing by bandwidth: 5 MHz 80 m; 20 MHz 20 m; 40 MHz 10 m; 77 MHz 20 m. Chunks nominally 512 x 512, compressed, paged. | docs | GCOV spec Rev F sections 2.2 and 3.8 (`notes/specs_txt/...GCOV_w-esigs.txt` lines 691 to 695 and 1275 to 1314); `repos/nisar-docs/data-products/level-2/gcov.md` |
| G13 | Granules exist with no frequency A and no HH: the newest validated GCOV on 2026-11-11 is `..._0005_NASV_M_...` with `FREQUENCIES = ['B']`, `FREQUENCY_B_POLARIZATION = ['VV']`. Polarization codes include SH, SV, DH, DV, CL, CR, QP, NA. | ran (CMR) and docs | attempt 3 tool 71 (UMM-G of `NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001`); `repos/nisar-docs/data-products/level-2/gcov.md` naming glossary |
| G14 | Real provisional data contains tiny positive values at scene edges (about 1e-14 power, -134 dB) that pass a `> 0` test. | docs | ASF output in `notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt` cell 31: `-1.3375240e+02, -1.3611551e+02` |
| G15 | ASF's own time-series notebook drops two provisional dates of stack 026_A_016 (2026-07-09 and 2026-07-21) for "obvious processing issues". | docs | `notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt` cell 5 |

### 3.3 Reading code

| # | Claim | Kind | Evidence |
|---|---|---|---|
| R1 | h5py read plus `rasterio.transform.from_origin(x[0]-dx/2, y[0]-dy/2, dx, abs(dy))` writes a correctly georeferenced GeoTIFF (EPSG:32611, 20 m). | ran | `notes/test_local_gcov.log` block [1]: `GeoTIFF CRS: EPSG:32611 res: (20.0, 20.0) bounds: BoundingBox(left=365480.0, bottom=3789220.0, right=456380.0, top=3913620.0)`; output `out/GCOV_frequencyA_HHHH.tif` (113,117,292 bytes) |
| R2 | `xr.open_datatree(file, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group=<frequencyA path>)` works; after `rio.write_crs(epsg)` rioxarray derives the right transform; `rio.clip_box(minx, miny, maxx, maxy, crs="EPSG:4326")` returns a window (0.1 by 0.1 degree gave 560 x 464 pixels). | ran | `notes/test_local_gcov.log` block [2]: `rio.transform(): (20.0, 0.0, 365480.0, 0.0, -20.0, 3913620.0)`; `clip_box lon/lat {...} -> (560, 464) mean power: 0.030626961961388588` |
| R3 | xarray's default CF decoding turns the uint8 `mask` into float32 (255 becomes NaN). `mask_and_scale=False` keeps uint8. | ran | `notes/test_local_gcov.log`: `mask via xarray dtype: float32 (file dtype uint8; CF _FillValue decoding promotes it)`; `mask with mask_and_scale=False dtype: uint8` |
| R4 | The Cookbook helper `util/load_gcov.py::load_gcov_ts_xr` runs on two local sample files and returns a (time, frequency, y, x) dataset with CRS set. | ran | `notes/test_local_gcov.log` block [3]: `dims: {'time': 2, 'frequency': 1, 'y': 6220, 'x': 4545} \| vars: ['HHHH', 'mask', 'numberOfLooks', 'rtcGammaToSigmaFactor', 'identification'] \| crs: EPSG:32611` |
| R5 | `load_gcov_ts_xr` only accepts local paths (it wraps inputs in `pathlib.Path`) and takes coordinates, projection and array shape from the first file's first frequency for everything. It was run only with `freqs=["A"]`. | belief (read from the code, limits not exercised) | `repos/NISAR_Cookbook/util/load_gcov.py` (verbatim in Part B) |
| R6 | The brief's sketch D3 itself was never executed by anyone. Its building blocks were: h5py over an fsspec HTTP file, the `projection` scalar as EPSG, pixel-centre coordinates, and the half-pixel geotransform all behave as D3 assumes. | ran (parts) | `scripts/test_stream_https.py` cases F and G; G3, G4 above |

### 3.4 HTTPS streaming (public sample GCOV, 172 MB, no auth, macOS arm64, on a connection that downloaded the sample files at 12 to 13.5 MB/s)

"read" is one chunk-aligned 512 x 512 chunk (`[2048:2560, 2048:2560]`), so these numbers are open latency plus first chunk, not window throughput. Both runs shown (attempt 2 at 03:07 UTC, attempt 3 at 07:54 UTC).

| Case | Setting | Open s | Read s | Requests | Bytes requested | Kind |
|---|---|---|---|---|---|---|
| G | h5py direct, `cache_type="blockcache"`, `block_size=4 MiB` (equals the file page size) | 2.0 / 1.7 | 2.6 / 2.1 | 3 | 12,582,912 | ran |
| F | h5py direct, `background`, 8 MiB | 2.0 / 2.0 | 3.6 / 3.5 | 5 | 41,943,040 | ran |
| H | h5py direct with `page_buf_size=16 MiB`, `background`, 8 MiB | 2.0 / 2.0 | 4.4 / 4.2 | 6 | 50,331,648 | ran |
| B | xarray + h5netcdf, `group=` frequencyA, `background` 8 MiB passed to `open()` | 3.7 / 4.0 | 1.5 / 1.5 | 4 / 5 | 33,554,432 / 41,943,040 | ran |
| A | same, kwargs on the filesystem (the Cookbook form) | 4.5 / 4.3 | 1.5 / 1.4 | 5 | 41,943,040 | ran |
| C | xarray, `group=`, `background` 16 MiB (the Data User Guide form) | 6.0 / 5.4 | 0.0 / 0.0 | 4 | 67,108,864 | ran |
| E | xarray whole tree (no `group=`), `background` 8 MiB | 13.2 / 12.1 | 1.9 / 1.3 | 13 | 109,051,904 | ran |
| D | xarray, `group=`, fsspec defaults (`BytesCache`, 5 MiB) | 28.4 / 24.7 | 1.3 / 1.2 | 21 | 110,739,744 | ran |

Evidence: `notes/test_stream_https.log` (attempt 3) and attempt 2 tool 120. All eight cases returned the same value (`mean=0.02942`), which also equals the GDAL read below.

| # | Claim | Kind | Evidence |
|---|---|---|---|
| T1 | fsspec's default cache pulled 64 percent of the file (111 of 172 MB) just to open one group. | ran | `D fsspec defaults ...: open  24.7s ... cache=BytesCache blocksize=5242880 hits=55 misses=21 requested_bytes=110739744` |
| T2 | Cheapest tested: h5py with `blockcache` and a 4 MiB block: `open   1.7s \| read 512x512   2.1s ... cache=BlockCache blocksize=4194304 hits=36 misses=3 requested_bytes=12582912`. | ran | `notes/test_stream_https.log` line G |
| T3 | `h5py.File(f, "r", page_buf_size=16 MiB)` over an fsspec file object did not help (slower, more requests). | ran | `notes/test_stream_https.log` line H |
| T4 | The brief's exact setting (`blockcache` with 8 MiB through `earthaccess.get_fsspec_https_session()`) was not run. Tested neighbours: `blockcache` 4 MiB and `background` 8 MiB. | ran (absence) | `scripts/test_stream_https.py` case list |
| T5 | The third-party benchmark quoted in the brief (2 s against 52 s and 4.3 GB) was not fetched or reproduced. | ran (absence) | no fetch of `gist.github.com/hrodmn/...` in any transcript |
| T6 | ASF's saved timings on real provisional files with a Bearer token and `background` 8 MiB: 4.56 s to open `frequencyA` of one 34632 x 35208 file; 9.11 s for six files; 17.1 s for three files in another notebook; 1 min 59 s to pull a 5784 x 3909 pixel window of HHHH for three dates and write it to Zarr. | docs | `notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt` cells 11 and 21; `NISAR_GCOV_Time_Series_Example.ipynb.txt` cells 12 and 25 |
| T7 | Official auth idioms for streaming: (a) Cookbook: `fsspec.filesystem("http", headers={"Authorization": f"Bearer {token}"}, cache_type="background", block_size=8*1024*1024)`; (b) Data User Guide: `earthaccess.get_fsspec_https_session()` then `fs.open(url, cache_type='background', block_size=16*1024*1024)`. Neither was run by the verification agents. | docs | Cookbook notebooks above; `repos/nisar-docs/accessing-nisar/earthaccess.md` |

### 3.5 GDAL

| # | Claim | Kind | Evidence |
|---|---|---|---|
| D1 | `pip install rasterio` (1.5.2, macOS arm64) bundles GDAL 3.12.2 with HDF5, HDF5Image and netCDF drivers and no NISAR driver. The machine has no system GDAL. | ran | `notes/venv_versions.log`: `rasterio GDAL 3.12.2`, `driver NISAR -> None`; attempt 2 tool 52: `gdalinfo not found` |
| D2 | Local file, `NETCDF:"file.h5":/science/.../HHHH`: georeferenced (EPSG 32611, origin (365480, 3913620), res (20, -20), nodata NaN). Also correct for mask (nodata 255), GUNW unwrappedPhase (80 m), GUNW wrappedInterferogram (complex64, 20 m), SME2 soilMoisture (EPSG 6933, 200.179 m, nodata -9999). | ran | `notes/test_gdal_open.log` |
| D3 | Local file, `HDF5:"file.h5"://science/.../HHHH` on GDAL 3.12.2: pixels readable, but `crs=None origin=(0.0, 0.0) res=(1.0, 1.0)`. | ran | `notes/test_gdal_open.log` |
| D4 | Over HTTPS on macOS the netCDF driver fails: `NETCDF+vsicurl: FAILED after 2.1s: RasterioIOError: Opening a /vsi file with the netCDF driver requires Linux userfaultfd to be available. Or you may set the GDAL_SKIP=netCDF configuration option to force the use of the HDF5 driver.` | ran | `notes/test_gdal_vsicurl.log` |
| D5 | Over HTTPS the HDF5 driver works as a raw pixel reader: `HDF5+vsicurl: OK driver=HDF5Image crs=None origin=(0.0,0.0) open 2.1s read512x512 0.7s mean=0.02942`. | ran | `notes/test_gdal_vsicurl.log` |
| D6 | GDAL georeferences NISAR through the HDF5 driver only from 3.13.0; before that use `NETCDF:` (or rename `.h5` to `.nc` for QGIS). Auth for GDAL is `~/.netrc` plus `GDAL_HTTP_NETRC=YES` and cookie file and jar. | docs | `repos/nisar-docs/accessing-nisar/gdal.md`, `repos/nisar-docs/data-products/data-format.md` |
| D7 | conda-forge offers `libgdal-core` 3.13.0 to 3.13.3 for osx-arm64. JPL's NISAR GDAL plugin is `gdal-driver-nisar` on channel `nisar-forge`: osx-arm64 up to 0.7.0, linux-64 up to 0.7.2, nothing for osx-64 or win-64; the builds shown pin `gdal >=3.12.4,<3.13.0a0`. Neither was installed or run. | ran (`conda search` only) | attempt 3 tools 107 and 108 |
| D8 | The Cookbook's own pinned environment uses GDAL 3.11.5 and rasterio 1.4.4, and its notebooks read with h5py and xarray, never through a GDAL NISAR path. It contains no Harmony, kerchunk or VirtualiZarr code. | ran (grep and lockfile parse) | attempt 3 tools 34 to 37; `repos/NISAR_Cookbook/pixi.lock` |

### 3.6 Earthdata Login boundary

| # | Claim | Kind | Evidence |
|---|---|---|---|
| L1 | Real product `.h5` (validated GCOV, provisional GUNW): `HTTP/2 302` to `https://urs.earthdata.nasa.gov/oauth/authorize?...`. | ran | `notes/login_boundary.log` entries 1 and 2 |
| L2 | Also behind login (302 to URS): `_QA_STATS.h5`, `.h5.iso.xml`, `.rc.yaml`, `_QA_SUMMARY.csv`, `_QA_REPORT.pdf`, and `https://nisar.asf.earthdatacloud.nasa.gov/s3credentials`. | ran | `notes/browse_public_check.log`, `notes/login_boundary.log` |
| L3 | Public (303 to CloudFront, then 200, content type `binary/octet-stream`): `/BROWSE/<collection>/<granule>/<granule>_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`, and per-channel `_NATIVE_A_HHHH.png`. | ran | `notes/browse_fetch.log`; attempt 2 tool 116: `200 213424 binary/octet-stream  _NATIVE_A_HHHH.png` |
| L4 | Browse names need the suffix: `<granule>.png` and `<granule>_thumbnail.png` return 404. | ran | `notes/login_boundary.log` entries 4 to 6; `notes/browse_fetch.log` |
| L5 | Validated GCOV: `_LATLON.kml` and `_NATIVE.kml` are public under `/BROWSE/` (200, 571 and 569 bytes) and contain a `LatLonQuad` with the four corner coordinates of the PNG. | ran | `notes/browse_fetch.log`; file `downloads/browse_recheck/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.kml` (reproduced in Part C) |
| L6 | Provisional GCOV: CMR lists the KML under the protected `/NISAR/<collection>/` path. Fetching it gives `401 27 text/html` with body `HTTP Basic: Access denied.`; the `/BROWSE/` path gives 404. | ran | attempt 2 tool 116; `notes/browse_fetch.log`: `404 244697B text/html  ..._P05023_N_F_J_001_LATLON.kml`; `notes/related_urls.txt` |
| L7 | Browse PNG type depends on polarization: dual-pol granules give 8-bit RGB (1965 x 1927 and 1944 x 1921 seen), a single-pol granule gives 8-bit grayscale (1425 x 1405). Thumbnails are 100 x 100. | ran | attempt 2 tool 116 and attempt 3 tool 74 (`file` output) |
| L8 | CMR search needs no login (collections and granule UMM-JSON queries ran with a generic User-Agent). | ran | `scripts/cmr_collections.sh`, `scripts/cmr_granule_counts.py`, logs in `notes/cmr_*.log` |
| L9 | The account must also accept the "Alaska Satellite Facility Data Access" EULA. | docs | `repos/NISAR_Cookbook/notebooks/set_up_Earthdata_Login.md` line 5 |
| L10 | Public without login: product specification PDFs (GCOV Rev F, GSLC Rev F at `cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/`; GUNW, GOFF, SME2, GCOV Rev E under `/NISAR-SAMPLE-DATA/DOCS/`). | ran | attempt 3 tool 59: six `200 ... application/pdf` lines; `scripts/fetch_specs.sh` |

### 3.7 Catalog facts measured in this folder

| # | Claim | Kind | Evidence |
|---|---|---|---|
| C1 | CMR has 31 NISAR collections. The concept ids in the brief's Section 4.2 table are all correct. There is no validated SME2 collection. SME2 short names start `NISAR_L3_`. | ran | `notes/cmr_collections.log` |
| C2 | Data URL prefixes follow `/NISAR/<short_name>/` for every sampled collection except validated GUNW, which uses `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/L2_L_GUNW/` (and `/BROWSE/L2_L_GUNW/`). | ran | `notes/cmr_url_prefixes.log`: `== NISAR_L2_GUNW_V1  420  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/L2_L_GUNW/` |
| C3 | Granule counts on 2026-11-14: GCOV validated 14,698 (2026-10-21 to 2026-11-11), provisional 163,672 (2025-10-29 to 2026-10-21), beta 23,527 (2025-10-12 to 2026-01-20). GUNW validated 140, provisional 94,150. GOFF validated 32. SME2 provisional 103,943. | ran | `notes/cmr_granule_counts.log` |
| C4 | CRIDs: validated P05036 (PGE R05.03.2), provisional P05023 (R05.02.3), beta X05009, X05010 and one X05007. | ran | `notes/cmr_url_prefixes.log` |

### 3.8 GUNW, GOFF, SME2 (sample files, older specification)

| # | Claim | Kind | Evidence |
|---|---|---|---|
| U1 | The GUNW paths in the brief exist as written: `.../unwrappedInterferogram/HH/{unwrappedPhase, coherenceMagnitude, connectedComponents, ionospherePhaseScreen, ionospherePhaseScreenUncertainty}` at 80 m (1555 x 1136); `.../wrappedInterferogram/HH/{wrappedInterferogram (complex64), coherenceMagnitude}` at 20 m (6220 x 4545); `.../pixelOffsets/HH/{alongTrackOffset, slantRangeOffset, correlationSurfacePeak}` in metres at 80 m. `connectedComponents` is uint16 with fill 65535. | ran | `notes/h5_GUNW_sample_tree.log` lines 13 to 61 |
| U2 | GUNW has no frequency-level coordinate arrays. Each of `unwrappedInterferogram`, `wrappedInterferogram`, `pixelOffsets` (and each polarization group inside) carries its own `xCoordinates`, `yCoordinates`, spacing and `projection`. Each also has its own `mask`. Wavelength comes from `/science/LSAR/GUNW/grids/frequencyA/centerFrequency`. | ran | same log |
| U3 | Tropospheric and solid-earth-tide screens are 3-D cubes in `/science/LSAR/GUNW/metadata/radarGrid/`, named `hydrostaticTroposphericPhaseScreen`, `wetTroposphericPhaseScreen`, `slantRangeSolidEarthTidesPhase`. The ISCE+ tutorial text uses other names (`troposphereHydrostatic`, `troposphereWet`, `solidEarthTide`) that do not exist in the file or the 1.6.0 specification. | ran (file) and docs (tutorial) | `notes/h5_GUNW_sample_tree.log` lines 207, 218, 219; `notes/isceplus_nb_txt/3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb.txt` cell 26 |
| U4 | GUNW masks change with specification version: uint8 in the sample (1.2.1); uint32 bit-packed from 1.5.0 (bits 0 to 7 decimal digits: hundreds = water flag, tens = reference sub-swath, units = secondary sub-swath; bits 8 to 15 and 16 to 23 anomaly flags; bit 24 ionosphere mask); 1.6.0 adds per-polarization `validDataMask` (uint8). | ran (spec diff) and docs | `notes/spec_diff_GUNW_grids.log`; `notes/spec_tables/GUNW_1.6.0_grids.txt` |
| U5 | Official GUNW sign convention: phase = secondary minus reference; positive phase = range increase (away from sensor); line-of-sight displacement toward the sensor = -(wavelength / 4 pi) x phase. The tutorial corrects ionosphere with `phase - iono`. Not checked against a known signal. | docs | `NISAR_GUNW_Tutorial.ipynb.txt` cells 15, 35, 55 (2026 ISCE+ course, BSD-3-Clause) |
| U6 | GOFF layout: `/science/LSAR/GOFF/grids/frequencyA/pixelOffsets/HH/layer1/{alongTrackOffset, slantRangeOffset, alongTrackOffsetVariance, slantRangeOffsetVariance, crossOffsetVariance, correlationSurfacePeak, snr}` (layers 1 to 3), float32, metres, 80 m, chunks (512, 512). The 1.6.0 specification calls these raw, unculled, unfiltered offsets. | ran | attempt 2 tools 111 and 112 |
| U7 | SME2: `/science/LSAR/SME2/grids/soilMoisture` float32 (405, 450), fill -9999, units `meter^3/meter^3`; `retrievalQualityFlag` int16 (0 = clear), `soilMoistureUncertainty`; projection EPSG 6933 (EASE-Grid 2.0), spacing 200.179 m; three algorithm candidates under `algorithmCandidates/{DSG,PMI,TSR}`. | ran | `notes/h5_SME2_sample_tree.log`; `notes/test_gdal_open.log` SME2 line |

### 3.9 Environment and licences

| # | Claim | Kind | Evidence |
|---|---|---|---|
| E1 | Everything that ran used a plain venv with pip wheels on Python 3.12.2, macOS arm64: h5py 3.16.0 (HDF5 2.0.0), numpy 2.5.4, xarray 2026.9.0, h5netcdf 1.8.3, fsspec 2026.9.0, aiohttp 3.14.5, rasterio 1.5.2 (GDAL 3.12.2), rioxarray 0.23.0, pyproj 3.8.0, dask 2026.8.0, shapely 2.2.0, asf_search 14.1.0, earthaccess 0.19.0, s3fs 2026.9.0. | ran | `notes/venv_versions.log` |
| E2 | Cookbook pinned environment (pixi.lock, env `isce3`): python 3.13.0, isce3 0.24.6, gdal 3.11.5, hdf5 1.14.6, h5py 3.16.0, h5netcdf 1.8.1, xarray 2026.7.0, rioxarray 0.22.0, rasterio 1.4.4, asf_search 13.1.0, earthaccess 0.16.0, zarr 3.3.0, dask 2025.12.0, fsspec 2026.7.0. Its notebooks were written against asf_search 13.x and earthaccess 0.16, not the 14.1.0 and 0.19.0 in the brief. | ran (lockfile parse) | attempt 3 tool 34; `repos/NISAR_Cookbook/pixi.toml` |
| E3 | Cookbook `LICENSE` file is Apache-2.0, but its `myst.yml` declares `license: BSD-3-Clause`. Other licences: isceplus/2026-isceplus BSD-3-Clause; isce3 Apache-2.0; nisarqa ships both `LICENSE-Apache-2.0.txt` and `LICENSE-BSD-3-Clause.txt`; nisar-hdf5-gdalplugin Apache-2.0; nisar-docs CC0-1.0; MintPy GPL version 3 or later. | ran (file reads) | `repos/NISAR_Cookbook/LICENSE`, `repos/NISAR_Cookbook/myst.yml` line 8, `repos/*/LICENSE*` |
| E4 | Cookbook HEAD `17b69c87a7320610740be7f2c7e605601cb7fe43` (2026-11-03). It has no GUNW notebook; the README lists GUNW notebooks as upcoming. The files named in the brief's Appendix C exist (`notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, `notebooks/NISAR_GCOV_SARChangeDetectionMethods.ipynb`, `util/load_gcov.py`). | ran | attempt 3 tools 5, 7, 12 |

---

## 4. Corrections to the brief

Severity: **blocks-build** = following the brief as written fails; **wrong-result** = runs but gives wrong data or a wrong claim; **minor** = sharpening.

| # | Brief section | Brief says | Actually | Evidence | Severity |
|---|---|---|---|---|---|
| K1 | 4.5, access path 3 (GDAL) | "`pip install rasterio` bundles GDAL 3.12, which needs the older `NETCDF:` form" for `/vsicurl/` reads | On macOS the `NETCDF:` form cannot open `/vsicurl/` at all (userfaultfd error). The `HDF5:` form over `/vsicurl/` reads pixels but gives `crs=None`, origin (0, 0). So the rasterio wheel is not a usable georeferenced streaming path on the team's Macs. `NETCDF:` works only on downloaded files. | `notes/test_gdal_vsicurl.log`, `notes/test_gdal_open.log` | blocks-build (for that access path on macOS) |
| K2 | 4.4 table and 6.2 step 3 | mask: "0 invalid; 1 to 5 valid"; "keep `mask` 1 to 5" | Matches the specification for real data (1.5.0), but on the public sample files valid pixels are 0 and only 0 and 255 occur, so this filter returns an all-invalid image. Real-file values were never observed. | `notes/test_local_gcov.log` block [1]; spec section 4.3.3 | wrong-result (on sample data; unverified on real data) |
| K3 | 4.5 "URLs" | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/<collection>/<granule>/<granule>.h5` | True for 13 of 14 sampled collections. Validated GUNW uses `/NISAR/L2_L_GUNW/<granule>/<granule>.h5` and `/BROWSE/L2_L_GUNW/...`. Read the URL from CMR `RelatedUrls` or links. | `notes/cmr_url_prefixes.log`, `notes/related_urls.txt` | wrong-result |
| K4 | 4.4 heading | "unverified against a real file" | Verified against public sample files (specification 1.2.1) and ASF's saved outputs from real provisional files. Every GCOV path and dtype in the table is right: float32 NaN-filled diagonal terms, uint8 mask with fill 255, float32 `numberOfLooks` and `rtcGammaToSigmaFactor`, float64 pixel-centre coordinates with y descending, uint32 scalar `projection` equal to the EPSG code with attribute `epsg_code`, 512 x 512 gzip chunks, 4 MiB pages. | Sections 3.2 and 3.3 | minor (confirmation) |
| K5 | 4.4 table | lists 8 kinds of dataset | Real provisional files also have `inputDataExceptionMask` (uint8 in 1.5.0, uint16 with fill 65535 in 1.6.0), `numberOfSubSwaths`, `xCoordinateSpacing`, `yCoordinateSpacing`. Compact-pol terms `RHRH`, `RVRV`, `RHRV` are in the specification. | G7, G9 | minor |
| K6 | D3 | `read_window(url, bbox, freq="A", terms=("HHHH", "HVHV"))` and `g = h5[".../frequency{freq}"]` | Some granules have no frequency A or no H-transmit terms (for example `0005_NASV`), so D3 raises KeyError on them. Read `/science/LSAR/identification/listOfFrequencies` and `listOfCovarianceTerms` first. D3 as a whole is still unrun. | G13 | minor |
| K7 | 4.5 path 1 and D3 | `earthaccess.get_fsspec_https_session()` then `fs.open(url, cache_type="blockcache", block_size=8*1024*1024)`; "2 seconds ... against 52 seconds and 4.3 GB" | Direction confirmed on a 172 MB public sample: defaults 25 to 28 s and 111 MB to open; `blockcache` 4 MiB with h5py 1.7 to 2.0 s and 12.6 MB. ASF's official examples use `cache_type="background"` with 8 MiB (Cookbook, Bearer-token header) or 16 MiB (Data User Guide, earthaccess session). The brief's exact setting and its 52 s and 4.3 GB figures were not reproduced. | Section 3.4 | minor |
| K8 | 4.6 | "The matching `.kml` needs login" | True for provisional granules only. For validated GCOV the KML is public under `/BROWSE/` and gives exact corner coordinates, so the D4 fitting workaround is unnecessary for validated dates. | L5, L6 | minor |
| K9 | 4.6 | previews are "RGB on black"; lists `_LATLON.png` and `_LATLON_thumbnail.png` | Single-pol granules have grayscale previews. More public variants exist: `_NATIVE.png` and per-channel grayscale `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`, `_NATIVE_B_HHHH.png`, `_NATIVE_B_HVHV.png` (only `_NATIVE_A_HHHH.png` was fetched). | L3, L7, `notes/related_urls.txt` | minor |
| K10 | 4.4 | "Projections are UTM between 60 S and 60 N, EPSG:3413 north of that, EPSG:3031 south of it" | Correct for Level 2. SME2 (Level 3) is on EASE-Grid 2.0, EPSG 6933, about 200.18 m. | U7; `repos/nisar-docs/data-products/projections.md` | minor |
| K11 | 4.4 GUNW paragraph | lists layer paths only | Paths are right. Missing: coordinates live inside each layer group (80 m and 20 m grids differ); the mask is a bit-packed uint32 from specification 1.5.0, not a 0/1 validity flag; 1.6.0 adds `validDataMask`. | U1, U2, U4 | minor |
| K12 | 4.2 | "short names are `NISAR_L2_GCOV_V1` ... and likewise for the others" | SME2 short names are `NISAR_L3_SME2_PROVISIONAL_V1` and `NISAR_L3_SME2_BETA_V1`. Concept ids in the table are right. | C1 | minor |
| K13 | 4.2 | "A frame is ... 16704 x 17064 pixels at 20 m, 35928 x 36288 at 10 m" | Those are two real examples, not constants: 17568 x 17820 (20 m) and 34632 x 35208 (10 m) also occur. | G8 | minor |
| K14 | Appendix C | Cookbook "Apache-2.0"; `util/load_gcov.py` listed as a reusable helper | `LICENSE` is Apache-2.0 but `myst.yml` says BSD-3-Clause. `load_gcov.py` reads local files only and assumes one grid for all dates and frequencies. The Cookbook has no GUNW notebook; the official GUNW walkthrough is in `isceplus/2026-isceplus` (BSD-3-Clause). | E3, E4, R5 | minor |
| K15 | 6.2 step 3 | "finite, greater than zero" | Not sufficient on real data: ASF's output shows about 1e-14 (-134 dB) values at scene edges. Add the mask and a floor. | G14 | minor |
| K16 | 4.1 | BETA covers "2025-10-17 to 2026-01-20" | Oldest beta GCOV granule in CMR starts 2025-10-12T18:25:08Z. | `notes/cmr_granule_counts.log` | minor |
| K17 | 4.3 | polarization codes `SH`, `DH`, `QP`, `NA`; `PR` and `UR` | Also `SV` (VV), `DV` (VV/VH), `CL`, `CR`; processing type also `OD` (science on-demand). | `repos/nisar-docs/data-products/level-2/gcov.md` | minor |

---

## 5. Recommendations

| # | Decision | Choice | Why |
|---|---|---|---|
| P1 | Primary access path for windows | h5py over an fsspec HTTP file, as in D3 (xarray + h5netcdf over the same file object is the equally working alternative) | Both ran end to end on this Mac with pip wheels and returned identical values; h5py made the fewest requests. Neither needs GDAL. |
| P2 | fsspec cache for h5py | `fs.open(url, "rb", cache_type="blockcache", block_size=4*1024*1024)`; print `file_space_page_size` on the first real file and match it | Fewest bytes and fastest open in both runs (12.6 MB, about 2 s). Never use the defaults (111 MB, 25 to 28 s). |
| P3 | fsspec cache for xarray | `cache_type="background", block_size=8*1024*1024`, and always `group="/science/LSAR/GCOV/grids/frequencyA"` (or B) | This is ASF's own setting; measured 4 s open. Without `group=` the open costs 12 to 13 s and 109 MB. |
| P4 | Authentication for streaming | Try both in the first hour: `earthaccess.login()` plus `earthaccess.get_fsspec_https_session()`; and `fsspec.filesystem("http", headers={"Authorization": f"Bearer {token}"})` with an EDL token | Both are official; neither was exercised here. The token form needs no netrc and no redirect cookie handling. |
| P5 | GDAL | Do not use it to read NISAR on the Macs. Write outputs with rasterio only. If someone wants GDAL, use a separate conda env with GDAL 3.13 or later, or JPL's `gdal-driver-nisar` | K1. Both alternatives are untested here. |
| P6 | Georeferencing idiom | `transform = rasterio.transform.from_origin(x[c0] - dx/2, y[r0] - dy/2, dx, abs(dy))`, `crs = f"EPSG:{int(projection)}"` | Verified round trip (G3, R1). |
| P7 | Development before credentials work | Point the pipeline at the two public sample GCOV files. Use them for window arithmetic, grid assertions, COG export and unit tests | They share one grid and need no login. |
| P8 | Sample-data guard rails | On samples use `mask != 255` and finite; do not tune thresholds; label any output "sample (ALOS-1 PALSAR 2008), not NISAR" and keep it off the deployed site | S3, S7, S8, G5. |
| P9 | First real file | Run `h5_inspect.py` on it; record `productSpecificationVersion`, `compositeReleaseId`, `listOfFrequencies`, `listOfPolarizations`, `np.unique(mask)`, dtype and unique values of `inputDataExceptionMask`, page size; put them in `PROGRESS.md` | The mask semantics and specification version of real files are unverified. |
| P10 | Data URLs | Take them from CMR or `asf_search`; never build them from the collection name | K3. |
| P11 | Integer masks in xarray | Read masks with h5py, or open with `mask_and_scale=False` | Default decoding turns uint8 masks into float32 with NaN (R3). |
| P12 | Frequency and polarization | Read `listOfFrequencies` and `listOfCovarianceTerms` per granule; skip or handle B-only and VV granules | G13. |
| P13 | Date screening | Look at every date's public browse (`_LATLON.png`, `_NATIVE_A_HHHH.png`) before fetching; drop visibly broken dates and list them as excluded | ASF itself dropped two provisional dates of one stack (G15). |
| P14 | Browse placement | For validated granules fetch `_LATLON.kml` and use its `LatLonQuad`; keep D4 for provisional | L5, L6. |
| P15 | Persist immediately | After streaming a window write it to disk (GeoTIFF or Zarr) before further work | ASF's notebook does this; remote re-reads are slow and credentials expire. |
| P16 | Versions to pin for the pipeline | The venv list in E1 | That exact set ran every test. |
| P17 | Code reuse and licence | Copy idioms from the Cookbook (Apache-2.0 per LICENSE), isce3, nisarqa, the ISCE+ course (BSD-3-Clause). Do not paste MintPy code (GPL version 3 or later) into an Apache-2.0 repository; the same GUNW mask decoding is available from the BSD-3-Clause ISCE+ tutorial. List each in `docs/SOURCES.md` | E3. |
| P18 | If the team picks deformation | Use coordinates from inside each GUNW layer group; decode the mask as in the ISCE+ tutorial; displacement = -(c / centerFrequency) / (4 pi) x (unwrappedPhase - ionospherePhaseScreen); confirm the sign on a known signal | U2, U4, U5. |

---

## 6. Failures (tried, did not work)

| Tried | Outcome |
|---|---|
| `rasterio.open('NETCDF:"/vsicurl/https://.../sample.h5":/science/LSAR/GCOV/grids/frequencyA/HHHH')` on macOS, rasterio 1.5.2, GDAL 3.12.2 | `RasterioIOError: Opening a /vsi file with the netCDF driver requires Linux userfaultfd to be available. Or you may set the GDAL_SKIP=netCDF configuration option to force the use of the HDF5 driver.` |
| GDAL 3.12.2 `HDF5:` subdataset, local or `/vsicurl/` | Opens and reads, but `crs=None origin=(0.0, 0.0) res=(1.0, 1.0)`: no georeferencing. |
| fsspec HTTP defaults (no `cache_type`, no `block_size`) with xarray | Works but `open 24.7s` to `28.4s`, `requested_bytes=110739744` of a 171,966,464-byte file. |
| `xr.open_datatree` on the whole file (no `group=`) | Works but `open 12.1s` to `13.2s`, `requested_bytes=109051904`. |
| `h5py.File(f, "r", page_buf_size=16 MiB)` over fsspec | No gain: `read 512x512 4.2s` to `4.4s`, 6 requests, against 2.1 to 2.6 s and 3 requests without it. |
| Browse URL without suffix: `/BROWSE/<coll>/<G>/<G>.png`, `<G>_thumbnail.png`, `<G>.kml` | `HTTP/2 404`, an HTML "Data Not Available" page (244,697 bytes). |
| Provisional KML at its CMR-listed location `/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON.kml` | `401 27 text/html`, body `HTTP Basic: Access denied.` Under `/BROWSE/` it is 404. |
| Real `.h5`, `_QA_STATS.h5`, `.h5.iso.xml`, `.rc.yaml`, `_QA_SUMMARY.csv`, `_QA_REPORT.pdf`, `/s3credentials` without login | `HTTP/2 302` to `https://urs.earthdata.nasa.gov/oauth/authorize?...&app_type=401` |
| Directory listing of `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/` and `.../DOCS/` | `HTTP/2 404`. File URLs must come from the NASA sample-data page. |
| Finding the specification version of validated data (P05036) on the NASA CRID page | The page listed CSVs only up to `NISAR_LSAR_CRID_P05023.csv`; question left open. |
| `git tag` in the blob-less partial clone of isce3 | Returned 0 tags; `git ls-remote --tags` was used instead. |
| A cleanup command `rm -f downloads/browse_recheck/*` in attempt 3 | Refused by a harness safety check; the agent re-ran without it. No effect on results. |
| All three agent runs | Ended with "You've hit your 5-hour limit" before producing a final report. |

---

## 7. Open questions

1. Authenticated streaming was never exercised. How long does it take, from the team's network, to open a real 2 to 8.5 GB GCOV and read a real window with (a) the earthaccess session and (b) a Bearer-token header? Do both follow the redirect to CloudFront correctly for ranged reads?
2. What does `mask` contain in a real provisional and a real validated file (1 to 5 as specified)? What does `inputDataExceptionMask` contain, and should non-zero pixels be dropped?
3. Which product specification do validated (P05036, PGE R05.03.2) files follow: 1.5.0 or 1.6.0 (uint16 `inputDataExceptionMask`, GUNW `validDataMask`)? Read `/science/LSAR/identification/productSpecificationVersion` on the first validated file.
4. Is the file-space page size of real files 4 MiB as in the samples, and does `blockcache` with 8 MiB (the brief's value) beat 4 MiB there?
5. Does GDAL 3.13 or later (conda-forge) georeference NISAR over `/vsicurl/` on macOS with netrc auth, and does `gdal-driver-nisar` install and work on osx-arm64? Does `NETCDF:"/vsicurl/..."` work on Linux?
6. Do the Cookbook notebooks, written for asf_search 13.x and earthaccess 0.16, run unchanged on asf_search 14.1.0 and earthaccess 0.19.0?
7. What does `rtcGammaToSigmaFactor` look like in real data (the sample's 0.017 mean is not a credible factor)?
8. Are browse KMLs public for all validated products, and do provisional KMLs stay protected?
9. GUNW sign convention and the ionosphere subtraction are documented but unverified against a known deformation signal.
10. How common are frequency-B-only or VV-only granules inside the stack the team chooses?
11. The brief's sketch D3 is still unrun as a whole, including its `np.searchsorted` window arithmetic on a descending y axis.

---

## 8. Reference data

### 8.1 Public no-login sample files

Source page: `https://science.nasa.gov/mission/nisar/sample-data/` (reached from `https://nisar.jpl.nasa.gov/data/sample-data/`). An older single GCOV sample is linked from `https://www.earthdata.nasa.gov/learn/tutorials/work-nisar-sample-data`: `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/ALOS1_Rosamond_20081012/NISAR_L2_PR_GCOV_001_005_A_219_4020_SHNA_A_20081012T060910_20081012T060926_P01101_F_N_J_001.h5` (254,549,256 bytes, range requests answered with 206).

The five files the agents downloaded and used:

| Product | Bytes | URL |
|---|---|---|
| GCOV date 1 (2008-10-12) | 171,966,464 | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5` |
| GCOV date 2 (2008-11-27) | 171,966,464 | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5` |
| GUNW (46-day pair) | 264,241,152 | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GUNW/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5` |
| GOFF | 104,857,600 | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GOFF/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5` |
| SME2 | 7,340,032 | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/SME2/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001.h5` |

The GCOV, GSLC, GUNW, GOFF, RIFG, ROFF and RSLC sample folders also have `<granule>.png`, `<granule>.kml`, `<granule>_QA_REPORT.pdf`, `<granule>_QA_STATS.h5`, `<granule>_QA_SUMMARY.csv` (note: no `_LATLON` suffix in the sample area); the SME2 folder has only the `.h5` and `_QA_STATS.h5`. Also public: `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DEM/dem.vrt` (1,307 bytes) and `.../DEM/dem_0.tiff` (76,984,640 bytes), and the specification PDFs under `.../NISAR-SAMPLE-DATA/DOCS/`. The full list of 22 `.h5` URLs is reproduced in Part C.

What the sample GCOV is: EPSG:32611 (UTM 11N), 6220 rows x 4545 columns at 20 m (about 124 x 91 km), x from 365490 to 456370, y from 3913610 down to 3789230, frequency A only, HH only, both dates on the identical grid (fact S2b), 60.1 percent valid pixels in date 1.

### 8.2 GCOV: brief's Section 4.4 table against evidence

| Dataset (under `/science/LSAR/GCOV/grids/frequencyA/`) | Brief | Sample file (ran) | Real provisional (docs: ASF outputs, spec 1.5.0) |
|---|---|---|---|
| `HHHH`, `HVHV`, `VHVH`, `VVVV` | float32, NaN fill, gamma-naught linear power | `HHHH` float32, fill NaN, chunks (512, 512), gzip 1 + shuffle. Only HHHH present | `HHHH`, `HVHV` float32 (`<f4`), fill NaN, `valid_min` 0.0 |
| `HHHV`, `HHVV`, ... | complex64, quad-pol only | absent (single-pol) | spec: complex, fill nan+nan*j; "only included for quad-pol" (data guide) |
| `mask` | uint8, 255 fill; 0 invalid, 1 to 5 valid, 255 outside | uint8, fill 255, gzip 9; values only 0 (in image) and 255 | spec: same wording as the brief; values not observed |
| `numberOfLooks` | float32 | float32, fill NaN; min 0.002, mean 7.891, max 40.249 | present, float32 |
| `rtcGammaToSigmaFactor` | float32; sigma-naught = factor x gamma-naught | float32, fill NaN; mean 0.0174 (not credible) | present, float32 |
| `xCoordinates`, `yCoordinates` | float64, pixel centres, metres, y descends | float64, unchunked; exact 20 m steps; y descends | float64; spec attribute `pixel_coordinate_convention=center` |
| `projection` | uint32 scalar = EPSG, also attr `epsg_code` | uint32 scalar 32611, attr `epsg_code` 32611 | `np.uint32(32637)` |
| `listOfPolarizations`, `listOfCovarianceTerms` | read these | `['HH']`, `['HHHH']` (byte strings `S2`, `S4`) | present |
| `inputDataExceptionMask` | not listed | absent (spec 1.2.1) | present, uint8 (uint16 in spec 1.6.0) |
| `numberOfSubSwaths` | not listed | uint8 scalar = 1 | present |
| `xCoordinateSpacing`, `yCoordinateSpacing` | not listed | float64 scalars 20.0 and -20.0 | 20.0 and -20.0 |

Other groups seen in the sample and useful to a builder:

- `/science/LSAR/identification/`: `granuleId`, `compositeReleaseId`, `productSpecificationVersion`, `listOfFrequencies`, `orbitPassDirection`, `lookDirection`, `trackNumber`, `frameNumber`, `isFullFrame`, `isMixedMode`, `isUrgentObservation`, `isJointObservation`, `zeroDopplerStartTime`, `zeroDopplerEndTime`, `boundingPolygon` (WKT, lon lat height), `productDoi`.
- `/science/LSAR/GCOV/metadata/radarGrid/`: coarse 3-D cubes (`incidenceAngle`, `elevationAngle`, `losUnitVectorX/Y`, `slantRange`, ...) with their own `xCoordinates`, `yCoordinates`, `heightAboveEllipsoid`, `projection`. Real files: (21, 680, 695).
- `/science/LSAR/GCOV/metadata/processingInformation/parameters/`: flags such as `radiometricTerrainCorrectionApplied`, `noiseCorrectionApplied`, `rfiMitigationApplied`, `polarimetricSymmetrizationApplied`, and `rtc/outputBackscatterNormalizationConvention`.
- `/science/LSAR/GCOV/metadata/calibrationInformation/frequencyA/noiseEquivalentBackscatter/HH` on its own coarse grid.

### 8.3 Login boundary at a glance

| Resource | Without login | Evidence |
|---|---|---|
| CMR collections and granules (JSON, UMM-JSON) | 200 | `notes/cmr_*.log` |
| `/NISAR-SAMPLE-DATA/...` files | 303 to CloudFront, 200 or 206 | `notes/login_boundary.log`, `notes/download_samples.log` |
| `/BROWSE/<coll>/<G>/<G>_LATLON.png`, `_LATLON_thumbnail.png`, `_NATIVE.png`, `_NATIVE_A_HHHH.png` | 303 to CloudFront, 200 | `notes/browse_public_check.log`, `notes/browse_fetch.log` |
| `/BROWSE/NISAR_L2_GCOV_V1/<G>/<G>_LATLON.kml`, `_NATIVE.kml` (validated) | 200 | `notes/browse_fetch.log` |
| `/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/<G>/<G>_LATLON.kml` (provisional) | 401 | attempt 2 tool 116 |
| `/NISAR/<coll>/<G>/<G>.h5` | 302 to URS | `notes/login_boundary.log` |
| `<G>_QA_STATS.h5`, `<G>.h5.iso.xml`, `<G>.rc.yaml`, `<G>_QA_SUMMARY.csv`, `<G>_QA_REPORT.pdf` | 302 to URS | `notes/browse_public_check.log` |
| `/s3credentials` | 302 to URS | `notes/login_boundary.log` |
| `/s3credentialsREADME` | 200 | `notes/login_boundary.log` |
| Specification PDFs (`cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/...`, `/NISAR-SAMPLE-DATA/DOCS/...`) | 200 | attempt 3 tool 59 |

### 8.4 Artifacts

All under `$CB` = `<scratch>/verify/cookbook`.

| Path | What | To reuse |
|---|---|---|
| `scripts/h5_inspect.py` | Prints file page strategy and a full dataset tree (dtype, shape, chunks, filters, fill, units, small values). | `python -I h5_inspect.py <file.h5> [path-prefix] [--attrs]`. Run on the first real file. Needs h5py and numpy only. |
| `scripts/test_local_gcov.py` | h5py to GeoTIFF; xarray DataTree plus rioxarray clip; Cookbook `load_gcov_ts_xr`; log-ratio. | `python -I test_local_gcov.py <dir with GCOV .h5> <out dir> <path to util/load_gcov.py>`. Works on any GCOV files that have `frequencyA/HHHH`. |
| `scripts/test_stream_https.py` | Eight fsspec cache configurations against the public sample URL, with timings and cache statistics. | Change `url` and add `headers={"Authorization": f"Bearer {token}"}` to rerun on a real granule. |
| `scripts/test_gdal_open.py`, `scripts/test_gdal_vsicurl.py` | `NETCDF:` against `HDF5:` subdataset opens, local and over `/vsicurl/`. | Rerun inside any other GDAL build to see whether it georeferences NISAR. |
| `scripts/download_samples.sh`, `scripts/sample_sizes.sh` | Fetch the public samples; size each by a 1-byte range request. | `sh download_samples.sh notes/sample_data_urls.txt <outdir>` |
| `scripts/login_boundary.sh`, `scripts/browse_public_check.sh`, `scripts/browse_fetch.sh` | Unauthenticated status checks of data, QA, browse and KML URLs. | Replace the granule names to test other products. |
| `scripts/cmr_collections.sh`, `scripts/cmr_granule_counts.py`, `scripts/cmr_url_prefixes.py` | CMR collection list, counts and newest or oldest granule, URL prefixes and CRIDs per collection. | No arguments beyond an output folder; standard library only. |
| `scripts/spec_xml_dump.py`, `scripts/spec_xml_diff.py` | Dump and diff the product-specification XMLs shipped in `repos/nisarqa/src/nisarqa/product_specs/<version>/`. | `python3 -I spec_xml_diff.py repos/nisarqa/src/nisarqa/product_specs GCOV "/grids/"` |
| `scripts/nb2txt.py`, `scripts/pdf2txt.py`, `scripts/pixi_lock_versions.py`, `scripts/fetch_specs.sh`, `scripts/isce3_tag_specver.sh` | Research helpers (notebook and PDF text dumps, lockfile versions, spec PDFs, ISCE3 tag scan). | As documented in each file's header. |
| `repos/NISAR_Cookbook/util/load_gcov.py` | ASF's local GCOV time-series loader (ran on the samples). | Local files only; pass `freqs=["A"]` and a `vars_to_load` list. |
| `repos/NISAR_Cookbook/util/subset_h5.py` | ASF's whole-file HDF5 subsetter by WKT area (not run here). | Read before use. |
| `downloads/sample/*.h5` | The five sample products (737 MB). | Local test inputs; may be gone after a reboot, re-download with the URLs in 8.1. |
| `out/GCOV_frequencyA_HHHH.tif` | GeoTIFF written by the h5py path (113 MB). | Example output only. |
| `venv/` | The Python 3.12.2 environment that ran everything. | Recreate rather than reuse: `python3 -m venv venv && venv/bin/pip install h5py numpy xarray h5netcdf fsspec aiohttp requests dask rioxarray rasterio pyproj shapely asf_search earthaccess pypdf` |
| `notes/h5_GCOV_sample_tree.log`, `notes/h5_GUNW_sample_tree.log`, `notes/h5_SME2_sample_tree.log` | Full trees of the sample files. | Diff against the first real file's tree. |
| `notes/spec_tables/*_grids.txt`, `notes/spec_diff_*_grids.log` | Every grid dataset per specification version 1.1.0 to 1.6.0 for GCOV, GUNW, GOFF, GSLC, with descriptions. | Authoritative dataset descriptions for the methods page. |
| `notes/cookbook_nb_txt/*.txt`, `notes/isceplus_nb_txt/**` | Plain-text dumps of all Cookbook and ISCE+ notebooks, including ASF's saved outputs. | Searchable source for idioms; cite the notebooks, not the dumps. |
| `repos/nisar-docs/` | Clone of the NISAR Data User Guide source (CC0). | `accessing-nisar/gdal.md`, `accessing-nisar/earthaccess.md`, `data-products/level-2/gcov.md`. |
| `downloads/web_recheck/NISAR_LSAR_CRID_P05023.csv` | Software and specification versions behind provisional data. | Cite for provenance. |


---

# Part A. Reading a GCOV window: the lines that ran

These are excerpts of the scripts in Part B, shown first because they are what a builder copies. They ran against the public sample GCOV (local file for A.1 and A.2, HTTPS for A.3). Nothing here was run against a login-protected granule.


## A.1 h5py, whole layer, georeferenced GeoTIFF (ran, local file)

Printed by this block (`notes/test_local_gcov.log`): `GeoTIFF CRS: EPSG:32611 res: (20.0, 20.0)` and the pixel-centre round trip matched.

**scripts/test_local_gcov.py (lines 5 to 44)**  
Source: `<scratch>/verify/cookbook/scripts/test_local_gcov.py`

````python
import sys, glob, os, warnings, importlib.util
import numpy as np, h5py
warnings.filterwarnings("ignore")
sample_dir, out_dir, load_gcov_py = sys.argv[1:4]
files = sorted(glob.glob(os.path.join(sample_dir, "NISAR_L2_PR_GCOV_*.h5")))
print("files:", [os.path.basename(f) for f in files])
f0 = files[0]
grp = "/science/LSAR/GCOV/grids/frequencyA"

print("\n[1] h5py + rasterio.from_origin (idiom of notebooks/Opening_HDF5_Python.ipynb)")
import rasterio
from rasterio.transform import from_origin
with h5py.File(f0, "r") as f:
    hh = f[f"{grp}/HHHH"]
    print("  HHHH", hh.shape, hh.dtype, "chunks", hh.chunks, "_FillValue", hh.attrs["_FillValue"], "units", hh.attrs["units"].decode())
    data = hh[()]
    x = f[f"{grp}/xCoordinates"][:]; y = f[f"{grp}/yCoordinates"][:]
    dx = f[f"{grp}/xCoordinateSpacing"][()]; dy = f[f"{grp}/yCoordinateSpacing"][()]
    projection = f[f"{grp}/projection"][()]
    epsg_attr = f[f"{grp}/projection"].attrs["epsg_code"]
    mask = f[f"{grp}/mask"][()]
    print("  x[0], x[1], x[-1] =", x[0], x[1], x[-1], "| y[0], y[1], y[-1] =", y[0], y[1], y[-1])
    print("  dx, dy =", float(dx), float(dy), "| projection value", projection, type(projection).__name__, "| attrs['epsg_code']", epsg_attr)
    print("  np.diff(x) unique:", np.unique(np.diff(x)), "np.diff(y) unique:", np.unique(np.diff(y)))
    print("  mask dtype", mask.dtype, "unique values:", np.unique(mask, return_counts=True))
    print("  NaN fraction in HHHH:", float(np.isnan(data).mean()), "| HHHH==0 count:", int((data == 0).sum()),
          "| min>0:", float(np.nanmin(data)), "max:", float(np.nanmax(data)))
    print("  NaN where mask==255:", float(np.isnan(data[mask == 255]).mean()) if (mask == 255).any() else "n/a",
          "| NaN where mask!=255:", float(np.isnan(data[mask != 255]).mean()))
crs = f"EPSG:{int(projection)}"
start_x = float(x[0]) - float(dx) / 2
start_y = float(y[0]) - float(dy) / 2
transform = from_origin(start_x, start_y, float(dx), float(abs(dy)))
out_tif = os.path.join(out_dir, "GCOV_frequencyA_HHHH.tif")
with rasterio.open(out_tif, "w", driver="GTiff", height=data.shape[0], width=data.shape[1], count=1,
                   dtype=data.dtype, crs=crs, transform=transform, nodata=np.nan) as dst:
    dst.write(data, 1)
with rasterio.open(out_tif) as src:
    print("  GeoTIFF CRS:", src.crs, "res:", src.res, "bounds:", src.bounds)
    print("  pixel-centre of (row0,col0) from transform:", src.xy(0, 0), "vs xCoordinates[0], yCoordinates[0]:", (x[0], y[0]))
````


## A.2 xarray DataTree + rioxarray, lon/lat window (ran, local file)

Printed: `rio.transform(): (20.0, 0.0, 365480.0, 0.0, -20.0, 3913620.0)` and `clip_box ... -> (560, 464)`. Note the `mask_and_scale=False` variant for integer masks. This block continues the same script as A.1 and reuses its variables `f0`, `grp`, `crs`, `x`, `y` and `np`.

**scripts/test_local_gcov.py (lines 46 to 66)**  
Source: `<scratch>/verify/cookbook/scripts/test_local_gcov.py`

````python
print("\n[2] xarray DataTree (idiom of notebooks/search_stream_NISAR_asf_search.ipynb), local file")
import xarray as xr, rioxarray
dt = xr.open_datatree(f0, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group=grp)
print("  data_vars:", {k: (str(v.dtype), v.shape) for k, v in dt.ds.data_vars.items()})
print("  coords:", list(dt.ds.coords))
projection_x = dt.projection.attrs["epsg_code"].item()
print("  tree.projection.attrs['epsg_code'].item() =", projection_x, "| tree.projection.item() =", dt.projection.item())
var = dt.HHHH.rio.write_crs(projection_x)
print("  rio.crs:", var.rio.crs, "| rio.transform():", tuple(var.rio.transform())[:6], "| rio.bounds():", var.rio.bounds())
from pyproj import Transformer
tr = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
lon_c, lat_c = tr.transform(float(x[len(x) // 2]), float(y[len(y) // 2]))
box = dict(minx=lon_c - 0.05, miny=lat_c - 0.05, maxx=lon_c + 0.05, maxy=lat_c + 0.05)
sub = var.rio.clip_box(**box, crs="EPSG:4326")
print("  clip_box lon/lat", {k: round(v, 4) for k, v in box.items()}, "->", sub.shape, "mean power:", float(sub.mean()))
db = 10 * np.log10(sub.where(sub > 0))
print("  dB stats: min %.2f mean %.2f max %.2f" % (float(db.min()), float(db.mean()), float(db.max())))
print("  mask via xarray dtype:", dt.mask.dtype, "(file dtype uint8; CF _FillValue decoding promotes it) unique:", np.unique(dt.mask.values[~np.isnan(dt.mask.values)]))
dt2 = xr.open_datatree(f0, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group=grp, mask_and_scale=False)
print("  mask with mask_and_scale=False dtype:", dt2.mask.dtype)
dt.close(); dt2.close()
````


## A.3 Streaming one window over HTTPS, h5py and xarray (ran, public sample URL)

`run(...)` opens the URL through fsspec with the given cache settings, then reads `HHHH[2048:2560, 2048:2560]` either through xarray + h5netcdf or through h5py. Case G (`blockcache`, 4 MiB, h5py) was the cheapest; cases A and B are the Cookbook's setting.

**scripts/test_stream_https.py (lines 6 to 58)**  
Source: `<scratch>/verify/cookbook/scripts/test_stream_https.py`

````python
import time, warnings, sys
import numpy as np, fsspec, h5py, xarray as xr
warnings.filterwarnings("ignore")
G = "NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001"
url = f"https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/{G}/{G}.h5"
grp = "/science/LSAR/GCOV/grids/frequencyA"
UA = {"User-Agent": "nisar-verify/1.0 (generic research client)"}
print("fsspec", fsspec.__version__, "| xarray", xr.__version__, "| h5py", h5py.__version__, "HDF5", h5py.version.hdf5_version,
      "| h5py drivers:", sorted(h5py.registered_drivers()))

def stats(f):
    c = f.cache
    return (f"cache={type(c).__name__} blocksize={getattr(c, 'blocksize', None)} hits={getattr(c, 'hit_count', '?')} "
            f"misses={getattr(c, 'miss_count', '?')} requested_bytes={getattr(c, 'total_requested_bytes', '?')}")

def run(label, fs_kwargs, open_kwargs, group, engine="xarray"):
    fs = fsspec.filesystem("http", headers=UA, skip_instance_cache=True, **fs_kwargs)
    t0 = time.time()
    f = fs.open(url, "rb", **open_kwargs)
    try:
        if engine == "xarray":
            kw = dict(engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto")
            if group:
                kw["group"] = group
            dt = xr.open_datatree(f, **kw)
            t1 = time.time()
            node = dt if group else dt[grp]
            sub = node["HHHH"].isel(yCoordinates=slice(2048, 2560), xCoordinates=slice(2048, 2560)).compute()
            t2 = time.time()
            val = float(sub.mean())
            dt.close()
        else:
            h = h5py.File(f, "r", **(engine if isinstance(engine, dict) else {}))
            t1 = time.time()
            sub = h[f"{grp}/HHHH"][2048:2560, 2048:2560]
            t2 = time.time()
            val = float(np.nanmean(sub))
            h.close()
        print(f"{label}: open {t1-t0:5.1f}s | read 512x512 {t2-t1:5.1f}s | mean={val:.5f} | {stats(f)}")
    except Exception as e:
        print(f"{label}: FAILED {type(e).__name__}: {str(e)[:200]}")
    finally:
        f.close()

MB = 1024 * 1024
run("A cookbook: group only, background 8MiB (fs-level kwargs)   ", dict(cache_type="background", block_size=8 * MB), {}, grp)
run("B cookbook kwargs at open(): background 8MiB, group only     ", {}, dict(cache_type="background", block_size=8 * MB), grp)
run("C docs: background 16MiB at open(), group only               ", {}, dict(cache_type="background", block_size=16 * MB), grp)
run("D fsspec defaults (no cache_type/block_size), group only     ", {}, {}, grp)
run("E whole tree (no group=), background 8MiB at open()          ", {}, dict(cache_type="background", block_size=8 * MB), None)
run("F h5py direct, background 8MiB at open()                     ", {}, dict(cache_type="background", block_size=8 * MB), grp, engine={})
run("G h5py direct, blockcache 4MiB (= file page size)            ", {}, dict(cache_type="blockcache", block_size=4 * MB), grp, engine={})
run("H h5py direct + page_buf_size=16MiB, background 8MiB         ", {}, dict(cache_type="background", block_size=8 * MB), grp, engine=dict(page_buf_size=16 * MB))
````


To point A.3 at a real granule (not run here): keep the code, change `url`, and replace the `headers=UA` argument with an authenticated filesystem. The two official forms are quoted verbatim in Part D (Cookbook: `fsspec.filesystem("http", headers={"Authorization": f"Bearer {token}"}, ...)`; Data User Guide: `earthaccess.get_fsspec_https_session()`).


---

# Part B. Every script that ran, verbatim

All were executed by the verification agents inside `$CB` with `./venv/bin/python -I` (Python 3.12.2) or `/opt/anaconda3/bin/python3 -I` / `sh`. Outputs are in Part C.


## B.1 Reading, streaming, GDAL, inspection

**scripts/h5_inspect.py**  
Source: `<scratch>/verify/cookbook/scripts/h5_inspect.py`

````python
#!/usr/bin/env python3
"""Inspect a NISAR HDF5 product: file-level layout, tree of datasets (dtype/shape/chunks/filters/fill/units).
Usage: python -I h5_inspect.py <file.h5> [path-prefix] [--attrs]
"""
import sys, h5py, numpy as np
fn = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "/"
show_attrs = "--attrs" in sys.argv

def dec(v):
    if isinstance(v, (bytes, np.bytes_)):
        return v.decode("utf-8", "replace")
    if isinstance(v, np.ndarray) and v.dtype.kind == "S":
        return [x.decode() for x in v.ravel().tolist()]
    if isinstance(v, np.ndarray) and v.size > 8:
        return f"array{v.shape} {v.dtype}"
    return v

with h5py.File(fn, "r") as f:
    fcpl = f.id.get_create_plist()
    strat = fcpl.get_file_space_strategy()
    names = {0: "FSM_AGGR", 1: "PAGE", 2: "AGGR", 3: "NONE"}
    print("FILE:", fn.split("/")[-1])
    print("  size bytes:", f.id.get_filesize(), "| libver:", f.libver, "| userblock:", f.userblock_size)
    print("  file_space_strategy:", names.get(strat[0], strat[0]), strat, "| file_space_page_size:", fcpl.get_file_space_page_size())
    print("  root attrs:", {k: dec(v) for k, v in f.attrs.items()})
    def visit(name, obj):
        p = "/" + name
        if not p.startswith(prefix):
            return
        if isinstance(obj, h5py.Dataset):
            fill = obj.attrs.get("_FillValue", None)
            units = dec(obj.attrs.get("units", "")) if "units" in obj.attrs else "-"
            filt = []
            if obj.compression: filt.append(f"{obj.compression}{obj.compression_opts if obj.compression_opts is not None else ''}")
            if obj.shuffle: filt.append("shuffle")
            if obj.scaleoffset is not None: filt.append(f"scaleoffset{obj.scaleoffset}")
            val = ""
            if obj.shape == () or (obj.size is not None and obj.size <= 6 and obj.dtype.kind in "SOUifu"):
                try:
                    val = f" = {dec(obj[()])!r}"[:140]
                except Exception as e:
                    val = f" = <{e}>"
            print(f"D {p} | {obj.dtype} | {obj.shape} | chunks={obj.chunks} | {'+'.join(filt) or 'nofilter'} | fill={fill!r} | units={units}{val}")
            if show_attrs:
                for k, v in obj.attrs.items():
                    if k in ("DIMENSION_LIST", "REFERENCE_LIST"):
                        continue
                    print(f"      @{k} = {str(dec(v))[:200]}")
        else:
            print(f"G {p}/")
    f.visititems(visit)
````

**scripts/test_local_gcov.py**  
Source: `<scratch>/verify/cookbook/scripts/test_local_gcov.py`

````python
#!/usr/bin/env python3
"""Run the NISAR Cookbook GCOV reading idioms against the public pre-launch sample GCOV files (no login).
Usage: venv/bin/python -I scripts/test_local_gcov.py <sample_dir> <out_dir> <path-to-cookbook-util/load_gcov.py>
"""
import sys, glob, os, warnings, importlib.util
import numpy as np, h5py
warnings.filterwarnings("ignore")
sample_dir, out_dir, load_gcov_py = sys.argv[1:4]
files = sorted(glob.glob(os.path.join(sample_dir, "NISAR_L2_PR_GCOV_*.h5")))
print("files:", [os.path.basename(f) for f in files])
f0 = files[0]
grp = "/science/LSAR/GCOV/grids/frequencyA"

print("\n[1] h5py + rasterio.from_origin (idiom of notebooks/Opening_HDF5_Python.ipynb)")
import rasterio
from rasterio.transform import from_origin
with h5py.File(f0, "r") as f:
    hh = f[f"{grp}/HHHH"]
    print("  HHHH", hh.shape, hh.dtype, "chunks", hh.chunks, "_FillValue", hh.attrs["_FillValue"], "units", hh.attrs["units"].decode())
    data = hh[()]
    x = f[f"{grp}/xCoordinates"][:]; y = f[f"{grp}/yCoordinates"][:]
    dx = f[f"{grp}/xCoordinateSpacing"][()]; dy = f[f"{grp}/yCoordinateSpacing"][()]
    projection = f[f"{grp}/projection"][()]
    epsg_attr = f[f"{grp}/projection"].attrs["epsg_code"]
    mask = f[f"{grp}/mask"][()]
    print("  x[0], x[1], x[-1] =", x[0], x[1], x[-1], "| y[0], y[1], y[-1] =", y[0], y[1], y[-1])
    print("  dx, dy =", float(dx), float(dy), "| projection value", projection, type(projection).__name__, "| attrs['epsg_code']", epsg_attr)
    print("  np.diff(x) unique:", np.unique(np.diff(x)), "np.diff(y) unique:", np.unique(np.diff(y)))
    print("  mask dtype", mask.dtype, "unique values:", np.unique(mask, return_counts=True))
    print("  NaN fraction in HHHH:", float(np.isnan(data).mean()), "| HHHH==0 count:", int((data == 0).sum()),
          "| min>0:", float(np.nanmin(data)), "max:", float(np.nanmax(data)))
    print("  NaN where mask==255:", float(np.isnan(data[mask == 255]).mean()) if (mask == 255).any() else "n/a",
          "| NaN where mask!=255:", float(np.isnan(data[mask != 255]).mean()))
crs = f"EPSG:{int(projection)}"
start_x = float(x[0]) - float(dx) / 2
start_y = float(y[0]) - float(dy) / 2
transform = from_origin(start_x, start_y, float(dx), float(abs(dy)))
out_tif = os.path.join(out_dir, "GCOV_frequencyA_HHHH.tif")
with rasterio.open(out_tif, "w", driver="GTiff", height=data.shape[0], width=data.shape[1], count=1,
                   dtype=data.dtype, crs=crs, transform=transform, nodata=np.nan) as dst:
    dst.write(data, 1)
with rasterio.open(out_tif) as src:
    print("  GeoTIFF CRS:", src.crs, "res:", src.res, "bounds:", src.bounds)
    print("  pixel-centre of (row0,col0) from transform:", src.xy(0, 0), "vs xCoordinates[0], yCoordinates[0]:", (x[0], y[0]))

print("\n[2] xarray DataTree (idiom of notebooks/search_stream_NISAR_asf_search.ipynb), local file")
import xarray as xr, rioxarray
dt = xr.open_datatree(f0, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group=grp)
print("  data_vars:", {k: (str(v.dtype), v.shape) for k, v in dt.ds.data_vars.items()})
print("  coords:", list(dt.ds.coords))
projection_x = dt.projection.attrs["epsg_code"].item()
print("  tree.projection.attrs['epsg_code'].item() =", projection_x, "| tree.projection.item() =", dt.projection.item())
var = dt.HHHH.rio.write_crs(projection_x)
print("  rio.crs:", var.rio.crs, "| rio.transform():", tuple(var.rio.transform())[:6], "| rio.bounds():", var.rio.bounds())
from pyproj import Transformer
tr = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
lon_c, lat_c = tr.transform(float(x[len(x) // 2]), float(y[len(y) // 2]))
box = dict(minx=lon_c - 0.05, miny=lat_c - 0.05, maxx=lon_c + 0.05, maxy=lat_c + 0.05)
sub = var.rio.clip_box(**box, crs="EPSG:4326")
print("  clip_box lon/lat", {k: round(v, 4) for k, v in box.items()}, "->", sub.shape, "mean power:", float(sub.mean()))
db = 10 * np.log10(sub.where(sub > 0))
print("  dB stats: min %.2f mean %.2f max %.2f" % (float(db.min()), float(db.mean()), float(db.max())))
print("  mask via xarray dtype:", dt.mask.dtype, "(file dtype uint8; CF _FillValue decoding promotes it) unique:", np.unique(dt.mask.values[~np.isnan(dt.mask.values)]))
dt2 = xr.open_datatree(f0, engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto", group=grp, mask_and_scale=False)
print("  mask with mask_and_scale=False dtype:", dt2.mask.dtype)
dt.close(); dt2.close()

print("\n[3] cookbook util/load_gcov.py load_gcov_ts_xr on both dates")
spec = importlib.util.spec_from_file_location("load_gcov", load_gcov_py)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
ds = mod.load_gcov_ts_xr(files, vars_to_load=["HHHH", "mask", "numberOfLooks", "rtcGammaToSigmaFactor"], freqs=["A"])
print("  dims:", dict(ds.sizes), "| vars:", list(ds.data_vars), "| crs:", ds.rio.crs, "| time:", ds.time.values)
hh2 = ds["HHHH"].isel(frequency=0)
m = hh2.mean(dim=("y", "x")).compute()
print("  mean gamma0 power per date:", m.values, "-> dB:", 10 * np.log10(m.values))

print("\n[4] pair-wise log-ratio change (idiom of NISAR_GCOV_SARChangeDetectionMethods.ipynb)")
a = hh2.isel(time=0); b = hh2.isel(time=1)
ratio_db = (10 * np.log10(b / a)).compute()
v = ratio_db.values[np.isfinite(ratio_db.values)]
print("  log-ratio dB: n=%d p01=%.2f p50=%.2f p99=%.2f | frac < -2 dB: %.4f | frac > +2 dB: %.4f" %
      (v.size, np.percentile(v, 1), np.percentile(v, 50), np.percentile(v, 99), (v < -2).mean(), (v > 2).mean()))
g2s = ds["rtcGammaToSigmaFactor"].isel(frequency=0, time=0).compute().values
print("  rtcGammaToSigmaFactor stats (sample file): min %.4f mean %.4f max %.4f" % (np.nanmin(g2s), np.nanmean(g2s), np.nanmax(g2s)))
nl = ds["numberOfLooks"].isel(frequency=0, time=0).compute().values
print("  numberOfLooks stats: min %.3f mean %.3f max %.3f" % (np.nanmin(nl), np.nanmean(nl), np.nanmax(nl)))
````

**scripts/test_stream_https.py**  
Source: `<scratch>/verify/cookbook/scripts/test_stream_https.py`

````python
#!/usr/bin/env python3
"""Stream a NISAR HDF5 over HTTPS exactly as the Cookbook does (fsspec + xarray/h5netcdf), but against the
public pre-launch sample GCOV so no Earthdata Login is needed. Reports wall time and fsspec cache statistics.
Usage: venv/bin/python -I scripts/test_stream_https.py
"""
import time, warnings, sys
import numpy as np, fsspec, h5py, xarray as xr
warnings.filterwarnings("ignore")
G = "NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001"
url = f"https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/{G}/{G}.h5"
grp = "/science/LSAR/GCOV/grids/frequencyA"
UA = {"User-Agent": "nisar-verify/1.0 (generic research client)"}
print("fsspec", fsspec.__version__, "| xarray", xr.__version__, "| h5py", h5py.__version__, "HDF5", h5py.version.hdf5_version,
      "| h5py drivers:", sorted(h5py.registered_drivers()))

def stats(f):
    c = f.cache
    return (f"cache={type(c).__name__} blocksize={getattr(c, 'blocksize', None)} hits={getattr(c, 'hit_count', '?')} "
            f"misses={getattr(c, 'miss_count', '?')} requested_bytes={getattr(c, 'total_requested_bytes', '?')}")

def run(label, fs_kwargs, open_kwargs, group, engine="xarray"):
    fs = fsspec.filesystem("http", headers=UA, skip_instance_cache=True, **fs_kwargs)
    t0 = time.time()
    f = fs.open(url, "rb", **open_kwargs)
    try:
        if engine == "xarray":
            kw = dict(engine="h5netcdf", decode_timedelta=False, phony_dims="access", chunks="auto")
            if group:
                kw["group"] = group
            dt = xr.open_datatree(f, **kw)
            t1 = time.time()
            node = dt if group else dt[grp]
            sub = node["HHHH"].isel(yCoordinates=slice(2048, 2560), xCoordinates=slice(2048, 2560)).compute()
            t2 = time.time()
            val = float(sub.mean())
            dt.close()
        else:
            h = h5py.File(f, "r", **(engine if isinstance(engine, dict) else {}))
            t1 = time.time()
            sub = h[f"{grp}/HHHH"][2048:2560, 2048:2560]
            t2 = time.time()
            val = float(np.nanmean(sub))
            h.close()
        print(f"{label}: open {t1-t0:5.1f}s | read 512x512 {t2-t1:5.1f}s | mean={val:.5f} | {stats(f)}")
    except Exception as e:
        print(f"{label}: FAILED {type(e).__name__}: {str(e)[:200]}")
    finally:
        f.close()

MB = 1024 * 1024
run("A cookbook: group only, background 8MiB (fs-level kwargs)   ", dict(cache_type="background", block_size=8 * MB), {}, grp)
run("B cookbook kwargs at open(): background 8MiB, group only     ", {}, dict(cache_type="background", block_size=8 * MB), grp)
run("C docs: background 16MiB at open(), group only               ", {}, dict(cache_type="background", block_size=16 * MB), grp)
run("D fsspec defaults (no cache_type/block_size), group only     ", {}, {}, grp)
run("E whole tree (no group=), background 8MiB at open()          ", {}, dict(cache_type="background", block_size=8 * MB), None)
run("F h5py direct, background 8MiB at open()                     ", {}, dict(cache_type="background", block_size=8 * MB), grp, engine={})
run("G h5py direct, blockcache 4MiB (= file page size)            ", {}, dict(cache_type="blockcache", block_size=4 * MB), grp, engine={})
run("H h5py direct + page_buf_size=16MiB, background 8MiB         ", {}, dict(cache_type="background", block_size=8 * MB), grp, engine=dict(page_buf_size=16 * MB))
````

**scripts/test_gdal_open.py**  
Source: `<scratch>/verify/cookbook/scripts/test_gdal_open.py`

````python
#!/usr/bin/env python3
"""How does GDAL (as bundled in the rasterio wheel) open NISAR HDF5 subdatasets? NETCDF: vs HDF5: driver.
Usage: venv/bin/python -I scripts/test_gdal_open.py <sample_dir>
"""
import sys, glob, os, warnings
import rasterio
warnings.filterwarnings("ignore")
d = sys.argv[1]
print("rasterio", rasterio.__version__, "GDAL", rasterio.__gdal_version__)
gcov = sorted(glob.glob(os.path.join(d, "NISAR_L2_PR_GCOV_*.h5")))[0]
gunw = sorted(glob.glob(os.path.join(d, "NISAR_L2_PR_GUNW_*.h5")))[0]
sme2 = sorted(glob.glob(os.path.join(d, "NISAR_L3_PR_SME2_*.h5")))[0]
cases = [
    ("GCOV HHHH", gcov, "/science/LSAR/GCOV/grids/frequencyA/HHHH"),
    ("GCOV mask", gcov, "/science/LSAR/GCOV/grids/frequencyA/mask"),
    ("GUNW unwrappedPhase", gunw, "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase"),
    ("GUNW wrappedInterferogram", gunw, "/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/wrappedInterferogram"),
    ("SME2 soilMoisture", sme2, "/science/LSAR/SME2/grids/soilMoisture"),
]
for label, fn, path in cases:
    for name, spec in (("NETCDF", f'NETCDF:"{fn}":{path}'), ("HDF5", f'HDF5:"{fn}":/{path}')):
        try:
            with rasterio.open(spec) as src:
                t = src.transform
                print(f"{label:26s} {name:6s} driver={src.driver:9s} dtype={src.dtypes[0]:9s} size={src.width}x{src.height} "
                      f"crs={src.crs.to_epsg() if src.crs else None} origin=({t.c}, {t.f}) res=({t.a}, {t.e}) nodata={src.nodata}")
        except Exception as e:
            print(f"{label:26s} {name:6s} FAILED: {type(e).__name__}: {str(e)[:150]}")
# opening the container without a subdataset
for name, spec in (("plain", gcov), ("NETCDF:", f"NETCDF:{gcov}")):
    try:
        with rasterio.open(spec) as src:
            sds = src.subdatasets
            print(f"\nopen({name}) driver={src.driver} subdatasets={len(sds)}; first 3:")
            for s in sds[:3]:
                print("   ", s.replace(os.path.dirname(gcov) + "/", ""))
    except Exception as e:
        print(f"open({name}) FAILED: {type(e).__name__}: {str(e)[:200]}")
````

**scripts/test_gdal_vsicurl.py**  
Source: `<scratch>/verify/cookbook/scripts/test_gdal_vsicurl.py`

````python
#!/usr/bin/env python3
"""Can the GDAL bundled with rasterio stream a NISAR HDF5 over HTTPS (/vsicurl/) on this machine?
Uses the public pre-launch sample GCOV (no login). Usage: venv/bin/python -I scripts/test_gdal_vsicurl.py
"""
import time, warnings, platform
import rasterio
from rasterio.windows import Window
warnings.filterwarnings("ignore")
G = "NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001"
url = f"https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/{G}/{G}.h5"
ds = "/science/LSAR/GCOV/grids/frequencyA/HHHH"
print(platform.platform(), "| rasterio", rasterio.__version__, "GDAL", rasterio.__gdal_version__)
opts = dict(GDAL_DISABLE_READDIR_ON_OPEN="TRUE", GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", GDAL_HTTP_MULTIPLEX="YES",
            CPL_VSIL_CURL_CHUNK_SIZE="2097152", CPL_VSIL_CURL_CACHE_SIZE="67108864",
            GDAL_HTTP_USERAGENT="nisar-verify/1.0 (generic research client)")
for name, spec in (("NETCDF+vsicurl", f'NETCDF:"/vsicurl/{url}":{ds}'), ("HDF5+vsicurl", f'HDF5:"/vsicurl/{url}":/{ds}')):
    t0 = time.time()
    try:
        with rasterio.Env(**opts):
            with rasterio.open(spec) as src:
                t1 = time.time()
                a = src.read(1, window=Window(2048, 2048, 512, 512))
                t2 = time.time()
                print(f"{name}: OK driver={src.driver} crs={src.crs} origin=({src.transform.c},{src.transform.f}) "
                      f"open {t1-t0:.1f}s read512x512 {t2-t1:.1f}s mean={float(a[a==a].mean()):.5f}")
    except Exception as e:
        print(f"{name}: FAILED after {time.time()-t0:.1f}s: {type(e).__name__}: {str(e)[:300]}")
````


## B.2 ASF Cookbook helper that was run on the samples (Apache-2.0 per the repository LICENSE file)

Upstream: `https://github.com/ASFOpenSARlab/NISAR_Cookbook`, file `util/load_gcov.py`, commit `17b69c87a7320610740be7f2c7e605601cb7fe43`. Called as `load_gcov_ts_xr(files, vars_to_load=["HHHH", "mask", "numberOfLooks", "rtcGammaToSigmaFactor"], freqs=["A"])`.

**repos/NISAR_Cookbook/util/load_gcov.py**  
Source: `<scratch>/verify/cookbook/repos/NISAR_Cookbook/util/load_gcov.py`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## B.3 Sample download, login boundary, browse checks

**scripts/download_samples.sh**  
Source: `<scratch>/verify/cookbook/scripts/download_samples.sh`

````sh
#!/bin/sh
# Download public (no-login) NISAR pre-launch sample products. Usage: sh download_samples.sh <url-list> <outdir>
UA="nisar-verify/1.0 (generic research client)"
grep -E "/(GCOV|GUNW|GOFF|SME2)/[^/]+/[^/]+_001\.h5$" "$1" | while read -r u; do
  f="$2/$(basename "$u")"
  if [ -s "$f" ]; then echo "have $f"; continue; fi
  curl -s -L -A "$UA" --max-time 1500 -o "$f" -w "%{http_code} %{size_download} bytes %{time_total}s %{speed_download} B/s  $(basename "$u")\n" "$u"
done
````

**scripts/sample_sizes.sh**  
Source: `<scratch>/verify/cookbook/scripts/sample_sizes.sh`

````sh
#!/bin/sh
# Print size of each public NISAR sample-data file using a 1-byte range request (no login).
# Usage: sh sample_sizes.sh <url-list-file>
UA="nisar-verify/1.0 (generic research client)"
while read -r u; do
  case "$u" in *.h5|*.png|*.tiff|*.vrt) ;; *) continue;; esac
  cr=$(curl -s -L -A "$UA" --max-time 60 -r 0-0 -o /dev/null -D - "$u" | grep -i "^content-range" | tr -d '\r' | awk -F/ '{print $2}')
  printf "%14s  %s\n" "${cr:-NA}" "$(basename "$u")"
done < "$1"
````

**scripts/login_boundary.sh**  
Source: `<scratch>/verify/cookbook/scripts/login_boundary.sh`

````sh
#!/bin/sh
# Where does Earthdata Login become necessary? All requests are unauthenticated. Usage: sh login_boundary.sh
UA="nisar-verify/1.0 (generic research client)"
show() { # url
  echo "== $1" | cut -c1-230
  curl -s -A "$UA" --max-time 60 -o /dev/null -D - --max-redirs 0 -r 0-1023 "$1" | grep -iE "^HTTP|^location|^content-type|^content-range|^www-authenticate" | sed 's/client_id=[^&]*/client_id=.../; s/state=[^& ]*/state=.../' | cut -c1-200
}
G="NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001"
P="NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001"
show "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/$G/$G.h5"
show "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GUNW_PROVISIONAL_V1/$P/$P.h5"
show "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/$G/${G}_QA_STATS.h5"
show "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1/$G/$G.png"
show "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1/$G/${G}_thumbnail.png"
show "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GUNW_PROVISIONAL_V1/$P/$P.png"
show "https://nisar.asf.earthdatacloud.nasa.gov/s3credentials"
show "https://nisar.asf.earthdatacloud.nasa.gov/s3credentialsREADME"
show "https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5"
````

**scripts/browse_public_check.sh**  
Source: `<scratch>/verify/cookbook/scripts/browse_public_check.sh`

````sh
#!/bin/sh
# Are NISAR browse PNG / KML / iso.xml / QA files downloadable without Earthdata Login?
# URLs are taken verbatim from the CMR UMM-G RelatedUrls of the newest NISAR_L2_GCOV_V1 granule.
# Usage: sh browse_public_check.sh <outdir>
UA="nisar-verify/1.0 (generic research client)"
out="$1"
G="NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001"
B="https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1/$G"
D="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/$G"
for u in "$B/${G}_LATLON.png" "$B/${G}_LATLON_thumbnail.png" "$B/${G}_NATIVE.png" "$B/${G}_LATLON.kml" "$B/${G}_NATIVE.kml" \
         "$D/${G}.h5.iso.xml" "$D/${G}.rc.yaml" "$D/${G}_QA_SUMMARY.csv" "$D/${G}_QA_REPORT.pdf" "$D/${G}_QA_STATS.h5" "$D/${G}.h5"; do
  f="$out/$(basename "$u")"
  code=$(curl -s -A "$UA" --max-time 120 --max-redirs 0 -o "$f" -w "%{http_code} %{size_download}B %{content_type} redirect=%{redirect_url}" "$u")
  echo "$code" | sed 's/client_id=[^&]*/client_id=.../; s/state=[^& ]*/state=.../' | cut -c1-170
  echo "    <- $(basename "$u")"
done
````

**scripts/browse_fetch.sh**  
Source: `<scratch>/verify/cookbook/scripts/browse_fetch.sh`

````sh
#!/bin/sh
# Download public NISAR browse PNG + KML (no login; follows the 303 to CloudFront). Usage: sh browse_fetch.sh <outdir>
UA="nisar-verify/1.0 (generic research client)"
out="$1"
fetch() { # base-url granule suffixes...
  b="$1"; g="$2"; shift 2
  for s in "$@"; do
    f="$out/${g}${s}"
    curl -s -L -A "$UA" --max-time 180 -o "$f" -w "%{http_code} %{size_download}B %{content_type}  ${g}${s}\n" "$b/$g/${g}${s}"
  done
}
# newest validated GCOV (frequency-B only, 5 MHz)
fetch "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1" \
  "NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001" \
  _LATLON.png _LATLON_thumbnail.png _NATIVE.png _LATLON.kml _NATIVE.kml
# a provisional dual-pol GCOV used by the cookbook time-series notebook
fetch "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1" \
  "NISAR_L2_PR_GCOV_024_026_A_016_4005_DHDH_A_20260627T234740_20260627T234815_P05023_N_F_J_001" \
  _LATLON.png _LATLON.kml .png .kml
````


## B.4 CMR queries (no login, standard library only)

**scripts/cmr_collections.sh**  
Source: `<scratch>/verify/cookbook/scripts/cmr_collections.sh`

````sh
#!/bin/sh
# List NISAR collections known to CMR (public, no login). Usage: sh cmr_collections.sh <outdir>
OUT="$1"; UA="nisar-verify/1.0 (generic research client)"
curl -s -A "$UA" --max-time 60 "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=NISAR_L*&options%5Bshort_name%5D%5Bpattern%5D=true&page_size=200" -o "$OUT/collections.json"
/opt/anaconda3/bin/python3 -I - "$OUT/collections.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
ents = d["feed"]["entry"]
print(len(ents), "collections")
for e in sorted(ents, key=lambda e: e["short_name"]):
    print(f'{e["short_name"]:34s} v{e.get("version_id"):3s} {e["id"]:22s} start={e.get("time_start","")[:10]} end={e.get("time_end","")[:10]} cloud={e.get("cloud_hosted")} dc={e.get("data_center")}')
PY
````

**scripts/cmr_granule_counts.py**  
Source: `<scratch>/verify/cookbook/scripts/cmr_granule_counts.py`

````python
#!/usr/bin/env python3
"""Count granules and show newest/oldest granule per NISAR L2/L3 collection via public CMR (no login).
Usage: python3 -I cmr_granule_counts.py <outdir>
"""
import json, sys, urllib.request, urllib.parse, pathlib
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
UA = "nisar-verify/1.0 (generic research client)"
names = [f"NISAR_L2_{p}{m}_V1" for p in ("GCOV", "GUNW", "GSLC", "GOFF") for m in ("", "_PROVISIONAL", "_BETA")] + \
        ["NISAR_L3_SME2_PROVISIONAL_V1", "NISAR_L3_SME2_BETA_V1"]
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.headers, r.read()
for n in names:
    res = {}
    for key, sort in (("newest", "-start_date"), ("oldest", "start_date")):
        q = urllib.parse.urlencode({"short_name": n, "page_size": 1, "sort_key": sort})
        h, body = get("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q)
        d = json.loads(body)
        res[key] = d
        hits = h.get("CMR-Hits")
        it = d["items"][0] if d["items"] else None
        if it:
            u = it["umm"]
            t = u["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]
            print(f"{n:30s} hits={hits:>8s} {key}: {t} {u['GranuleUR']}")
        else:
            print(f"{n:30s} hits={hits} {key}: none")
    (out / f"{n}_newest.umm.json").write_text(json.dumps(res["newest"], indent=1))
````

**scripts/cmr_url_prefixes.py**  
Source: `<scratch>/verify/cookbook/scripts/cmr_url_prefixes.py`

````python
#!/usr/bin/env python3
"""For each NISAR L2/L3 collection, sample granules from CMR (no login) and report the distinct
URL directory prefixes used for the .h5 data file (HTTPS and S3) and the CRIDs seen.
Usage: python3 -I cmr_url_prefixes.py
"""
import json, re, urllib.request, urllib.parse, collections
UA = "nisar-verify/1.0 (generic research client)"
names = [f"NISAR_L2_{p}{m}_V1" for p in ("GCOV", "GUNW", "GSLC", "GOFF") for m in ("", "_PROVISIONAL", "_BETA")] + \
        ["NISAR_L3_SME2_PROVISIONAL_V1", "NISAR_L3_SME2_BETA_V1"]
for n in names:
    pref = collections.Counter(); crid = collections.Counter(); pge = collections.Counter()
    for sort in ("-start_date", "start_date", "-revision_date"):
        q = urllib.parse.urlencode({"short_name": n, "page_size": 200, "sort_key": sort})
        req = urllib.request.Request("https://cmr.earthdata.nasa.gov/search/granules.umm_json?" + q, headers={"User-Agent": UA})
        d = json.loads(urllib.request.urlopen(req, timeout=120).read())
        for it in d["items"]:
            u = it["umm"]
            g = u["GranuleUR"]
            m = re.search(r"_([A-Z]\d{5})_", g)
            crid[m.group(1) if m else "?"] += 1
            pge[(u.get("PGEVersionClass") or {}).get("PGEVersion", "?")] += 1
            for r in u.get("RelatedUrls", []):
                url = r["URL"]
                if url.endswith(g + ".h5"):
                    pref[url[: url.index(g)]] += 1
    print(f"== {n}")
    for k, v in pref.most_common():
        print(f"   {v:4d}  {k}")
    print("   CRIDs:", dict(crid.most_common()), "| PGE:", dict(pge.most_common()))
````


## B.5 Specification and research helpers

**scripts/spec_xml_dump.py**  
Source: `<scratch>/verify/cookbook/scripts/spec_xml_dump.py`

````python
#!/usr/bin/env python3
"""Dump dataset definitions from a NISAR product-spec XML (isce3 / nisarqa format).
Usage: python3 -I spec_xml_dump.py <xml> [path-substring] [--desc]
Prints: path | hdf5-ish dtype | shape | units | _FillValue | other attrs [| description]
"""
import sys, xml.etree.ElementTree as ET
xml = sys.argv[1]
flt = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else ""
want_desc = "--desc" in sys.argv
root = ET.parse(xml).getroot()
skip = {"app", "lang", "DIMENSION_LIST", "REFERENCE_LIST", "CLASS", "NAME", "mean_value", "min_value", "max_value",
        "sample_stddev", "mean_real_value", "min_real_value", "max_real_value", "sample_stddev_real",
        "mean_imag_value", "min_imag_value", "max_imag_value", "sample_stddev_imag", "units", "_FillValue",
        "grid_mapping", "long_name", "standard_name"}
rows = []
for nodes in root.iter("nodes"):
    for el in nodes:
        name = el.get("name")
        if name is None or flt not in name:
            continue
        tag = el.tag
        w = el.get("width", "")
        if tag == "real":
            dt = f"float{w}"
        elif tag == "integer":
            dt = ("int" if el.get("signed", "true") == "true" else "uint") + w
        elif tag == "complex":
            dt = f"complex{2*int(w) if w else ''}(2x float{w})"
        elif tag == "string":
            dt = "string"
        else:
            dt = tag
        ann = el.find("annotation")
        a = dict(ann.attrib) if ann is not None else {}
        desc = (ann.text or "").strip() if ann is not None else ""
        other = {k: v for k, v in a.items() if k not in skip}
        rows.append((name, dt, el.get("shape", ""), a.get("units", ""), a.get("_FillValue", ""), other, desc))
for name, dt, shape, units, fill, other, desc in rows:
    line = f"{name} | {dt} | {shape} | units={units or '-'} | fill={fill or '-'}"
    if other:
        line += " | " + "; ".join(f"{k}={v[:60]}" for k, v in other.items())
    if want_desc:
        line += f" | {desc}"
    print(line)
print(f"# {len(rows)} nodes matched '{flt}' in {xml}", file=sys.stderr)
````

**scripts/spec_xml_diff.py**  
Source: `<scratch>/verify/cookbook/scripts/spec_xml_diff.py`

````python
#!/usr/bin/env python3
"""Diff NISAR product-spec XML versions (nisarqa/src/nisarqa/product_specs/<ver>/nisar_L2_<PROD>.xml).
Reports datasets added / removed / changed (dtype, shape, units, _FillValue) between consecutive versions.
Usage: python3 -I spec_xml_diff.py <product_specs_dir> <PROD> [path-substring]
"""
import sys, pathlib, xml.etree.ElementTree as ET
root_dir = pathlib.Path(sys.argv[1]); prod = sys.argv[2]
flt = sys.argv[3] if len(sys.argv) > 3 else ""

def load(xml):
    out = {}
    r = ET.parse(xml).getroot()
    for nodes in r.iter("nodes"):
        for el in nodes:
            name = el.get("name")
            if not name or flt not in name:
                continue
            w = el.get("width", "")
            tag = el.tag
            if tag == "real": dt = f"float{w}"
            elif tag == "integer": dt = ("int" if el.get("signed", "true") == "true" else "uint") + w
            elif tag == "complex": dt = f"complex(2x float{w})"
            else: dt = tag
            ann = el.find("annotation")
            a = dict(ann.attrib) if ann is not None else {}
            out[name] = (dt, el.get("shape", ""), a.get("units", ""), a.get("_FillValue", ""))
    return out

def vkey(p): return tuple(int(x) for x in p.name.split("."))
vers = sorted([p for p in root_dir.iterdir() if p.is_dir()], key=vkey)
prev = None
for v in vers:
    f = v / f"nisar_{'L3' if prod == 'SME2' else 'L2'}_{prod}.xml"
    if not f.exists():
        print(f"== {v.name}: no {f.name}"); continue
    cur = load(f)
    if prev is None:
        print(f"== {v.name}: {len(cur)} datasets (baseline)")
    else:
        add = sorted(set(cur) - set(prev[1])); rem = sorted(set(prev[1]) - set(cur))
        chg = sorted(k for k in set(cur) & set(prev[1]) if cur[k] != prev[1][k])
        print(f"== {prev[0]} -> {v.name}: {len(cur)} datasets | +{len(add)} -{len(rem)} ~{len(chg)}")
        for k in add: print(f"   + {k}  {cur[k]}")
        for k in rem: print(f"   - {k}  {prev[1][k]}")
        for k in chg: print(f"   ~ {k}  {prev[1][k]} -> {cur[k]}")
    prev = (v.name, cur)
````

**scripts/fetch_specs.sh**  
Source: `<scratch>/verify/cookbook/scripts/fetch_specs.sh`

````sh
#!/bin/sh
# Download the NISAR product specification PDFs linked from the NISAR Data User Guide (no login).
# Usage: sh fetch_specs.sh <outdir>
UA="nisar-verify/1.0 (generic research client)"
out="$1"
for u in \
 "https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf" \
 "https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102269_RevF_NASA_SDS_Product_Specification_L2_GSLC_w-esigs.pdf" \
 "https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-102272_RevE_NASA_SDS_Product_Specification_L2_GUNW_Nov8_2024_w-sigs.pdf" \
 "https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-105010_RevC_NASA_SDS_Product_Specification_L2_GOFF_Nov8_2024_w-sigs.pdf" \
 "https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-107677_RevC_NASA_SDS_Product_Specification_L3_SME2_Nov8_2024_w-sigs.pdf" \
 "https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-102274_RevE_NASA_SDS_Product_Specification_L2_GCOV_Nov8_2024_w-sigs.pdf"
do
  f="$out/$(basename "$u")"
  curl -s -L -A "$UA" --max-time 300 -o "$f" -w "%{http_code} %{size_download} bytes %{content_type} <- $u\n" "$u"
done
````

**scripts/isce3_tag_specver.sh**  
Source: `<scratch>/verify/cookbook/scripts/isce3_tag_specver.sh`

````sh
#!/bin/sh
# For isce3 release tags, print the product specification version the InSAR writers stamp into products
# and whether the GUNW writer defines validDataMask / uint32 masks. Public GitHub raw files, no login.
# Usage: sh isce3_tag_specver.sh <outdir>
UA="nisar-verify/1.0 (generic research client)"
out="$1"
for t in v0.24.1 v0.24.6 v0.25.8 v0.25.14 v0.25.16 v0.25.18 v0.25.20 v0.25.22 v0.25.23; do
  base="https://raw.githubusercontent.com/isce-framework/isce3/$t/python/packages/nisar/products"
  curl -s -A "$UA" --max-time 60 -o "$out/${t}__InSAR_products_info.py" "$base/insar/InSAR_products_info.py"
  curl -s -A "$UA" --max-time 60 -o "$out/${t}__GUNW_writer.py" "$base/insar/GUNW_writer.py"
  curl -s -A "$UA" --max-time 60 -o "$out/${t}__GcovWriter.py" "$base/writers/GcovWriter.py"
  sv=$(grep -m1 -E "^PRODUCT_SPECIFICATION_VERSION" "$out/${t}__InSAR_products_info.py" | tr -d ' ')
  vdm=$(grep -c "validDataMask" "$out/${t}__GUNW_writer.py")
  m32=$(grep -c "np.uint32," "$out/${t}__GUNW_writer.py")
  idem=$(grep -c "inputDataExceptionMask" "$out/${t}__GcovWriter.py")
  echo "$t  insar:$sv  GUNW validDataMask-mentions=$vdm  GUNW np.uint32-mentions=$m32  GCOV inputDataExceptionMask-mentions=$idem"
done
````

**scripts/nb2txt.py**  
Source: `<scratch>/verify/cookbook/scripts/nb2txt.py`

````python
#!/usr/bin/env python3
"""Dump Jupyter notebooks to plain text (markdown + code + text outputs), no execution.
Usage: python3 -I nb2txt.py <notebook_dir> <out_dir>
"""
import json, sys, os, pathlib

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for nb in sorted(src.rglob("*.ipynb")):
    try:
        d = json.loads(nb.read_text(encoding="utf-8"))
    except Exception as e:
        print("FAILED", nb, e)
        continue
    lines = []
    for i, c in enumerate(d.get("cells", [])):
        ct = c.get("cell_type")
        s = "".join(c.get("source", []))
        lines.append(f"\n#%% [{ct}] cell {i}\n")
        lines.append(s)
        if ct == "code":
            for o in c.get("outputs", []):
                ot = o.get("output_type")
                txt = ""
                if ot == "stream":
                    txt = "".join(o.get("text", []))
                elif ot in ("execute_result", "display_data"):
                    dd = o.get("data", {})
                    if "text/plain" in dd:
                        txt = "".join(dd["text/plain"])
                elif ot == "error":
                    txt = o.get("ename", "") + ": " + o.get("evalue", "")
                if txt:
                    if len(txt) > 6000:
                        txt = txt[:6000] + "\n...[truncated]"
                    lines.append("\n#>>> OUTPUT (" + str(ot) + "):\n" + "\n".join("#> " + l for l in txt.splitlines()))
    rel = nb.relative_to(src)
    op = out / (str(rel).replace("/", "__") + ".txt")
    op.write_text("\n".join(lines), encoding="utf-8")
    print(op.name, len(d.get("cells", [])), "cells", sum(len(l) for l in lines), "chars")
````

**scripts/pdf2txt.py**  
Source: `<scratch>/verify/cookbook/scripts/pdf2txt.py`

````python
#!/usr/bin/env python3
"""Extract text from PDFs with pypdf, one text file per PDF, with page markers.
Usage: python -I pdf2txt.py <pdf_dir> <out_dir>
"""
import sys, pathlib
from pypdf import PdfReader
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for pdf in sorted(src.glob("*.pdf")):
    r = PdfReader(str(pdf))
    parts = []
    for i, page in enumerate(r.pages, 1):
        try:
            t = page.extract_text() or ""
        except Exception as e:
            t = f"<<extract failed: {e}>>"
        parts.append(f"\n\n===== PAGE {i} =====\n{t}")
    (out / (pdf.stem + ".txt")).write_text("".join(parts), encoding="utf-8")
    meta = r.metadata or {}
    print(pdf.name, "| pages:", len(r.pages), "| title:", meta.get("/Title"), "| created:", meta.get("/CreationDate"), "| mod:", meta.get("/ModDate"))
````

**scripts/pixi_lock_versions.py**  
Source: `<scratch>/verify/cookbook/scripts/pixi_lock_versions.py`

````python
#!/usr/bin/env python3
"""Extract pinned versions of key packages from the cookbook's pixi.lock.
Usage: python3 -I pixi_lock_versions.py <pixi.lock> [env] [platform]
No YAML dependency: regex over conda URLs / pypi entries.
"""
import re, sys, collections
path = sys.argv[1]
env = sys.argv[2] if len(sys.argv) > 2 else "isce3"
plat = sys.argv[3] if len(sys.argv) > 3 else "linux-64"
text = open(path, encoding="utf-8").read()

# split environments section
m = re.search(r"^environments:\n(.*?)^packages:\n", text, re.S | re.M)
envs = m.group(1)
# find env block
blocks = re.split(r"^  (\S+):\n", envs, flags=re.M)
envmap = {}
for i in range(1, len(blocks), 2):
    envmap[blocks[i]] = blocks[i + 1]
print("environments in lock:", list(envmap))
blk = envmap[env]
# platform sub-blocks
pm = re.split(r"^      (\S+):\n", blk, flags=re.M)
platmap = {}
for i in range(1, len(pm), 2):
    platmap[pm[i]] = pm[i + 1]
print("platforms for", env, ":", list(platmap))
entries = platmap[plat]
conda = re.findall(r"- conda: (\S+)", entries)
pypi = re.findall(r"- pypi: (\S+)", entries)
print(len(conda), "conda pkgs;", len(pypi), "pypi pkgs")
want = ["python", "isce3", "gdal", "libgdal", "libgdal-core", "libgdal-hdf5", "libgdal-netcdf", "hdf5", "h5py", "h5netcdf", "netcdf4", "libnetcdf",
        "xarray", "rioxarray", "rasterio", "asf_search", "earthaccess", "zarr", "dask", "dask-core", "numpy",
        "fsspec", "s3fs", "aiohttp", "pyproj", "proj", "shapely", "folium", "ipyleaflet", "contextily", "cartopy", "pandas",
        "matplotlib-base", "numcodecs", "kerchunk", "virtualizarr", "harmony-py", "geopandas", "scipy", "pqdm", "tenacity", "python-cmr", "boto3", "botocore", "aiobotocore", "pystac", "pystac-client", "odc-stac", "stackstac", "h5coro", "icechunk"]
found = collections.OrderedDict()
for url in conda:
    fn = url.rsplit("/", 1)[-1]
    mm = re.match(r"(.+)-([^-]+)-([^-]+)\.(?:conda|tar\.bz2)$", fn)
    if not mm:
        continue
    name, ver, build = mm.groups()
    if name in want:
        found[name] = (ver, build)
for n in want:
    if n in found:
        print(f"  conda {n:18s} {found[n][0]:14s} {found[n][1]}")
print("pypi entries:")
for p in pypi:
    print("  ", p)
````


---

# Part C. Decisive outputs, verbatim

Logs written by attempt 3 on 2026-11-14 between 07:49 and 08:00 UTC unless noted.


## C.1 Environment

**notes/venv_versions.log**  
Source: `<scratch>/verify/cookbook/notes/venv_versions.log`

````
python 3.12.2 macOS-26.6.2-arm64-arm-64bit
h5py 3.16.0 HDF5 lib 2.0.0
numpy 2.5.4
xarray 2026.9.0
h5netcdf 1.8.3
fsspec 2026.9.0
aiohttp 3.14.5
rasterio 1.5.2
rioxarray 0.23.0
pyproj 3.8.0
dask 2026.8.0
shapely 2.2.0
asf_search 14.1.0
earthaccess 0.19.0
s3fs 2026.9.0
rasterio GDAL 3.12.2
  driver HDF5 -> Hierarchical Data Format Release 5
  driver netCDF -> Network Common Data Format
  driver HDF5Image -> HDF5 Dataset
  driver BAG -> Bathymetry Attributed Grid
  driver GTiff -> GeoTIFF
  driver COG -> Cloud optimized GeoTIFF generator
  driver Zarr -> Zarr
  driver NISAR -> None
  driver VRT -> Virtual Raster
````


## C.2 Local GCOV read test

**notes/test_local_gcov.log**  
Source: `<scratch>/verify/cookbook/notes/test_local_gcov.log`

````
files: ['NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5', 'NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5']

[1] h5py + rasterio.from_origin (idiom of notebooks/Opening_HDF5_Python.ipynb)
  HHHH (6220, 4545) float32 chunks (512, 512) _FillValue nan units 1
  x[0], x[1], x[-1] = 365490.0 365510.0 456370.0 | y[0], y[1], y[-1] = 3913610.0 3913590.0 3789230.0
  dx, dy = 20.0 -20.0 | projection value 32611 uint32 | attrs['epsg_code'] 32611
  np.diff(x) unique: [20.] np.diff(y) unique: [-20.]
  mask dtype uint8 unique values: (array([  0, 255], dtype=uint8), array([17004130, 11265770]))
  NaN fraction in HHHH: 0.39902772913947343 | HHHH==0 count: 0 | min>0: 0.0002074260264635086 max: 2509.28125
  NaN where mask==255: 1.0 | NaN where mask!=255: 0.0008647310976803871
  GeoTIFF CRS: EPSG:32611 res: (20.0, 20.0) bounds: BoundingBox(left=365480.0, bottom=3789220.0, right=456380.0, top=3913620.0)
  pixel-centre of (row0,col0) from transform: (np.float64(365490.0), np.float64(3913610.0)) vs xCoordinates[0], yCoordinates[0]: (np.float64(365490.0), np.float64(3913610.0))

[2] xarray DataTree (idiom of notebooks/search_stream_NISAR_asf_search.ipynb), local file
  data_vars: {'HHHH': ('float32', (6220, 4545)), 'listOfCovarianceTerms': ('|S4', (1,)), 'listOfPolarizations': ('|S2', (1,)), 'mask': ('float32', (6220, 4545)), 'numberOfLooks': ('float32', (6220, 4545)), 'numberOfSubSwaths': ('uint8', ()), 'projection': ('uint32', ()), 'rtcGammaToSigmaFactor': ('float32', (6220, 4545)), 'xCoordinateSpacing': ('float64', ()), 'yCoordinateSpacing': ('float64', ())}
  coords: ['xCoordinates', 'yCoordinates']
  tree.projection.attrs['epsg_code'].item() = 32611 | tree.projection.item() = 32611
  rio.crs: EPSG:32611 | rio.transform(): (20.0, 0.0, 365480.0, 0.0, -20.0, 3913620.0) | rio.bounds(): (365480.0, 3789220.0, 456380.0, 3913620.0)
  clip_box lon/lat {'minx': -118.0237, 'miny': 34.751, 'maxx': -117.9237, 'maxy': 34.851} -> (560, 464) mean power: 0.030626961961388588
  dB stats: min -27.75 mean -16.10 max 11.82
  mask via xarray dtype: float32 (file dtype uint8; CF _FillValue decoding promotes it) unique: [0.]
  mask with mask_and_scale=False dtype: uint8

[3] cookbook util/load_gcov.py load_gcov_ts_xr on both dates
  dims: {'time': 2, 'frequency': 1, 'y': 6220, 'x': 4545} | vars: ['HHHH', 'mask', 'numberOfLooks', 'rtcGammaToSigmaFactor', 'identification'] | crs: EPSG:32611 | time: ['2008-10-12T06:09:11' '2008-11-27T06:10:00']
  mean gamma0 power per date: [0.05983698 0.1391174 ] -> dB: [-12.230303  -8.566185]

[4] pair-wise log-ratio change (idiom of NISAR_GCOV_SARChangeDetectionMethods.ipynb)
  log-ratio dB: n=16948207 p01=-2.32 p50=3.95 p99=9.74 | frac < -2 dB: 0.0130 | frac > +2 dB: 0.7833
  rtcGammaToSigmaFactor stats (sample file): min 0.0013 mean 0.0174 max 0.0214
  numberOfLooks stats: min 0.002 mean 7.891 max 40.249
````


## C.3 HTTPS streaming test (attempt 3 run)

**notes/test_stream_https.log**  
Source: `<scratch>/verify/cookbook/notes/test_stream_https.log`

````
fsspec 2026.9.0 | xarray 2026.9.0 | h5py 3.16.0 HDF5 2.0.0 | h5py drivers: ['core', 'family', 'fileobj', 'mpio', 'sec2', 'split', 'stdio']
A cookbook: group only, background 8MiB (fs-level kwargs)   : open   4.3s | read 512x512   1.4s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=76 misses=5 requested_bytes=41943040
B cookbook kwargs at open(): background 8MiB, group only     : open   4.0s | read 512x512   1.5s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=76 misses=5 requested_bytes=41943040
C docs: background 16MiB at open(), group only               : open   5.4s | read 512x512   0.0s | mean=0.02942 | cache=BackgroundBlockCache blocksize=16777216 hits=76 misses=4 requested_bytes=67108864
D fsspec defaults (no cache_type/block_size), group only     : open  24.7s | read 512x512   1.2s | mean=0.02942 | cache=BytesCache blocksize=5242880 hits=55 misses=21 requested_bytes=110739744
E whole tree (no group=), background 8MiB at open()          : open  12.1s | read 512x512   1.3s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=500 misses=13 requested_bytes=109051904
F h5py direct, background 8MiB at open()                     : open   2.0s | read 512x512   3.5s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=36 misses=5 requested_bytes=41943040
G h5py direct, blockcache 4MiB (= file page size)            : open   1.7s | read 512x512   2.1s | mean=0.02942 | cache=BlockCache blocksize=4194304 hits=36 misses=3 requested_bytes=12582912
H h5py direct + page_buf_size=16MiB, background 8MiB         : open   2.0s | read 512x512   4.2s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=6 misses=6 requested_bytes=50331648
````

Attempt 2 ran the same script at 03:07 UTC (from the transcript, tool call 120 of `agent-a91301b9806b1c8fb.jsonl`):

````
A cookbook: group only, background 8MiB (fs-level kwargs)   : open   4.5s | read 512x512   1.5s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=76 misses=5 requested_bytes=41943040
B cookbook kwargs at open(): background 8MiB, group only     : open   3.7s | read 512x512   1.5s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=76 misses=4 requested_bytes=33554432
C docs: background 16MiB at open(), group only               : open   6.0s | read 512x512   0.0s | mean=0.02942 | cache=BackgroundBlockCache blocksize=16777216 hits=76 misses=4 requested_bytes=67108864
D fsspec defaults (no cache_type/block_size), group only     : open  28.4s | read 512x512   1.3s | mean=0.02942 | cache=BytesCache blocksize=5242880 hits=55 misses=21 requested_bytes=110739744
E whole tree (no group=), background 8MiB at open()          : open  13.2s | read 512x512   1.9s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=500 misses=13 requested_bytes=109051904
F h5py direct, background 8MiB at open()                     : open   2.0s | read 512x512   3.6s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=36 misses=5 requested_bytes=41943040
G h5py direct, blockcache 4MiB (= file page size)            : open   2.0s | read 512x512   2.6s | mean=0.02942 | cache=BlockCache blocksize=4194304 hits=36 misses=3 requested_bytes=12582912
H h5py direct + page_buf_size=16MiB, background 8MiB         : open   2.0s | read 512x512   4.4s | mean=0.02942 | cache=BackgroundBlockCache blocksize=8388608 hits=6 misses=6 requested_bytes=50331648
````


## C.4 GDAL tests

**notes/test_gdal_open.log**  
Source: `<scratch>/verify/cookbook/notes/test_gdal_open.log`

````
rasterio 1.5.2 GDAL 3.12.2
GCOV HHHH                  NETCDF driver=netCDF    dtype=float32   size=4545x6220 crs=32611 origin=(365480.0, 3913620.0) res=(20.0, -20.0) nodata=nan
GCOV HHHH                  HDF5   driver=HDF5Image dtype=float32   size=4545x6220 crs=None origin=(0.0, 0.0) res=(1.0, 1.0) nodata=nan
GCOV mask                  NETCDF driver=netCDF    dtype=uint8     size=4545x6220 crs=32611 origin=(365480.0, 3913620.0) res=(20.0, -20.0) nodata=255.0
GCOV mask                  HDF5   driver=HDF5Image dtype=uint8     size=4545x6220 crs=None origin=(0.0, 0.0) res=(1.0, 1.0) nodata=255.0
GUNW unwrappedPhase        NETCDF driver=netCDF    dtype=float32   size=1136x1555 crs=32611 origin=(365480.0, 3913620.0) res=(80.0, -80.0) nodata=nan
GUNW unwrappedPhase        HDF5   driver=HDF5Image dtype=float32   size=1136x1555 crs=None origin=(0.0, 0.0) res=(1.0, 1.0) nodata=nan
GUNW wrappedInterferogram  NETCDF driver=netCDF    dtype=complex64 size=4545x6220 crs=32611 origin=(365480.0, 3913620.0) res=(20.0, -20.0) nodata=0.0
GUNW wrappedInterferogram  HDF5   driver=HDF5Image dtype=complex64 size=4545x6220 crs=None origin=(0.0, 0.0) res=(1.0, 1.0) nodata=None
SME2 soilMoisture          NETCDF driver=netCDF    dtype=float32   size=450x405 crs=6933 origin=(-8755829.697491556, 4332874.554417018) res=(200.17900466991128, -200.179004669911) nodata=-9999.0
SME2 soilMoisture          HDF5   driver=HDF5Image dtype=float32   size=450x405 crs=None origin=(0.0, 0.0) res=(1.0, 1.0) nodata=-9999.0

open(plain) driver=HDF5 subdatasets=21; first 3:
    HDF5:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5"://science/LSAR/GCOV/grids/frequencyA/HHHH
    HDF5:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5"://science/LSAR/GCOV/metadata/orbit/velocity
    HDF5:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5"://science/LSAR/GCOV/metadata/processingInformation/parameters/frequencyA/dopplerCentroid

open(NETCDF:) driver=netCDF subdatasets=21; first 3:
    netcdf:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5":/science/LSAR/GCOV/grids/frequencyA/HHHH
    netcdf:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5":/science/LSAR/GCOV/metadata/orbit/velocity
    netcdf:"NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5":/science/LSAR/GCOV/metadata/processingInformation/parameters/frequencyA/dopplerCentroid
````

**notes/test_gdal_vsicurl.log**  
Source: `<scratch>/verify/cookbook/notes/test_gdal_vsicurl.log`

````
macOS-26.6.2-arm64-arm-64bit | rasterio 1.5.2 GDAL 3.12.2
NETCDF+vsicurl: FAILED after 2.1s: RasterioIOError: Opening a /vsi file with the netCDF driver requires Linux userfaultfd to be available. Or you may set the GDAL_SKIP=netCDF configuration option to force the use of the HDF5 driver.
HDF5+vsicurl: OK driver=HDF5Image crs=None origin=(0.0,0.0) open 2.1s read512x512 0.7s mean=0.02942
````


## C.5 Login boundary and browse

**notes/login_boundary.log**  
Source: `<scratch>/verify/cookbook/notes/login_boundary.log`

````
== https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T23
HTTP/2 302 
content-type: application/json
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
== https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GUNW_PROVISIONAL_V1/NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001/NISAR_L2_PR_GUNW_032_139_D
HTTP/2 302 
content-type: application/json
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
== https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T23
HTTP/2 302 
content-type: application/json
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
== https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T2
HTTP/2 404 
content-type: text/html
== https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_V1/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T2
HTTP/2 404 
content-type: text/html
== https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GUNW_PROVISIONAL_V1/NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001/NISAR_L2_PR_GUNW_032_139_
HTTP/2 404 
content-type: text/html
== https://nisar.asf.earthdatacloud.nasa.gov/s3credentials
HTTP/2 302 
content-type: application/json
location: https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/login&state=...&app_type=401
== https://nisar.asf.earthdatacloud.nasa.gov/s3credentialsREADME
HTTP/2 200 
content-type: text/html
== https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T06
HTTP/2 303 
content-type: application/json
location: https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-sample-data.s3.us-west-2.amazonaws.com/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_2008
````

**notes/browse_public_check.log**  
Source: `<scratch>/verify/cookbook/notes/browse_public_check.log`

````
303 0B application/json redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISA
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.png
303 0B application/json redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISA
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON_thumbnail.png
303 0B application/json redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISA
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_NATIVE.png
303 0B application/json redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISA
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.kml
303 0B application/json redirect=https://d1mv8zhcvry6x4.cloudfront.net/s3-7fdfbcb0ce308dc58d08f97acb1f0590/sds-n-cumulus-prod-nisar-browse.s3.us-west-2.amazonaws.com/NISA
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_NATIVE.kml
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001.h5.iso.xml
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001.rc.yaml
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_QA_SUMMARY.csv
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_QA_REPORT.pdf
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_QA_STATS.h5
302 0B application/json redirect=https://urs.earthdata.nasa.gov/oauth/authorize?client_id=...&response_type=code&redirect_uri=https://nisar.asf.earthdatacloud.nasa.gov/lo
    <- NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001.h5
````

**notes/browse_fetch.log**  
Source: `<scratch>/verify/cookbook/notes/browse_fetch.log`

````
200 712543B binary/octet-stream  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.png
200 4186B binary/octet-stream  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON_thumbnail.png
200 806921B binary/octet-stream  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_NATIVE.png
200 571B binary/octet-stream  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.kml
200 569B binary/octet-stream  NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_NATIVE.kml
200 4370163B binary/octet-stream  NISAR_L2_PR_GCOV_024_026_A_016_4005_DHDH_A_20260627T234740_20260627T234815_P05023_N_F_J_001_LATLON.png
404 244697B text/html  NISAR_L2_PR_GCOV_024_026_A_016_4005_DHDH_A_20260627T234740_20260627T234815_P05023_N_F_J_001_LATLON.kml
404 244697B text/html  NISAR_L2_PR_GCOV_024_026_A_016_4005_DHDH_A_20260627T234740_20260627T234815_P05023_N_F_J_001.png
404 244697B text/html  NISAR_L2_PR_GCOV_024_026_A_016_4005_DHDH_A_20260627T234740_20260627T234815_P05023_N_F_J_001.kml
````

Attempt 2, tool call 116 (provisional granule `NISAR_L2_PR_GCOV_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001`, and the validated KML), from the transcript:

````
200 556229 binary/octet-stream  _LATLON.png
200 2316 binary/octet-stream  _LATLON_thumbnail.png
200 213424 binary/octet-stream  _NATIVE_A_HHHH.png
401 27 text/html; charset=utf-8  _LATLON.kml (via /NISAR/ path)
200 571 binary/octet-stream  validated _LATLON.kml (via /BROWSE/)
png:           PNG image data, 1965 x 1927, 8-bit/color RGB, non-interlaced
thumbnail.png: PNG image data, 100 x 100, 8-bit/color RGB, non-interlaced
A_HHHH.png:    PNG image data, 1965 x 1914, 8-bit grayscale, non-interlaced
````

**Public KML of a validated GCOV granule (571 bytes)**  
Source: `<scratch>/verify/cookbook/downloads/browse_recheck/NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.kml`

````xml
<kml xmlns:ns0="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>overlay image</name>
    <GroundOverlay>
      <name>overlay image</name>
      <Icon>
        <href>NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001_LATLON.png</href>
      </Icon>
      <ns0:LatLonQuad>
        <coordinates>86.77891292749354,15.284124972932167 90.01353237866624,15.284124972932167 90.01353237866624,18.337446546458843 86.77891292749354,18.337446546458843</coordinates>
      </ns0:LatLonQuad>
    </GroundOverlay>
  </Document>
</kml>
````


## C.6 Sample files: sizes, download log, URL list

The download log is from attempt 2 (about 03:00 UTC); the sizes and URL list were regenerated by attempt 3.

**notes/download_samples.log**  
Source: `<scratch>/verify/cookbook/notes/download_samples.log`

````
200 171966464 bytes 12.892212s 13338786 B/s  NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
200 171966464 bytes 14.178028s 12129081 B/s  NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
200 104857600 bytes 7.730464s 13564205 B/s  NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
200 264241152 bytes 20.331149s 12996862 B/s  NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
200 7340032 bytes 1.522753s 4820238 B/s  NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001.h5
````

**notes/sample_sizes.log**  
Source: `<scratch>/verify/cookbook/notes/sample_sizes.log`

````
     171966464  NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
         38649  NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
     171966464  NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
         38662  NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
     104857600  NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
        190094  NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
     562036736  NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
         43128  NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
     562036736  NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
         43141  NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
     264241152  NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
        136759  NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
     117440512  NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
         87416  NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
      60817408  NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
        190094  NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
     503316480  NISAR_L1_PR_RSLC_001_030_A_019_2000_SHNA_A_20081012T060910_20081012T060926_D00402_N_F_J_001.h5
       2180572  NISAR_L1_PR_RSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
     541065216  NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
       2180617  NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
       7340032  NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001.h5
          5432  NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001_QA_STATS.h5
````

**notes/sample_h5_urls.txt**  
Source: `<scratch>/verify/cookbook/notes/sample_h5_urls.txt`

````
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GCOV/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GCOV_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GOFF/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GOFF/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GOFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GSLC/NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GSLC/NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L2_PR_GSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GSLC/NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GSLC/NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GUNW/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/GUNW/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RIFG/NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RIFG/NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_RIFG_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/ROFF/NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/ROFF/NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_ROFF_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RSLC/NISAR_L1_PR_RSLC_001_030_A_019_2000_SHNA_A_20081012T060910_20081012T060926_D00402_N_F_J_001/NISAR_L1_PR_RSLC_001_030_A_019_2000_SHNA_A_20081012T060910_20081012T060926_D00402_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RSLC/NISAR_L1_PR_RSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001/NISAR_L1_PR_RSLC_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RSLC/NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/RSLC/NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001/NISAR_L1_PR_RSLC_002_030_A_019_2800_SHNA_A_20081127T061000_20081127T061014_D00404_N_F_J_001_QA_STATS.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/SME2/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001.h5
https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/SME2/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001/NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001_QA_STATS.h5
````


## C.7 Sample file trees (grids and identification; full trees are in `$CB/notes/h5_*_sample_tree.log`)

**GCOV sample: header, frequencyA grid, processing flags, identification (selected lines)**  
Source: `<scratch>/verify/cookbook/notes/h5_GCOV_sample_tree.log`

````
FILE: NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001.h5
  size bytes: 171966464 | libver: ('earliest', 'v200') | userblock: 0
  file_space_strategy: PAGE (1, 0, 1) | file_space_page_size: 4194304
  root attrs: {'Conventions': 'CF-1.7', 'contact': 'nisar-sds-ops@jpl.nasa.gov', 'institution': 'NASA JPL', 'mission_name': 'NISAR', 'reference_document': 'D-102274 NISAR NASA SDS Product Specification Level-2 Geocoded Polarimetric Covariance L2 GCOV', 'title' ...[line cut]
G /science/
G /science/LSAR/
G /science/LSAR/GCOV/
G /science/LSAR/GCOV/grids/
G /science/LSAR/GCOV/grids/frequencyA/
D /science/LSAR/GCOV/grids/frequencyA/HHHH | float32 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.float32(nan) | units=1
D /science/LSAR/GCOV/grids/frequencyA/listOfCovarianceTerms | |S4 | (1,) | chunks=None | nofilter | fill=None | units=- = ['HHHH']
D /science/LSAR/GCOV/grids/frequencyA/listOfPolarizations | |S2 | (1,) | chunks=None | nofilter | fill=None | units=- = ['HH']
D /science/LSAR/GCOV/grids/frequencyA/mask | uint8 | (6220, 4545) | chunks=(512, 512) | gzip9 | fill=np.int64(255) | units=-
D /science/LSAR/GCOV/grids/frequencyA/numberOfLooks | float32 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.float32(nan) | units=1
D /science/LSAR/GCOV/grids/frequencyA/numberOfSubSwaths | uint8 | () | chunks=None | nofilter | fill=None | units=1 = np.uint8(1)
D /science/LSAR/GCOV/grids/frequencyA/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor | float32 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.float32(nan) | units=1
D /science/LSAR/GCOV/grids/frequencyA/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(20.0)
D /science/LSAR/GCOV/grids/frequencyA/xCoordinates | float64 | (4545,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GCOV/grids/frequencyA/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-20.0)
D /science/LSAR/GCOV/grids/frequencyA/yCoordinates | float64 | (6220,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GCOV/metadata/processingInformation/parameters/isFullCovariance | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/noiseCorrectionApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/polarimetricSymmetrizationApplied | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'True'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/polarizationOrientationCorrectionApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/postProcessingFilteringApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
G /science/LSAR/GCOV/metadata/processingInformation/parameters/preprocessing/
G /science/LSAR/GCOV/metadata/processingInformation/parameters/preprocessing/frequencyA/
D /science/LSAR/GCOV/metadata/processingInformation/parameters/preprocessing/frequencyA/numberOfAzimuthLooks | uint64 | () | chunks=None | nofilter | fill=None | units=1 = np.uint64(1)
D /science/LSAR/GCOV/metadata/processingInformation/parameters/preprocessing/frequencyA/numberOfRangeLooks | uint64 | () | chunks=None | nofilter | fill=None | units=1 = np.uint64(1)
D /science/LSAR/GCOV/metadata/processingInformation/parameters/preprocessingMultilookingApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/radiometricTerrainCorrectionApplied | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'True'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rangeIonosphericGeolocationCorrectionApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rfiMitigationApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
G /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/geogridUpsampling | float64 | () | chunks=None | nofilter | fill=None | units=1 = np.float64(2.0)
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/inputBackscatterNormalizationConvention | |S6 | () | chunks=None | nofilter | fill=None | units=- = 'sigma0'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/memoryMode | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'auto'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/minRtcAreaNormalizationFactorInDB | float64 | () | chunks=None | nofilter | fill=None | units=1 = np.float64(-30.0)
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/outputBackscatterExpressionConvention | |S12 | () | chunks=None | nofilter | fill=None | units=- = 'Linear power'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/rtc/outputBackscatterNormalizationConvention | |S6 | () | chunks=None | nofilter | fill=None | units=- = 'gamma0'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/runConfigurationContents | |S17737 | () | chunks=None | nofilter | fill=None | units=- = 'runconfig:\n    name: gcov_workflow_default\n\n    groups:\n        pge_name_group:\n            pge_name:  ...[line cut]
D /science/LSAR/GCOV/metadata/processingInformation/parameters/shadowMaskingApplied | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'True'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/validSamplesSubSwathMaskingApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/GCOV/metadata/processingInformation/parameters/wetTroposphericGeolocationCorrectionApplied | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
G /science/LSAR/identification/
D /science/LSAR/identification/absoluteOrbitNumber | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(0)
D /science/LSAR/identification/boundingPolygon | |S2120 | () | chunks=None | nofilter | fill=None | units=- = 'POLYGON ((-118.229299403331 34.3206258749987 1320.76281740076,-118.151534082954 34.3338786942818 1120.77187097282,-118.060028397752 34.3
D /science/LSAR/identification/compositeReleaseId | |S6 | () | chunks=None | nofilter | fill=None | units=- = 'D00404'
D /science/LSAR/identification/diagnosticModeFlag | uint8 | () | chunks=None | nofilter | fill=None | units=- = np.uint8(0)
D /science/LSAR/identification/frameNumber | uint16 | () | chunks=None | nofilter | fill=None | units=- = np.uint16(19)
D /science/LSAR/identification/granuleId | |S91 | () | chunks=None | nofilter | fill=None | units=- = 'NISAR_L2_PR_GCOV_001_030_A_019_2800_SHNA_A_20081012T060911_20081012T060925_D00404_N_F_J_001'
D /science/LSAR/identification/instrumentName | |S6 | () | chunks=None | nofilter | fill=None | units=- = 'PALSAR'
D /science/LSAR/identification/isDithered | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/identification/isFullFrame | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'True'
D /science/LSAR/identification/isGeocoded | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'True'
D /science/LSAR/identification/isJointObservation | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/identification/isMixedMode | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/identification/isUrgentObservation | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'False'
D /science/LSAR/identification/listOfFrequencies | |S1 | (1,) | chunks=None | nofilter | fill=None | units=- = ['A']
D /science/LSAR/identification/lookDirection | |S5 | () | chunks=None | nofilter | fill=None | units=- = 'Right'
D /science/LSAR/identification/missionId | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'ALOS'
D /science/LSAR/identification/orbitPassDirection | |S9 | () | chunks=None | nofilter | fill=None | units=- = 'Ascending'
D /science/LSAR/identification/plannedDatatakeId | |S1 | (1,) | chunks=None | nofilter | fill=None | units=- = ['0']
D /science/LSAR/identification/plannedObservationId | |S1 | (1,) | chunks=None | nofilter | fill=None | units=- = ['0']
D /science/LSAR/identification/platformName | |S15 | () | chunks=None | nofilter | fill=None | units=- = '(NOT SPECIFIED)'
D /science/LSAR/identification/processingCenter | |S3 | () | chunks=None | nofilter | fill=None | units=- = 'JPL'
D /science/LSAR/identification/processingDateTime | |S19 | () | chunks=None | nofilter | fill=None | units=- = '2025-01-29T06:30:54'
D /science/LSAR/identification/processingType | |S7 | () | chunks=None | nofilter | fill=None | units=- = 'Nominal'
D /science/LSAR/identification/productDoi | |S19 | () | chunks=None | nofilter | fill=None | units=- = '10.5067/NIL2GCOV-B1'
D /science/LSAR/identification/productLevel | |S2 | () | chunks=None | nofilter | fill=None | units=- = 'L2'
D /science/LSAR/identification/productSpecificationVersion | |S5 | () | chunks=None | nofilter | fill=None | units=- = '1.2.1'
D /science/LSAR/identification/productType | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'GCOV'
D /science/LSAR/identification/productVersion | |S5 | () | chunks=None | nofilter | fill=None | units=- = '0.0.4'
D /science/LSAR/identification/radarBand | |S1 | () | chunks=None | nofilter | fill=None | units=- = 'L'
D /science/LSAR/identification/trackNumber | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(30)
D /science/LSAR/identification/zeroDopplerEndTime | |S29 | () | chunks=None | nofilter | fill=None | units=- = '2008-10-12T06:09:25.749342105'
D /science/LSAR/identification/zeroDopplerStartTime | |S29 | () | chunks=None | nofilter | fill=None | units=- = '2008-10-12T06:09:11.567105263'
````

**GUNW sample: header, grids, radarGrid cubes, identification extracts (selected lines)**  
Source: `<scratch>/verify/cookbook/notes/h5_GUNW_sample_tree.log`

````
FILE: NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001.h5
  size bytes: 264241152 | libver: ('earliest', 'v200') | userblock: 0
  file_space_strategy: PAGE (1, 1, 1) | file_space_page_size: 4194304
  root attrs: {'Conventions': 'CF-1.7', 'contact': 'nisar-sds-ops@jpl.nasa.gov', 'institution': 'NASA JPL', 'mission_name': 'NISAR', 'reference_document': 'D-102272 NISAR NASA SDS Product Specification L2 Geocoded Unwrapped Interferogram', 'title': 'NISAR L2 G ...[line cut]
G /complex64/
G /science/
G /science/LSAR/
G /science/LSAR/GUNW/
G /science/LSAR/GUNW/grids/
G /science/LSAR/GUNW/grids/frequencyA/
D /science/LSAR/GUNW/grids/frequencyA/centerFrequency | float64 | () | chunks=None | nofilter | fill=None | units=hertz = np.float64(1269999750.0604727)
D /science/LSAR/GUNW/grids/frequencyA/listOfPolarizations | |S2 | (1,) | chunks=None | nofilter | fill=None | units=- = ['HH']
G /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/
G /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/alongTrackOffset | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/correlationSurfacePeak | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/slantRangeOffset | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(80.0)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/xCoordinates | float64 | (1136,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-80.0)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/yCoordinates | float64 | (1555,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/mask | uint8 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.int64(255) | units=-
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(80.0)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/xCoordinates | float64 | (1136,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-80.0)
D /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/yCoordinates | float64 | (1555,) | chunks=None | nofilter | fill=None | units=meters
G /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/
G /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/coherenceMagnitude | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/connectedComponents | uint16 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.int64(65535) | units=1
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/ionospherePhaseScreen | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/ionospherePhaseScreenUncertainty | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase | float32 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(80.0)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/xCoordinates | float64 | (1136,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-80.0)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/yCoordinates | float64 | (1555,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/mask | uint8 | (1555, 1136) | chunks=(512, 512) | gzip1+shuffle | fill=np.int64(255) | units=-
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(80.0)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinates | float64 | (1136,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-80.0)
D /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/yCoordinates | float64 | (1555,) | chunks=None | nofilter | fill=None | units=meters
G /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/
G /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/coherenceMagnitude | float32 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/wrappedInterferogram | complex64 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.complex64(nan+nanj) | units=1
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(20.0)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/xCoordinates | float64 | (4545,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-20.0)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/yCoordinates | float64 | (6220,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/mask | uint8 | (6220, 4545) | chunks=(512, 512) | gzip1+shuffle | fill=np.int64(255) | units=-
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(20.0)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/xCoordinates | float64 | (4545,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-20.0)
D /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/yCoordinates | float64 | (6220,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/metadata/orbit/temporalBaseline | uint16 | () | chunks=None | nofilter | fill=None | units=days = np.uint16(46)
G /science/LSAR/GUNW/metadata/radarGrid/
D /science/LSAR/GUNW/metadata/radarGrid/alongTrackUnitVectorX | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/metadata/radarGrid/alongTrackUnitVectorY | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/metadata/radarGrid/elevationAngle | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=degrees
D /science/LSAR/GUNW/metadata/radarGrid/groundTrackVelocity | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=meters / second
D /science/LSAR/GUNW/metadata/radarGrid/heightAboveEllipsoid | float64 | (20,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/hydrostaticTroposphericPhaseScreen | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/metadata/radarGrid/incidenceAngle | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=degrees
D /science/LSAR/GUNW/metadata/radarGrid/losUnitVectorX | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/metadata/radarGrid/losUnitVectorY | float32 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=1
D /science/LSAR/GUNW/metadata/radarGrid/parallelBaseline | float32 | (2, 261, 194) | chunks=(1, 261, 194) | nofilter | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/perpendicularBaseline | float32 | (2, 261, 194) | chunks=(1, 261, 194) | nofilter | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(32611)
D /science/LSAR/GUNW/metadata/radarGrid/referenceSlantRange | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/referenceZeroDopplerAzimuthTime | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=seconds since 2008-10-12T00:00:00
D /science/LSAR/GUNW/metadata/radarGrid/secondarySlantRange | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/secondaryZeroDopplerAzimuthTime | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=seconds since 2008-11-27T00:00:00
D /science/LSAR/GUNW/metadata/radarGrid/slantRangeSolidEarthTidesPhase | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/metadata/radarGrid/wetTroposphericPhaseScreen | float64 | (20, 261, 194) | chunks=(1, 261, 194) | gzip1+shuffle | fill=np.float64(nan) | units=radians
D /science/LSAR/GUNW/metadata/radarGrid/xCoordinates | float64 | (194,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/GUNW/metadata/radarGrid/yCoordinates | float64 | (261,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/identification/granuleId | |S123 | () | chunks=None | nofilter | fill=None | units=- = 'NISAR_L2_PR_GUNW_001_030_A_019_002_2000_SH_20081012T060911_20081012T060925_20081127T061000_20081127T061014_D00404_N_F_J_001'
D /science/LSAR/identification/instrumentName | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'LSAR'
D /science/LSAR/identification/missionId | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'ALOS'
D /science/LSAR/identification/productSpecificationVersion | |S5 | () | chunks=None | nofilter | fill=None | units=- = '1.2.1'
````

**SME2 sample: header and top-level grid datasets (selected lines)**  
Source: `<scratch>/verify/cookbook/notes/h5_SME2_sample_tree.log`

````
FILE: NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001.h5
  size bytes: 7340032 | libver: ('earliest', 'v200') | userblock: 0
  file_space_strategy: PAGE (1, 1, 512) | file_space_page_size: 1048576
  root attrs: {'Conventions': 'CF-1.7', 'contact': 'nisar-sds-ops@jpl.nasa.gov', 'institution': 'NASA JPL', 'mission_name': 'NISAR', 'reference_document': 'D-107677 NISAR NASA SDS Product Specification Level-3 Soil Moisture', 'title': 'NISAR L3 SME2 Product'}
G /science/
G /science/LSAR/
G /science/LSAR/SME2/
G /science/LSAR/SME2/grids/
D /science/LSAR/SME2/grids/EASEGridColumnIndex | int32 | (450,) | chunks=None | nofilter | fill=None | units=1
D /science/LSAR/SME2/grids/EASEGridRowIndex | int32 | (405,) | chunks=None | nofilter | fill=None | units=1
D /science/LSAR/SME2/grids/latitude | float32 | (405,) | chunks=None | nofilter | fill=None | units=degree_north
D /science/LSAR/SME2/grids/longitude | float32 | (450,) | chunks=None | nofilter | fill=None | units=degree_east
D /science/LSAR/SME2/grids/projection | uint32 | () | chunks=None | nofilter | fill=None | units=- = np.uint32(6933)
D /science/LSAR/SME2/grids/radarData/listOfFrequencies | |S1 | (1,) | chunks=None | nofilter | fill=None | units=- = ['A']
D /science/LSAR/SME2/grids/retrievalQualityFlag | int16 | (405, 450) | chunks=(405, 450) | gzip1 | fill=np.int16(-9999) | units=1
D /science/LSAR/SME2/grids/soilMoisture | float32 | (405, 450) | chunks=(405, 450) | gzip1 | fill=np.float32(-9999.0) | units=meter^3/meter^3
D /science/LSAR/SME2/grids/soilMoistureUncertainty | float32 | (405, 450) | chunks=(405, 450) | gzip1 | fill=np.float32(-9999.0) | units=meter^3/meter^3
D /science/LSAR/SME2/grids/xCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(200.17900466918945)
D /science/LSAR/SME2/grids/xCoordinates | float64 | (450,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/SME2/grids/yCoordinateSpacing | float64 | () | chunks=None | nofilter | fill=None | units=meters = np.float64(-200.17900467012078)
D /science/LSAR/SME2/grids/yCoordinates | float64 | (405,) | chunks=None | nofilter | fill=None | units=meters
D /science/LSAR/identification/granuleId | |S91 | () | chunks=None | nofilter | fill=None | units=- = 'NISAR_L3_PR_SME2_001_008_D_070_4000_QPNA_A_20190829T180759_20190829T180809_D00404_M_P_J_001'
D /science/LSAR/identification/instrumentName | |S8 | () | chunks=None | nofilter | fill=None | units=- = 'PALSAR-2'
D /science/LSAR/identification/missionId | |S6 | () | chunks=None | nofilter | fill=None | units=- = 'ALOS-2'
D /science/LSAR/identification/productSpecificationVersion | |S5 | () | chunks=None | nofilter | fill=None | units=- = '1.0.0'
D /science/LSAR/identification/productType | |S4 | () | chunks=None | nofilter | fill=None | units=- = 'SME2'
````


## C.8 Specification changes by version (grids only)

**notes/spec_diff_GCOV_grids.log**  
Source: `<scratch>/verify/cookbook/notes/spec_diff_GCOV_grids.log`

````
== 1.1.0: 50 datasets (baseline)
== 1.1.0 -> 1.1.2: 48 datasets | +0 -2 ~18
   - /science/LSAR/GCOV/grids/frequencyA/RVRH  ('float32', 'complexDataFrequencyAShape', '1', '(nan+nan*j)')
   - /science/LSAR/GCOV/grids/frequencyB/RVRH  ('float32', 'complexDataFrequencyBShape', '1', '(nan+nan*j)')
   ~ /science/LSAR/GCOV/grids/frequencyA/HHHH  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/HVHV  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/RHRH  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/RVRV  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/VHVH  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/VVVV  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/mask  ('uint8', 'complexDataFrequencyAShape', '1', '255') -> ('uint8', 'realDataFrequencyAShape', '1', '255')
   ~ /science/LSAR/GCOV/grids/frequencyA/numberOfLooks  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor  ('float32', 'complexDataFrequencyAShape', '1', 'nan') -> ('float32', 'realDataFrequencyAShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/HHHH  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/HVHV  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/RHRH  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/RVRV  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/VHVH  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/VVVV  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/mask  ('uint8', 'complexDataFrequencyBShape', '1', '255') -> ('uint8', 'realDataFrequencyBShape', '1', '255')
   ~ /science/LSAR/GCOV/grids/frequencyB/numberOfLooks  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
   ~ /science/LSAR/GCOV/grids/frequencyB/rtcGammaToSigmaFactor  ('float32', 'complexDataFrequencyBShape', '1', 'nan') -> ('float32', 'realDataFrequencyBShape', '1', 'nan')
== 1.1.2 -> 1.2.0: 48 datasets | +0 -0 ~2
   ~ /science/LSAR/GCOV/grids/frequencyA/mask  ('uint8', 'realDataFrequencyAShape', '1', '255') -> ('uint8', 'realDataFrequencyAShape', '', '255')
   ~ /science/LSAR/GCOV/grids/frequencyB/mask  ('uint8', 'realDataFrequencyBShape', '1', '255') -> ('uint8', 'realDataFrequencyBShape', '', '255')
== 1.2.0 -> 1.2.1: 48 datasets | +0 -0 ~0
== 1.2.1 -> 1.3.0: 48 datasets | +0 -0 ~0
== 1.3.0 -> 1.4.0: 48 datasets | +0 -0 ~0
== 1.4.0 -> 1.5.0: 50 datasets | +2 -0 ~0
   + /science/LSAR/GCOV/grids/frequencyA/inputDataExceptionMask  ('uint8', 'realDataFrequencyAShape', '', '')
   + /science/LSAR/GCOV/grids/frequencyB/inputDataExceptionMask  ('uint8', 'realDataFrequencyBShape', '', '')
== 1.5.0 -> 1.6.0: 50 datasets | +0 -0 ~2
   ~ /science/LSAR/GCOV/grids/frequencyA/inputDataExceptionMask  ('uint8', 'realDataFrequencyAShape', '', '') -> ('uint16', 'realDataFrequencyAShape', '', '65535')
   ~ /science/LSAR/GCOV/grids/frequencyB/inputDataExceptionMask  ('uint8', 'realDataFrequencyBShape', '', '') -> ('uint16', 'realDataFrequencyBShape', '', '65535')
````

**GUNW grid changes from 1.2.1 to 1.6.0 (lines 57 to 70)**  
Source: `<scratch>/verify/cookbook/notes/spec_diff_GUNW_grids.log`

````
== 1.2.1 -> 1.3.0: 70 datasets | +0 -0 ~0
== 1.3.0 -> 1.4.0: 70 datasets | +0 -0 ~0
== 1.4.0 -> 1.5.0: 70 datasets | +1 -1 ~2
   + /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/mask  ('uint32', 'offsetShape', '', '255')
   - /science/LSAR/GUNW/grids/frequencyA/pixelOffset/mask  ('uint8', 'offsetShape', '', '255')
   ~ /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/mask  ('uint8', 'unwrappedInterferogramShape', '', '255') -> ('uint32', 'unwrappedInterferogramShape', '', '255')
   ~ /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/mask  ('uint8', 'wrappedInterferogramShape', '', '255') -> ('uint32', 'wrappedInterferogramShape', '', '255')
== 1.5.0 -> 1.6.0: 76 datasets | +6 -0 ~0
   + /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/HH/validDataMask  ('uint8', 'offsetShape', '1', '255')
   + /science/LSAR/GUNW/grids/frequencyA/pixelOffsets/VV/validDataMask  ('uint8', 'offsetShape', '1', '255')
   + /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/validDataMask  ('uint8', 'unwrappedInterferogramShape', '1', '255')
   + /science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/validDataMask  ('uint8', 'unwrappedInterferogramShape', '1', '255')
   + /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/HH/validDataMask  ('uint8', 'wrappedInterferogramShape', '1', '255')
   + /science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/VV/validDataMask  ('uint8', 'wrappedInterferogramShape', '1', '255')
````

**notes/isce3_tag_specver.log**  
Source: `<scratch>/verify/cookbook/notes/isce3_tag_specver.log`

````
v0.24.1  insar:PRODUCT_SPECIFICATION_VERSION="1.2.1"  GUNW validDataMask-mentions=0  GUNW np.uint32-mentions=0  GCOV inputDataExceptionMask-mentions=0
v0.24.6  insar:PRODUCT_SPECIFICATION_VERSION="1.2.1"  GUNW validDataMask-mentions=0  GUNW np.uint32-mentions=0  GCOV inputDataExceptionMask-mentions=0
v0.25.8  insar:PRODUCT_SPECIFICATION_VERSION="1.4.0"  GUNW validDataMask-mentions=0  GUNW np.uint32-mentions=0  GCOV inputDataExceptionMask-mentions=0
v0.25.14  insar:PRODUCT_SPECIFICATION_VERSION="1.5.0"  GUNW validDataMask-mentions=0  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=1
v0.25.16  insar:PRODUCT_SPECIFICATION_VERSION="1.5.0"  GUNW validDataMask-mentions=0  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=1
v0.25.18  insar:PRODUCT_SPECIFICATION_VERSION="1.5.0"  GUNW validDataMask-mentions=6  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=5
v0.25.20  insar:PRODUCT_SPECIFICATION_VERSION="1.6.0"  GUNW validDataMask-mentions=6  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=5
v0.25.22  insar:PRODUCT_SPECIFICATION_VERSION="1.6.0"  GUNW validDataMask-mentions=6  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=5
v0.25.23  insar:PRODUCT_SPECIFICATION_VERSION="1.6.0"  GUNW validDataMask-mentions=6  GUNW np.uint32-mentions=1  GCOV inputDataExceptionMask-mentions=5
````

**CRID P05023 (provisional): software and specification versions (selected lines)**  
Source: `<scratch>/verify/cookbook/downloads/web_recheck/NISAR_LSAR_CRID_P05023.csv`

````
Item Name,Item Type,Version
CRID,Composite Release ID,P05023
SDS,SDS release,R05.02.3
GCOV_L_PGE (l1_l2),PGE SW,R05.02.3
InSAR_L_PGE (l1_l2),PGE SW,R05.02.3
L3_L_SME2_PGE,PGE SW,R05.02.0
ISCE3 (l0b),ISCE3 SW,v0.25.14
ISCE3 (l1_l2),ISCE3 SW,v0.25.16
ISCE3 (SME2),ISCE3 SW,v0.25.14
PSpec_L2_L_GSLC,Product Specification Version,1.5.0
PSpec_L2_L_GCOV,Product Specification Version,1.5.0
PSpec_L2_L_GUNW,Product Specification Version,1.5.0
PSpec_L2_L_GOFF,Product Specification Version,1.5.0
PSpec_L3_L_SME2,Product Specification Version,1.0.2
L2_L_GSLC,Product Version,1.0.11
L2_L_GCOV,Product Version,1.0.11
L2_L_GUNW,Product Version,1.0.11
````


## C.9 CMR results

**notes/cmr_collections.log**  
Source: `<scratch>/verify/cookbook/notes/cmr_collections.log`

````
31 collections
NISAR_L0B_CRSD_PROVISIONAL_V1      v1   C2853091612-ASF        start=2026-06-16 end= cloud=True dc=ASF
NISAR_L0B_CRSD_V1                  v1   C3622254588-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L0B_RRSD_PROVISIONAL_V1      v1   C2853089814-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L0B_RRSD_V1                  v1   C3622265756-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RIFG_BETA_V1              v1   C2850234202-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L1_RIFG_PROVISIONAL_V1       v1   C2853147928-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RIFG_V1                   v1   C3622229381-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_ROFF_BETA_V1              v1   C2850237619-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L1_ROFF_PROVISIONAL_V1       v1   C2853156054-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_ROFF_V1                   v1   C3622241997-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RSLC_BETA_V1              v1   C2850225585-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L1_RSLC_PROVISIONAL_V1       v1   C2853145197-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RSLC_V1                   v1   C3622236985-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RUNW_BETA_V1              v1   C2850235455-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L1_RUNW_PROVISIONAL_V1       v1   C2853153429-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L1_RUNW_V1                   v1   C3622237369-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GCOV_BETA_V1              v1   C3622214170-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L2_GCOV_PROVISIONAL_V1       v1   C2854338529-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GCOV_V1                   v1   C3622241360-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GOFF_BETA_V1              v1   C2850263910-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L2_GOFF_PROVISIONAL_V1       v1   C2854341702-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GOFF_V1                   v1   C3622250865-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GSLC_BETA_V1              v1   C2850259510-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L2_GSLC_PROVISIONAL_V1       v1   C2854332392-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GSLC_V1                   v1   C3622244601-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GUNW_BETA_V1              v1   C2850261892-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L2_GUNW_PROVISIONAL_V1       v1   C2854335566-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L2_GUNW_V1                   v1   C3622247503-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_L3_SME2_BETA_V1              v1   C2850265000-ASF        start=2025-10-01 end= cloud=True dc=ASF
NISAR_L3_SME2_PROVISIONAL_V1       v1   C2854344945-ASF        start=2025-10-28 end= cloud=True dc=ASF
NISAR_LRCLK_UTC                    v1   C3632501432-ASF        start=2019-01-01 end= cloud=True dc=ASF
````

**notes/cmr_granule_counts.log**  
Source: `<scratch>/verify/cookbook/notes/cmr_granule_counts.log`

````
NISAR_L2_GCOV_V1               hits=   14698 newest: 2026-11-11T23:35:57.000000Z NISAR_L2_PR_GCOV_035_098_A_010_0005_NASV_M_20261111T233557_20261111T233632_P05036_N_F_J_001
NISAR_L2_GCOV_V1               hits=   14698 oldest: 2026-10-21T17:07:21.000000Z NISAR_L2_PR_GCOV_033_137_D_073_2005_DHDH_A_20261021T170721_20261021T170733_P05036_N_P_J_001
NISAR_L2_GCOV_PROVISIONAL_V1   hits=  163672 newest: 2026-10-21T20:37:40.000000Z NISAR_L2_PR_GCOV_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001
NISAR_L2_GCOV_PROVISIONAL_V1   hits=  163672 oldest: 2025-10-29T11:11:30.000000Z NISAR_L2_PR_GCOV_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001
NISAR_L2_GCOV_BETA_V1          hits=   23527 newest: 2026-01-20T15:59:30.000000Z NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001
NISAR_L2_GCOV_BETA_V1          hits=   23527 oldest: 2025-10-12T18:25:08.000000Z NISAR_L2_PR_GCOV_002_109_D_063_4005_DHDH_A_20251012T182508_20251012T182531_X05010_N_P_J_001
NISAR_L2_GUNW_V1               hits=     140 newest: 2026-10-09T23:53:35.000000Z NISAR_L2_PR_GUNW_032_141_D_085_033_2000_SH_20261009T235335_20261009T235349_20261021T235335_20261021T235349_P05036_N_P_J_001
NISAR_L2_GUNW_V1               hits=     140 oldest: 2026-09-27T23:50:27.000000Z NISAR_L2_PR_GUNW_031_141_D_079_033_2000_SH_20260927T235027_20260927T235044_20261021T235028_20261021T235045_P05036_N_P_J_001
NISAR_L2_GUNW_PROVISIONAL_V1   hits=   94150 newest: 2026-10-09T20:37:40.000000Z NISAR_L2_PR_GUNW_032_139_D_091_033_4000_SH_20261009T203740_20261009T203744_20261021T203740_20261021T203744_P05023_N_P_J_001
NISAR_L2_GUNW_PROVISIONAL_V1   hits=   94150 oldest: 2025-10-29T11:11:30.000000Z NISAR_L2_PR_GUNW_004_004_A_018_006_4000_SH_20251029T111130_20251029T111153_20251122T111119_20251122T111153_P05023_N_P_J_001
NISAR_L2_GUNW_BETA_V1          hits=   10217 newest: 2026-01-08T13:03:26.000000Z NISAR_L2_PR_GUNW_009_163_A_142_010_7700_SH_20260108T130326_20260108T130349_20260120T130327_20260120T130349_X05010_N_P_J_001
NISAR_L2_GUNW_BETA_V1          hits=   10217 oldest: 2025-10-17T12:48:36.000000Z NISAR_L2_PR_GUNW_003_005_A_013_004_4000_SH_20251017T124836_20251017T124857_20251029T124836_20251029T124858_X05010_N_P_J_001
NISAR_L2_GSLC_V1               hits=   15700 newest: 2026-11-11T23:40:59.000000Z NISAR_L2_PR_GSLC_035_098_A_019_4005_DHDH_A_20261111T234059_20261111T234113_P05036_N_P_J_001
NISAR_L2_GSLC_V1               hits=   15700 oldest: 2026-10-21T17:07:21.000000Z NISAR_L2_PR_GSLC_033_137_D_073_2005_DHDH_A_20261021T170721_20261021T170733_P05036_N_P_J_001
NISAR_L2_GSLC_PROVISIONAL_V1   hits=  162907 newest: 2026-10-21T20:37:40.000000Z NISAR_L2_PR_GSLC_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001
NISAR_L2_GSLC_PROVISIONAL_V1   hits=  162907 oldest: 2025-10-29T11:11:30.000000Z NISAR_L2_PR_GSLC_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001
NISAR_L2_GSLC_BETA_V1          hits=   23450 newest: 2026-01-20T15:59:30.000000Z NISAR_L2_PR_GSLC_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001
NISAR_L2_GSLC_BETA_V1          hits=   23450 oldest: 2025-10-12T18:25:08.000000Z NISAR_L2_PR_GSLC_002_109_D_063_4005_DHDH_A_20251012T182508_20251012T182531_X05010_N_P_J_001
NISAR_L2_GOFF_V1               hits=      32 newest: 2026-10-09T23:36:33.000000Z NISAR_L2_PR_GOFF_032_141_D_055_033_7700_SH_20261009T233633_20261009T233713_20261021T233633_20261021T233713_P05036_N_P_J_001
NISAR_L2_GOFF_V1               hits=      32 oldest: 2026-10-09T20:57:10.000000Z NISAR_L2_PR_GOFF_032_139_D_126_033_4000_SH_20261009T205710_20261009T205743_20261021T205708_20261021T205743_P05036_N_F_J_001
NISAR_L2_GOFF_PROVISIONAL_V1   hits=   27717 newest: 2026-10-09T18:43:17.000000Z NISAR_L2_PR_GOFF_032_138_D_066_033_2000_SH_20261009T184317_20261009T184352_20261021T184317_20261021T184352_P05023_N_F_J_001
NISAR_L2_GOFF_PROVISIONAL_V1   hits=   27717 oldest: 2025-10-29T12:18:24.000000Z NISAR_L2_PR_GOFF_004_004_A_136_006_7700_SH_20251029T121824_20251029T121857_20251122T121825_20251122T121857_P05023_N_P_J_001
NISAR_L2_GOFF_BETA_V1          hits=    3666 newest: 2026-01-08T13:03:26.000000Z NISAR_L2_PR_GOFF_009_163_A_142_010_7700_SH_20260108T130326_20260108T130349_20260120T130327_20260120T130349_X05010_N_P_J_001
NISAR_L2_GOFF_BETA_V1          hits=    3666 oldest: 2025-10-17T12:54:33.000000Z NISAR_L2_PR_GOFF_003_005_A_024_004_4000_SH_20251017T125433_20251017T125508_20251029T125434_20251029T125509_X05009_N_F_J_001
NISAR_L3_SME2_PROVISIONAL_V1   hits=  103943 newest: 2026-10-21T20:37:40.000000Z NISAR_L3_PR_SME2_033_139_D_091_4005_DHDH_A_20261021T203740_20261021T203744_P05023_N_P_J_001
NISAR_L3_SME2_PROVISIONAL_V1   hits=  103943 oldest: 2025-10-29T11:11:30.000000Z NISAR_L3_PR_SME2_004_004_A_018_4005_DHDH_A_20251029T111130_20251029T111153_P05023_N_P_J_001
NISAR_L3_SME2_BETA_V1          hits=   13881 newest: 2026-01-20T15:59:30.000000Z NISAR_L3_PR_SME2_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001
NISAR_L3_SME2_BETA_V1          hits=   13881 oldest: 2025-10-17T12:48:36.000000Z NISAR_L3_PR_SME2_003_005_A_013_4005_DHDH_A_20251017T124836_20251017T124857_X05010_N_P_J_001
````

**notes/cmr_url_prefixes.log**  
Source: `<scratch>/verify/cookbook/notes/cmr_url_prefixes.log`

````
== NISAR_L2_GCOV_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_V1/
   CRIDs: {'P05036': 600} | PGE: {'R05.03.2': 600}
== NISAR_L2_GCOV_PROVISIONAL_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_PROVISIONAL_V1/
   CRIDs: {'P05023': 600} | PGE: {'R05.02.3': 600}
== NISAR_L2_GCOV_BETA_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_BETA_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GCOV_BETA_V1/
   CRIDs: {'X05009': 349, 'X05010': 250, 'X05007': 1} | PGE: {'R05.00.8': 599, 'R05.00.5': 1}
== NISAR_L2_GUNW_V1
    420  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/L2_L_GUNW/
    420  s3://sds-n-cumulus-prod-nisar-products/L2_L_GUNW/
   CRIDs: {'P05036': 420} | PGE: {'R05.03.2': 420}
== NISAR_L2_GUNW_PROVISIONAL_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GUNW_PROVISIONAL_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GUNW_PROVISIONAL_V1/
   CRIDs: {'P05023': 600} | PGE: {'R05.02.3': 600}
== NISAR_L2_GUNW_BETA_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GUNW_BETA_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GUNW_BETA_V1/
   CRIDs: {'X05010': 471, 'X05009': 128, 'X05007': 1} | PGE: {'R05.00.8': 599, 'R05.00.5': 1}
== NISAR_L2_GSLC_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GSLC_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GSLC_V1/
   CRIDs: {'P05036': 600} | PGE: {'R05.03.2': 600}
== NISAR_L2_GSLC_PROVISIONAL_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GSLC_PROVISIONAL_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GSLC_PROVISIONAL_V1/
   CRIDs: {'P05023': 600} | PGE: {'R05.02.3': 600}
== NISAR_L2_GSLC_BETA_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GSLC_BETA_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GSLC_BETA_V1/
   CRIDs: {'X05010': 330, 'X05009': 269, 'X05007': 1} | PGE: {'R05.00.8': 599, 'R05.00.5': 1}
== NISAR_L2_GOFF_V1
     96  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GOFF_V1/
     96  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GOFF_V1/
   CRIDs: {'P05036': 96} | PGE: {'R05.03.2': 96}
== NISAR_L2_GOFF_PROVISIONAL_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GOFF_PROVISIONAL_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GOFF_PROVISIONAL_V1/
   CRIDs: {'P05023': 600} | PGE: {'R05.02.3': 600}
== NISAR_L2_GOFF_BETA_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GOFF_BETA_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L2_GOFF_BETA_V1/
   CRIDs: {'X05010': 461, 'X05009': 138, 'X05007': 1} | PGE: {'R05.00.8': 599, 'R05.00.5': 1}
== NISAR_L3_SME2_PROVISIONAL_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L3_SME2_PROVISIONAL_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L3_SME2_PROVISIONAL_V1/
   CRIDs: {'P05023': 600} | PGE: {'R05.02.0': 600}
== NISAR_L3_SME2_BETA_V1
    600  https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L3_SME2_BETA_V1/
    600  s3://sds-n-cumulus-prod-nisar-products/NISAR_L3_SME2_BETA_V1/
   CRIDs: {'X05010': 600} | PGE: {'R05.00.1': 600}
````


---

# Part D. Official idioms that need login (docs; not run by the verification agents)

Quoted so the builder does not have to guess the authenticated form. Sources: the ASF NISAR Cookbook (`https://github.com/ASFOpenSARlab/NISAR_Cookbook`, commit `17b69c8`, Apache-2.0 per LICENSE), the NISAR Data User Guide source (`https://github.com/ua-asf/nisar-docs`, CC0-1.0) and the 2026 ISCE+ course (`https://github.com/isceplus/2026-isceplus`, BSD-3-Clause). The outputs shown were saved in the notebooks by their authors.


## D.1 Cookbook: search with asf_search, keep the newest CRID per product

Written for asf_search 13.x (the Cookbook pins `asf_search >=13.0.1,<14`); not re-tested on 14.1.0.

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 5** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 7** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.2 Cookbook: stream one product over HTTPS with an Earthdata Bearer token

The token comes from the "Generate Token" tab of `https://urs.earthdata.nasa.gov/profile` (the notebook reads it with `getpass`).

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 11** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.3 Cookbook: open several dates, clip to an area, build a time series, convert to dB

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 21** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 23** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 25** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 27** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 29** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_stream_NISAR_asf_search.ipynb`, code cell 31** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_stream_NISAR_asf_search.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.4 Cookbook time-series notebook: stack search, bad-date removal, window to local Zarr

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 2** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, markdown cell 5** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 6** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 12** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 16** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 18** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 19** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 25** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_Time_Series_Example.ipynb`, code cell 31** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_Time_Series_Example.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.5 Cookbook and Data User Guide: streaming through earthaccess

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_NISAR_GCOV_earthaccess.ipynb`, code cell 7** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_NISAR_GCOV_earthaccess.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

Output saved in the notebook by its authors (first lines; not run by the verification agents):

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**NISAR Data User Guide, accessing-nisar/earthaccess.md, HTTPS example (lines 147 to 170)**  
Source: `<scratch>/verify/cookbook/repos/nisar-docs/accessing-nisar/earthaccess.md`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.6 Cookbook change-detection notebook: pairwise log-ratio

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_SARChangeDetectionMethods.ipynb`, code cell 56** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_SARChangeDetectionMethods.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**ASFOpenSARlab/NISAR_Cookbook `notebooks/NISAR_GCOV_SARChangeDetectionMethods.ipynb`, code cell 58** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/NISAR_GCOV_SARChangeDetectionMethods.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.7 Data User Guide: GDAL configuration and command form (needs GDAL 3.13 or later for the HDF5 driver)

**NISAR Data User Guide, accessing-nisar/gdal.md: netrc (lines 52 to 56)**  
Source: `<scratch>/verify/cookbook/repos/nisar-docs/accessing-nisar/gdal.md`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**NISAR Data User Guide, accessing-nisar/gdal.md: gdalrc (lines 81 to 94)**  
Source: `<scratch>/verify/cookbook/repos/nisar-docs/accessing-nisar/gdal.md`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**NISAR Data User Guide, accessing-nisar/gdal.md: driver warning (lines 101 to 106)**  
Source: `<scratch>/verify/cookbook/repos/nisar-docs/accessing-nisar/gdal.md`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**NISAR Data User Guide, accessing-nisar/gdal.md: worked gdalwarp example with a WKT cutline (lines 371 to 387)**  
Source: `<scratch>/verify/cookbook/repos/nisar-docs/accessing-nisar/gdal.md`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.8 ISCE+ course GUNW tutorial: mask decoding and sign convention (BSD-3-Clause)

**isceplus/2026-isceplus `3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb`, code cell 31** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/isceplus_nb_txt/3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**isceplus/2026-isceplus `3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb`, code cell 33** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/isceplus_nb_txt/3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**isceplus/2026-isceplus `3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb`, code cell 35** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/isceplus_nb_txt/3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*

**isceplus/2026-isceplus `3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb`, markdown cell 55** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/isceplus_nb_txt/3.3_NISAR_StandardProducts_Workflows/NISAR_GUNW_Tutorial.ipynb.txt`

*(Third-party code not reproduced here: see the source named above, which carries its own licence.)*


## D.9 What real files contain: outputs ASF saved in its notebooks (docs)

These are the only observations of real NISAR GCOV file contents available without credentials. First notebook: provisional granule `NISAR_L2_PR_GCOV_006_172_A_008_2005_DHDH_A_20251204T024618_20251204T024653_P05023_N_F_J_001` (20+5 MHz, dual-pol).

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 23** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#list the contents of the grids group
#this shows how GCOV raster data are organized by frequency
list(f["science/LSAR/GCOV/grids"])
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (execute_result):
#> ['frequencyA', 'frequencyB']
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 27** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#list the datasets available within the frequencyA group
#these correspond to specific polarization combinations and supporting layers
list(f["science/LSAR/GCOV/grids/frequencyA"])
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (execute_result):
#> ['HHHH',
#>  'HVHV',
#>  'inputDataExceptionMask',
#>  'listOfCovarianceTerms',
#>  'listOfPolarizations',
#>  'mask',
#>  'numberOfLooks',
#>  'numberOfSubSwaths',
#>  'projection',
#>  'rtcGammaToSigmaFactor',
#>  'xCoordinateSpacing',
#>  'xCoordinates',
#>  'yCoordinateSpacing',
#>  'yCoordinates']
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 31** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#access a covariance (measurement) dataset by its full HDF5 path
#HVHV is a real-valued covariance term for the HV–HV polarization combination
hvhv = f["science/LSAR/GCOV/grids/frequencyA/HVHV"]

#inspect basic properties of the dataset without loading the full array
hvhv.shape, hvhv.dtype
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (execute_result):
#> ((16704, 17064), dtype('<f4'))
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 35** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#select key dataset attributes
#before reading the dataset into memory, we inspect a small number of attributes that directly affect how the data should be handled in analysis and visualization

print("Fill value:", hvhv.attrs.get("_FillValue"))
print("Minimum valid value:", hvhv.attrs.get("valid_min"))
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (stream):
#> Fill value: nan
#> Minimum valid value: 0.0
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 42** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#read the x and y coordinate vectors for the frequencyA grid
x = f["science/LSAR/GCOV/grids/frequencyA/xCoordinates"][:]
y = f["science/LSAR/GCOV/grids/frequencyA/yCoordinates"][:]

#inspect coordinate ranges and lengths
print(f"x range: {x.min():.1f} to {x.max():.1f}")
print(f"y range: {y.min():.1f} to {y.max():.1f}")
print(f"number of x coordinates (columns): {len(x)}")
print(f"number of y coordinates (rows): {len(y)}")
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (stream):
#> x range: 604090.0 to 945350.0
#> y range: 1254250.0 to 1588310.0
#> number of x coordinates (columns): 17064
#> number of y coordinates (rows): 16704
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 45** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#read the grid spacing (pixel size) for the frequencyA grid
dx = f["science/LSAR/GCOV/grids/frequencyA/xCoordinateSpacing"][()]
dy = f["science/LSAR/GCOV/grids/frequencyA/yCoordinateSpacing"][()]

#print
print(f"x spacing (dx): {float(dx)}")
print(f"y spacing (dy): {float(dy)}")
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (stream):
#> x spacing (dx): 20.0
#> y spacing (dy): -20.0
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 48** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#read the projection information for the frequencyA grid
projection = f["science/LSAR/GCOV/grids/frequencyA/projection"][()]

projection
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (execute_result):
#> np.uint32(32637)
````

**ASFOpenSARlab/NISAR_Cookbook `notebooks/Opening_HDF5_Python.ipynb`, code cell 53** (source verbatim)  
Text dump read from: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/Opening_HDF5_Python.ipynb.txt`

````python
#quality check
with rasterio.open(out_tif) as src:
    print("CRS:", src.crs)
    print("Resolution:", src.res)
    print("Bounds:", src.bounds)
````

Output saved in the notebook by its authors (first lines; not run by the verification agents):

````
#>>> OUTPUT (stream):
#> CRS: EPSG:32637
#> Resolution: (20.0, 20.0)
#> Bounds: BoundingBox(left=604080.0, bottom=1254240.0, right=945360.0, top=1588320.0)
````

Second notebook: a beta granule (`NISAR_L2_PR_GCOV_004_159_A_022_2005_DHDH_A_20251109T051542_20251109T051613_X05010_N_F_J_001`) opened as a whole tree; note frequency A and frequency B side by side and no `inputDataExceptionMask` in beta.

**ASFOpenSARlab/NISAR_Cookbook `notebooks/search_NISAR_GCOV_earthaccess.ipynb`, saved output of cell 7 (lines 164 to 216)**  
Source: `<scratch>/verify/cookbook/notes/cookbook_nb_txt/search_NISAR_GCOV_earthaccess.ipynb.txt`

````
#>>> OUTPUT (execute_result):
#> <xarray.DataTree>
#> Group: /
#> │   Attributes:
#> │       Conventions:         CF-1.7
#> │       contact:             nisar-sds-ops@jpl.nasa.gov
#> │       institution:         NASA JPL
#> │       mission_name:        NISAR
#> │       reference_document:  D-102274 NISAR NASA SDS Product Specification Level-...
#> │       title:               NISAR L2 GCOV Product
#> └── Group: /science
#>     └── Group: /science/LSAR
#>         ├── Group: /science/LSAR/GCOV
#>         │   ├── Group: /science/LSAR/GCOV/grids
#>         │   │   ├── Group: /science/LSAR/GCOV/grids/frequencyA
#>         │   │   │       Dimensions:                (yCoordinates: 17568, xCoordinates: 17820,
#>         │   │   │                                   phony_dim_0: 2)
#>         │   │   │       Coordinates:
#>         │   │   │         * yCoordinates           (yCoordinates) float64 141kB 4.665e+06 ... 4.314e+06
#>         │   │   │         * xCoordinates           (xCoordinates) float64 143kB 3.442e+05 ... 7.006e+05
#>         │   │   │       Dimensions without coordinates: phony_dim_0
#>         │   │   │       Data variables:
#>         │   │   │           HHHH                   (yCoordinates, xCoordinates) float32 1GB ...
#>         │   │   │           HVHV                   (yCoordinates, xCoordinates) float32 1GB ...
#>         │   │   │           listOfCovarianceTerms  (phony_dim_0) |S4 8B ...
#>         │   │   │           listOfPolarizations    (phony_dim_0) |S2 4B ...
#>         │   │   │           mask                   (yCoordinates, xCoordinates) float32 1GB ...
#>         │   │   │           numberOfLooks          (yCoordinates, xCoordinates) float32 1GB ...
#>         │   │   │           numberOfSubSwaths      uint8 1B ...
#>         │   │   │           projection             uint32 4B ...
#>         │   │   │           rtcGammaToSigmaFactor  (yCoordinates, xCoordinates) float32 1GB ...
#>         │   │   │           xCoordinateSpacing     float64 8B ...
#>         │   │   │           yCoordinateSpacing     float64 8B ...
#>         │   │   └── Group: /science/LSAR/GCOV/grids/frequencyB
#>         │   │           Dimensions:                (yCoordinates: 4392, xCoordinates: 4455,
#>         │   │                                       phony_dim_1: 2)
#>         │   │           Coordinates:
#>         │   │             * yCoordinates           (yCoordinates) float64 35kB 4.665e+06 ... 4.314e+06
#>         │   │             * xCoordinates           (xCoordinates) float64 36kB 3.442e+05 ... 7.005e+05
#>         │   │           Dimensions without coordinates: phony_dim_1
#>         │   │           Data variables:
#>         │   │               HHHH                   (yCoordinates, xCoordinates) float32 78MB ...
#>         │   │               HVHV                   (yCoordinates, xCoordinates) float32 78MB ...
#>         │   │               listOfCovarianceTerms  (phony_dim_1) |S4 8B ...
#>         │   │               listOfPolarizations    (phony_dim_1) |S2 4B ...
#>         │   │               mask                   (yCoordinates, xCoordinates) float32 78MB ...
#>         │   │               numberOfLooks          (yCoordinates, xCoordinates) float32 78MB ...
#>         │   │               numberOfSubSwaths      uint8 1B ...
#>         │   │               projection             uint32 4B ...
#>         │   │               rtcGammaToSigmaFactor  (yCoordinates, xCoordinates) float32 78MB ...
#>         │   │               xCoordinateSpacing     float64 8B ...
#>         │   │               yCoordinateSpacing     float64 8B ...
#>         │   └── Group: /science/LSAR/GCOV/metadata
````
