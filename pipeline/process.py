"""Turn raw windows into clean linear power on one grid, and compute change between two dates.

Science rules from docs/ARCHITECTURE.md that live here:
  2. all arithmetic in linear power; decibels only at the end (to_db),
  3. invalid pixels become NaN before any averaging (valid_pixels),
  4. the meaning of the mask depends on the product specification version (mask_convention),
  5. every date sits on one identical grid (assert_same_grid).
"""

from __future__ import annotations

import re

import numpy as np
from affine import Affine
from scipy.ndimage import uniform_filter

from pipeline.hints import command

# The two mask conventions seen so far.
MASK_ZERO_VALID = "zero-valid"  # NASA's sample files (spec 1.2.1): 0 = valid, 255 = outside
MASK_SUBSWATH = "subswath-1-to-5"  # spec 1.5.0 and later: 0 = invalid, 1..5 = valid sub-swath, 255 = outside
MASK_NONE = "no-mask"  # the file has no mask; rely on finite values and the power floor
SUBSWATH_FIRST_SPEC = (1, 5, 0)


class MaskConventionError(ValueError):
    """The mask holds values that neither known convention explains."""


class GridMismatchError(ValueError):
    """Two dates are not on the identical grid, so they must not be compared pixel by pixel."""


def parse_version(text: str) -> tuple[int, ...]:
    numbers = re.findall(r"\d+", text or "")
    if not numbers:
        raise MaskConventionError(f"Cannot read the product specification version {text!r}")
    return tuple(int(n) for n in numbers[:3])


def mask_convention(spec_version: str, mask_values: list[int] | None) -> str:
    """Decide what the mask means from the file's specification version AND the values it holds.

    In real NISAR files (spec 1.5.0+) the mask is 0 = invalid, 1..5 = valid, 255 = outside the image.
    NASA's older sample files use the same attribute text, but there every pixel inside the image is 0.
    Applying the real-data rule to the samples throws away the whole image, and the reverse would keep
    invalid pixels in real data, so we check the values against the version and stop if they disagree.
    mask_values=None means the file has no mask dataset.
    """
    if mask_values is None:
        return MASK_NONE
    values = set(mask_values)
    version = parse_version(spec_version)
    hint = f"Run `{command('inspect', '<file>')}` and look at the mask before going further."
    if version >= SUBSWATH_FIRST_SPEC:
        unexpected = values - {0, 1, 2, 3, 4, 5, 255}
        if unexpected:
            raise MaskConventionError(f"Spec {spec_version} mask has unexpected values {sorted(unexpected)}. {hint}")
        if 0 in values and not values & {1, 2, 3, 4, 5}:
            raise MaskConventionError(
                f"Spec {spec_version} says 0 means invalid, but this window has 0 and no valid "
                f"values 1..5 (it holds {sorted(values)}). That looks like the old sample convention. {hint}")
        return MASK_SUBSWATH
    unexpected = values - {0, 255}
    if unexpected:
        raise MaskConventionError(
            f"Spec {spec_version} (older than 1.5.0) should only hold mask values 0 and 255, "
            f"found {sorted(unexpected)}. {hint}")
    return MASK_ZERO_VALID


def valid_pixels(power: np.ndarray, mask: np.ndarray | None, convention: str, floor: float) -> np.ndarray:
    """True where a pixel can be trusted: the mask says valid, the value is finite, and the power is
    above a small floor (real files hold values near 1e-14 at scene edges that pass a naive > 0 test)."""
    ok = np.isfinite(power) & (power > floor)
    if convention == MASK_ZERO_VALID:
        ok &= mask == 0
    elif convention == MASK_SUBSWATH:
        ok &= (mask >= 1) & (mask <= 5)
    elif convention != MASK_NONE:
        raise ValueError(f"Unknown mask convention {convention!r}")
    return ok


def apply_validity(power: np.ndarray, valid: np.ndarray) -> np.ndarray:
    out = power.astype(np.float32, copy=True)
    out[~valid] = np.nan
    return out


def multilook_factor(posting_m: float, working_resolution_m: float) -> int:
    """How many source pixels per side make one working pixel. Must be a whole number, so that the
    working grid lines up with the source grid exactly."""
    factor = working_resolution_m / posting_m
    if factor < 1 - 1e-6 or abs(factor - round(factor)) > 1e-6:
        raise ValueError(f"working_resolution_m {working_resolution_m} must be a whole multiple of the "
                         f"product posting {posting_m} m")
    return int(round(factor))


def multilook(power: np.ndarray, factor: int, min_valid_fraction: float = 0.5) -> np.ndarray:
    """Average factor x factor blocks of LINEAR power, ignoring NaN.

    Averaging power (not dB) is what reduces speckle without bias. A block keeps a value only when at
    least min_valid_fraction of its pixels are valid; otherwise it becomes NaN. Rows and columns at the
    bottom and right that do not fill a whole block are dropped, so the grid origin stays put.
    """
    if factor == 1:
        return power.astype(np.float32, copy=True)
    rows, cols = (power.shape[0] // factor) * factor, (power.shape[1] // factor) * factor
    blocks = power[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    valid = np.isfinite(blocks)
    count = valid.sum(axis=(1, 3))
    total = np.where(valid, blocks, 0.0).sum(axis=(1, 3), dtype=np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / count
    mean[count < min_valid_fraction * factor * factor] = np.nan
    return mean.astype(np.float32)


def multilook_transform(transform: Affine, factor: int) -> Affine:
    """Same origin, pixels factor times larger."""
    return transform @ Affine.scale(factor)


def assert_same_grid(grids: dict[str, tuple[str, Affine, tuple[int, int]]], tolerance: float = 1e-3) -> None:
    """Fail loudly unless every date has the same CRS, transform and shape (science rule 5).

    grids maps a label (the date) to (crs string, affine transform, (rows, cols)). tolerance is a
    fraction of a pixel.
    """
    items = list(grids.items())
    if not items:
        return
    first_label, (crs0, t0, shape0) = items[0]
    for label, (crs, t, shape) in items[1:]:
        problems = []
        if crs != crs0:
            problems.append(f"CRS {crs} vs {crs0}")
        if tuple(shape) != tuple(shape0):
            problems.append(f"shape {shape} vs {shape0}")
        pixel = max(abs(t0.a), abs(t0.e))
        if any(abs(a - b) > tolerance * pixel for a, b in zip(tuple(t)[:6], tuple(t0)[:6], strict=True)):
            problems.append(f"transform {tuple(t)[:6]} vs {tuple(t0)[:6]}")
        if problems:
            raise GridMismatchError(f"{label} is not on the same grid as {first_label}: " + "; ".join(problems)
                                    + ". Only images of one stack, read with one bbox, can be compared.")


def to_db(power: np.ndarray) -> np.ndarray:
    """10 * log10(power); NaN where power is not a positive finite number."""
    power = np.asarray(power, dtype=np.float64)
    out = np.full(power.shape, np.nan)
    ok = np.isfinite(power) & (power > 0)
    out[ok] = 10.0 * np.log10(power[ok])
    return out.astype(np.float32)


def boxcar_mean(power: np.ndarray, size: int, min_valid_fraction: float = 0.5) -> np.ndarray:
    """Mean of LINEAR power over a size x size box around each pixel, ignoring NaN.

    A pixel keeps a value only if it is valid itself and at least min_valid_fraction of its box is valid,
    so the filter never spreads data into gaps.
    """
    valid = np.isfinite(power)
    if size == 1:
        return np.where(valid, power, np.nan).astype(np.float32)
    filled = np.where(valid, power, 0.0).astype(np.float64)
    total = uniform_filter(filled, size=size, mode="constant", cval=0.0)
    frac = uniform_filter(valid.astype(np.float64), size=size, mode="constant", cval=0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / frac
    mean[(frac < min_valid_fraction - 1e-9) | ~valid] = np.nan
    return mean.astype(np.float32)


def log_ratio_db(reference: np.ndarray, secondary: np.ndarray, size: int = 3) -> np.ndarray:
    """Change in dB from reference (earlier) to secondary (later): 10*log10(secondary/reference).

    Both inputs are linear power on the same grid; each is boxcar-filtered first so that speckle does
    not show up as change. Positive means the later image is brighter.
    """
    if reference.shape != secondary.shape:
        raise GridMismatchError(f"shapes differ: {reference.shape} vs {secondary.shape}")
    ref = boxcar_mean(reference, size).astype(np.float64)
    sec = boxcar_mean(secondary, size).astype(np.float64)
    out = np.full(ref.shape, np.nan)
    ok = np.isfinite(ref) & np.isfinite(sec) & (ref > 0) & (sec > 0)
    out[ok] = 10.0 * np.log10(sec[ok] / ref[ok])
    return out.astype(np.float32)
