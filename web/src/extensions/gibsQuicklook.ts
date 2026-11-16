// Extension point: NASA GIBS quick-look layer for places the pipeline has not processed yet.
// Placeholder only.
//
// TODO(builder): add a raster source with a GIBS WMTS `tiles` URL for the NISAR layer, with pass
// dates taken from the NASA CMR catalog (UTC date of time_start), labelled as a quick-look. The
// source shape (a raster source with a tiles array) was tested with other tile layers; the GIBS NISAR
// layer itself was never drawn on a map, so test it first. On 14 Nov 2026 some of its tiles came back
// garbled with HTTP 200 (research/ERRATA.md), so check a few tiles before relying on it.
// GIBS answers dates past its last day with 404 and empty dates with a 288-byte tile: treat both as
// "no imagery".
export {};
