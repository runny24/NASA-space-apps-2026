# NASA Space Apps 2026: Dancing with the SARs


## How it works

An offline Python pipeline reads only the needed window out of NISAR products (several gigabytes each),
cleans and averages it, and writes small web-ready rasters plus a manifest; it also fetches NASA FIRMS fire
detections for the map. A static web app reads those files directly from GitHub Pages. No server runs at
demo time.

```
NASA archive  ->  pipeline/ (Python)  ->  web/public/data/ (COGs + manifest.json)  ->  web/ (browser)
```

Plain-language explanation: `docs/HOW_IT_WORKS.md`. Design: `docs/ARCHITECTURE.md`. The contract between
the two halves: `docs/DATA_CONTRACT.md`.

## Run it

Needs Node 22 or later, Python 3.12 or 3.13 (64-bit) and Git. The same commands work on Windows, macOS and
Linux.

```
npm run doctor     # what is installed, what is missing, how to fix it
npm run setup      # Python virtual environment + web dependencies
npm run check      # lint, tests, contract and data validation, size budget
npm run dev        # the app at http://localhost:5173
```

Working with data (the first two need no login):

```
npm run pipeline -- coverage --lon <lon> --lat <lat>    # which NISAR passes exist at a point
npm run sample                                           # rebuild the sample site from NASA's public test files (local only)
npm run pipeline -- auth-check                           # is Earthdata Login set up for real data?
npm run pipeline -- run --site <id>                      # archive -> web-ready files for one site
npm run pipeline -- marker --site <id>                   # the marker test: HH or HV for the harvest map (not part of run)
```

Real NISAR products need a free Earthdata Login, and fire detections a free NASA FIRMS map key; see `.env.example`.

## Where things are

| Path | What |
|---|---|
| `pipeline/` | Python: find granules, read a window, process, analyse the harvest, fetch fire detections, export, validate |
| `pipeline/sites/` | One config per place, plus the list of granules used |
| `web/` | The app (Vite, React, TypeScript, MapLibre GL JS) |
| `web/public/data/` | Web-ready outputs the app shows |
| `contract/` | JSON Schemas: the single source of truth for the data format |
| `docs/` | Concept, tasks, methods, sources, how it works |
| `research/` | Research done before kickoff, kept as written, with its errata |
| `AI_USE.md` | Where and how AI tools were used |

## Use of AI

This project was built with AI assistance, and we say so here, in the app's About panel, in `AI_USE.md`,
and in the data itself (`generator.ai_assisted` in `manifest.json` and a tag in every raster we export). Claude (Anthropic), running in Claude Code, did the
pre-kickoff research and wrote code and documentation under the team's direction. No image, video or audio in this project is AI-generated.

## Data and credits

- NISAR data courtesy NASA/JPL-Caltech and ISRO, distributed by the Alaska Satellite Facility DAAC.
- Catalog search through NASA's Common Metadata Repository (CMR).
- Fire detections: "We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource
  Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time
  Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance), and NASA's Earth Science Data
  and Information System (ESDIS)."
- Basemap: OpenFreeMap © OpenMapTiles, data from OpenStreetMap.
- Every dataset, library and resource, with its licence: `docs/SOURCES.md`.

This project is not affiliated with or endorsed by NASA or ISRO.

## Licence

Apache License 2.0. See `LICENSE`.
