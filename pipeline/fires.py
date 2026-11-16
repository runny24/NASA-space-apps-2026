"""Fire detections from NASA FIRMS (VIIRS 375 m active fires), and how dense they are on each class of the
harvest map. docs/METHODS.md, section 6, says the same in plain words.

What the FIRMS area API is, as its own page says (read on 14 November 2026,
https://firms.modaps.eosdis.nasa.gov/api/area/):

    /api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]

AREA_COORDINATES is west,south,east,north in degrees; DAY_RANGE is 1 to 5; with DATE (YYYY-MM-DD) it "Returns
data for [DATE] .. [DATE + DAY_RANGE-1]". The answer is CSV. The key is a path segment of the URL, so a URL
that holds it is never printed, logged or stored: every message goes through `redact`, and the cache names
files by source and date only. The CSV columns used here are those of the VIIRS 375 m attribute table
(https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs): latitude and
longitude ("Center of nominal 375 m fire pixel"), acq_date, acq_time (UTC), satellite (N Suomi NPP, N20
NOAA-20, N21 NOAA-21), confidence (l, n, h: low, nominal, high), frp (fire radiative power, MW), daynight
(D, N). Other columns are ignored.

The steps, each a small function with its own test (pipeline/tests/test_fires.py):

  1. plan       the days from start to the last day that has ended (UTC), cut into requests of at most
                MAX_DAYS days, the API's limit
  2. fetch      one CSV per source and request, cached under work/<site>/fires/; a re-run asks only for what
                is missing, and again for a request made less than SETTLE_DAYS after its last day
  3. parse      the rows into detections: date, time, satellite, confidence, FRP, day or night, source
  4. merge      all sources together; one detection found in two sources (same satellite, UTC date and time,
                latitude and longitude) is kept once, from the source listed first
  5. attribute  each detection stands for a 375 m square and is shared among the classes of the harvest map
                by the area of the square on each class's cells
  6. density    detections per km2 of each class, with Garwood's 95 % Poisson interval (exact for whole counts)
                applied to the shared count
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import io
import math
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from affine import Affine
from pyproj import Transformer
from scipy.stats import chi2

from pipeline import cmr
from pipeline.harvest import MONTHS, cells_in_boxes, date_text
from pipeline.rasters import discard_temp, read_json, temp_path, write_json

API_AREA_CSV = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
MAX_DAYS = 5  # DAY_RANGE "1..5" on the API page
ENV_KEY = "FIRMS_MAP_KEY"
KEY_URL = "https://firms.modaps.eosdis.nasa.gov/api/map_key/"
NO_KEY = (f"no {ENV_KEY} is set, so FIRMS cannot be asked; a free key is sent by email from {KEY_URL}. "
          f"Put it in .env as {ENV_KEY}=<your key> (see .env.example) and run again")
BAD_KEY = (f"{ENV_KEY} holds characters a map key does not have (a space, slash, quote or the like; its value is "
           "not shown), so it was not used; paste it again on one line, with nothing else after the = sign")
# A request made less than this many days, by UTC date, after its last day (so fetched on a UTC date before
# last day + SETTLE_DAYS) is asked again on the next run: near-real-time detections keep arriving for some
# hours after each pass.
SETTLE_DAYS = 2
TIMEOUT_S = 120
# The nominal VIIRS I-band pixel: each detection stands for a square of this side, centred on it.
PIXEL_M = 375.0
OUTSIDE_CODE = -1  # marks cells outside the region in attribute (class values are 1..255, no data 0)
INTERVAL_LEVEL = 0.95
REQUIRED_COLUMNS = ("latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp", "daynight")
SATELLITES = {"N": "Suomi NPP", "N20": "NOAA-20", "N21": "NOAA-21"}  # unknown codes are kept as they are
CONFIDENCE = {"l": "low", "n": "nominal", "h": "high"}
DAYNIGHT = {"D": "day", "N": "night"}
DETECTION_FIELDS = ("date", "time_utc", "satellite", "confidence", "frp_mw", "daynight", "source")

OVERLAY_ID = "fires"
OVERLAY_FILE = "fires.geojson"
# Okabe and Ito's vermillion: saturated, so it stands out on grey radar, and on the colour-blind-safe list.
OVERLAY_COLOUR = "#d55e00"
# FIRMS's acknowledgement, word for word from https://www.earthdata.nasa.gov/data/tools/firms ("Acknowledgments",
# read on 14 November 2026), which asks for it whenever FIRMS data is passed on.
CREDIT = ("We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System "
          "(FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability "
          "for Earth observations (LANCE) (https://earthdata.nasa.gov/lance), and NASA's Earth Science Data and "
          "Information System (ESDIS).")
FIELDS = [
    {"name": "date", "label": "Date of the pass (UTC)"},
    {"name": "time_utc", "label": "Time of the pass (UTC)"},
    {"name": "satellite", "label": "Satellite"},
    {"name": "confidence", "label": "Detection confidence"},
    {"name": "frp_mw", "label": "Fire radiative power", "unit": "MW"},
    {"name": "daynight", "label": "Day or night pass"},
    {"name": "source", "label": "FIRMS source"},
]


class FiresError(RuntimeError):
    """FIRMS could not be asked, or answered with something other than fire detections. The message never holds
    the map key."""


# The map key ------------------------------------------------------------------------------------------------

def map_key(environ=None) -> tuple[str | None, str | None]:
    """(key, None) when FIRMS_MAP_KEY holds a usable key, else (None, what to do). Never returns the value in
    a message."""
    environ = os.environ if environ is None else environ
    key = (environ.get(ENV_KEY) or "").strip()
    if not key:
        return None, NO_KEY
    if not re.fullmatch(r"[A-Za-z0-9._~-]+", key):  # URL-safe characters only: the key is a path segment
        return None, BAD_KEY
    return key, None


def redact(text: str, key: str | None) -> str:
    """The text with every occurrence of the key replaced, so no message, record or file can carry it."""
    return text.replace(key, "[MAP_KEY]") if key else text


# Step 1: plan -----------------------------------------------------------------------------------------------

def utc_now() -> dt.datetime:
    """The current UTC time (tests replace this)."""
    return dt.datetime.now(dt.UTC)


def last_day(end: str, today: dt.date) -> dt.date:
    """The last day to ask for: `end`, or yesterday (UTC) when `end` has not ended yet."""
    return min(dt.date.fromisoformat(end), today - dt.timedelta(days=1))


def chunks(first: dt.date, last: dt.date, max_days: int = MAX_DAYS) -> list[tuple[dt.date, int]]:
    """(first day, number of days) of each request covering first..last, in order, none longer than max_days."""
    out = []
    day = first
    while day <= last:
        days = min(max_days, (last - day).days + 1)
        out.append((day, days))
        day += dt.timedelta(days=days)
    return out


def chunk_name(source: str, first: dt.date, days: int) -> str:
    """The cache name of one request: source and days only, never anything from the URL."""
    return f"{source}_{first.isoformat()}_{days}d"


def _coordinate(value: float) -> str:
    return repr(float(value))  # the shortest text that reads back as the same number


def request_url(key: str, source: str, bbox, first: dt.date, days: int) -> str:
    """The area API request for one source and up to MAX_DAYS days. Holds the key: never print or store it."""
    if not 1 <= days <= MAX_DAYS:
        raise ValueError(f"FIRMS takes 1 to {MAX_DAYS} days per request, not {days}")
    area = ",".join(_coordinate(v) for v in bbox)
    return f"{API_AREA_CSV}/{key}/{source}/{area}/{days}/{first.isoformat()}"


# Step 2: fetch ----------------------------------------------------------------------------------------------

def http_get(url: str) -> bytes:
    """GET a URL and return the body. The only network call of this module (tests replace it)."""
    request = urllib.request.Request(url, headers={"User-Agent": cmr.USER_AGENT})
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=cmr.ssl_context()))
    with opener.open(request, timeout=TIMEOUT_S) as response:
        return response.read()


def _header(body: bytes) -> list[str]:
    first = body.decode("utf-8-sig", errors="replace").splitlines()[:1]
    return [c.strip() for c in first[0].split(",")] if first else []


def fetch_chunk(key: str, source: str, bbox, first: dt.date, days: int) -> bytes:
    """The raw CSV of one request. Raises FiresError, with the key removed from the message, when the request
    fails or the answer is not a CSV of detections (FIRMS answers a bad key or bad parameters with a line of
    text)."""
    last = first + dt.timedelta(days=days - 1)
    where = f"{source} {first.isoformat()}..{last.isoformat()}"
    problem = None
    body = b""
    try:
        body = http_get(request_url(key, source, bbox, first, days))
    except urllib.error.HTTPError as exc:
        try:
            text = exc.read(300).decode("utf-8", "replace")
        except Exception:  # noqa: BLE001 - the body is only for the message
            text = ""
        problem = f"FIRMS answered HTTP {exc.code}: {' '.join(text.split())[:200] or 'no message'}"
    except Exception as exc:  # noqa: BLE001 - every failure becomes one message without the key
        problem = f"the request failed ({type(exc).__name__}: {exc})"
    # Raised outside the except blocks, so the original error (whose text may hold the URL) is not chained.
    if problem is not None:
        raise FiresError(redact(f"FIRMS {where}: {problem}", key))
    header = _header(body)
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        line = body.decode("utf-8", "replace").strip().splitlines()[:1]
        raise FiresError(redact(f"FIRMS {where}: the answer is not a CSV of fire detections (no column "
                                f"{', '.join(missing)}); it begins: {(line[0] if line else '')[:200]!r}", key))
    return body


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def chunk_status(folder: Path, source: str, bbox, first: dt.date, days: int, today: dt.date) -> str:
    """"settled" (cached and asked at least SETTLE_DAYS after its last day: reused), "recent" (cached but asked
    sooner: asked again when a key is set) or "missing" (not cached, cached for another box, or damaged)."""
    name = chunk_name(source, first, days)
    data, record = folder / f"{name}.csv", folder / f"{name}.json"
    if not (data.is_file() and record.is_file()):
        return "missing"
    try:
        rec = read_json(record)
        ok = (rec.get("source") == source and rec.get("bbox") == [float(v) for v in bbox]
              and rec.get("first") == first.isoformat() and rec.get("days") == days
              and rec.get("sha256") == sha256(data.read_bytes()))
        fetched = dt.date.fromisoformat(rec["fetched_utc"][:10])
    except (OSError, ValueError, KeyError, TypeError):
        return "missing"
    if not ok:
        return "missing"
    last = first + dt.timedelta(days=days - 1)
    return "settled" if fetched >= last + dt.timedelta(days=SETTLE_DAYS) else "recent"


def save_chunk(folder: Path, key: str, source: str, bbox, first: dt.date, days: int, body: bytes,
               rows: int) -> dict:
    """Write the raw CSV, then its record (so a run cut off between the two leaves no record of a missing
    file). The record holds the request with the key replaced by [MAP_KEY]."""
    name = chunk_name(source, first, days)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{name}.csv"
    tmp = temp_path(target)
    try:
        tmp.write_bytes(body)
        os.replace(tmp, target)
    finally:
        discard_temp(tmp)
    record = {"source": source, "first": first.isoformat(),
              "last": (first + dt.timedelta(days=days - 1)).isoformat(), "days": days,
              "bbox": [float(v) for v in bbox],
              "request": redact(request_url(key, source, bbox, first, days), key),
              "fetched_utc": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"), "rows": rows, "sha256": sha256(body)}
    write_json(folder / f"{name}.json", record)
    return record


# Step 3: parse ----------------------------------------------------------------------------------------------

def _time(text: str) -> str:
    """acq_time as HH:MM. The attribute table says only "UTC"; both 0018 and 18 (no leading zeros) read as 00:18."""
    t = text.strip().replace(":", "")
    if not t.isdigit() or len(t) > 4:
        raise ValueError(f"acq_time {text!r} is not HHMM")
    hours, minutes = divmod(int(t), 100)
    if hours > 23 or minutes > 59:
        raise ValueError(f"acq_time {text!r} is not a time of day")
    return f"{hours:02d}:{minutes:02d}"


def parse_csv(body: bytes, source: str) -> list[dict]:
    """The detections of one FIRMS CSV, in file order. Each holds lat, lon (the pixel centre, as given) and
    the published properties (DETECTION_FIELDS). A row that cannot be read stops the run: nothing is skipped."""
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")))
    missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise FiresError(f"{source}: the CSV has no column {', '.join(missing)}")
    out = []
    for line, row in enumerate(reader, start=2):
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
            date = row["acq_date"].strip()
            dt.date.fromisoformat(date)
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                raise ValueError(f"acq_date {date!r} is not YYYY-MM-DD")
            if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError(f"latitude {lat}, longitude {lon} is not a place")
            frp_text = (row["frp"] or "").strip()
            frp = float(frp_text) if frp_text else None
            satellite = (row["satellite"] or "").strip()
            confidence = (row["confidence"] or "").strip()
            daynight = (row["daynight"] or "").strip()
            out.append({"lat": lat, "lon": lon, "date": date, "time_utc": _time(row["acq_time"] or ""),
                        "satellite": SATELLITES.get(satellite, satellite),
                        "confidence": CONFIDENCE.get(confidence, confidence), "frp_mw": frp,
                        "daynight": DAYNIGHT.get(daynight, daynight), "source": source})
        except (ValueError, TypeError) as exc:
            raise FiresError(f"{source}: line {line} of the CSV cannot be read: {exc}") from None
    return out


# Step 4: merge ----------------------------------------------------------------------------------------------

def detection_key(d: dict) -> tuple:
    """What makes two rows the same detection: the same satellite saw the same pixel on the same pass."""
    return (d["satellite"], d["date"], d["time_utc"], d["lat"], d["lon"])


def merge(by_source: list[tuple[str, list[dict]]]) -> tuple[list[dict], dict[str, int]]:
    """All detections, each once, sorted by date, time, satellite and place. `by_source` is in the order of
    preference: a detection found again in a later source (or twice in one) is dropped and counted under the
    source it was dropped from."""
    seen: set[tuple] = set()
    kept, dropped = [], {}
    for source, detections in by_source:
        dropped.setdefault(source, 0)
        for d in detections:
            k = detection_key(d)
            if k in seen:
                dropped[source] += 1
                continue
            seen.add(k)
            kept.append(d)
    kept.sort(key=lambda d: (d["date"], d["time_utc"], d["satellite"], d["lat"], d["lon"], d["source"]))
    return kept, dropped


def in_box(d: dict, bbox) -> bool:
    w, s, e, n = bbox
    return w <= d["lon"] <= e and s <= d["lat"] <= n


# The overlay ------------------------------------------------------------------------------------------------

def feature_collection(detections: list[dict]) -> dict:
    """GeoJSON points, [longitude, latitude] rounded to 5 decimals (about 1 m), properties DETECTION_FIELDS."""
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(d["lon"], 5), round(d["lat"], 5)]},
         "properties": {k: d[k] for k in DETECTION_FIELDS}} for d in detections]}


DESCRIPTION = (
    "Each dot is one VIIRS fire detection: a 375 m pixel that a satellite flagged as holding at least one fire at "
    "the time of its pass, drawn at the pixel's centre. It is not a fire's exact place, its size or a count of "
    "burning fields, and fires that burn between passes or under thick smoke or cloud can be missed.")


def overlay_entry(cfg_fires, doc: dict, url: str, size: int) -> dict:
    """The site.json overlay of the detections (contract/manifest.schema.json, #/$defs/overlay)."""
    first, last = doc["asked"]
    dups = sum(s["duplicates"] for s in doc["sources"].values())
    outside = doc["outside_box"]
    method = (f"VIIRS 375 m active fire detections from NASA FIRMS (area API; sources "
              f"{', '.join(doc['settings']['sources'])}) with UTC dates from {first} to {last}, inside the site box. "
              f"A detection found in two sources (same satellite, UTC date and time, latitude and longitude) is "
              f"kept once, from the source listed first ({dups} dropped).")
    if outside:
        method += f" Left out: {outside} detection{'s' if outside != 1 else ''} whose centre lies outside the box."
    method += " Coordinates rounded to 5 decimals. Details: docs/METHODS.md, section 6."
    return {
        "id": OVERLAY_ID,
        "title": cfg_fires.title or "Fire detections (VIIRS, NASA FIRMS)",
        "kind": "points",
        "url": url,
        "description": cfg_fires.description or DESCRIPTION,
        "method": method,
        "credit": CREDIT,
        "date_property": "date",
        "date_range": [first, last],
        "fields": [dict(f) for f in FIELDS],
        "count": doc["count"],
        "color": OVERLAY_COLOUR,
        "bytes": size,
    }


# Step 5: attribute ------------------------------------------------------------------------------------------

def _overlaps(u0: float, u1: float, start: float, step: float, n: int) -> tuple[int, np.ndarray]:
    """Index of the first cell and the length of [u0, u1] on each cell of a row of n cells of size step that
    starts at `start`."""
    c0 = max(0, math.floor((u0 - start) / step))
    c1 = min(n, math.ceil((u1 - start) / step))
    if c1 <= c0:
        return 0, np.zeros(0)
    lo = start + step * np.arange(c0, c1)
    return c0, np.minimum(u1, lo + step) - np.maximum(u0, lo)


def require_north_up(transform: Affine) -> None:
    if transform.b != 0 or transform.d != 0 or transform.a <= 0 or transform.e >= 0:
        raise ValueError("the class grid must be north-up")


def square_cells(x: float, y: float, transform: Affine, shape: tuple[int, int],
                 side_m: float = PIXEL_M) -> tuple[int, int, np.ndarray]:
    """Where one detection's square lies on a north-up grid of `shape` cells: the square of side_m, centred on
    (x, y) in the grid's projection and aligned with the grid. Returns (first row, first column, weights), where
    weights[i, j] is the share of the square's area on cell (first row + i, first column + j). The block is empty
    when the square misses the grid, and its sum is below 1 when part of the square lies off the grid. The fire
    bars (attribute) and the marker test (pipeline/marker.py) share this arithmetic."""
    left, top, px, py = transform.c, transform.f, transform.a, -transform.e
    half = side_m / 2
    c0, fx = _overlaps(x - half, x + half, left, px, shape[1])
    r0, fy = _overlaps(top - (y + half), top - (y - half), 0.0, py, shape[0])
    return r0, c0, np.outer(fy, fx) / (side_m * side_m)


def attribute(xs, ys, classes: np.ndarray, transform: Affine, values: list[int], side_m: float = PIXEL_M,
              region: np.ndarray | None = None) -> dict:
    """Share each detection (at x, y in the grid's projection) among the classes of a north-up class grid.

    A detection stands for a square of side_m centred on it and aligned with the grid; each cell takes the share
    of the square's area that lies on it (square_cells). The share on cells of a listed class goes to that class;
    on cells with value 0 (no data) to "no_data"; off the grid, or on cells outside `region` (a boolean grid, when
    given), to "outside". So every detection adds exactly 1 in total."""
    require_north_up(transform)
    if region is not None:
        if region.shape != classes.shape:
            raise ValueError(f"region {region.shape} and class grid {classes.shape} differ in shape")
        classes = np.where(region, classes.astype(np.int16), np.int16(OUTSIDE_CODE))
    known = set(values)
    found = set(np.unique(classes).tolist()) - known - {0, OUTSIDE_CODE}
    if found:
        raise ValueError(f"the class grid holds values {sorted(found)} that are not listed classes")
    mass = dict.fromkeys(values, 0.0)
    no_data = outside = 0.0
    for x, y in zip(xs, ys, strict=True):
        r0, c0, weights = square_cells(x, y, transform, classes.shape, side_m)
        outside += 1.0 - float(weights.sum())
        if weights.size == 0:
            continue
        block = classes[r0:r0 + weights.shape[0], c0:c0 + weights.shape[1]]
        no_data += float(weights[block == 0].sum())
        outside += float(weights[block == OUTSIDE_CODE].sum())
        for v in np.unique(block[(block != 0) & (block != OUTSIDE_CODE)]).tolist():
            mass[v] += float(weights[block == v].sum())
    return {"by_class": mass, "no_data": no_data, "outside": outside, "detections": len(xs)}


def project(detections: list[dict], crs: str) -> tuple[np.ndarray, np.ndarray]:
    """x, y of the detections in a projected CRS (the product grid's)."""
    if not detections:
        return np.zeros(0), np.zeros(0)
    t = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    xs, ys = t.transform([d["lon"] for d in detections], [d["lat"] for d in detections])
    return np.asarray(xs, dtype=np.float64), np.asarray(ys, dtype=np.float64)


# Step 6: density --------------------------------------------------------------------------------------------

def poisson_interval(n: float, level: float = INTERVAL_LEVEL) -> tuple[float, float]:
    """Garwood's interval of a Poisson mean from an observed count n, through chi-square quantiles:
    low = chi2(alpha/2; 2n)/2 (0 when n is 0), high = chi2(1-alpha/2; 2n+2)/2. It is exact for a whole count.
    scipy's chi2 takes non-whole degrees of freedom, so a shared (non-whole) count gives a smooth interpolation
    between the intervals of the whole counts around it: not an exact interval of any count distribution."""
    if n < 0:
        raise ValueError(f"a count cannot be negative, got {n}")
    alpha = 1.0 - level
    low = 0.0 if n == 0 else float(chi2.ppf(alpha / 2, 2 * n)) / 2
    high = float(chi2.ppf(1 - alpha / 2, 2 * n + 2)) / 2
    return low, high


def density(n: float, area_km2: float) -> dict:
    """Detections per km2 and its interval; value None when the area is zero (nothing to divide by)."""
    if area_km2 <= 0:
        return {"value": None, "low": None, "high": None}
    low, high = poisson_interval(n)
    return {"value": n / area_km2, "low": low / area_km2, "high": high / area_km2}


def period_text(first: str, last: str) -> str:
    """'5 to 14 November 2026', '29 October to 4 November 2026', or both dates in full across a year."""
    a, b = dt.date.fromisoformat(first), dt.date.fromisoformat(last)
    if a == b:
        return date_text(first)
    if a.year != b.year:
        return f"{date_text(first)} to {date_text(last)}"
    if a.month != b.month:
        return f"{a.day} {MONTHS[a.month - 1]} to {date_text(last)}"
    return f"{a.day} to {date_text(last)}"


def _pct(share: float) -> str:
    return f"{100 * share:.1f} %"


def period_bar(period: tuple[str, str], fetched_last: str, detections: list[dict], ctx: dict, sources: list[str],
               layer_id: str) -> dict:
    """One stats.json bar: VIIRS detections per km2 on each class of the harvest-wave layer in one period.

    ctx holds the marker's class grid on the product grid: codes, transform, crs, classes (the layer's
    class list), cell_area_km2, marker, cell_m, and bbox (the site box). Only cells whose centres lie inside the
    box count, for the areas and for the attribution: detections are fetched for the box alone, and the
    product grid around it is a slightly larger rectangle."""
    first, last = period
    covered = min(last, fetched_last)
    chosen = [d for d in detections if first <= d["date"] <= covered] if covered >= first else []
    xs, ys = project(chosen, ctx["crs"])
    values = [c["value"] for c in ctx["classes"]]
    region, _ = cells_in_boxes([ctx["bbox"]], ctx["crs"], ctx["transform"], ctx["codes"].shape)
    att = attribute(xs, ys, ctx["codes"], ctx["transform"], values, region=region)
    areas = {v: int(((ctx["codes"] == v) & region).sum()) * ctx["cell_area_km2"] for v in values}
    n_total = len(chosen)
    categories = []
    for c in ctx["classes"]:
        v = c["value"]
        mass, area = att["by_class"][v], areas[v]
        entry = {"label": c["label"], "value": None, "n": int(round(mass)), "class": v}
        if covered >= first:
            d = density(mass, area)
            entry["value"] = d["value"]
            if d["value"] is not None:
                entry["low"], entry["high"] = d["low"], d["high"]
                entry["note"] = f"{mass:.2f} detections attributed, class area {area:.2f} km2"
            else:
                entry["note"] = "no cell of this class, so no density"
        else:
            entry["note"] = "no day of this period had been fetched"
        categories.append(entry)
    shown = period_text(first, covered) if covered >= first else period_text(first, last)
    region = (f"The classes of the {layer_id} map ({ctx['marker']}, {ctx['cell_m']:g} m cells on the product's own "
              f"grid, {ctx['crs']}, those whose centres lie inside the site box) under the VIIRS detections inside "
              f"the site box with UTC dates from {first} to {covered if covered >= first else last}: {n_total} "
              f"detection{'s' if n_total != 1 else ''}.")
    if n_total:
        region += (f" Of their area, {_pct(att['no_data'] / n_total)} fell on cells without a class and "
                   f"{_pct(att['outside'] / n_total)} outside the site box or the analysis grid; that part is not "
                   "counted.")
    if covered < last:
        region += (f" The period asked runs to {last}, but detections were fetched only to {fetched_last}"
                   + (", so no value is given." if covered < first else "."))
    method = (
        f"Detections from the FIRMS sources {', '.join(sources)}. Each detection stands for a {PIXEL_M:g} m square "
        "(the nominal VIIRS I-band pixel) centred on it and aligned with the product grid, and is shared among "
        "the classes by the area of that square on each class's cells; the parts on cells without a class, outside "
        "the site box or outside the grid are not counted. Density = detections attributed to a class / the "
        "class's area in km2 inside the site box, on the product grid. low and high: Garwood's chi-square formula "
        "for a 95 % Poisson interval (exact for whole counts), applied to the attributed count n, chi2(0.025; "
        "2n)/2 to chi2(0.975; 2n+2)/2 from scipy's chi-square quantiles, divided by the area. The attributed "
        "count is a sum of shares and rarely a whole number; for such a count the formula interpolates between "
        "whole counts and is not exact. Neighbouring detections are not independent (one fire can fill several "
        "pixels and be seen by several satellites), so this interval is a lower bound on the real uncertainty. "
        "n is the attributed count rounded to a whole number, for display only. Details: docs/METHODS.md, "
        "section 6. Credit: " + CREDIT)
    return {
        "id": f"fires-{first}-{last}",
        "title": f"VIIRS fire detections (NASA FIRMS) per km2 in each harvest-map class, {shown} (UTC dates)",
        "unit": "detections per km2",
        "layer": layer_id,
        "region": region,
        "method": method,
        "categories": categories,
    }


def bar_report(bar: dict) -> str:
    """One console line per bar, for the person running export."""
    parts = []
    for c in bar["categories"]:
        if c["value"] is None:
            parts.append(f"{c['label']}: n/a")
        else:
            parts.append(f"{c['label']}: {c['value']:.3f} [{c['low']:.3f}, {c['high']:.3f}] (n {c['n']})")
    return f"export  {bar['id']}: per km2: " + "; ".join(parts)
