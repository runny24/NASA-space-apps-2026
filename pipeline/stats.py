"""Small numbers for the app's charts (contract/stats.schema.json).

Each series says in words how it was computed, so a teammate can answer "where does this number come
from?" in front of a judge.
"""

from __future__ import annotations

import math

import numpy as np


def mean_backscatter_db(power: np.ndarray) -> tuple[float | None, int]:
    """Mean of LINEAR power over valid pixels, then converted to dB, with the pixel count.

    Averaging dB values instead would give a lower, biased number (the log of a mean is not the mean
    of logs). None when there is no valid pixel: shown as a gap, never filled.
    """
    valid = power[np.isfinite(power) & (power > 0)]
    n = int(valid.size)
    if n == 0:
        return None, 0
    return round(10.0 * math.log10(float(valid.astype(np.float64).mean())), 3), n


def common_footprint_points(dates: list[str], powers: list[np.ndarray],
                            min_coverage: float) -> tuple[list[dict], list[str]]:
    """Points of a series that compares like with like: every date averaged over the SAME pixels.

    A date that covers less ground (a partial frame, a swath edge, more masked pixels) would otherwise be
    averaged over different ground, and the change in coverage would look like a change in backscatter.
    A date whose own valid-pixel count is below `min_coverage` times the best date's is left out of the
    common footprint and published as null with its own count; the others are averaged over the pixels
    valid on all of them. Returns (points, dates left out).
    """
    valid = [np.isfinite(p) & (p > 0) for p in powers]
    counts = [int(v.sum()) for v in valid]
    best = max(counts, default=0)
    used = [best > 0 and n >= min_coverage * best for n in counts]
    common = np.logical_and.reduce([v for v, u in zip(valid, used, strict=True) if u]) if any(used) else None
    points, left_out = [], []
    for date, power, n, use in zip(dates, powers, counts, used, strict=True):
        if use:
            value, n = mean_backscatter_db(np.where(common, power, np.nan))
        else:
            value = None
            left_out.append(date)
        points.append({"date": date, "value": value, "n": n})
    return points, left_out


def backscatter_series(layer_id: str, pol: str, points: list[dict], working_resolution_m: float, *, crs: str,
                       min_coverage: float, left_out: list[str]) -> dict:
    used = len(points) - len(left_out)
    gaps = f" Left out: {', '.join(left_out)}." if left_out else ""
    return {
        "id": f"{layer_id}-mean",
        "title": f"Mean {pol} backscatter over the window",
        "unit": "dB",
        "layer": layer_id,
        "region": (f"The site box drawn in the product's own map projection ({crs}) and rounded to whole "
                   "pixels, which is slightly larger than the lon/lat bounds; only the pixels valid on every "
                   "date used."),
        "method": (f"Mean of linear gamma-naught power at {working_resolution_m:g} m over the same pixels on "
                   f"every date (those valid on all {used} dates used), then converted to dB with 10*log10; "
                   "n is that pixel count. A date with fewer valid pixels than "
                   f"{100 * min_coverage:g}% of the best-covered date is not used: its value is null (a gap) "
                   f"and its n is its own valid-pixel count.{gaps}"),
        "points": points,
    }


def stats_document(site_id: str, series: list[dict], bars: list[dict] | None = None) -> dict:
    """The stats.json of a site; `bars` (comparisons across categories) only when there are some."""
    doc = {"schema": 1, "site": site_id, "series": series}
    if bars:
        doc["bars"] = bars
    return doc
