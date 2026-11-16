"""Read NISAR L2 GCOV products: what a file contains, and one lon/lat window of it.

Layout (verified on NASA's sample files, on ASF's saved outputs from real files, and on 14 November 2026
on real granules of specifications 1.5.0 and 1.6.0):
    /science/LSAR/identification/                 listOfFrequencies, productSpecificationVersion,
                                                  hasInputDataException (not in the 1.2.1 samples), ...
    /science/LSAR/GCOV/grids/frequencyA/          HHHH, HVHV, ... float32 linear gamma-naught, NaN fill
                                                  mask uint8, xCoordinates, yCoordinates (pixel centres,
                                                  y descending), xCoordinateSpacing, projection (EPSG),
                                                  inputDataExceptionMask (not in the samples; uint8 in
                                                  1.5.0, uint16 in 1.6.0, see its notes further down)
We read what the file says it contains instead of assuming frequency A or HH (science rule 8): some real
granules are frequency-B only, VV only. The same goes for the exception mask's layout, which changed
between specification versions: it is read from each file's own attributes, not from the version number.
"""

from __future__ import annotations

import math
import re
import sys
from dataclasses import asdict, dataclass, field

import h5py
import numpy as np
from affine import Affine
from pyproj import Transformer

IDENT = "/science/LSAR/identification"
GRIDS = "/science/LSAR/GCOV/grids"
EXCEPTION_FLAG = "hasInputDataException"  # in identification/
EXCEPTION_MASK = "inputDataExceptionMask"  # in grids/frequencyX/, on the same grid as the data


class WindowError(ValueError):
    """The requested window does not fall on the product's grid."""


def _text(value) -> str:
    """HDF5 strings come back as bytes, numpy bytes, or 1-element arrays of them."""
    if isinstance(value, np.ndarray):
        value = value.item() if value.shape == () else value.tolist()
    if isinstance(value, (bytes, np.bytes_)):
        return value.decode("utf-8", "replace").strip()
    return str(value).strip()


# The codes of hasInputDataException and of the anomaly bits of inputDataExceptionMask, as both datasets'
# description attributes list them in the real files of specifications 1.5.0 and 1.6.0 (14 November 2026).
EXCEPTION_CODES = {0: "no anomaly", 2: "NISAR LSAR qFSP-H1 sample slip"}


def _flag_value(value):
    """The single value stored in hasInputDataException as a Python scalar, or None when it holds several."""
    if isinstance(value, np.ndarray):
        if value.size != 1:
            return None
        value = value.reshape(()).item()
    if isinstance(value, np.generic):
        value = value.item()  # numpy scalars to Python bool, int, float or bytes
    if isinstance(value, (bytes, bytearray)):
        value = bytes(value).decode("utf-8", "replace")
    return value


def exception_code(value) -> int | None:
    """The number stored in identification/hasInputDataException, or None when it is not stored as a number
    (a boolean, other text, or something unreadable). It is a code, not only a flag: the real files of
    14 November 2026 held a uint8 0 (clean) or 2 (sample slip, see EXCEPTION_CODES)."""
    value = _flag_value(value)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, str) and re.fullmatch(r"[+-]?\d+", value.strip()):
        return int(value.strip())
    return None


def exception_flag(value) -> bool | None:
    """True or False from identification/hasInputDataException, or None when the value cannot be read.

    Its own description: "Indication of input data exceptions or anomalies present in this granule. Bitwise
    OR of instrument exception codes for all image pixels (0: no anomaly, 2: NISAR LSAR qFSP-H1 sample
    slip)". The real files seen held a uint8 0, or 2 on flagged files of specification 1.5.0, so any
    non-zero code means True (exception_code keeps the number itself). h5py can also hand back a boolean,
    bytes or text (another writer, or a 1-element array), so all of those are accepted.
    """
    value = _flag_value(value)
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, float):
        return None if math.isnan(value) else value != 0
    if isinstance(value, str):
        text = value.strip().lower()
        if text in ("true", "yes"):
            return True
        if text in ("false", "no"):
            return False
        if re.fullmatch(r"[+-]?\d+", text):
            return int(text) != 0
    return None


def _text_list(value) -> list[str]:
    arr = np.atleast_1d(value)
    return [_text(v) for v in arr.tolist()]


def _scalar(group: h5py.Group, name: str, default=None):
    return group[name][()] if name in group else default


@dataclass
class GridFacts:
    """One frequency's grid, as stored in the file."""

    frequency: str
    polarizations: list[str]
    covariance_terms: list[str]
    epsg: int
    x_spacing: float
    y_spacing: float  # negative: rows go north to south
    shape: tuple[int, int]  # rows, cols
    x_first: float  # centre of the first column
    y_first: float  # centre of the first row
    has_mask: bool
    has_exception_mask: bool = False  # inputDataExceptionMask exists for this frequency
    # Its layout, read from the dataset itself (None when there is no exception mask): the stored type,
    # whether it carries the "fully focused" bits (exception_focus_bits) and its own _FillValue attribute
    # (None when it has none: then no value is fill).
    exception_dtype: str | None = None
    exception_focus_bits: bool | None = None
    exception_fill: int | None = None


@dataclass
class GcovFacts:
    """What a GCOV file says about itself. Trust these over the granule name."""

    granule_id: str
    spec_version: str
    mission_id: str
    instrument: str
    start_time: str  # zeroDopplerStartTime, UTC, as written in the file
    end_time: str
    release_id: str  # compositeReleaseId
    orbit_direction: str
    look_direction: str
    track: int | None
    frame: int | None
    is_full_frame: bool | None
    frequencies: list[str]
    grids: dict[str, GridFacts] = field(default_factory=dict)
    page_size: int | None = None
    # identification/hasInputDataException: None when the file has no such field (NASA's 1.2.1 samples).
    has_input_data_exception: bool | None = None
    # The number it holds (2 on the flagged files of 14 November 2026) and what EXCEPTION_CODES says that
    # code means; None when it is not stored as a number or is not one of the documented codes.
    input_data_exception_code: int | None = None
    input_data_exception_meaning: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def page_size(h5: h5py.File) -> int | None:
    try:
        return int(h5.id.get_create_plist().get_file_space_page_size()) or None
    except Exception:  # older HDF5 builds lack the call; the value is informational only
        return None


def read_facts(h5: h5py.File) -> GcovFacts:
    ident = h5[IDENT]

    def text(name: str, default: str = "") -> str:
        return _text(ident[name][()]) if name in ident else default

    def number(name: str) -> int | None:
        return int(ident[name][()]) if name in ident else None

    full = text("isFullFrame")
    facts = GcovFacts(
        granule_id=text("granuleId"),
        spec_version=text("productSpecificationVersion"),
        mission_id=text("missionId"),
        instrument=text("instrumentName"),
        start_time=text("zeroDopplerStartTime"),
        end_time=text("zeroDopplerEndTime"),
        release_id=text("compositeReleaseId"),
        orbit_direction=text("orbitPassDirection"),
        look_direction=text("lookDirection"),
        track=number("trackNumber"),
        frame=number("frameNumber"),
        is_full_frame={"true": True, "false": False}.get(full.lower()),
        frequencies=_text_list(ident["listOfFrequencies"][()]) if "listOfFrequencies" in ident else [],
        page_size=page_size(h5),
    )
    if EXCEPTION_FLAG in ident:
        raw = ident[EXCEPTION_FLAG][()]
        facts.has_input_data_exception = exception_flag(raw)
        facts.input_data_exception_code = exception_code(raw)
        facts.input_data_exception_meaning = EXCEPTION_CODES.get(facts.input_data_exception_code)
        if facts.has_input_data_exception is None:
            print(f"warning: cannot read {EXCEPTION_FLAG} = {raw!r} in {facts.granule_id}; recorded as unknown "
                  "(null), so the exception mask is not summarised", file=sys.stderr)
    for freq in facts.frequencies:
        path = f"{GRIDS}/frequency{freq}"
        if path not in h5:
            continue
        g = h5[path]
        x, y = g["xCoordinates"], g["yCoordinates"]
        dx = float(_scalar(g, "xCoordinateSpacing", x[1] - x[0]))
        dy = float(_scalar(g, "yCoordinateSpacing", y[1] - y[0]))
        facts.grids[freq] = GridFacts(
            frequency=freq,
            polarizations=_text_list(g["listOfPolarizations"][()]) if "listOfPolarizations" in g else [],
            covariance_terms=_text_list(g["listOfCovarianceTerms"][()]) if "listOfCovarianceTerms" in g else [],
            epsg=int(g["projection"][()]),
            x_spacing=dx,
            y_spacing=dy,
            shape=(int(y.shape[0]), int(x.shape[0])),
            x_first=float(x[0]),
            y_first=float(y[0]),
            has_mask="mask" in g,
            has_exception_mask=EXCEPTION_MASK in g,
        )
        if EXCEPTION_MASK in g:
            layout = exception_layout(g[EXCEPTION_MASK])
            facts.grids[freq].exception_dtype = layout["dtype"]
            facts.grids[freq].exception_focus_bits = layout["focus_bits"]
            facts.grids[freq].exception_fill = layout["fill"]
    return facts


def start_datetime(facts: GcovFacts) -> tuple[str, str]:
    """(date "YYYY-MM-DD", datetime "YYYY-MM-DDTHH:MM:SSZ") of the acquisition start, from the file."""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})", facts.start_time)
    if not m:
        raise ValueError(f"Cannot read the start time {facts.start_time!r} in {facts.granule_id}")
    return m.group(1), f"{m.group(1)}T{m.group(2)}Z"


@dataclass(frozen=True)
class PixelWindow:
    row0: int
    row1: int  # exclusive
    col0: int
    col1: int  # exclusive
    clipped: bool  # True when part of the request fell outside the grid

    @property
    def shape(self) -> tuple[int, int]:
        return self.row1 - self.row0, self.col1 - self.col0


def pixel_window(x_first: float, dx: float, nx: int, y_first: float, dy: float, ny: int,
                 bounds: tuple[float, float, float, float]) -> PixelWindow:
    """Rows and columns of the grid cells that touch bounds = (xmin, ymin, xmax, ymax) in grid units.

    The coordinates in the file are pixel CENTRES, so the outer edge of the grid is half a pixel beyond
    the first centre: left edge = x_first - dx/2, top edge = y_first - dy/2 (dy is negative, so the
    top edge is above the first row). Rows count downwards, so ymax picks the first row.
    """
    if dx <= 0 or dy >= 0:
        raise WindowError(f"Expected x to ascend and y to descend, got spacing dx={dx}, dy={dy}")
    xmin, ymin, xmax, ymax = bounds
    left = x_first - dx / 2
    top = y_first - dy / 2
    step_y = -dy
    # A tiny tolerance keeps a bound that lies exactly on a pixel edge from grabbing one extra pixel.
    eps = 1e-9
    c0 = math.floor((xmin - left) / dx + eps)
    c1 = math.ceil((xmax - left) / dx - eps)
    r0 = math.floor((top - ymax) / step_y + eps)
    r1 = math.ceil((top - ymin) / step_y - eps)
    if c1 <= 0 or r1 <= 0 or c0 >= nx or r0 >= ny or c1 <= c0 or r1 <= r0:
        raise WindowError(
            f"The window {bounds} lies outside the product grid "
            f"(x {left:.1f}..{left + nx * dx:.1f}, y {top - ny * step_y:.1f}..{top:.1f}). "
            "Check the site bbox (west, south, east, north in degrees) and that this granule covers it.")
    clipped = c0 < 0 or r0 < 0 or c1 > nx or r1 > ny
    return PixelWindow(max(r0, 0), min(r1, ny), max(c0, 0), min(c1, nx), clipped)


def window_transform(x_first: float, dx: float, y_first: float, dy: float, win: PixelWindow) -> Affine:
    """Affine transform of the window: its origin is the outer corner of its first pixel."""
    x_centre = x_first + win.col0 * dx
    y_centre = y_first + win.row0 * dy
    return Affine(dx, 0.0, x_centre - dx / 2, 0.0, dy, y_centre - dy / 2)


def lonlat_to_grid_bounds(bbox: tuple[float, float, float, float], epsg: int) -> tuple[float, float, float, float]:
    """Smallest box in the grid's projection that contains the lon/lat box (edges are densified,
    because a lon/lat rectangle is slightly curved in UTM)."""
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    return t.transform_bounds(*bbox, densify_pts=21)


@dataclass
class Window:
    terms: dict[str, np.ndarray]  # covariance term -> float32 linear power
    mask: np.ndarray | None  # uint8, as stored
    epsg: int
    transform: Affine
    pixels: PixelWindow


def read_window(h5: h5py.File, facts: GcovFacts, bbox: tuple[float, float, float, float],
                frequency: str, terms: list[str]) -> Window:
    """Read the covariance terms (e.g. ["HHHH"]) and the mask inside a lon/lat bbox."""
    if frequency not in facts.grids:
        raise WindowError(f"{facts.granule_id} has no frequency {frequency}; it lists {facts.frequencies}")
    grid = facts.grids[frequency]
    missing = [t for t in terms if t not in grid.covariance_terms]
    if missing:
        raise WindowError(f"{facts.granule_id} frequency {frequency} has no {missing}; "
                          f"it holds {grid.covariance_terms}")
    bounds = lonlat_to_grid_bounds(bbox, grid.epsg)
    win = pixel_window(grid.x_first, grid.x_spacing, grid.shape[1],
                       grid.y_first, grid.y_spacing, grid.shape[0], bounds)
    if win.clipped:
        print(f"warning: the site bbox reaches beyond {facts.granule_id}; reading the part inside it",
              file=sys.stderr)
    g = h5[f"{GRIDS}/frequency{frequency}"]
    rows, cols = slice(win.row0, win.row1), slice(win.col0, win.col1)
    data = {t: np.asarray(g[t][rows, cols], dtype=np.float32) for t in terms}
    mask = np.asarray(g["mask"][rows, cols]) if grid.has_mask else None
    transform = window_transform(grid.x_first, grid.x_spacing, grid.y_first, grid.y_spacing, win)
    return Window(terms=data, mask=mask, epsg=grid.epsg, transform=transform, pixels=win)


def unique_mask_values(h5: h5py.File, frequency: str, rows_per_step: int = 2048) -> list[int]:
    """Every distinct mask value in the whole grid, read in strips to keep memory small."""
    ds = h5[f"{GRIDS}/frequency{frequency}/mask"]
    seen: set[int] = set()
    for r in range(0, ds.shape[0], rows_per_step):
        seen.update(int(v) for v in np.unique(ds[r:r + rows_per_step, :]))
    return sorted(seen)


# inputDataExceptionMask: one per frequency, on the same grid as the data. Its layout depends on the
# product specification version. Two layouts were seen in real files of one site on 14 November 2026:
#
# Specification 1.5.0 (22 of the site's 24 dates): uint8, attribute valid_min 0, no _FillValue, and this
# description attribute, word for word:
#   "Bitwise OR of input data exception codes for each image pixel (0: no anomaly, 2: NISAR LSAR qFSP-H1
#   sample slip)"
# A good pixel holds 0. There are no focus bits: a bit that is off says nothing about focusing.
#
# Specification 1.6.0 (2 dates): uint16, _FillValue attribute 65535, and the same sentence followed by:
#   "Also includes OR of validity mask bits, where each bit is set on for fully-focused data or off for
#   partially focused or missing data (256:HH, 512:HV, 1024:VH, 2048:VV, 4096:LH, 8192:LV, 16384:RH,
#   32768:RV)"
# A good pixel of an HH and HV file holds 768 (both focus bits on, no anomaly), as every pixel of a 31 km
# window did. The HDF5 creation fill value of that dataset is 0, not 65535: a chunk that was never written
# reads as 0, which has no focus bit set and so counts as not fully focused.
#
# So the code never takes the layout from the version number: exception_layout reads, from each file's own
# dataset, whether it carries focus bits and which value (if any) is fill.
ANOMALY_BITS = 0x00FF  # with focus bits present, the exception codes are every bit below 256
FOCUS_BIT = {"HH": 256, "HV": 512, "VH": 1024, "VV": 2048, "LH": 4096, "LV": 8192, "RH": 16384, "RV": 32768}
EXCEPTION_VALUES_LISTED = 20  # distinct values recorded with their counts; the rest are counted as left out
# The description lists focus bits when it names them ("validity mask bits") or gives a number, a colon and
# a polarization ("256:HH"). Matched loosely, so a reworded description still counts.
_FOCUS_LISTED = re.compile(r"validity\s+mask\s+bits|\b\d+\s*:\s*(?:HH|HV|VH|VV|LH|LV|RH|RV)\b", re.IGNORECASE)
# Stored in every summary, so fetch can tell (stages._window_ok) a summary made before the layout was read
# from each file (no method: it assumed the 1.6.0 layout for every file) and redo only that window.
EXCEPTION_SUMMARY_METHOD = (
    "v2 (14 November 2026): layout read from each file. Focus bits are counted only when the mask's "
    "description lists them and its type can hold them; fill is the mask's own _FillValue, none without one; "
    "an anomaly is any bit below 256 when focus bits are present, any non-zero value otherwise.")


def has_focus_bits(description: str, dtype) -> bool:
    """True when an inputDataExceptionMask with this description attribute and type carries the "fully
    focused" bits: the description lists them and the type is an integer wide enough for the lowest (256)."""
    dtype = np.dtype(dtype)
    wide = np.issubdtype(dtype, np.integer) and int(np.iinfo(dtype).max) >= min(FOCUS_BIT.values())
    return wide and bool(_FOCUS_LISTED.search(description))


def _fill_attribute(value) -> int | None:
    """A _FillValue attribute as an integer, or None when there is none or it is not a whole number."""
    if value is None:
        return None
    arr = np.asarray(value).reshape(-1)
    if arr.size != 1:
        return None
    number = arr[0].item()
    if isinstance(number, float) and not number.is_integer():
        return None
    try:
        return int(number)
    except (TypeError, ValueError):
        return None


def exception_layout(ds: h5py.Dataset) -> dict:
    """What one inputDataExceptionMask dataset says about its own layout (attributes only, no pixels):
    {"dtype", "focus_bits", "fill"}. See the notes above for the two layouts seen in real files."""
    description = _text(ds.attrs["description"]) if "description" in ds.attrs else ""
    return {"dtype": str(ds.dtype), "focus_bits": has_focus_bits(description, ds.dtype),
            "fill": _fill_attribute(ds.attrs.get("_FillValue"))}


def read_exception_window(h5: h5py.File, frequency: str, pixels: PixelWindow) -> np.ndarray:
    """inputDataExceptionMask over exactly the rows and columns read_window took for the data.

    One more dataset costs several seconds per date on a real file, so fetch calls this only when the
    file's hasInputDataException says there is something to see. The values are returned as stored (uint8
    or uint16, see the notes above); summarise_exceptions interprets them with the file's own layout.
    """
    ds = h5[f"{GRIDS}/frequency{frequency}/{EXCEPTION_MASK}"]
    return np.asarray(ds[pixels.row0:pixels.row1, pixels.col0:pixels.col1])


def summarise_exceptions(values: np.ndarray, polarizations: list[str], *, focus_bits: bool, fill: int | None,
                         listed: int = EXCEPTION_VALUES_LISTED) -> dict:
    """What inputDataExceptionMask says about one window, for the record. It describes; it changes nothing.

    `focus_bits` and `fill` come from the file (GridFacts.exception_focus_bits and exception_fill, read by
    exception_layout), never from the specification version.

    With focus bits (the 1.6.0 layout), TRAP: a GOOD pixel is not 0. Good means the anomaly bits (below
    256) are clear AND the polarization's "fully focused" bit is SET, so a good pixel of an HH+HV file is
    768 (256 + 512). Never test "== 0" there. Without focus bits (the 1.5.0 layout) the value is the
    exception code alone: 0 is good, anything else is an anomaly, and nothing is known about focusing, so
    the focus numbers are None (not 0, not 100 %).

    No pixel is dropped or changed because of this mask, here or anywhere else in the pipeline: whether
    flagged pixels should be removed is still an open question (docs/TASKS.md, T2). Only the product's
    `mask`, finite values and the power floor decide validity (pipeline/process.py, valid_pixels).

    Pixels holding the fill value (when the file defines one) are left out of the shares; a share is None
    when the window holds nothing but fill. `values` lists the commonest distinct values, fill included.
    """
    if focus_bits:
        unknown = [p for p in polarizations if p not in FOCUS_BIT]
        if unknown:
            raise ValueError(f"No focus bit is defined for polarization(s) {unknown}; known: {list(FOCUS_BIT)}")
    data = np.asarray(values)
    if not np.issubdtype(data.dtype, np.integer):
        raise TypeError(f"inputDataExceptionMask should hold integers, got {data.dtype}")
    distinct, counts = np.unique(data, return_counts=True)
    order = np.lexsort((distinct, -counts))  # commonest first; equal counts by value
    shown, left_out = order[:listed], order[listed:]
    info = np.iinfo(data.dtype)
    if fill is not None and info.min <= fill <= info.max:
        is_fill = data == fill
    else:  # no fill value, or one the type cannot hold: no pixel is fill
        is_fill = np.zeros(data.shape, dtype=bool)
    kept = data[~is_fill].astype(np.int64)
    counted = int(kept.size)
    anomaly = int(np.count_nonzero(kept & ANOMALY_BITS if focus_bits else kept))
    not_focused = ({p: int(np.count_nonzero((kept & FOCUS_BIT[p]) == 0)) for p in polarizations}
                   if focus_bits else None)

    def share(n: int) -> float | None:
        return n / counted if counted else None

    return {
        "method": EXCEPTION_SUMMARY_METHOD,
        "focus_bits": bool(focus_bits),
        "fill_value": fill,
        "pixels": int(data.size),
        "fill_pixels": int(np.count_nonzero(is_fill)),
        "counted_pixels": counted,
        "values": [{"value": int(distinct[i]), "count": int(counts[i])} for i in shown],
        "values_left_out": int(left_out.size),
        "pixels_in_values_left_out": int(counts[left_out].sum()),
        "anomaly_pixels": anomaly,
        "anomaly_share": share(anomaly),
        "not_fully_focused_pixels": not_focused,
        "not_fully_focused_share": ({p: share(n) for p, n in not_focused.items()}
                                    if not_focused is not None else None),
    }


def _percent(share: float) -> str:
    """A share as a percentage with two significant digits, so a non-zero share never reads as 0."""
    value = 100 * share
    if value == 0:
        return "0%"
    decimals = max(1, 1 - math.floor(math.log10(value)))
    return f"{value:.{decimals}f}%"


def describe_exception_code(code: int | None) -> str:
    """hasInputDataException's number in words, for the warning: "code 2 (NISAR LSAR qFSP-H1 sample slip)"."""
    if code is None:
        return "an input data exception (no numeric code recorded)"
    meaning = EXCEPTION_CODES.get(code)
    if meaning is None:
        meaning = "not one of the documented codes " + ", ".join(f"{k}: {v}" for k, v in EXCEPTION_CODES.items())
    return f"code {code} ({meaning})"


def describe_exceptions(summary: dict) -> str:
    """What the window's exception mask holds, in words, for the one warning line fetch prints; it follows
    "inside this site's window". Pixel counts come first: one pixel of a real 31 km window is about
    0.00004%, so a share alone, rounded, would tell the reader there is none."""
    counted, fill, fill_value = summary["counted_pixels"], summary["fill_pixels"], summary.get("fill_value")
    if not counted:
        return f"n/a: all {fill} px are fill ({fill_value}), so the mask says nothing about the window"
    anomaly = summary["anomaly_pixels"]
    tail = (f" ({fill} fill px of value {fill_value} left out)" if fill_value is not None
            else " (the mask defines no fill value, so every px is counted)")
    text = (f"{anomaly} of {counted} px " + (f"({_percent(anomaly / counted)}) " if anomaly else "")
            + "carry an anomaly bit")
    if summary.get("focus_bits") is not True:
        return (text + "; this product version's exception mask carries no focus information (its description "
                "lists no validity bits), so nothing is said about focusing" + tail)
    focus = summary["not_fully_focused_pixels"]
    if not any(focus.values()):
        return text + (f"; every pixel is fully focused in {', '.join(focus)}" if focus else "") + tail

    def count(n: int) -> str:
        return f"{n} px ({_percent(n / counted)})" if n else "0 px"

    return text + "; not fully focused: " + ", ".join(f"{p} {count(n)}" for p, n in focus.items()) + tail
