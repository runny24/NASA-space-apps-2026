"""The stable-target check (pipeline/qa.py, stages.stable_target_site) on SYNTHETIC data.

The first half tests the computation on hand-made arrays, where every number is known. The second half
runs the stage on the processed rasters of a synthetic site, with scenes written into those rasters.
No target here is a place: every box is a block of the synthetic grid (pipeline/tests/synth.py).
"""

from __future__ import annotations

import json
import os
import shutil

import numpy as np
import pytest
import yaml
from affine import Affine
from pyproj import Transformer

from pipeline.config import ConfigError, load_site
from pipeline.paths import Layout
from pipeline.process import GridMismatchError
from pipeline.qa import (
    CHECKED,
    INSIDE,
    MIN_TARGET_PIXELS,
    ONE_DATE,
    OUTSIDE,
    PARTLY_OUTSIDE,
    TOO_FEW_PIXELS,
    stable_target_report,
    stable_target_series,
    target_pixels,
)
from pipeline.rasters import read_geotiff, read_json, write_geotiff
from pipeline.stages import STABLE_TARGET_FILE, fetch_site, process_site, qa_site, run_site, stable_target_site
from pipeline.tests.conftest import DATES, SITE_ID, make_synthetic_site
from pipeline.tests.synth import REAL_FORMAT, SynthGrid

FOUR = [*DATES, "2026-07-13"]
SHAPE = (40, 40)
ALL = np.ones(SHAPE, dtype=bool)


def power(db: float) -> float:
    return 10 ** (db / 10)


def speckle(level_db: float, seed: int, shape: tuple[int, int] = SHAPE, looks: int = 16) -> np.ndarray:
    """Gamma speckle around a level, like multilooked SAR intensity."""
    return np.random.default_rng(seed).gamma(looks, power(level_db) / looks, size=shape)


def doc_of(series: dict, tolerance: float = 1.0, where: str = INSIDE) -> dict:
    """What the stage would write, for the report function."""
    return {"target": {"name": "SYNTHETIC block"}, "tolerance_db": tolerance, "target_box": where, **series}


def warnings_in(lines: list[str]) -> list[str]:
    return [line for line in lines if line.startswith("WARNING")]


# The computation, on hand-made arrays -------------------------------------------------------------------

def test_stable_series_is_not_flagged():
    powers = {"HH": [speckle(-8.0, i) for i in range(4)], "HV": [speckle(-15.0, 10 + i) for i in range(4)]}
    series = stable_target_series(FOUR, powers, ALL, 1.0)
    assert series["status"] == CHECKED and series["flagged_dates"] == []
    assert series["pixels_in_target"] == series["pixels_valid_on_every_date"] == ALL.size
    for pol, level in (("HH", -8.0), ("HV", -15.0)):
        for item in series["polarizations"][pol]["dates"]:
            assert item["value_db"] == pytest.approx(level, abs=0.1)
            assert abs(item["deviation_db"]) < 0.1 and item["flagged"] is False
    lines = stable_target_report(doc_of(series))
    assert warnings_in(lines) == [] and "every date is within 1 dB of the median" in lines[-1]


def test_a_date_raised_by_2_db_is_flagged_and_named():
    hh = [speckle(-8.0, i) for i in range(4)]
    hh[2] = hh[2] * power(2.0)
    series = stable_target_series(FOUR, {"HH": hh, "HV": [speckle(-15.0, 10 + i) for i in range(4)]}, ALL, 1.0)
    assert series["flagged_dates"] == [FOUR[2]]
    items = series["polarizations"]["HH"]["dates"]
    assert [item["flagged"] for item in items] == [False, False, True, False]
    assert items[2]["deviation_db"] == pytest.approx(2.0, abs=0.1)
    assert not any(item["flagged"] for item in series["polarizations"]["HV"]["dates"])
    (line,) = warnings_in(stable_target_report(doc_of(series)))
    assert FOUR[2] in line and f"HH {items[2]['deviation_db']:+.2f} dB" in line and "HV" not in line
    assert all(d not in line for d in FOUR if d != FOUR[2])
    assert "calibration, mode or release problem" in line and "not to a change on the ground" in line


def test_mean_is_of_linear_power_not_of_decibels():
    # Half the pixels at -25 dB and half at -5 dB: mean power -7.97 dB, mean of the dB values -15 dB. The
    # other dates are uniform at that same mean power, so the series is stable only if power is averaged.
    checker = np.where((np.add.outer(np.arange(40), np.arange(40)) % 2) == 0, power(-25.0), power(-5.0))
    uniform = np.full(SHAPE, checker.mean())
    db_of_mean = 10 * np.log10(checker.mean())
    mean_of_db = np.mean(10 * np.log10(checker))
    assert abs(db_of_mean - mean_of_db) > 1  # the scene tells the two apart (by 7 dB)
    series = stable_target_series(DATES, {"HH": [uniform, checker, uniform]}, ALL, 1.0)
    items = series["polarizations"]["HH"]["dates"]
    assert items[1]["value_db"] == pytest.approx(db_of_mean, abs=1e-3)
    assert series["flagged_dates"] == []


def test_pixels_invalid_on_one_date_are_left_out_on_every_date():
    # Bright top half, dark bottom half, the same on every date. HH misses most of the bright half on date 2
    # (NaN), HV has zero power in a block of the dark half on date 3. Averaged over its own pixels, HH on date
    # 2 would read about 2.7 dB darker; over the common pixels every date reads the same.
    scene = np.where(np.arange(40)[:, None] < 20, power(-5.0), power(-20.0)) * np.ones(SHAPE)
    hh = [scene.copy() for _ in DATES]
    hv = [scene.copy() for _ in DATES]
    hh[1][:13] = np.nan
    hv[2][25:30, :10] = 0.0
    series = stable_target_series(DATES, {"HH": hh, "HV": hv}, ALL, 1.0)
    common = ALL.copy()
    common[:13] = False
    common[25:30, :10] = False
    assert series["pixels_valid_on_every_date"] == int(common.sum()) == 1600 - 520 - 50
    expected = 10 * np.log10(scene[common].mean())
    for pol in ("HH", "HV"):
        values = [item["value_db"] for item in series["polarizations"][pol]["dates"]]
        assert values[0] == values[1] == values[2] == pytest.approx(expected, abs=1e-3)  # stored to 0.001 dB
    assert series["flagged_dates"] == []
    own = 10 * np.log10(np.nanmean(hh[1]))
    assert abs(own - 10 * np.log10(scene.mean())) > 1  # what a per-date footprint would have reported


def test_too_few_pixels_gives_no_number():
    powers = {"HH": [speckle(-8.0, i) for i in range(3)]}
    few = np.zeros(SHAPE, dtype=bool)
    few.flat[:MIN_TARGET_PIXELS - 1] = True
    series = stable_target_series(DATES, powers, few, 1.0)
    assert series["status"] == TOO_FEW_PIXELS and series["pixels_valid_on_every_date"] == 99
    assert all(item["value_db"] is None and item["flagged"] is False
               for item in series["polarizations"]["HH"]["dates"])
    lines = stable_target_report(doc_of(series))
    assert warnings_in(lines) == [] and "not enough pixels (99; at least 100 are needed)" in lines[-1]
    few.flat[MIN_TARGET_PIXELS - 1] = True
    assert stable_target_series(DATES, powers, few, 1.0)["status"] == CHECKED


def test_a_single_date_has_nothing_to_compare():
    series = stable_target_series(DATES[:1], {"HH": [speckle(-8.0, 1)]}, ALL, 1.0)
    assert series["status"] == ONE_DATE and series["flagged_dates"] == []
    (item,) = series["polarizations"]["HH"]["dates"]
    assert item["value_db"] == pytest.approx(-8.0, abs=0.1) and item["deviation_db"] is None
    lines = stable_target_report(doc_of(series))
    assert warnings_in(lines) == [] and lines[-1].endswith("nothing to compare: the site has one date "
                                                           f"({DATES[0]}), the check needs two or more.")


def test_two_dates_that_disagree_are_both_flagged_without_blaming_one():
    p = np.full(SHAPE, power(-8.0))
    series = stable_target_series(DATES[:2], {"HH": [p, p * power(2.0)], "HV": [p, p]}, ALL, 1.0)
    hh = series["polarizations"]["HH"]
    assert hh["difference_db"] == pytest.approx(2.0, abs=1e-6)
    # Deviations from the median (halfway in power) would be -1.11 and +0.89 dB, which flag only the first
    # date and do not support a flag on the second. The two are compared with each other instead.
    assert hh["reference_db"] is None and hh["split"] == {"lower": DATES[:1], "upper": DATES[1:2], "gap_db": 2.0}
    assert [item["deviation_db"] for item in hh["dates"]] == [-2.0, 2.0]
    assert [item["flagged"] for item in hh["dates"]] == [True, True]
    assert series["flagged_dates"] == DATES[:2]
    lines = stable_target_report(doc_of(series))
    (line,) = warnings_in(lines)
    assert f"the two dates {DATES[0]} and {DATES[1]} disagree by HH +2.00 dB" in line
    assert "no telling which of them is off" in line and "median" not in line and "HV" not in line
    # The table shows numbers that support its flags: HH against the other date and no HH median; HV, whose
    # dates agree, against its median.
    assert lines[1].split() == ["date", "HH", "dB", "vs", "other", "HV", "dB", "vs", "median"]
    assert "-2.00!" in lines[2] and "+2.00!" in lines[3]
    assert lines[4].split() == ["median", "-8.00"]

    agree = stable_target_series(DATES[:2], {"HH": [p, p * power(0.5)]}, ALL, 1.0)
    assert agree["flagged_dates"] == []
    lines = stable_target_report(doc_of(agree))
    assert warnings_in(lines) == [] and lines[-1].endswith("the two dates agree within 1 dB")


def test_two_dates_1_5_db_apart_show_the_difference_not_the_median():
    # -8 and -6.5 dB: against the median the table used to show -0.81! and +0.69!, flags on numbers under
    # the 1 dB tolerance.
    series = stable_target_series(DATES[:2], {"HH": [np.full(SHAPE, power(-8.0)), np.full(SHAPE, power(-6.5))]},
                                  ALL, 1.0)
    lines = stable_target_report(doc_of(series))
    assert "-1.50!" in lines[2] and "+1.50!" in lines[3]
    assert not any("0.81" in line or "0.69" in line for line in lines)
    assert not any(line.strip().startswith("median") for line in lines)


def constant_dates(levels_db: list[float]) -> dict[str, list[np.ndarray]]:
    return {"HH": [np.full(SHAPE, power(level)) for level in levels_db]}


@pytest.mark.parametrize("levels", [[-8.0, -8.0, -6.0, -6.0], [-6.0, -6.0, -8.0, -8.0], [-8.0, -6.0, -8.0, -6.0]])
def test_an_even_split_flags_both_halves_and_blames_neither(levels):
    # With four dates the median of powers lies between the two middle dates, closer in dB to the higher:
    # here -6.89 dB, 1.11 dB from the -8 dB dates and 0.89 dB from the -6 dB ones. Blaming only the lower
    # half would be arbitrary.
    series = stable_target_series(FOUR, constant_dates(levels), ALL, 1.0)
    hh = series["polarizations"]["HH"]
    low = [d for d, level in zip(FOUR, levels, strict=True) if level == -8.0]
    high = [d for d in FOUR if d not in low]
    assert series["flagged_dates"] == FOUR and hh["reference_db"] is None
    assert hh["split"] == {"lower": low, "upper": high, "gap_db": 2.0}
    assert [item["deviation_db"] for item in hh["dates"]] == [2.0 if level == -6.0 else -2.0 for level in levels]
    lines = stable_target_report(doc_of(series))
    (line,) = warnings_in(lines)
    assert f"in HH the 4 dates split into two halves that disagree: {', '.join(low)} read lower than " \
           f"{', '.join(high)}, and the two middle dates differ by +2.00 dB" in line
    assert "no telling which half is off" in line and "with this date" not in line


def test_single_dates_are_still_blamed_when_the_median_is_clear():
    # Four dates whose two middle dates agree, and six dates with four at one level: one reference, so the
    # dates that leave it are flagged one by one.
    series = stable_target_series(FOUR, constant_dates([-8.0, -8.3, -6.0, -8.0]), ALL, 1.0)
    assert series["flagged_dates"] == [FOUR[2]] and "split" not in series["polarizations"]["HH"]
    assert series["polarizations"]["HH"]["reference_db"] == pytest.approx(-8.0, abs=1e-3)
    six = [*FOUR, "2026-07-25", "2026-08-06"]
    series = stable_target_series(six, constant_dates([-8.0, -6.0, -8.0, -8.0, -6.0, -8.0]), ALL, 1.0)
    assert series["flagged_dates"] == [six[1], six[4]]
    (first, second) = warnings_in(stable_target_report(doc_of(series)))
    assert six[1] in first and six[4] in second and "with this date" in first


def test_a_flag_follows_the_deviation_as_stored_and_printed():
    # The median is the middle date (-8 dB). 1.0004 dB above it is stored as 1.0: within the tolerance, so
    # not flagged. 1.004 dB above is flagged and printed with enough decimals to show it exceeds 1 dB.
    near = stable_target_series(DATES, constant_dates([-8.2, -8.0, -8.0 + 1.0004]), ALL, 1.0)
    item = near["polarizations"]["HH"]["dates"][2]
    assert item["deviation_db"] == 1.0 and item["flagged"] is False and near["flagged_dates"] == []
    assert warnings_in(stable_target_report(doc_of(near))) == []
    over = stable_target_series(DATES, constant_dates([-8.2, -8.0, -8.0 + 1.004]), ALL, 1.0)
    item = over["polarizations"]["HH"]["dates"][2]
    assert item["deviation_db"] == 1.004 and item["flagged"] is True
    lines = stable_target_report(doc_of(over))
    assert "+1.004!" in lines[4]
    (line,) = warnings_in(lines)
    assert "by HH +1.004 dB (tolerance 1 dB)" in line


def test_a_date_that_does_not_cover_the_target_is_left_out_and_named():
    # Five dates on a 60 x 60 grid, the target a 40 x 40 block. The third date misses the target (a partial
    # frame); the fourth is 3 dB high. Taking pixels valid on every date would leave none and void the
    # check for all five: the third date is left out instead, and the jump on the fourth is found.
    shape = (60, 60)
    target = np.zeros(shape, dtype=bool)
    target[10:50, 10:50] = True
    dates = [*FOUR, "2026-07-25"]
    hh = [speckle(-8.0, i, shape) for i in range(5)]
    hh[2][5:55, 5:55] = np.nan
    hh[3] = hh[3] * power(3.0)
    series = stable_target_series(dates, {"HH": hh}, target, 1.0)
    assert series["status"] == CHECKED and series["flagged_dates"] == [dates[3]]
    assert series["left_out"] == [{"date": dates[2], "reason": "target not covered on this date"}]
    assert series["pixels_valid_by_date"] == {d: 0 if d == dates[2] else 1600 for d in dates}
    assert series["pixels_valid_on_every_date"] == 1600
    item = series["polarizations"]["HH"]["dates"][2]
    assert item == {"date": dates[2], "value_db": None, "deviation_db": None, "flagged": False}
    lines = stable_target_report(doc_of(series))
    assert any(f"{dates[2]} left out: target not covered on this date (0 valid pixels" in line for line in lines)
    (line,) = warnings_in(lines)
    assert dates[3] in line and "median of all 4 dates compared" in line
    assert not any("Make the box larger" in line for line in lines)


def test_left_out_dates_with_one_or_two_dates_remaining():
    shape = (60, 60)
    target = np.zeros(shape, dtype=bool)
    target[10:50, 10:50] = True
    missing = np.full(shape, np.nan)
    # Two dates, one of them not covering the target: nothing to compare, and the message says why.
    series = stable_target_series(DATES[:2], {"HH": [speckle(-8.0, 1, shape), missing]}, target, 1.0)
    assert series["status"] == ONE_DATE and series["left_out"][0]["date"] == DATES[1]
    lines = stable_target_report(doc_of(series))
    assert lines[-1].endswith(f"nothing to compare: only {DATES[0]} covers the target, the check needs two or more.")
    # Three dates, the middle one missing: the two that remain are compared with each other.
    stack = [np.full(shape, power(-8.0)), missing, np.full(shape, power(-5.0))]
    series = stable_target_series(DATES, {"HH": stack}, target, 1.0)
    assert series["flagged_dates"] == [DATES[0], DATES[2]]
    (line,) = warnings_in(stable_target_report(doc_of(series)))
    assert f"the two dates {DATES[0]} and {DATES[2]} disagree by HH +3.00 dB" in line


def test_dates_that_cover_different_parts_of_the_target_are_not_told_to_enlarge_it():
    # Each date covers enough of the box, but no pixel of it is valid on both.
    left_half, right_half = np.full(SHAPE, power(-8.0)), np.full(SHAPE, power(-8.0))
    left_half[:, 20:] = np.nan
    right_half[:, :20] = np.nan
    series = stable_target_series(DATES[:2], {"HH": [left_half, right_half]}, ALL, 1.0)
    assert series["status"] == TOO_FEW_PIXELS and series["left_out"] == []
    lines = stable_target_report(doc_of(series))
    assert "The dates cover different parts of the box" in lines[-1] and "Make the box larger" not in lines[-1]
    assert f"{DATES[0]} 800, {DATES[1]} 800" in lines[-1]


# Which pixels belong to the target ---------------------------------------------------------------------

GEO = Affine(0.01, 0.0, 0.0, 0.0, -0.01, 1.0)  # a synthetic lon/lat grid of 100 x 100 pixels of 0.01 degrees


def test_target_pixels_are_those_whose_centres_lie_in_the_box():
    selection, where = target_pixels((0.101, 0.501, 0.199, 0.599), "EPSG:4326", GEO, (100, 100))
    expected = np.zeros((100, 100), dtype=bool)
    expected[40:50, 10:20] = True  # centres 0.105..0.195 east, 0.505..0.595 north
    assert where == INSIDE and np.array_equal(selection, expected)


def test_target_partly_or_wholly_off_the_grid():
    selection, where = target_pixels((-0.05, 0.501, 0.049, 0.599), "EPSG:4326", GEO, (100, 100))
    expected = np.zeros((100, 100), dtype=bool)
    expected[40:50, 0:5] = True
    assert where == PARTLY_OUTSIDE and np.array_equal(selection, expected)
    selection, where = target_pixels((1.5, 0.5, 1.6, 0.6), "EPSG:4326", GEO, (100, 100))
    assert where == OUTSIDE and not selection.any()
    # On the grid but smaller than a pixel, between centres: no pixel, and that is "not enough pixels".
    selection, where = target_pixels((0.101, 0.501, 0.104, 0.504), "EPSG:4326", GEO, (100, 100))
    assert where == INSIDE and not selection.any()
    series = stable_target_series(DATES, {"HH": [np.ones((100, 100))] * 3}, selection, 1.0)
    assert series["status"] == TOO_FEW_PIXELS


def test_target_pixels_on_a_projected_grid():
    # The synthetic UTM grid multilooked to 40 m; the box is source rows and columns 140 to 259, which are
    # working rows and columns 70 to 129.
    grid = SynthGrid()
    transform = Affine(40.0, 0.0, grid.x_first - 10.0, 0.0, -40.0, grid.y_first + 10.0)
    selection, where = target_pixels(grid.lonlat_box(140, 260, 140, 260), "EPSG:32611", transform, (300, 300))
    rows, cols = np.nonzero(selection)
    assert where == INSIDE
    assert rows.min() >= 70 and rows.max() <= 129 and cols.min() >= 70 and cols.max() <= 129
    assert selection.sum() > 0.9 * 60 * 60  # the lon/lat box is slightly skewed against the grid


# The stage, on the processed rasters of a synthetic site ------------------------------------------------

REAL = {k: v for k, v in REAL_FORMAT.items() if k != "convention"}
BOX = [round(v, 6) for v in SynthGrid().lonlat_box(140, 260, 140, 260)]  # clear of every feature in synth.py
TARGET = {"name": "SYNTHETIC uniform block", "bbox": BOX}


@pytest.fixture(scope="module")
def processed(tmp_path_factory) -> Layout:
    """A real-format SYNTHETIC site with HH and HV, fetched and processed once. Tests work on copies. Its
    levels rise by 3 dB per date (conftest.LEVELS_DB), which the target sees unless a test rewrites it."""
    layout = make_synthetic_site(tmp_path_factory.mktemp("stable-target"), convention="real", common=REAL,
                                 site={"polarizations": ["HH", "HV"]})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    process_site(cfg, layout)
    return layout


def copy_site(layout: Layout, root, dates: int | None = None) -> Layout:
    """A copy of the site's inputs and work folder; with `dates`, only the first that many dates are listed."""
    copy = Layout(sites_dir=root / "sites", work_dir=root / "work", data_dir=root / "data")
    shutil.copytree(layout.sites_dir, copy.sites_dir)
    shutil.copytree(layout.work_dir, copy.work_dir)
    if dates is not None:
        path = copy.sites_dir / f"{SITE_ID}.granules.json"
        listing = read_json(path)
        listing["granules"] = listing["granules"][:dates]
        path.write_text(json.dumps(listing), encoding="utf-8")
    return copy


def with_target(layout: Layout, target: dict | None = TARGET, **site):
    """Write the target (and other fields) into the site file and load it, so the config check runs too."""
    path = layout.sites_dir / f"{SITE_ID}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    data.update(site)
    data.pop("stable_target", None)
    if target is not None:
        data["stable_target"] = target
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    return load_site(SITE_ID, layout.sites_dir)


def proc_path(layout: Layout, date: str):
    return layout.site_work(SITE_ID) / "proc" / f"{date}.tif"


def set_proc(layout: Layout, date: str, bands: list[np.ndarray]) -> None:
    """Replace the bands of a processed raster (linear power); its grid and tags stay."""
    path = proc_path(layout, date)
    _, info = read_geotiff(path)
    write_geotiff(path, np.stack(bands).astype(np.float32), info["crs"], info["transform"], np.nan,
                  descriptions=info["descriptions"], tags=info["tags"])


def grid_of(layout: Layout) -> tuple[str, Affine, tuple[int, int]]:
    _, info = read_geotiff(proc_path(layout, DATES[0]))
    return info["crs"], info["transform"], info["shape"]


def selection_of(layout: Layout, bbox=BOX) -> np.ndarray:
    return target_pixels(tuple(bbox), *grid_of(layout))[0]


def stable_scenes(layout: Layout, dates=DATES, raise_hh: dict[str, float] | None = None) -> None:
    """Independent speckle at -8 dB (HH) and -15 dB (HV) on every date; HH of some dates raised by some dB."""
    shape = grid_of(layout)[2]
    for i, date in enumerate(dates):
        gain = power((raise_hh or {}).get(date, 0.0))
        set_proc(layout, date, [speckle(-8.0, 100 + i, shape) * gain, speckle(-15.0, 200 + i, shape)])


def test_stage_stable_series_stays_unflagged(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    cfg = with_target(layout)
    stable_scenes(layout)
    doc = stable_target_site(cfg, layout)
    assert doc == read_json(layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE)
    assert doc["target"] == TARGET and doc["tolerance_db"] == 1.0 and doc["target_box"] == INSIDE
    assert doc["status"] == CHECKED and doc["flagged_dates"] == []
    assert doc["grid"] == {"crs": "EPSG:32611", "resolution_m": 40.0}
    assert doc["pixels_valid_on_every_date"] == doc["pixels_in_target"] == int(selection_of(layout).sum()) > 3000
    for pol, level in (("HH", -8.0), ("HV", -15.0)):
        items = doc["polarizations"][pol]["dates"]
        assert [item["date"] for item in items] == DATES
        assert all(item["value_db"] == pytest.approx(level, abs=0.1) and not item["flagged"] for item in items)
    out = capsys.readouterr().out
    assert "WARNING" not in out and "HH dB" in out and "HV dB" in out
    assert "every date is within 1 dB of the median" in out


def test_stage_flags_and_names_a_date_raised_by_2_db(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    cfg = with_target(layout)
    stable_scenes(layout, raise_hh={DATES[2]: 2.0})
    doc = stable_target_site(cfg, layout)  # a flag is a warning: no exception
    assert doc["flagged_dates"] == [DATES[2]]
    assert doc["polarizations"]["HH"]["dates"][2]["deviation_db"] == pytest.approx(2.0, abs=0.1)
    (line,) = warnings_in(capsys.readouterr().out.splitlines())
    assert DATES[2] in line and DATES[0] not in line and DATES[1] not in line and "HH +" in line
    assert "points to a calibration, mode or release problem with this date, not to a change on the ground" in line


def test_stage_averages_linear_power(processed, tmp_path):
    layout = copy_site(processed, tmp_path)
    cfg = with_target(layout)
    shape = grid_of(layout)[2]
    checker = np.where((np.add.outer(np.arange(shape[0]), np.arange(shape[1])) % 2) == 0,
                       power(-25.0), power(-5.0))
    uniform = np.full(shape, (power(-25.0) + power(-5.0)) / 2)
    for date, scene in zip(DATES, (uniform, checker, uniform), strict=True):
        set_proc(layout, date, [scene, scene])
    doc = stable_target_site(cfg, layout)
    inside = checker[selection_of(layout)].astype(np.float32).astype(np.float64)
    db_of_mean, mean_of_db = 10 * np.log10(inside.mean()), np.mean(10 * np.log10(inside))
    assert abs(db_of_mean - mean_of_db) > 1
    assert doc["polarizations"]["HH"]["dates"][1]["value_db"] == pytest.approx(db_of_mean, abs=1e-3)
    assert doc["flagged_dates"] == []  # by the mean of dB values the middle date would be 7 dB low


def test_stage_leaves_pixels_invalid_on_one_date_out_of_every_date(processed, tmp_path):
    layout = copy_site(processed, tmp_path)
    cfg = with_target(layout)
    selection = selection_of(layout)
    rows = np.nonzero(selection.any(axis=1))[0]
    top, middle = rows.min(), (rows.min() + rows.max()) // 2
    shape = selection.shape
    scene = np.where(np.arange(shape[0])[:, None] < middle, power(-5.0), power(-20.0)) * np.ones(shape)
    hole = np.zeros(shape, dtype=bool)
    hole[top:top + 2 * (middle - top) // 3] = True  # most of the bright half, on the second date only
    for date in DATES:
        set_proc(layout, date, [np.where(hole, np.nan, scene) if date == DATES[1] else scene, scene])
    doc = stable_target_site(cfg, layout)
    common = selection & ~hole
    assert doc["pixels_in_target"] == int(selection.sum())
    assert doc["pixels_valid_on_every_date"] == int(common.sum())
    expected = 10 * np.log10(scene[common].astype(np.float32).astype(np.float64).mean())
    for pol in ("HH", "HV"):
        assert [item["value_db"] for item in doc["polarizations"][pol]["dates"]] == pytest.approx([expected] * 3,
                                                                                                abs=1e-3)
    assert doc["flagged_dates"] == []
    # Averaged over its own pixels, the second date would differ from the others by more than 1 dB.
    assert abs(10 * np.log10(scene[common].mean()) - 10 * np.log10(scene[selection].mean())) > 1


def test_stage_too_few_pixels(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    tiny = [round(v, 6) for v in SynthGrid().lonlat_box(200, 210, 200, 210)]  # about 5 x 5 working pixels
    doc = stable_target_site(with_target(layout, {"name": "SYNTHETIC tiny box", "bbox": tiny}), layout)
    assert doc["status"] == TOO_FEW_PIXELS and 0 < doc["pixels_valid_on_every_date"] < MIN_TARGET_PIXELS
    assert all(item["value_db"] is None for item in doc["polarizations"]["HH"]["dates"])
    out = capsys.readouterr().out
    assert "not enough pixels" in out and "WARNING" not in out


def test_stage_single_date(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path, dates=1)
    doc = stable_target_site(with_target(layout), layout)
    assert doc["status"] == ONE_DATE and [i["date"] for i in doc["polarizations"]["HH"]["dates"]] == DATES[:1]
    out = capsys.readouterr().out
    assert "nothing to compare" in out and "WARNING" not in out


def test_stage_two_dates_that_disagree(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path, dates=2)
    cfg = with_target(layout)
    stable_scenes(layout, dates=DATES[:2], raise_hh={DATES[1]: 2.0})
    doc = stable_target_site(cfg, layout)
    assert doc["flagged_dates"] == DATES[:2]
    assert doc["polarizations"]["HH"]["difference_db"] == pytest.approx(2.0, abs=0.1)
    assert not any(item["flagged"] for item in doc["polarizations"]["HV"]["dates"])
    (line,) = warnings_in(capsys.readouterr().out.splitlines())
    assert f"the two dates {DATES[0]} and {DATES[1]} disagree by HH +" in line
    assert "no telling which of them is off" in line


def test_stage_without_the_setting_says_how_to_switch_it_on(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    out_file = layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE
    assert stable_target_site(with_target(layout, None), layout) is None
    (line,) = capsys.readouterr().out.splitlines()
    assert "skipped" in line and "stable_target" in line and "_template.yaml" in line
    assert not out_file.exists()
    # A result left from when the site had a target is removed, since nothing now keeps it current.
    stable_target_site(with_target(layout), layout)
    assert out_file.is_file()
    capsys.readouterr()
    stable_target_site(with_target(layout, None), layout)
    assert not out_file.exists() and "removed the old stable_target.json" in capsys.readouterr().out


def test_stage_follows_the_rerun_rule(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    out_file = layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE
    cfg = with_target(layout)
    first = stable_target_site(cfg, layout)
    assert first["flagged_dates"] == [DATES[0], DATES[2]]  # the synthetic levels rise 3 dB per date
    made = out_file.stat().st_mtime_ns
    capsys.readouterr()

    assert stable_target_site(cfg, layout) == first
    out = capsys.readouterr().out
    assert "exists, skipped" in out and out.count("WARNING") == 2  # the warnings are printed again
    assert out_file.stat().st_mtime_ns == made

    looser = with_target(layout, {**TARGET, "tolerance_db": 5.0})  # a changed setting redoes it
    assert stable_target_site(looser, layout)["flagged_dates"] == []
    assert out_file.stat().st_mtime_ns > made and "WARNING" not in capsys.readouterr().out

    made = out_file.stat().st_mtime_ns
    stable_target_site(looser, layout)  # up to date again
    assert out_file.stat().st_mtime_ns == made
    stable_target_site(looser, layout, force=True)
    assert out_file.stat().st_mtime_ns > made

    made = out_file.stat().st_mtime_ns
    later = made + 10_000_000_000  # a processed raster made again after the check
    os.utime(proc_path(layout, DATES[1]), ns=(later, later))
    stable_target_site(looser, layout)
    assert out_file.stat().st_mtime_ns > made


def test_stage_redoes_the_check_when_the_target_or_the_dates_change(processed, tmp_path, capsys):
    layout = copy_site(processed, tmp_path)
    out_file = layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE
    stable_target_site(with_target(layout), layout)
    capsys.readouterr()

    def redone(cfg) -> dict:
        made = out_file.stat().st_mtime_ns
        doc = stable_target_site(cfg, layout)
        assert out_file.stat().st_mtime_ns > made and "exists, skipped" not in capsys.readouterr().out
        assert doc == read_json(out_file)
        return doc

    other = [round(v, 6) for v in SynthGrid().lonlat_box(380, 480, 140, 260)]  # another clear block
    moved = redone(with_target(layout, {**TARGET, "bbox": other}))  # the same name, another box
    assert moved["target"] == {**TARGET, "bbox": other}
    assert moved["pixels_in_target"] == int(selection_of(layout, other).sum())
    renamed = redone(with_target(layout, {"name": "SYNTHETIC renamed block", "bbox": other}))
    assert renamed["target"]["name"] == "SYNTHETIC renamed block"
    listing_path = layout.sites_dir / f"{SITE_ID}.granules.json"
    listing = read_json(listing_path)
    listing["granules"] = listing["granules"][:2]  # a date dropped from the granule list
    listing_path.write_text(json.dumps(listing), encoding="utf-8")
    fewer = redone(load_site(SITE_ID, layout.sites_dir))
    assert [item["date"] for item in fewer["polarizations"]["HH"]["dates"]] == DATES[:2]
    older = {**fewer, "inputs": {**fewer["inputs"], "method": "an older rule"}}  # made by an older version
    out_file.write_text(json.dumps(older), encoding="utf-8")
    assert redone(load_site(SITE_ID, layout.sites_dir))["inputs"]["method"] != "an older rule"


def test_stage_refuses_dates_on_different_grids(tmp_path):
    # Science rule 5: one date's granule sits on a grid shifted by one pixel. process stops, but only after
    # writing every processed raster; the check must not compare pixels that are not the same ground.
    layout = make_synthetic_site(tmp_path, files={DATES[1]: {"grid": SynthGrid(x_first=400020.0)}},
                                 site={"stable_target": TARGET})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    with pytest.raises(GridMismatchError):
        process_site(cfg, layout)
    assert all(proc_path(layout, date).is_file() for date in DATES)
    with pytest.raises(GridMismatchError):
        stable_target_site(cfg, layout)
    assert not (layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE).exists()


def test_stage_refuses_rasters_processed_for_other_polarizations(processed, tmp_path):
    # The site file now lists HV first, but the processed rasters still hold HH, HV: without the check
    # each value would be filed under the other polarization.
    layout = copy_site(processed, tmp_path)
    cfg = with_target(layout, polarizations=["HV", "HH"])
    with pytest.raises(ValueError, match=r"holds \['HH', 'HV'\] but the site file asks for \['HV', 'HH'\]; "
                                         r"run .*process"):
        stable_target_site(cfg, layout)


def test_stage_leaves_out_a_date_whose_frame_misses_the_target(tmp_path, capsys):
    # The second date's file has a hole (a partial frame) over the whole target. The other two dates differ
    # by 6 dB (conftest.LEVELS_DB); the check must still find that, and name the date it left out.
    layout = make_synthetic_site(tmp_path, files={DATES[1]: {"hole": (130, 270, 130, 270)}},
                                 site={"stable_target": TARGET})
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    doc = read_json(layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE)
    assert doc["status"] == CHECKED and doc["left_out"] == [{"date": DATES[1], "reason": "target not covered on "
                                                                                            "this date"}]
    assert doc["pixels_valid_by_date"][DATES[1]] == 0 and doc["pixels_valid_on_every_date"] > 3000
    assert doc["flagged_dates"] == [DATES[0], DATES[2]]
    assert doc["polarizations"]["HH"]["difference_db"] == pytest.approx(6.0, abs=0.2)
    out = capsys.readouterr().out
    assert f"{DATES[1]} left out: target not covered on this date" in out and "Make the box larger" not in out
    (line,) = [w for w in warnings_in(out.splitlines()) if "stable target" in w]
    assert f"the two dates {DATES[0]} and {DATES[2]} disagree by HH +" in line


def test_qa_and_run_include_the_check_and_a_flag_does_not_stop_them(tmp_path, synthetic_run, capsys):
    # The same synthetic site as the shared run, plus a target: the run passes, warns, and publishes the same.
    layout = make_synthetic_site(tmp_path, site={"stable_target": TARGET})
    assert run_site(load_site(SITE_ID, layout.sites_dir), layout) == 0
    out = capsys.readouterr().out
    warned = warnings_in(out.splitlines())
    assert [w for w in warned if "stable target" in w] == warned and len(warned) == 2
    assert DATES[0] in warned[0] and DATES[2] in warned[1]
    assert read_json(layout.site_work(SITE_ID) / "qa" / STABLE_TARGET_FILE)["flagged_dates"] == [DATES[0], DATES[2]]
    assert sorted(p.name for p in layout.site_data(SITE_ID).iterdir()) == \
        sorted(p.name for p in synthetic_run.data.iterdir())
    assert read_json(layout.site_data(SITE_ID) / "stats.json") == read_json(synthetic_run.data / "stats.json")
    qa_site(load_site(SITE_ID, layout.sites_dir), layout)  # the qa command on its own
    assert "qa      stable target: exists, skipped" in capsys.readouterr().out


# A target the data does not reach: the site box runs past the north edge of the synthetic grid, so the
# window is clipped there, and the target lies (wholly or partly) in the part no granule covers.

def _north_edge() -> tuple[float, float]:
    grid = SynthGrid()
    to_lonlat = Transformer.from_crs(f"EPSG:{grid.epsg}", "EPSG:4326", always_xy=True)
    xs = np.linspace(grid.x_first - 10, grid.x[-1] + 10, 61)
    _, lats = to_lonlat.transform(xs, np.full_like(xs, grid.y_first + 10))
    return float(np.min(lats)), float(np.max(lats))


@pytest.fixture(scope="module")
def clipped(tmp_path_factory) -> Layout:
    w, s, e, _ = SynthGrid().lonlat_bounds(margin_px=60)
    north = _north_edge()[1] + 0.01
    layout = make_synthetic_site(tmp_path_factory.mktemp("clipped"),
                                 site={"bbox": [round(v, 6) for v in (w, s, e, north)]})
    cfg = load_site(SITE_ID, layout.sites_dir)
    fetch_site(cfg, layout)
    process_site(cfg, layout)
    return layout


def test_stage_target_outside_the_window_is_a_configuration_error(clipped, tmp_path):
    layout = copy_site(clipped, tmp_path)
    w, _, e, _ = SynthGrid().lonlat_bounds(margin_px=150)
    south = _north_edge()[1] + 0.002
    cfg = with_target(layout, {"name": "SYNTHETIC box past the edge", "bbox": [w, south, e, south + 0.005]})
    assert read_json(layout.site_work(SITE_ID) / "windows" / f"{DATES[0]}.json")["window"]["clipped"] is True
    with pytest.raises(ConfigError, match=r"stable_target\.bbox': the box .* lies outside the processed window"):
        stable_target_site(cfg, layout)


def test_stage_target_partly_outside_the_window_uses_the_part_inside(clipped, tmp_path, capsys):
    layout = copy_site(clipped, tmp_path)
    w, _, e, _ = SynthGrid().lonlat_bounds(margin_px=150)
    low, high = _north_edge()
    cfg = with_target(layout, {"name": "SYNTHETIC box across the edge", "bbox": [w, low - 0.01, e, high + 0.002]})
    doc = stable_target_site(cfg, layout)
    assert doc["target_box"] == PARTLY_OUTSIDE and doc["status"] == CHECKED
    assert doc["pixels_valid_on_every_date"] > MIN_TARGET_PIXELS
    assert "part of the box lies outside the processed window" in capsys.readouterr().out
