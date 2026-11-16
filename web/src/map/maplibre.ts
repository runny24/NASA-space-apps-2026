// The one place MapLibre GL JS and the cog:// protocol are set up. Every other module imports
// `maplibregl` and `cog` from here, so the setup runs exactly once, before any map exists.
//
// Why each line (tested with MapLibre 6.18.0 under Vite 8: research/digests/browser.md, section 6.1):
// - MapLibre 6 has no default export, so it must be a namespace import.
// - Without setWorkerUrl, MapLibre 6 looks for its worker next to the bundled chunk, where it does
//   not exist: COG rasters still draw but the vector basemap silently disappears.
// - addProtocol('cog', ...) lets a raster source read a Cloud-Optimized GeoTIFF straight from
//   static hosting with HTTP range requests.

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import * as cog from '@geomatico/maplibre-cog-protocol';

maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('cog', cog.cogProtocol);

export { maplibregl, cog };
