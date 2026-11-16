"""Optical cross-check of the harvest map: what Sentinel-2's NDVI says about the 100 m cells of each radar class.

The method is fixed in docs/OPTICAL_CHECK_BRIEF.md (steps 1 to 10), written before any optical value for this site
was read; README.md in this folder states it and the readings taken where the brief is ambiguous. The pure
functions of steps 3 to 9 come first, each tested on SYNTHETIC arrays in test_optical_check.py; the catalog, the
windowed reads, the cache and the report come after them.

    python research/optical_check/optical_check.py probe   # access probe: one scene, shapes and grids, no NDVI
    python research/optical_check/optical_check.py run     # every scene; writes results.json, RESULTS.md and
                                                           # ndvi_by_class.png next to this file

AI-written (Claude Opus 5.5, Anthropic).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import ssl
import sys
import time
import urllib.request
from bisect import bisect_left, bisect_right
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:  # run as a script: the pipeline's own functions live at the repository root
    sys.path.insert(0, str(ROOT))

from pipeline.config import load_site  # noqa: E402
from pipeline.harvest import (  # noqa: E402
    FELL_BEFORE_COLOUR,
    NO_HARVEST_COLOUR,
    cells_in_boxes,
    harvest_colours,
    otsu_threshold,
)

HERE = Path(__file__).resolve().parent
INPUTS = HERE / "inputs"
WORK = ROOT / "work" / "optical"
SITE = "tarn-taran"
GENERATOR = "research/optical_check/optical_check.py, AI-written (Claude Opus 5.5, Anthropic)"

# Step 2: optical data ------------------------------------------------------------------------------------------
STAC_URL = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
FIRST_DAY, LAST_DAY = "2026-09-10", "2026-11-14"
TILE = "43RDQ"  # the box lies wholly inside it (checked on every scene by grid_window); one tile per date
CRS = "EPSG:32643"
ASSETS = ("red", "nir", "scl")
NODATA_DN = 0  # the nodata value of every asset read (raster:bands nodata, checked on each file)
REFLECTANCE_SCALE = 1e-4
BOA_OFFSET = -0.1  # baselines 04.00 on, where the offset is still in the values: reflectance = DN * 1e-4 - 0.1
OFFSET_DN = 1000  # the same offset in values: a value below it is a negative reflectance if the offset is still in
# A guard on the conversion, not a definition: vegetation (SCL 4) reflects little red, so with the offset removed
# many of its red values lie below OFFSET_DN, and with the offset still in none can. A scene taken as offset-free
# with under 1 % of them below stops the run; with too few vegetation pixels (a cloudy date) it is not checked.
OFFSET_CHECK_SCL = 4
OFFSET_CHECK_MIN_PIXELS = 1000
OFFSET_CHECK_MIN_SHARE = 0.01
# Step 3: valid pixels
PIXEL_M = 10
SCL_FACTOR = 2  # SCL is 20 m: one SCL pixel covers the 2 x 2 pixels of 10 m under it
VALID_SCL = (2, 4, 5, 6, 7)  # dark area, vegetation, not vegetated, water, unclassified
DROPPED_SCL = (0, 1, 3, 8, 9, 10, 11)  # no data, defective, cloud shadow, clouds (8, 9), cirrus, snow
# Step 4: cells
CELL_PX = 10  # a 100 m cell is exactly 10 x 10 pixels of 10 m
MIN_VALID_PIXELS = 50
# Step 5: usable dates
USABLE_SHARE = 0.8
# Steps 6 and 7: classes of the class raster (band 1 HH, band 2 HV)
POLARIZATIONS = ("HH", "HV")
RICE_CLASSES = (1, 2, 3, 4, 5)
NO_HARVEST, FELL_BEFORE, NOT_RICE = 4, 5, 6
GROUPS = ("1", "2", "3", "4", "5", "not rice", "stable target box")
GROUP_LABELS = {"1": "harvest pair ending 2026-10-11", "2": "harvest pair ending 2026-10-23",
                "3": "harvest pair ending 2026-11-04", "4": "no harvest seen by 2026-11-04",
                "5": "fell before 2026-09-29", "not rice": "not rice", "stable target box": "stable target box"}
QUARTILES = (25, 50, 75)  # numpy's default method (linear): the brief names none for the quartiles
# Step 8: thresholds and the cut day
HARVEST_PASSES = ("2026-10-11", "2026-10-23", "2026-11-04")  # the passes at which harvest pairs 1, 2, 3 end
POOLED_FROM = "2026-09-15"
OTSU_RANGE = (-0.2, 1.0)
OTSU_BINS = 240
STRICT_CLASSES = (1, 2)
STRICT_SPAN = ("2026-10-24", "2026-11-04")
STRICT_QUANTILE = 0.75
QUANTILE_METHOD = "inverted_cdf"
GREEN_FROM = "2026-09-10"
CUT_FROM = "2026-09-29"
# Step 9: block bootstrap of the agreement
BLOCK_CELLS = 10
REPLICATES = 2000
SEED = 20261115
PERCENTILES = (2.5, 97.5)
PERCENTILE_METHOD = "linear"  # numpy's default; the marker test's bootstrap uses it too

# Quoted from docs/METHODS.md, section 6, "Official harvest figures" (each opened at its source on 14 November).
OFFICIAL = {
    "2026-10-11": "no figure found",
    "2026-10-23": ("Punjab 34.82 % harvested till 23 October; Tarn Taran district 73 %, Amritsar 83 %, in the same "
                   "report without a date of their own (PTI, 24 October)"),
    "2026-11-04": ("Punjab 85.10 % as of 4 November (Punjab Pollution Control Board, ANI, 5 November); more than "
                   "90 % of Tarn Taran and Amritsar together (PTI, 2 November, without a date of its own)"),
}

LIMITS = (
    "An optical index sees green, not stems: ripening, weeds, a second crop and smoke haze all move it.",
    "A 100 m cell holds several fields.",
    "Cloud and smoke leave gaps, so \"cut by day D\" depends on which dates are usable.",
    "Sentinel-2 passes at about 11:00 local time and NISAR at 05:43, days apart.",
    "The comparison is made afterwards, like the fire check.",
    "The marker decision (HV) is not reopened by this: it was made by a rule fixed beforehand. The numbers are "
    "reported for HH and HV without recommending a change.",
    "T_pooled separates green from not green; ripening rice loses green before it is cut, so this threshold calls "
    "some standing, ripe rice \"cut\".",
)


# Step 3: valid pixels ------------------------------------------------------------------------------------------

def valid_pixels(red: np.ndarray, nir: np.ndarray, scl: np.ndarray) -> np.ndarray:
    """A 10 m pixel is valid when both bands hold data (not the nodata value) and its SCL class is one of
    VALID_SCL. Dark-area pixels (SCL 2) stay in on purpose: a burned field is dark."""
    red, nir, scl = np.asarray(red), np.asarray(nir), np.asarray(scl)
    if not red.shape == nir.shape == scl.shape:
        raise ValueError(f"red {red.shape}, nir {nir.shape} and scl {scl.shape} differ in shape")
    return (red != NODATA_DN) & (nir != NODATA_DN) & np.isin(scl, VALID_SCL)


def coarse_window(row_off: int, col_off: int, rows: int, cols: int,
                  factor: int = SCL_FACTOR) -> tuple[int, int, int, int, int, int]:
    """The window of a grid `factor` times coarser, with the same origin, that covers the fine window (row_off,
    col_off, rows, cols), and where the fine window starts inside its first coarse pixel. Returns (coarse row_off,
    coarse col_off, coarse rows, coarse cols, sub row, sub col)."""
    r0, sub_r = divmod(int(row_off), factor)
    c0, sub_c = divmod(int(col_off), factor)
    return r0, c0, -(-(sub_r + rows) // factor), -(-(sub_c + cols) // factor), sub_r, sub_c


def to_fine(coarse: np.ndarray, sub_row: int, sub_col: int, rows: int, cols: int,
            factor: int = SCL_FACTOR) -> np.ndarray:
    """Each coarse pixel covers the factor x factor fine pixels under it: repeat it, then cut out the fine window
    that starts at (sub_row, sub_col) inside the first coarse pixel."""
    fine = np.repeat(np.repeat(np.asarray(coarse), factor, axis=0), factor, axis=1)
    fine = fine[sub_row:sub_row + rows, sub_col:sub_col + cols]
    if fine.shape != (rows, cols):
        raise ValueError(f"the coarse window gives {fine.shape} fine pixels, not {(rows, cols)}")
    return fine


def mosaic(granules: list[tuple[np.ndarray, np.ndarray, np.ndarray]]) -> tuple[np.ndarray, ...]:
    """One image from the granules of one tile and one date, given in order of preference as (red, nir, scl) on
    the same 10 m window: each pixel comes from the first granule that holds data in both bands there, and its
    SCL from the same granule. Returns (red, nir, scl, source), source the granule's index or -1 (no data)."""
    if not granules:
        raise ValueError("no granule to mosaic")
    shape = np.asarray(granules[0][0]).shape
    red = np.zeros(shape, dtype=np.uint16)
    nir = np.zeros(shape, dtype=np.uint16)
    scl = np.zeros(shape, dtype=np.uint8)
    source = np.full(shape, -1, dtype=np.int8)
    for i, (r, n, s) in enumerate(granules):
        r, n, s = np.asarray(r), np.asarray(n), np.asarray(s)
        if not r.shape == n.shape == s.shape == shape:
            raise ValueError(f"granule {i} has shapes {r.shape}, {n.shape}, {s.shape}, not {shape}")
        take = (source < 0) & (r != NODATA_DN) & (n != NODATA_DN)
        red[take], nir[take], scl[take], source[take] = r[take], n[take], s[take], i
    return red, nir, scl, source


# Step 4: cells -------------------------------------------------------------------------------------------------

def grid_window(cell_transform, cell_shape: tuple[int, int], raster_transform, raster_shape: tuple[int, int],
                pixel_m: float = PIXEL_M, cell_px: int = CELL_PX) -> tuple[int, int, int, int]:
    """(row_off, col_off, rows, cols): the raster pixels under the cell grid. Both grids are north up, the cells
    are cell_px x cell_px raster pixels, and both grids' corners sit on multiples of pixel_m, so every cell is
    exactly a block of whole pixels; the cell grid must lie wholly inside the raster. Raises otherwise."""
    ca, cb, cx, cd, ce, cy = (float(v) for v in tuple(cell_transform)[:6])
    ra, rb, rx, rd, re_, ry = (float(v) for v in tuple(raster_transform)[:6])
    if cb or cd or rb or rd:
        raise ValueError("both grids must be north up (no rotation)")
    if (ra, -re_) != (pixel_m, pixel_m):
        raise ValueError(f"the raster's pixels are {ra} x {-re_} m, not {pixel_m} m")
    if (ca, -ce) != (pixel_m * cell_px, pixel_m * cell_px):
        raise ValueError(f"the cells are {ca} x {-ce} m, not {cell_px} x {cell_px} pixels of {pixel_m} m")
    for name, v in (("cell grid x", cx), ("cell grid y", cy), ("raster x", rx), ("raster y", ry)):
        if v % pixel_m:
            raise ValueError(f"the {name} corner {v} is not on a multiple of {pixel_m} m")
    col_off, row_off = round((cx - rx) / pixel_m), round((ry - cy) / pixel_m)
    rows, cols = cell_shape[0] * cell_px, cell_shape[1] * cell_px
    if row_off < 0 or col_off < 0 or row_off + rows > raster_shape[0] or col_off + cols > raster_shape[1]:
        raise ValueError(f"the cell grid (pixels {row_off}..{row_off + rows} x {col_off}..{col_off + cols}) does not "
                         f"lie wholly inside the raster ({raster_shape[0]} x {raster_shape[1]} pixels)")
    return row_off, col_off, rows, cols


def cell_sums(red: np.ndarray, nir: np.ndarray, valid: np.ndarray,
              cell_px: int = CELL_PX) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per cell of cell_px x cell_px pixels: the number of valid pixels and the sums of the red and the NIR values
    over them, in integers. Pixel (r, c) belongs to cell (r // cell_px, c // cell_px) and to no other; the window
    must hold whole cells."""
    valid = np.asarray(valid, dtype=bool)
    rows, cols = valid.shape
    if rows % cell_px or cols % cell_px:
        raise ValueError(f"a window of {rows} x {cols} pixels does not hold whole cells of {cell_px} x {cell_px}")
    blocks = (rows // cell_px, cell_px, cols // cell_px, cell_px)
    v = valid.astype(np.int64)
    count = v.reshape(blocks).sum(axis=(1, 3))
    sum_red = (np.asarray(red, dtype=np.int64) * v).reshape(blocks).sum(axis=(1, 3))
    sum_nir = (np.asarray(nir, dtype=np.int64) * v).reshape(blocks).sum(axis=(1, 3))
    return count, sum_red, sum_nir


def has_value(count: np.ndarray, min_valid: int = MIN_VALID_PIXELS) -> np.ndarray:
    """A cell has a value on a date when at least min_valid of its pixels are valid."""
    return np.asarray(count) >= min_valid


def cell_means(count: np.ndarray, total: np.ndarray, scale: float, offset: float,
               min_valid: int = MIN_VALID_PIXELS) -> np.ndarray:
    """Mean reflectance of each cell over its valid pixels, scale * (sum of the values / count) + offset (the mean
    of the reflectances, as the conversion is linear); NaN for a cell without a value."""
    count = np.asarray(count)
    total = np.asarray(total, dtype=np.float64)
    out = np.full(count.shape, np.nan)
    ok = has_value(count, min_valid)
    out[ok] = scale * (total[ok] / count[ok]) + offset
    return out


def ndvi(nir_mean: np.ndarray, red_mean: np.ndarray) -> np.ndarray:
    """(N - R) / (N + R) of a cell's MEAN reflectances: the ratio of the means, not the mean of pixel ratios.
    NaN where either mean is NaN, or where N + R is not positive (the index is not defined there)."""
    n = np.asarray(nir_mean, dtype=np.float64)
    r = np.asarray(red_mean, dtype=np.float64)
    out = np.full(np.broadcast(n, r).shape, np.nan)
    with np.errstate(invalid="ignore"):
        ok = np.isfinite(n) & np.isfinite(r) & (n + r > 0)
    out[ok] = (n[ok] - r[ok]) / (n[ok] + r[ok])
    return out


# Steps 5 and 6: usable dates and the test's rice cells ------------------------------------------------------

def rice_cells(hh: np.ndarray, hv: np.ndarray) -> np.ndarray:
    """The test's rice cells: a rice class (1 to 5) in both bands, as in the marker test."""
    return np.isin(hh, RICE_CLASSES) & np.isin(hv, RICE_CLASSES)


def value_share(count: np.ndarray, cells: np.ndarray, min_valid: int = MIN_VALID_PIXELS) -> float:
    """The share of `cells` that have a value."""
    cells = np.asarray(cells, dtype=bool)
    if not cells.any():
        raise ValueError("no cells to take a share of")
    return float((has_value(count, min_valid) & cells).sum() / cells.sum())


def usable(share: float, min_share: float = USABLE_SHARE) -> bool:
    """A date is usable when at least min_share of the test's rice cells have a value."""
    return share >= min_share


# Step 7: NDVI by radar class -----------------------------------------------------------------------------------

def class_groups(band: np.ndarray, stable: np.ndarray) -> dict[str, np.ndarray]:
    """The cells of each group of the step 7 table for one polarization's band: classes 1 to 5, not rice, and the
    stable target's box (cells whose centres lie in it, whatever their class)."""
    band = np.asarray(band)
    groups = {str(k): band == k for k in RICE_CLASSES}
    groups["not rice"] = band == NOT_RICE
    groups["stable target box"] = np.asarray(stable, dtype=bool)
    return groups


def summary(values: np.ndarray) -> dict:
    """Number of finite values, their median and quartiles (numpy's default method); None without values."""
    v = np.asarray(values, dtype=np.float64)
    v = v[np.isfinite(v)]
    if v.size == 0:
        return {"n": 0, "median": None, "q1": None, "q3": None}
    q1, med, q3 = (float(x) for x in np.percentile(v, QUARTILES))
    return {"n": int(v.size), "median": med, "q1": q1, "q3": q3}


# Step 8: thresholds and the cut day ----------------------------------------------------------------------------

def _check_days(stack: np.ndarray, days: list[str]) -> None:
    if len(days) != len(stack):
        raise ValueError(f"{len(days)} days for {len(stack)} NDVI images")
    if list(days) != sorted(set(days)):
        raise ValueError("the days must be distinct and in ascending order")


def pooled_threshold(stack: np.ndarray, days: list[str], cells: np.ndarray,
                     from_day: str = POOLED_FROM) -> tuple[float, int]:
    """T_pooled: Otsu's threshold (pipeline.harvest.otsu_threshold, 240 bins from -0.2 to 1.0) on the NDVI of
    `cells` pooled over the usable days from from_day on. Returns (threshold, number of values pooled)."""
    _check_days(stack, days)
    pick = [i for i, d in enumerate(days) if d >= from_day]
    values = np.asarray(stack)[pick][:, np.asarray(cells, dtype=bool)].ravel() if pick else np.array([])
    values = values[np.isfinite(values)]
    return otsu_threshold(values, OTSU_RANGE, OTSU_BINS), int(values.size)


def strict_cells(hh: np.ndarray, hv: np.ndarray) -> np.ndarray:
    """Cells with harvest pair 1 or 2 in BOTH HH and HV: cut by 23 October by both."""
    return np.isin(hh, STRICT_CLASSES) & np.isin(hv, STRICT_CLASSES)


def strict_threshold(stack: np.ndarray, days: list[str], cells: np.ndarray,
                     span: tuple[str, str] = STRICT_SPAN) -> dict:
    """T_strict: the 0.75 quantile (numpy, inverted_cdf) of the NDVI of `cells` pooled over the usable days of
    `span` (both ends included). Without a usable day in the span, or without a value there: no threshold."""
    _check_days(stack, days)
    pick = [i for i, d in enumerate(days) if span[0] <= d <= span[1]]
    used = [days[i] for i in pick]
    if not pick:
        return {"threshold": None, "values": 0, "days": used,
                "reason": f"no usable date from {span[0]} to {span[1]}"}
    values = np.asarray(stack)[pick][:, np.asarray(cells, dtype=bool)].ravel()
    values = values[np.isfinite(values)]
    if values.size == 0:
        return {"threshold": None, "values": 0, "days": used,
                "reason": f"no strict cell has a value on the usable dates from {span[0]} to {span[1]}"}
    q = float(np.quantile(values, STRICT_QUANTILE, method=QUANTILE_METHOD))
    return {"threshold": q, "values": int(values.size), "days": used, "reason": None}


def first_cut(stack: np.ndarray, days: list[str], threshold: float, cut_from: str = CUT_FROM,
              green_from: str = GREEN_FROM) -> np.ndarray:
    """Per cell, the index in `days` of its cut day: the first usable day from cut_from on with NDVI below the
    threshold, after an EARLIER usable day from green_from on with NDVI at or above it; -1 for a cell never cut.
    `days` are the usable days in ascending order and stack[i] the cells' NDVI on days[i] (NaN: no value)."""
    stack = np.asarray(stack, dtype=np.float64)
    _check_days(stack, days)
    out = np.full(stack.shape[1:], -1, dtype=np.int32)
    green_before = np.zeros(stack.shape[1:], dtype=bool)
    for i, day in enumerate(days):
        if day < green_from:
            continue
        with np.errstate(invalid="ignore"):
            below, green = stack[i] < threshold, stack[i] >= threshold
        if day >= cut_from:
            out[(out < 0) & green_before & below] = i
        green_before |= green  # only after the test: the green day must come before the cut day
    return out


def cut_by(first: np.ndarray, days: list[str], day: str) -> np.ndarray:
    """Cells cut by `day`: their cut day is a usable day on or before it. No later day is looked at."""
    first = np.asarray(first)
    return (first >= 0) & (first < bisect_right(list(days), day))


def never_green_by(stack: np.ndarray, days: list[str], threshold: float, day: str,
                   green_from: str = GREEN_FROM) -> np.ndarray:
    """Cells never at or above the threshold on a usable day from green_from to `day` (also those without any
    value then): they cannot be called cut, and are counted apart."""
    stack = np.asarray(stack, dtype=np.float64)
    _check_days(stack, days)
    green = np.zeros(stack.shape[1:], dtype=bool)
    for i, d in enumerate(days):
        if green_from <= d <= day:
            with np.errstate(invalid="ignore"):
                green |= stack[i] >= threshold
    return ~green


def no_value_by(stack: np.ndarray, days: list[str], day: str, green_from: str = GREEN_FROM) -> np.ndarray:
    """Cells without a value on any usable day from green_from to `day` (a part of the never-green cells)."""
    stack = np.asarray(stack, dtype=np.float64)
    pick = [i for i, d in enumerate(days) if green_from <= d <= day]
    if not pick:
        return np.ones(stack.shape[1:], dtype=bool)
    return ~np.isfinite(stack[pick]).any(axis=0)


def days_around(day: str, usable_days: list[str]) -> tuple[str | None, str | None]:
    """The last usable day on or before `day` and the first usable day on or after it (the same day when `day` is
    usable); None where there is none."""
    ds = sorted(usable_days)
    i, j = bisect_right(ds, day), bisect_left(ds, day)
    return (ds[i - 1] if i > 0 else None), (ds[j] if j < len(ds) else None)


# Step 9: the radar's calls, agreement, bootstrap, the way back to green --------------------------------------

def harvest_pair_by(band: np.ndarray, k: int) -> np.ndarray:
    """Cells the radar gives a harvest pair ending on or before the k-th harvest pass (1-based): classes 1 to k."""
    band = np.asarray(band)
    return (band >= 1) & (band <= k)


def radar_states(band: np.ndarray, k: int, cells: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(harvested, not harvested) by the k-th harvest pass, among `cells`: a harvest pair ending on or before it;
    a later pair or no harvest seen. Fell before (5) is neither: the radar gives it no harvest pair."""
    band = np.asarray(band)
    cells = np.asarray(cells, dtype=bool)
    harvested = cells & harvest_pair_by(band, k)
    not_harvested = cells & (((band > k) & (band <= len(HARVEST_PASSES))) | (band == NO_HARVEST))
    return harvested, not_harvested


def agreement(radar_harvested: np.ndarray, radar_not: np.ndarray, optical_cut: np.ndarray,
              optical_not: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(agree, used): used = cells where both the radar and the optical series make a call (harvested or not);
    agree = used cells where both say harvested or both say not."""
    rh, rn, oc, on = (np.asarray(a, dtype=bool) for a in (radar_harvested, radar_not, optical_cut, optical_not))
    if (rh & rn).any() or (oc & on).any():
        raise ValueError("a cell cannot be both harvested and not")
    used = (rh | rn) & (oc | on)
    return used & ((rh & oc) | (rn & on)), used


def block_ids(shape: tuple[int, int], block: int = BLOCK_CELLS) -> np.ndarray:
    """The block of block x block cells each cell lies in, counted from the grid's upper left corner (edge blocks
    may be smaller)."""
    rows, cols = shape
    per_row = -(-cols // block)
    rr, cc = np.meshgrid(np.arange(rows) // block, np.arange(cols) // block, indexing="ij")
    return rr * per_row + cc


def block_bootstrap(agree: np.ndarray, used: np.ndarray, block: int = BLOCK_CELLS, replicates: int = REPLICATES,
                    seed: int = SEED) -> np.ndarray:
    """The agreement (agree / used) in each bootstrap replicate. The units are the blocks of block x block cells
    that hold at least one used cell; a replicate draws as many of them as there are, with replacement
    (numpy.random.default_rng(seed), one call integers(0, blocks, size=blocks) per replicate, blocks in order of
    their index), and counts every used cell of a block as often as the block was drawn."""
    agree, used = np.asarray(agree, dtype=bool), np.asarray(used, dtype=bool)
    if agree.shape != used.shape:
        raise ValueError(f"agree {agree.shape} and used {used.shape} differ in shape")
    if (agree & ~used).any():
        raise ValueError("a cell that agrees must be used")
    ids = block_ids(used.shape, block).ravel()
    size = int(ids.max()) + 1
    a = np.bincount(ids, weights=agree.ravel().astype(np.float64), minlength=size)
    u = np.bincount(ids, weights=used.ravel().astype(np.float64), minlength=size)
    keep = u > 0
    a, u = a[keep], u[keep]
    n = int(keep.sum())
    if n == 0:
        raise ValueError("the bootstrap needs at least one used cell")
    rng = np.random.default_rng(seed)
    out = np.empty(replicates)
    for b in range(replicates):
        counts = np.bincount(rng.integers(0, n, size=n), minlength=n)
        out[b] = float(counts @ a) / float(counts @ u)
    return out


def interval(replicates: np.ndarray) -> list[float]:
    """The 2.5th and 97.5th percentiles of the replicates."""
    return [float(v) for v in np.percentile(replicates, PERCENTILES, method=PERCENTILE_METHOD)]


def back_to_green(stack: np.ndarray, first: np.ndarray, threshold: float, cells: np.ndarray) -> dict:
    """Of `cells` (cut cells), how many are at or above the threshold again on the next usable day after their
    cut day; cells without a value on that day, and cells cut on the last usable day, are counted apart."""
    stack = np.asarray(stack, dtype=np.float64)
    first = np.asarray(first)
    cells = np.asarray(cells, dtype=bool)
    if (cells & (first < 0)).any():
        raise ValueError("every cell given must have a cut day")
    last = len(stack) - 1
    has_next = cells & (first < last)
    nxt = np.full(first.shape, np.nan)
    rr, cc = np.nonzero(has_next)
    nxt[rr, cc] = stack[first[rr, cc] + 1, rr, cc]
    with np.errstate(invalid="ignore"):
        back = has_next & (nxt >= threshold)
    no_value = has_next & ~np.isfinite(nxt)
    measured = has_next & np.isfinite(nxt)
    return {"cut_cells": int(cells.sum()), "measured": int(measured.sum()), "back_to_green": int(back.sum()),
            "share": _share(int(back.sum()), int(measured.sum())), "no_value_next_day": int(no_value.sum()),
            "cut_on_last_usable_day": int((cells & (first == last)).sum())}


def _share(part: int, whole: int) -> float | None:
    return part / whole if whole else None


# The analysis: steps 5 to 9 on the cell sums of every date ---------------------------------------------------

def day_ndvi(scene: dict) -> np.ndarray:
    """The NDVI of every cell on one date, from its cached cell sums and the scene's reflectance conversion."""
    red = cell_means(scene["count"], scene["sum_red"], scene["scale"], scene["offset"])
    nir = cell_means(scene["count"], scene["sum_nir"], scene["scale"], scene["offset"])
    return ndvi(nir, red)


def _tally(mask_cut: np.ndarray, mask_never: np.ndarray, cells: np.ndarray) -> dict:
    """Counts and shares of `cells` that are cut, not cut (green at some time, not below since), never green."""
    total = int(cells.sum())
    cut = int((cells & mask_cut).sum())
    never = int((cells & mask_never & ~mask_cut).sum())
    rest = total - cut - never
    return {"cells": total, "cut": cut, "not_cut": rest, "never_green": never, "share_cut": _share(cut, total),
            "share_not_cut": _share(rest, total), "share_never_green": _share(never, total)}


def analyse(scenes: list[dict], classes: dict[str, np.ndarray], stable: np.ndarray,
            radar_by_pass: dict[str, dict[str, float]]) -> dict:
    """Steps 5 to 9 from the scenes (one per date, ascending, each with its cell sums) and the class raster's
    bands. radar_by_pass[pol][pass] is harvest.json's share of the rice cells with a harvest pair by that pass."""
    hh, hv = classes["HH"], classes["HV"]
    rice = rice_cells(hh, hv)
    n_rice = int(rice.sum())
    days_all = [s["day"] for s in scenes]
    if days_all != sorted(set(days_all)):
        raise ValueError("one scene per date, in ascending order")

    # Step 5: every date with its share; the usable ones.
    dates = []
    for s in scenes:
        share = value_share(s["count"], rice)
        values = day_ndvi(s)
        dates.append({"day": s["day"], "items": s["items"], "share_rice_with_value": share, "usable": usable(share),
                      "cells_with_value": int(has_value(s["count"]).sum()),
                      "cells_with_value_but_no_ndvi": int((has_value(s["count"]) & ~np.isfinite(values)).sum())})
    usable_idx = [i for i, d in enumerate(dates) if d["usable"]]
    days = [days_all[i] for i in usable_idx]
    stack = (np.stack([day_ndvi(scenes[i]) for i in usable_idx]) if usable_idx
             else np.empty((0,) + rice.shape))

    # Step 7: NDVI by radar class and date.
    by_class = {}
    for pol in POLARIZATIONS:
        groups = class_groups(classes[pol], stable)
        by_class[pol] = {day: {g: summary(stack[i][m]) for g, m in groups.items()} for i, day in enumerate(days)}
    group_cells = {pol: {g: int(m.sum()) for g, m in class_groups(classes[pol], stable).items()}
                   for pol in POLARIZATIONS}

    # Step 8: thresholds, the days around each pass.
    thresholds = {}
    if days:
        t, n = pooled_threshold(stack, days, rice)
        thresholds["T_pooled"] = {"threshold": t, "values": n,
                                  "days": [d for d in days if d >= POOLED_FROM], "reason": None}
    else:
        thresholds["T_pooled"] = {"threshold": None, "values": 0, "days": [], "reason": "no usable date"}
    strict = strict_cells(hh, hv)
    thresholds["T_strict"] = strict_threshold(stack, days, strict)
    thresholds["T_strict"]["cells"] = int(strict.sum())
    around = {}
    for p in HARVEST_PASSES:
        before, after = days_around(p, days)
        around[p] = {"on_or_before": before, "on_or_after": after}
    last_day = days[-1] if days else None

    # Step 9: the tables, for each threshold and both days of each pass.
    tables = {}
    for name, th in thresholds.items():
        t = th["threshold"]
        if t is None:
            tables[name] = None
            continue
        first = first_cut(stack, days, t)

        def state(day, t=t, first=first):
            return cut_by(first, days, day), never_green_by(stack, days, t, day)

        rows_a, rows_c, rows_d, rows_e = [], [], [], []
        for k, p in enumerate(HARVEST_PASSES, start=1):
            for side in ("on_or_before", "on_or_after"):
                day = around[p][side]
                if day is None:  # no usable date on this side of the pass: every table says so
                    rows_a.append({"pass": p, "side": side, "day": None})
                    rows_d += [{"pass": p, "side": side, "day": None, "polarization": pol} for pol in POLARIZATIONS]
                    rows_e.append({"pass": p, "side": side, "day": None})
                    if side == "on_or_after":
                        rows_c += [{"pass": p, "day": None, "polarization": pol, "class": k} for pol in POLARIZATIONS]
                    continue
                cut, never = state(day)
                tally = _tally(cut, never, rice)
                tally["no_value_at_all"] = int((rice & no_value_by(stack, days, day)).sum())
                rows_a.append({"pass": p, "side": side, "day": day, **tally,
                               "radar_share_harvest_pair_by_pass": {pol: radar_by_pass[pol][p]
                                                                    for pol in POLARIZATIONS},
                               "official": OFFICIAL[p]})
                optical_cut = rice & cut
                optical_not = rice & ~cut & ~never
                for pol in POLARIZATIONS:
                    rh, rn = radar_states(classes[pol], k, rice)
                    agree, used = agreement(rh, rn, optical_cut, optical_not)
                    reps = block_bootstrap(agree, used)
                    rows_d.append({"pass": p, "side": side, "day": day, "polarization": pol,
                                   "cells_used": int(used.sum()), "cells_agree": int(agree.sum()),
                                   "agreement": _share(int(agree.sum()), int(used.sum())),
                                   "interval_95": interval(reps),
                                   "left_out_fell_before": int((rice & (classes[pol] == FELL_BEFORE)).sum()),
                                   "left_out_never_green": int((rice & never & ~cut).sum()),
                                   "both_say_harvested": int((rh & optical_cut).sum()),
                                   "both_say_not": int((rn & optical_not).sum()),
                                   "radar_harvested_optical_not": int((rh & optical_not).sum()),
                                   "radar_not_optical_cut": int((rn & optical_cut).sum())})
                rows_e.append({"pass": p, "side": side, "day": day,
                               **back_to_green(stack, first, t, rice & cut)})
                if side == "on_or_after":
                    for pol in POLARIZATIONS:
                        ending = rice & (classes[pol] == k)
                        rows_c.append({"pass": p, "day": day, "polarization": pol, "class": k,
                                       **_tally(cut, never, ending)})
        rows_b = []
        p4 = HARVEST_PASSES[-1]
        for pol in POLARIZATIONS:
            no_harvest = rice & (classes[pol] == NO_HARVEST)
            for label, day in (("on_or_before " + p4, around[p4]["on_or_before"]),
                               ("on_or_after " + p4, around[p4]["on_or_after"]),
                               ("last usable date", last_day)):
                if day is None:
                    rows_b.append({"polarization": pol, "day_kind": label, "day": None})
                    continue
                cut, never = state(day)
                rows_b.append({"polarization": pol, "day_kind": label, "day": day, **_tally(cut, never, no_harvest)})
        first_days = [days[i] for i in first[rice & (first >= 0)]]
        tables[name] = {"no_harvest_seen": rows_b, "cut_share_by_pass": rows_a, "pair_ending_on_pass": rows_c,
                        "agreement": rows_d, "back_to_green": rows_e,
                        "cut_day_counts": {d: first_days.count(d) for d in days if d >= CUT_FROM}}

    return {"dates": dates, "usable_days": days, "rice_cells": n_rice, "group_cells": group_cells,
            "ndvi_by_class": by_class, "thresholds": thresholds, "pass_days": around, "last_usable_day": last_day,
            "tables": tables}


# Catalog -------------------------------------------------------------------------------------------------------

def _ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    try:  # the operating system's certificates, plus certifi's list when the pipeline has installed it
        import certifi
        context.load_verify_locations(cafile=certifi.where())
    except ImportError:
        pass
    return context


def _request(url: str, body: dict | None = None, timeout: float = 60) -> bytes:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": "python-urllib", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as r:
        return r.read()


def search(bbox: tuple[float, float, float, float], first: str = FIRST_DAY, last: str = LAST_DAY) -> list[dict]:
    """Every item of the collection over the box from the first to the last day (UTC, both included), following
    the catalog's next links. Nothing but the box and the dates goes into the request."""
    body = {"collections": [COLLECTION], "bbox": list(bbox), "datetime": f"{first}T00:00:00Z/{last}T23:59:59Z",
            "limit": 100}
    url, items = f"{STAC_URL}/search", []
    for _ in range(50):
        doc = json.loads(_request(url, body))
        items.extend(doc.get("features", []))
        nxt = next((ln for ln in doc.get("links", []) if ln.get("rel") == "next"), None)
        if nxt is None or not doc.get("features"):
            break
        url, body = nxt["href"], nxt.get("body", body)
    seen = {}
    for item in items:
        seen.setdefault(item["id"], item)
    return list(seen.values())


def item_day(item: dict) -> str:
    """The UTC date of the scene (Sentinel-2 passes here at about 05:50 UTC, the same date in India)."""
    return item["properties"]["datetime"][:10]


def item_tile(item: dict) -> str:
    p = item["properties"]
    return f"{p['mgrs:utm_zone']}{p['mgrs:latitude_band']}{p['mgrs:grid_square']}"


def granules_by_day(items: list[dict], tile: str = TILE, first: str = FIRST_DAY,
                    last: str = LAST_DAY) -> tuple[dict[str, list[dict]], list[str]]:
    """The items of `tile` per date from first to last, each date's granules in order of preference (fewest
    nodata pixels first, then by id), and the ids of the items left out (another tile, or outside the dates)."""
    days, left_out = {}, []
    for item in items:
        day = item_day(item)
        if item_tile(item) != tile or not first <= day <= last:
            left_out.append(item["id"])
            continue
        days.setdefault(day, []).append(item)
    for day in days:
        days[day].sort(key=lambda it: (float(it["properties"].get("s2:nodata_pixel_percentage", 100.0)), it["id"]))
    return dict(sorted(days.items())), sorted(left_out)


DATASTRIP_START = re.compile(r"_S(\d{8}T\d{6})_")  # the sensing start in an s2:datastrip_id


def split_granules(items: list[dict]) -> dict:
    """Check the reading behind the mosaic: the granules of one tile and date are datastrips of ONE datatake, not
    copies of one granule. They must share s2:datatake_id (which names the processing baseline too), and have
    distinct s2:datastrip_id values with distinct sensing starts: a reprocessed copy of a granule would have a new
    datastrip id but the same sensing start. Raises otherwise. Returns the datatake and the datastrips, in the
    items' order, for results.json."""
    if not items:
        raise ValueError("no granule")
    day = item_day(items[0])
    ids = [it["id"] for it in items]
    takes = [it["properties"].get("s2:datatake_id") for it in items]
    strips = [it["properties"].get("s2:datastrip_id") for it in items]
    if None in takes or None in strips:
        raise ValueError(f"{day}: {ids} lack s2:datatake_id or s2:datastrip_id; cannot tell what they are")
    if len(set(takes)) != 1:
        raise ValueError(f"{day}: the granules {ids} come from different datatakes {takes}; they are not one tile "
                         "split into datastrips")
    if len(items) > 1:
        starts = [DATASTRIP_START.search(s) for s in strips]
        if None in starts:
            raise ValueError(f"{day}: no sensing start in the datastrip ids {strips}")
        if len(set(strips)) != len(strips) or len({m.group(1) for m in starts}) != len(starts):
            raise ValueError(f"{day}: the granules {ids} share a datastrip or its sensing start ({strips}): a "
                             "reprocessed copy, not a split granule")
    return {"datatake_id": takes[0], "datastrip_ids": strips}


def _baseline(item: dict) -> float:
    return float(item["properties"]["s2:processing_baseline"])


def reflectance_params(item: dict, asset: str) -> tuple[float, float]:
    """(scale, offset) with surface reflectance = DN * scale + offset.

    From processing baseline 04.00 on, ESA stores Level-2A values with an offset of +1000 (BOA_ADD_OFFSET -1000).
    The catalog's property earthsearch:boa_offset_applied says whether its files have had it removed already. The
    access probe (README.md) found it true on every item of this site, and the probe scene's values free of the
    offset (red median 402 over a scene of 78 % vegetation pixels, red 1st percentile 83), so where it is true
    reflectance = DN * 1e-4 and the -0.1 that the asset's raster:bands also lists is NOT applied (it would remove the
    offset a second time). Where it is false on such a baseline the offset is still in the values: DN * 1e-4 - 0.1.
    Older baselines carry no offset. A missing property on a newer baseline stops the run rather than guess."""
    band = item["assets"][asset]["raster:bands"][0]
    scale = float(band.get("scale", REFLECTANCE_SCALE))
    if not math.isclose(scale, REFLECTANCE_SCALE):
        raise ValueError(f"{item['id']} {asset}: scale {scale}, expected {REFLECTANCE_SCALE}")
    flag = item["properties"].get("earthsearch:boa_offset_applied")
    if _baseline(item) < 4.0 or flag is True:
        return scale, 0.0
    if flag is False:
        return scale, BOA_OFFSET
    raise ValueError(f"{item['id']}: processing baseline {_baseline(item):05.2f} and earthsearch:boa_offset_applied "
                     f"{flag!r}: cannot tell whether the values still hold the offset")


def below_offset_share(red: np.ndarray, nir: np.ndarray) -> float | None:
    """Share of the pixels with data in both bands whose red value lies below OFFSET_DN: a check of the conversion.
    If the offset were still in the values, such a pixel would have a negative reflectance, so the share would be
    near 0; with the offset removed, dark ground and green vegetation put many red values there."""
    data = (np.asarray(red) != NODATA_DN) & (np.asarray(nir) != NODATA_DN)
    n = int(data.sum())
    return float((np.asarray(red)[data] < OFFSET_DN).sum() / n) if n else None


def vegetation_below_offset(red: np.ndarray, nir: np.ndarray, scl: np.ndarray) -> tuple[float | None, int]:
    """(share, number) of the vegetation pixels (SCL OFFSET_CHECK_SCL, data in both bands) whose red value lies below
    OFFSET_DN. Clouds and bare ground, whose red is high either way, are not in it."""
    red = np.asarray(red)
    veg = (red != NODATA_DN) & (np.asarray(nir) != NODATA_DN) & (np.asarray(scl) == OFFSET_CHECK_SCL)
    n = int(veg.sum())
    return (float((red[veg] < OFFSET_DN).sum() / n) if n else None), n


def offset_check(offset: float, share: float | None, pixels: int) -> str:
    """The guard on the conversion of one scene. Where its values are taken as offset-free (offset 0), at least
    OFFSET_CHECK_MIN_SHARE of its vegetation pixels must have a red value below OFFSET_DN; under that the values
    still hold the offset and the run stops (ValueError). Returns what was found."""
    if offset != 0.0:
        return f"not checked: the conversion removes the offset ({offset})"
    if share is None or pixels < OFFSET_CHECK_MIN_PIXELS:
        return f"not checked: {pixels} vegetation pixels, under {OFFSET_CHECK_MIN_PIXELS}"
    if share < OFFSET_CHECK_MIN_SHARE:
        raise ValueError(f"only {share:.2%} of {pixels} vegetation pixels have a red value below {OFFSET_DN}: the "
                         "values still hold the reflectance offset, but the conversion takes them as free of it")
    return f"passed: {share:.1%} of {pixels} vegetation pixels below {OFFSET_DN}"


# Windowed reads and the cache ----------------------------------------------------------------------------------

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "2",
    "VSI_CACHE": "TRUE",
}


def _env():
    import rasterio
    return rasterio.Env(**GDAL_ENV)


def _block_bytes(src, row_off: int, col_off: int, rows: int, cols: int) -> int | None:
    """Compressed bytes of the image blocks a window touches (from the TIFF's block table), or None."""
    bh, bw = src.block_shapes[0]
    total = 0
    for by in range(row_off // bh, (row_off + rows - 1) // bh + 1):
        for bx in range(col_off // bw, (col_off + cols - 1) // bw + 1):
            v = src.get_tag_item(f"BLOCK_SIZE_{bx}_{by}", "TIFF", bidx=1)
            if v is None:
                return None
            total += int(v)
    return total


def read_granule(item: dict, cell_transform, cell_shape: tuple[int, int]) -> dict:
    """Read the window of the cell grid from the granule's red, nir and scl files over https: the 10 m bands
    directly, SCL from the 20 m pixels that cover the window, each repeated over its 2 x 2 pixels of 10 m."""
    import rasterio
    from rasterio.windows import Window

    out = {"id": item["id"], "seconds": {}, "bytes": {}, "files": {}}
    for asset in ASSETS:
        href = item["assets"][asset]["href"]
        t0 = time.perf_counter()
        with rasterio.open(f"/vsicurl/{href}") as src:
            if src.crs.to_string() != CRS:
                raise ValueError(f"{href} is in {src.crs}, not {CRS}")
            if src.nodata is not None and src.nodata != NODATA_DN:
                raise ValueError(f"{href} has nodata {src.nodata}, not {NODATA_DN}")
            info = {"transform": list(src.transform)[:6], "shape": [src.height, src.width],
                    "dtype": src.dtypes[0], "block": list(src.block_shapes[0]), "nodata": src.nodata,
                    "gdal_scale": src.scales[0], "gdal_offset": src.offsets[0]}
            if asset == "scl":
                fine = out["files"]["red"]
                if list(src.transform)[:6] != [PIXEL_M * SCL_FACTOR, 0.0, fine["transform"][2], 0.0,
                                               -PIXEL_M * SCL_FACTOR, fine["transform"][5]]:
                    raise ValueError(f"{href}: the SCL grid {list(src.transform)[:6]} is not the 10 m grid's corner "
                                     "with 20 m pixels")
                r0, c0, nr, nc, sr, sc = coarse_window(*out["window"])
                coarse = src.read(1, window=Window(c0, r0, nc, nr))
                out["scl"] = to_fine(coarse, sr, sc, out["window"][2], out["window"][3])
                out["bytes"][asset] = _block_bytes(src, r0, c0, nr, nc)
                info["window"] = [r0, c0, nr, nc, sr, sc]
            else:
                window = grid_window(cell_transform, cell_shape, src.transform, (src.height, src.width))
                if "window" in out and out["window"] != window:
                    raise ValueError(f"{href}: window {window} differs from the red band's {out['window']}")
                out["window"] = window
                r0, c0, nr, nc = window
                out[asset] = src.read(1, window=Window(c0, r0, nc, nr))
                out["bytes"][asset] = _block_bytes(src, r0, c0, nr, nc)
                info["window"] = list(window)
        out["seconds"][asset] = time.perf_counter() - t0
        out["files"][asset] = info
    if out["files"]["red"]["transform"] != out["files"]["nir"]["transform"]:
        raise ValueError(f"{item['id']}: red and nir lie on different grids")
    return out


# Raise it when a change to the reading or the cell sums makes the cached sums stale. 2: the cache's metadata holds
# the vegetation pixels' offset check (no cache of version 1 was ever made from a full run).
READER_VERSION = 2


def _grid_key(cell_transform, cell_shape) -> str:
    text = json.dumps([READER_VERSION, list(cell_transform)[:6], list(cell_shape), CELL_PX, MIN_VALID_PIXELS,
                       VALID_SCL])
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def scene_cache_path(items: list[dict]) -> Path:
    return WORK / "scenes" / ("+".join(it["id"] for it in items) + ".npz")


def load_or_read_scene(day: str, items: list[dict], cell_transform, cell_shape) -> dict:
    """The cell sums of one date: from the cache under work/optical/scenes/ when it was made for the same granules
    and the same grid, otherwise read over https (the granules mosaicked in order of preference) and cached."""
    path = scene_cache_path(items)
    key = _grid_key(cell_transform, cell_shape)
    params = {reflectance_params(it, a) for it in items for a in ("red", "nir")}
    if len(params) != 1:
        raise ValueError(f"{day}: the granules convert to reflectance differently: {params}")
    scale, offset = params.pop()
    if path.exists():
        with np.load(path, allow_pickle=False) as z:
            meta = json.loads(str(z["meta"]))
            if meta["grid_key"] == key:
                return {"day": day, "items": [it["id"] for it in items], "count": z["count"], "sum_red": z["sum_red"],
                        "sum_nir": z["sum_nir"], "scale": scale, "offset": offset, "meta": meta, "cached": True}
    t0 = time.perf_counter()
    with _env():
        granules = [read_granule(it, cell_transform, cell_shape) for it in items]
    seconds = time.perf_counter() - t0
    red, nir, scl, source = mosaic([(g["red"], g["nir"], g["scl"]) for g in granules])
    valid = valid_pixels(red, nir, scl)
    count, sum_red, sum_nir = cell_sums(red, nir, valid)
    codes, counts = np.unique(scl[source >= 0], return_counts=True)
    veg_share, veg_pixels = vegetation_below_offset(red, nir, scl)
    byte_list = [b for g in granules for b in g["bytes"].values()]
    meta = {"grid_key": key, "day": day, "items": [it["id"] for it in items], "seconds": seconds,
            "bytes": None if None in byte_list else int(sum(byte_list)),
            "pixels": int(source.size), "pixels_from_each": [int((source == i).sum()) for i in range(len(items))],
            "pixels_without_data": int((source < 0).sum()), "valid_pixels": int(valid.sum()),
            "scl_codes": {int(c): int(n) for c, n in zip(codes, counts, strict=True)},
            "scale": scale, "offset": offset, "red_below_offset_share": below_offset_share(red, nir),
            "vegetation_red_below_offset_share": veg_share, "vegetation_pixels": veg_pixels,
            "raster_bands_offset": sorted({it["assets"][a]["raster:bands"][0].get("offset") for it in items
                                           for a in ("red", "nir")}),
            "boa_offset_applied": sorted({str(it["properties"].get("earthsearch:boa_offset_applied")) for it in items}),
            "read_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
            "processing_baseline": sorted({it["properties"]["s2:processing_baseline"] for it in items}),
            "files": [g["files"] for g in granules]}
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".partial.npz")
    np.savez_compressed(partial, count=count.astype(np.uint8), sum_red=sum_red.astype(np.int32),
                        sum_nir=sum_nir.astype(np.int32), meta=np.array(json.dumps(meta)))
    partial.replace(path)
    return {"day": day, "items": meta["items"], "count": count, "sum_red": sum_red, "sum_nir": sum_nir,
            "scale": scale, "offset": offset, "meta": meta, "cached": False}


SCENE_META_KEYS = ("processing_baseline", "boa_offset_applied", "raster_bands_offset", "red_below_offset_share",
                   "vegetation_red_below_offset_share", "vegetation_pixels", "pixels_from_each",
                   "pixels_without_data", "valid_pixels", "scl_codes", "seconds", "bytes", "read_at")


def scene_record(scene: dict, items: list[dict]) -> dict:
    """The entry of one date in results.json: its granules (with their datatake and datastrips), the conversion
    applied and the evidence for it, and what the read gave. Runs the two guards: split_granules and offset_check
    (each stops the run when it fails)."""
    meta = scene["meta"]
    if meta["items"] != [it["id"] for it in items]:
        raise ValueError(f"{scene['day']}: the cached granules {meta['items']} are not the catalog's")
    return {"day": scene["day"], "items": scene["items"], **split_granules(items), "scale": scene["scale"],
            "offset": scene["offset"],
            "offset_check": offset_check(scene["offset"], meta["vegetation_red_below_offset_share"],
                                         meta["vegetation_pixels"]),
            **{k: meta[k] for k in SCENE_META_KEYS}}


# Inputs --------------------------------------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_inputs() -> dict:
    """The class raster, harvest.json and the site file, with the checks that tie them together."""
    import rasterio
    from affine import Affine

    harvest = json.loads((INPUTS / "harvest.json").read_text(encoding="utf-8"))
    with rasterio.open(INPUTS / "harvest_classes.tif") as src:
        hh, hv = src.read(1), src.read(2)
        transform, shape, crs = src.transform, (src.height, src.width), src.crs.to_string()
    grid = harvest["grid"]
    if crs != CRS or crs != grid["crs"]:
        raise ValueError(f"the class raster is in {crs}; harvest.json says {grid['crs']}; expected {CRS}")
    if list(transform)[:6] != grid["transform"] or list(shape) != grid["shape"]:
        raise ValueError("the class raster's grid is not harvest.json's")
    if harvest["raster"]["bands"] != list(POLARIZATIONS):
        raise ValueError(f"the class raster's bands are {harvest['raster']['bands']}, not {POLARIZATIONS}")
    passes = harvest["settings"]["passes"]
    if tuple(passes[2:]) != HARVEST_PASSES:
        raise ValueError(f"harvest.json's harvest passes {passes[2:]} are not the brief's {HARVEST_PASSES}")
    site = load_site(SITE)
    stable_box = site.stable_target.bbox
    if [list(b) for b in harvest["settings"]["stable_boxes"]] != [list(stable_box)]:
        raise ValueError("the stable target's box in the site file is not harvest.json's")
    stable, wheres = cells_in_boxes([stable_box], crs, Affine(*grid["transform"]), shape)
    if int(stable.sum()) != harvest["stable"]["cells_in_boxes"]:
        raise ValueError(f"{int(stable.sum())} cells in the stable box, harvest.json says "
                         f"{harvest['stable']['cells_in_boxes']}")
    classes = {"HH": hh, "HV": hv}
    rice = rice_cells(hh, hv)
    radar = {}
    for pol in POLARIZATIONS:
        cumulative = harvest["polarizations"][pol]["cumulative"]
        by_pass = cumulative["by_pass"]
        if cumulative["counted_cells"] != int(rice.sum()):
            raise ValueError(f"{pol}: harvest.json counts {cumulative['counted_cells']} rice cells, the class raster "
                             f"{int(rice.sum())}")
        radar[pol] = {}
        for k, entry in enumerate(by_pass, start=1):
            if entry["cells"] != int((rice & harvest_pair_by(classes[pol], k)).sum()):
                raise ValueError(f"{pol}: harvest.json's cells by {entry['date']} differ from the class raster's")
            radar[pol][entry["date"]] = entry["share"]
    return {"classes": classes, "transform": transform, "shape": shape, "stable": stable, "stable_where": wheres,
            "stable_box": list(stable_box), "site_box": list(site.bbox), "radar_by_pass": radar,
            "harvest_passes_all": passes,
            "sha256": {name: _sha256(INPUTS / name) for name in ("harvest_classes.tif", "harvest.json",
                                                                 "marker.json")}}


# Report --------------------------------------------------------------------------------------------------------

READING_START, READING_END = "<!-- reading:start -->", "<!-- reading:end -->"
READING_PLACEHOLDER = ("_Not written yet. After the run: at most ten lines, written as hypotheses, marked as "
                       "AI-written._")


def _pct(x: float | None, digits: int = 1) -> str:
    return "n/a" if x is None else f"{100 * x:.{digits}f} %"


def _side(text: str) -> str:
    return text.replace("_", " ")


def _num(x: float | None, digits: int = 3) -> str:
    return "n/a" if x is None else f"{x:.{digits}f}"


def settings() -> dict:
    return {"stac_url": STAC_URL, "collection": COLLECTION, "first_day": FIRST_DAY, "last_day": LAST_DAY,
            "tile": TILE, "assets": list(ASSETS),
            "reflectance": {
                "rule": ("reflectance = DN * 0.0001, minus 0.1 only where earthsearch:boa_offset_applied is false on "
                         "a processing baseline of 04.00 or later; the offset -0.1 that the assets' raster:bands list "
                         "is not used (where the catalog says the offset is already removed it would remove it twice)"),
                "scale": REFLECTANCE_SCALE, "offset_where_boa_offset_applied_true": 0.0,
                "offset_where_boa_offset_applied_false_from_baseline_04_00": BOA_OFFSET,
                "offset_before_baseline_04_00": 0.0, "raster_bands_offset_used": False},
            "offset_check": {"scl": OFFSET_CHECK_SCL, "red_dn_below": OFFSET_DN,
                             "min_pixels": OFFSET_CHECK_MIN_PIXELS, "min_share": OFFSET_CHECK_MIN_SHARE,
                             "rule": ("a guard, not a definition: a scene taken as offset-free stops the run when "
                                      "under min_share of its vegetation pixels have a red value below red_dn_below; "
                                      "not checked with fewer than min_pixels vegetation pixels")},
            "split_granules": ("the granules of one tile and date are mosaicked only when they share s2:datatake_id "
                               "and have distinct s2:datastrip_id values with distinct sensing starts; otherwise "
                               "the run stops"),
            "valid_scl": list(VALID_SCL), "dropped_scl": list(DROPPED_SCL), "cell_px": CELL_PX,
            "min_valid_pixels": MIN_VALID_PIXELS, "usable_share": USABLE_SHARE, "rice_classes": list(RICE_CLASSES),
            "quartiles": "numpy.percentile 25/50/75, default method (linear)",
            "harvest_passes": list(HARVEST_PASSES), "pooled_from": POOLED_FROM,
            "otsu": {"range": list(OTSU_RANGE), "bins": OTSU_BINS, "function": "pipeline.harvest.otsu_threshold"},
            "strict": {"classes_in_both": list(STRICT_CLASSES), "span": list(STRICT_SPAN),
                       "quantile": STRICT_QUANTILE, "method": QUANTILE_METHOD},
            "cut": {"green_from": GREEN_FROM, "cut_from": CUT_FROM},
            "bootstrap": {"block_cells": BLOCK_CELLS, "replicates": REPLICATES, "seed": SEED,
                          "percentiles": list(PERCENTILES), "percentile_method": PERCENTILE_METHOD,
                          "rng": f"numpy.random.default_rng({SEED}), a fresh generator for each interval"}}


def results_markdown(res: dict, reading: str | None = None) -> str:
    """RESULTS.md: the dates, the tables, the reading (kept from an earlier file) and the limits."""
    a = res["analysis"]
    out = ["# Optical cross-check of the harvest map: results", "",
           f"**AI-written.** Made by `optical_check.py run` at {res['run_at']}; the code is AI-written "
           "(Claude Opus 5.5, Anthropic). A comparison made after the fact; not for "
           "the public site. The method is in `README.md`, fixed before the run. Every number is in "
           "`results.json`.", "",
           "Contains modified Copernicus Sentinel data 2026 (Sentinel-2 Level-2A, read from the Earth Search "
           "catalog by Element 84).", "",
           "## Dates (step 5)", "",
           f"Scenes of tile {TILE} from {FIRST_DAY} to {LAST_DAY}; a date is usable when at least "
           f"{USABLE_SHARE * 100:.0f} % of the test's {a['rice_cells']:,} rice cells have a value.", "",
           "| Date | Scene(s) | Rice cells with a value | Usable |", "|---|---|---|---|"]
    for d in a["dates"]:
        out.append(f"| {d['day']} | {', '.join(d['items'])} | {_pct(d['share_rice_with_value'])} | "
                   f"{'yes' if d['usable'] else 'no'} |")
    out += ["", f"Usable dates: {', '.join(a['usable_days']) or 'none'}.", "",
            "## NDVI by radar class and date (step 7)", "",
            "Median [quartiles] (number of cells with a value) of the cell NDVI. Classes: 1, 2, 3 = harvest pair "
            "ending 2026-10-11, 2026-10-23, 2026-11-04; 4 = no harvest seen by 2026-11-04; 5 = fell before "
            "2026-09-29. The stable target's box holds every cell whose centre lies in it.", ""]
    for pol in ("HV", "HH"):
        cells = a["group_cells"][pol]
        out += [f"### {pol}", "", "| Date | " + " | ".join(f"{g} ({cells[g]:,} cells)" for g in GROUPS) + " |",
                "|---|" + "---|" * len(GROUPS)]
        for day, groups in a["ndvi_by_class"][pol].items():
            row = []
            for g in GROUPS:
                s = groups[g]
                row.append("n/a (0)" if s["n"] == 0 else
                           f"{_num(s['median'], 2)} [{_num(s['q1'], 2)}, {_num(s['q3'], 2)}] ({s['n']:,})")
            out.append(f"| {day} | " + " | ".join(row) + " |")
        out.append("")
    out += ["![Median NDVI of the HV classes over time](ndvi_by_class.png)", "",
            "_Figure drawn by code (`optical_check.py`) from the numbers in `results.json`._", "",
            "## Thresholds and the days around each pass (step 8)", ""]
    for name, th in a["thresholds"].items():
        if th["threshold"] is None:
            out.append(f"- **{name}**: no result ({th['reason']}).")
        else:
            out.append(f"- **{name}** = {th['threshold']:.4f}, from {th['values']:,} cell values on "
                       f"{len(th['days'])} usable dates ({', '.join(th['days'])}).")
    out += ["- Caveat: ripening rice loses green before it is cut, so T_pooled calls some standing, ripe rice "
            "\"cut\".", ""]
    out += ["| Radar pass | Last usable date on or before | First usable date on or after |", "|---|---|---|"]
    for p, ds in a["pass_days"].items():
        out.append(f"| {p} | {ds['on_or_before'] or 'none'} | {ds['on_or_after'] or 'none'} |")
    out += ["", f"Last usable date of the series: {a['last_usable_day'] or 'none'}.", "",
            "## Tables (step 9)", ""]
    for name, tab in a["tables"].items():
        out += [f"### {name}", ""]
        if tab is None:
            out += [f"No {name} result: {a['thresholds'][name]['reason']}.", ""]
            continue
        out += ["**Cells each polarization calls \"no harvest seen by 4 November\" (class 4): share cut.**", "",
                "| Polarization | Day | Date | Cells | Cut | Not cut | Never green |", "|---|---|---|---|---|---|---|"]
        for r in tab["no_harvest_seen"]:
            if r["day"] is None:
                out.append(f"| {r['polarization']} | {_side(r['day_kind'])} | none | | | | |")
                continue
            out.append(f"| {r['polarization']} | {_side(r['day_kind'])} | {r['day']} | {r['cells']:,} | "
                       f"{_pct(r['share_cut'])} | {_pct(r['share_not_cut'])} | {_pct(r['share_never_green'])} |")
        out += ["", "**Share of the test's rice cells cut by each day, beside the radar and the official figures.**",
                "", "| Pass | Day | Date | Optical: cut | Never green | Radar HH: pair by pass "
                "| Radar HV: pair by pass | Official figures |", "|---|---|---|---|---|---|---|---|"]
        for r in tab["cut_share_by_pass"]:
            if r["day"] is None:
                out.append(f"| {r['pass']} | {_side(r['side'])} | none | | | | | |")
                continue
            rad = r["radar_share_harvest_pair_by_pass"]
            out.append(f"| {r['pass']} | {_side(r['side'])} | {r['day']} | {_pct(r['share_cut'])} | "
                       f"{_pct(r['share_never_green'])} | {_pct(rad['HH'])} | {_pct(rad['HV'])} | {r['official']} |")
        out += ["", "**Cells given a harvest pair ending on the pass: share cut by the first usable date on or after "
                "it.**", "", "| Pass | Date | Polarization | Cells | Cut | Still not cut | Never green |",
                "|---|---|---|---|---|---|---|"]
        for r in tab["pair_ending_on_pass"]:
            if r["day"] is None:
                out.append(f"| {r['pass']} | none | {r['polarization']} | | | | |")
                continue
            out.append(f"| {r['pass']} | {r['day']} | {r['polarization']} | {r['cells']:,} | {_pct(r['share_cut'])} | "
                       f"{_pct(r['share_not_cut'])} | {_pct(r['share_never_green'])} |")
        out += ["", "**Agreement with the optical state** (cells where both say harvested or both say not; 95 % "
                f"interval from a block bootstrap, blocks of {BLOCK_CELLS} x {BLOCK_CELLS} cells, {REPLICATES} "
                f"replicates, seed {SEED}). Left out: cells that fell before 29 September (no harvest pair) and "
                "never-green cells.", "",
                "| Pass | Day | Date | Polarization | Agreement | 95 % interval | Cells used |",
                "|---|---|---|---|---|---|---|"]
        for r in tab["agreement"]:
            if r["day"] is None:
                out.append(f"| {r['pass']} | {_side(r['side'])} | none | {r['polarization']} | | | |")
                continue
            lo, hi = r["interval_95"]
            out.append(f"| {r['pass']} | {_side(r['side'])} | {r['day']} | {r['polarization']} | "
                       f"{_pct(r['agreement'])} | "
                       f"{_pct(lo)} to {_pct(hi)} | {r['cells_used']:,} |")
        out += ["", "**Cut cells at or above the threshold again on the next usable date.**", "",
                "| Pass | Day | Date | Cut cells | Measured | Back to green | Share |", "|---|---|---|---|---|---|---|"]
        for r in tab["back_to_green"]:
            if r["day"] is None:
                out.append(f"| {r['pass']} | {_side(r['side'])} | none | | | | |")
                continue
            out.append(f"| {r['pass']} | {_side(r['side'])} | {r['day']} | {r['cut_cells']:,} | {r['measured']:,} | "
                       f"{r['back_to_green']:,} | {_pct(r['share'])} |")
        out.append("")
    out += ["## Reading (AI-written, hypotheses only)", "", READING_START,
            (reading or READING_PLACEHOLDER).strip(), READING_END, "",
            "## What this cannot do (step 10)", ""]
    out += [f"- {line}" for line in LIMITS]
    out.append("")
    return "\n".join(out)


def kept_reading(path: Path) -> str | None:
    """The reading written into an earlier RESULTS.md, so that a re-run keeps it."""
    if not path.exists():
        return None
    m = re.search(re.escape(READING_START) + r"(.*?)" + re.escape(READING_END), path.read_text(encoding="utf-8"),
                  flags=re.S)
    text = m.group(1).strip() if m else None
    return None if not text or text == READING_PLACEHOLDER else text


def draw_figure(res: dict, path: Path) -> None:
    """The median NDVI of each HV class on the usable dates, the radar passes marked; drawn from results.json."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    from matplotlib import patheffects

    a = res["analysis"]
    days = a["usable_days"]
    x = [dt.date.fromisoformat(d) for d in days]
    colours = dict(zip(("1", "2", "3"), harvest_colours(3), strict=True))
    colours.update({"4": NO_HARVEST_COLOUR, "5": FELL_BEFORE_COLOUR})
    markers = {"1": "o", "2": "s", "3": "D", "4": "^", "5": "v"}
    fig, ax = plt.subplots(figsize=(10, 7), dpi=150)
    fig.patch.set_facecolor("#fcfcfb")
    ax.set_facecolor("#fcfcfb")
    for p in res["inputs"]["harvest_passes_all"]:
        ax.axvline(dt.date.fromisoformat(p), color="#9a9a9a", lw=0.8, ls=(0, (4, 3)), zorder=1)
        ax.text(dt.date.fromisoformat(p), 1.005, p[5:], transform=ax.get_xaxis_transform(), ha="center",
                va="bottom", fontsize=7.5, color="#555555")
    for g, style in (("not rice", (0, (5, 2))), ("stable target box", (0, (1, 1.5)))):
        y = [a["ndvi_by_class"]["HV"][d][g]["median"] for d in days]
        y = [np.nan if v is None else v for v in y]
        ax.plot(x, y, color="#6b6b6b", lw=1.5, ls=style, zorder=2,
                label=f"{GROUP_LABELS[g]} ({a['group_cells']['HV'][g]:,} cells)")
    outline = [patheffects.withStroke(linewidth=3.2, foreground="#3a3a3a")]
    for g in ("1", "2", "3", "4", "5"):
        y = [a["ndvi_by_class"]["HV"][d][g]["median"] for d in days]
        y = [np.nan if v is None else v for v in y]
        light = g in ("4", "5")
        ax.plot(x, y, color=colours[g], lw=2, marker=markers[g], ms=6.5, zorder=3,
                mec="#3a3a3a" if light else colours[g], mew=0.8,
                path_effects=outline if light else [],
                label=f"HV class {g}: {GROUP_LABELS[g]} ({a['group_cells']['HV'][g]:,} cells)")
    unusable = [dt.date.fromisoformat(d["day"]) for d in a["dates"] if not d["usable"]]
    if unusable:
        ax.plot(unusable, [0.02] * len(unusable), ls="none", marker="|", ms=10, color="#9a9a9a",
                transform=ax.get_xaxis_transform(), label="Sentinel-2 date not usable (under 80 % of rice cells "
                "with a value)")
    ax.set_ylabel("Median NDVI of the cells (ratio of mean reflectances)")
    ax.set_ylim(OTSU_RANGE)
    ax.set_xlim(dt.date.fromisoformat(FIRST_DAY), dt.date.fromisoformat(LAST_DAY))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    ax.grid(axis="y", color="#e4e4e4", lw=0.8)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.set_title("Sentinel-2 NDVI of the 100 m cells of each HV harvest class (dashed lines: radar passes)",
                 fontsize=10.5, loc="left", pad=16)
    ax.legend(fontsize=7.5, loc="upper left", bbox_to_anchor=(0.0, -0.08), ncol=2, frameon=False)
    fig.text(0.01, 0.01, "Drawn by code (research/optical_check/optical_check.py, AI-written) from results.json. "
             "Usable dates only. Contains modified Copernicus Sentinel data 2026.", fontsize=7, color="#555555")
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(path, facecolor=fig.get_facecolor(),
                metadata={"Software": "matplotlib; " + GENERATOR,
                          "Comment": "Drawn by code from results.json. Contains modified Copernicus Sentinel data "
                                     "2026."})
    plt.close(fig)


def _jsonable(obj):
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if not np.isfinite(obj) else float(obj)
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def write_outputs(res: dict, folder: Path = HERE) -> None:
    """results.json, then RESULTS.md and ndvi_by_class.png, both made from the JSON as written."""
    (folder / "results.json").write_text(json.dumps(_jsonable(res), indent=1) + "\n", encoding="utf-8")
    doc = json.loads((folder / "results.json").read_text(encoding="utf-8"))
    md = folder / "RESULTS.md"
    md.write_text(results_markdown(doc, kept_reading(md)), encoding="utf-8")
    draw_figure(doc, folder / "ndvi_by_class.png")


# Commands ------------------------------------------------------------------------------------------------------

def catalog(bbox, refresh: bool = True) -> dict:
    """The catalog's items over the box, queried now (and saved to work/optical/catalog.json), or the saved ones."""
    path = WORK / "catalog.json"
    if refresh or not path.exists():
        items = search(bbox)
        doc = {"url": f"{STAC_URL}/search", "collection": COLLECTION, "bbox": list(bbox),
               "first_day": FIRST_DAY, "last_day": LAST_DAY,
               "queried_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "items": items}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc), encoding="utf-8")
        return doc
    return json.loads(path.read_text(encoding="utf-8"))


def probe() -> dict:
    """The access probe: list the catalog, read the window of ONE scene (the first date's granule of the tile) and
    report shapes, the grid alignment, the reflectance conversion, the SCL codes and value ranges, time and bytes.
    Computes no NDVI and looks at no radar class."""
    inputs = read_inputs()
    cat = catalog(inputs["site_box"], refresh=True)
    days, left_out = granules_by_day(cat["items"])
    print(f"catalog: {len(cat['items'])} items over the box from {FIRST_DAY} to {LAST_DAY}, queried "
          f"{cat['queried_at']}; {sum(len(v) for v in days.values())} on tile {TILE} on {len(days)} dates, "
          f"{len(left_out)} left out (other tile)")
    for day, items in days.items():
        print(f"  {day}  " + "  ".join(f"{it['id']} (nodata {it['properties']['s2:nodata_pixel_percentage']:.1f} %, "
                                       f"baseline {it['properties']['s2:processing_baseline']}, boa_offset_applied "
                                       f"{it['properties']['earthsearch:boa_offset_applied']})" for it in items))
    day = next(iter(days))
    item = days[day][0]
    print(f"probe scene: {item['id']} ({day})")
    t0 = time.perf_counter()
    with _env():
        g = read_granule(item, inputs["transform"], inputs["shape"])
    seconds = time.perf_counter() - t0
    red, nir, scl = g["red"], g["nir"], g["scl"]
    data = (red != NODATA_DN) & (nir != NODATA_DN)
    codes, counts = np.unique(scl, return_counts=True)
    water = data & (scl == 6)

    def ranges(a, m):
        v = a[m]
        if v.size == 0:
            return None
        return {"min": int(v.min()), "p1": float(np.percentile(v, 1)), "median": float(np.median(v)),
                "p99": float(np.percentile(v, 99)), "max": int(v.max())}

    scale_off = {a: reflectance_params(item, a) for a in ("red", "nir")}
    doc = {"probed_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "item": item["id"], "day": day,
           "tile": item_tile(item), "processing_baseline": item["properties"]["s2:processing_baseline"],
           "boa_offset_applied": item["properties"]["earthsearch:boa_offset_applied"],
           "raster_bands": {a: item["assets"][a]["raster:bands"] for a in ASSETS},
           "reflectance_params": scale_off, "files": g["files"], "window_10m": list(g["window"]),
           "shapes": {"red": list(red.shape), "nir": list(nir.shape), "scl_10m": list(scl.shape)},
           "pixels": int(red.size), "pixels_without_data_in_a_band": int((~data).sum()),
           "scl_codes": {int(c): int(n) for c, n in zip(codes, counts, strict=True)},
           "dn_ranges_where_data": {"red": ranges(red, data), "nir": ranges(nir, data)},
           "dn_ranges_scl6_water": {"red": ranges(red, water), "nir": ranges(nir, water)},
           "seconds": {"total": seconds, **g["seconds"]}, "bytes": g["bytes"],
           "megabytes_blocks_touched": (sum(g["bytes"].values()) / 1e6 if None not in g["bytes"].values() else None),
           "catalog": {"items": len(cat["items"]), "tile_items": sum(len(v) for v in days.values()),
                       "dates": list(days), "left_out": left_out,
                       "dates_with_several_granules": {d: [it["id"] for it in v] for d, v in days.items()
                                                       if len(v) > 1},
                       "split_granules": {d: split_granules(v) for d, v in days.items() if len(v) > 1}}}
    doc["red_below_offset_share"] = below_offset_share(red, nir)
    doc["vegetation_red_below_offset_share"], doc["vegetation_pixels"] = vegetation_below_offset(red, nir, scl)
    try:  # the probe records the guard's finding; the run stops on it
        doc["offset_check"] = offset_check(scale_off["red"][1], doc["vegetation_red_below_offset_share"],
                                           doc["vegetation_pixels"])
    except ValueError as err:
        doc["offset_check"] = f"FAILED: {err}"
    doc["product_metadata"] = ("not read: its link is " + item["assets"]["product_metadata"]["href"].split(":")[0]
                               + "://, outside the public https files the brief allows")
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "probe.json").write_text(json.dumps(_jsonable(doc), indent=1), encoding="utf-8")
    print(json.dumps(_jsonable({k: v for k, v in doc.items() if k not in ("catalog", "raster_bands")}), indent=1))
    return doc


def run(refresh_catalog: bool = True) -> dict:
    """The full run: every date, then steps 5 to 9, then results.json, RESULTS.md and the figure. Each date's cell
    sums are cached, so a second run reads no imagery again."""
    inputs = read_inputs()
    cat = catalog(inputs["site_box"], refresh=refresh_catalog)
    days, left_out = granules_by_day(cat["items"])
    rice = rice_cells(inputs["classes"]["HH"], inputs["classes"]["HV"])
    scenes, records = [], []
    for day, items in days.items():
        split_granules(items)  # before any read: the mosaic's premise
        s = load_or_read_scene(day, items, inputs["transform"], inputs["shape"])
        record = scene_record(s, items)  # the offset check stops the run here, before any analysis
        share = value_share(s["count"], rice)
        m = s["meta"]
        mb = "?" if m["bytes"] is None else f"{m['bytes'] / 1e6:.1f}"
        print(f"{day}  {' + '.join(s['items'])}  {'cached' if s['cached'] else 'read'} ({m['seconds']:.1f} s, {mb} MB "
              f"when read)  rice cells with a value {share:.1%}  {'usable' if usable(share) else 'not usable'}  "
              f"offset check {record['offset_check']}", flush=True)
        scenes.append(s)
        records.append(record)
    analysis = analyse(scenes, inputs["classes"], inputs["stable"], inputs["radar_by_pass"])
    res = {"title": "Optical cross-check of the harvest map", "generator": GENERATOR,
           "run_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
           "brief": "docs/OPTICAL_CHECK_BRIEF.md", "settings": settings(),
           "inputs": {"folder": "research/optical_check/inputs", "sha256": inputs["sha256"],
                      "site_box": inputs["site_box"], "stable_box": inputs["stable_box"],
                      "stable_box_where": inputs["stable_where"], "harvest_passes_all": inputs["harvest_passes_all"],
                      "radar_share_harvest_pair_by_pass": inputs["radar_by_pass"]},
           "catalog": {k: cat[k] for k in ("url", "collection", "bbox", "first_day", "last_day", "queried_at")}
           | {"items_listed": len(cat["items"]), "left_out_other_tile": left_out},
           "scenes": records,
           "analysis": analysis, "limits": list(LIMITS),
           "credit": "Contains modified Copernicus Sentinel data 2026"}
    write_outputs(res)
    print(f"wrote {HERE / 'results.json'}, {HERE / 'RESULTS.md'} and {HERE / 'ndvi_by_class.png'}")
    return res


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("probe", help="the access probe: catalog listing and the window of one scene, no NDVI")
    run_p = sub.add_parser("run", help="the full run: every scene, results.json, RESULTS.md, ndvi_by_class.png")
    run_p.add_argument("--saved-catalog", action="store_true",
                       help="use work/optical/catalog.json instead of querying the catalog again")
    args = parser.parse_args(argv)
    if args.command == "probe":
        probe()
    else:
        run(refresh_catalog=not args.saved_catalog)
    return 0


if __name__ == "__main__":
    sys.exit(main())
