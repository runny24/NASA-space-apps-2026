"""The linear-uint8 encoding of docs/DATA_CONTRACT.md, both directions.

Display files hold small whole numbers (codes), not physical values, because every map reader decodes
8-bit images and they compress well:

    pixel    = 1 + round(254 * (physical - lo) / (hi - lo)), clipped to 1..255
    physical = lo + (pixel - 1) * (hi - lo) / 254
    0        = nodata

The web app has the same two formulas in src/contract/; a test on each side keeps them in step.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NODATA = 0


def encode(values: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """Physical values (NaN = no data) to uint8 codes 1..255, with 0 for no data."""
    if not hi > lo:
        raise ValueError(f"hi ({hi}) must be greater than lo ({lo})")
    values = np.asarray(values, dtype=np.float64)
    valid = np.isfinite(values)
    scaled = 254.0 * (np.where(valid, values, lo) - lo) / (hi - lo)
    # floor(x + 0.5) rounds halves up, the same in Python and JavaScript (numpy's round goes to even).
    codes = 1.0 + np.floor(scaled + 0.5)
    codes = np.clip(codes, 1, 255).astype(np.uint8)
    codes[~valid] = NODATA
    return codes


def decode(codes: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """uint8 codes back to physical values; code 0 becomes NaN."""
    codes = np.asarray(codes)
    out = lo + (codes.astype(np.float64) - 1.0) * (hi - lo) / 254.0
    out[codes == NODATA] = np.nan
    return out


def step(lo: float, hi: float) -> float:
    """Physical size of one code step (0.157 dB for -35..5 dB)."""
    return (hi - lo) / 254.0


@dataclass(frozen=True)
class ClipReport:
    valid: int
    below: float  # fraction of valid pixels below lo (written as code 1)
    above: float  # fraction of valid pixels above hi (written as code 255)

    def describe(self) -> str:
        return f"clipped {100 * self.below:.2f}% low, {100 * self.above:.2f}% high of {self.valid} valid px"


def clip_report(values: np.ndarray, lo: float, hi: float) -> ClipReport:
    values = np.asarray(values, dtype=np.float64)
    valid = values[np.isfinite(values)]
    n = int(valid.size)
    if n == 0:
        return ClipReport(0, 0.0, 0.0)
    return ClipReport(n, float((valid < lo).sum()) / n, float((valid > hi).sum()) / n)


def encoding_json(lo: float, hi: float) -> dict:
    """The manifest's `encoding` object for this mapping."""
    return {"type": "linear-uint8", "nodata": NODATA, "lo": lo, "hi": hi}
