# Sources: every dataset, service, library and resource we use

The Space Apps rules require listing "all of the data, resources, and tools used", including code, text and
images, and identifying the licence of third-party material. This page is that list. The project page's
"NASA Data" and "Space Agency Partner Data and Other References" fields are filled from it.

**Add a line here in the same commit that adds a dependency, dataset, image or borrowed snippet.** Only
open-licensed material may be used (see `CLAUDE.md`).

## Data

| What | Used for | Where | Terms |
|---|---|---|---|
| NISAR L2 GCOV products (NASA-ISRO SAR mission, L-band) | The measurements the app is built on: site `tarn-taran`, stack 156_A_017, 24 dates from 2025-11-21 to 2026-11-04 (provisional and validated releases), processed and published since 14 November 2026 | Alaska Satellite Facility DAAC, https://search.asf.alaska.edu/ ; data host `nisar.asf.earthdatacloud.nasa.gov` (free Earthdata Login) | NASA open data. Credit: "NISAR data courtesy NASA/JPL-Caltech and ISRO, distributed by the Alaska Satellite Facility DAAC" |
| NISAR sample data products: two L2 GCOV files in NISAR format made from 2008 ALOS-1 PALSAR scenes over Rosamond, California (stack 030_A_019, release id D00404) | The `sample` site, which proved the processing chain. **Not NISAR observations.** Retired from the public app on 14 November 2026 (T7); `npm run sample` rebuilds it locally | https://science.nasa.gov/mission/nisar/sample-data/ ; files under `https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/` (no login) | Published by NASA/JPL for testing; NASA's page gives no usage statement. The original ALOS-1 PALSAR data is © JAXA/METI 2008, which the site's citation says |
| NASA Common Metadata Repository (CMR) granule search | Finding which NISAR passes exist for a place (`coverage`, `discover`) | https://cmr.earthdata.nasa.gov/search/ (no login) | NASA open data |
| NASA FIRMS active fire detections, VIIRS 375 m (Suomi NPP, NOAA-20, NOAA-21; products VNP14IMGTDL_NRT, VJ114IMGTDL_NRT, VJ214IMGTDL_NRT and the standard-processing versions), through the FIRMS area API | The `fires` overlay, the fire bars and the marker test (`pipeline/fires.py`, `pipeline/marker.py`, `docs/METHODS.md` section 6): 452 detections in the site box from 2026-09-15 to 2026-11-14, fetched on 15 November 2026 (UTC; the evening of 14 November in Central Time) from the three NRT sources | https://firms.modaps.eosdis.nasa.gov/api/area/ (free map key: https://firms.modaps.eosdis.nasa.gov/api/map_key/); attribute table: https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs | NASA open data ("NASA supports full and open sharing of data"; provided "as is", https://www.earthdata.nasa.gov/data/projects/lance/disclaimer). FIRMS asks for its acknowledgement whenever its data is passed on; the overlay's `credit` is that sentence word for word, from https://www.earthdata.nasa.gov/data/tools/firms ("Acknowledgments"): "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance), and NASA's Earth Science Data and Information System (ESDIS)." For a caption FIRMS suggests "NASA FIRMS". Suggested dataset citation (NOAA-20 NRT): NASA VIIRS Land Science Team (2020), VIIRS NOAA-20 (JPSS-1) 375m, I-Band Active Fire Product NRT (Vector Data), doi:10.5067/FIRMS/VIIRS/VJ114IMGT_NRT.002 |
| Copernicus Sentinel-2 Level-2A surface reflectance (ESA): bands B04 (red) and B08 (near-infrared) at 10 m and the scene classification (SCL) at 20 m, tile 43RDQ, 19 granules on 16 dates from 2026-09-13 to 2026-11-12 (11 usable), read as Cloud-Optimized GeoTIFFs, only the window of the product grid | The optical cross-check of the harvest map only (`research/optical_check/`, `docs/METHODS.md` section 6): NDVI of the 100 m cells by radar class, read once on 15 November 2026 (05:01 to 05:03 UTC). No imagery is shown in the app or committed; the app states the result in two sentences of the story's step "The harvest wave", which end with the credit, and in one item of the About panel's "Limits"; the panel's "Data and credits" carries the credit | Earth Search catalog by Element 84, collection `sentinel-2-l2a`, https://earth-search.aws.element84.com/v1 ; files on https://sentinel-cogs.s3.us-west-2.amazonaws.com (no login) | Copernicus Sentinel data: free, full and open access under the Legal notice on the use of Copernicus Sentinel Data and Service Information (European Commission), https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice (a PDF, opened on 15 November 2026; the catalog's `license` link gives the same path on sentinel.esa.int, a host that no longer resolves). Credit, as the notice asks for modified data: "Contains modified Copernicus Sentinel data 2026". Collection citation: Sentinel-2 MSI Level-2A BOA Reflectance, Collection 1, European Space Agency, https://doi.org/10.5270/S2_-znk9xsj. The scenes used have processing baselines 05.12 and 05.13, and ESA's Level-2A Collection 1 is the data made from processing baseline 05.00 on. The catalog record's `cite-as` DOI, 10.5270/S2_-742ikth, is registered to Level-1C, so it is not used |

## Services

| What | Used for | Where | Terms |
|---|---|---|---|
| NASA Earthdata Login | Signing in to download real NISAR products (`auth-check`, `fetch`) | https://urs.earthdata.nasa.gov/ | Free account; the "Alaska Satellite Facility Data Access" agreement must be accepted |
| NASA FIRMS map key | Asking the FIRMS area API for fire detections (`fires`) | https://firms.modaps.eosdis.nasa.gov/api/map_key/ | Free, sent by email; the API page states a limit of 5000 transactions per 10-minute interval per key |
| OpenFreeMap vector basemap | Background map | https://openfreemap.org/ | MIT (project). Map data © OpenMapTiles, data from OpenStreetMap (ODbL). Credit shown on the map; add "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" by hand on video frames, slides and screenshots |
| GitHub Pages and GitHub Actions | Hosting and automated checks | https://github.com/runny24/NASA-space-apps-2026 | GitHub terms of service |
| Earth Search STAC API, by Element 84 | Listing the Sentinel-2 scenes over the site box for the optical cross-check only (only the box and the dates are sent); no imagery is shown in the app | https://earth-search.aws.element84.com/v1 | Public, no login. The catalog's providers are ESA (producer), Sinergise and Element 84 (processors), and AWS (host). The service's own terms were not checked |
| The public bucket of Sentinel-2 Cloud-Optimized GeoTIFFs that the Earth Search items point to | Reading the window of each scene's red, near-infrared and scene classification files over https (GDAL's `/vsicurl/`) for the optical cross-check only; no imagery is shown in the app | https://sentinel-cogs.s3.us-west-2.amazonaws.com | Public, no login. The data's terms are those of the Copernicus Sentinel data (Data, above); the bucket's own terms were not checked |

## Libraries: pipeline (Python)

Versions are the pins in `pipeline/requirements.txt` and `pipeline/requirements-dev.txt`.

| Library | Version | Licence | Used for |
|---|---|---|---|
| NumPy | 2.5.4 | BSD-3-Clause | Array arithmetic |
| SciPy | 1.18.1 | BSD-3-Clause | Filters; chi-square quantiles for the Poisson interval of the fire bars |
| h5py (with HDF5) | 3.16.0 | BSD-3-Clause | Reading NISAR HDF5 files |
| fsspec | 2026.9.0 | BSD-3-Clause | Reading remote files by byte range |
| aiohttp | 3.14.5 | Apache-2.0 AND MIT | HTTP transport for fsspec |
| affine | 3.0.1 | BSD-3-Clause | Raster grid transforms |
| requests | 2.34.2 | Apache-2.0 | HTTP |
| rasterio (bundles GDAL and PROJ, both MIT) | 1.5.2 | BSD-3-Clause | Reprojection, writing GeoTIFFs |
| rio-cogeo | 7.0.4 | BSD-3-Clause | Writing and validating Cloud-Optimized GeoTIFFs |
| morecantile | 7.1.0 | MIT | Web map tile grid definitions |
| pyproj | 3.8.0 | MIT | Coordinate transforms |
| earthaccess | 0.19.0 | MIT | Earthdata Login sessions |
| PyYAML | 6.0.3 | MIT | Site configuration files |
| jsonschema | 4.26.0 | MIT | Validating the manifest against the contract |
| Matplotlib | 3.11.2 | Matplotlib licence (BSD-compatible, PSF-based) | QA histograms and thumbnails |
| certifi | 2026.10.23 | MPL-2.0 | Certificate bundle for HTTPS |
| pytest | 9.2.0 | MIT | Tests (development only) |
| Ruff | 0.17.5 | MIT | Linting (development only) |

## Libraries: web app (JavaScript)

Versions are the pins in `web/package.json`.

| Library | Version | Licence | Used for |
|---|---|---|---|
| MapLibre GL JS | 6.18.0 | BSD-3-Clause | The map |
| @geomatico/maplibre-cog-protocol | 0.10.0 | MIT | Drawing Cloud-Optimized GeoTIFFs on the map |
| geotiff.js | 3.0.5 | MIT | Reading pixel values from Cloud-Optimized GeoTIFFs |
| React, React DOM | 19.3.1 | MIT | User interface |
| Vite, @vitejs/plugin-react | 8.3.8, 6.3.0 | MIT | Build tool (development only) |
| TypeScript | 6.0.3 | Apache-2.0 | Language (development only) |
| Vitest | 5.1.0 | MIT | Unit tests (development only) |
| Playwright | 1.65.1 | Apache-2.0 | Browser smoke test (development only) |
| ESLint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, globals | 10.15.0, 10.0.1, 8.72.2, 7.1.1, 17.14.0 | MIT | Linting (development only) |
| @types/node, @types/react, @types/react-dom | 22.20.5, 19.3.0, 19.3.0 | MIT | Type definitions (development only) |
| Ajv, ajv-formats | 8.20.0, 3.0.1 | MIT | Contract tests (development only) |
| json-schema-to-typescript | 16.0.0 | MIT | Generating types from the contract (development only) |
| Instrument Serif (font), through the Fontsource package `@fontsource/instrument-serif`, https://fontsource.org/ | 5.3.0 | SIL OFL 1.1. Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif) | The titles of the guided story. The Latin 400 file only, served with the app |
| Geist Mono (font), through the Fontsource package `@fontsource/geist-mono`, https://fontsource.org/ | 5.3.0 | SIL OFL 1.1. Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git) | The date on the map and the figures of the guided story. The Latin 500 file only, served with the app |

## Colour schemes

| What | Used for | Where | Terms |
|---|---|---|---|
| ColorBrewer 2.0 schemes (Greys, PuOr, RdBu, BrBG): colour stops copied into `web/src/map/ramps.ts`. The red-green scheme RdYlGn is copied into `web/tests/unit/colours.test.ts` only, as the counter-example the colour-blindness test must reject; the app does not use it | Map colour ramps and legends; one test | https://colorbrewer2.org/ | Apache-2.0 (Cynthia Brewer, Mark Harrower, The Pennsylvania State University) |
| Okabe and Ito's colour-blind-safe palette ("Color Universal Design"): one colour, vermillion #d55e00, copied into `pipeline/fires.py` as the drawing hint of the `fires` overlay | Fire detection points | https://jfly.uni-koeln.de/color/ | One colour value; the page states no licence |
| viridis colour map: colour stops copied into `web/src/map/ramps.ts`, and five of its colours (#440154, #3b528b, #21918c, #5ec962, #fde725) into `pipeline/harvest.py` as the classes of the `harvest-wave` layer. That layer's two other colours (#b8a3d8, #d9d9d9) were picked for the project, not copied from a scheme | Map colour ramp; harvest-wave legend | https://bids.github.io/colormap/ | CC0-1.0 |

## References we learned from

Documentation and training material. No text or code was copied from them into the project unless a row
says so.

| What | Where | Terms |
|---|---|---|
| NISAR Data User Guide (ASF) | https://nisar-docs.asf.alaska.edu/ | CC0-1.0 |
| ASF NISAR Cookbook (notebooks; reading idioms consulted, no code copied) | https://github.com/ASFOpenSARlab/NISAR_Cookbook | Apache-2.0 per its LICENSE file |
| NASA Earthdata "What is SAR?" and image interpretation | https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar | NASA |
| NASA ARSET trainings on SAR and NISAR | https://www.earthdata.nasa.gov/data/projects/arset | NASA |
| NISAR product specifications (L2 GCOV) | linked from the NISAR Data User Guide | NASA/JPL |
| Space Apps rule pages (saved copies in `research/evidence/rules/`) | https://www.spaceappschallenge.org/ | NASA Space Apps |
| The challenge's Resources tab | https://www.spaceappschallenge.org/2026/challenges/ | see each resource |
| Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE Transactions on Visualization and Computer Graphics 15(6), doi:10.1109/TVCG.2009.113. **Copied:** its two 3 x 3 simulation matrices for protanopia and deuteranopia (severity 1.0), into `web/tests/unit/colours.test.ts`, which checks that the colour ramps survive colour-blindness. They are in a test only, not in the app | https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html | Published research results (numeric constants), cited here; the authors' page states no licence |
| Otsu, N. (1979), "A Threshold Selection Method from Gray-Level Histograms", IEEE Transactions on Systems, Man, and Cybernetics 9(1), 62-66, doi:10.1109/TSMC.1979.4310076. The method (the split of a histogram that maximises the variance between the two groups) is implemented in `pipeline/harvest.py` for the rice threshold; no code or text copied | https://doi.org/10.1109/TSMC.1979.4310076 | Published research method, cited here |
| Garwood, F. (1936), "Fiducial Limits for the Poisson Distribution", Biometrika 28(3/4), 437-442. The exact Poisson interval through chi-square quantiles, implemented in `pipeline/fires.py` for the fire bars; no code or text copied | Biometrika | Published research method, cited here |
| FIRMS documentation: the area API page (URL shape, sources, 1 to 5 days per request), the VIIRS 375 m attribute table (CSV columns and codes) and the FIRMS FAQ (what a detection is and is not). Read on 14 November 2026; their facts are used in `pipeline/fires.py`, its overlay description and `docs/METHODS.md` section 6, in our own words except the acknowledgement quoted above | https://firms.modaps.eosdis.nasa.gov/api/area/ ; https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs ; https://www.earthdata.nasa.gov/data/tools/firms/faq | NASA |
| Official paddy-harvest progress in Punjab, as reported by news agencies; each page opened on 14 November 2026 and the figure seen on it. (1) PTI, "Tarn Taran accounts for nearly half of Punjab's 542 farm fire cases", 24 October 2026: Punjab 34.82 % of 34.506 lakh ha harvested till 23 October; Tarn Taran 73 %, Amritsar 83 %. (2) ANI, "Pollution control board flags 2347 incidents of stubble burning in Punjab, 647 FIRs registered", 5 November 2026: 85.10 % of 32.87 lakh ha, Punjab Pollution Control Board report as of 4 November. (3) PTI, "Punjab farm fires cases reach 1,612, of these 489 from Tarn Taran", 2 November 2026: more than 90 % in Tarn Taran and Amritsar. Used in `docs/METHODS.md` section 6, figures only, in our own words | (1) https://theprint.in/india/tarn-taran-accounts-for-nearly-half-of-punjabs-542-farm-fire-cases/3080636/ ; (2) https://www.devdiscourse.com/article/headlines/4001794-pollution-control-board-flags-2347-incidents-of-stubble-burning-in-punjab-647-firs-registered ; (3) https://theprint.in/india/punjab-farm-fires-cases-reach-1612-of-these-489-from-tarn-taran/3088694/ | News reports, cited for their figures; no text reused |
| W3C Web Content Accessibility Guidelines (WCAG) 2.2: the contrast-ratio and relative-luminance definitions, implemented in `web/tests/unit/colours.test.ts`; its success criteria guided the accessibility pass. No text copied | https://www.w3.org/TR/WCAG22/ | W3C document licence |

## Tools

| What | Used for |
|---|---|
| Claude (Anthropic) in Claude Code: Claude Fable 5.2 and Claude Opus 5.5 | Pre-kickoff research; writing code and documentation under the team's direction. Full log: `AI_USE.md` |
| Git and GitHub | Version control, hosting, CI |

## Images

Every picture in the app is real data or a diagram drawn in code. No AI-generated images. No NASA logos or
mission emblems. The preview images in `research/evidence/previews/` are NASA's own public browse products
(courtesy NASA/JPL-Caltech and ISRO, via ASF and NASA GIBS); they are research notes and are not used in
the app.
