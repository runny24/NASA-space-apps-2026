"""The harvest analysis: in which pair of passes the radar saw each rice cell's backscatter fall.

docs/METHODS.md, "Analysis: harvest pairs", says the same in plain words. The steps, each a small function
with its own test:

  1. cells        mean of LINEAR power over cell_m blocks of the processed rasters; a cell needs half of its
                  pixels valid on a date, otherwise it is NaN on that date; only cells whose centres lie inside
                  the site box take part (the processed window is the UTM rectangle around the box)
  2. rice         rise = dB(mean power over the peak dates) - lowest dB over the flood dates, from HH; a cell
                  is rice when the rise reaches a threshold (the site file's, or Otsu's on all valid cells)
  3. stable       cells whose centres lie in a stable box and that are not rice
  4. change       dB(later) - dB(earlier) for each consecutive pair of passes, in HH and in HV
  5. threshold    per polarization, the more negative of two false-alarm quantiles: of the change on stable
                  cells (the lowest over all pairs) and of the change on rice cells in the first pair, which
                  the site file chooses before the harvest starts
  6. classes      a rice cell's harvest pair is the first pair, from the second on, whose change is below the
                  threshold; "no harvest seen" when there is none; "fell before" when it crossed in the first
  7. diagnostics  the share harvested by each pass, HH against HV, cells that came back, abrupt falls

Science rules kept here (docs/ARCHITECTURE.md): every mean is taken over linear power and turned into dB as
the last step; invalid pixels are NaN in the processed rasters before any averaging; the stage asserts one
grid for every date; and a comparison uses the same cells on every pass: a cell takes part in the change of
a polarization only when it is valid on every pass of the list.
"""

from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass
from itertools import pairwise

import numpy as np
from affine import Affine

from pipeline.process import multilook
from pipeline.qa import target_pixels

# A cell keeps a value on a date only when at least this fraction of its pixels is valid on that date.
MIN_CELL_VALID = 0.5
# Otsu's threshold on the rise: the histogram's range in dB and its number of bins (0.1 dB each). Rises
# outside the range are counted in the end bins.
OTSU_RANGE_DB = (-10.0, 30.0)
OTSU_BINS = 400
# The abrupt-fall diagnostic looks at cells whose value fell by more than this from the first pass to the last.
LARGE_FALL_DB = 4.0
# The two polarizations the analysis computes, in the order of the class raster's bands.
POLARIZATIONS = ("HH", "HV")
# How the false-alarm quantile is taken: numpy's "inverted_cdf", the smallest observed change such that at
# least that share of the cells are at or below it. Fewer than that share are then strictly below it, which
# is what the threshold promises. (numpy's default, linear interpolation, can put more than that share below:
# 4 of 154 cells, 2.6 %, for the 0.02 quantile.)
QUANTILE_METHOD = "inverted_cdf"

NO_DATA = 0

MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December")

# Colours of the classes: colour-blind safe, in time order (viridis stops), then the three other classes.
HARVEST_COLOURS = ("#440154", "#3b528b", "#21918c", "#5ec962")
NO_HARVEST_COLOUR = "#fde725"
FELL_BEFORE_COLOUR = "#b8a3d8"
NOT_RICE_COLOUR = "#d9d9d9"
NOT_RICE_LABEL = "Not rice"

METHOD = (
    "Cells: mean of linear gamma-naught power over cell_m x cell_m blocks of the processed rasters (the "
    "product's own grid); only cells whose centres lie inside the site box take part (the processed window is "
    "the slightly larger UTM rectangle around the box; the cells outside the box have no class); a cell needs at "
    "least half of its pixels valid on a date, otherwise it has no value "
    "on that date; edge rows and columns that do not fill a block are left out. Rice: rise = 10*log10(mean "
    "power over the peak dates) minus the lowest 10*log10(power) over the flood dates, in HH, for cells valid "
    "on every flood and peak date; a cell is rice when its rise is at least the rice threshold (the site "
    "file's number, or Otsu's threshold on the rise of all those cells, from a histogram of 400 bins from -10 "
    "to 30 dB with rises outside that range counted in the end bins; when several thresholds split equally "
    "well, the middle of them). Stable cells: cells whose centres lie in a stable box and that are not rice. "
    "Change, per polarization: 10*log10(later/earlier) of the cell power for each consecutive pair of the "
    "passes, on cells valid on every pass of the list (the same cells for every pair). Threshold, per "
    "polarization: the more negative of (a) the lowest, over all pairs, of the false_alarm quantile of the "
    "change on stable cells and (b) the false_alarm quantile of the change on rice cells in the first pair, "
    "which comes before the harvest; a quantile is the smallest observed change with at least that share of "
    "the cells at or below it (numpy's inverted_cdf), so at most that share fall below it. A cell falls when "
    "its change is below the threshold. Harvest pair of a rice cell: "
    "the first pair from the second on whose change is below the threshold; none: no harvest seen; below it "
    "already in the first pair: fell before the first harvest pass; a rice cell not valid on every pass: no "
    "data.")


# Steps 1 to 3: cells, rice, stable cells --------------------------------------------------------------------

def cell_factor(pixel_m: float, cell_m: float) -> int:
    """How many processed pixels per side make one cell; cell_m must be a whole multiple of the pixel size."""
    factor = cell_m / pixel_m
    if factor < 1 - 1e-6 or abs(factor - round(factor)) > 1e-6:
        raise ValueError(f"cell_m {cell_m:g} must be a whole multiple of the processed pixel size {pixel_m:g} m")
    return int(round(factor))


def cells(power: np.ndarray, factor: int) -> np.ndarray:
    """Mean of LINEAR power over factor x factor blocks, NaN where fewer than half of a block's pixels are
    valid. Pixels that are not a positive finite power count as invalid. Edge rows and columns that do not
    fill a block are left out, so the cell grid starts at the same corner as the processed grid."""
    power = np.asarray(power, dtype=np.float64)
    clean = np.where(np.isfinite(power) & (power > 0), power, np.nan)
    if factor == 1:
        return clean
    return multilook(clean, factor, MIN_CELL_VALID).astype(np.float64)


def cell_grid(transform: Affine, shape: tuple[int, int], factor: int) -> tuple[Affine, tuple[int, int]]:
    """Transform and shape of the cell grid: the same corner, cells `factor` pixels wide."""
    return transform @ Affine.scale(factor), (shape[0] // factor, shape[1] // factor)


def cell_area_km2(transform: Affine) -> float:
    """Area of one cell on the product's own grid (never on the web map's, which overstates area)."""
    return abs(transform.a * transform.e) / 1e6


def db(power: np.ndarray) -> np.ndarray:
    """10*log10(power) in float64; NaN where power is not a positive finite number."""
    power = np.asarray(power, dtype=np.float64)
    out = np.full(power.shape, np.nan)
    ok = np.isfinite(power) & (power > 0)
    out[ok] = 10.0 * np.log10(power[ok])
    return out


def _all_valid(stack: np.ndarray) -> np.ndarray:
    return np.all(np.isfinite(stack) & (stack > 0), axis=0)


def rise_db(flood: list[np.ndarray], peak: list[np.ndarray]) -> np.ndarray:
    """dB of the mean LINEAR power over the peak dates minus the lowest dB over the flood dates, per cell.
    NaN for a cell that is not valid on every flood and peak date."""
    flood_stack = np.stack([np.asarray(a, dtype=np.float64) for a in flood])
    peak_stack = np.stack([np.asarray(a, dtype=np.float64) for a in peak])
    ok = _all_valid(flood_stack) & _all_valid(peak_stack)
    with np.errstate(invalid="ignore"):
        peak_mean = np.where(ok, peak_stack.mean(axis=0), np.nan)
        flood_min = np.where(ok, db(flood_stack).min(axis=0), np.nan)
    return db(peak_mean) - flood_min


def otsu_threshold(values: np.ndarray, value_range: tuple[float, float] = OTSU_RANGE_DB,
                   bins: int = OTSU_BINS) -> float:
    """Otsu's threshold on a fixed histogram: the split that maximises the variance between the two groups.

    The histogram runs over `value_range` in `bins` equal bins; finite values outside the range go to the end
    bins. Candidate thresholds are the inner bin edges. When several split equally well (an empty gap between
    two groups), the middle of them is returned, so the threshold sits in the middle of the gap.
    """
    v = np.asarray(values, dtype=np.float64)
    v = v[np.isfinite(v)]
    lo, hi = value_range
    if v.size < 2:
        raise ValueError(f"Otsu's threshold needs at least two values, got {v.size}")
    edges = np.linspace(lo, hi, bins + 1)
    counts, _ = np.histogram(np.clip(v, lo, hi), bins=edges)
    p = counts / counts.sum()
    centres = (edges[:-1] + edges[1:]) / 2
    omega = np.cumsum(p)[:-1]  # weight of the lower group for the split at edges[k + 1]
    mu = np.cumsum(p * centres)[:-1]
    mu_total = float((p * centres).sum())
    with np.errstate(invalid="ignore", divide="ignore"):
        between = (mu_total * omega - mu) ** 2 / (omega * (1.0 - omega))
    between[(omega <= 0) | (omega >= 1)] = np.nan
    if not np.isfinite(between).any():
        raise ValueError("Otsu's threshold cannot split values that all fall in one histogram bin")
    best = np.nanmax(between)
    ks = np.nonzero(np.isfinite(between) & np.isclose(between, best, rtol=1e-9, atol=0.0))[0]
    return float((edges[ks.min() + 1] + edges[ks.max() + 1]) / 2)


def rice_classes(rise: np.ndarray, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    """(rice, not rice): rice where the rise is at least the threshold; not rice where it is a number below
    it. A cell without a rise (not valid on a flood or peak date) is neither."""
    valid = np.isfinite(rise)
    with np.errstate(invalid="ignore"):
        return valid & (rise >= threshold), valid & (rise < threshold)


def cells_in_boxes(boxes, crs: str, transform: Affine, shape: tuple[int, int]) -> tuple[np.ndarray, list[str]]:
    """Cells whose CENTRES lie in any of the lon/lat boxes, and where each box lies relative to the grid
    (qa.target_pixels: inside, partly outside or outside the window)."""
    selection = np.zeros(shape, dtype=bool)
    wheres = []
    for box in boxes:
        inside, where = target_pixels(tuple(box), crs, transform, shape)
        selection |= inside
        wheres.append(where)
    return selection, wheres


# Steps 4 to 6: change, threshold, classes -------------------------------------------------------------------

def pair_changes(powers: list[np.ndarray]) -> list[np.ndarray]:
    """10*log10(later/earlier) of the cell power for each consecutive pair, NaN where either is invalid."""
    levels = [db(p) for p in powers]
    return [later - earlier for earlier, later in pairwise(levels)]


def complete(changes: list[np.ndarray]) -> np.ndarray:
    """Cells valid on every pass: their change is a number in every pair."""
    return np.logical_and.reduce([np.isfinite(c) for c in changes])


def min_reference_cells(false_alarm: float) -> int:
    """Fewer reference cells than this and the false-alarm quantile would just be the lowest value."""
    return math.ceil(1.0 / false_alarm)


def false_alarm_threshold(changes: list[np.ndarray], stable: np.ndarray, rice: np.ndarray,
                          false_alarm: float) -> dict:
    """The harvest threshold of one polarization, in dB, and the numbers behind it.

    Reference cells are those valid on every pass, so each pair compares the same cells. A quantile is the
    smallest observed change with at least false_alarm of the cells at or below it (QUANTILE_METHOD), so at
    most that share is strictly below it. (a) On stable cells the false_alarm quantile of the change is taken
    for each pair and the lowest of them kept: on ground that should not change, at most that share of cells
    falls further between any two passes. (b) On rice cells
    the false_alarm quantile of the change in the first pair, which comes before the harvest: standing rice
    varies more than a town, so (a) alone would call that variation a harvest. The threshold is the more
    negative of the two. Also returned: the share of stable and of rice cells whose change is below the
    threshold in each pair (for rice, in the first pair that is the false-alarm rate on standing rice; in the
    later pairs it is the share that fell, which is what the harvest pairs count).
    """
    full = complete(changes)
    stable_cells, rice_cells = stable & full, rice & full
    need = min_reference_cells(false_alarm)
    if int(stable_cells.sum()) < need:
        raise ValueError(f"the stable boxes hold {int(stable_cells.sum())} cells that are not rice and are valid "
                         f"on every pass; the {false_alarm:g} quantile needs at least {need}. Make the boxes "
                         "larger or add boxes on ground that should not change.")
    if int(rice_cells.sum()) < need:
        raise ValueError(f"only {int(rice_cells.sum())} rice cells are valid on every pass; the {false_alarm:g} "
                         f"quantile needs at least {need}")
    stable_q = [float(np.quantile(c[stable_cells], false_alarm, method=QUANTILE_METHOD)) for c in changes]
    stable_ref = min(stable_q)
    rice_ref = float(np.quantile(changes[0][rice_cells], false_alarm, method=QUANTILE_METHOD))
    threshold = min(stable_ref, rice_ref)
    if not threshold < 0:
        raise ValueError(f"the {false_alarm:g} quantile of the change is {threshold:+.3f} dB, not a fall: the "
                         "reference cells do not behave like stable ground and standing rice")
    return {
        "threshold_db": threshold,
        "used": "stable" if stable_ref <= rice_ref else "rice",
        "stable_reference_db": stable_ref,
        "rice_reference_db": rice_ref,
        "stable_quantile_by_pair_db": stable_q,
        "stable_cells": int(stable_cells.sum()),
        "rice_cells": int(rice_cells.sum()),
        "stable_share_below_by_pair": [float((c[stable_cells] < threshold).mean()) for c in changes],
        "rice_share_below_by_pair": [float((c[rice_cells] < threshold).mean()) for c in changes],
    }


@dataclass(frozen=True)
class Codes:
    """The class values of the class raster and the harvest-wave layer: harvest pair k (1-based, counted from
    the second pair of the list) is k; then no harvest seen, fell before, not rice; 0 is no data. The values
    do not depend on which classes occur, so one raster means the same thing whatever the data hold."""

    harvest_pairs: int

    def __post_init__(self):
        if not 1 <= self.harvest_pairs <= 252:
            raise ValueError(f"{self.harvest_pairs} harvest pairs: there must be 1 to 252 (passes 3 to 254)")

    @classmethod
    def for_passes(cls, n_passes: int) -> Codes:
        return cls(n_passes - 2)

    @property
    def no_harvest(self) -> int:
        return self.harvest_pairs + 1

    @property
    def fell_before(self) -> int:
        return self.harvest_pairs + 2

    @property
    def not_rice(self) -> int:
        return self.harvest_pairs + 3


def harvest_classes(changes: list[np.ndarray], rice: np.ndarray, not_rice: np.ndarray, threshold: float) -> np.ndarray:
    """The class of every cell for one polarization (values: Codes). A rice cell valid on every pass gets the
    first pair, from the second pair on, whose change is below the threshold; no harvest seen when there is
    none; fell before when its change is below the threshold already in the first pair. A rice cell not valid
    on every pass, and a cell that is neither rice nor not rice, get 0 (no data)."""
    codes = Codes(len(changes) - 1)
    full = complete(changes)
    crossed = np.stack([np.isfinite(c) & (np.nan_to_num(c, nan=0.0) < threshold) for c in changes])
    later = crossed[1:]
    out = np.zeros(rice.shape, dtype=np.uint8)
    out[not_rice] = codes.not_rice
    counted = rice & full
    seen = later.any(axis=0)
    first = (np.argmax(later, axis=0) + 1).astype(np.uint8)
    out[counted & seen] = first[counted & seen]
    out[counted & ~seen] = codes.no_harvest
    out[counted & crossed[0]] = codes.fell_before
    return out


# Step 7: diagnostics --------------------------------------------------------------------------------------

def _share(n: int, total: int) -> float | None:
    return n / total if total else None


def class_counts(classes: np.ndarray, codes: Codes, rice: np.ndarray) -> dict:
    return {
        "harvest_pair_cells": [int((classes == k).sum()) for k in range(1, codes.harvest_pairs + 1)],
        "no_harvest_cells": int((classes == codes.no_harvest).sum()),
        "fell_before_cells": int((classes == codes.fell_before).sum()),
        "not_rice_cells": int((classes == codes.not_rice).sum()),
        "rice_no_data_cells": int((rice & (classes == NO_DATA)).sum()),
    }


def cumulative_shares(classes: np.ndarray, codes: Codes, passes: list[str]) -> dict:
    """The share of the counted rice cells (those with a class: a harvest pair, no harvest seen or fell
    before) that have a harvest pair ending on or before each pass, from the third pass on (a harvest pair
    cannot end earlier). Cells that fell before count in the total, never in the numerator."""
    counted = (classes >= 1) & (classes <= codes.fell_before)
    total = int(counted.sum())
    by_pass = []
    for j in range(2, len(passes)):
        n = int(((classes >= 1) & (classes <= j - 1)).sum())
        by_pass.append({"date": passes[j], "cells": n, "share": _share(n, total)})
    return {"counted_cells": total, "by_pass": by_pass}


def cross_table(hh: np.ndarray, hv: np.ndarray, rice: np.ndarray, codes: Codes) -> dict:
    """Counts of rice cells by their HH class (rows) and their HV class (columns), no data included, so
    every rice cell is in exactly one entry."""
    values = [*range(1, codes.harvest_pairs + 1), codes.no_harvest, codes.fell_before, NO_DATA]
    counts = [[int((rice & (hh == a) & (hv == b)).sum()) for b in values] for a in values]
    return {"rows": "HH", "columns": "HV", "values": values, "counts": counts}


def came_back(levels: list[np.ndarray], classes: np.ndarray, codes: Codes, threshold: float) -> dict:
    """Cells that came back: for a cell whose harvest pair runs from pass k to pass k+1, its value on pass k+2
    is above its value on pass k minus half the threshold's size. Cells harvested in the last pair have no
    pass after it and are not evaluated."""
    margin = abs(threshold) / 2
    evaluated = back = 0
    for k in range(1, codes.harvest_pairs):  # pair k runs from passes[k] to passes[k + 1]
        sel = classes == k
        evaluated += int(sel.sum())
        back += int((sel & (levels[k + 2] > levels[k] - margin)).sum())
    return {"margin_db": margin, "cells_evaluated": evaluated, "cells_came_back": back,
            "share": _share(back, evaluated),
            "cells_not_evaluated": int((classes == codes.harvest_pairs).sum())}


def abrupt_falls(levels: list[np.ndarray], counted: np.ndarray, min_total_fall_db: float = LARGE_FALL_DB) -> dict:
    """For counted cells whose value fell by more than min_total_fall_db from the first pass to the last: the
    largest fall between two consecutive passes as a fraction of that total fall. Near 1, the fall came in
    one step; near 1/(number of pairs), it was spread out. It can exceed 1 when a cell rose again between."""
    stack = np.stack(levels)
    total = stack[0] - stack[-1]
    with np.errstate(invalid="ignore"):
        sel = counted & np.isfinite(total) & (total > min_total_fall_db)
    if not sel.any():
        return {"min_total_fall_db": min_total_fall_db, "cells": 0, "median": None, "quartiles": None,
                "share_over_half": None}
    largest = np.max(-(np.diff(stack, axis=0)), axis=0)[sel]
    fraction = largest / total[sel]
    q1, med, q3 = (float(v) for v in np.quantile(fraction, [0.25, 0.5, 0.75], method=QUANTILE_METHOD))
    return {"min_total_fall_db": min_total_fall_db, "cells": int(sel.sum()), "median": med, "quartiles": [q1, q3],
            "share_over_half": float((fraction > 0.5).mean())}


def mean_db(powers: list[np.ndarray], selection: np.ndarray) -> list[float | None]:
    """Mean of LINEAR power over the selected cells on each pass, then dB; None when no cell is selected."""
    if not selection.any():
        return [None for _ in powers]
    return [float(10.0 * np.log10(np.asarray(p, dtype=np.float64)[selection].mean())) for p in powers]


# The whole analysis on cell arrays ---------------------------------------------------------------------------

def analyse_cells(cell_powers: dict[str, dict[str, np.ndarray]], settings, in_site: np.ndarray,
                  in_boxes: np.ndarray, area_km2: float) -> tuple[dict, dict[str, np.ndarray]]:
    """Run steps 2 to 7 on cell power arrays. `cell_powers` maps HH and HV to {date: cell power}, every date
    of the settings (config.Harvest) on one cell grid; `in_site` marks the cells whose centres lie inside the
    site box, the only cells that take part (the others count as without a value on every date, so they get
    no class); `in_boxes` marks the cells whose centres lie in a stable box; `area_km2` is one cell's area.
    Returns (the numbers of harvest.json, class array per polarization)."""
    cell_powers = {pol: {d: np.where(in_site, p, np.nan) for d, p in by_date.items()}
                   for pol, by_date in cell_powers.items()}
    hh = cell_powers["HH"]
    rise = rise_db([hh[d] for d in settings.flood_dates], [hh[d] for d in settings.peak_dates])
    valid_rise = np.isfinite(rise)
    if settings.rice_rise_db is None:
        rice_threshold, source = otsu_threshold(rise[valid_rise]), "otsu"
    else:
        rice_threshold, source = float(settings.rice_rise_db), "site file"
    rice, not_rice = rice_classes(rise, rice_threshold)
    stable = in_boxes & not_rice
    passes = list(settings.passes)
    codes = Codes.for_passes(len(passes))

    doc: dict = {
        "cells": {"total": int(rise.size), "in_site_box": int(in_site.sum()), "with_rise": int(valid_rise.sum()),
                  "cell_area_km2": area_km2},
        "rice": {
            "threshold_db": rice_threshold, "threshold_source": source,
            "otsu": {"range_db": list(OTSU_RANGE_DB), "bins": OTSU_BINS} if source == "otsu" else None,
            "cells": int(rice.sum()), "area_km2": int(rice.sum()) * area_km2,
            "share_of_cells_with_rise": _share(int(rice.sum()), int(valid_rise.sum())),
            "not_rice_cells": int(not_rice.sum()),
        },
        "stable": {"cells_in_boxes": int(in_boxes.sum()), "rice_cells_in_boxes": int((in_boxes & rice).sum()),
                   "no_rise_cells_in_boxes": int((in_boxes & ~valid_rise).sum()), "cells": int(stable.sum())},
        "pairs": [list(p) for p in pairwise(passes)],
        "polarizations": {},
    }
    classes: dict[str, np.ndarray] = {}
    for pol in POLARIZATIONS:
        powers = [cell_powers[pol][d] for d in passes]
        changes = pair_changes(powers)
        threshold = false_alarm_threshold(changes, stable, rice, settings.false_alarm)
        found = harvest_classes(changes, rice, not_rice, threshold["threshold_db"])
        levels = [db(p) for p in powers]
        counted = (found >= 1) & (found <= codes.fell_before)
        full = complete(changes)
        classes[pol] = found
        doc["polarizations"][pol] = {
            "threshold": threshold,
            "classes": class_counts(found, codes, rice),
            "cumulative": cumulative_shares(found, codes, passes),
            "came_back": came_back(levels, found, codes, threshold["threshold_db"]),
            "abrupt_falls": abrupt_falls(levels, counted),
            "rice_mean_db_by_pass": mean_db(powers, rice & full),
            "stable_mean_db_by_pass": mean_db(powers, stable & full),
        }
    doc["cross_table"] = cross_table(classes["HH"], classes["HV"], rice, codes)
    doc["classes"] = class_table(passes, codes)
    return doc, classes


# Labels and colours ---------------------------------------------------------------------------------------

def date_text(date: str) -> str:
    """'2026-11-04' -> '4 November 2026'. Month names come from a table, never from the locale."""
    d = dt.date.fromisoformat(date)
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def harvest_label(earlier: str, later: str) -> str:
    a, b = dt.date.fromisoformat(earlier), dt.date.fromisoformat(later)
    start = f"{a.day} {MONTHS[a.month - 1]}" if a.year == b.year else date_text(earlier)
    return f"Harvested between {start} and {date_text(later)}"


def no_harvest_label(last: str) -> str:
    return f"Rice, no harvest seen by {date_text(last)}"


def fell_before_label(first_harvest_pass: str) -> str:
    return f"Fell before {date_text(first_harvest_pass)}"


def class_table(passes: list[str], codes: Codes) -> list[dict]:
    """What every value of the class raster means (harvest.json's `classes`)."""
    table = [{"value": k, "class": "harvest pair", "pair": [passes[k], passes[k + 1]],
              "label": harvest_label(passes[k], passes[k + 1])} for k in range(1, codes.harvest_pairs + 1)]
    table += [
        {"value": codes.no_harvest, "class": "no harvest seen", "label": no_harvest_label(passes[-1])},
        {"value": codes.fell_before, "class": "fell before", "pair": [passes[0], passes[1]],
         "label": fell_before_label(passes[1])},
        {"value": codes.not_rice, "class": "not rice", "label": NOT_RICE_LABEL},
        {"value": NO_DATA, "class": "no data",
         "label": "No data: centre outside the site box, not valid on a flood or peak date, or rice not valid "
                  "on every pass"},
    ]
    return table


def _hex(rgb) -> str:
    return "#" + "".join(f"{int(round(c)):02x}" for c in rgb)


def harvest_colours(n: int) -> list[str]:
    """Colours of n harvest pairs in time order: the first n of HARVEST_COLOURS, or with more than four pairs
    n colours spaced evenly along them (linear in RGB)."""
    if n <= len(HARVEST_COLOURS):
        return list(HARVEST_COLOURS[:n])
    stops = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in HARVEST_COLOURS], dtype=np.float64)
    out = []
    for t in np.linspace(0.0, len(stops) - 1.0, n):
        i = min(int(math.floor(t)), len(stops) - 2)
        f = t - i
        out.append(_hex(stops[i] * (1 - f) + stops[i + 1] * f))
    return out


def layer_classes(passes: list[str], has_fell_before: bool) -> list[dict]:
    """The classes of the harvest-wave layer's categorical-uint8 encoding, in value order. "Fell before" is
    listed only when a cell has it; its value stays reserved either way (Codes)."""
    codes = Codes.for_passes(len(passes))
    colours = harvest_colours(codes.harvest_pairs)
    out = [{"value": k, "label": harvest_label(passes[k], passes[k + 1]), "color": colours[k - 1]}
           for k in range(1, codes.harvest_pairs + 1)]
    out.append({"value": codes.no_harvest, "label": no_harvest_label(passes[-1]), "color": NO_HARVEST_COLOUR})
    if has_fell_before:
        out.append({"value": codes.fell_before, "label": fell_before_label(passes[1]), "color": FELL_BEFORE_COLOUR})
    out.append({"value": codes.not_rice, "label": NOT_RICE_LABEL, "color": NOT_RICE_COLOUR})
    return out


# Texts for the app and the console --------------------------------------------------------------------------

def _pct(share: float | None, digits: int = 1) -> str:
    return "n/a" if share is None else f"{100 * share:.{digits}f} %"


def threshold_text(pol: str, entry: dict) -> str:
    t = entry["threshold"]
    which = "stable ground" if t["used"] == "stable" else "standing rice in the first pair"
    return (f"{pol} threshold {t['threshold_db']:.2f} dB, set by {which} (stable-ground reference "
            f"{t['stable_reference_db']:.2f} dB, standing-rice reference {t['rice_reference_db']:.2f} dB); "
            f"stable cells below it: at most {_pct(max(t['stable_share_below_by_pair']))} in any pair; standing "
            f"rice below it in the first pair: {_pct(t['rice_share_below_by_pair'][0])}")


def rice_text(doc: dict) -> str:
    r = doc["rice"]
    how = "Otsu's threshold" if r["threshold_source"] == "otsu" else "the site file's threshold"
    return (f"rice: HH rose by at least {r['threshold_db']:.2f} dB ({how}) from the flood to the canopy in "
            f"{r['cells']} of {doc['cells']['with_rise']} cells ({r['area_km2']:.2f} km2)")


def report(doc: dict) -> list[str]:
    """The lines `analyse` prints for a result (harvest.json)."""
    head = "analyse"
    lines = [f"{head}  {rice_text(doc)}",
             f"{head}  stable cells: {doc['stable']['cells']} (of {doc['stable']['cells_in_boxes']} in the boxes; "
             f"{doc['stable']['rice_cells_in_boxes']} there are rice and left out)"]
    for pol, entry in doc["polarizations"].items():
        mark = " (defines the map)" if pol == doc["settings"]["marker"] else ""
        lines.append(f"{head}  {threshold_text(pol, entry)}{mark}")
        cum = entry["cumulative"]
        shares = ", ".join(f"{p['date']} {_pct(p['share'])}" for p in cum["by_pass"])
        counts = entry["classes"]
        lines.append(f"{head}  {pol} harvest pair seen by: {shares} of {cum['counted_cells']} rice cells; no harvest "
                     f"seen {_pct(_share(counts['no_harvest_cells'], cum['counted_cells']))}; fell before "
                     f"{_pct(_share(counts['fell_before_cells'], cum['counted_cells']))}; rice without data on "
                     f"every pass: {counts['rice_no_data_cells']} cells")
    return lines


def share_series(doc: dict, pol: str, crs: str, layer_id: str) -> dict:
    """The stats.json series of the share of the rice area with a harvest pair by each pass, in %."""
    entry = doc["polarizations"][pol]
    s = doc["settings"]
    cum, counts, t = entry["cumulative"], entry["classes"], entry["threshold"]
    area = doc["cells"]["cell_area_km2"]
    marker = s["marker"]
    defines = "defines the harvest map" if pol == marker else f"for comparison; {marker} defines the map"
    passes = s["passes"]
    return {
        "id": f"harvest-share-{pol.lower()}",
        "title": f"Share of the rice area with a harvest pair seen by each pass ({pol}, {defines})",
        "unit": "%",
        "layer": layer_id,
        "region": (f"Rice cells of the site box: {s['cell_m']:g} m cells on the product's own grid ({crs}) whose "
                   f"centres lie inside the site box and whose HH rose by at least "
                   f"{doc['rice']['threshold_db']:.2f} dB from the flood ({', '.join(s['flood_dates'])}) to the "
                   f"canopy ({', '.join(s['peak_dates'])}): "
                   f"{doc['rice']['cells']} cells, {doc['rice']['area_km2']:.2f} km2. Counted here: the "
                   f"{cum['counted_cells']} of them ({cum['counted_cells'] * area:.2f} km2) valid in {pol} on "
                   f"every pass from {passes[0]} to {passes[-1]}, the same cells for every point."),
        "method": (f"A rice cell counts from the first pair of consecutive passes, from {passes[1]} to {passes[2]} "
                   f"on, in which its {pol} backscatter (mean of linear power over the cell, in dB) fell by more "
                   f"than {abs(t['threshold_db']):.2f} dB. That threshold is the more negative of the "
                   f"{s['false_alarm']:g} quantile of the change on stable ground in any pair "
                   f"({t['stable_reference_db']:.2f} dB) and on standing rice from {passes[0]} to {passes[1]} "
                   f"({t['rice_reference_db']:.2f} dB). False alarms at that threshold: stable cells at most "
                   f"{_pct(max(t['stable_share_below_by_pair']))} in any pair, standing rice "
                   f"{_pct(t['rice_share_below_by_pair'][0])} in the first pair. The "
                   f"{counts['fell_before_cells']} cells that fell already from {passes[0]} to {passes[1]} count "
                   "in the total, not as harvested. n is the number of rice cells counted."),
        "points": [{"date": p["date"], "value": None if p["share"] is None else 100 * p["share"],
                    "n": cum["counted_cells"]} for p in cum["by_pass"]],
    }
