"""SYNTHETIC NISAR-format GCOV files for the automated tests. Not real data; never shown in the app.

The layout mirrors what was verified on NASA's sample files and on ASF's outputs from real files:
/science/LSAR/identification/... and /science/LSAR/GCOV/grids/frequencyA/ with float32 covariance
terms (NaN fill), a uint8 mask (fill 255), pixel-centre coordinates with y descending, scalar spacings,
and a uint32 `projection` holding the EPSG code. Every file and every identifier written here says
SYNTHETIC, so nobody can mistake it for an observation.

The values are random speckle around a chosen level, plus one bright square at a known lon/lat that
tests look for after the whole chain, to prove the georeferencing is right.

`write_real_format_gcov` writes a file shaped like the one real granule read on 14 November 2026
(specification 1.6.0): frequencies A and B (B at four times A's posting over the same area), HH and HV,
the mask in the real convention (0 invalid, 1 to 5 valid, 255 outside the swath), a uint16
inputDataExceptionMask holding 768 (HH and HV fully focused, no anomaly) unless a test says otherwise,
and identification/hasInputDataException. Only the format is copied; no value or place of that granule is.

The exception mask is written in the layout of the file's specification version, as seen in real files of
one site on 14 November 2026 (`exception_layout` overrides it): "1.6.0" uint16 with focus bits, _FillValue
65535 and the long description; "1.5.0" uint8, the short description without focus bits, valid_min 0, no
_FillValue, 0 for a good pixel.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer

IDENT = "/science/LSAR/identification"
GRIDS = "/science/LSAR/GCOV/grids"
GRID = f"{GRIDS}/frequencyA"

# Mask conventions (see pipeline/process.py): which spec version each one goes with. "real" is the same
# convention as "subswath" written the way the real 1.6.0 file was: one sub-swath value (1) inside the swath.
SPEC_FOR = {"zero-valid": "1.2.1", "subswath": "1.5.0", "real": "1.6.0"}

# How many times coarser frequency B is than A (20 m and 80 m in the real file).
B_FACTOR = 4

# The "fully focused" bits of inputDataExceptionMask, from the dataset's own description attribute (written
# here on purpose instead of imported from pipeline.gcov, so a test does not check the code against itself).
FOCUS_BITS = {"HH": 256, "HV": 512, "VH": 1024, "VV": 2048}
EXCEPTION_FILL = 65535
# The description attribute of inputDataExceptionMask in the real files, word for word: 1.5.0 has only the
# first sentence, 1.6.0 adds the second.
EXCEPTION_DESCRIPTION_1_5 = (
    "Bitwise OR of input data exception codes for each image pixel (0: no anomaly, 2: NISAR LSAR qFSP-H1 "
    "sample slip)")
EXCEPTION_DESCRIPTION = (
    EXCEPTION_DESCRIPTION_1_5 + ". Also includes OR of validity mask bits, where each bit is set on for "
    "fully-focused data or off for partially focused or missing data (256:HH, 512:HV, 1024:VH, 2048:VV, "
    "4096:LH, 8192:LV, 16384:RH, 32768:RV)")
EXCEPTION_LAYOUTS = ("1.5.0", "1.6.0")


@dataclass(frozen=True)
class SynthGrid:
    """A UTM grid. Defaults: zone 11N, 20 m posting, 600 x 600 px (12 km), about 118.0 W 34.8 N."""

    epsg: int = 32611
    x_first: float = 400010.0  # centre of the first column; the left edge is 400000
    y_first: float = 3856990.0  # centre of the first row; the top edge is 3857000
    spacing: float = 20.0
    rows: int = 600
    cols: int = 600

    @property
    def x(self) -> np.ndarray:
        return self.x_first + self.spacing * np.arange(self.cols)

    @property
    def y(self) -> np.ndarray:
        return self.y_first - self.spacing * np.arange(self.rows)

    def lonlat_bounds(self, margin_px: int = 0) -> tuple[float, float, float, float]:
        """lon/lat box strictly inside the grid (margin_px pixels in from each edge)."""
        t = Transformer.from_crs(f"EPSG:{self.epsg}", "EPSG:4326", always_xy=True)
        half = self.spacing / 2
        x0, x1 = self.x[0] - half + margin_px * self.spacing, self.x[-1] + half - margin_px * self.spacing
        y0, y1 = self.y[-1] - half + margin_px * self.spacing, self.y[0] + half - margin_px * self.spacing
        # A UTM rectangle is slightly skewed in lon/lat, so take the inner extremes of its corners.
        (lon_sw, lon_nw, lon_se, lon_ne), (lat_sw, lat_nw, lat_se, lat_ne) = t.transform(
            [x0, x0, x1, x1], [y0, y1, y0, y1])
        return (max(lon_sw, lon_nw), max(lat_sw, lat_se), min(lon_se, lon_ne), min(lat_nw, lat_ne))

    def lonlat_box(self, row0: int, row1: int, col0: int, col1: int) -> tuple[float, float, float, float]:
        """lon/lat box strictly inside the pixel block rows row0..row1-1, columns col0..col1-1. A window
        read with it can still reach about one pixel further (the reader takes every pixel it touches)."""
        t = Transformer.from_crs(f"EPSG:{self.epsg}", "EPSG:4326", always_xy=True)
        left, top = self.x_first - self.spacing / 2, self.y_first + self.spacing / 2
        x0, x1 = left + col0 * self.spacing, left + col1 * self.spacing
        y0, y1 = top - row1 * self.spacing, top - row0 * self.spacing
        (lon_sw, lon_nw, lon_se, lon_ne), (lat_sw, lat_nw, lat_se, lat_ne) = t.transform(
            [x0, x0, x1, x1], [y0, y1, y0, y1])
        return (max(lon_sw, lon_nw), max(lat_sw, lat_se), min(lon_se, lon_ne), min(lat_nw, lat_ne))

    def coarser(self, factor: int) -> SynthGrid:
        """The same area at `factor` times the posting, as frequency B is to A in the real file: the outer
        edges stay where they are, so the first pixel centre moves half a coarse pixel in from the edge."""
        left, top = self.x_first - self.spacing / 2, self.y_first + self.spacing / 2
        spacing = self.spacing * factor
        return SynthGrid(epsg=self.epsg, x_first=left + spacing / 2, y_first=top - spacing / 2,
                         spacing=spacing, rows=self.rows // factor, cols=self.cols // factor)


@dataclass(frozen=True)
class BrightSpot:
    """The square of high backscatter written into every synthetic file."""

    row0: int = 300  # even, so 2x2 multilook blocks line up with it
    col0: int = 240
    size: int = 10  # pixels per side (200 m)
    level_db: float = 0.0

    def centre_xy(self, grid: SynthGrid) -> tuple[float, float]:
        cx = grid.x_first + (self.col0 + (self.size - 1) / 2) * grid.spacing
        cy = grid.y_first - (self.row0 + (self.size - 1) / 2) * grid.spacing
        return cx, cy

    def centre_lonlat(self, grid: SynthGrid) -> tuple[float, float]:
        t = Transformer.from_crs(f"EPSG:{grid.epsg}", "EPSG:4326", always_xy=True)
        return t.transform(*self.centre_xy(grid))

    def coarser(self, factor: int) -> BrightSpot:
        """Where the spot is written on a grid `factor` times coarser (frequency B): the coarse pixels that
        start inside it, at least one."""
        return BrightSpot(row0=self.row0 // factor, col0=self.col0 // factor,
                          size=max(1, self.size // factor), level_db=self.level_db)


def synthetic_name(date: str, index: int = 1) -> str:
    compact = date.replace("-", "")
    return f"SYNTHETIC_NISAR_L2_GCOV_{index:03d}_030_A_019_{compact}T060000_TEST_ONLY"


def _span(lo: int, hi: int, scale: int) -> slice:
    """Rows or columns lo..hi-1 of frequency A on a grid `scale` times coarser (at least one pixel)."""
    if scale == 1:
        return slice(lo, hi)
    first = lo // scale
    return slice(first, max(-(-hi // scale), first + 1))


def _coarsen(power: np.ndarray, scale: int) -> np.ndarray:
    """Mean of LINEAR power over scale x scale blocks: a hand-made scene of frequency A as B would see it."""
    if scale == 1:
        return power
    rows, cols = power.shape[0] // scale, power.shape[1] // scale
    blocks = np.asarray(power, dtype=np.float64)[:rows * scale, :cols * scale].reshape(rows, scale, cols, scale)
    return blocks.mean(axis=(1, 3))


@dataclass
class _Layers:
    """Everything written under one grids/frequencyX group."""

    grid: SynthGrid
    terms: dict[str, np.ndarray]
    mask: np.ndarray
    exceptions: np.ndarray | None


def _layers(rng: np.random.Generator, grid: SynthGrid, spot: BrightSpot, scale: int, convention: str,
            level_db: float, looks: int, pols: tuple[str, ...], power: np.ndarray | dict | None,
            hole: tuple[int, int, int, int] | None, exception_mask: bool, exception_layout: str) -> _Layers:
    """The arrays of one frequency. `scale` is how many times coarser than frequency A its grid is; the
    fixed features (outside columns, invalid block, edge values, hole) sit at A's positions divided by it."""
    shape = (grid.rows, grid.cols)
    mean_power = 10 ** (level_db / 10)
    # Gamma-distributed speckle with `looks` looks: the textbook model of multilooked SAR intensity.
    terms = {}
    for i, pol in enumerate(pols):
        scene = rng.gamma(looks, mean_power / looks, size=shape).astype(np.float32)
        given = power.get(pol) if isinstance(power, dict) else (power if i == 0 else None)
        if given is not None:
            scene = np.array(_coarsen(given, scale), dtype=np.float32, copy=True)
        elif i == 0 and not isinstance(power, dict):
            scene[spot.row0:spot.row0 + spot.size, spot.col0:spot.col0 + spot.size] = 10 ** (spot.level_db / 10)
        terms[pol + pol] = scene

    # Outside the radar swath: the last 100 columns (of A). Inside it, a few invalid pixels and a few
    # near-zero edge values that a naive "> 0" test would keep.
    outside = np.zeros(shape, dtype=bool)
    outside[:, -(100 // scale):] = True
    if hole is not None:
        outside[_span(hole[0], hole[1], scale), _span(hole[2], hole[3], scale)] = True
    invalid = np.zeros(shape, dtype=bool)
    invalid[_span(100, 102, scale), _span(100, 110, scale)] = True
    tiny = np.zeros(shape, dtype=bool)
    tiny[_span(110, 111, scale), _span(100, 110, scale)] = True
    if convention == "subswath":
        mask = np.where(np.arange(grid.cols) < grid.cols // 2, 1, 2).astype(np.uint8) * np.ones(shape, np.uint8)
        mask[invalid] = 0
    elif convention == "real":
        # As in the real window: one sub-swath value inside the swath. The real file's 0 pixels were NaN
        # in the data too; here they keep ordinary values, so a test can tell that the MASK removed them.
        mask = np.ones(shape, dtype=np.uint8)
        mask[invalid] = 0
    elif convention == "zero-valid":
        mask = np.zeros(shape, dtype=np.uint8)  # the sample files have no per-pixel invalid flag
    else:
        raise ValueError(f"unknown convention {convention!r}")
    mask[outside] = 255
    for values in terms.values():
        values[outside] = np.nan
        values[tiny] = 1e-14
        if convention == "zero-valid":
            values[invalid] = np.nan  # how the samples mark bad pixels inside the image

    exceptions = None
    if exception_mask and exception_layout == "1.5.0":
        # No anomaly anywhere: 0, as every pixel of the real 1.5.0 windows held. There is no fill value, so
        # outside the swath is 0 too (what real files hold there was not seen).
        exceptions = np.zeros(shape, dtype=np.uint8)
    elif exception_mask:
        # Inside the swath: every polarization fully focused, no anomaly (768 for HH and HV), invalid
        # pixels included, as in the real window. Outside it the fill value: what real files hold there
        # was not seen (that window did not reach the swath edge).
        exceptions = np.full(shape, sum(FOCUS_BITS[p] for p in pols), dtype=np.uint16)
        exceptions[outside] = EXCEPTION_FILL
    return _Layers(grid, terms, mask, exceptions)


def _flag_data(value):
    """hasInputDataException as a test asks for it: an integer is stored as uint8 (as in the real file),
    a boolean as HDF5's boolean enum, bytes as a fixed-length string, text as a variable-length string."""
    if isinstance(value, (bool, np.bool_)):
        return np.bool_(value)
    if isinstance(value, (int, np.integer)):
        return np.uint8(value)
    if isinstance(value, bytes):
        return np.bytes_(value)
    if isinstance(value, str):
        return value
    raise TypeError(f"cannot write {value!r} as hasInputDataException")


def write_synthetic_gcov(path: Path, date: str, *, convention: str = "subswath", level_db: float = -15.0,
                         grid: SynthGrid = SynthGrid(), spot: BrightSpot = BrightSpot(), seed: int = 0,
                         looks: int = 4, pols: tuple[str, ...] = ("HH",), index: int = 1,
                         power: np.ndarray | dict[str, np.ndarray] | None = None,
                         hole: tuple[int, int, int, int] | None = None,
                         track: int = 30, frame: int = 19, direction: str = "Ascending",
                         frequencies: tuple[str, ...] = ("A",), exception_mask: bool = False,
                         exceptions: dict[tuple[int, int], int] | None = None,
                         exception_flag: object = None, exception_layout: str | None = None) -> Path:
    """Write one synthetic GCOV file. `convention` picks the mask meaning and the spec version:
    "subswath" (spec 1.5.0: 0 invalid, 1..5 valid), "real" (spec 1.6.0, the same meaning, written as the
    real file was: 1 inside the swath) or "zero-valid" (spec 1.2.1, like NASA's samples).

    `power` replaces the speckled scene of the first polarization (no bright spot then), for tests that
    need a scene they can compute by hand; a dict {polarization: scene} replaces the scenes of the
    polarizations it names (no bright spot in any). `hole` = (row0, row1, col0, col1) marks a block as outside the
    swath, like a partial frame. `track`, `frame` and `direction` are what the file says about its stack.
    All of these are in frequency A's pixels; frequency B (`frequencies`) covers the same area at
    B_FACTOR times the posting and gets the same features, scaled.

    `exception_mask` writes inputDataExceptionMask in every frequency; `exceptions` then sets single
    pixels of frequency A's, as {(row, col): value}. `exception_flag` is the value written as
    identification/hasInputDataException (int, bool, bytes or str); None leaves the field out, as in the
    samples. `exception_layout` ("1.5.0" or "1.6.0", see the module docstring) is the exception mask's
    layout; None takes the one of the file's specification version (1.6.0 for the 1.2.1 convention, which
    real files never had).
    """
    if "synthetic" not in path.name.lower():
        raise ValueError("synthetic test files must have 'synthetic' in their file name")
    if exception_layout is None:
        exception_layout = "1.5.0" if SPEC_FOR[convention] == "1.5.0" else "1.6.0"
    if exception_layout not in EXCEPTION_LAYOUTS:
        raise ValueError(f"exception_layout must be one of {EXCEPTION_LAYOUTS}, got {exception_layout!r}")
    if not frequencies or len(set(frequencies)) != len(frequencies) or set(frequencies) - {"A", "B"}:
        raise ValueError(f"frequencies must be distinct values from A and B, got {frequencies}")
    if exceptions and not (exception_mask and "A" in frequencies):
        raise ValueError("exceptions set pixels of frequency A's exception mask: write it (exception_mask=True)")
    rng = np.random.default_rng(seed)
    layers = {}
    for freq in frequencies:  # A first: its arrays are then the same whether or not B is written
        scale = 1 if freq == "A" else B_FACTOR
        layers[freq] = _layers(rng, grid if scale == 1 else grid.coarser(scale),
                               spot if scale == 1 else spot.coarser(scale), scale, convention, level_db, looks,
                               pols, power, hole, exception_mask, exception_layout)
    for (row, col), value in (exceptions or {}).items():
        layers["A"].exceptions[row, col] = value

    path.parent.mkdir(parents=True, exist_ok=True)
    with h5py.File(path, "w", fs_strategy="page", fs_page_size=1024 * 1024) as h5:
        h5.attrs["title"] = "SYNTHETIC TEST DATA - not a NISAR observation"
        ident = h5.create_group(IDENT)
        text = {
            "granuleId": synthetic_name(date, index),
            "productSpecificationVersion": SPEC_FOR[convention],
            "missionId": "SYNTHETIC",
            "instrumentName": "SYNTHETIC",
            "compositeReleaseId": "T00000",
            "orbitPassDirection": direction,
            "lookDirection": "Right",
            "isFullFrame": "True",
            "productType": "GCOV",
            "zeroDopplerStartTime": f"{date}T06:00:00.000000000",
            "zeroDopplerEndTime": f"{date}T06:00:14.000000000",
        }
        for key, value in text.items():
            ident.create_dataset(key, data=np.bytes_(value))
        ident.create_dataset("listOfFrequencies", data=np.array([f.encode() for f in frequencies]))
        ident.create_dataset("trackNumber", data=np.uint32(track))
        ident.create_dataset("frameNumber", data=np.uint16(frame))
        if exception_flag is not None:
            ident.create_dataset("hasInputDataException", data=_flag_data(exception_flag))

        for freq, layer in layers.items():
            fgrid = layer.grid
            chunks = (min(128, fgrid.rows), min(128, fgrid.cols))
            g = h5.create_group(f"{GRIDS}/frequency{freq}")
            for name, data in layer.terms.items():
                g.create_dataset(name, data=data, chunks=chunks, compression="gzip", fillvalue=np.nan)
            if convention == "real":
                # As in the real file: the HDF5 creation fill value is 0 although the attribute says 255.
                mask = g.create_dataset("mask", data=layer.mask, chunks=chunks, compression="gzip", fillvalue=0)
                mask.attrs["_FillValue"] = np.uint8(255)
            else:
                g.create_dataset("mask", data=layer.mask, chunks=chunks, compression="gzip", fillvalue=255)
            if layer.exceptions is not None:
                exc = g.create_dataset("inputDataExceptionMask", data=layer.exceptions, chunks=chunks,
                                       compression="gzip", fillvalue=0)
                if exception_layout == "1.5.0":  # no _FillValue attribute at all
                    exc.attrs["description"] = EXCEPTION_DESCRIPTION_1_5
                    exc.attrs["valid_min"] = np.uint8(0)
                else:
                    exc.attrs["_FillValue"] = np.uint16(EXCEPTION_FILL)
                    exc.attrs["description"] = EXCEPTION_DESCRIPTION
            g.create_dataset("xCoordinates", data=fgrid.x)
            g.create_dataset("yCoordinates", data=fgrid.y)
            g.create_dataset("xCoordinateSpacing", data=np.float64(fgrid.spacing))
            g.create_dataset("yCoordinateSpacing", data=np.float64(-fgrid.spacing))
            proj = g.create_dataset("projection", data=np.uint32(fgrid.epsg))
            proj.attrs["epsg_code"] = np.uint32(fgrid.epsg)
            g.create_dataset("listOfPolarizations", data=np.array([p.encode() for p in pols]))
            g.create_dataset("listOfCovarianceTerms", data=np.array([(p + p).encode() for p in pols]))
    return path


# The format of the real 1.6.0 granule (see the module docstring). Exception flag 0, as in that file.
REAL_FORMAT = {"convention": "real", "pols": ("HH", "HV"), "frequencies": ("A", "B"), "exception_mask": True,
               "exception_flag": 0}


def write_real_format_gcov(path: Path, date: str, **kwargs) -> Path:
    """A synthetic file in the real 1.6.0 format. Any argument of write_synthetic_gcov overrides REAL_FORMAT."""
    return write_synthetic_gcov(path, date, **{**REAL_FORMAT, **kwargs})


# The exception layout of the real 1.5.0 files (22 of one site's dates, 14 November 2026): HH and HV, the
# uint8 mask without focus bits, and the flag stored as uint8, 0 on clean files and 2 (the sample-slip code
# itself) on flagged ones. Their other features (frequencies, mask values) were not compared with these.
FORMAT_1_5 = {"convention": "subswath", "pols": ("HH", "HV"), "exception_mask": True, "exception_flag": 0}


def write_1_5_format_gcov(path: Path, date: str, **kwargs) -> Path:
    """A synthetic file with the 1.5.0 exception layout. Any argument of write_synthetic_gcov overrides
    FORMAT_1_5."""
    return write_synthetic_gcov(path, date, **{**FORMAT_1_5, **kwargs})
