// SYNTHETIC TEST DATA. Everything this module produces is made up, for automated tests and for
// developing the app before real data exists. None of it is a radar observation, and the app must
// never ship it: it is written to tests/fixtures/synthetic-out/ (git-ignored) and served only by
// the dev and preview servers, under /synthetic-fixtures/, and under /data/ for the browser tests
// (SERVE_FIXTURES_AS_DATA=1, see scripts/serve-synthetic-fixtures.ts).
//
// Why plain JavaScript (.mjs) and not TypeScript: Node 22 runs it directly, so the generator works
// the same on Windows, macOS and Linux without a build step. Vitest imports the same functions.

import { writeArrayBuffer } from 'geotiff';

// Web Mercator (EPSG:3857) sphere radius. The display rasters must be in EPSG:3857
// (docs/DATA_CONTRACT.md), so the fixtures are built directly on that grid.
const R = 6378137;

/**
 * Convert Web Mercator metres to longitude/latitude in degrees.
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
export function mercatorToLonLat(x, y) {
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

// The fixture sits over open ocean in the central Atlantic on purpose: nobody can mistake a
// pattern drawn there for a real observation of a place.
export const GRID = {
  x0: -3360000, // west edge, metres
  y0: 2300000, // north edge, metres
  res: 600, // pixel size, metres
  width: 96,
  height: 80,
};

// The click-query stack is coarser than the display files, as real stacks may be.
export const STACK_FACTOR = 2;

export const DATES = ['2026-07-01', '2026-07-13', '2026-08-06'];
export const MISSING = [{ date: '2026-07-25', reason: 'SYNTHETIC: no product on this date (tests the missing-pass display)' }];

export const HH_ENCODING = { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 };
export const CHANGE_ENCODING = { type: 'linear-uint8', nodata: 0, lo: -15, hi: 15 };
export const CLASS_ENCODING = {
  type: 'categorical-uint8',
  nodata: 0,
  classes: [
    { value: 1, label: 'Synthetic class A', color: '#0072b2' },
    { value: 2, label: 'Synthetic class B', color: '#e69f00' },
  ],
};

export const SITE_ID = 'synthetic-test';
export const SITE_B_ID = 'synthetic-test-b';

/** physical -> pixel code, the contract's linear-uint8 formula (kept separate from src on purpose). */
function encodeLinear(value, { lo, hi }) {
  const code = 1 + Math.round((254 * (value - lo)) / (hi - lo));
  return Math.min(255, Math.max(1, code));
}

/** Deterministic small "speckle" so the picture is not a flat test card. */
function noise(c, r, k) {
  const s = Math.sin(c * 12.9898 + r * 78.233 + k * 37.719) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2; // -1..1
}

/**
 * Synthetic backscatter in dB for date index k at display pixel (c, r), or null for nodata.
 * A west-to-east gradient, a disc in the middle that changes from date to date, a nodata corner
 * on every date and a nodata strip on the last date (a partial frame).
 */
export function syntheticDb(k, c, r) {
  if (c + r < 14) return null;
  if (k === 2 && r >= GRID.height - 10) return null;
  const dx = c - GRID.width / 2;
  const dy = r - GRID.height / 2;
  const inDisc = dx * dx + dy * dy < 22 * 22;
  const base = inDisc ? [-10, -24, -16][k] : -22 + (14 * c) / (GRID.width - 1);
  return base + noise(c, r, k);
}

function displayCodes(k) {
  const out = new Uint8Array(GRID.width * GRID.height);
  for (let r = 0; r < GRID.height; r++) {
    for (let c = 0; c < GRID.width; c++) {
      const v = syntheticDb(k, c, r);
      out[r * GRID.width + c] = v === null ? 0 : encodeLinear(v, HH_ENCODING);
    }
  }
  return out;
}

function changeCodes(kRef, kSec) {
  const out = new Uint8Array(GRID.width * GRID.height);
  for (let r = 0; r < GRID.height; r++) {
    for (let c = 0; c < GRID.width; c++) {
      const a = syntheticDb(kRef, c, r);
      const b = syntheticDb(kSec, c, r);
      out[r * GRID.width + c] = a === null || b === null ? 0 : encodeLinear(b - a, CHANGE_ENCODING);
    }
  }
  return out;
}

function classCodes() {
  const out = new Uint8Array(GRID.width * GRID.height);
  for (let r = 0; r < GRID.height; r++) {
    for (let c = 0; c < GRID.width; c++) {
      if (c + r < 14) continue;
      const dx = c - GRID.width / 2;
      const dy = r - GRID.height / 2;
      out[r * GRID.width + c] = dx * dx + dy * dy < 22 * 22 ? 2 : 1;
    }
  }
  return out;
}

/**
 * Mean dB of each STACK_FACTOR x STACK_FACTOR block of display pixels, per date, encoded.
 * Averaging happens in dB here only because the data is invented; the real pipeline averages
 * linear power (docs/ARCHITECTURE.md, science rule 2).
 */
export function stackCodes() {
  const w = GRID.width / STACK_FACTOR;
  const h = GRID.height / STACK_FACTOR;
  const n = DATES.length;
  const out = new Uint8Array(w * h * n); // pixel-interleaved: all dates of one pixel together
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      for (let k = 0; k < n; k++) {
        let sum = 0;
        let count = 0;
        for (let dr = 0; dr < STACK_FACTOR; dr++) {
          for (let dc = 0; dc < STACK_FACTOR; dc++) {
            const v = syntheticDb(k, c * STACK_FACTOR + dc, r * STACK_FACTOR + dr);
            if (v !== null) {
              sum += v;
              count += 1;
            }
          }
        }
        out[(r * w + c) * n + k] = count === 0 ? 0 : encodeLinear(sum / count, HH_ENCODING);
      }
    }
  }
  return { data: out, width: w, height: h, bands: n };
}

/**
 * Write a small uint8 GeoTIFF in EPSG:3857 with nodata 0 declared. Stripped and uncompressed.
 * `origin` is the north-west corner in metres (the first fixture's grid unless given).
 */
export function writeTiff(data, width, height, bands, res, description, origin = [GRID.x0, GRID.y0]) {
  return writeArrayBuffer(data, {
    width,
    height,
    BitsPerSample: Array(bands).fill(8),
    SampleFormat: Array(bands).fill(1),
    // 1 = "min is black": stops a 3-band stack from being read as an RGB picture.
    PhotometricInterpretation: 1,
    GDAL_NODATA: '0',
    ImageDescription: description,
    GTModelTypeGeoKey: 1,
    GTRasterTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 3857,
    ModelPixelScale: [res, res, 0],
    ModelTiepoint: [0, 0, 0, origin[0], origin[1], 0],
  });
}

const NOTICE =
  'SYNTHETIC TEST DATA: made-up pictures and numbers generated by web/tests/fixtures for automated tests. Not a radar observation of any place.';

/** [west, south, east, north] in degrees of a grid's outer edges. */
export function gridBounds(grid) {
  const [west, north] = mercatorToLonLat(grid.x0, grid.y0);
  const [east, south] = mercatorToLonLat(grid.x0 + grid.width * grid.res, grid.y0 - grid.height * grid.res);
  return [west, south, east, north];
}

function bounds() {
  return gridBounds(GRID);
}

function source() {
  return {
    product: 'SYNTHETIC TEST DATA (not NISAR)',
    collection: 'none (synthetic)',
    release: 'sample',
    stack: '000_A_000',
    direction: 'ascending',
    frequency: 'A',
    posting_m: GRID.res,
    working_resolution_m: GRID.res,
    native_epsg: 3857,
  };
}

function acquisition(date) {
  return {
    date,
    datetime: `${date}T00:00:00Z`,
    granule: `SYNTHETIC_TEST_FIXTURE_${date.replaceAll('-', '')}`,
    version: 'SYNTHETIC',
    release: 'sample',
    pols: ['HH'],
    notes: 'Synthetic test fixture, not an acquisition.',
  };
}

// ---------------------------------------------------------------------------------------------
// The year site: a whole made-up year of passes, shaped like the real data will be
// (docs/WEB_FEATURES_BRIEF.md, "What the data will look like"): two per-date layers with missing
// passes and an acquisition one layer lacks, a static categorical layer, a points overlay, a guided
// tour and bars. It comes FIRST in the manifest, so the browser tests that open the app without a
// site exercise it.
//
// Its ids, dates, labels and texts differ from the real site's on purpose: an app that hard-codes
// any of them fails a test here. Tests take every date, id and count from the exports below.

export const FIXTURE_GENERATOR_NAME = 'web/tests/fixtures/synthetic.mjs (SYNTHETIC TEST DATA)';

export const YEAR_SITE_ID = 'synthetic-year';

// Open ocean again, west-south-west of the first fixture, in a box of its own.
export const YEAR_GRID = {
  x0: -4500000, // west edge, metres (about 40.4 degrees west)
  y0: 1600000, // north edge, metres (about 14.2 degrees north)
  res: 500,
  width: 120,
  height: 96,
};
export const YEAR_STACK_FACTOR = 2;

/** YYYY-MM-DD plus a number of days, in UTC. */
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from date a to date b (b - a). */
export function daysBetween(a, b) {
  const t = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

export const PASS_START = '2025-11-25';
export const PASS_INTERVAL_DAYS = 12;
export const PASS_COUNT = 30;
/** Slots (counted from 0) on which the made-up repeat cycle predicts a pass that never came. */
export const MISSING_SLOTS = [7, 11, 12, 21];
/** Every pass slot of the year, acquired or missing: 30 dates, 12 days apart. */
export const PASS_SLOTS = Array.from({ length: PASS_COUNT }, (_, slot) => addDays(PASS_START, slot * PASS_INTERVAL_DAYS));
/** The 26 acquisitions. */
export const YEAR_DATES = PASS_SLOTS.filter((_, slot) => !MISSING_SLOTS.includes(slot));
const MISSING_REASONS = [
  'SYNTHETIC: no made-up product for this pass (tests the missing-pass display)',
  'SYNTHETIC: made-up gap in the made-up instrument record',
  'SYNTHETIC: the same made-up gap, second pass',
  'SYNTHETIC: a made-up product that is unusable here',
];
export const YEAR_MISSING = MISSING_SLOTS.map((slot, i) => ({ date: PASS_SLOTS[slot], reason: MISSING_REASONS[i] }));

export const YEAR_LAYERS = { hh: 'syn-hh', hv: 'syn-hv', classes: 'syn-classes' };
/** The acquisition that the HV layer has no file for (its timeline shows "not in this layer"). */
export const HV_ABSENT_DATE = PASS_SLOTS[4];
export const YEAR_HV_DATES = YEAR_DATES.filter((d) => d !== HV_ABSENT_DATE);

export const SYN_HH_ENCODING = { type: 'linear-uint8', nodata: 0, lo: -35, hi: 5 };
export const SYN_HV_ENCODING = { type: 'linear-uint8', nodata: 0, lo: -40, hi: 0 };
export const SYN_HH_DISPLAY = { min: -24, max: -2, ramp: 'grey' };
export const SYN_HV_DISPLAY = { min: -32, max: -8, ramp: 'grey' };

// A front darkens the field from west to east over the last passes of the year.
const FRONT_FIRST_SLOT = 22;
const FRONT_LAST_SLOT = PASS_COUNT - 1;
const SLANT = 0.35; // the front runs slightly diagonally: u = column + SLANT * row
const U_MAX = YEAR_GRID.width + SLANT * YEAR_GRID.height;

/** Where the front is, in u, at a (fractional) slot position. -Infinity before it starts. */
function frontAt(slotPosition) {
  if (slotPosition < FRONT_FIRST_SLOT) return -Infinity;
  const t = Math.min(1, (slotPosition - FRONT_FIRST_SLOT + 1) / (FRONT_LAST_SLOT - FRONT_FIRST_SLOT + 1));
  return t * 0.85 * U_MAX;
}

/** Slot position of a date: 0 on the first slot, 1 twelve days later, and so on. */
const slotPosition = (date) => daysBetween(PASS_START, date) / PASS_INTERVAL_DAYS;

const yearNodata = (c, r) => c + r < 16;
/** A disc outside the made-up field: only the seasonal cycle, never the front. */
const inDisc = (c, r) => (c - 28) ** 2 + (r - 62) ** 2 < 12 * 12;
/**
 * A bright block along the south edge that moves east by about 3.6 pixels with each pass slot, so
 * that every date's picture differs visibly from every other's, even where the season repeats.
 */
const markerColumn = (slot) => 4 + Math.round((slot * (YEAR_GRID.width - 16)) / (PASS_COUNT - 1));
const inMarker = (slot, c, r) => {
  const x = markerColumn(slot);
  return r >= YEAR_GRID.height - 10 && r < YEAR_GRID.height - 3 && c >= x && c < x + 8;
};

/**
 * Synthetic backscatter in dB on pass slot `slot` at pixel (c, r) of YEAR_GRID, for 'hh' or 'hv',
 * or null for nodata: a seasonal brightness cycle, a front that sweeps across the box over the last
 * passes, the moving date marker, a nodata corner and speckle.
 */
export function yearDb(slot, c, r, pol = 'hh') {
  if (yearNodata(c, r)) return null;
  const season = Math.sin((2 * Math.PI * slot) / PASS_COUNT);
  let hh;
  if (inMarker(slot, c, r)) hh = 0;
  else if (inDisc(c, r)) hh = -19 + 2 * season;
  else if (c + SLANT * r < frontAt(slot)) hh = -21;
  else hh = -12 + 4 * season + (2 * r) / YEAR_GRID.height;
  const db = pol === 'hv' ? hh - 8 : hh;
  return db + noise(c, r, slot + (pol === 'hv' ? 1000 : 0));
}

/** The class pixel value at (c, r), consistent with the front: when it passed, or never, or outside. */
export function yearClass(c, r) {
  if (yearNodata(c, r)) return 0;
  if (inDisc(c, r)) return 5;
  const u = c + SLANT * r;
  for (let slot = FRONT_FIRST_SLOT; slot <= FRONT_LAST_SLOT; slot++) {
    if (u < frontAt(slot)) return slot <= 23 ? 1 : slot <= 26 ? 2 : 3;
  }
  return 4;
}

export const SYN_CLASS_ENCODING = {
  type: 'categorical-uint8',
  nodata: 0,
  // Okabe-Ito colours that stay apart for every kind of colour vision, with no green, so nothing
  // is red against green (tests/unit/colours.test.ts checks both).
  classes: [
    { value: 1, label: `SYNTHETIC: darkened ${PASS_SLOTS[22]} to ${PASS_SLOTS[23]}`, color: '#0072b2' },
    { value: 2, label: `SYNTHETIC: darkened ${PASS_SLOTS[24]} to ${PASS_SLOTS[26]}`, color: '#56b4e9' },
    { value: 3, label: `SYNTHETIC: darkened ${PASS_SLOTS[27]} to ${PASS_SLOTS[29]}`, color: '#d55e00' },
    { value: 4, label: 'SYNTHETIC: not darkened by the last pass', color: '#f0e442' },
    { value: 5, label: 'SYNTHETIC: outside the made-up field', color: '#cc79a7' },
  ],
};

function yearCodes(slot, pol) {
  const { width, height } = YEAR_GRID;
  const encoding = pol === 'hv' ? SYN_HV_ENCODING : SYN_HH_ENCODING;
  const out = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const v = yearDb(slot, c, r, pol);
      out[r * width + c] = v === null ? 0 : encodeLinear(v, encoding);
    }
  }
  return out;
}

/** The display codes of one date of a per-date layer ('hh' or 'hv'), row by row. */
export function yearDisplayCodes(date, pol) {
  return yearCodes(PASS_SLOTS.indexOf(date), pol);
}

export function yearClassCodes() {
  const { width, height } = YEAR_GRID;
  const out = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) out[r * width + c] = yearClass(c, r);
  return out;
}

/** Click-query stack of one layer: mean dB of each YEAR_STACK_FACTOR block, one band per date. */
function yearStackCodes(dates, pol) {
  const f = YEAR_STACK_FACTOR;
  const w = YEAR_GRID.width / f;
  const h = YEAR_GRID.height / f;
  const n = dates.length;
  const encoding = pol === 'hv' ? SYN_HV_ENCODING : SYN_HH_ENCODING;
  const out = new Uint8Array(w * h * n);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      dates.forEach((date, k) => {
        const slot = PASS_SLOTS.indexOf(date);
        let sum = 0;
        let count = 0;
        for (let dr = 0; dr < f; dr++) {
          for (let dc = 0; dc < f; dc++) {
            const v = yearDb(slot, c * f + dc, r * f + dr, pol);
            if (v !== null) {
              sum += v;
              count += 1;
            }
          }
        }
        out[(r * w + c) * n + k] = count === 0 ? 0 : encodeLinear(sum / count, encoding);
      });
    }
  }
  return { data: out, width: w, height: h, bands: n };
}

// --- The points overlay ----------------------------------------------------------------------

export const OVERLAY_ID = 'syn-points';
export const OVERLAY_DATE_PROPERTY = 'syn_day';
/** Starts in the middle of the period of the pass of 2026-09-09, ends ten days after the last pass. */
export const OVERLAY_DATE_RANGE = ['2026-09-15', addDays(PASS_SLOTS[PASS_COUNT - 1], 10)];
/** The period of one pass (from it to the day before the next) that has no points: an honest zero. */
export const EMPTY_PERIOD = [PASS_SLOTS[26], addDays(PASS_SLOTS[27], -1)];
/** A pass date that has points on the very day, and a day before a pass that has points. */
export const POINT_ON_PASS_DATE = PASS_SLOTS[27];
export const POINT_DAY_BEFORE_PASS = addDays(PASS_SLOTS[28], -1);
// Violet: neither black nor white nor any grey, so it never matches a pixel of the grey radar
// (where white would vanish on every bright or clipped pixel), and it stays apart from every class
// colour above for every vision tested (tests/unit/colours.test.ts checks both).
export const OVERLAY_COLOR = '#8000ff';
export const OVERLAY_URL = `${YEAR_SITE_ID}/${OVERLAY_ID}.geojson`;
export const OVERLAY_FIELDS = [
  { name: OVERLAY_DATE_PROPERTY, label: 'SYNTHETIC day (UTC)' },
  { name: 'syn_power', label: 'SYNTHETIC power', unit: 'MW' },
  { name: 'syn_note', label: 'SYNTHETIC note' },
];

/**
 * One point lacks one of its fields (the app must read it as "not available", never as empty or 0):
 * the first point dated `day`, in the period of the pass of PASS_SLOTS[25].
 */
export const POINT_LACKING_FIELD = { day: addDays(PASS_SLOTS[25], 3), field: 'syn_power' };

/** Small deterministic pseudo-random numbers in [0, 1) (mulberry32); never Math.random. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let pointsCache = null;

/**
 * The overlay's points: for each day of OVERLAY_DATE_RANGE outside EMPTY_PERIOD, three to eight
 * points just behind the front of that day. Returns the GeoJSON features and, for the statistics,
 * each point's class in the class raster.
 */
export function overlayPoints() {
  if (pointsCache) return pointsCache;
  const rand = seededRandom(20261114);
  const { width, height, res, x0, y0 } = YEAR_GRID;
  const features = [];
  const classes = [];
  const [first, last] = OVERLAY_DATE_RANGE;
  for (let day = first, i = 0; day <= last; day = addDays(day, 1), i++) {
    if (day >= EMPTY_PERIOD[0] && day <= EMPTY_PERIOD[1]) continue;
    const front = frontAt(slotPosition(day));
    const n = 3 + ((i * 7) % 6);
    for (let j = 0; j < n; j++) {
      const u = front - 8 + rand() * 9;
      let r = 2;
      let c = 18;
      for (let tries = 0; tries < 100; tries++) {
        r = 2 + rand() * (height - 4);
        c = u - SLANT * r;
        if (c >= 18 && c <= width - 2) break;
      }
      c = Math.min(width - 2, Math.max(18, c));
      const [lon, lat] = mercatorToLonLat(x0 + c * res, y0 - r * res);
      const power = Math.round((5 + rand() * 40) * 10) / 10;
      const properties = {
        [OVERLAY_DATE_PROPERTY]: day,
        syn_power: power,
        syn_note: `SYNTHETIC made-up point, ${['low', 'nominal', 'high'][j % 3]}`,
      };
      if (day === POINT_LACKING_FIELD.day && j === 0) delete properties[POINT_LACKING_FIELD.field];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
        properties,
      });
      classes.push(yearClass(Math.floor(c), Math.floor(r)));
    }
  }
  pointsCache = { features, classes };
  return pointsCache;
}

/** The feature that lacks a field (POINT_LACKING_FIELD). */
export function pointLackingField() {
  return overlayPoints().features.find((f) => f.properties[OVERLAY_DATE_PROPERTY] === POINT_LACKING_FIELD.day && !(POINT_LACKING_FIELD.field in f.properties));
}

/** How many overlay points are dated from `first` to `last`, both included. */
export function pointsDated(first, last) {
  return overlayPoints().features.filter((f) => {
    const d = f.properties[OVERLAY_DATE_PROPERTY];
    return d >= first && d <= last;
  }).length;
}

/** The overlay file's bytes. */
export function overlayBytes() {
  const collection = {
    type: 'FeatureCollection',
    // A foreign member: GeoJSON allows it, and it travels with the file wherever it is copied.
    note: 'SYNTHETIC TEST DATA: made-up points for automated tests. Not detections of anything.',
    features: overlayPoints().features,
  };
  return new TextEncoder().encode(`${JSON.stringify(collection)}\n`);
}

// --- The year site in the manifest -----------------------------------------------------------

export const STORY_MIDYEAR_DATE = PASS_SLOTS[15];

const YEAR_NOTICE =
  'SYNTHETIC TEST DATA: a made-up year of made-up passes, generated by web/tests/fixtures for automated tests. Not a radar observation of any place, and the points are not detections of anything.';

function yearAcquisition(date) {
  return {
    date,
    datetime: `${date}T12:34:56Z`,
    granule: `SYNTHETIC_YEAR_FIXTURE_${date.replaceAll('-', '')}`,
    version: 'SYNTHETIC',
    release: 'sample',
    pols: date === HV_ABSENT_DATE ? ['HH'] : ['HH', 'HV'],
    notes: 'SYNTHETIC: a made-up pass, not an acquisition.',
  };
}

/** A map view on a point of YEAR_GRID given as fractions of its width and height. */
function yearView(fx, fy, zoom) {
  const [lon, lat] = mercatorToLonLat(YEAR_GRID.x0 + fx * YEAR_GRID.width * YEAR_GRID.res, YEAR_GRID.y0 - fy * YEAR_GRID.height * YEAR_GRID.res);
  return { center: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5], zoom };
}

function yearSite() {
  const { res } = YEAR_GRID;
  const lastDate = YEAR_HV_DATES[YEAR_HV_DATES.length - 1];
  const points = overlayBytes();
  return {
    id: YEAR_SITE_ID,
    title: 'SYNTHETIC year of passes (test fixture)',
    summary: 'SYNTHETIC: a made-up year of passes over open ocean, used only to test the app.',
    is_sample: true,
    notice: YEAR_NOTICE,
    bounds: gridBounds(YEAR_GRID),
    source: {
      product: 'SYNTHETIC TEST DATA (not NISAR)',
      collection: 'none (synthetic year)',
      release: 'sample',
      stack: '999_D_999',
      direction: 'descending',
      frequency: 'A',
      posting_m: res,
      working_resolution_m: res,
      native_epsg: 3857,
      citation: 'SYNTHETIC test data, made up by web/tests/fixtures/synthetic.mjs; not from any instrument.',
    },
    dates: YEAR_DATES.map(yearAcquisition),
    missing_passes: YEAR_MISSING,
    layers: [
      {
        id: YEAR_LAYERS.hh,
        title: 'SYNTHETIC co-pol echo',
        kind: 'per-date',
        unit: 'dB',
        description:
          'SYNTHETIC: brighter means a stronger made-up echo; a bright block on the south edge moves east with each pass.',
        polarization: 'HH',
        method: 'SYNTHETIC: computed from a formula in web/tests/fixtures/synthetic.mjs.',
        encoding: SYN_HH_ENCODING,
        display: SYN_HH_DISPLAY,
        items: YEAR_DATES.map((date) => ({ date, url: `${YEAR_SITE_ID}/${YEAR_LAYERS.hh}_${date}.tif` })),
      },
      {
        id: YEAR_LAYERS.hv,
        title: 'SYNTHETIC cross-pol echo',
        kind: 'per-date',
        unit: 'dB',
        description: 'SYNTHETIC: the made-up cross-polarized echo; one pass has no file in this layer.',
        polarization: 'HV',
        method: 'SYNTHETIC: computed from a formula in web/tests/fixtures/synthetic.mjs.',
        encoding: SYN_HV_ENCODING,
        display: SYN_HV_DISPLAY,
        items: YEAR_HV_DATES.map((date) => ({ date, url: `${YEAR_SITE_ID}/${YEAR_LAYERS.hv}_${date}.tif` })),
      },
      {
        id: YEAR_LAYERS.classes,
        title: 'SYNTHETIC when the front passed',
        kind: 'static',
        unit: '',
        description: 'SYNTHETIC: which made-up pass first showed each cell darkened by the made-up front.',
        method: 'SYNTHETIC: computed from the same formula as the per-date layers.',
        encoding: SYN_CLASS_ENCODING,
        items: [{ url: `${YEAR_SITE_ID}/${YEAR_LAYERS.classes}.tif` }],
      },
    ],
    stacks: [
      {
        layer: YEAR_LAYERS.hh,
        url: `${YEAR_SITE_ID}/stack_${YEAR_LAYERS.hh}.tif`,
        band_dates: YEAR_DATES,
        encoding: SYN_HH_ENCODING,
        resolution_m: res * YEAR_STACK_FACTOR,
      },
      {
        layer: YEAR_LAYERS.hv,
        url: `${YEAR_SITE_ID}/stack_${YEAR_LAYERS.hv}.tif`,
        band_dates: YEAR_HV_DATES,
        encoding: SYN_HV_ENCODING,
        resolution_m: res * YEAR_STACK_FACTOR,
      },
    ],
    stats: `${YEAR_SITE_ID}/stats.json`,
    overlays: [
      {
        id: OVERLAY_ID,
        title: 'SYNTHETIC points',
        kind: 'points',
        url: OVERLAY_URL,
        description: 'SYNTHETIC: each circle is a made-up point near the made-up front; not a detection of anything.',
        method: 'SYNTHETIC: placed by a seeded formula in web/tests/fixtures/synthetic.mjs; no points in one pass period on purpose.',
        // Its own words, not a part of the site's citation: the map's credit line drops a credit that is
        // a substring of another, and the tests must see this one come and go.
        credit: 'Made-up SYNTHETIC points, placed by a formula for the app tests',
        date_property: OVERLAY_DATE_PROPERTY,
        date_range: OVERLAY_DATE_RANGE,
        fields: OVERLAY_FIELDS,
        count: overlayPoints().features.length,
        color: OVERLAY_COLOR,
        bytes: points.length,
      },
    ],
    story: [
      {
        id: 'syn-step-start',
        title: 'SYNTHETIC step 1: a made-up year',
        text: 'SYNTHETIC test text. This step shows the made-up co-pol layer and leaves the date as it is.',
        layer: YEAR_LAYERS.hh,
      },
      {
        id: 'syn-step-midyear',
        title: 'SYNTHETIC step 2: the middle of the made-up year',
        text: 'SYNTHETIC test text. This step picks a date in the middle of the year and a view.',
        layer: YEAR_LAYERS.hh,
        date: STORY_MIDYEAR_DATE,
        view: yearView(0.5, 0.5, 10),
      },
      {
        id: 'syn-step-classes',
        title: 'SYNTHETIC step 3: made-up classes',
        text: 'SYNTHETIC test text. This step shows the made-up class layer, which has no date of its own.',
        layer: YEAR_LAYERS.classes,
      },
      {
        id: 'syn-step-points',
        title: 'SYNTHETIC step 4: made-up points on the last pass',
        text: 'SYNTHETIC test text. This step shows the cross-pol layer on the last pass with the made-up points.',
        layer: YEAR_LAYERS.hv,
        date: lastDate,
        overlays: [OVERLAY_ID],
        view: yearView(0.75, 0.6, 10.5),
      },
    ],
  };
}

export const YEAR_SERIES = { meanHh: 'syn-mean-hh', share: 'syn-darkened-share' };
/** The date whose share is published as null (a gap). */
export const SHARE_NULL_DATE = PASS_SLOTS[27];
export const BARS_ID = 'syn-points-per-class';
/**
 * A second bars entry, of the same unit and layer as BARS_ID, over the points of one pass's period
 * only, so its values are far smaller (its own scale would end at 0.08, the shared one at 0.2): the
 * app must draw both on one scale, as the real site's entries of one per period.
 */
export const BARS_PERIOD_ID = 'syn-points-per-class-period';
export const BARS_PERIOD = [PASS_SLOTS[25], addDays(PASS_SLOTS[26], -1)];

/** The year site's stats.json. */
export function buildYearStats() {
  const { width, height, res } = YEAR_GRID;
  const meanHh = YEAR_DATES.map((date) => {
    const slot = PASS_SLOTS.indexOf(date);
    let sum = 0;
    let n = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const v = yearDb(slot, c, r, 'hh');
        if (v !== null) {
          sum += v;
          n += 1;
        }
      }
    }
    return { date, value: Math.round((sum / n) * 100) / 100, n };
  });
  const field = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) if (!yearNodata(c, r) && !inDisc(c, r)) field.push(c + SLANT * r);
  const share = YEAR_DATES.map((date) => {
    if (date === SHARE_NULL_DATE) return { date, value: null, n: 0 };
    const front = frontAt(PASS_SLOTS.indexOf(date));
    const darkened = field.filter((u) => u < front).length;
    return { date, value: Math.round((1000 * darkened) / field.length) / 10, n: field.length };
  });

  // Points per km2 of each class, from the points (those dated first to last) and the class raster above.
  const { classes: pointClasses, features: points } = overlayPoints();
  const classCodes = yearClassCodes();
  const kmPerPixel = (res / 1000) ** 2;
  const rate = (value, [first, last] = OVERLAY_DATE_RANGE) => {
    const n = pointClasses.filter((k, i) => {
      const day = points[i].properties[OVERLAY_DATE_PROPERTY];
      return k === value && day >= first && day <= last;
    }).length;
    const area = classCodes.filter((k) => k === value).length * kmPerPixel;
    const round = (x) => Math.round(x * 1000) / 1000;
    const high = Math.max(3, n + 2 * Math.sqrt(n));
    return { n, value: round(n / area), low: round(Math.max(0, n - 2 * Math.sqrt(n)) / area), high: round(high / area) };
  };
  const label = (value) => SYN_CLASS_ENCODING.classes.find((c) => c.value === value).label;
  const categories = [1, 2, 3].map((value) => ({ label: label(value), class: value, ...rate(value) }));
  const four = rate(4);
  categories.push({ label: label(4), class: 4, value: four.value, n: four.n });
  categories.push({ label: label(5), class: 5, value: null, note: 'SYNTHETIC: not computed, to test a missing value.' });
  const periodCategories = [1, 2, 3, 4].map((value) => ({ label: label(value), class: value, ...rate(value, BARS_PERIOD) }));
  periodCategories.push({ label: label(5), class: 5, value: null, note: 'SYNTHETIC: not computed, as in the entry above.' });

  return {
    schema: 1,
    site: YEAR_SITE_ID,
    series: [
      {
        id: YEAR_SERIES.meanHh,
        title: 'SYNTHETIC mean co-pol echo',
        unit: 'dB',
        layer: YEAR_LAYERS.hh,
        region: 'SYNTHETIC: the whole made-up box, pixels valid on every date',
        method: 'SYNTHETIC: mean of made-up dB values.',
        points: meanHh,
      },
      {
        id: YEAR_SERIES.share,
        title: 'SYNTHETIC share of the field darkened',
        unit: '%',
        layer: YEAR_LAYERS.hh,
        region: 'SYNTHETIC: the made-up field (the box without the disc and the nodata corner)',
        method: 'SYNTHETIC: share of field cells behind the made-up front; one date is null to test a gap.',
        points: share,
      },
    ],
    bars: [
      {
        id: BARS_ID,
        title: 'SYNTHETIC points per km2 by class',
        unit: 'points per km2',
        layer: YEAR_LAYERS.classes,
        region: `SYNTHETIC: the whole made-up box, ${OVERLAY_DATE_RANGE[0]} to ${OVERLAY_DATE_RANGE[1]}`,
        method:
          'SYNTHETIC: made-up points in each class divided by the class area on the synthetic grid; low and high are the count minus and plus two square roots of it (at least 3 at the top, so a zero count keeps an interval), divided by the area.',
        categories,
      },
      {
        id: BARS_PERIOD_ID,
        title: `SYNTHETIC points per km2 by class, ${BARS_PERIOD[0]} to ${BARS_PERIOD[1]}`,
        unit: 'points per km2',
        layer: YEAR_LAYERS.classes,
        region: `SYNTHETIC: the whole made-up box, ${BARS_PERIOD[0]} to ${BARS_PERIOD[1]}`,
        method:
          'SYNTHETIC: as the entry above, counting only the made-up points dated in this period, so the values are far smaller.',
        categories: periodCategories,
      },
    ],
  };
}

/** The files of the year site, as { path, bytes }. */
function yearFiles() {
  const { width, height, res, x0, y0 } = YEAR_GRID;
  const origin = [x0, y0];
  const text = (obj) => new TextEncoder().encode(`${JSON.stringify(obj, null, 2)}\n`);
  const files = [{ path: `${YEAR_SITE_ID}/stats.json`, bytes: text(buildYearStats()) }];
  for (const [pol, layer, dates] of [
    ['hh', YEAR_LAYERS.hh, YEAR_DATES],
    ['hv', YEAR_LAYERS.hv, YEAR_HV_DATES],
  ]) {
    for (const date of dates) {
      files.push({
        path: `${YEAR_SITE_ID}/${layer}_${date}.tif`,
        bytes: new Uint8Array(writeTiff(yearDisplayCodes(date, pol), width, height, 1, res, `SYNTHETIC TEST DATA ${layer} ${date}`, origin)),
      });
    }
    const stack = yearStackCodes(dates, pol);
    files.push({
      path: `${YEAR_SITE_ID}/stack_${layer}.tif`,
      bytes: new Uint8Array(
        writeTiff(stack.data, stack.width, stack.height, stack.bands, res * YEAR_STACK_FACTOR, `SYNTHETIC TEST DATA stack ${layer}`, origin),
      ),
    });
  }
  files.push({
    path: `${YEAR_SITE_ID}/${YEAR_LAYERS.classes}.tif`,
    bytes: new Uint8Array(writeTiff(yearClassCodes(), width, height, 1, res, 'SYNTHETIC TEST DATA classes', origin)),
  });
  files.push({ path: OVERLAY_URL, bytes: overlayBytes() });
  return files;
}

/**
 * Why a manifest is NOT this module's synthetic manifest, or null when it is. The browser tests
 * use it as a guard, so that a mis-wired server can never make them run on real data unnoticed.
 */
export function notSyntheticReason(json) {
  if (typeof json !== 'object' || json === null) return 'the manifest is not a JSON object';
  if (json.generator?.name !== FIXTURE_GENERATOR_NAME)
    return `the manifest was written by ${JSON.stringify(json.generator?.name)}, not by ${FIXTURE_GENERATOR_NAME}`;
  const ids = (json.sites ?? []).map((s) => s.id);
  if (ids[0] !== YEAR_SITE_ID || !ids.every((id) => FIXTURE_SITE_IDS.includes(id)))
    return `the manifest's sites are ${JSON.stringify(ids)}, not the synthetic ones ${JSON.stringify(FIXTURE_SITE_IDS)}`;
  return null;
}

// ---------------------------------------------------------------------------------------------

/** Every site of the synthetic manifest, in order. */
export const FIXTURE_SITE_IDS = [YEAR_SITE_ID, SITE_ID, SITE_B_ID];

/** The synthetic manifest. It must pass contract/manifest.schema.json (a test checks this). */
export function buildManifest() {
  const pairs = [
    [0, 1],
    [1, 2],
  ];
  return {
    schema: 1,
    generated_at: '2026-11-14T00:00:00Z',
    generator: {
      name: FIXTURE_GENERATOR_NAME,
      ai_assisted: true,
      note: 'Synthetic fixtures for automated tests, written with AI assistance (Claude).',
    },
    sites: [
      yearSite(),
      {
        id: SITE_ID,
        title: 'Synthetic test fixture',
        summary: 'Made-up rasters over open ocean, used only to test the app.',
        is_sample: true,
        notice: NOTICE,
        bounds: bounds(),
        source: source(),
        dates: DATES.map(acquisition),
        missing_passes: MISSING,
        layers: [
          {
            id: 'hh',
            title: 'Synthetic HH backscatter',
            kind: 'per-date',
            unit: 'dB',
            description: 'SYNTHETIC: brighter means a stronger made-up radar echo.',
            polarization: 'HH',
            encoding: HH_ENCODING,
            display: { min: -25, max: 0, ramp: 'grey' },
            items: DATES.map((date) => ({ date, url: `${SITE_ID}/hh_${date}.tif` })),
          },
          {
            id: 'hh-change',
            title: 'Synthetic change in HH',
            kind: 'pair',
            unit: 'dB',
            description: 'SYNTHETIC: blue means the made-up echo got weaker, orange that it got stronger.',
            encoding: CHANGE_ENCODING,
            display: { min: -10, max: 10, ramp: 'blue-orange', diverging: true },
            items: pairs.map(([a, b]) => ({
              reference: DATES[a],
              secondary: DATES[b],
              url: `${SITE_ID}/hh-change_${DATES[a]}_${DATES[b]}.tif`,
            })),
          },
          {
            id: 'classes',
            title: 'Synthetic classes',
            kind: 'static',
            unit: '',
            description: 'SYNTHETIC: two made-up classes, to test categorical colours.',
            encoding: CLASS_ENCODING,
            items: [{ url: `${SITE_ID}/classes.tif` }],
          },
        ],
        stacks: [
          {
            layer: 'hh',
            url: `${SITE_ID}/stack_hh.tif`,
            band_dates: DATES,
            encoding: HH_ENCODING,
            resolution_m: GRID.res * STACK_FACTOR,
          },
        ],
        stats: `${SITE_ID}/stats.json`,
      },
      {
        id: SITE_B_ID,
        title: 'Synthetic test fixture B (static layer only)',
        is_sample: true,
        notice: NOTICE,
        bounds: bounds(),
        source: source(),
        dates: [],
        missing_passes: [],
        layers: [
          {
            id: 'classes',
            title: 'Synthetic classes',
            kind: 'static',
            unit: '',
            description: 'SYNTHETIC: two made-up classes, to test a site with no dates.',
            encoding: CLASS_ENCODING,
            items: [{ url: `${SITE_ID}/classes.tif` }],
          },
        ],
        stacks: [],
      },
    ],
  };
}

/** Mean of the synthetic dB over the whole grid per date; the last date is left null on purpose. */
export function buildStats() {
  const points = DATES.map((date, k) => {
    if (k === DATES.length - 1) return { date, value: null, n: 0 };
    let sum = 0;
    let n = 0;
    for (let r = 0; r < GRID.height; r++) {
      for (let c = 0; c < GRID.width; c++) {
        const v = syntheticDb(k, c, r);
        if (v !== null) {
          sum += v;
          n += 1;
        }
      }
    }
    return { date, value: Math.round((sum / n) * 100) / 100, n };
  });
  return {
    schema: 1,
    site: SITE_ID,
    series: [
      {
        id: 'mean-hh',
        title: 'Synthetic mean HH',
        unit: 'dB',
        layer: 'hh',
        region: 'whole synthetic window',
        method: 'SYNTHETIC: mean of made-up dB values; the last date is null to test gaps.',
        points,
      },
    ],
  };
}

/** Every file of the fixture as { path (relative, forward slashes), bytes }. */
export function buildFiles() {
  const files = [];
  const text = (obj) => new TextEncoder().encode(`${JSON.stringify(obj, null, 2)}\n`);
  files.push({ path: 'manifest.json', bytes: text(buildManifest()) });
  // A valid manifest with no sites, for the "No data yet" state.
  files.push({ path: 'manifest-empty.json', bytes: text({ ...buildManifest(), sites: [] }) });
  files.push({ path: `${SITE_ID}/stats.json`, bytes: text(buildStats()) });
  files.push(...yearFiles());
  const { width, height, res } = GRID;
  DATES.forEach((date, k) => {
    files.push({
      path: `${SITE_ID}/hh_${date}.tif`,
      bytes: new Uint8Array(writeTiff(displayCodes(k), width, height, 1, res, `SYNTHETIC TEST DATA hh ${date}`)),
    });
  });
  for (const [a, b] of [
    [0, 1],
    [1, 2],
  ]) {
    files.push({
      path: `${SITE_ID}/hh-change_${DATES[a]}_${DATES[b]}.tif`,
      bytes: new Uint8Array(writeTiff(changeCodes(a, b), width, height, 1, res, 'SYNTHETIC TEST DATA change')),
    });
  }
  files.push({
    path: `${SITE_ID}/classes.tif`,
    bytes: new Uint8Array(writeTiff(classCodes(), width, height, 1, res, 'SYNTHETIC TEST DATA classes')),
  });
  const stack = stackCodes();
  files.push({
    path: `${SITE_ID}/stack_hh.tif`,
    bytes: new Uint8Array(
      writeTiff(stack.data, stack.width, stack.height, stack.bands, res * STACK_FACTOR, 'SYNTHETIC TEST DATA stack'),
    ),
  });
  return files;
}
