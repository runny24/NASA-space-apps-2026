# The data contract

`web/public/data/manifest.json` is the only thing the web app knows about the data. The Python pipeline
writes it; the app reads it. Adding a place means running the pipeline with a new site config and nothing
else: no app code changes.

- **Authority:** `contract/manifest.schema.json` and `contract/stats.schema.json` (JSON Schema 2020-12).
  If this page and the schema disagree, the schema wins; fix this page.
- **Changing the contract:** edit the schema, bump `schema` if the change breaks old readers, run
  `npm run gen:contract` (regenerates the TypeScript types), update the pipeline writer and the app in the
  same commit, and note it in `PROGRESS.md`. Both sides have a test that fails when they drift.

## Layout on disk

```
web/public/data/
  manifest.json                  written by `npm run pipeline -- manifest` (never by hand)
  <site-id>/
    site.json                    this site's fragment of the manifest (one object matching `#/$defs/site`)
    stats.json                   small numbers for charts (contract/stats.schema.json)
    <layer>_<date>.tif           one display file per acquisition for a per-date layer
    <layer>_<ref>_<sec>.tif      one display file per pair for a pair layer
    <layer>.tif                  a static layer
    stack_<layer>.tif            click-query file: one band per date
    fires.geojson                the `fires` overlay (points), when the site has a `fires` block
```

`manifest.json` is assembled from every `<site-id>/site.json`, so sites are independent. To remove a site,
delete its folder and rebuild the manifest. URLs inside the manifest are resolved against the manifest's
own URL, so they look like `tarn-taran/hh_2025-11-21.tif`.

## Every raster file

| Property | Value | Why |
|---|---|---|
| Format | Cloud-Optimized GeoTIFF, internal overviews | The browser reads only the bytes it needs (HTTP range requests) |
| Projection | **EPSG:3857**, aligned to the web map tile grid | The browser reader only understands Web Mercator. An EPSG:4326 file raises no error and silently draws at 0°N 0°E |
| Data type | uint8 | Small, and every decoder handles it |
| Nodata | **0, declared in the file** | Only declared nodata is drawn transparent |
| Compression | DEFLATE with predictor 2 | Lossless and decoded by every version of the reader. Never JPEG or WebP: they corrupt value-coded pixels |
| Tile size | 256 px for display files, 128 px for click-query stacks | One request per map tile; about 0.1 MB per click |
| Size | under 100 MiB per file; whole `data/` folder inside the budget in `scripts/check-size.mjs` | GitHub Pages limits (100 MiB per file, 1 GB per site) |
| Scale and offset tags | **none** | The browser reader applies GDAL scale/offset tags by itself. The app decodes with the manifest's `encoding` only, so a file that also declared them would be decoded twice |
| Band interpretation | grey (`photometric=MINISBLACK`), set on the source raster | A 3-band file is otherwise tagged RGB and a 4-band file RGBA; with RGBA every date is blanked wherever the fourth date is nodata |

Numbers shown to a visitor never come from an overview level. Overviews average the encoded dB values,
which is fine for a zoomed-out picture but reads 0.2 to 0.4 dB low on uniform ground and several dB off on
mixed pixels. Values come from full-resolution pixels, the stack file, or `stats.json`.

## Pixel values

Files hold codes, not physical values. The `encoding` object says how to turn a code back into a number.

**`linear-uint8`** (backscatter, change in dB, any continuous quantity):

```
physical = lo + (pixel - 1) * (hi - lo) / 254        for pixel in 1..255
pixel    = 1 + round(254 * (physical - lo) / (hi - lo)), clipped to 1..255
0        = nodata
```

With `lo = -35`, `hi = 5` one step is 0.157 dB, finer than radar speckle noise. Values outside `[lo, hi]`
were clipped when the file was written; the pipeline logs what fraction was clipped. So code 255 means
"`hi` or more" and code 1 means "`lo` or less", and the app shows them that way.

**`categorical-uint8`** (classified maps): each pixel value 1..255 is a class listed in `classes` with a
label and a colour. 0 is nodata. Every pixel of the file, at full resolution and in every overview, is 0 or
a listed value (rule 10), so the pipeline warps such a layer and builds its overviews by nearest neighbour,
never by averaging. Class values need not be consecutive: the `harvest-wave` layer lists every harvest
pair, "no harvest seen" and "not rice" whether or not a cell has them, and leaves out only "fell before"
when no cell has it; that class's value stays reserved, so the values after it keep their meaning.

`display` on a layer is only a drawing hint (range and colour ramp in physical units). It must be the same
for every date of a layer, so that a difference between two dates is a difference on the ground and not in
the stretch. It may differ between layers: a site file's `backscatter.display_by_polarization` gives one
polarization's layer its own range (HV is several dB darker than HH). No raster depends on it, so changing
it rewrites `site.json` and the manifest only.

## Layer kinds

| `kind` | Files | Each item has | Example |
|---|---|---|---|
| `per-date` | one per acquisition | `date`, `url` | HH backscatter on each pass |
| `pair` | one per pair of acquisitions | `reference` (earlier), `secondary` (later), `url` | change between two passes |
| `static` | exactly one | `url` | a map summarising the whole series |

## Click queries: `stacks`

A stack file has one band per acquisition (`band_dates[i]` is band `i + 1`), pixel-interleaved, so one small
request returns a place's whole history. It may be coarser than the display layer (`resolution_m` says how
coarse); the app must say that a charted value is a mean over that cell, not the display pixel. Its values
use the stack's own `encoding`.

## Overlays: data from other sources

`overlays` (optional) lists vector data drawn over the layers, for example fire detections from another
instrument. An overlay is context from an independent source. It is never a NISAR measurement, and the app
shows its `credit` wherever it is drawn.

| `kind` | File | Note |
|---|---|---|
| `points` | GeoJSON `FeatureCollection` of `Point` features, `[longitude, latitude]` in EPSG:4326 | Keep it to a few thousand points: the browser loads the whole file |

- `date_property` names the feature property that holds each point's UTC calendar date. With it the app can
  show the points of a period (for example the days after the selected pass) instead of all of them.
- `date_range` is the first and last UTC date the overlay covers. Outside it the app says that the overlay
  has no data. It never says that there were no points.
- `fields` lists the feature properties to show when a point is selected, with labels and units.

## Guided tour: `story`

`story` (optional) is an ordered list of steps: a title, a few sentences, and what the map shows meanwhile
(`layer` with `date`, or with `reference` and `secondary`; `overlays`; `view`), shown by the guided story
of `web/src/story/` (`web/MOTION.md`). The pipeline copies a
site file's `story` list to `site.json` as written (`pipeline/sites/_template.yaml`); it writes no story text
of its own.

Overlays, the story and `bars` (below) were added to the contract on 14 November as optional fields. The
pipeline writes the `fires` overlay and the fire bars (`pipeline/fires.py`, `docs/METHODS.md` section 6) and
copies the story, and `validate` checks all three (rules 11 to 13 below): an overlay's file exists, is a
GeoJSON `FeatureCollection` of points inside the site's `bounds` (with a margin), every point has the date
property and its date lies within `date_range`, and `count` matches; a story step names layers, dates and
overlays that exist; a bar's `class` values exist in its `layer`.

## Dates

- A date is the **UTC calendar date** of the acquisition start, `YYYY-MM-DD`, matching granule names, the
  NASA catalog and NASA GIBS. It can differ from the local date at the site.
- `dates` lists real acquisitions only, ascending. The app never invents a calendar.
- `missing_passes` lists dates where the 12-day cycle predicts a pass but no usable product exists, with a
  reason. The app shows them as missing.

## Honesty flags

- `is_sample: true` means the site is **not** built from real NISAR observations (for example NASA's
  NISAR-format sample products, which are 2008 ALOS-1 PALSAR scenes). The app must show `notice`
  prominently for as long as that site is on screen.
- `source.release` is the data maturity. `mixed` means dates from more than one release are present; the app
  must say so wherever dates are compared, because the NISAR data guide asks for caution when a time series
  mixes releases.
- `generator.ai_assisted` is the metadata acknowledgement of AI-written processing code that the Space Apps
  rules require.
- `generator.git_commit` ends in `+uncommitted` when `git status` lists any change under `pipeline/` or
  `contract/` at the time the manifest is written: modified, staged, deleted or untracked files, the site
  files and granule lists in `pipeline/sites/` included (or when git status fails).

## Rules the schema cannot express

`npm run validate` checks all of these and exits non-zero on any failure. CI and the deploy workflow run it.

1. Site ids are unique. Layer ids are unique within a site.
2. `dates` is strictly ascending, one entry per date.
3. Every `per-date` item's `date`, and every `pair` item's `reference` and `secondary`, is in `dates`, and
   `reference` is earlier than `secondary`.
4. Every stack's `layer` names an existing `per-date` layer; `band_dates` is ascending, a subset of `dates`,
   and has exactly as many entries as the file has bands.
5. No `missing_passes` date is also in `dates`.
6. Unless `source.release` is `mixed`, every acquisition's `release` equals it.
7. If `is_sample` is true, `notice` is present and `source.release` is `sample`, and the reverse.
8. Every relative URL points at a file that exists, and every raster is a valid COG under 100 MiB, in
   EPSG:3857, uint8, nodata 0 declared, with overviews, DEFLATE compression, no scale or offset tags, grey
   band interpretation, at least one valid pixel, and an `ENCODING` tag equal to the encoding the manifest
   states for it. Tile sizes are set by the writer (`pipeline/export.py`) and are not re-checked.
9. Each raster's footprint overlaps the site's `bounds`.
10. In a `categorical-uint8` encoding every class has its own `value`, and every pixel value of the file, at
    full resolution and in every overview, is 0 or one of the listed values. Every non-zero overview pixel
    holds a value found among the pixels under it, in the level before it or at full resolution, so no
    overview averages classes, even where the average is itself a listed value.
11. Overlay ids are unique within a site. Every overlay's `url` points at a file that exists and is a GeoJSON
    `FeatureCollection` of `Point` features whose `[longitude, latitude]` lie inside the site's `bounds`
    widened by 0.01° on every side. With `date_property`, every feature holds a `YYYY-MM-DD` date in that
    property, and with `date_range` too, the date lies within it. With `count`, the file holds exactly that
    many features.
12. Every story step's `layer` is a layer of the site; a `date` is given only with a `per-date` layer that has
    a file for it; `reference` and `secondary` are given only with a `pair` layer that has that pair; a step
    that names a date or a pair names a layer; every id in `overlays` is an overlay of the site; step ids are
    unique.
13. In `stats.json`, bar ids are unique; a bar's `layer` is a layer of the site; a category with a `class`
    belongs to a bar whose `layer` is `categorical-uint8`, and its `class` is one of that layer's values.

## Areas and counts

Anything measured in square kilometres or pixel counts is computed by the pipeline on the product's own
grid (pixel count times posting squared) and published in `stats.json`. Never count EPSG:3857 pixels in the
browser: Web Mercator overstates area by 1/cos²(latitude), which is 3 % at 10°, 33 % at 30°, double at 45°
and four times at 60°.

A statistics series compares like with like: every date is computed over the pixels that are valid on all
the dates it covers, and a date with too little coverage is published as `null` rather than as a number
from different ground.

## Comparisons across categories: `bars`

`stats.json` may hold `bars` beside `series`: numbers for categories instead of dates, for example a rate
for each class of a classified map. Every category has a `label` and a `value` (null when it could not be
computed, shown as missing and never as zero). It may also carry `low` and `high` (an uncertainty interval,
which `method` must name), `n` (the count behind the value), `class` (the pixel value of that class in
the classified `layer`) and `note` (a short remark shown with the category).
