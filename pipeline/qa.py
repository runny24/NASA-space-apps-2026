"""Checks to run on each date before trusting it.

Quick-look plots, for every date: a histogram of backscatter in dB (raw window and after multilooking) and a
north-up thumbnail with the layer's fixed display range. A broken date usually stands out at once: an empty
or striped image, a histogram shifted by several dB, or a scene that is upside down.

The stable-target check (docs/METHODS.md, "Check: stable target"): the mean backscatter of a box over
ground that should not change, on every date, compared with the median of all dates. A date more than the
tolerance (about 1 dB) away points to a calibration, mode or release problem, not to a change on the ground.
(Dates that do not cover the target, and dates that split into two halves, are handled as STABLE_TARGET_METHOD
says.) Which ground to use is set in the site file (its stable_target); this module only measures it.
"""

from __future__ import annotations

import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # draw to files only; no window, works on machines without a display
import matplotlib.pyplot as plt  # noqa: E402  (must come after choosing the backend)
import numpy as np  # noqa: E402
from affine import Affine  # noqa: E402
from pyproj import Transformer  # noqa: E402

from pipeline.process import to_db  # noqa: E402


def histogram_png(path: Path, title: str, series: dict[str, np.ndarray], display: tuple[float, float]) -> int:
    """series maps a label (e.g. "window 20 m") to linear power; plotted as dB histograms."""
    fig, ax = plt.subplots(figsize=(6, 3.5), dpi=100)
    try:
        bins = np.linspace(display[0] - 15, display[1] + 15, 121)
        for label, power in series.items():
            db = to_db(power)
            db = db[np.isfinite(db)]
            if db.size:
                ax.hist(db, bins=bins, histtype="step", density=True,
                        label=f"{label} (n={db.size}, median {np.median(db):.1f} dB)")
        ax.axvspan(*display, color="0.9", zorder=0, label="display range")
        ax.set_xlabel("backscatter (dB)")
        ax.set_ylabel("density")
        ax.set_title(title, fontsize=9)
        ax.legend(fontsize=7)
        fig.tight_layout()
        path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(path)
    finally:
        plt.close(fig)
    return path.stat().st_size


def thumbnail_png(path: Path, title: str, power: np.ndarray, display: tuple[float, float],
                  max_px: int = 512) -> int:
    """North-up greyscale image of dB backscatter (row 0 is the northern edge, as in the file)."""
    step = max(1, int(np.ceil(max(power.shape) / max_px)))
    db = to_db(power[::step, ::step])
    fig, ax = plt.subplots(figsize=(5, 5 * db.shape[0] / max(db.shape[1], 1) + 0.5), dpi=100)
    try:
        im = ax.imshow(db, cmap="gray", vmin=display[0], vmax=display[1], interpolation="nearest")
        ax.set_title(title, fontsize=9)
        ax.set_xlabel("column (west to east)")
        ax.set_ylabel("row (north to south)")
        fig.colorbar(im, ax=ax, label="dB", shrink=0.8)
        fig.tight_layout()
        path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(path)
    finally:
        plt.close(fig)
    return path.stat().st_size


# ---------------------------------------------------------------------------------------------------------
# Stable-target check

# Fewer pixels than this, valid on every date, and the check gives "not enough pixels" instead of a number.
MIN_TARGET_PIXELS = 100

CHECKED = "checked"
TOO_FEW_PIXELS = "not enough pixels"
ONE_DATE = "nothing to compare"

# Where the target box lies relative to the processed rasters (target_pixels).
INSIDE = "inside the window"
PARTLY_OUTSIDE = "partly outside the window"
OUTSIDE = "outside the window"

NOT_COVERED = "target not covered on this date"

STABLE_TARGET_METHOD = (
    "A date with fewer than min_pixels valid pixels (in every polarization) inside the target box is left out "
    "and named (target not covered on this date). Value: mean of linear gamma-naught power over the processed "
    "pixels whose centres lie inside the target box and that are valid on every date compared and in every "
    "polarization (the same pixels throughout), then 10*log10. Reference: the median of the dates' mean "
    "powers. Deviation: 10*log10(date mean / reference), and a date is flagged when its deviation, as stored "
    "(to 0.001 dB), exceeds the tolerance. With an even number of dates the median falls between the two "
    "middle dates; when those two differ by more than the tolerance there is no single reference: the dates "
    "split into a lower and an upper half that disagree, every date is flagged and none is blamed, and each "
    "date's deviation is taken from the closest date of the other half. With two dates this compares them "
    "directly.")


def _box_outline(bbox: tuple[float, float, float, float], per_side: int = 21) -> tuple[np.ndarray, np.ndarray]:
    """Points along the edges of a lon/lat box: a lon/lat rectangle is curved in a map projection."""
    w, s, e, n = bbox
    t = np.linspace(0.0, 1.0, per_side)
    lons = np.concatenate([w + (e - w) * t, np.full_like(t, e), e - (e - w) * t, np.full_like(t, w)])
    lats = np.concatenate([np.full_like(t, s), s + (n - s) * t, np.full_like(t, n), n - (n - s) * t])
    return lons, lats


def _north_up(transform: Affine) -> None:
    if transform.b != 0 or transform.d != 0 or transform.a <= 0 or transform.e >= 0:
        raise ValueError(f"expected a north-up grid, got the transform {tuple(transform)[:6]}")


def grid_lonlat_bounds(crs: str, transform: Affine, shape: tuple[int, int]) -> tuple[float, float, float, float]:
    """The lon/lat box around a grid (for messages that say where the data is)."""
    _north_up(transform)
    left, top = transform.c, transform.f
    right, bottom = left + shape[1] * transform.a, top + shape[0] * transform.e
    return Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform_bounds(
        left, bottom, right, top, densify_pts=21)


def target_pixels(bbox: tuple[float, float, float, float], crs: str, transform: Affine,
                  shape: tuple[int, int]) -> tuple[np.ndarray, str]:
    """The pixels of a north-up grid that belong to a lon/lat box: those whose CENTRE lies inside it.

    Returns (boolean array of the grid's shape, where), where = INSIDE when the whole box lies on the grid,
    PARTLY_OUTSIDE when part of it does not (only the part on the grid counts), OUTSIDE when none of it does.
    """
    _north_up(transform)
    rows, cols = shape
    left, top, px, py = transform.c, transform.f, transform.a, -transform.e
    right, bottom = left + cols * px, top - rows * py
    xs, ys = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform(*_box_outline(bbox))
    xmin, xmax, ymin, ymax = float(np.min(xs)), float(np.max(xs)), float(np.min(ys)), float(np.max(ys))
    selection = np.zeros(shape, dtype=bool)
    if xmax <= left or xmin >= right or ymax <= bottom or ymin >= top:
        return selection, OUTSIDE
    where = INSIDE if (xmin >= left and xmax <= right and ymin >= bottom and ymax <= top) else PARTLY_OUTSIDE
    # Candidates: pixels whose centres fall in the box's bounding rectangle in grid units. Then the exact
    # test, in lon/lat, of each candidate centre.
    c0, c1 = max(0, math.ceil((xmin - left) / px - 0.5)), min(cols, math.floor((xmax - left) / px - 0.5) + 1)
    r0, r1 = max(0, math.ceil((top - ymax) / py - 0.5)), min(rows, math.floor((top - ymin) / py - 0.5) + 1)
    if c1 > c0 and r1 > r0:
        cc, rr = np.meshgrid(np.arange(c0, c1), np.arange(r0, r1))
        lon, lat = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform(
            left + (cc + 0.5) * px, top - (rr + 0.5) * py)
        w, s, e, n = bbox
        selection[r0:r1, c0:c1] = (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n)
    return selection, where


def _db(power: float) -> float:
    return 10.0 * math.log10(power)


def _compare(means: dict[str, float], tolerance_db: float) -> tuple[dict, dict[str, float | None], dict[str, bool]]:
    """Reference, deviations and flags for the mean powers of the dates compared, in date order (see
    STABLE_TARGET_METHOD). Deviations are stored to 0.001 dB and the flags are decided on those stored values,
    so a stored number never contradicts its flag. Returns (fields for the polarization's entry, deviation
    per date, flag per date)."""
    dates = list(means)
    if len(dates) < 2:
        return {"reference_db": None}, dict.fromkeys(dates), dict.fromkeys(dates, False)
    info: dict = {}
    if len(dates) == 2:
        info["difference_db"] = round(_db(means[dates[1]] / means[dates[0]]), 3)  # later minus earlier
    order = sorted(dates, key=lambda d: means[d])
    half = len(order) // 2
    lower_middle, upper_middle = means[order[(len(order) - 1) // 2]], means[order[half]]
    gap = round(_db(upper_middle / lower_middle), 3)  # 0 for an odd count: the median is one date
    if gap > tolerance_db:
        # The median would fall between two dates that disagree, closer (in dB) to the higher one, and so
        # blame the lower half. There is no telling which half is off: each date is measured against the
        # closest date of the other half, which flags every date.
        lower = set(order[:half])
        info.update(reference_db=None, split={"lower": [d for d in dates if d in lower],
                                              "upper": [d for d in dates if d not in lower], "gap_db": gap})
        deviations = {d: round(_db(means[d] / (upper_middle if d in lower else lower_middle)), 3) for d in dates}
    else:
        reference = float(np.median([means[d] for d in dates]))  # of powers, never of dB values
        info["reference_db"] = round(_db(reference), 3)
        deviations = {d: round(_db(means[d] / reference), 3) for d in dates}
    return info, deviations, {d: abs(dev) > tolerance_db for d, dev in deviations.items()}


def stable_target_series(dates: list[str], powers: dict[str, list[np.ndarray]], selection: np.ndarray,
                         tolerance_db: float, min_pixels: int = MIN_TARGET_PIXELS) -> dict:
    """Mean backscatter of the target on every date, and how far each date is from the median of all dates.

    `powers` maps a polarization to one LINEAR power array per date (NaN where invalid), all on one grid;
    `selection` marks the target's pixels. A date with fewer than `min_pixels` valid pixels (in every
    polarization) inside the target, such as a partial frame that misses it, is left out and named in
    `left_out`, as the statistics series leaves out a date with too little coverage; otherwise one such
    date would leave no pixel valid on every date and void the check for all of them. (When no date has that
    many, the box itself is too small or on invalid ground, and no date is singled out.) Of the dates that
    remain, only pixels of the target valid on every one of them and in every polarization are used, so each
    number compares the same ground. Each mean is taken over linear power and turned into dB as the last
    step: the mean of dB values would read low and move with the speckle. For the reference, the flags and
    the case of an even number of dates, see _compare.
    """
    target = np.asarray(selection, dtype=bool)
    for pol, stack in powers.items():
        if len(stack) != len(dates):
            raise ValueError(f"{pol}: {len(stack)} arrays for {len(dates)} dates")
    valid = []
    for i in range(len(dates)):
        ok = target.copy()
        for stack in powers.values():
            ok &= np.isfinite(stack[i]) & (stack[i] > 0)
        valid.append(ok)
    counts = {d: int(v.sum()) for d, v in zip(dates, valid, strict=True)}
    used = [i for i, d in enumerate(dates) if counts[d] >= min_pixels]
    if not used:  # no date has enough: the box is too small or on invalid ground, so no date is singled out
        used = list(range(len(dates)))
    common = np.logical_and.reduce([valid[i] for i in used]) if used else np.zeros_like(target)
    n = int(common.sum())
    if n < min_pixels:
        status = TOO_FEW_PIXELS
    elif len(used) < 2:
        status = ONE_DATE
    else:
        status = CHECKED

    result: dict = {"status": status, "pixels_in_target": int(target.sum()), "pixels_valid_on_every_date": n,
                    "min_pixels": min_pixels, "pixels_valid_by_date": counts,
                    "left_out": [{"date": dates[i], "reason": NOT_COVERED}
                                 for i in range(len(dates)) if i not in used],
                    "flagged_dates": [], "polarizations": {}}
    flagged: set[str] = set()
    for pol, stack in powers.items():
        means = {} if status == TOO_FEW_PIXELS else {
            dates[i]: float(np.asarray(stack[i], dtype=np.float64)[common].mean()) for i in used}
        entry, deviations, flags = _compare(means, tolerance_db)
        entry["dates"] = [{"date": d, "value_db": round(_db(means[d]), 3), "deviation_db": deviations[d],
                           "flagged": flags[d]} if d in means else
                          {"date": d, "value_db": None, "deviation_db": None, "flagged": False} for d in dates]
        flagged |= {d for d, flag in flags.items() if flag}
        result["polarizations"][pol] = entry
    result["flagged_dates"] = [d for d in dates if d in flagged]
    return result


def _db_text(value: float, tolerance: float, flagged: bool) -> str:
    """A stored deviation in dB with two decimals, or three when two would put it on the other side of the
    tolerance from its flag (+1.004 stored and flagged reads +1.004, not +1.00)."""
    shown = round(value, 2)
    if (abs(shown) > tolerance) != flagged:
        return f"{round(value, 3) + 0.0:+.3f}"
    return f"{shown + 0.0:+.2f}"  # + 0.0: a deviation of -0.001 dB reads +0.00, not -0.00


def stable_target_report(doc: dict) -> list[str]:
    """The lines `qa` prints for a stable-target result: a table, then a verdict or one WARNING per flagged
    date (one WARNING in all when two dates are compared, one per polarization whose dates split into two
    halves). `doc` is what stable_target.json holds."""
    name, tol = doc["target"]["name"], doc["tolerance_db"]
    status, pols = doc["status"], doc["polarizations"]
    left = {item["date"] for item in doc.get("left_out", [])}
    by_date = doc.get("pixels_valid_by_date", {})
    head = f"qa      stable target '{name}'"
    lines = [f"{head}: tolerance {tol:g} dB; {doc['pixels_valid_on_every_date']} of its "
             f"{doc['pixels_in_target']} pixels are valid on every date{' compared' if left else ''} and in every "
             "polarization"]
    if doc.get("target_box") == PARTLY_OUTSIDE:
        lines.append(f"{head}: part of the box lies outside the processed window; only the pixels inside it "
                     "are used")
    if status == TOO_FEW_PIXELS:
        start = (f"{head}: not enough pixels ({doc['pixels_valid_on_every_date']}; at least {doc['min_pixels']} "
                 "are needed), so no value is given.")
        if max(by_date.values(), default=0) >= doc["min_pixels"]:
            lines.append(f"{start} The dates cover different parts of the box (valid pixels in it per date: "
                         f"{', '.join(f'{d} {n}' for d, n in by_date.items())}). Move it onto ground that every "
                         "date covers.")
        else:
            lines.append(f"{start} Make the box larger or move it onto ground that is valid on every date.")
        return lines

    dates = [item["date"] for item in next(iter(pols.values()))["dates"]]
    compared = [d for d in dates if d not in left]

    def column(entry: dict) -> str:
        if "split" not in entry:
            return "vs median"
        return "vs other" if len(compared) == 2 else "vs other half"

    widths = {pol: max(11, len(column(entry)) + 2) for pol, entry in pols.items()}
    pad = " " * 8
    lines.append(pad + f"{'date':<12}" + "".join(f"{pol + ' dB':>9}{column(entry):>{widths[pol]}} "
                                                 for pol, entry in pols.items()).rstrip())
    for i, date in enumerate(dates):
        cells = []
        for pol, entry in pols.items():
            item = entry["dates"][i]
            value = "-" if item["value_db"] is None else f"{item['value_db']:.2f}"
            dev = "" if item["deviation_db"] is None else _db_text(item["deviation_db"], tol, item["flagged"])
            cells.append(f"{value:>9}{dev:>{widths[pol]}}{'!' if item['flagged'] else ' '}")
        lines.append((pad + f"{date:<12}" + "".join(cells)).rstrip() + (f"   {NOT_COVERED}" if date in left else ""))
    if any(entry["reference_db"] is not None for entry in pols.values()):
        lines.append(pad + f"{'median':<12}" + "".join(
            f"{'' if entry['reference_db'] is None else format(entry['reference_db'], '.2f'):>9}"
            f"{'':>{widths[pol] + 1}}" for pol, entry in pols.items()).rstrip())
    for date in dates:
        if date in left:
            lines.append(f"{head}: {date} left out: {NOT_COVERED} ({by_date.get(date, 0)} valid pixels in the "
                         f"box, at least {doc['min_pixels']} needed), so it is not compared")
    if status == ONE_DATE:
        lines.append(f"{head}: nothing to compare: " + (
            f"only {compared[0]} covers the target" if left else f"the site has one date ({compared[0]})")
            + ", the check needs two or more.")
        return lines

    what = ("The target should not change, so {this} points to a calibration, mode or release problem{whose}, "
            "not to a change on the ground.")
    if len(compared) == 2:
        off = [f"{pol} {_db_text(entry['difference_db'], tol, True)} dB" for pol, entry in pols.items()
               if any(item["flagged"] for item in entry["dates"])]
        if off:
            lines.append(f"WARNING: stable target '{name}': the two dates {compared[0]} and {compared[1]} disagree "
                         f"by {', '.join(off)} (later minus earlier; tolerance {tol:g} dB). With only two dates "
                         "there is no telling which of them is off. "
                         + what.format(this="a difference like this", whose=""))
        else:
            lines.append(f"{head}: the two dates agree within {tol:g} dB")
        return lines
    for pol, entry in pols.items():
        if "split" in entry:
            split = entry["split"]
            lines.append(f"WARNING: stable target '{name}': in {pol} the {len(compared)} dates split into two "
                         f"halves that disagree: {', '.join(split['lower'])} read lower than "
                         f"{', '.join(split['upper'])}, and the two middle dates differ by "
                         f"{_db_text(split['gap_db'], tol, True)} dB (tolerance {tol:g} dB). With the dates split "
                         "evenly there is no telling which half is off. "
                         + what.format(this="a difference like this", whose=""))
    for i, date in enumerate(dates):
        off = [f"{pol} {_db_text(entry['dates'][i]['deviation_db'], tol, True)} dB" for pol, entry in pols.items()
               if entry["dates"][i]["flagged"] and "split" not in entry]
        if off:
            lines.append(f"WARNING: stable target '{name}': {date} differs from the median of all {len(compared)} "
                         f"dates{' compared' if left else ''} by {', '.join(off)} (tolerance {tol:g} dB). "
                         + what.format(this="a jump like this", whose=" with this date")
                         + " Look at its QA thumbnails, and at the release and processing version in its window "
                           "sidecar, before trusting it.")
    if not doc["flagged_dates"]:
        lines.append(f"{head}: every date{' compared' if left else ''} is within {tol:g} dB of the median")
    return lines
