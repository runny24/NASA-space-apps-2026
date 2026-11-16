

## 1. What the satellite measures

NISAR is a radar. It sends microwave pulses (L-band, wavelength about 24 cm) towards the ground and records
how much energy bounces back to it. That returned strength is called **backscatter**. It works at night and
through cloud.

- Smooth surfaces such as calm water act like a mirror and send the pulse away from the satellite: **dark**.
- Rough or structured surfaces (crops, forest, buildings) scatter energy back: **bright**.
- Flooded vegetation is very bright in HH, because the pulse bounces off the water and then off stems and
  trunks straight back to the radar ("double bounce").

**Polarization** is the orientation of the wave. HH means sent horizontal, received horizontal; HV means
sent horizontal, received vertical. HH responds strongly to flooding and structures; HV responds to
vegetation volume (it rises as a canopy grows and falls after clearing, burning or harvest).

The product we read is called **L2 GCOV**: backscatter already placed on a map grid and corrected for
terrain, stored as *gamma-naught in linear power* (a plain positive number, not decibels).

## 2. Why we only compare images from one "stack"

The satellite repeats the same ground track every 12 days. Images taken from the same track, direction and
frame are called a **stack** (written like `030_A_019`: track 030, ascending, frame 019). Only those see the ground from the same position,
so only those can be compared directly. An ascending pass and a descending pass look from opposite sides at
different times of day (near 6 a.m. and 6 p.m.), so dew, rain and viewing angle all differ. The pipeline
refuses to mix stacks.

NASA has released the data in stages (beta, provisional, validated) with different calibration. The data
guide asks for caution when mixing releases in one time series, so each site records which release every
date came from.

## 3. From NASA's archive to our map **(scaffold)**

One file from the archive is 2 to 8 GB and covers about 240 by 240 km. We never download whole files. The
steps, each a command of the pipeline (`npm run pipeline -- <command>`):

1. **discover**: ask NASA's public catalog which product files exist for our place (NASA calls one file a
   "granule": one per satellite pass), and write the chosen list to `pipeline/sites/<site>.granules.json`.
   That file is the citable record of exactly which data we used.
2. **fetch**: read only our window out of each file over the internet (the files are built so that a
   reader can ask for just the bytes it needs).
3. **process**: throw away invalid pixels, then **multilook**: average neighbouring pixels to tame speckle
   (section 5).
4. **analyse**: the harvest analysis, if the site file sets a harvest block (`pipeline/harvest.py`).
5. **fires**: fetch NASA's fire detections (FIRMS), if the site file sets a fires block
   (`pipeline/fires.py`).
6. **marker**: the marker test: which polarization, HH or HV, should draw the harvest map, by the rule in
   `docs/METHODS.md`, section 6 (`pipeline/marker.py`). It is run on its own, not as part of `run`.
7. **qa**: histogram and thumbnail pictures of each date to look at, and the stable-target check if the
   site file sets one.
8. **export**: move the image onto the grid web maps use, convert to decibels, store it compactly, and
   compute the numbers for charts; also the harvest map and the fire detections, when the stages above
   made them.
9. **manifest**: write `web/public/data/manifest.json`, the list of everything the app can show.

`run` does fetch, process, analyse, fires, qa, export and manifest for one site, then `validate` checks
everything.

The web app is a static page. It reads the manifest and then reads small pieces of the image files
directly from the web host. There is no server of ours in between.

## 4. Decibels, and why we average before converting

Backscatter spans a huge range, so it is shown in decibels: `dB = 10 × log10(power)`. As a rough guide for
L-band HH (textbook ranges, not measured by us; check them against our own site's histogram before quoting
them): calm water is the darkest, around -20 dB and below; bare ground and low crops sit in the middle;
forest is brighter, roughly -10 to -5 dB; cities and flooded forest are the brightest, up to about 0 dB.
HV is several dB lower than HH over the same ground.

**All arithmetic is done on the linear power values; conversion to dB is the last step.** Averaging
decibels gives the wrong answer. Example: one pixel at -5 dB and one at -25 dB. As powers they are 0.316
and 0.00316; their mean is 0.160, which is **-8.0 dB**. Averaging the dB numbers instead gives -15 dB,
wrong by 7 dB.

## 5. Speckle: why a single pixel means little

Radar images are grainy by nature. The graininess ("speckle") is not sensor error and not change on the
ground; it comes from the way radar waves add up. At the product's native resolution, two images of ground
that has not changed at all differ, pixel by pixel, by 2 to 4 dB (one standard deviation). So:

- We average blocks of pixels (multilooking) before showing or comparing anything. The site config sets the
  working resolution.
- A change of 1 or 2 dB only means something for an average over many pixels (a field, a polygon, or a
  block of roughly 50 to 100 original samples), never for one pixel.

## 6. How values are stored in the image files **(scaffold)**

Each image file stores one byte per pixel, a code from 0 to 255:

```
0          = no data
1 .. 255   = a value between lo and hi, in equal steps
value      = lo + (code - 1) × (hi - lo) / 254
```

`lo` and `hi` are written in the manifest for every layer. For backscatter we use -35 to +5 dB, so one
step is 0.157 dB, much finer than speckle. Anything outside the range was clipped; the pipeline prints what
fraction that was, and the app shows a clipped value as "5.0 dB or more" or "-35.0 dB or less" instead of
pretending it is exact. Very bright targets such as buildings do exceed +5 dB. The files are Cloud-Optimized GeoTIFFs: ordinary GeoTIFFs arranged so a browser can
fetch one small tile at a time.

## 7. What you see on the map **(scaffold)**

- The grey image is backscatter for one date. The same grey scale (`display` range in the manifest) is used
  for every date of a layer, so a difference between dates is a difference on the ground and not a
  difference in contrast settings.
- **Play** steps through the dates of a layer on its own, waiting on each date until the map has drawn it
  (8 seconds at most); **Pause** stops it.
- The harvest map is a single map in one colour per class. It does not change with the date, so there are
  no dates to step through.
- A tag on the map names the layer and the date of the picture actually drawn; while a new date loads, it
  still names the one before.
- Under "Data from other sources", a switch draws NASA's fire detections as dots: on a layer with dates,
  those from the date shown to the day before the layer's next date (from the last date, to the end of the
  overlay's period); on the harvest map, all of them.
- The legend shows the units and one sentence on how to read the layer. Without a sentence of the site's own,
  the pipeline's default one is shown; it was written by the AI, and the site's config file can replace it.
- Zoomed out, the browser shows pre-shrunk copies of the image. Those are for looking, not measuring: they
  average the stored codes, which reads a few tenths of a dB low. Numbers in the app never come from them.
- A site marked as **sample** shows a notice at all times (section 10).

## 8. What a click returns **(scaffold)**

- **The value**: read from the full-resolution image of the layer and date on screen, converted with the
  formula in section 6, with its unit and date. A place with no data says "no data", never 0. On the
  harvest map the value is the name of the class.
- **The history chart**: read from a second, coarser file that holds every date for the site (one band per
  date). Each point is the mean backscatter over a cell of the size the app states (about 65.4 m on our
  site), computed in linear power. It will not exactly equal the single pixel under the cursor, and it is
  not meant to: the cell average is the more trustworthy number.
- Dates on the chart are real acquisition dates. A pass that is missing is shown as missing; nothing is
  interpolated.
- **A fire detection**: with the fire detections switched on, the nearest drawn dot within 12 screen pixels
  of the click, with its details.

## 9. The change layer **(scaffold building block; the analysis itself is ours to write)**

For a pair of dates the pipeline can write `10 × log10(later / earlier)` after a small smoothing filter in
linear power. Positive means the ground returned more energy on the later date; negative means less. This
is a picture of difference, **not a detection of change**: speckle alone produces differences. Turning it
into "this area flooded" or "this field was harvested" needs a threshold chosen from this site's own data,
a check against something independent, and a hypothesis about the physical cause. That is the team's
analysis and belongs in `docs/METHODS.md`.

## 10. The sample site **(scaffold)**

Until we chose our place, the app showed one site called "sample". It is built from files NASA and JPL
publish for testing software: two 2008 scenes from a Japanese radar satellite (ALOS-1 PALSAR) over Rosamond,
California, repackaged in NISAR's file format. **It is not NISAR data**, its values are not calibrated NISAR
measurements, and the difference between its two dates is not meaningful. It was there for one reason: to
prove that every step from archive to map works. It came off the public site once our real site was live;
`npm run sample` still rebuilds it locally.

## 11. Numbers in charts and dashboards **(scaffold for the mean; the rest is ours to write)**

Charted numbers come from `stats.json`, written by the pipeline. Each series carries a sentence saying how
it was computed. The scaffold writes one per backscatter layer: mean backscatter over the whole window per
date (mean of linear power, then converted to dB), with the number of pixels behind it. Every date of a
series is averaged over the same ground: only pixels that are valid on all dates used count (a date with
fewer valid pixels than 80 % of the best-covered date is left as a gap), so a pass that covers less of the
window cannot masquerade as a change. The harvest analysis adds the share of the rice area with a harvest
pair seen by each pass, and the fire detections add bar charts of detections per km2 in each class of the
harvest map, one per period. The Statistics panel draws every series as a line chart and every set of bars
as a bar chart. Areas and pixel counts are computed by the pipeline on the satellite product's own grid,
never by counting pixels on the web map (the web map projection stretches areas: by 3 % at 10° latitude,
double at 45°, four times at 60°).

## 12. Where each thing lives in the code

| Question | Look in |
|---|---|
| Which images did we use? | `pipeline/sites/<site>.granules.json`, and `dates` in the manifest |
| What counts as a valid pixel? | `pipeline/process.py` |
| How is the averaging done? | `pipeline/process.py` (multilook) |
| How are values turned into bytes and back? | `pipeline/encode.py`, `web/src/contract/` |
| How does the image get onto the web map grid? | `pipeline/export.py` |
| Where do chart numbers come from? | `pipeline/stats.py`, then `stats.json` |
| How is the harvest map made? | `pipeline/harvest.py`; the choice of HH or HV in `pipeline/marker.py` |
| Where do the fire detections come from? | `pipeline/fires.py` |
| What does the app assume about the data? | `contract/manifest.schema.json`, `docs/DATA_CONTRACT.md` |
| What has been checked against real NISAR files? | `PROGRESS.md` and `docs/HANDOFF.md` |

## 13. Our interpretation **(ours to write)**

To be written by the team once the concept is chosen: what we see at our place, what we think causes it,
which polarization shows it and why, what would confirm or refute it, and what an independent data source
says.
