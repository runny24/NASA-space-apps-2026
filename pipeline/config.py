"""Site configuration: read pipeline/sites/<id>.yaml and the granule list next to it.

A site is one place on one stack. Everything the pipeline needs to know about it lives in its YAML
file (copy pipeline/sites/_template.yaml to start one). Validation is strict and names the file and
the field, because a typo in a config should stop the run at once, not produce a wrong map an hour later.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from pipeline.hints import command
from pipeline.paths import default_layout

SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
STACK = re.compile(r"^[0-9]{3}_[AD]_[0-9]{3}$")
RELEASES = ("validated", "provisional", "beta", "sample")
POLARIZATIONS = ("HH", "HV", "VH", "VV")
PRODUCTS = ("GCOV",)  # TODO(builder): add GUNW etc. here once a reader for them exists
# Colour ramps the web app knows. Keep this list in step with RAMPS in web/src/map/ramps.ts: the app draws
# an unknown name in grey without saying so, so a typo here must stop the run instead.
RAMPS = ("grey", "viridis", "blue-orange", "blue-red", "BrewerGreys9", "BrewerPuOr11", "BrewerRdBu11",
         "BrewerBrBG11")
# How far a stable target's mean may move from the median of all dates before the date is flagged, in dB.
# docs/TASKS.md, T4: "confirm its mean stays within about 1 dB across dates".
STABLE_TOLERANCE_DB = 1.0
DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
# The harvest analysis (pipeline/harvest.py) compares these two polarizations; either one may define the map.
HARVEST_MARKERS = ("HH", "HV")
# The VIIRS 375 m sources of NASA FIRMS's area API, as its page lists them (read on 14 November 2026,
# https://firms.modaps.eosdis.nasa.gov/api/area/). NRT: near real time, recent weeks; SP: standard processing,
# months later. MODIS and Landsat sources are left out on purpose: the fire statistic (pipeline/fires.py)
# treats every detection as a 375 m pixel.
FIRMS_SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_SNPP_SP", "VIIRS_NOAA20_NRT", "VIIRS_NOAA20_SP", "VIIRS_NOAA21_NRT",
                 "VIIRS_NOAA21_SP")
STORY_FIELDS = ("id", "title", "text", "layer", "date", "reference", "secondary", "overlays", "view")


class ConfigError(ValueError):
    """A site file is missing, malformed, or has an invalid field."""


@dataclass(frozen=True)
class Encoding:
    lo: float
    hi: float


@dataclass(frozen=True)
class Display:
    min: float
    max: float
    ramp: str


@dataclass(frozen=True)
class LayerStyle:
    """Fixed encoding and display range of one kind of layer, the same for every date (science rule 6)."""

    encoding: Encoding
    display: Display
    description: str | None = None  # the site's own text for the app; None: the pipeline's default text
    # Display hints that replace `display` for one polarization's layer (HV is several dB darker than HH).
    # Only a drawing hint in the manifest: no raster depends on it.
    display_by_polarization: dict[str, Display] = field(default_factory=dict)

    def display_for(self, pol: str) -> Display:
        return self.display_by_polarization.get(pol, self.display)


@dataclass(frozen=True)
class StableTarget:
    """Ground that should not change between dates, for the qa stage's stable-target check (pipeline/qa.py).
    Which ground is set in the site file; the pipeline only measures it."""

    name: str  # free text: what the target is
    bbox: tuple[float, float, float, float]  # west, south, east, north in degrees, inside the site bbox
    tolerance_db: float = STABLE_TOLERANCE_DB


@dataclass(frozen=True)
class Harvest:
    """Settings of the harvest analysis (pipeline/harvest.py, the `analyse` stage, docs/METHODS.md). Which dates
    are the flood, the canopy and the harvest passes is the team's choice; the pipeline only computes."""

    cell_m: float  # cell size in metres, a whole multiple of the working resolution
    marker: str  # HH or HV: the polarization whose harvest pairs define the map (both are computed)
    flood_dates: tuple[str, ...]  # passes of the transplanting flood (rice is darkest on one of them)
    peak_dates: tuple[str, ...]  # passes at full canopy
    passes: tuple[str, ...]  # ascending; the first pair must come before the harvest starts
    false_alarm: float  # the quantile of the change on reference cells that sets the threshold
    rice_rise_db: float | None  # None: Otsu's threshold on the rise of all valid cells
    stable_boxes: tuple[tuple[float, float, float, float], ...]  # lon/lat boxes of ground that should not change
    stable_boxes_from: str  # "stable_boxes" (the harvest block) or "stable_target" (the default)
    title: str | None = None  # the layer's title in the app; None: the pipeline's
    description: str | None = None  # the team's words for the layer; None: the pipeline's default text

    @property
    def pairs(self) -> list[tuple[str, str]]:
        return list(zip(self.passes[:-1], self.passes[1:], strict=True))


@dataclass(frozen=True)
class Fires:
    """Settings of the fire detections (pipeline/fires.py, the `fires` stage, docs/METHODS.md section 6): which
    days and FIRMS sources to fetch, and the periods for which export compares fire density across the classes
    of the harvest-wave layer. Which periods to compare is the team's choice."""

    start: str  # first UTC date to fetch, YYYY-MM-DD
    end: str  # last UTC date to fetch (days that have not ended yet are fetched on a later run)
    sources: tuple[str, ...]  # FIRMS source names (FIRMS_SOURCES), in order of preference for duplicates
    periods: tuple[tuple[str, str], ...]  # [first day, last day] pairs inside start..end; needs a harvest block
    title: str | None = None  # the overlay's title in the app; None: the pipeline's
    description: str | None = None  # the team's words for the overlay; None: the pipeline's default text


@dataclass(frozen=True)
class SiteConfig:
    id: str
    title: str
    summary: str
    is_sample: bool
    notice: str | None
    citation: str
    bbox: tuple[float, float, float, float]  # west, south, east, north in degrees
    product: str
    frequency: str  # "A" or "B"
    stack: str | None  # track_direction_frame, e.g. "030_A_019"; None until discover has chosen one
    releases: list[str]  # which copy wins when one pass exists in two releases; every listed release is used
    polarizations: list[str]
    access: str  # "public" or "earthdata"
    working_resolution_m: float
    power_floor: float
    min_valid_fraction: float
    display_zoom: int | None  # None means pick automatically from the working resolution
    stack_zoom_offset: int
    change_boxcar_px: int
    series_min_coverage: float  # a date with fewer valid pixels than this fraction of the best date: null
    backscatter: LayerStyle
    change: LayerStyle | None  # None: no pair (change) layer for this site
    stable_target: StableTarget | None  # None: the stable-target check is skipped
    path: Path  # the file this came from, for error messages
    harvest: Harvest | None = None  # None: no harvest analysis and no harvest layer
    fires: Fires | None = None  # None: no fire detections, no fires overlay and no fire bars
    story: tuple[dict, ...] = ()  # steps of a guided tour, copied to site.json as written (dates as text)

    @property
    def center_lat(self) -> float:
        return (self.bbox[1] + self.bbox[3]) / 2


def sites_dir() -> Path:
    return default_layout().sites_dir


def site_path(site_id: str, sites_root: Path | None = None) -> Path:
    return (sites_root or sites_dir()) / f"{site_id}.yaml"


def granules_path(site_id: str, sites_root: Path | None = None) -> Path:
    return (sites_root or sites_dir()) / f"{site_id}.granules.json"


class _Fields:
    """Pulls typed fields out of a parsed YAML mapping, with errors that name file and field."""

    def __init__(self, data: dict, path: Path, prefix: str = ""):
        self.data, self.path, self.prefix = data, path, prefix
        self.used: set[str] = set()

    def fail(self, name: str, message: str) -> ConfigError:
        return ConfigError(f"{self.path}: field '{self.prefix}{name}': {message}")

    def get(self, name: str, kind: type | tuple, default: Any = ..., *, allow_none: bool = False):
        self.used.add(name)
        if name not in self.data:
            if default is ...:
                raise self.fail(name, "is required")
            return default
        value = self.data[name]
        if value is None and allow_none:
            return None
        # YAML reads 40 as int; accept ints where floats are expected, but never bools as numbers.
        if kind is float and isinstance(value, int) and not isinstance(value, bool):
            value = float(value)
        if isinstance(value, bool) and kind is not bool:
            raise self.fail(name, f"expected {getattr(kind, '__name__', kind)}, got a true/false value")
        if not isinstance(value, kind):
            raise self.fail(name, f"expected {getattr(kind, '__name__', kind)}, got {value!r}")
        return value

    def check_unknown(self) -> None:
        unknown = sorted(set(self.data) - self.used)
        if unknown:
            raise ConfigError(f"{self.path}: unknown field(s) {', '.join(self.prefix + u for u in unknown)} "
                              "(check the spelling against pipeline/sites/_template.yaml)")


def _display(disp: _Fields) -> Display:
    display = Display(min=disp.get("min", float), max=disp.get("max", float), ramp=disp.get("ramp", str))
    disp.check_unknown()
    if display.min >= display.max:
        raise disp.fail("max", "must be greater than min")
    if display.ramp not in RAMPS:
        raise disp.fail("ramp", f"unknown colour ramp {display.ramp!r}; the app knows {', '.join(RAMPS)}")
    return display


def _style(fields: _Fields, name: str, required: bool, polarizations: list[str] | None = None) -> LayerStyle | None:
    """A layer style block. With `polarizations` (the backscatter block) it may also hold display_by_polarization:
    a display per polarization that replaces `display` for that polarization's layer."""
    raw = fields.get(name, dict, None if not required else ..., allow_none=not required)
    if raw is None:
        return None
    outer = _Fields(raw, fields.path, f"{name}.")
    enc = _Fields(outer.get("encoding", dict), fields.path, f"{name}.encoding.")
    encoding = Encoding(lo=enc.get("lo", float), hi=enc.get("hi", float))
    display = _display(_Fields(outer.get("display", dict), fields.path, f"{name}.display."))
    description = outer.get("description", str, None, allow_none=True)
    by_pol: dict[str, Display] = {}
    if polarizations is not None:
        raw_by_pol = outer.get("display_by_polarization", dict, None, allow_none=True) or {}
        for pol, value in raw_by_pol.items():
            if pol not in polarizations:
                raise outer.fail("display_by_polarization", f"{pol!r} is not one of the site's polarizations "
                                                            f"{polarizations}")
            if not isinstance(value, dict):
                raise outer.fail(f"display_by_polarization.{pol}", "expected {min: ..., max: ..., ramp: ...}")
            by_pol[pol] = _display(_Fields(value, fields.path, f"{name}.display_by_polarization.{pol}."))
    for f in (outer, enc):
        f.check_unknown()
    if encoding.lo >= encoding.hi:
        raise enc.fail("hi", "must be greater than lo")
    if description is not None and not description.strip():
        raise outer.fail("description", "is empty; write the text or delete the field")
    return LayerStyle(encoding, display, description.strip() if description else None, by_pol)


def _bbox(fields: _Fields, name: str) -> tuple[float, float, float, float]:
    raw = fields.get(name, list)
    if len(raw) != 4 or not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in raw):
        raise fields.fail(name, "expected [west, south, east, north] in degrees")
    w, s, e, n = (float(v) for v in raw)
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise fields.fail(name, "expected west < east within -180..180 and south < north within -90..90")
    return w, s, e, n


def _stable_target(fields: _Fields, site_bbox: tuple[float, float, float, float]) -> StableTarget | None:
    raw = fields.get("stable_target", dict, None, allow_none=True)
    if raw is None:
        return None
    f = _Fields(raw, fields.path, "stable_target.")
    name = f.get("name", str).strip()
    bbox = _bbox(f, "bbox")
    tolerance = f.get("tolerance_db", float, STABLE_TOLERANCE_DB)
    f.check_unknown()
    if not name:
        raise f.fail("name", "is empty; say in a few words what the target is")
    if not tolerance > 0:
        raise f.fail("tolerance_db", "must be a positive number of dB")
    w, s, e, n = bbox
    sw, ss, se, sn = site_bbox
    if not (sw <= w and e <= se and ss <= s and n <= sn):
        raise f.fail("bbox", f"must lie inside the site's bbox {list(site_bbox)}: the check reads only the "
                             "site's window")
    return StableTarget(name=name, bbox=bbox, tolerance_db=tolerance)


def _date_text(f: _Fields, name: str, value: Any) -> str:
    """One YYYY-MM-DD date as text. YAML reads an unquoted 2026-06-13 as a date object; both forms are accepted."""
    if isinstance(value, dt.date) and not isinstance(value, dt.datetime):
        value = value.isoformat()
    if not isinstance(value, str) or not DATE.match(value):
        raise f.fail(name, f"expected dates written YYYY-MM-DD, got {value!r}")
    try:
        dt.date.fromisoformat(value)
    except ValueError as exc:
        raise f.fail(name, f"{value!r} is not a calendar date") from exc
    return value


def _date_list(f: _Fields, name: str, minimum: int) -> tuple[str, ...]:
    """A list of distinct YYYY-MM-DD dates. YAML reads an unquoted 2026-06-13 as a date object; both forms are
    accepted and kept as text."""
    raw = f.get(name, list)
    dates = [_date_text(f, name, value) for value in raw]
    if len(dates) < minimum:
        raise f.fail(name, f"needs at least {minimum} date{'s' if minimum > 1 else ''}, got {len(dates)}")
    if len(set(dates)) != len(dates):
        raise f.fail(name, f"names a date more than once: {dates}")
    return tuple(dates)


def _harvest(fields: _Fields, site_bbox: tuple[float, float, float, float], polarizations: list[str],
             working_resolution_m: float, stable_target: StableTarget | None) -> Harvest | None:
    raw = fields.get("harvest", dict, None, allow_none=True)
    if raw is None:
        return None
    f = _Fields(raw, fields.path, "harvest.")
    cell_m = f.get("cell_m", float, 100.0)
    marker = f.get("marker", str, "HH")
    flood = _date_list(f, "flood_dates", 1)
    peak = _date_list(f, "peak_dates", 1)
    passes = _date_list(f, "passes", 3)
    false_alarm = f.get("false_alarm", float, 0.02)
    rise = f.get("rice_rise_db", (str, float, int), "auto")
    boxes_raw = f.get("stable_boxes", list, None, allow_none=True)
    title = f.get("title", str, None, allow_none=True)
    description = f.get("description", str, None, allow_none=True)
    f.check_unknown()

    if marker not in HARVEST_MARKERS:
        raise f.fail("marker", f"must be one of {', '.join(HARVEST_MARKERS)}, got {marker!r}")
    missing = [p for p in HARVEST_MARKERS if p not in polarizations]
    if missing:
        raise f.fail("marker", f"the harvest analysis computes both HH and HV, but the site's polarizations "
                               f"{polarizations} lack {', '.join(missing)}")
    factor = cell_m / working_resolution_m
    if not cell_m > 0 or factor < 1 - 1e-6 or abs(factor - round(factor)) > 1e-6:
        raise f.fail("cell_m", f"must be a whole multiple of working_resolution_m ({working_resolution_m:g} m), "
                               f"got {cell_m:g}")
    if list(passes) != sorted(passes):
        raise f.fail("passes", f"must be in ascending order, got {list(passes)}")
    both = sorted(set(flood) & set(peak))
    if both:
        raise f.fail("peak_dates", f"{', '.join(both)} is also a flood date; a pass is either one or the other")
    if not 0 < false_alarm < 0.5:
        raise f.fail("false_alarm", f"must be a fraction between 0 and 0.5 (0.02 is 2 %), got {false_alarm:g}")
    if isinstance(rise, str):
        if rise != "auto":
            raise f.fail("rice_rise_db", f"expected 'auto' or a number of dB, got {rise!r}")
        rise_db = None
    else:
        rise_db = float(rise)
        if not (math.isfinite(rise_db) and rise_db > 0):
            raise f.fail("rice_rise_db", f"must be a positive number of dB, got {rise!r}")

    if boxes_raw is None:
        if stable_target is None:
            raise f.fail("stable_boxes", "is required when the site has no stable_target (the default is the "
                                         "stable target's box): the threshold needs ground that should not change")
        boxes, source = (stable_target.bbox,), "stable_target"
    else:
        if not boxes_raw:
            raise f.fail("stable_boxes", "is empty; list at least one [west, south, east, north] box, or delete the "
                                         "field to use the stable target's box")
        boxes = []
        for i, box in enumerate(boxes_raw):
            w, s, e, n = _bbox(_Fields({f"stable_boxes[{i}]": box}, fields.path, "harvest."), f"stable_boxes[{i}]")
            sw, ss, se, sn = site_bbox
            if not (sw <= w and e <= se and ss <= s and n <= sn):
                raise f.fail("stable_boxes", f"box {i} {[w, s, e, n]} must lie inside the site's bbox "
                                             f"{list(site_bbox)}")
            boxes.append((w, s, e, n))
        boxes, source = tuple(boxes), "stable_boxes"
    for name, text in (("title", title), ("description", description)):
        if text is not None and not text.strip():
            raise f.fail(name, "is empty; write the text or delete the field")
    return Harvest(cell_m=cell_m, marker=marker, flood_dates=flood, peak_dates=peak, passes=passes,
                   false_alarm=false_alarm, rice_rise_db=rise_db, stable_boxes=boxes, stable_boxes_from=source,
                   title=title.strip() if title else None, description=description.strip() if description else None)


def check_harvest_dates(cfg: SiteConfig, dates: list[str], what: str = "the site's dates") -> None:
    """Every date the harvest block names must be one of the site's dates (`dates`: the granule list's, or the
    dates of the fetched files). The site file is read without the granule list, so this runs when the dates
    are known: at the start of `run` and in `analyse`."""
    if cfg.harvest is None:
        return
    known = set(dates)
    for name in ("flood_dates", "peak_dates", "passes"):
        unknown = [d for d in getattr(cfg.harvest, name) if d not in known]
        if unknown:
            raise ConfigError(f"{cfg.path}: field 'harvest.{name}': {', '.join(unknown)} "
                              f"{'is' if len(unknown) == 1 else 'are'} not among {what} "
                              f"({', '.join(sorted(known))})")


def _fires(fields: _Fields, harvest: Harvest | None) -> Fires | None:
    raw = fields.get("fires", dict, None, allow_none=True)
    if raw is None:
        return None
    f = _Fields(raw, fields.path, "fires.")
    start = _date_text(f, "start", f.get("start", (str, dt.date)))
    end = _date_text(f, "end", f.get("end", (str, dt.date)))
    sources = f.get("sources", list)
    periods_raw = f.get("periods", list, None, allow_none=True) or []
    title = f.get("title", str, None, allow_none=True)
    description = f.get("description", str, None, allow_none=True)
    f.check_unknown()
    if end < start:
        raise f.fail("end", f"{end} is before start {start}")
    if not sources or len(set(sources)) != len(sources) or any(s not in FIRMS_SOURCES for s in sources):
        raise f.fail("sources", f"expected a non-empty list of distinct FIRMS source names from "
                                f"{', '.join(FIRMS_SOURCES)}, got {sources!r}")
    periods = []
    for i, period in enumerate(periods_raw):
        name = f"periods[{i}]"
        if not isinstance(period, list) or len(period) != 2:
            raise f.fail(name, f"expected [first day, last day], got {period!r}")
        first, last = (_date_text(f, name, v) for v in period)
        if last < first:
            raise f.fail(name, f"the last day {last} is before the first day {first}")
        if first < start or last > end:
            raise f.fail(name, f"[{first}, {last}] must lie inside start..end ({start} to {end}): only those days "
                               "are fetched")
        periods.append((first, last))
    if len(set(periods)) != len(periods):
        raise f.fail("periods", "names the same period more than once")
    if periods and harvest is None:
        raise f.fail("periods", "compare fire density across the classes of the harvest-wave layer, so the site "
                                "needs a harvest block; delete periods to publish the overlay alone")
    for name, text in (("title", title), ("description", description)):
        if text is not None and not text.strip():
            raise f.fail(name, "is empty; write the text or delete the field")
    return Fires(start=start, end=end, sources=tuple(sources), periods=tuple(periods),
                 title=title.strip() if title else None, description=description.strip() if description else None)


def _story(fields: _Fields) -> tuple[dict, ...]:
    """The optional guided tour. Its shape is checked here; whether the layers, dates and overlays a step names
    exist is checked by `validate` (rule 12 of docs/DATA_CONTRACT.md), once export has written them. Steps are
    copied to site.json as written, with dates as text."""
    raw = fields.get("story", list, None, allow_none=True)
    if raw is None:
        return ()
    steps, ids = [], []
    for i, step in enumerate(raw):
        prefix = f"story[{i}]."
        if not isinstance(step, dict):
            raise fields.fail(f"story[{i}]", "expected a mapping with id, title and text")
        f = _Fields(step, fields.path, prefix)
        out: dict[str, Any] = {}
        out["id"] = f.get("id", str)
        if not SLUG.match(out["id"]):
            raise f.fail("id", "use lower-case letters, digits and hyphens only")
        for name in ("title", "text"):
            value = f.get(name, str)
            if not value.strip():
                raise f.fail(name, "is empty")
            out[name] = value
        if "layer" in step:
            out["layer"] = f.get("layer", str)
            if not SLUG.match(out["layer"]):
                raise f.fail("layer", "expected a layer id (lower-case letters, digits and hyphens)")
        for name in ("date", "reference", "secondary"):
            if name in step:
                out[name] = _date_text(f, name, f.get(name, (str, dt.date)))
        if ("reference" in out) != ("secondary" in out):
            raise f.fail("reference", "reference and secondary come together (a pair layer's two dates)")
        if "date" in out and "reference" in out:
            raise f.fail("date", "a step shows either one date (per-date layer) or a pair (pair layer), not both")
        if any(k in out for k in ("date", "reference")) and "layer" not in out:
            raise f.fail("layer", "is required when the step names a date or a pair")
        if "overlays" in step:
            overlays = f.get("overlays", list)
            bad = any(not isinstance(o, str) or not SLUG.match(o) for o in overlays)
            if bad or len(set(overlays)) != len(overlays):
                raise f.fail("overlays", f"expected distinct overlay ids, got {overlays!r}")
            out["overlays"] = list(overlays)
        if "view" in step:
            view = f.get("view", dict)
            v = _Fields(view, fields.path, f"{prefix}view.")
            center = v.get("center", list)
            zoom = v.get("zoom", (int, float))
            v.check_unknown()
            if (len(center) != 2 or not all(isinstance(c, (int, float)) and not isinstance(c, bool) for c in center)
                    or not (-180 <= center[0] <= 180 and -85 <= center[1] <= 85)):
                raise v.fail("center", "expected [longitude, latitude] with latitude within -85..85")
            if not 0 <= zoom <= 22:
                raise v.fail("zoom", "expected a web-map zoom 0..22")
            out["view"] = {"center": list(center), "zoom": zoom}
        f.check_unknown()
        ids.append(out["id"])
        steps.append({k: out[k] for k in STORY_FIELDS if k in out})
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        raise fields.fail("story", f"step id {', '.join(dup)} appears more than once")
    return tuple(steps)


def parse_site(data: Any, path: Path, expected_id: str | None = None) -> SiteConfig:
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: expected a mapping of field: value at the top level")
    f = _Fields(data, path)

    site_id = f.get("id", str)
    if not SLUG.match(site_id):
        raise f.fail("id", "use lower-case letters, digits and hyphens only")
    if expected_id is not None and site_id != expected_id:
        raise f.fail("id", f"is {site_id!r} but the file name says {expected_id!r}")

    w, s, e, n = _bbox(f, "bbox")

    product = f.get("product", str, "GCOV")
    if product not in PRODUCTS:
        raise f.fail("product", f"must be one of {', '.join(PRODUCTS)}")
    frequency = f.get("frequency", str, "A")
    if frequency not in ("A", "B"):
        raise f.fail("frequency", "must be A or B")
    stack = f.get("stack", str, None, allow_none=True)
    if stack is not None and not STACK.match(stack):
        raise f.fail("stack", "expected track_direction_frame such as 030_A_019")

    is_sample = f.get("is_sample", bool, False)
    releases = f.get("releases", list, ["provisional"])  # one release: a series must not mix them
    if not releases or any(r not in RELEASES for r in releases) or len(set(releases)) != len(releases):
        raise f.fail("releases", f"expected a non-empty list of distinct values from {', '.join(RELEASES)}")
    if ("sample" in releases) != is_sample:
        raise f.fail("releases", "'sample' belongs in releases exactly when is_sample is true")

    pols = f.get("polarizations", list)
    if not pols or any(p not in POLARIZATIONS for p in pols) or len(set(pols)) != len(pols):
        raise f.fail("polarizations", f"expected a non-empty list of distinct values from {', '.join(POLARIZATIONS)}")

    access = f.get("access", str, "earthdata")
    if access not in ("public", "earthdata"):
        raise f.fail("access", "must be public or earthdata")

    notice = f.get("notice", str, None, allow_none=True)
    if is_sample and not notice:
        raise f.fail("notice", "is required when is_sample is true; the app shows it with the site")

    res = f.get("working_resolution_m", float)
    floor = f.get("power_floor", float, 1e-5)
    min_valid = f.get("min_valid_fraction", float, 0.5)
    zoom = f.get("display_zoom", (str, int), "auto")
    if zoom == "auto":
        zoom = None
    elif not isinstance(zoom, int) or not 0 <= zoom <= 22:
        raise f.fail("display_zoom", "expected 'auto' or a web-map zoom level 0..22")
    offset = f.get("stack_zoom_offset", int, 2)
    boxcar = f.get("change_boxcar_px", int, 3)
    coverage = f.get("series_min_coverage", float, 0.8)
    if res <= 0:
        raise f.fail("working_resolution_m", "must be positive")
    if floor < 0:
        raise f.fail("power_floor", "must not be negative")
    if not 0 < min_valid <= 1:
        raise f.fail("min_valid_fraction", "must be in (0, 1]")
    if offset < 0:
        raise f.fail("stack_zoom_offset", "must be 0 or more")
    if boxcar < 1 or boxcar % 2 == 0:
        raise f.fail("change_boxcar_px", "must be an odd number of pixels, 1 or more")
    if not 0 < coverage <= 1:
        raise f.fail("series_min_coverage", "must be in (0, 1]")
    stable_target = _stable_target(f, (w, s, e, n))
    harvest = _harvest(f, (w, s, e, n), list(pols), res, stable_target)

    config = SiteConfig(
        id=site_id,
        title=f.get("title", str),
        summary=f.get("summary", str, ""),
        is_sample=is_sample,
        notice=notice,
        citation=f.get("citation", str),
        bbox=(w, s, e, n),
        product=product,
        frequency=frequency,
        stack=stack,
        releases=list(releases),
        polarizations=list(pols),
        access=access,
        working_resolution_m=res,
        power_floor=floor,
        min_valid_fraction=min_valid,
        display_zoom=zoom,
        stack_zoom_offset=offset,
        change_boxcar_px=boxcar,
        series_min_coverage=coverage,
        backscatter=_style(f, "backscatter", required=True, polarizations=list(pols)),
        change=_style(f, "change", required=False),
        stable_target=stable_target,
        path=path,
        harvest=harvest,
        fires=_fires(f, harvest),
        story=_story(f),
    )
    f.check_unknown()
    return config


def load_site(site_id: str, sites_root: Path | None = None) -> SiteConfig:
    """Read pipeline/sites/<site_id>.yaml and validate it."""
    path = site_path(site_id, sites_root)
    if not path.is_file():
        raise ConfigError(f"{path}: no such site file (copy pipeline/sites/_template.yaml to start one)")
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ConfigError(f"{path}: not valid YAML: {exc}") from exc
    return parse_site(data, path, expected_id=site_id)


GRANULE_FIELDS = ("name", "date", "start", "release", "url")


def load_granule_list(site_id: str, sites_root: Path | None = None) -> dict:
    """Read pipeline/sites/<site_id>.granules.json (written by `discover`, or by hand for the sample)."""
    path = granules_path(site_id, sites_root)
    if not path.is_file():
        raise ConfigError(f"{path}: no granule list yet; run `{command('discover', '--site', site_id)}`")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path}: not valid JSON: {exc}") from exc
    if data.get("site") != site_id:
        raise ConfigError(f"{path}: field 'site' is {data.get('site')!r}, expected {site_id!r}")
    granules = data.get("granules")
    if not isinstance(granules, list) or not granules:
        raise ConfigError(f"{path}: field 'granules' must be a non-empty list")
    for i, g in enumerate(granules):
        missing = [k for k in GRANULE_FIELDS if not g.get(k)]
        if missing:
            raise ConfigError(f"{path}: granules[{i}] is missing {', '.join(missing)}")
    dates = [g["date"] for g in granules]
    if dates != sorted(set(dates)):
        raise ConfigError(f"{path}: granules must be ascending by date with one entry per date")
    return data
