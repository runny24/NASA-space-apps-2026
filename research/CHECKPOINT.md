# Checkpoint: build prompt for NASA Space Apps 2026, "Dancing with the SARs"

Written 2026-11-13, about 19:50 local; moved at 20:50 from `<another-folder>/spaceapps-nisar/` (the session was
linked to the wrong folder) to `research/` in the team's repository,
`~/Documents/GitHub/NASA-space-apps-2026` (remote `github.com/runny24/NASA-space-apps-2026`, no
commits yet; nothing here has been committed). Everything below was verified on 2026-11-13 unless marked
otherwise. Read this whole file before doing anything; it replaces the conversation it came from.

## 1. The task

The user's team is entering the 2026 NASA Space Apps Challenge, challenge "Dancing with the SARs" (build an
interactive app that uses NISAR radar data to track and visualize surface change). They asked for **one
extremely long, detailed, well-researched prompt** that they can give to an AI coding agent so the team can
build the project in about 36 hours. They asked for every challenge link to be researched first.

**Status**

| Step | State |
|---|---|
| Research: rules, data, tools, events, learning resources | Done (sections 2, 5 to 9) |
| Direct checks of NASA's catalog, tiles and preview images | Done (section 5) |
| Hands-on verification of search code, raster packaging, browser stack, official notebooks, Harmony | **Still running when this was written** (section 4) |
| The prompt itself | **Version 1 written 2026-11-13 20:50** at `research/BUILD_PROMPT.md` (about 9,000 words). Its first line is a status comment; remove it when final |
| Review and fact-check of the prompt | **Running since 20:55** as a second background workflow: five reviewers (cold read, SAR science, rules, engineering, fact-check), each followed by a skeptic. Results go to that workflow's `journal.jsonl` under `.../c2a86af5-ec6b-4200-871d-99ccc3f8dde9/subagents/workflows/`; reviewer scratch under `scratchpad/review/` |
| Still to do | Fold hands-on results into Section 6 and Appendix D of the prompt; apply the review findings that survive verification; remove the status comment; tell the user |

Nothing has been built for the project. Only research, catalog queries and throwaway capability tests in a
temp folder.

## 2. Two rules that shape the deliverable (read verbatim from the official pages)

Saved copies of the pages are in `evidence/rules/`.

1. **No building before kickoff.** FAQ: "Teams are not allowed to begin working on the challenges prior to
   the hackathon." GO Team answer (github.com/nasa/spaceapps/discussions/1827): "Working ahead of the
   hackathon can lead to disqualification"; before the start "you may select a challenge to work on, review
   the resources, research the topic" and form a team. The hackathon is **Sat Nov 14 9:00 a.m. to Sun Nov 15
   11:59 p.m., local time of the team's Local Event** (39 hours). Submissions saved after the deadline are
   not judged. So the prompt must not be run before 9:00 a.m. Saturday, and its schedule should start there.
2. **The idea must be the team's.** Submission guide: "The use of SI tools, such as machine learning,
   chatbots, image generation, and large language models, is permitted ... and should be used as a tool to
   accelerate innovation and creativity for your challenge solution. SI should not be used to (come up with
   your idea of how to solve the challenge)." ("SI" = "Super Intelligence", the term the 2026 pages use for AI.)
   Consequence, already decided: **the prompt must not hand the team a concept.** It gets a "team concept"
   block the team fills in (place, change, audience, angle, name), plus evidence to choose with.

Other rules that the prompt must encode:

- **AI disclosure:** "Generated content may not use, contain, or modify any NASA branding or design elements
  (such as the NASA logos, flags, or mission identifiers)." Images and videos "Must include a visible
  watermark to indicate SI generation." Audio, code and data "Must acknowledge SI generation in descriptive
  text and metadata." Judges "will evaluate originality, intent, and execution based on the SI-assisted
  elements you include and identify".
- **Demo:** "a 7-slide presentation (including title and introductory slides) or a 30-second or less video".
  "Projects that exceed these limits will not be eligible for Global Judging." Suggested video beats:
  0:00 names and team, 0:02 the challenge, 0:05 title and tagline, 0:10 how it works, 0:20 to 0:30 the future.
  Slides must show team name, member names and the challenge.
- **Links:** demo and final project must open with "no logins, permissions, or registrations". English only
  (video may be subtitled). The guide recommends filing a FortiGuard Web Filter Classification request for a
  new website so judges can open it.
- **Form fields:** Project Name; High-Level Project Summary; Link to Project Demo; Link to Final Project;
  Detailed Project Description; Use of Super Intelligence (SI); NASA Data; Space Agency Partner Data and
  Other References. "the majority of judges' evaluation will be based on your project submission" (the page).
- **Licence:** original content must be unrestricted or OSI-licensed; if none is named NASA distributes it
  under Apache 2.0. Third-party material must be freely available or OSI-licensed, and every source cited.
- **Teams:** at most 6 members; one challenge per team.
- **Judging:** 1 to 5 on Impact, Creativity, Validity, Relevance, Presentation. Relevance wants NASA data as
  "a core component ... rather than a superficial addition". Validity includes "usability and
  user-friendliness". The guide says to "pay equal attention to the final criterion: presentation".
- **Awards:** Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission
  Concept, Most Inspirational, Best Storytelling, Global Connection, Art & Technology, Local Impact.
- **Results:** Global Nominees Dec 3, Finalists Dec 17, 2026; Winners Jan 26, 2027.

## 3. The prompt: decisions already made

**Where it goes:** `research/BUILD_PROMPT.md` (this folder). One self-contained file the team gives to their
coding agent at kickoff.

**Planned sections**

1. *Before you paste* (three lines for the team: start time rule, fill in section 2, credentials).
2. *Team inputs, written by the team.* Concept block: place(s) and change; the question and who it is for;
   what a visitor should understand or be able to do; what theirs adds beyond NASA Worldview's NISAR layer;
   name and tagline; local or personal context. Logistics block: deadline, members and roles, hosting, repo,
   Earthdata login status, disk and bandwidth, stack preference. If the concept block is blank the agent asks
   the questions and shows the coverage evidence; it does not choose for them. Feature checklist limited to
   what the challenge text itself names (image sliders, time-series animation, change-detection map,
   dashboard, story map).
3. *Role and working rules for the agent:* engineering partner; the team owns idea and scientific claims;
   when a choice changes what the project is, ask; otherwise decide and report. Keep a short state file
   because the build spans many context windows and possibly several sessions. Keep an AI-use log.
4. *What judges score and what follows from it.*
5. *Verified facts about NISAR data* (section 5 here, condensed, each dated).
6. *Science guardrails* (section 8 here).
7. *Engineering blueprint:* Python pipeline (discover, fetch window, process, export, validate), a manifest
   contract between pipeline and web so two sessions can work in parallel, web app, hosting.
8. *Schedule* in hours from kickoff with gates and a cut list (below).
9. *Quality bar and verification checklist.*
10. *Submission package:* each form field, demo, AI-use statement, citations.
11. *Appendices:* resource links, documented events, tested snippets, coverage table.

**Schedule skeleton (H0 = Sat 9:00)**

- H0 to H1: repo, licence, Earthdata login test, disk and bandwidth test, public "hello map" deployed.
- H1 to H3: thin slice with no-login imagery (GIBS NISAR layer, section 5.6) for the team's place, deployed.
  This is the always-shippable baseline.
- H3 to H8: first real GCOV window on the map; 45-minute bake-off of read paths (section 5.5); pixel query.
- H8 to H14: full date stack, derived layers, charts, compare view. Queue long jobs before people sleep.
- H14 to H22: unattended processing overnight; morning report.
- H22 to H30: interpretation content reviewed by the team, validation against an independent layer, polish,
  mobile, accessibility, methods and credits pages.
- H30 (Sun 15:00): feature freeze. H30 to H36: demo, project page text, link tests in a private window.
- Submit by H36 (Sun 21:00). Hard deadline H39 (Sun 23:59).
- Gates: login not working in 30 min, carry on with the no-login tier; one date taking over 10 min to read,
  switch read path, shrink the area, or use the 80 m frequency B layers.

**Style decisions:** written as a brief to a capable agent, with reasons given; verified facts dated, and
unverified ones labelled; no invented concept; snippets marked tested or untested.

**Review plan:** the user had "ultracode" on (multi-agent workflows expected for substantive steps). Planned:
parallel critics (hackathon judge, SAR scientist, front-end engineer, prompt reader doing a cold-read "what
would stall you in the first two hours"), a fact-checker against this file, then adversarial verification of
each finding before applying it.

## 4. Hands-on verification still running

A background workflow was started at 19:38, was interrupted at 19:46 by the session limit, and restarted
itself at 20:41 (still running at 20:50). It has five checks, each followed by an independent re-check:
`search` (asf_search, earthaccess, raw CMR), `cog` (COG creation options, geotiff.js pixel reads, which local
servers honour Range), `browser` (MapLibre + COG protocol in headless Chrome, swipe, pixel query, NASA browse
PNG overlay), `cookbook` (verbatim code from ASF's NISAR_Cookbook), `harmony` (exact Harmony request code).

- Results will be in
  `~/.claude/projects/-Users-<user>-Documents-<another-folder>/c2a86af5-ec6b-4200-871d-99ccc3f8dde9/subagents/workflows/wf_0472d927-435/journal.jsonl`
  (one JSON line per finished agent, including its structured return value).
- Their scripts and artifacts are under
  `/private/tmp/claude-501/-Users-<user>--claude-spares-spare-wscbkr/c2a86af5-ec6b-4200-871d-99ccc3f8dde9/scratchpad/verify/{search,cog,browser,cookbook,harmony}`.
  That temp folder can be wiped by a reboot.
- If the journal has no results, the prompt can still be written from sections 5 to 7; mark the affected
  snippets "untested" and tell the builder to spike them in the first hours. Questions it was meant to settle:
  MapLibre v5 or v6 with the COG protocol; best way to switch dates smoothly; COG compression geotiff.js can
  decode; exact Harmony request; whether the browse-PNG overlay lines up on a real map.

## 5. Verified facts: NISAR data

Sources: my own queries of NASA's CMR catalog (`https://cmr.earthdata.nasa.gov/search/`), the ASF NISAR Data
User Guide (`https://nisar-docs.asf.alaska.edu/`), the GCOV and GUNW product specifications, ISCE3 source, and
the ASF NISAR Cookbook (`https://github.com/ASFOpenSARlab/NISAR_Cookbook`, Apache-2.0).

### 5.1 Shape of the record

ASF hosts L-band only. S-band is on ISRO Bhoonidhi (registration).

| Maturity | Released | Acquisitions covered | Notes |
|---|---|---|---|
| BETA | 2026-02-27 | subset of frames, 2025-10-17 to 2026-01-20 | uncalibrated, banding, misaligned masks |
| PROVISIONAL | 2026-07-20 | everything from 2026-06-17 to 2026-10-21; selected frames back to 2025-10-29 | calibrated |
| VALIDATED | 2026-11-06 | everything from 2026-10-21 | no soil moisture yet |

- **Worldwide coverage starts 2026-06-17.** GCOV provisional granules per month: 44 to 856 through May 2026,
  then 20,467 (Jun), 36,912 (Jul), 29,883 (Aug), 42,430 (Sep), 28,870 (Oct). Validated: 11,418 (Oct), 2,501 (Nov).
- **Permanent gap:** no data 2026-07-27T22:03Z to 2026-08-10T00:55Z. Most stacks lose one pass.
- **Recent backlog:** production paused Oct 23 to Nov 6; validated GCOV is thin for Nov 7 to 13.
- **The guide says not to mix maturities in one time series.** A clean worldwide series is therefore
  provisional only, about 10 dates per stack (mid-June to mid-October 2026).
- Totals today: GCOV 163,672 provisional, 13,918 validated, 23,527 beta. GUNW 94,150 provisional (standard
  pairs stop at reference date 2026-10-09), 140 validated. SME2 103,943 provisional.
- OPERA products from NISAR (DSWx-NI, DISP-NI) are not available yet.

**CMR collection concept ids** (short names follow `NISAR_L2_GCOV_V1`, `..._PROVISIONAL_V1`, `..._BETA_V1`)

| Product | Validated | Provisional | Beta |
|---|---|---|---|
| GCOV | C3622241360-ASF | C2854338529-ASF | C3622214170-ASF |
| GUNW | C3622247503-ASF | C2854335566-ASF | C2850261892-ASF |
| GSLC | C3622244601-ASF | C2854332392-ASF | C2850259510-ASF |
| GOFF | C3622250865-ASF | C2854341702-ASF | C2850263910-ASF |
| SME2 (L3) | none | C2854344945-ASF | C2850265000-ASF |
| RSLC (L1) | C3622236985-ASF | C2853145197-ASF | C2850225585-ASF |

Urgent Response: `NISAR_UR_L2` C2887502657-ASF, `NISAR_UR_L1` C2887499907-ASF (from 2026-06-17, kept 30 days
per the guide; clusters seen over Hawaii, Panama, Nepal/Tibet/north India, US Gulf states, Alaska, Indonesia).

### 5.2 Products, modes, sizes

- **GCOV** = geocoded, terrain-corrected gamma-naught backscatter, linear power. The product for change in
  land cover, water, vegetation. **GUNW** = geocoded unwrapped interferogram (deformation). **GOFF** = pixel
  offsets (glaciers, large ruptures). **GSLC** = complex images. **SME2** = soil moisture, 200 m.
- Posting by range bandwidth: 20 MHz gives 20 m; 40 MHz gives 10 m; 77 MHz gives 20 m; 5 MHz (frequency B)
  gives 80 m. Frame about 240 x 240 km. Raster sizes: 16704 x 17064 at 20 m, 35928 x 36288 at 10 m,
  4176 x 4266 at 80 m.
- Median file sizes: GCOV 20+5 MHz dual-pol 1.9 GB; GCOV 40+5 MHz dual-pol 6.7 GB; GCOV quad-pol 8.5 GB;
  GUNW 2.4 GB; GOFF 1.2 GB; SME2 0.12 GB; GSLC 12 to 22 GB.
- **Whole-file downloads are usually the wrong move.** Ten dates of a 40+5 MHz stack is about 67 GB.
- Frequency B (80 m) layers are small (about 70 MB uncompressed each) and good for a regional overview.
- Projections: UTM between 60S and 60N; EPSG:3413 north of 60N; EPSG:3031 south of 60S; SME2 in EPSG:6933.

### 5.3 File names and stacks

`NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5`

Fields: level; `PR` production / `UR` urgent response; product; cycle (12 days each); track 001 to 173;
`A`/`D` direction; frame 001 to 176; mode = bandwidth of frequency A then B (`2005`, `4005`, `7700`, `0005`);
polarization, two letters per band (`SH` HH, `DH` HH+HV, `QP` quad, `NA` none); `A` single / `M` mixed mode;
start and end UTC; CRID (`X050xx` beta, `P05023` provisional, `P05036` validated); orbit flag; `F` full or
`P` partial frame; `J` JPL; counter (`_001`, `_002` duplicates exist: keep the highest).
Pair products (GUNW, GOFF) add the secondary cycle and a second pair of timestamps.

A repeat-pass **stack** is track + direction + frame. CMR exposes it as additional attribute `STACK_ID`
(for example `083_A_008`). Other attributes: `TRACK_NUMBER`, `FRAME_NUMBER`, `ASCENDING_DESCENDING`,
`FREQUENCY_A_POLARIZATION_CONCAT`, `RANGE_BANDWIDTH_CONCAT`, `FULL_FRAME`, `PRODUCTION_PIPELINE`,
`PRODUCT_VERSION`, and for GUNW `REFERENCE_ZERO_DOPPLER_START_TIME` / `SECONDARY_...`.

### 5.4 Inside the HDF5 files (not opened by me: no credentials. From spec, guide, Cookbook, ISCE3)

GCOV, `/science/LSAR/GCOV/grids/frequencyA/` (and `frequencyB/`):

| Dataset | Type | Notes |
|---|---|---|
| `HHHH`, `HVHV`, `VHVH`, `VVVV` | float32, NaN fill | gamma0 linear power; dB = 10*log10(x) |
| `HHHV`, `HHVV`, ... | complex64 | quad-pol products only |
| `mask` | uint8, 255 fill | 0 invalid; 1 to 5 valid (sub-swath number); 255 outside |
| `numberOfLooks`, `rtcGammaToSigmaFactor` | float32 | sigma0 = factor x gamma0 |
| `xCoordinates`, `yCoordinates` | float64 | pixel centres in metres, y descending |
| `projection` | uint32 scalar | value is the EPSG code; attribute `epsg_code` |
| `listOfPolarizations`, `listOfCovarianceTerms` | | read these instead of assuming |

Incidence angle is a coarse 3-D cube at `/science/LSAR/GCOV/metadata/radarGrid/incidenceAngle`.
Files are chunked about 512 x 512, gzip, with 4 MiB paged metadata, so HTTP range reads work.

GUNW, `/science/LSAR/GUNW/grids/frequencyA/`: `unwrappedInterferogram/HH/unwrappedPhase` (radians, 80 m),
`.../coherenceMagnitude`, `.../connectedComponents` (uint16, 65535 fill), `.../ionospherePhaseScreen` (not
applied to the phase), `wrappedInterferogram/HH/wrappedInterferogram` (complex, 20 m),
`pixelOffsets/HH/{alongTrackOffset,slantRangeOffset}` (metres), plus masks. GUNW is co-pol, frequency A only.

SME2: `/science/LSAR/SME2/grids/soilMoisture` (m3/m3, fill -9999, 200 m). GOFF:
`.../GOFF/grids/frequencyA/pixelOffsets/HH/layer{1,2,3}/{alongTrackOffset,slantRangeOffset,snr}`.
GSLC: `.../GSLC/grids/frequencyA/{HH,HV}` complex.

### 5.5 Access

- **Login:** free Earthdata Login. `~/.netrc` line `machine urs.earthdata.nasa.gov login <user> password <pw>`,
  or env `EARTHDATA_TOKEN`, or `EARTHDATA_USERNAME` + `EARTHDATA_PASSWORD`. The Cookbook says the account
  must also accept the "Alaska Satellite Facility Data Access" EULA in the Earthdata profile.
- **URLs:** `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/<collection>/<granule>/<granule>.h5` (login).
  S3 `s3://sds-n-cumulus-prod-nisar-products/<collection>/<granule>/<granule>.h5` works only from AWS
  us-west-2, credentials from `https://nisar.asf.earthdatacloud.nasa.gov/s3credentials`, 1 hour lifetime.
- **Search does not need login.** CMR allows cross-origin browser requests (`access-control-allow-origin: *`,
  exposes `CMR-Hits` and `CMR-Search-After`). Tested call:
  `granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=104.05,12.95&page_size=2000&attribute[]=string,STACK_ID,083_A_008`.
  Entries carry `title`, `time_start`, `polygons` ("lat lon lat lon ..."), `granule_size`, and `links` with
  `rel` ending `data#`, `s3#`, `browse#`. A STAC form also exists:
  `https://cmr.earthdata.nasa.gov/stac/ASF/collections/NISAR_L2_GCOV_V1_1/items?bbox=...`.
- **asf_search 14.1.0** (ran live by a research agent):
  `asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV, dataMaturity='PROVISIONAL', productionConfiguration='PR', intersectsWith=<WKT>, start=..., end=..., relativeOrbit=83, frame=8)`.
  Without `productionConfiguration='PR'` urgent-response duplicates come back.
- **earthaccess 0.19.0:** `earthaccess.login()`, `search_data(short_name='NISAR_L2_GCOV_PROVISIONAL_V1', bounding_box=..., temporal=...)`,
  `results[0].data_links(access='external')`, `earthaccess.get_fsspec_https_session()`. In 0.19 `granule.size`
  is a property. For S3 pass `endpoint=` explicitly.
- **Remote partial reads:** the guide's example is
  `xr.open_datatree(fs.open(url, cache_type=..., block_size=...), engine='h5netcdf', decode_timedelta=False, phony_dims='access')`;
  the Cookbook loader uses plain h5py. **Use `cache_type="blockcache", block_size=8*1024*1024`**: a community
  benchmark linked from the Cookbook measured 2 s to open a file that way against 52 s and 4.3 GB of requests
  with the fsspec default.
- **GDAL:** 3.13.0+ georeferences NISAR L2 through the HDF5 driver:
  `HDF5:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH`, with
  `--config GDAL_HTTP_NETRC=YES --config GDAL_HTTP_COOKIEFILE=/tmp/c.txt --config GDAL_HTTP_COOKIEJAR=/tmp/c.txt`.
  Older GDAL needs the `NETCDF:` form. `pip install rasterio` (1.5.2) bundles GDAL 3.12.2. On conda-forge the
  HDF5 driver is the separate package `libgdal-hdf5`.
- **Harmony** (`https://nisar-docs.asf.alaska.edu/harmony`): extracts GCOV, GUNW, GOFF and SME2 variables as
  Cloud-Optimized GeoTIFFs with bounding-box subsetting and reprojection. Needs login. Capabilities endpoint
  confirms support; no job has been run. Exact request code is one of the pending checks.
- No OPeNDAP, no HyP3 jobs for NISAR. OpenSARLab is a free hosted alternative.
- **Three read paths to bake off at kickoff:** Harmony subset to COG; windowed h5py over HTTPS; GDAL 3.13
  `/vsicurl/` with a cutline. Full download only for 20+5 MHz stacks when disk allows.

### 5.6 Imagery that needs no login (all verified by direct fetch)

- **GIBS tiles of NISAR itself.** Layer `NISAR_L2_Geocoded_Polarimetric_Covariance`, "NISAR Normalized Radar
  Backscatter (False Color, GCOV, Best)". Template:
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`
  (y before x, 256 px tiles, max zoom 13). Time ranges in the capabilities file: 2025-10-29 to 2026-03-01,
  03-04 to 03-29, 04-01 to 04-12, 04-14 to 07-27, 08-10 to 11-11. CORS `*`; `cache-control: no-store`.
  A date with no pass returns a 288-byte empty tile, so the app needs the real pass dates from CMR.
  Colours as rendered: water blue, forest green, flooded vegetation yellow (looks like red = HH, green = HV,
  blue = HH/HV ratio; that mapping is my inference). These are 8-bit pictures, not calibrated values.
  Same-day mosaics join different tracks and the seam is visible.
- **NASA Worldview already shows this layer with a time slider and swipe.** A project that only does that
  adds nothing; the team's value has to come from their own idea and analysis.
- **Other GIBS layers, same URL pattern:** `OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1` (C-band
  false colour, Level12), `OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1` and `...-HLS` (Level12),
  `OPERA_L3_DIST-ALERT-HLS_Color_Index`, `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` and `HLS_L30_...` (Level12),
  `MODIS_Terra_CorrectedReflectance_TrueColor` (Level9, jpeg), `OrbitTracks_NISAR_Ascending` / `Descending`
  (vector tiles). Useful for cross-checking and context with zero preprocessing.
- **Per-granule browse PNGs.**
  `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/<collection>/<granule>/<granule>_LATLON.png`, also
  `_LATLON_thumbnail.png` (100 x 100), `_NATIVE.png`, `_NATIVE_A_HHHH.png`, `_NATIVE_A_HVHV.png`. HTTP 200
  without login through a 303 redirect; `access-control-allow-origin: *` on both hops; content type is
  `binary/octet-stream`, so fetch as a blob. RGB, black background, no alpha, about 180 m per pixel. Dual-pol
  renders magenta, green and white (co-pol in red and blue, cross-pol in green); quad-pol looks red = HH,
  green = HV, blue = VV. The matching `.kml` needs login.
- **Browse images of one stack are pixel-aligned**, because each frame has a fixed grid: three Tonle Sap
  dates were all 1880 x 1847. Their map extent can be recovered without the KML by fitting the granule's CMR
  polygon to the non-black footprint (west-most corner to left-most pixel, and so on). Three dates gave the
  same extent to under one pixel: W 102.3865, E 105.5270, N 14.3420, S 11.3330. Visual alignment on a map is
  one of the pending checks.

### 5.7 Known issues that will bite

- Quad-pol frames have permanent along-track black gap bands that shift between dates (seen over Illinois).
- Polarization and bandwidth can change between dates of one stack (HH only on some dates; 20 MHz vs 40 MHz).
  Read `listOfPolarizations`; resample to one grid.
- Mode changes produce partial granules plus a mixed-mode granule. Check `FULL_FRAME`.
- Provisional: ionosphere at high latitudes, residual interference, weaker calibration on frequency B, 1 to 2
  percent of products defocused or misplaced; track/frames 161/174, 161/175, 169/090, 169/091 unusable before
  August 2026; SME2 not fully calibrated.
- GUNW at frame scale is dominated by ramps and can show a seam (seen in a Mexico City 12-day preview): it
  needs the ionosphere screen applied, a local crop, deramping, a stable reference, and coherence masking.
- xarray reads `mask` as float unless decoding is disabled.
- Python's `http.server` is believed not to serve Range requests (pending check), which breaks local COG tests.

### 5.8 Coverage at sample places (my CMR queries; top stacks; B/P/V = beta/provisional/validated counts)

Run `python3 nisar_coverage.py <lon> <lat> [GCOV|GUNW|GOFF|GSLC|SME2]` (in this folder, tested, no login, no
dependencies) for any other place.

| Place (lon, lat) | Best stack | GCOV dates | Span | Mode | File |
|---|---|---|---|---|---|
| Mexico City (-99.1, 19.4) | 019_A_011 | 31 | 2025-10-30 to 2026-11-06 | HH+HV 40+5 | 7.0 GB |
| Kilauea, Hawaii (-155.28, 19.41) | 072_D_079 | 29 | 2025-10-22 to 2026-11-10 | HH+HV 40+5, partial frames | 2.8 GB |
| Central Valley, California (-119.56, 36.1) | 034_A_020 | 27 | 2025-11-24 to 2026-10-26 | HH+HV 40+5 | 7.1 GB |
| Reykjanes, Iceland (-22.4, 63.88) | 159_A_034 | 27 | 2025-11-09 to 2026-10-23 | HH+HV 40+5 | 5.3 GB |
| Punjab, India (75.8, 30.6) | 156_A_017 | 26 | 2025-11-21 to 2026-11-04 | HH+HV 40+5 | 6.9 GB |
| Atchafalaya, Louisiana (-91.45, 30.0) | 084_D_073 | 19 | 2025-10-23 to 2026-10-30 | HH+HV 40+5 | 6.3 GB |
| Grand Forks, North Dakota (-97.4, 47.9) | 099_D_064 | 19 | 2025-10-24 to 2026-10-31 | HH+HV 40+5 | 7.1 GB |
| Chicago (-87.65, 41.85) | 148_A_023 | 18 | 2025-11-08 to 2026-11-03 | quad-pol 20+5 | 8.2 GB |
| Champaign, Illinois (-88.3, 40.2) | 148_A_022 | 18 | 2025-11-08 to 2026-11-03 | quad-pol 20+5 | 8.2 GB |
| Jakobshavn Glacier (-49.6, 69.17) | 170_D_053 | 17 | 2025-10-28 to 2026-10-23 | HH only 77 MHz | 0.9 GB |
| Okavango Delta (22.9, -19.3) | 172_A_168 | 15 | 2025-11-22 to 2026-10-24 | HH+HV 20+5 | 1.9 GB |
| Rondonia, Brazil (-63.5, -10.0) | 068_D_094 | 13 | 2025-11-02 to 2026-10-28 | HH+HV 20+5 | 1.6 GB |
| Tonle Sap, Cambodia (104.05, 12.95) | 083_A_008 | 11 | 2026-06-19 to 2026-10-29 | HH+HV 20+5 | 1.9 GB |
| Sudd, South Sudan (30.7, 7.5) | 050_D_085 | 11 | 2026-06-17 to 2026-10-27 | HH / HH+HV 20+5 | 1.8 GB |
| Mekong Delta (105.6, 10.0) | 047_D_083 | 11 | 2026-06-17 to 2026-10-27 | HH+HV 40+5 | 6.4 GB |
| Mamiraua, Amazon (-65.0, -2.7) | 097_D_090 | 10 | 2025-11-04 to 2026-10-06 | mixed | 1.5 GB |
| Pantanal, Brazil (-57.2, -17.3) | 111_D_097 | 9 | 2026-06-21 to 2026-10-19 | HH / HH+HV 20+5 | 1.9 GB |

The sites with 26+ dates are the "selected frames" that go back to autumn 2025. Stacks with dates before
June 2026 and "B" counts include uncalibrated beta data. In every stack the 18-date and shorter series have a
hole from February to mid-June 2026.

Other products at a point: GUNW Mexico City 019_A_011 has 28 consecutive 12-day pairs (2025-10-30 to
2026-10-13); Kilauea, Central Valley and Reykjanes have 22 to 27 pairs; Tonle Sap 9; Chicago 14. SME2:
Central Valley 26 dates, Punjab 24, Champaign 16, Tonle Sap 10 (about 120 MB each). GOFF: Jakobshavn 14,
Pine Island Glacier 15, Hubbard/Malaspina 15.

Tonle Sap detail: `083_A_008` passes 06-19, 07-01, 07-13, 07-25, 08-18, 08-30, 09-11, 09-23, 10-05, 10-17
(provisional) and 10-29 (validated), all HH+HV full frames at 22:36 UTC (05:36 local). `148_D_082` has 11
dates at 11:31 UTC but alternates HH+HV with HH only.

### 5.9 What the previews actually show (files in `evidence/previews/`)

- Tonle Sap, June 19 against October 29, 2026, in both the browse PNGs and the GIBS tiles: open water spreads
  well beyond the June shoreline and the surrounding flooded-vegetation ring brightens. The seasonal flood
  pulse is clearly visible in NISAR data.
- Illinois quad-pol, August against October 2026: fields darken after harvest; three nodata gap bands cross
  the frame and move between dates.
- Mexico City GUNW, 12-day pair in March 2026: frame-wide ramps and a seam, no obvious local signal without
  processing.

### 5.10 Events inside the record (reported by a research agent from the sources given; not re-checked by me, though the urgent-response clusters in 5.1 are consistent with them)

| Event | Dates | Evidence of NISAR data | Source |
|---|---|---|---|
| Venezuela earthquakes (La Guaira, Caracas), first Urgent Response use | June 2026 | co-seismic GUNW found | science.nasa.gov/earth/earth-observatory/where-venezuelas-earthquakes-shifted-the-ground/ |
| Langtang Lirung collapse, Nepal | 2026-08-26 | GCOV before and after | india.mongabay.com/2026/10/scientists-explore-whether-himalayan-disasters-can-be-anticipated/ |
| Azuero Peninsula, Panama, M7.7 | 2026-10-09 | GUNW 09-27 to 10-09, UR offsets | earthquakeinsights.substack.com/p/surface-rupture-of-the-m77-azuero |
| Gandak River flood, Bihar and Nepal | 2026-09-24 to 29 | GCOV 09-16, 09-28, 10-10 | science.nasa.gov/earth/earth-observatory/rains-swamp-the-gandak-river/ |
| Thunder Bay 36 wildfire, Ontario | from 2026-07-12 | GCOV on six tracks | en.wikipedia.org/wiki/2026_Canadian_wildfires |
| Hayli Gubbi / Erta Ale eruption, Ethiopia | 2025-11-23 | GUNW, year of data | science.nasa.gov/earth/earth-observatory/hayli-gubbis-explosive-first-impression/ |
| Limpopo-Incomati flood, Mozambique | January 2026 | beta only; NASA composite HH red, HV green, HH/HV blue | svs.gsfc.nasa.gov/5661 |
| Mexico City subsidence, over 2 cm a month | 2025-10 to 2026-01 | NASA InSAR result | jpl.nasa.gov/news/us-indian-space-mission-maps-extreme-subsidence-in-mexico-city/ |
| Maize triangle crop season, South Africa | 2025-11 to 2026-03 | 10-pass GCOV composite | science.nasa.gov/earth/earth-observatory/painting-the-growing-season-in-the-maize-triangle/ |
| Hubbard Glacier quake debris | 2025-12-06 | beta GCOV, GOFF | science.nasa.gov/earth/earth-observatory/landslide-and-avalanche-debris-litter-hubbard-glacier/ |

Petermann Glacier calving (2026-08-04) falls in the data gap. Mission timeline: launch 2025-07-30; first
L-band images released 2025-09-25; 12-day exact repeat, left-looking, about 240 km swath, 747 km orbit,
L-band wavelength 24 cm, dawn and dusk passes.

## 6. Verified facts: web stack and hosting (research agent, registries and live probes; hands-on run pending)

- `maplibre-gl` 6.18.0 (2026-11-11) is ESM-only, no default export, WebGL2 only, needs `setWorkerUrl()` with
  bundlers. The v5 line is alive at 5.24.1. Coding agents tend to write v4/v5-style code, so pin v5 unless
  the hands-on test shows v6 is painless.
- `@geomatico/maplibre-cog-protocol` 0.10.0 (MIT; peer maplibre-gl ^4.5 || ^5 || ^6): **COGs must be
  EPSG:3857**; `cog://URL#color:BrewerSpectral9,min,max,c` colour ramps; `setColorFunction(url, fn)` gets
  every band; `locationValues(url, {latitude, longitude}, zoom?)` returns one value per band; undeclared
  nodata is no longer transparent, so declare nodata on the source file. Browser only. Its
  `examples/timeseries.html` animates a 127-band COG and charts the hovered pixel.
- `geotiff` 3.0.5: v3 renamed `image.geoKeys` to `getGeoKeys()`; `readRasters({window, samples, interleave})`
  unchanged. One pixel across 127 pixel-interleaved bands cost a single 164 KB range request.
- `@maplibre/maplibre-gl-compare` is stale (2021) and breaks with ESM MapLibre 6. Working approach: two maps
  kept in sync (`@mapbox/mapbox-gl-sync-move`) with a CSS clip.
- deck.gl 9.4.1 with `@developmentseed/deck.gl-geotiff` 0.10.0 can reproject on the GPU but its API changed
  four times since September. `pmtiles` raster archives are display only (no values).
- Suggested outputs: one single-band COG per date for display, plus one multi-band stack COG for clicks.
- **Hosting:** GitHub Pages serves Range requests (206) with CORS `*`, 100 MiB per file, 1 GB per site.
  Vercel Hobby and Netlify also return 206. **Cloudflare Pages answers Range requests with 200**, so it is
  unsuitable for COGs. Hugging Face dataset `resolve/main` URLs work (206, CORS). GitHub release assets send
  no CORS header. Cloudflare R2 free tier works if a CORS policy is set.
- Keyless basemaps: OpenFreeMap `https://tiles.openfreemap.org/styles/liberty` (also `positron`, `dark`).
  Terrain: `https://tiles.mapterhorn.com/tilejson.json`. ESA WorldCover WMTS at `wmts.terrascope.be`.
- Related open code: NISAR_Cookbook notebooks `NISAR_GCOV_Time_Series_Example`,
  `NISAR_GCOV_SARChangeDetectionMethods`, `util/load_gcov.py` (Apache-2.0); `ASFHyP3/hyp3-nisar-cv`
  (BSD-3); `NISAR-Science-Algorithms/NISAR_Inundation` (Apache-2.0).
- Other versions seen: h5py 3.16.0, xarray 2026.9.0, h5netcdf 1.8.3, rioxarray 0.24.0 (Python 3.13+),
  GDAL 3.13.3.

**This machine:** Node 22.15, npm 10.9, Python 3.12 (Anaconda) with h5py, no GDAL or rasterio, 42 GB free
disk. Anaconda's `curl` fails TLS on spaceappschallenge.org; `/usr/bin/curl` works.

## 7. Challenge resources (exact links from the Resources tab) and what each is good for

| Resource | URL | Use |
|---|---|---|
| Earthdata Search | https://search.earthdata.nasa.gov/search | manual search |
| ASF Vertex | https://search.asf.alaska.edu/ | manual search; has a GDAL snippet exporter |
| NISAR Data User Guide | https://nisar-docs.asf.alaska.edu/ | the technical reference (section 5) |
| Intro to Remote Sensing | https://www.earthdata.nasa.gov/learn/earth-observation-data-basics | citable background |
| Intro to SAR | https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar | scattering and interpretation rules (subpage `/sar/image-interpretation`) |
| ARSET trainings | https://www.earthdata.nasa.gov/data/projects/arset | "Harnessing NISAR" (Jul 2026), "Monitoring Surface Water with SAR" (Oct 2026), "NISAR Surface Displacement" (Nov 2026); slides, no notebooks |
| NISAR StoryMaps | https://science.nasa.gov/mission/nisar/arcgis-storymaps/ | five L-band case studies, CC BY 4.0 |
| Applications White Papers | https://science.nasa.gov/mission/nisar/societal-benefits/ | 26 two-page briefs, framing |
| UAVSAR Postcards | https://uavsar.jpl.nasa.gov/education/postcards.html | credit "Courtesy NASA/JPL-Caltech" |
| CSA RCM data | https://donnees-data.asc-csa.gc.ca/en/dataset/rcm | sample GeoTIFFs without login; archive needs an account |
| CSA SAR python tutorial | https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial | basic; its data folder is empty |
| RADARSAT-1 | https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1 | open COGs: `s3://radarsat-r1-l1-cog/` anonymous |
| SAOCOM catalogue | https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html | test products immediate; catalogue access about a day |
| SAOCOM registration | https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible | |

The submission form encourages Space Agency Partner data. ESA (Sentinel-1 through OPERA layers on GIBS),
CSA and CONAE are partners; ISRO is NISAR's co-owner.

## 8. Science guardrails for the prompt (each traceable to the resources above)

- Compare like with like: same track, direction and frame. Never difference ascending against descending
  (different look direction; passes are near 6 a.m. and 6 p.m. local, so dew and rain differ). ARSET: "do not
  mix angles (use exact repeats)".
- One maturity per time series; beta is uncalibrated. When the same date exists twice, keep validated over
  provisional over beta, and the highest counter.
- Average in linear power, display in dB, and use one fixed stretch for every date (ARSET examples use
  -25 to -8 dB) so that differences are real and not stretch artefacts.
- Speckle: multilook or filter before thresholding; pixel-level changes of 1 to 2 dB are noise.
- How surfaces respond: calm open water dark (specular), but wind-roughened water can be bright; flooded
  vegetation very bright in HH from double bounce, "mostly observable at L-band (NISAR) and much less
  observable at C-band"; growing canopy raises HV (volume scattering); burn or clearing lowers HV; wetter
  soil is brighter until standing water turns it dark; buildings bright and stable; freeze and thaw shift
  backscatter. HH is the key flood channel, HV the key fire and crop channel. L-band reaches trunks where
  C-band stops in the upper canopy; biomass saturation about 40 t/ha at L against 20 t/ha at C.
- No universal dB threshold exists for water or flooded vegetation ("will vary depending on the study
  site"). Taught approaches: log-ratio (difference of dB images after a 50 m mean filter, flag beyond 1.5
  standard deviations of the difference image); after/before ratio above 1.25; sample class means then
  threshold; multi-date RGB with one date per channel.
- Confusions to rule out: shadow, wind and smooth fields against open water; urban areas and topography
  against flooded vegetation; moisture differences against structural change.
- InSAR: one fringe is half a wavelength, 12 cm of line-of-sight motion; unwrapped phase at 80 m, wrapped at
  20 m; line of sight is not vertical; check the sign convention against a known signal. Offsets (GOFF) for
  fast glaciers and metre-scale ruptures.
- Corroborate with one independent source (OPERA surface water or Sentinel-1 on GIBS, optical HLS, gauges,
  rainfall, news) and state where it disagrees. Write site interpretations as hypotheses; the challenge asks
  teams to "Hypothesize the physical drivers", say which polarizations show the change, and name future
  NISAR applications.

## 9. What is not verified

- No HDF5 product was opened (no credentials). Paths come from the spec, guide, Cookbook and ISCE3.
- No Harmony job was run. No authenticated download was timed.
- The GIBS colour mapping is inferred from how tiles look.
- The events in 5.10 were not independently re-checked.
- The web stack has been checked against registries and docs, not yet in a browser (pending, section 4).
- Which form fields are mandatory.

## 10. Next steps for whoever continues

1. Read section 4's journal file; fold in whatever finished. If the temp folders are gone, skip it.
2. Write `research/BUILD_PROMPT.md` following section 3, drawing facts from sections 5 to 8. Keep the
   concept block empty for the team. Include `nisar_coverage.py` as a tested appendix snippet.
3. Review it (section 3, review plan), fix what survives verification.
4. Tell the user, briefly: the two rules in section 2; do not run the prompt before 9:00 a.m. Saturday; the
   concept block is theirs; tonight they may still do account setup (Earthdata Login, the ASF EULA, a
   `.netrc`) and research, including checking places with the coverage script.
