<!-- STATUS: version 1, 2026-11-13 evening. Hands-on verification results and review not yet folded in. See CHECKPOINT.md. -->

# Build brief: a NISAR surface-change app, built during the hackathon

NASA Space Apps Challenge 2026 · challenge "Dancing with the SARs" · brief prepared 2026-11-13

> **Team: this box is for you, not for the agent.**
>
> 1. **Do not give this brief to a coding agent before kickoff** (Saturday 14 November, 9:00 a.m. local).
>    The FAQ says "Teams are not allowed to begin working on the challenges prior to the hackathon," and the
>    organizers add "Working ahead of the hackathon can lead to disqualification." Before kickoff you may
>    choose a challenge, review the resources, research the topic and form your team. Reading this brief and
>    checking data coverage for places you care about is research. Building is not allowed yet.
> 2. **Section 1 is for the concept.** This brief contains research, engineering and logistics, and no
>    concept. Write the place, the change, the audience and the angle into Section 1. Appendices A and B
>    hold the data facts to decide with.
> 3. **Have ready at kickoff:** an Earthdata Login account (free, urs.earthdata.nasa.gov) for whoever runs
>    the data pipeline, with the "Alaska Satellite Facility Data Access" agreement accepted in the profile; a
>    `~/.netrc` line or a token for it; push access to the repository for every teammate.

---

## 0. Orientation

You are the engineering partner of a student team (at most six people) in the 2026 NASA Space Apps
Challenge. Their challenge, "Dancing with the SARs", asks teams to "build an interactive application that
uses radar remote sensing data from the NASA-ISRO Synthetic Aperture Radar (NISAR) mission to track and
visualize one or more types of surface change at locations around the world." The organizers want "an
open-source, user-friendly solution that translates complex radar observations into actionable insights" for
scientists, resource managers, educators, decision-makers and the public. The statement also asks teams to
"Hypothesize the physical drivers behind what you see (or don't see) in the SAR data," to say which
polarizations highlight the changes, and to name future applications of NISAR.

The hackathon runs from **Saturday 14 November 2026, 9:00 a.m. to Sunday 15 November, 11:59 p.m.**, in the
local time of the team's Local Event: 39 hours. Anything saved after the deadline is not judged.

**Check the clock before anything else.** If it is not yet 9:00 a.m. on Saturday, do not write project code
or process data. Tell the team, and limit yourself to what the rules allow before kickoff: helping them
review resources and research.

This brief was prepared the evening before kickoff from live checks of NASA's catalog, tile services and
documentation. Facts are dated 2026-11-13. Anything marked *unverified* was read in documentation but not
run; test it before you build on it. The full evidence trail is in `research/CHECKPOINT.md`, with saved
copies of the rule pages in `research/evidence/rules/` and example imagery in `research/evidence/previews/`.

The brief is long because it is a reference, not a script. Sections 1 to 3 say what the team wants and how
you work together. Sections 4 and 5 are the facts and the science you must not get wrong. Sections 6 to 9
are the engineering plan, the schedule, the finish line and the submission. Section 10 tells you what to do
in the first hour.

---

## 1. Team inputs

Treat this section as the source of truth for what the project is. If any line of 1.1 is empty when you
start, ask the team for it and work on Section 10's setup tasks meanwhile.

### 1.1 Our concept

- **Place or places** (name plus rough coordinates or a bounding box):
- **The change we want to show there, and over what dates:**
- **Why it matters and who it is for:**
- **What a visitor should understand or be able to do after two minutes:**
- **What ours adds that NASA Worldview does not** (Worldview already shows a NISAR false-colour layer with a
  time slider and swipe):
- **Our hypotheses about the physical drivers:**
- **Local or personal context we will add:**
- **Features we want** (the challenge names these; tick what applies and add your own):
  - [ ] before/after image slider
  - [ ] time-series animation
  - [ ] change-detection map
  - [ ] click a place to chart its history
  - [ ] dashboard numbers
  - [ ] guided story
  - [ ] other:
- **Project name and tagline:**

### 1.2 Logistics

- **Kickoff and deadline:** Sat 14 Nov 09:00 to Sun 15 Nov 23:59, local time of our Local Event (time zone: ____ )
- **Team members and roles** (who decides science questions, who owns the demo, who runs the pipeline):
- **Repository:** https://github.com/runny24/NASA-space-apps-2026 (local clone: `~/Documents/GitHub/NASA-space-apps-2026`)
- **Hosting** (default GitHub Pages):
- **Earthdata Login ready, agreement accepted, `.netrc` or token in place?**
- **Machines:** one known laptop has macOS, Node 22, Python 3.12, no GDAL, about 42 GB free disk. Others:
- **Network speed where we will work:**
- **Stack preferences or things we already know well:**
- **Demo format:** 30-second video or 7 slides:

---

## 2. Working agreements

**Who owns what.** The team owns every scientific claim. You own the engineering:
getting data, processing it correctly, building and deploying the app, and keeping the schedule honest.
When a choice changes what the project *is* (which place, which change, what the visitor does, what the
project claims), put it to the team as a short question with the facts they need. When a choice is about
*how* to build what they asked for, decide, do it, and say what you chose in your next status note. If the
team's concept turns out to be infeasible (no data for that place or period, a signal that is not there),
report what the data shows and what nearby variants the data would support, and let them choose.

**Make the team able to explain their own project.** Judges assess originality and intent, and the team
will be asked questions. Keep `docs/HOW_IT_WORKS.md` current in plain language: where each number comes
from, what each layer means, what was assumed. Write interpretive text for the app, clearly labelled as
unchecked, for the team to rewrite in their own words; do not ship a site-specific scientific claim that no
teammate has read and agreed with.

**Be honest about the data.** Never invent values, dates or imagery. Never present quick-look pictures as
measurements (Section 4.6). Show missing passes as missing. Where something is uncertain, say so in the app
and in the methods page.

**AI disclosure is a rule here, not a courtesy.** The submission guide requires teams to "clearly indicate
where and how" AI tools were used: generated images and videos "Must include a visible watermark", and
audio, code and data "Must acknowledge SI generation in descriptive text and metadata" (the 2026 pages call
AI "Super Intelligence (SI)"). It also says "Generated content may not use, contain, or modify any NASA
branding or design elements (such as the NASA logos, flags, or mission identifiers)." So:

- Keep `AI_USE.md` as a running log: what you wrote or generated, with dates. The team will answer the
  "Use of SI" form field from it.
- Acknowledge AI assistance in descriptive text (README section, About page in the app) and in metadata
  (commit trailers on AI-written commits, a `generator` block in the data manifest, a tag in exported
  rasters).
- Do not generate decorative images, video or audio. Every picture in the app should be real data or a
  diagram drawn in code. If the team does add a generated image or video, it needs a visible watermark.
- No NASA logos, flags or mission patches anywhere in the app or the demo. Credit NASA, ISRO and ASF in
  text.

**Licence and citations.** Original content must be unrestricted or under an OSI licence; if none is named,
NASA distributes it under Apache 2.0, so add an Apache-2.0 `LICENSE` unless the team prefers another OSI
licence. Third-party code and data must be freely available or OSI-licensed. The form requires listing
"all of the data, resources, and tools used," including code, text and images. Keep `docs/SOURCES.md` up to
date as you go: every dataset, library, basemap, tutorial and snippet, with URL and licence.

**Stay shippable.** A public URL with something real on it should exist within the first three hours and
never go dark after that. Work in thin vertical slices: one date on the map end to end before ten dates,
one layer before five. Time-box every investigation and write down the fallback before you start it.
Section 7 lists the gates and what to cut.

**Keep state on disk.** This build will outlast your context window and may be split across several
sessions and teammates. Keep `PROGRESS.md` at the repository root: current phase, what is deployed and
where, decisions made and why, what is in flight, open questions for the team. Update it at every gate and
before any long-running job. Commit small and often, so the history shows the work happening during the
event.

**Verify by running.** Do not report something as working until you have run it: open the deployed page,
look at the map, click it, read the console. For numeric code, write a test before you trust it. When you
report, separate "ran it and saw this" from "expected to work".

**Talk to the team in short notes.** At each gate: what is live (with the URL), what you verified, what is
next, and at most three decisions you need, each with your recommendation. If nobody answers, proceed on
your recommendation for engineering choices and keep working around the question for concept choices.

**Secrets and bulk data.** Credentials live in `~/.netrc` or environment variables, never in the
repository. Raw downloads and intermediate rasters are git-ignored. Only web-ready outputs are committed or
uploaded.

**Several sessions at once.** If the team runs more than one agent, split along the data contract in
Section 6.4: one session owns `pipeline/`, one owns `web/`, and they meet at `manifest.json`. The web
session starts against the no-login imagery in Section 4.6 and a mock manifest, so nobody waits.

---

## 3. How the project is judged

Each project is scored 1 to 5 on five criteria. The official wording, and what follows from it:

| Criterion | Official wording (excerpt) | What it means for the build |
|---|---|---|
| Impact | "addressing either a minor or major problem"; how far it "inspires or helps others" | The app should make clear who uses it and what they can now do |
| Creativity | "a novel concept" or "an improvement upon existing ideas in a meaningful way" | Comes from the team's concept. A plain slider over NASA's own tiles is what Worldview already offers |
| Validity | "grounded in scientific principles"; "technical, functional, or logical feasibility"; "usability and user-friendliness" | Correct processing, honest limits, a working deployed app that a newcomer can use |
| Relevance | "fully and directly addresses the challenge"; NASA data "as a core component ... rather than a superficial addition" | Real NISAR measurements at the centre, with the analysis visible |
| Presentation | "clearly conveying the challenge, their proposed solution, and its significance"; judged on "the demo and full project" | The project page, the demo and the app's own first screen |

The guide tells teams to "pay equal attention to the final criterion: presentation," and the submission
guide says "the majority of judges' evaluation will be based on your project submission" (the project page).
Plan real hours for the page and the demo. The demo is "a 7-slide presentation (including title and
introductory slides) or a 30-second or less video," and "Projects that exceed these limits will not be
eligible for Global Judging."

A judge will probably spend a few minutes at most: read the summary, watch 30 seconds, open the link. The
first screen of the app has to show real data and say what the visitor is looking at without a tutorial.

---

## 4. What is true about NISAR data today (2026-11-13)

NISAR is a NASA-ISRO radar satellite launched 2025-07-30. Its L-band radar (24 cm wavelength) repeats the
same ground track every 12 days, on both ascending and descending passes near 6 a.m. and 6 p.m. local time,
looking left, with a swath of about 240 km. The Alaska Satellite Facility (ASF) distributes the L-band data.

### 4.1 The record is short and uneven

| Release | Acquisitions it covers | Notes |
|---|---|---|
| BETA | a subset of frames, 2025-10-17 to 2026-01-20 | uncalibrated; radiometric banding; misaligned masks |
| PROVISIONAL | every acquisition from 2026-06-17 to 2026-10-21, plus selected frames back to 2025-10-29 | calibrated |
| VALIDATED | every acquisition from 2026-10-21 | released 2026-11-06; no soil-moisture product yet |

- **Worldwide coverage begins 2026-06-17.** Before that, only a few hundred frames a month exist, at
  selected sites. Appendix A shows which.
- **There is a permanent hole** from 2026-07-27 22:03 UTC to 2026-08-10 00:55 UTC. Most places lose one pass.
- **Production paused from 23 October to 6 November.** Validated products for 7 to 13 November are still thin.
- **The data guide says not to mix releases in one time series.** A clean worldwide series is provisional
  only: about ten dates per track from mid-June to mid-October 2026. If the team wants later validated dates
  in the same series, mark them as a different release in the app and check a stable target (dense forest,
  a city) for an offset across the boundary before comparing.
- Derived products that would do the analysis for you (OPERA surface water or displacement from NISAR) are
  not available yet.

### 4.2 Products

| Product | What it is | Typical file |
|---|---|---|
| L2 GCOV | geocoded, terrain-corrected gamma-naught backscatter in linear power; the product for water, vegetation and land-cover change | 1.9 GB (20+5 MHz dual-pol), 6.7 GB (40+5 MHz), 8.5 GB (quad-pol) |
| L2 GUNW | geocoded unwrapped interferogram, for ground deformation | 2.4 GB |
| L2 GOFF | pixel offsets, for glaciers and metre-scale ruptures | 1.2 GB |
| L3 SME2 | soil moisture at 200 m, provisional only, not fully calibrated | 0.12 GB |
| L2 GSLC | geocoded complex images | 12 to 22 GB; avoid |

GCOV pixel spacing depends on the radar mode: 20 MHz gives 20 m, 40 MHz gives 10 m, 77 MHz gives 20 m.
Most products also carry a second band, "frequency B", at 5 MHz and 80 m; its layers are small and suit a
regional overview. A frame is about 240 by 240 km: 16704 x 17064 pixels at 20 m, 35928 x 36288 at 10 m.

**Downloading whole files is usually the wrong move.** Ten dates of a 40+5 MHz stack is about 67 GB. Read
only the window you need (Section 6.2).

CMR collection concept ids (short names are `NISAR_L2_GCOV_V1`, `NISAR_L2_GCOV_PROVISIONAL_V1`,
`NISAR_L2_GCOV_BETA_V1`, and likewise for the others):

| Product | Validated | Provisional | Beta |
|---|---|---|---|
| GCOV | C3622241360-ASF | C2854338529-ASF | C3622214170-ASF |
| GUNW | C3622247503-ASF | C2854335566-ASF | C2850261892-ASF |
| GOFF | C3622250865-ASF | C2854341702-ASF | C2850263910-ASF |
| SME2 | none | C2854344945-ASF | C2850265000-ASF |

### 4.3 File names and stacks

`NISAR_L2_PR_GCOV_033_083_A_008_2005_DHDH_M_20261017T223633_20261017T223708_P05023_N_F_J_001.h5`

Reading left to right: level; `PR` production (`UR` is urgent response); product; 12-day cycle number;
track (001 to 173); `A` ascending or `D` descending; frame (001 to 176); mode, the bandwidth of frequency A
then B (`2005`, `4005`, `7700`, `0005`); polarization, two letters per band (`SH` = HH, `DH` = HH+HV, `QP` =
quad, `NA` = absent); `A` single or `M` mixed mode; start and end time in UTC; processing version (`X050xx`
beta, `P05023` provisional, `P05036` validated); orbit flag; `F` full or `P` partial frame; `J` for JPL; a
counter. Pair products add the secondary cycle and a second pair of times.

A **stack** is one track, direction and frame: the set of images taken from the same position, which is the
only kind you may compare directly. CMR exposes it as the additional attribute `STACK_ID` (for example
`083_A_008`), alongside `FREQUENCY_A_POLARIZATION_CONCAT`, `RANGE_BANDWIDTH_CONCAT`, `FULL_FRAME` and
`PRODUCTION_PIPELINE`. When the same acquisition appears twice, keep validated over provisional over beta,
then the highest counter.

### 4.4 Inside the files (*unverified against a real file: no credentials were available. Taken from the product specification, the data guide, ASF's notebooks and the processor source.*)

One HDF5 file per granule. For GCOV, under `/science/LSAR/GCOV/grids/frequencyA/` (and `frequencyB/`):

| Dataset | Type | Notes |
|---|---|---|
| `HHHH`, `HVHV`, `VHVH`, `VVVV` | float32, NaN fill | gamma-naught, linear power. dB = 10 * log10(value) |
| `HHHV`, `HHVV`, ... | complex64 | off-diagonal terms, quad-pol products only |
| `mask` | uint8, 255 fill | 0 invalid; 1 to 5 valid (the sub-swath number); 255 outside the image |
| `numberOfLooks` | float32 | |
| `rtcGammaToSigmaFactor` | float32 | sigma-naught = factor x gamma-naught |
| `xCoordinates`, `yCoordinates` | float64 | pixel centres in metres; y descends |
| `projection` | uint32 scalar | its value is the EPSG code (also in attribute `epsg_code`) |
| `listOfPolarizations`, `listOfCovarianceTerms` | | read these; do not assume what a file contains |

Projections are UTM between 60°S and 60°N, EPSG:3413 north of that, EPSG:3031 south of it. Files are chunked
at about 512 x 512 with gzip and 4 MiB metadata pages, which is what makes partial reads over HTTP practical.

For GUNW, under `/science/LSAR/GUNW/grids/frequencyA/`: `unwrappedInterferogram/HH/unwrappedPhase` (radians,
80 m), `.../coherenceMagnitude`, `.../connectedComponents`, `.../ionospherePhaseScreen` (provided but not
applied), `wrappedInterferogram/HH/wrappedInterferogram` (complex, 20 m), and
`pixelOffsets/HH/{alongTrackOffset,slantRangeOffset}` (metres). Soil moisture is at
`/science/LSAR/SME2/grids/soilMoisture` (m³/m³, fill -9999).

The first thing to do with the first real file is print its tree and compare it with this table. Trust the
file.

### 4.5 Access

- **Search needs no login.** NASA's CMR API allows cross-origin browser requests. Verified call:
  `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF&collection_concept_id=C3622241360-ASF&point=<lon>,<lat>&page_size=2000`
  with optional `&attribute[]=string,STACK_ID,083_A_008`. Each entry has `title`, `time_start`, `polygons`
  (one string of "lat lon lat lon ..."), `granule_size` and `links` (those whose `rel` ends in `data#`, `s3#`
  or `browse#`). Page with the `CMR-Search-After` response header. `research/nisar_coverage.py <lon> <lat>
  [GCOV|GUNW|GOFF|SME2]` is a tested, dependency-free script that prints every stack and its dates for a point.
- **Data needs a free Earthdata Login**, supplied through `~/.netrc`
  (`machine urs.earthdata.nasa.gov login <user> password <password>`), or `EARTHDATA_TOKEN`, or
  `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`. ASF's notebooks say the account must also have accepted the
  "Alaska Satellite Facility Data Access" agreement. Without login the data URL redirects to a sign-in page.
- **URLs:** `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/<collection>/<granule>/<granule>.h5`. The S3
  form only works from inside AWS us-west-2, so ignore it on a laptop.
- **Python search libraries** (both ran live on 2026-11-13): `asf_search` 14.1.0 and `earthaccess` 0.19.0.

  ```python
  import asf_search as asf
  results = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
                       dataMaturity='PROVISIONAL', productionConfiguration='PR',
                       intersectsWith='POINT(104.05 12.95)', relativeOrbit=83, frame=8)
  ```

  Without `productionConfiguration='PR'` you also get urgent-response duplicates. In `earthaccess` 0.19,
  `granule.size` is a property, and `login()` must be called explicitly.
- **Three ways to get just your window**, to be compared in a 45-minute bake-off at the start (Section 6.2):
  1. *Partial read over HTTPS with `h5py`.* `earthaccess.get_fsspec_https_session()` then
     `fs.open(url, cache_type="blockcache", block_size=8*1024*1024)`. The cache setting matters: a benchmark
     linked from ASF's notebooks measured 2 seconds to open a file this way against 52 seconds and 4.3 GB of
     requests with the default. (*unverified here*)
  2. *NASA Harmony.* The data guide (`https://nisar-docs.asf.alaska.edu/harmony`) says it extracts GCOV,
     GUNW, GOFF and SME2 layers as Cloud-Optimized GeoTIFFs with bounding-box subsetting and reprojection.
     Needs login. (*unverified: no job was run*)
  3. *GDAL 3.13 or later*, which georeferences NISAR Level 2 through its HDF5 driver:
     `HDF5:"/vsicurl/https://...h5"://science/LSAR/GCOV/grids/frequencyA/HHHH` with
     `--config GDAL_HTTP_NETRC=YES --config GDAL_HTTP_COOKIEFILE=/tmp/c.txt --config GDAL_HTTP_COOKIEJAR=/tmp/c.txt`.
     Note that `pip install rasterio` bundles GDAL 3.12, which needs the older `NETCDF:` form, and on
     conda-forge the HDF5 driver is the separate package `libgdal-hdf5`. (*unverified here*)

  A full download is reasonable only for 20+5 MHz stacks (about 2 GB a date) when disk and bandwidth allow.

### 4.6 NISAR imagery that needs no login and no processing (all fetched directly on 2026-11-13)

- **NASA GIBS serves NISAR as map tiles.** Layer `NISAR_L2_Geocoded_Polarimetric_Covariance`
  ("NISAR Normalized Radar Backscatter (False Color, GCOV, Best)"):

  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`

  Note the order `{z}/{y}/{x}`. Tiles are 256 px, maximum zoom 13, cross-origin allowed, served with
  `cache-control: no-store`. Dates available: 2025-10-29 to 2026-11-11 with the gaps above. A date with no
  pass over your area returns an empty 288-byte tile rather than an error, so take the list of real pass
  dates from CMR. The rendering looks like red = HH, green = HV, blue = HH/HV ratio (water blue, forest
  green, flooded vegetation yellow); that mapping is inferred from the tiles, so confirm it in the layer
  documentation before describing it in the app. Tiles from different tracks on the same day are mosaicked
  and the seam shows.
- **These tiles are pictures, not measurements.** They are 8-bit renderings with an unknown stretch. Use
  them for context, for a first deployed slice, and for exploring places you have not processed. Do not
  compute change from them or chart their colours as if they were backscatter.
- **NASA Worldview already shows this layer with a time slider and a swipe tool.** The team's project has
  to add something Worldview does not.
- **Other GIBS layers on the same URL pattern**, useful for context and cross-checks:
  `OPERA_L2_Radiometric_Terrain_Corrected_SAR_Sentinel-1` (C-band radar, false colour),
  `OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1` and `OPERA_L3_Dynamic_Surface_Water_Extent-HLS`
  (independent surface-water maps), `OPERA_L3_DIST-ALERT-HLS_Color_Index` (vegetation disturbance),
  `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` and `HLS_L30_Nadir_BRDF_Adjusted_Reflectance` (optical), all on
  `GoogleMapsCompatible_Level12`; `MODIS_Terra_CorrectedReflectance_TrueColor` on
  `GoogleMapsCompatible_Level9` with `.jpg`. Check each layer's dates in
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`.
- **Every granule has public preview PNGs:**
  `https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/<collection>/<granule>/<granule>_LATLON.png` (about
  180 m per pixel, RGB on black, no transparency), plus `_LATLON_thumbnail.png` (100 x 100). They arrive
  through a redirect with cross-origin headers on both hops and content type `binary/octet-stream`, so fetch
  them as a blob. Previews from the same stack share one fixed grid and are pixel-aligned with each other.
  The matching `.kml` needs login, but the image's extent can be recovered by fitting the granule's CMR
  polygon to the non-black footprint in the image; three dates of one stack gave the same extent to within a
  pixel.

### 4.7 Things that will bite

- **Polarization and mode change between dates of one stack.** Some dates are HH only; some switch between
  20 and 40 MHz. Read `listOfPolarizations` and resample everything to one grid.
- **Quad-pol frames have permanent black gap bands** along the track, and they shift between dates.
- **Partial frames exist** (`FULL_FRAME` = FALSE), and mode changes produce a partial granule plus a
  mixed-mode one. Check that your area is inside the footprint on every date.
- **Provisional data:** ionosphere effects at high latitudes, some residual interference, weaker
  calibration on frequency B, and 1 to 2 percent of products defocused or misplaced. Track/frames 161/174,
  161/175, 169/090 and 169/091 are unusable before August 2026. Look at every date before trusting it.
- **Interferograms are not plug-and-play.** A 12-day GUNW preview over a whole frame showed long ramps and a
  seam. Getting ground motion out needs the ionosphere screen applied, a local crop, a ramp removed, a
  stable reference point and a coherence mask (Section 5).
- **Do not difference ascending against descending passes**, and do not treat beta data as calibrated.

---

## 5. Getting the science right

These points come from the challenge's own resources (NASA's SAR introduction, the ARSET trainings, the
NISAR StoryMaps and data guide). Follow them even when a shortcut would look fine on screen.

**Compare like with like.** Only difference images from the same stack. Ascending and descending passes see
the ground from opposite sides at different times of day, so dew, rain and geometry all differ. The ARSET
material says plainly: "do not mix angles (use exact repeats)".

**Work in linear power, show in decibels.** Average, multilook and resample the linear values, then convert
with 10 * log10. Use one fixed display range for every date of a layer (the ARSET examples stretch -25 to
-8 dB) so that a difference between dates is a difference in the ground and not in the stretch.

**Respect speckle.** Radar images are grainy by nature. Multilook or filter before thresholding. A
single-pixel change of 1 to 2 dB is noise; averages over fields or polygons are far more trustworthy.

**How surfaces respond at L-band**

| Surface or event | What the radar sees |
|---|---|
| Calm open water | very dark (the signal reflects away); wind-roughened water can be bright |
| Flooded vegetation | very bright in HH (double bounce between water and stems); "mostly observable at L-band (NISAR) and much less observable at C-band" |
| Growing canopy or crops | HV rises (volume scattering) |
| Clearing, burning, harvest | HV falls |
| Wetter soil | brighter in both channels, until standing water turns it dark |
| Buildings | bright and stable (corner reflection) |
| Freeze and thaw | backscatter shifts notably |

HH is the key channel for flooding; HV for fire, forest loss and crops. L-band reaches branches and trunks
where C-band stops in the upper canopy, which is the main thing NISAR adds over Sentinel-1.

**There is no universal threshold.** The StoryMap on floods says the value "will vary depending on the study
site". The methods the trainings teach: the log-ratio (subtract two dB images after a roughly 50 m mean
filter and flag pixels beyond about 1.5 standard deviations of the difference image); an after/before
ratio; sampling known examples of each class and thresholding between them; and a multi-date colour
composite with one date per channel. Whatever the team uses, derive the numbers from this site's data, show
them, and say how they were chosen.

**Rule out the usual confusions.** Radar shadow, calm wind and smooth fields can pass for open water. Urban
areas and steep terrain can pass for flooded vegetation. A moisture difference between two dates can pass
for a change in vegetation structure.

**Deformation, if the team chooses it.** One interferometric fringe is half a wavelength, about 12 cm of
motion along the radar's line of sight, which is not vertical. Unwrapped phase is at 80 m. Check the sign
convention against a signal whose direction is known before publishing a map. For fast glaciers and
metre-scale ruptures, use the offset product instead.

**Corroborate.** Compare the result with at least one independent source: the OPERA surface-water or
Sentinel-1 layers on GIBS, optical imagery, river gauges, rainfall, field reports or news. Say where they
agree and where they do not. A stated disagreement is worth more to a scientist judging validity than a
clean picture.

**Write interpretations as hypotheses.** The challenge asks teams to hypothesize drivers, so the app should
say "consistent with" and "we think this is because", and name what would confirm it.

---

## 6. Engineering blueprint

A default that works; deviate when you have a reason, and say so. The shape: an offline Python pipeline
turns NISAR products into small web-ready rasters and JSON, and a static web app reads them directly. No
server at demo time means nothing to crash while a judge is watching.

### 6.1 Repository layout

```
pipeline/            Python: discover, fetch, process, export, validate
  sites/<site>.yaml  one config per place: bounding box, stack, dates, layers
web/                 the app (Vite + TypeScript)
  public/data/       web-ready outputs: COGs, manifest.json, stats
docs/                HOW_IT_WORKS.md, METHODS.md, SOURCES.md, demo script
research/            pre-kickoff research (this brief, evidence, coverage script)
AI_USE.md  PROGRESS.md  LICENSE  README.md
```

Use a project-local Python environment with pip wheels: `h5py`, `numpy`, `scipy`, `pyproj`, `rasterio`,
`rio-cogeo`, `earthaccess`, `asf_search`. Reading with `h5py` and writing with `rasterio` avoids any
dependency on a system GDAL, which matters when teammates are on different machines.

### 6.2 Pipeline stages

1. **Discover.** From the team's place, query CMR for every stack and date. Choose one stack per place:
   most dates within a single release, the polarizations the concept needs on every date, the area fully
   inside the footprint each time, one bandwidth mode if possible. Write the chosen granule list (names,
   URLs, dates, processing version) to a file and commit it, so the choice is reproducible and citable.
2. **Fetch the window.** For each date read only the area of interest: the covariance terms needed
   (`HHHH`, `HVHV`, ...), `mask`, and the coordinate arrays. Save each as a local float32 GeoTIFF in the
   product's native projection, in a git-ignored folder. Make it idempotent and resumable (skip what exists
   and validates), run two to four dates in parallel, and log seconds and bytes per date.
   - *Bake-off:* spend at most 45 minutes trying the three access paths in Section 4.5 on one date. Pick
     the first that reads your window in under about ten minutes, and write the timing in `PROGRESS.md`.
   - *If nothing is fast enough:* shrink the area, switch to the 80 m frequency B layers, or download whole
     files for a 20+5 MHz stack overnight.
   - *Sizing:* a 100 x 100 km window is 5000 x 5000 pixels at 20 m (100 MB per layer in memory) and four
     times that at 10 m. Multilook 10 m data to 20 m or coarser as you read it.
3. **Process.** Mask invalid pixels (keep `mask` 1 to 5, finite, greater than zero). Multilook in linear
   power to the working resolution. Put every date on one identical grid; dates of one stack should already
   share it, so assert that instead of assuming. Convert to dB. Then compute whatever the team's concept
   calls for, using the methods in Section 5.
4. **Check before exporting.** For each date plot a histogram and a thumbnail and look at them. Pick a
   target that should not change (dense forest, a city) and confirm its mean stays within about 1 dB across
   dates; a jump means a calibration, mode or release problem, not a change on the ground.
5. **Export** (Section 6.3) and write the manifest (Section 6.4).
6. **Validate** against an independent source and record the comparison in `docs/METHODS.md`.

Write tests for the parts that silently go wrong: the dB conversion, masking, the window arithmetic (y
descends), and the round trip through the 8-bit encoding.

### 6.3 Web-ready outputs

- **One Cloud-Optimized GeoTIFF per date per layer for display.** 8-bit, in EPSG:3857 with web-map tiling,
  internal overviews, nodata 0 declared in the file. The browser library that reads COGs directly requires
  EPSG:3857, and since its 0.10 release it only treats *declared* nodata as transparent, so set nodata on
  the source before reprojecting.
- **Encoding.** Store dB as `1 + round(254 * (dB - lo) / (hi - lo))`, clipped to 1..255, with 0 for nodata,
  and record `lo` and `hi` in the manifest so the browser can turn pixel values back into dB. Over a 25 dB
  range that is 0.1 dB per step, finer than the noise.
- **One multi-band COG per channel for click queries**, with one band per date and pixel interleaving, so a
  single range request returns a pixel's whole history. A coarser resolution is fine here.
- **Budget.** GitHub Pages allows 100 MiB per file and 1 GB per site. Aim for a few hundred megabytes in
  total; check with `du` before every deploy.
- **Small JSON** for anything charted: per-date statistics, areas, class counts.

### 6.4 The data contract

`web/public/data/manifest.json` is the only thing the app needs to know about the data. Adding a place
should mean running the pipeline with a new config and nothing else. A sketch; refine it, then keep both
sides honest to it:

```json
{
  "schema": 1,
  "generator": { "ai_assisted": true, "note": "Processing code written with AI assistance; see AI_USE.md" },
  "sites": [{
    "id": "site-id", "title": "...", "bounds": [0, 0, 0, 0],
    "source": { "product": "NISAR L2 GCOV", "collection": "NISAR_L2_GCOV_PROVISIONAL_V1",
                "stack": "083_A_008", "direction": "ascending", "posting_m": 20, "working_resolution_m": 40 },
    "dates": [{ "date": "2026-06-19", "granule": "NISAR_L2_PR_GCOV_...", "version": "P05023", "pols": ["HH", "HV"] }],
    "missing_passes": [{ "date": "2026-08-06", "reason": "instrument data gap, 27 July to 10 August 2026" }],
    "layers": [{ "id": "hh", "title": "HH backscatter", "kind": "per-date", "unit": "dB",
                 "encoding": { "nodata": 0, "lo": -25, "hi": 0 },
                 "url": "data/site-id/hh_{date}.tif" }],
    "stacks": [{ "layer": "hh", "url": "data/site-id/stack_hh.tif", "band_dates": ["2026-06-19"] }],
    "stats": "data/site-id/stats.json"
  }]
}
```

### 6.5 The web app

- **Stack.** Vite and TypeScript, with React unless the team prefers otherwise. MapLibre GL JS for the map.
  `@geomatico/maplibre-cog-protocol` 0.10.0 to read COGs straight from static hosting: colour ramps through
  the `cog://URL#color:<ramp>,<min>,<max>` form, `setColorFunction` for custom colouring, and
  `locationValues(url, {latitude, longitude})` to read a pixel across all bands. `geotiff` 3.x if you need
  lower-level reads (version 3 renamed `image.geoKeys` to `getGeoKeys()`). A small charting library you are
  fluent in.
- **Pin MapLibre deliberately.** Version 6 (6.18.0 on 2026-11-11) is ESM-only, has no default export,
  requires WebGL2 and needs `setWorkerUrl()` under a bundler. The version 5 line is still maintained
  (5.24.1) and matches what most examples and most of your own habits assume. Start on 5.24.1 unless a quick
  test shows version 6 working with the COG protocol in this project.
- **Compare view.** The old `@maplibre/maplibre-gl-compare` plugin is unmaintained and breaks with ESM
  builds. Use two map instances kept in sync (for example with `@mapbox/mapbox-gl-sync-move`) and a CSS clip
  that follows a draggable divider.
- **Time.** Dates come from the manifest, never from a calendar. Show a missing pass as missing. Preload
  the neighbouring dates so stepping does not flash. Give keyboard control.
- **Inspect.** A click returns real values with units, the date of each, and nodata shown as nodata.
- **Words.** Every layer has a legend with units and one plain sentence on how to read it. A methods page,
  a data-and-credits page, the AI-use statement and a limitations section are part of the product, not
  extras.
- **Basemap and context.** OpenFreeMap styles need no key (`https://tiles.openfreemap.org/styles/liberty`,
  also `positron` and `dark`). The GIBS layers in Section 4.6 give NISAR quick-looks and independent
  comparisons.
- **Usability, which judges score under Validity.** Works on a phone. Colour scales that survive
  colour-blindness and never rely on red against green. Keyboard reachable. Honours reduced-motion. Loads
  its first view fast: lazy-load everything that is not on the first screen.
- **Shareable state.** Put place, date, layer and view in the URL so a link reproduces what the sender saw.
- **Attribution on the map**, in text: NISAR data courtesy NASA/JPL-Caltech and ISRO, distributed by the
  Alaska Satellite Facility DAAC; imagery tiles from NASA GIBS; basemap credits as the provider requires.

### 6.6 Hosting

- **GitHub Pages** is the default: it answers HTTP range requests with 206 and sends cross-origin headers,
  which COGs need. The project site will be at `https://runny24.github.io/NASA-space-apps-2026/`, so set the
  build's base path accordingly, and the repository must be public.
- **Do not put COGs on Cloudflare Pages**: its documentation says it returns 200 to range requests, which
  defeats partial reads. Vercel and Netlify return 206. A Hugging Face dataset repository works for overflow
  (range and cross-origin both fine). GitHub release assets send no cross-origin header.
- **Local testing needs a server that honours range requests.** Use the Vite dev server or `vite preview`,
  and confirm with `curl -r 0-99 -I <url>` that you get 206. (*Whether Python's built-in server does is
  unverified; do not rely on it.*)
- **File the FortiGuard request early.** The submission guide recommends requesting a Web Filter
  Classification for a new site so judges behind filters can open it. Do it as soon as the URL exists.

---

## 7. Schedule

Hours count from kickoff: H0 is Saturday 09:00, H24 Sunday 09:00, H39 the deadline. If you start later than
H0, compress the middle and keep the last nine hours intact.

| Hours | Goal | Done when |
|---|---|---|
| H0 to H1 | Repository, licence, environments, Earthdata login test, disk and bandwidth measured, a "hello map" on the public URL | The URL loads in a private window |
| H1 to H3 | A thin slice on no-login imagery: the team's place, real NISAR pass dates from CMR, the GIBS layer stepping through them | Deployed. This is the fallback that always exists |
| H3 to H8 | First real GCOV window on the map; access bake-off decided; a click returns a real value | One date end to end from NASA's archive to the deployed page |
| H8 to H14 | All dates; the analysis layers the concept calls for; charts; compare view | The core of the concept works on the public URL |
| H14 to H22 | People sleep. Long jobs run unattended: remaining dates, a second place, test suite, performance | A morning report in `PROGRESS.md`; nothing waiting on a decision overnight |
| H22 to H30 | The team rewrites interpretation text; validation against an independent source; methods, credits, limitations; phone and accessibility pass | The team has read and agreed every claim on the site |
| H30 | **Feature freeze** (Sunday 15:00). After this, fixes and words only | |
| H30 to H36 | Demo, project page text, every link tested in a private window, FortiGuard confirmation | Submitted by H36 (Sunday 21:00) |
| H36 to H39 | Margin. Resubmitting is allowed; the last saved version is judged | |

**Gates and what to do when one fails**

- *Login not working within 30 minutes:* keep building on the no-login tier while a teammate sorts out the
  account and agreement.
- *One date takes more than about ten minutes to read after the bake-off:* shrink the area, use frequency B,
  or queue whole-file downloads for the night.
- *No real measurement on the deployed map by H10:* stop adding scope and put every hand on that one path.
- *Core concept not working on the public URL by H20:* cut to one place and the two features the team
  values most.

**Cut order when time runs short:** additional places first, then secondary layers, then animation polish,
then the second comparison dataset. Never cut the methods and limitations text, the credits, the AI-use
statement or the link tests.

Before the team sleeps, make sure every overnight job is started, logged and resumable, and that its
failure cannot take the deployed site down.

---

## 8. Finish line

The build is done when all of this is true, and you have checked each item yourself:

- The public URL opens in a private window, on a laptop and on a phone, with no login.
- The first screen shows real NISAR data for the team's place and says what it is.
- Every feature the team ticked in Section 1.1 works on the deployed site.
- Every number on screen traces to a NISAR granule listed in the manifest; a click shows real values and
  units.
- Dates shown are real acquisition dates; missing passes are shown as missing.
- Compared images come from one stack and one release, or the app says otherwise.
- The methods page states the processing steps, thresholds and how they were chosen, the independent
  comparison and where it disagrees, and the limitations.
- The team has read and agreed the interpretation text, including their hypotheses about drivers, which
  polarizations show the change, and what NISAR could do next (the three things the challenge asks for).
- Credits name every dataset, library and resource. `LICENSE` is in place. No NASA logos or mission patches.
- AI assistance is acknowledged in the README, in the app, and in metadata. `AI_USE.md` is complete.
- The browser console is clean on load; tests pass; the site is inside the hosting limits.
- `docs/HOW_IT_WORKS.md` lets a teammate answer "where does this number come from?" for every chart.

---

## 9. Submission package

The project page has these fields. Write the factual ones early and give them to the teammate who owns the
page; the team writes the final words. Everything must be in English.

| Field | What the form asks | Your part |
|---|---|---|
| Project Name | "What is the name of your project?" | From Section 1.1 |
| High-Level Project Summary | "What did you develop? How does it address the challenge? Why is it important?" | A first version from the team's concept for them to rewrite |
| Link to Project Demo | 7 slides or a video of 30 seconds or less, publicly accessible | Storyboard, screen captures of the real app, a check of length and access |
| Link to Final Project | A public link: the app, with the repository linked from it | Deployed URL, tested in a private window |
| Detailed Project Description | "What exactly does it do? How does it work? What benefits does it have? What do you hope to achieve? What tools, coding languages, hardware, or software did you use?" | An accurate first version of how it works and the tool list |
| Use of Super Intelligence (SI) | "Did you utilize any ... tools and software in preparing your solution? If yes, how did you use them?" | A truthful account from `AI_USE.md` |
| NASA Data | "specific details about what NASA data and resources you used" | From `docs/SOURCES.md`: products, collections, dates, services |
| Space Agency Partner Data and Other References | "all of the data, resources, and tools used," including code, text and images | From `docs/SOURCES.md` |

- A Global Award requires "at least one NASA data or resource". The form also encourages data from partner
  agencies; ISRO is NISAR's co-owner, and the Sentinel-1 layers on GIBS are ESA data.
- **Demo.** The guide's suggested 30-second shape: 0:00 names and team; 0:02 the challenge and why this
  team chose it; 0:05 project title and tagline; 0:10 how it works, showing the real app and how open NASA
  data made it possible; 0:20 to 0:30 where it could go. A slide deck must show the team name, the members'
  names and the challenge. Measure the video's length; over 30 seconds or over 7 slides is disqualifying
  for Global Judging. A video in another language needs English subtitles.
- **Links.** Each must open with "no logins, permissions, or registrations required". Test every one in a
  private window from a second device before submitting.
- **Images on the page.** The form accepts JPG, PNG and GIF up to 10 MB. Use real screenshots.

---

## 10. Your first hour

1. Check the clock (Section 0). Read Section 1. If the concept is incomplete, ask the team for the missing
   lines now, and offer to run `python3 research/nisar_coverage.py <lon> <lat>` for any place they are
   weighing.
2. Create `PROGRESS.md`, `AI_USE.md`, `docs/SOURCES.md`, `LICENSE` and a `.gitignore` that excludes raw data
   and credentials. Make the first commit after kickoff.
3. Test Earthdata access with one small authenticated request. If it fails, say exactly what the teammate
   must fix (account, agreement, `.netrc`) and move on.
4. Measure free disk and download speed on the machine that will run the pipeline, and note them.
5. Scaffold the web app, deploy a map centred on the team's place to the public URL, and open it in a
   private window. File the FortiGuard classification request.
6. For the team's place, list the stacks and dates, recommend one stack with your reasons, and show the
   team the public preview images of the first and last dates so they can see what the data looks like
   before any processing.
7. Send the first status note: what is live, what you found about data coverage, your plan for the next
   three hours, and the decisions you need.

---

## Appendix A. Data coverage at sample places

From CMR on 2026-11-13: the best GCOV stack at each point. These are facts about where data exists, to help
the team fill in Section 1; they are not recommendations. For any other place run
`python3 research/nisar_coverage.py <lon> <lat>`.

| Place (lon, lat) | Stack | Dates | Span | Mode | File size |
|---|---|---|---|---|---|
| Mexico City (-99.1, 19.4) | 019_A_011 | 31 | 2025-10-30 to 2026-11-06 | HH+HV, 40+5 MHz | 7.0 GB |
| Kilauea, Hawaii (-155.28, 19.41) | 072_D_079 | 29 | 2025-10-22 to 2026-11-10 | HH+HV, 40+5, partial frames | 2.8 GB |
| Central Valley, California (-119.56, 36.1) | 034_A_020 | 27 | 2025-11-24 to 2026-10-26 | HH+HV, 40+5 | 7.1 GB |
| Reykjanes, Iceland (-22.4, 63.88) | 159_A_034 | 27 | 2025-11-09 to 2026-10-23 | HH+HV, 40+5 | 5.3 GB |
| Punjab, India (75.8, 30.6) | 156_A_017 | 26 | 2025-11-21 to 2026-11-04 | HH+HV, 40+5 | 6.9 GB |
| Atchafalaya, Louisiana (-91.45, 30.0) | 084_D_073 | 19 | 2025-10-23 to 2026-10-30 | HH+HV, 40+5 | 6.3 GB |
| Grand Forks, North Dakota (-97.4, 47.9) | 099_D_064 | 19 | 2025-10-24 to 2026-10-31 | HH+HV, 40+5 | 7.1 GB |
| Chicago (-87.65, 41.85) | 148_A_023 | 18 | 2025-11-08 to 2026-11-03 | quad-pol, 20+5 | 8.2 GB |
| Champaign, Illinois (-88.3, 40.2) | 148_A_022 | 18 | 2025-11-08 to 2026-11-03 | quad-pol, 20+5 | 8.2 GB |
| Jakobshavn Glacier, Greenland (-49.6, 69.17) | 170_D_053 | 17 | 2025-10-28 to 2026-10-23 | HH only, 77 MHz | 0.9 GB |
| Okavango Delta, Botswana (22.9, -19.3) | 172_A_168 | 15 | 2025-11-22 to 2026-10-24 | HH+HV, 20+5 | 1.9 GB |
| Rondonia, Brazil (-63.5, -10.0) | 068_D_094 | 13 | 2025-11-02 to 2026-10-28 | HH+HV, 20+5 | 1.6 GB |
| Tonle Sap, Cambodia (104.05, 12.95) | 083_A_008 | 11 | 2026-06-19 to 2026-10-29 | HH+HV, 20+5 | 1.9 GB |
| Sudd, South Sudan (30.7, 7.5) | 050_D_085 | 11 | 2026-06-17 to 2026-10-27 | HH or HH+HV, 20+5 | 1.8 GB |
| Mekong Delta, Vietnam (105.6, 10.0) | 047_D_083 | 11 | 2026-06-17 to 2026-10-27 | HH+HV, 40+5 | 6.4 GB |
| Mamiraua, Amazon (-65.0, -2.7) | 097_D_090 | 10 | 2025-11-04 to 2026-10-06 | mixed | 1.5 GB |
| Pantanal, Brazil (-57.2, -17.3) | 111_D_097 | 9 | 2026-06-21 to 2026-10-19 | HH or HH+HV, 20+5 | 1.9 GB |

How to read it: places with 26 or more dates are among the selected frames with a calibrated record back to
autumn 2025. Places with 13 to 19 dates combine uncalibrated beta passes (October 2025 to January 2026) with
the calibrated record from June 2026, and have nothing between February and mid-June. Places with about 10
dates have only the June-to-October record.

Other products at a point: interferograms (GUNW) form 28 consecutive 12-day pairs at Mexico City
(2025-10-30 to 2026-10-13) and 22 to 27 at Kilauea, the Central Valley and Reykjanes, against 9 at Tonle Sap.
Soil moisture (SME2) has 26 dates in the Central Valley, 24 in Punjab, 16 at Champaign. Offsets (GOFF) have
14 to 15 dates at Jakobshavn, Pine Island Glacier and Hubbard Glacier. Standard interferograms stop at pairs
beginning 2026-10-09 for now.

What the preview images show, for calibration of expectations (files in `research/evidence/previews/`): at
Tonle Sap between 19 June and 29 October 2026 the open water spreads well past the June shoreline and the
surrounding flooded vegetation brightens; over Illinois between August and October 2026 fields darken after
harvest, and the quad-pol gap bands are plain to see; a 12-day interferogram over Mexico City in March 2026
shows frame-wide ramps and a seam with no obvious local signal before processing.

## Appendix B. Events inside the data record

Collected by a research pass from the sources listed; not independently re-checked, so confirm before
relying on one. "Data" is what a catalog query found.

| Event | When | Data | Source |
|---|---|---|---|
| Venezuela earthquakes near La Guaira and Caracas | June 2026 | co-seismic interferograms | science.nasa.gov/earth/earth-observatory/where-venezuelas-earthquakes-shifted-the-ground/ |
| Langtang Lirung collapse, Nepal | 2026-08-26 | GCOV before and after | india.mongabay.com/2026/10/scientists-explore-whether-himalayan-disasters-can-be-anticipated/ |
| Azuero Peninsula earthquake, Panama | 2026-10-09 | interferogram 27 Sep to 9 Oct; urgent-response offsets | earthquakeinsights.substack.com/p/surface-rupture-of-the-m77-azuero |
| Gandak River flood, Bihar and Nepal | 2026-09-24 to 29 | GCOV on 16 Sep, 28 Sep, 10 Oct | science.nasa.gov/earth/earth-observatory/rains-swamp-the-gandak-river/ |
| Thunder Bay 36 wildfire, Ontario | from 2026-07-12 | GCOV on six tracks | en.wikipedia.org/wiki/2026_Canadian_wildfires |
| Hayli Gubbi eruption, Ethiopia | 2025-11-23 | interferograms; a year of passes | science.nasa.gov/earth/earth-observatory/hayli-gubbis-explosive-first-impression/ |
| Limpopo and Incomati flood, Mozambique | January 2026 | beta only | svs.gsfc.nasa.gov/5661 |
| Mexico City subsidence | continuous | NASA's own interferometric result | jpl.nasa.gov/news/us-indian-space-mission-maps-extreme-subsidence-in-mexico-city/ |
| Maize-triangle crop season, South Africa | Nov 2025 to Mar 2026 | 10-pass GCOV composite by NASA | science.nasa.gov/earth/earth-observatory/painting-the-growing-season-in-the-maize-triangle/ |
| Hubbard Glacier earthquake debris | 2025-12-06 | beta GCOV; offsets | science.nasa.gov/earth/earth-observatory/landslide-and-avalanche-debris-litter-hubbard-glacier/ |

The Petermann Glacier calving of 2026-08-04 falls inside the data gap.

## Appendix C. The challenge's resources, to use and to cite

| Resource | URL | Good for |
|---|---|---|
| NASA Earthdata Search | https://search.earthdata.nasa.gov/search | manual search |
| ASF Vertex | https://search.asf.alaska.edu/ | manual search; exports GDAL commands |
| NISAR Data User Guide | https://nisar-docs.asf.alaska.edu/ | the technical reference behind Section 4 |
| ASF NISAR Cookbook (linked from the ARSET training) | https://github.com/ASFOpenSARlab/NISAR_Cookbook | working notebooks, Apache-2.0: `NISAR_GCOV_Time_Series_Example`, `NISAR_GCOV_SARChangeDetectionMethods`, `util/load_gcov.py` |
| Intro to SAR | https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar | scattering and interpretation (subpage `/sar/image-interpretation`) |
| Intro to Remote Sensing | https://www.earthdata.nasa.gov/learn/earth-observation-data-basics | background |
| NASA ARSET trainings | https://www.earthdata.nasa.gov/data/projects/arset | "Harnessing NISAR" (Jul 2026), "Monitoring Surface Water with SAR" (Oct 2026), NISAR surface displacement (Nov 2026) |
| NISAR StoryMaps | https://science.nasa.gov/mission/nisar/arcgis-storymaps/ | L-band case studies: floods, fire, subsidence, oil, glaciers |
| NISAR Applications White Papers | https://science.nasa.gov/mission/nisar/societal-benefits/ | two-page application briefs, for the "future applications" question |
| UAVSAR Postcards | https://uavsar.jpl.nasa.gov/education/postcards.html | airborne L-band examples; credit "Courtesy NASA/JPL-Caltech" |
| CSA RADARSAT Constellation Mission | https://donnees-data.asc-csa.gc.ca/en/dataset/rcm | C-band samples without login; archive needs an account |
| CSA SAR Python tutorial | https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial | basic notebook |
| CSA RADARSAT-1 | https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1 | open historical C-band COGs (`s3://radarsat-r1-l1-cog/`, anonymous) |
| CONAE SAOCOM catalogue | https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html | L-band; test products immediate, catalogue access about a day |

Also worth knowing: `NISAR-Science-Algorithms` on GitHub (inundation, biomass, crop area, disturbance) and
`ASFHyP3/hyp3-nisar-cv` (coefficient of variation from GCOV stacks), both open source.

## Appendix D. Sketches

Each is labelled with how far it has been checked. Treat unlabelled confidence as none.

**D1. Pass dates at a point, from the browser.** *Request and response shape verified with curl; this
JavaScript has not been run.*

```js
const GCOV = ['C2854338529-ASF', 'C3622241360-ASF']; // provisional, validated
export async function nisarPasses(lon, lat) {
  const p = new URLSearchParams({ point: `${lon},${lat}`, page_size: '2000', sort_key: 'start_date' });
  GCOV.forEach((c) => p.append('collection_concept_id', c));
  const res = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?${p}`);
  const { feed } = await res.json();
  return feed.entry.map((e) => {
    const m = e.title.match(/_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_(\d{4})_(\w{4})_/);
    return {
      name: e.title, start: e.time_start, cycle: m[1], stack: `${m[2]}_${m[3]}_${m[4]}`, mode: m[5], pol: m[6],
      polygon: e.polygons?.[0]?.[0], // "lat lon lat lon ..."
      browse: e.links.filter((l) => l.rel.endsWith('browse#') && l.href.startsWith('https')).map((l) => l.href),
    };
  });
}
```

**D2. The GIBS NISAR layer in MapLibre.** *Tile URL verified; the MapLibre call has not been run here.*

```js
const gibs = (date) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/${date}/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`;
map.addSource('nisar-quicklook', { type: 'raster', tiles: [gibs('2026-10-17')], tileSize: 256, maxzoom: 13,
  attribution: 'NISAR imagery: NASA/JPL-Caltech and ISRO, via NASA GIBS' });
map.addLayer({ id: 'nisar-quicklook', type: 'raster', source: 'nisar-quicklook' });
```

**D3. Reading one window of a GCOV file over HTTPS.** *Not run: no credentials were available. Print the
file's tree first and trust it over this sketch.*

```python
import earthaccess, h5py, numpy as np
from pyproj import Transformer

earthaccess.login()   # ~/.netrc, or EARTHDATA_TOKEN, or EARTHDATA_USERNAME + EARTHDATA_PASSWORD
fs = earthaccess.get_fsspec_https_session()

def read_window(url, bbox, freq="A", terms=("HHHH", "HVHV")):
    """bbox = (west, south, east, north) in degrees. Returns arrays, EPSG code, GDAL-style geotransform."""
    with fs.open(url, mode="rb", cache_type="blockcache", block_size=8 * 1024 * 1024) as f, \
         h5py.File(f, "r") as h5:
        g = h5[f"/science/LSAR/GCOV/grids/frequency{freq}"]
        x, y = g["xCoordinates"][:], g["yCoordinates"][:]        # pixel centres, metres; y descends
        epsg = int(g["projection"][()])
        w, s, e, n = bbox
        xs, ys = Transformer.from_crs(4326, epsg, always_xy=True).transform([w, e, w, e], [s, s, n, n])
        c0, c1 = np.searchsorted(x, [min(xs), max(xs)])
        r0, r1 = np.searchsorted(-y, [-max(ys), -min(ys)])
        out = {t: g[t][r0:r1, c0:c1] for t in terms if t in g}
        out["mask"] = g["mask"][r0:r1, c0:c1]
        dx, dy = float(x[1] - x[0]), float(y[1] - y[0])           # dy is negative
        return out, epsg, (x[c0] - dx / 2, dx, 0.0, y[r0] - dy / 2, 0.0, dy)
```

**D4. Placing a preview PNG on the map without the login-only KML.** *Method verified numerically on three
dates of one stack; not yet checked visually on a map.* Find the bounding rows and columns of the non-black
footprint in the image: left `xl`, right `xr`, top `yt`, bottom `yb`, in an image `W` by `H` pixels. Take
the granule's CMR polygon and its extreme longitudes and latitudes. Then

```
dlon = (lon_max - lon_min) / (xr - xl)        west  = lon_min - xl * dlon      east  = west  + W * dlon
dlat = (lat_max - lat_min) / (yb - yt)        north = lat_max + yt * dlat      south = north - H * dlat
```

For stack `083_A_008` this gave west 102.3865, east 105.5270, north 14.3420, south 11.3330 on all three
dates. Black pixels must be made transparent in a canvas before display.

**D5. Writing a web-ready COG.** *Not run here.*

```python
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
# src: 8-bit GeoTIFF with nodata=0 already set
cog_translate(src, dst, cog_profiles.get("deflate"), web_optimized=True, nodata=0,
              overview_resampling="average", in_memory=False)
```

Then `rio cogeo validate dst`.
